import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
// @ts-ignore - Ignorar erro de tipo devido à falha na geração de tipos
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
  const supabase = createSupabaseClient();
  try {
    // Obter o usuário
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      if (authError) console.error("[API:operacoes:GET] Erro ao obter usuário:", authError.message);
      return NextResponse.json({ error: "Usuário não autenticado ou não encontrado" }, { status: 401 });
    }

    // Buscar Perfil do Usuário
    const { data: userProfile, error: profileError } = await supabase
      .from('usuarios')
      .select('id, is_master, empresa_id')
      .eq('auth_id', user.id)
      .single();
    if (profileError || !userProfile) {
      console.error(`[API:operacoes:GET] Erro ao buscar perfil para auth_id ${user.id}:`, profileError?.message);
      return NextResponse.json({ error: "Perfil do usuário não encontrado" }, { status: 404 });
    }

    // Verificar se o usuário tem uma empresa associada
    if (!userProfile.empresa_id) {
        console.warn(`[API:operacoes:GET] Usuário ${userProfile.id} não está associado a nenhuma empresa.`);
        // Retornar array vazio se o usuário não tem empresa? Ou erro? Decidido retornar vazio.
        // Ajuste: Se buscando por ID específico, talvez retornar 403/404 aqui?
        // return NextResponse.json([]); // Mantendo retorno vazio por enquanto para listagem
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const carteiraId = searchParams.get('carteira_id');

    // Construir a query base
    let query = supabase
      .from("crypto_operacoes")
      // CORRIGIDO: Usar string normal ou template string corretamente
      .select(`
        *,
        grupos!inner(id, nome, empresa_id)
      `); // <<< String corrigida

    // Aplicar filtros condicionais
    if (id) {
      query = query.eq('id', id);
    } else {
      if (carteiraId) {
        query = query.eq("carteira_id", carteiraId);
      }
      // Aplicar filtro de empresa APENAS na listagem
      if (userProfile.empresa_id) {
         query = query.eq('grupos.empresa_id', userProfile.empresa_id);
      } else {
         console.warn("[API:operacoes:GET] Listagem sem filtro de empresa...");
      }
      query = query.order('data_operacao', { ascending: false });
    }

    // Executar a query
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

    // Tratar erros da query
    if (error) {
        if (id && error.code === 'PGRST116') {
             return NextResponse.json({ error: "Operação não encontrada" }, { status: 404 });
        }
        console.error("[API:operacoes:GET] Erro na consulta Supabase:", error);
        return NextResponse.json({ error: `Erro na consulta: ${error.message}` }, { status: 500 });
    }

    // Lógica de Verificação de Permissão para ID específico
    if (id && data) {
        // @ts-ignore
        const operacaoEmpresaId = data.grupos?.empresa_id;
        if (operacaoEmpresaId !== userProfile.empresa_id && !userProfile.is_master) {
             return NextResponse.json({ error: "Operação não encontrada" }, { status: 404 });
        }
    }

    if (id) {
      return NextResponse.json({ operacao: data });
    } else {
      return NextResponse.json(data);
    }

  } catch (error: any) {
    console.error("[API:operacoes:GET] Erro inesperado (catch geral):", error);
    return NextResponse.json({ error: `Erro interno do servidor: ${error.message}` }, { status: 500 });
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

    const body = await request.json();
    const { nome, moeda_id, tipo, data_operacao, quantidade, preco_unitario, valor_total, exchange, notas, grupo_id, simbolo, carteira_id } = body;

    // Validação básica (poderia usar Zod aqui também)
    if (!nome || !moeda_id || !tipo || !data_operacao || !simbolo || quantidade === undefined || preco_unitario === undefined || valor_total === undefined || !grupo_id) {
      return NextResponse.json({ error: "Campos obrigatórios faltando (nome, moeda_id, tipo, data_operacao, simbolo, quantidade, preco_unitario, valor_total, grupo_id)" }, { status: 400 });
    }

    // Converter data yyyy-MM-dd para ISO String UTC (yyyy-MM-ddT00:00:00Z)
    // Isso garante que o Supabase/Postgres interprete como meia-noite UTC
    const data_operacao_iso = `${data_operacao}T00:00:00Z`;

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
    } else {
         console.log(`[API:operacoes:POST] Usuário é master, permissão de grupo concedida.`);
    }

    // 4. Inserir a operação usando o ID interno do usuário
    const insertPayload: Record<string, any> = {
      nome,
      moeda_id,
      simbolo,
      tipo,
      data_operacao: data_operacao_iso,
      quantidade,
      preco_unitario,
      valor_total,
      exchange: exchange || null,
      notas: notas || null,
      usuario_id: userProfile.id,
      grupo_id: grupo_id,
    };

    if (carteira_id) {
      insertPayload.carteira_id = carteira_id;
    }

    const supabaseAny: any = supabase;

    let { data, error } = await supabaseAny
      .from("crypto_operacoes")
      .insert(insertPayload)
      .select()
      .single();

    // Compatibilidade: caso a coluna carteira_id ainda não exista no banco.
    if (error && carteira_id && (error.code === "42703" || error.message?.includes("carteira_id"))) {
      delete insertPayload.carteira_id;
      const retry = await supabaseAny
        .from("crypto_operacoes")
        .insert(insertPayload)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error("[API:operacoes:POST] Erro ao inserir:", error);
      if (error.code === '23503') { 
          return NextResponse.json({ error: `Erro de referência: ${error.message}` }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });

  } catch (error: any) {
    console.error("[API:operacoes:POST] Erro inesperado:", error);
    return NextResponse.json({ error: `Erro interno: ${error.message}` }, { status: 500 });
  }
}

// PATCH: Atualizar operação existente
export async function PATCH(request: NextRequest) {
    const supabase = createSupabaseClient();
    try {
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

        if (authError || !authUser) {
            console.error("[API:operacoes:PATCH] Erro ao obter usuário autenticado:", authError?.message);
            return NextResponse.json({ error: "Não autorizado" }, { status: 401 }); 
        }

        const { data: userProfile, error: profileError } = await supabase
            .from('usuarios')
            .select('id, is_master, empresa_id')
            .eq('auth_id', authUser.id)
            .single();

        if (profileError || !userProfile) {
            console.error(`[API:operacoes:PATCH] Erro ao buscar perfil para auth_id ${authUser.id} ou perfil não encontrado:`, profileError?.message);
            return NextResponse.json({ error: "Perfil do usuário não encontrado para verificação de permissão" }, { status: 404 });
        }
        
        const body = await request.json();
        const id = body.id;

        if (!id) {
            console.error("[API:operacoes:PATCH] ID da operação não encontrado no body da requisição.");
            return NextResponse.json({ error: "ID da operação é obrigatório no corpo da requisição" }, { status: 400 });
        }

        if (!userProfile.is_master) {
            const { data: operacao, error: fetchError } = await supabase
                .from('crypto_operacoes')
                .select('grupo_id, grupos!inner(empresa_id)')
                .eq('id', id)
                .single();

            if (fetchError) {
                console.error(`[API:operacoes:PATCH] Erro ao buscar operação ${id} para verificar permissão:`, fetchError.message);
                return NextResponse.json({ error: "Operação não encontrada ou erro ao buscar" }, { status: fetchError.code === 'PGRST116' ? 404 : 500 });
            }
            if (!operacao) {
                 return NextResponse.json({ error: "Operação não encontrada" }, { status: 404 });
            }

            const operacaoEmpresaId = operacao.grupos?.empresa_id;
            if (operacaoEmpresaId !== userProfile.empresa_id) {
                return NextResponse.json({ error: "Permissão negada para editar esta operação" }, { status: 403 });
            }
        }
        
        const { id: bodyId, criado_em, atualizado_em, grupos, usuario_id, grupo_id, ...updateData } = body;
        if (body.grupo_id) {
          updateData.grupo_id = body.grupo_id;
        }

        const { data, error } = await supabase
            .from("crypto_operacoes")
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error("[API:operacoes:PATCH] Erro ao atualizar no Supabase:", error);
            return NextResponse.json({ error: `Erro ao atualizar operação: ${error.message}` }, { status: 500 });
        }

        return NextResponse.json(data);

    } catch (error: any) {
        console.error("[API:operacoes:PATCH] Erro inesperado (catch geral):", error);
        return NextResponse.json({ error: `Erro interno do servidor: ${error.message}` }, { status: 500 });
    }
}

// DELETE: Remover operação existente
export async function DELETE(request: NextRequest) {
    const supabase = createSupabaseClient();
    try {
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

        if (authError || !authUser) {
            console.error("[API:operacoes:DELETE] Erro ao obter usuário autenticado via auth.getUser():", authError?.message);
            return NextResponse.json({ error: "Não autorizado (auth)" }, { status: 401 }); 
        }

        const { data: userProfile, error: profileError } = await supabase
            .from('usuarios')
            .select('id, is_master')
            .eq('auth_id', authUser.id)
            .single();

        if (profileError || !userProfile) {
            console.error(`[API:operacoes:DELETE] Erro ao buscar perfil para auth_id ${authUser.id} ou perfil não encontrado:`, profileError?.message);
            return NextResponse.json({ error: "Perfil do usuário não encontrado" }, { status: 404 });
        }
        
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            console.error("[API:operacoes:DELETE] ID da operação não fornecido na URL.");
            return NextResponse.json({ error: "ID da operação é obrigatório" }, { status: 400 });
        }

        if (!userProfile.is_master) {
            const { data: operacao, error: fetchError } = await supabase
                .from('crypto_operacoes')
                .select('grupo_id')
                .eq('id', id)
                .single();

            if (fetchError || !operacao) {
                 console.error(`[API:operacoes:DELETE] Erro ao buscar operação ${id} ou não encontrada:`, fetchError?.message);
                return NextResponse.json({ error: "Operação não encontrada ou erro ao buscar" }, { status: fetchError && fetchError.code !== 'PGRST116' ? 500 : 404 });
            }
            
            const operacaoGrupoId = operacao.grupo_id;

            if (operacaoGrupoId) {
                // @ts-ignore
                const { data: userGroupLinks, error: groupsError } = await supabase
                    .from('usuarios_grupos')
                    .select('grupo_id')
                    .eq('usuario_id', userProfile.id); 

                if (groupsError) {
                     console.error("[API:operacoes:DELETE] Erro ao buscar grupos do usuário:", groupsError.message);
                     return NextResponse.json({ error: "Erro ao verificar permissão de grupo" }, { status: 500 });
                }
                // @ts-ignore
                const userGroupIds = userGroupLinks?.map((link: { grupo_id: string }) => link.grupo_id) ?? [];
                
                if (!userGroupIds.includes(operacaoGrupoId)) {
                    console.warn(`[API:operacoes:DELETE] Permissão negada: Usuário ${userProfile.id} não pertence ao grupo ${operacaoGrupoId}`);
                    return NextResponse.json({ error: "Permissão negada para deletar esta operação" }, { status: 403 });
                }
            } else {
                 console.warn(`[API:operacoes:DELETE] Permissão negada: Usuário não-master tentando deletar operação sem grupo (ID: ${id})`);
                 return NextResponse.json({ error: "Permissão negada (operação sem grupo)" }, { status: 403 });
            }
        }
        
        const { error: deleteError } = await supabase
            .from("crypto_operacoes")
            .delete()
            .eq('id', id);

        if (deleteError) {
            console.error("[API:operacoes:DELETE] Erro ao deletar no Supabase:", deleteError);
            return NextResponse.json({ error: deleteError.message }, { status: 500 });
        }

        return NextResponse.json({ message: "Operação deletada com sucesso" });

    } catch (error: any) {
        console.error("[API:operacoes:DELETE] Erro inesperado (catch geral):", error);
        return NextResponse.json({ error: `Erro interno: ${error.message}` }, { status: 500 });
    }
}
