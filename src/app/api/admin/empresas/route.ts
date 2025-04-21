import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase';
import { supabaseConfig } from '@/lib/config';
import { z } from 'zod';
import type { CookieOptions } from '@supabase/ssr';

// --- Schemas Zod para Empresa ---

const empresaBaseSchema = z.object({
  nome: z.string().min(1, "Nome da empresa é obrigatório"),
  cnpj: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  email_contato: z.string().email("Email de contato inválido").optional().nullable(),
  endereco_rua: z.string().optional().nullable(),
  endereco_numero: z.string().optional().nullable(),
  endereco_complemento: z.string().optional().nullable(),
  endereco_bairro: z.string().optional().nullable(),
  endereco_cidade: z.string().optional().nullable(),
  endereco_estado: z.string().length(2, "Estado deve ter 2 caracteres (UF)").optional().nullable(),
  endereco_cep: z.string().optional().nullable(),
  ativo: z.boolean().default(true),
});

const createEmpresaSchema = empresaBaseSchema; // Para POST, todos os campos base são válidos

const updateEmpresaSchema = empresaBaseSchema.partial().extend({ // Para PATCH, todos opcionais
  id: z.string().uuid("ID inválido"), // ID é obrigatório no corpo para PATCH
});

// Helper para criar cliente Supabase nesta rota
const createClient = (cookieStore: ReturnType<typeof cookies>) => {
  return createServerClient<Database>(
    supabaseConfig.url!,
    supabaseConfig.serviceRoleKey!, // Usar service role para operações admin
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // set/remove podem ser necessários se houver operações de auth aqui
        set(name: string, value: string, options: CookieOptions) {
          // Idealmente, não faríamos set/remove no backend com service_role
          // Mas para getSession funcionar corretamente, precisamos defini-los.
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // Ignorar erros se o cookie não puder ser setado (ex: em Route Handlers)
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
             cookieStore.set({ name, value: '', ...options });
          } catch (error) {
             // Ignorar erros
          }
        },
      },
    }
  );
};

// --- Funções Auxiliares de Autenticação e Autorização ---

async function getUserSessionAndMasterStatus(supabase: ReturnType<typeof createClient>) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    console.error("[API:AdminEmpresas] Erro ao obter sessão:", sessionError);
    return { session: null, isMaster: false, error: "Erro ao verificar autenticação.", status: 500 };
  }
  if (!session?.user) {
    return { session: null, isMaster: false, error: "Usuário não autenticado.", status: 401 };
  }
  const isMaster = session.user.user_metadata?.is_master === true;
  return { session, isMaster, error: null, status: 200 };
}

// --- Handlers da API ---

// GET: Listar todas as empresas (Aberto para usuários logados, mas poderia restringir mais)
export async function GET(request: NextRequest) {
  console.log("[API:AdminEmpresas:GET] Listando empresas");
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  const { session, error: authError, status } = await getUserSessionAndMasterStatus(supabase);
  if (!session) {
    return NextResponse.json({ error: authError }, { status });
  }
  // Poderíamos adicionar lógica para retornar apenas a empresa do usuário se não for master,
  // mas por enquanto listamos todas para usuários logados.

  try {
    const { data: empresas, error } = await supabase
      .from('empresas')
      .select('*') // Seleciona todas as colunas
      .order('nome', { ascending: true }); // Ordena por nome

    if (error) {
      console.error("[API:AdminEmpresas:GET] Erro ao listar empresas:", error);
      return NextResponse.json({ error: `Erro do Supabase: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ empresas: empresas || [] });
  } catch (error: any) {
    console.error("[API:AdminEmpresas:GET] Erro inesperado:", error);
    return NextResponse.json({ error: `Erro interno do servidor: ${error.message}` }, { status: 500 });
  }
}

// POST: Criar nova empresa (Somente Master)
export async function POST(request: NextRequest) {
  console.log("[API:AdminEmpresas:POST] Recebida requisição para criar empresa");
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  // 1. Verificar Autenticação e se é Master
  const { session, isMaster, error: authError, status } = await getUserSessionAndMasterStatus(supabase);
  if (!session) {
    return NextResponse.json({ error: authError }, { status });
  }
  if (!isMaster) {
    console.warn(`[API:AdminEmpresas:POST] Usuário ${session.user.email} (não master) tentou criar empresa.`);
    return NextResponse.json({ error: "Apenas usuários master podem criar empresas." }, { status: 403 }); // Forbidden
  }

  console.log(`[API:AdminEmpresas:POST] Usuário Master ${session.user.email} autorizado.`);

  // 2. Validar Corpo da Requisição
  try {
    const body = await request.json();
    const validation = createEmpresaSchema.safeParse(body);

    if (!validation.success) {
      console.error("[API:AdminEmpresas:POST] Falha na validação:", validation.error.errors);
      return NextResponse.json({ error: "Dados inválidos", details: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    const empresaData = validation.data;
    console.log("[API:AdminEmpresas:POST] Dados validados para inserção:", empresaData);

    // 3. Inserir no Banco de Dados
    const { data: newEmpresa, error: insertError } = await supabase
      .from('empresas')
      .insert(empresaData)
      .select()
      .single();

    if (insertError) {
      console.error("[API:AdminEmpresas:POST] Erro ao inserir empresa:", insertError);
      if (insertError.code === '23505') { // Unique constraint (provavelmente CNPJ)
        return NextResponse.json({ error: "Já existe uma empresa com este CNPJ." }, { status: 409 });
      }
      return NextResponse.json({ error: `Erro do Supabase: ${insertError.message}` }, { status: 500 });
    }

    console.log("[API:AdminEmpresas:POST] Empresa criada com sucesso:", newEmpresa);
    return NextResponse.json({ empresa: newEmpresa }, { status: 201 });

  } catch (error: any) {
    console.error("[API:AdminEmpresas:POST] Erro inesperado:", error);
    if (error instanceof SyntaxError) {
       return NextResponse.json({ error: "Corpo da requisição inválido (JSON malformado)." }, { status: 400 });
   }
    return NextResponse.json({ error: `Erro interno do servidor: ${error.message}` }, { status: 500 });
  }
}

// PATCH: Atualizar empresa existente (Somente Master)
export async function PATCH(request: NextRequest) {
  console.log("[API:AdminEmpresas:PATCH] Recebida requisição para atualizar empresa");
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  // 1. Verificar Autenticação e se é Master
  const { session, isMaster, error: authError, status } = await getUserSessionAndMasterStatus(supabase);
  if (!session) {
    return NextResponse.json({ error: authError }, { status });
  }
  if (!isMaster) {
     console.warn(`[API:AdminEmpresas:PATCH] Usuário ${session.user.email} (não master) tentou atualizar empresa.`);
    return NextResponse.json({ error: "Apenas usuários master podem atualizar empresas." }, { status: 403 });
  }
   console.log(`[API:AdminEmpresas:PATCH] Usuário Master ${session.user.email} autorizado.`);

  // 2. Validar Corpo da Requisição
  try {
    const body = await request.json();
    const validation = updateEmpresaSchema.safeParse(body);

    if (!validation.success) {
      console.error("[API:AdminEmpresas:PATCH] Falha na validação:", validation.error.errors);
      return NextResponse.json({ error: "Dados inválidos", details: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    const { id: empresaId, ...updateData } = validation.data;
    console.log(`[API:AdminEmpresas:PATCH] Dados validados para atualização (ID: ${empresaId}):`, updateData);

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Nenhum dado fornecido para atualização." }, { status: 400 });
    }

    // 3. Atualizar no Banco de Dados
    const { data: updatedEmpresa, error: updateError } = await supabase
      .from('empresas')
      .update(updateData)
      .eq('id', empresaId)
      .select()
      .single();

    if (updateError) {
      console.error(`[API:AdminEmpresas:PATCH] Erro ao atualizar empresa (ID: ${empresaId}):`, updateError);
      if (updateError.code === '23505') { // Unique constraint (CNPJ)
        return NextResponse.json({ error: "Já existe outra empresa com este CNPJ." }, { status: 409 });
      }
       if (updateError.code === 'PGRST116') { // ID não encontrado
          return NextResponse.json({ error: `Empresa com ID ${empresaId} não encontrada.` }, { status: 404 });
      }
      return NextResponse.json({ error: `Erro do Supabase: ${updateError.message}` }, { status: 500 });
    }

     if (!updatedEmpresa) { // Segurança extra caso PGRST116 não seja pego
        return NextResponse.json({ error: `Empresa com ID ${empresaId} não encontrada.` }, { status: 404 });
    }

    console.log(`[API:AdminEmpresas:PATCH] Empresa (ID: ${empresaId}) atualizada com sucesso:`, updatedEmpresa);
    return NextResponse.json({ empresa: updatedEmpresa }, { status: 200 });

  } catch (error: any) {
    console.error("[API:AdminEmpresas:PATCH] Erro inesperado:", error);
    if (error instanceof SyntaxError) {
       return NextResponse.json({ error: "Corpo da requisição inválido (JSON malformado)." }, { status: 400 });
    }
    return NextResponse.json({ error: `Erro interno do servidor: ${error.message}` }, { status: 500 });
  }
}

// DELETE: Remover empresa existente (Somente Master)
export async function DELETE(request: NextRequest) {
  console.log("[API:AdminEmpresas:DELETE] Recebida requisição para remover empresa");
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  // 1. Verificar Autenticação e se é Master
  const { session, isMaster, error: authError, status } = await getUserSessionAndMasterStatus(supabase);
  if (!session) {
    return NextResponse.json({ error: authError }, { status });
  }
  if (!isMaster) {
     console.warn(`[API:AdminEmpresas:DELETE] Usuário ${session.user.email} (não master) tentou remover empresa.`);
    return NextResponse.json({ error: "Apenas usuários master podem remover empresas." }, { status: 403 });
  }
   console.log(`[API:AdminEmpresas:DELETE] Usuário Master ${session.user.email} autorizado.`);

  // 2. Obter e Validar ID da URL
  const empresaId = request.nextUrl.searchParams.get('id');
  if (!empresaId) {
    return NextResponse.json({ error: "ID da empresa é obrigatório para remoção." }, { status: 400 });
  }
  const uuidSchema = z.string().uuid("ID inválido");
  if (!uuidSchema.safeParse(empresaId).success) {
    return NextResponse.json({ error: "ID da empresa inválido." }, { status: 400 });
  }

  console.log(`[API:AdminEmpresas:DELETE] Tentando remover empresa ID: ${empresaId}`);

  // 3. Remover do Banco de Dados
  try {
    const { error: deleteError, count } = await supabase
      .from('empresas')
      .delete({ count: 'exact' })
      .eq('id', empresaId);

    if (deleteError) {
      console.error(`[API:AdminEmpresas:DELETE] Erro ao remover empresa (ID: ${empresaId}):`, deleteError);
      // Verificar erro de chave estrangeira (se grupos/usuários dependem da empresa)
      if (deleteError.code === '23503') { // Foreign key violation
          return NextResponse.json({ error: "Não é possível remover a empresa pois existem grupos ou usuários associados a ela." }, { status: 409 }); // Conflict
      }
      return NextResponse.json({ error: `Erro do Supabase: ${deleteError.message}` }, { status: 500 });
    }

    if (count === 0) {
      return NextResponse.json({ error: `Empresa com ID ${empresaId} não encontrada.` }, { status: 404 });
    }

    console.log(`[API:AdminEmpresas:DELETE] Empresa (ID: ${empresaId}) removida com sucesso.`);
    return NextResponse.json({ message: `Empresa ${empresaId} removida com sucesso.` }, { status: 200 });

  } catch (error: any) {
    console.error("[API:AdminEmpresas:DELETE] Erro inesperado:", error);
    return NextResponse.json({ error: `Erro interno do servidor: ${error.message}` }, { status: 500 });
  }
} 