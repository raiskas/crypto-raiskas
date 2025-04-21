import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { supabaseConfig } from '@/lib/config';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { z } from "zod";
import { getCurrentUser, getServiceClient, getClientWithCookies } from '@/lib/supabase/auth';
import { getServerUser } from '@/lib/supabase/async-cookies';

// Função para criar um cliente Supabase específico para Route Handlers
// Não podemos criar fora porque `cookies()` só funciona dentro da função da rota
const createSupabaseClient = () => {
  const cookieStore = cookies();
  return createServerClient<Database>(
    supabaseConfig.url!,
    supabaseConfig.serviceRoleKey!, // Usar chave de serviço para operações de admin/backend
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );
};

// Schema para validação da operação
const operacaoSchema = z.object({
  id: z.string().uuid().optional(),
  grupo_id: z.string().uuid("ID do Grupo inválido"),
  moeda_id: z.string(),
  simbolo: z.string(),
  nome: z.string(),
  tipo: z.enum(["compra", "venda"]),
  quantidade: z.number().positive(),
  preco_unitario: z.number().positive(),
  valor_total: z.number().positive(),
  taxa: z.number().min(0).optional().default(0),
  data_operacao: z.string().datetime(),
  exchange: z.string(),
  notas: z.string().nullable().optional(),
});

// GET: Listar operações do usuário atual
export async function GET(request: NextRequest) {
  const supabase = createSupabaseClient(); // Criar cliente dentro da função
  try {
    // Obter o usuário diretamente do cliente Supabase criado para esta requisição
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      // Logar o erro específico se houver
      if (authError) console.error("[API:operacoes:GET] Erro ao obter usuário:", authError.message);
      // Retornar o erro 401
      return NextResponse.json({ error: "Usuário não autenticado ou não encontrado" }, { status: 401 });
    }
    // Agora temos o 'user' autenticado
    console.log(`[API:operacoes:GET] Usuário autenticado: ${user.id}`);

    // --- Buscar Perfil do Usuário (Necessário para is_master e ID interno) ---
    const { data: userProfile, error: profileError } = await supabase
      .from('usuarios') // Sua tabela de perfis
      .select('id, is_master, empresa_id') // <<< ADICIONADO empresa_id
      .eq('auth_id', user.id) // Filtrar pelo ID de autenticação
      .single();

    if (profileError || !userProfile) {
      console.error(`[API:operacoes:GET] Erro ao buscar perfil para auth_id ${user.id} ou perfil não encontrado:`, profileError?.message);
      return NextResponse.json({ error: "Perfil do usuário não encontrado ou erro ao buscar perfil" }, { status: 404 });
    }
    console.log(`[API:operacoes:GET] Perfil encontrado: ID ${userProfile.id}, Master: ${userProfile.is_master}, Empresa: ${userProfile.empresa_id}`);
    // --- Fim da Busca de Perfil ---
    
    // Verificar se o usuário tem uma empresa associada
    if (!userProfile.empresa_id) {
        console.warn(`[API:operacoes:GET] Usuário ${userProfile.id} não está associado a nenhuma empresa.`);
        // Retornar array vazio se o usuário não tem empresa? Ou erro? Decidido retornar vazio.
        return NextResponse.json([]); 
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // <<< MODIFICAÇÃO DA QUERY PRINCIPAL >>>
    let query = supabase
      .from("crypto_operacoes")
      // Usar INNER JOIN implícito para garantir que a operação tem um grupo
      // e selecionar a empresa_id do grupo para filtragem
      .select(`
        *,
        grupos!inner(id, nome, empresa_id)
      `)
      // Adicionar filtro pela empresa_id do usuário logado, vinda da tabela grupos
      .eq('grupos.empresa_id', userProfile.empresa_id); 

    // Manter filtro por ID se fornecido (para buscar uma operação específica)
    if (id) {
      query = query.eq('id', id);
    } else {
      // Ordenar por data decrescente por padrão na listagem
      query = query.order('data_operacao', { ascending: false });
    }
    // <<< FIM DA MODIFICAÇÃO DA QUERY >>>

    let data, error;
    if (id) {
        const { data: singleData, error: singleError } = await query.single();
        data = singleData;
        error = singleError;
    } else {
        const { data: listData, error: listError } = await query;
        data = listData;
        error = listError;
    }

    if (error) {
        if (id && error.code === 'PGRST116') { 
             console.log(`[API:operacoes:GET] Operação com ID ${id} não encontrada.`);
             return NextResponse.json({ error: "Operação não encontrada" }, { status: 404 });
        }
        console.error("[API:operacoes:GET] Erro na consulta:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log ADICIONAL: Ver o que está sendo retornado ANTES do NextResponse
    console.log("[API:operacoes:GET] Dados a serem retornados:", JSON.stringify(data, null, 2)); 

    return NextResponse.json(data);

  } catch (error: any) {
    console.error("[API:operacoes:GET] Erro inesperado:", error);
    return NextResponse.json({ error: `Erro interno: ${error.message}` }, { status: 500 });
  }
}

// POST: Criar nova operação
export async function POST(request: NextRequest) {
  const supabase = createSupabaseClient(); // Criar cliente dentro da função
  try {
    // 1. Obter usuário autenticado
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      console.error("[API:operacoes:POST] Erro ao obter usuário autenticado:", authError?.message);
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    console.log(`[API:operacoes:POST] Usuário autenticado: ${authUser.id}`);

    // 2. Buscar perfil do usuário (incluindo is_master)
    const { data: userProfile, error: profileError } = await supabase
      .from('usuarios')
      .select('id, is_master') // Buscar ID interno e flag master
      .eq('auth_id', authUser.id)
      .single();

    if (profileError || !userProfile) {
      console.error(`[API:operacoes:POST] Erro ao buscar perfil para auth_id ${authUser.id} ou perfil não encontrado:`, profileError?.message);
      return NextResponse.json({ error: "Perfil do usuário não encontrado" }, { status: 404 });
    }
    console.log(`[API:operacoes:POST] Perfil do usuário: ID ${userProfile.id}, Master: ${userProfile.is_master}`);

    const body = await request.json();
    console.log("[API:operacoes:POST] Body recebido:", body);
    const { nome, moeda_id, tipo, data_operacao, quantidade, preco_unitario, valor_total, exchange, notas, grupo_id, simbolo } = body;

    // Validação básica (poderia usar Zod aqui também)
    if (!nome || !moeda_id || !tipo || !data_operacao || !simbolo || quantidade === undefined || preco_unitario === undefined || valor_total === undefined || !grupo_id) {
      return NextResponse.json({ error: "Campos obrigatórios faltando (nome, moeda_id, tipo, data_operacao, simbolo, quantidade, preco_unitario, valor_total, grupo_id)" }, { status: 400 });
    }

    // 3. Verificar se o usuário tem permissão para adicionar ao grupo_id (se não for master)
    if (!userProfile.is_master) {
        console.log(`[API:operacoes:POST] Usuário não é master. Verificando se o grupo ${grupo_id} pertence ao usuário ${userProfile.id}`);
        const { data: userGroupLinks, error: groupsError } = await supabase
            .from('usuarios_grupos')
            .select('grupo_id')
            .eq('usuario_id', userProfile.id)
            .eq('grupo_id', grupo_id); // Verificar se a ligação existe

        if (groupsError) {
            console.error(`[API:operacoes:POST] Erro ao buscar grupos para usuário ${userProfile.id}: ${groupsError.message}`);
            return NextResponse.json({ error: "Erro ao verificar permissão de grupo" }, { status: 500 });
        }
        
        // Se a consulta retornar vazio, o usuário não pertence ao grupo
        if (!userGroupLinks || userGroupLinks.length === 0) {
            console.warn(`[API:operacoes:POST] Tentativa não autorizada: Usuário ${userProfile.id} tentando inserir no grupo ${grupo_id} ao qual não pertence.`);
            return NextResponse.json({ error: "Não autorizado a inserir operação neste grupo." }, { status: 403 });
        }
         console.log(`[API:operacoes:POST] Verificação de grupo OK. Usuário ${userProfile.id} pertence ao grupo ${grupo_id}.`);
    } else {
         console.log(`[API:operacoes:POST] Usuário é master, permissão de grupo concedida.`);
    }

    // 4. Inserir a operação usando o ID interno do usuário
    const { data, error } = await supabase
      .from("crypto_operacoes")
      .insert({
        nome,
        moeda_id,
        simbolo,
        tipo,
        data_operacao,
        quantidade,
        preco_unitario,
        valor_total,
        exchange: exchange || null, // Garantir null se vazio
        notas: notas || null, // Garantir null se vazio
        usuario_id: userProfile.id, // USAR ID INTERNO DO PERFIL
        grupo_id: grupo_id
      })
      .select()
      .single();

    if (error) {
      console.error("[API:operacoes:POST] Erro ao inserir:", error);
      if (error.code === '23503') { 
          return NextResponse.json({ error: `Erro de referência: ${error.message}` }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log("[API:operacoes:POST] Operação criada com sucesso:", data.id);
    return NextResponse.json(data, { status: 201 });

  } catch (error: any) {
    console.error("[API:operacoes:POST] Erro inesperado:", error);
    return NextResponse.json({ error: `Erro interno: ${error.message}` }, { status: 500 });
  }
}

// PATCH: Atualizar operação existente
export async function PATCH(request: NextRequest) {
    const supabase = createSupabaseClient(); // Criar cliente dentro da função
    try {
        const user = await getCurrentUser();
        if (!user) { // Verificar usuário nulo
            return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        }
        console.log(`[API:operacoes:PATCH] Recebida requisição de ${user.id}`);

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: "ID da operação é obrigatório" }, { status: 400 });
        }

        const body = await request.json();
        console.log(`[API:operacoes:PATCH] Body recebido para ID ${id}:`, body);

        // Verificar permissão (se não for master, só pode editar operações do seu grupo)
        if (!user.is_master) {
            const { data: operacao, error: fetchError } = await supabase
                .from('crypto_operacoes')
                .select('grupo_id')
                .eq('id', id)
                .single();

            if (fetchError || !operacao) {
                return NextResponse.json({ error: "Operação não encontrada ou erro ao buscar" }, { status: fetchError ? 500 : 404 });
            }
            
            if (operacao.grupo_id) { // Só verificar se a operação pertence a um grupo
                // Obter grupo_ids do usuário da tabela usuarios_grupos
                const { data: userGroupLinks, error: groupsError } = await supabase
                    .from('usuarios_grupos')
                    .select('grupo_id')
                    .eq('usuario_id', user.id); 

                if (groupsError) {
                     return NextResponse.json({ error: "Erro ao verificar permissão de grupo" }, { status: 500 });
                }
                const userGroupIds = userGroupLinks?.map((link: { grupo_id: string }) => link.grupo_id) ?? [];
                if (!userGroupIds.includes(operacao.grupo_id)) {
                    return NextResponse.json({ error: "Permissão negada para editar esta operação" }, { status: 403 });
                }
            } else {
                 // Se a operação não tem grupo_id, um não-master não deveria poder editar?
                 // Ou talvez possa se foi ele quem criou? Adicionar lógica de created_by?
                 // Por segurança, vamos negar por enquanto se a operação não tem grupo.
                 return NextResponse.json({ error: "Permissão negada (operação sem grupo)" }, { status: 403 });
            }
        }
        
        // Remover campos que não devem ser atualizados diretamente (como IDs)
        const { id: bodyId, criado_em, atualizado_em, ...updateData } = body;

        const { data, error } = await supabase
            .from("crypto_operacoes")
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error("[API:operacoes:PATCH] Erro ao atualizar:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        console.log(`[API:operacoes:PATCH] Operação ${id} atualizada com sucesso.`);
        return NextResponse.json(data);

    } catch (error: any) {
        console.error("[API:operacoes:PATCH] Erro inesperado:", error);
        return NextResponse.json({ error: `Erro interno: ${error.message}` }, { status: 500 });
    }
}

// DELETE: Remover operação existente
export async function DELETE(request: NextRequest) {
    const supabase = createSupabaseClient(); // Criar cliente dentro da função
    try {
        const user = await getCurrentUser();
        if (!user) { // Verificar usuário nulo
            return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        }
        console.log(`[API:operacoes:DELETE] Recebida requisição de ${user.id}`);

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: "ID da operação é obrigatório" }, { status: 400 });
        }

        // Verificar permissão (se não for master, só pode deletar operações do seu grupo)
        if (!user.is_master) {
            const { data: operacao, error: fetchError } = await supabase
                .from('crypto_operacoes')
                .select('grupo_id')
                .eq('id', id)
                .single();

            if (fetchError || !operacao) {
                return NextResponse.json({ error: "Operação não encontrada ou erro ao buscar" }, { status: fetchError ? 500 : 404 });
            }
            
            if (operacao.grupo_id) { // Só verificar se a operação pertence a um grupo
                // Obter grupo_ids do usuário da tabela usuarios_grupos
                const { data: userGroupLinks, error: groupsError } = await supabase
                    .from('usuarios_grupos')
                    .select('grupo_id')
                    .eq('usuario_id', user.id); 

                if (groupsError) {
                     return NextResponse.json({ error: "Erro ao verificar permissão de grupo" }, { status: 500 });
                }
                const userGroupIds = userGroupLinks?.map((link: { grupo_id: string }) => link.grupo_id) ?? [];
                if (!userGroupIds.includes(operacao.grupo_id)) {
                    return NextResponse.json({ error: "Permissão negada para deletar esta operação" }, { status: 403 });
                }
            } else {
                 // Se a operação não tem grupo_id, um não-master não deveria poder deletar?
                 // Ou talvez possa se foi ele quem criou? Adicionar lógica de created_by?
                 // Por segurança, vamos negar por enquanto se a operação não tem grupo.
                 return NextResponse.json({ error: "Permissão negada (operação sem grupo)" }, { status: 403 });
            }
        }
        
        // Remover a operação
        const { error } = await supabase
            .from("crypto_operacoes")
            .delete()
            .eq('id', id);

        if (error) {
            console.error("[API:operacoes:DELETE] Erro ao deletar:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        console.log(`[API:operacoes:DELETE] Operação ${id} deletada com sucesso.`);
        return NextResponse.json({ message: "Operação deletada com sucesso" });

    } catch (error: any) {
        console.error("[API:operacoes:DELETE] Erro inesperado:", error);
        return NextResponse.json({ error: `Erro interno: ${error.message}` }, { status: 500 });
    }
}