import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { supabaseConfig } from '@/lib/config';
import { z } from 'zod';
// Helper para criar cliente Supabase na rota
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers'; // Importar cookies

// --- Schemas de Validação Zod (AJUSTADOS) ---

// Schema base - NÃO inclui empresa_id pois virá da sessão
const groupBaseSchema = z.object({
  nome: z.string().min(1, "Nome do grupo é obrigatório"),
  descricao: z.string().optional().nullable(),
  is_master: z.boolean().default(false),
  telas_permitidas: z.array(z.string().min(1)).optional().default([]),
});

// Schema para criação (POST) - Adiciona empresa_id opcional para master
const createGroupSchema = groupBaseSchema.extend({
  empresa_id: z.string().uuid("ID da empresa inválido").optional(), // Opcional no schema base
}).superRefine((data, ctx) => {
  if (data.is_master) {
    data.telas_permitidas = [];
  }
  // Validação adicional será feita no handler dependendo se é master ou não
});

// Schema para atualização (PATCH) - requer ID, não espera empresa_id no corpo
const updateGroupSchema = groupBaseSchema.partial().extend({
  id: z.string().uuid("ID inválido"),
}).superRefine((data, ctx) => {
  if (data.is_master === true) {
    // Nada a fazer aqui explicitamente para telas_permitidas, será tratado na lógica do PATCH
  }
  // Outras validações se necessário
});

// Helper para criar cliente Supabase nesta rota (RESTAURADO PARA COMPLETUDE)
const createSupabaseClient = (cookieStore: ReturnType<typeof cookies>) => {
  return createServerClient<Database>(
    supabaseConfig.url!,
    supabaseConfig.serviceRoleKey!, // Usar service role para operações admin
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
             // Ignorar erros se o cookie não puder ser setado (ex: em Route Handlers)
          }
        },
        remove(name: string, options: any) {
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

// GET: Listar grupos DA EMPRESA DO USUÁRIO ou buscar detalhes de UM grupo
export async function GET(request: NextRequest) {
  console.log("[API:AdminGroups:GET] Listando grupos");
  const cookieStore = cookies();
  // Usar cliente SSR para obter sessão
  const supabase = createServerClient<Database>(
    supabaseConfig.url!,
    supabaseConfig.serviceRoleKey!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // set e remove não são estritamente necessários aqui para getSession,
        // mas incluí-los é uma boa prática se for fazer auth
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.delete({ name, ...options });
        },
      },
    }
  );

  try {
    // --- Usando o novo cliente supabase --- 
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error("[API:AdminGroups:GET] Erro ao obter sessão:", sessionError);
      return NextResponse.json({ error: "Erro ao verificar autenticação." }, { status: 500 });
    }

    if (!session?.user) {
      return NextResponse.json({ error: "Usuário não autenticado." }, { status: 401 });
    }

    // <<< INÍCIO: Buscar Perfil do Requisitante >>>
    const { data: requesterProfile, error: profileError } = await supabase
      .from('usuarios')
      .select('id, is_master, empresa_id')
      .eq('auth_id', session.user.id)
      .single();

    if (profileError || !requesterProfile) {
      console.error(`[API:AdminGroups:GET] Erro ao buscar perfil do requisitante ${session.user.id}:`, profileError?.message);
      return NextResponse.json({ error: "Perfil do requisitante não encontrado." }, { status: 403 });
    }
    const isRequesterMaster = requesterProfile.is_master;
    const requesterEmpresaId = requesterProfile.empresa_id;
    console.log(`[API:AdminGroups:GET] Requisitante é Master: ${isRequesterMaster}, Empresa: ${requesterEmpresaId}`);
    // <<< FIM: Buscar Perfil do Requisitante >>>

    // Usar cliente com service_role para buscar dados
    const supabaseAdmin = createClient<Database>(supabaseConfig.url!, supabaseConfig.serviceRoleKey!, { auth: { persistSession: false } });

    // Verificar se um ID específico foi solicitado
    const groupId = request.nextUrl.searchParams.get('id');

    if (groupId) {
      // --- Buscar detalhes de UM grupo específico ---
      console.log(`[API:AdminGroups:GET] Buscando detalhes do grupo ID: ${groupId}`);
      const { data: groupDetails, error: detailsError } = await supabaseAdmin
        .from('grupos')
        .select('id, nome, descricao, is_master, telas_permitidas, empresa_id') 
        .eq('id', groupId)
        .maybeSingle(); // Usar maybeSingle pois o ID deve ser único

      if (detailsError) {
        console.error(`[API:AdminGroups:GET] Erro ao buscar detalhes do grupo ${groupId}:`, detailsError);
        return NextResponse.json({ error: `Erro do Supabase ao buscar detalhes: ${detailsError.message}` }, { status: 500 });
      }

      if (!groupDetails) {
        return NextResponse.json({ error: `Grupo com ID ${groupId} não encontrado.` }, { status: 404 });
      }

      // Retornar o objeto do grupo dentro de uma chave 'group'
      return NextResponse.json({ group: groupDetails }); 

    } else {
      // --- Listar grupos com filtro condicional ---
      console.log(`[API:AdminGroups:GET] Listando grupos.`);
      let groupsQuery = supabaseAdmin
        .from('grupos')
        .select('id, nome, descricao, empresa:empresas(id, nome)') 
        .order('nome', { ascending: true });

      // Aplicar filtro de empresa se o requisitante NÃO for master
      if (!isRequesterMaster) {
          if (!requesterEmpresaId) {
              console.warn(`[API:AdminGroups:GET] Requisitante não-master ${session.user.id} não tem empresa_id. Retornando vazio.`);
              return NextResponse.json({ groups: [] }); // Retorna lista vazia
          }
          console.log(`[API:AdminGroups:GET] Aplicando filtro para empresa_id: ${requesterEmpresaId}`);
          groupsQuery = groupsQuery.eq('empresa_id', requesterEmpresaId);
      } else {
          console.log(`[API:AdminGroups:GET] Requisitante é master, buscando todos os grupos.`);
      }

      const { data: groups, error: listError } = await groupsQuery;

      if (listError) {
        console.error("[API:AdminGroups:GET] Erro ao listar grupos:", listError);
        return NextResponse.json({ error: `Erro do Supabase ao listar grupos: ${listError.message}` }, { status: 500 });
      }

      console.log(`[API:AdminGroups:GET] Retornando ${groups?.length ?? 0} grupos.`);
      return NextResponse.json({ groups: groups || [] });
    }

  } catch (error: any) {
    console.error("[API:AdminGroups:GET] Erro inesperado:", error);
    return NextResponse.json({ error: `Erro interno do servidor: ${error.message}` }, { status: 500 });
  }
}

// POST: Criar novo grupo
export async function POST(request: NextRequest) {
  console.log("[API:AdminGroups:POST] Recebida requisição para criar grupo");
   const cookieStore = cookies();
   const supabase = createSupabaseClient(cookieStore); // Usar helper

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
     if (sessionError || !session?.user) {
       return NextResponse.json({ error: "Usuário não autenticado ou erro na sessão." }, { status: 401 });
     }
     
     const isMaster = session.user.user_metadata?.is_master === true;
     let targetEmpresaId: string | null = null; // Inicializar como null

    const body = await request.json();
    const validation = createGroupSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Dados inválidos", details: validation.error.flatten().fieldErrors }, { status: 400 });
    }
    let groupData = validation.data;

    // Determinar o empresa_id alvo
    if (isMaster) {
        targetEmpresaId = groupData.empresa_id ?? null;
        if (!targetEmpresaId) {
             console.warn(`[API:AdminGroups:POST] Master ${session.user.id} tentou criar grupo sem especificar empresa_id.`);
             return NextResponse.json({ error: "Usuário master deve especificar a empresa para o grupo." , details: { empresa_id: ["Empresa é obrigatória para usuário master."] } }, { status: 400 });
        }
        console.log(`[API:AdminGroups:POST] Master ${session.user.id} criando grupo para empresa ${targetEmpresaId}`);
    } else {
        targetEmpresaId = session.user.user_metadata?.empresa_id ?? null;
        if (!targetEmpresaId) {
            console.error(`[API:AdminGroups:POST] Usuário não-master ${session.user.id} não possui empresa_id nos metadados.`);
            return NextResponse.json({ error: "Usuário não associado a uma empresa." }, { status: 403 }); // Causa raiz original
        }
        delete groupData.empresa_id; // Remover do payload se não for master
         console.log(`[API:AdminGroups:POST] Usuário ${session.user.id}, criando grupo para sua empresa ${targetEmpresaId}`);
    }

    // Ajuste para telas_permitidas se for master (grupo, não usuário)
    if (groupData.is_master) {
        groupData.telas_permitidas = [];
    }

    // Adicionar o empresa_id determinado
    // Garantir que o tipo corresponde ao esperado pelo Supabase (Insert<grupos>)
    const dataToInsert: Database['public']['Tables']['grupos']['Insert'] = {
        nome: groupData.nome,
        descricao: groupData.descricao,
        is_master: groupData.is_master,
        telas_permitidas: groupData.telas_permitidas,
        empresa_id: targetEmpresaId // Usar o ID determinado (agora null ou string)
    };

    console.log("[API:AdminGroups:POST] Dados validados para inserção:", dataToInsert);

    // Usar cliente admin para a operação de insert
    const supabaseAdmin = createClient<Database>(supabaseConfig.url!, supabaseConfig.serviceRoleKey!, { auth: { persistSession: false } });
    const { data: newGroup, error: insertError } = await supabaseAdmin
      .from('grupos')
      .insert(dataToInsert) // Passar objeto tipado
      .select()
      .single();

    if (insertError) {
      console.error("[API:AdminGroups:POST] Erro ao inserir grupo:", insertError);
      if (insertError.code === '23505') { 
        return NextResponse.json({ error: "Já existe um grupo com este nome nesta empresa." }, { status: 409 });
      }
      return NextResponse.json({ error: `Erro do Supabase: ${insertError.message}` }, { status: 500 });
    }

    console.log("[API:AdminGroups:POST] Grupo criado com sucesso:", newGroup);
    return NextResponse.json({ group: newGroup }, { status: 201 });

  } catch (error: any) {
    console.error("[API:AdminGroups:POST] Erro inesperado:", error);
     if (error instanceof SyntaxError) {
        return NextResponse.json({ error: "Corpo da requisição inválido (JSON malformado)." }, { status: 400 });
    }
    return NextResponse.json({ error: `Erro interno do servidor: ${error.message}` }, { status: 500 });
  }
}

// PATCH: Atualizar grupo existente
export async function PATCH(request: NextRequest) {
  console.log("[API:AdminGroups:PATCH] Recebida requisição para atualizar grupo");
  const cookieStore = cookies();
  const supabase = createSupabaseClient(cookieStore); // Usar helper

  try {
     const { data: { session }, error: sessionError } = await supabase.auth.getSession();
     if (sessionError || !session?.user) {
       return NextResponse.json({ error: "Usuário não autenticado ou erro na sessão." }, { status: 401 });
     }
     
     const isMaster = session.user.user_metadata?.is_master === true;
     let userEmpresaId: string | null = null; // Inicializar como null
     
     if (!isMaster) {
         userEmpresaId = session.user.user_metadata?.empresa_id ?? null;
         if (!userEmpresaId) {
             console.error(`[API:AdminGroups:PATCH] Usuário não-master ${session.user.id} não possui empresa_id nos metadados.`);
             return NextResponse.json({ error: "Usuário não associado a uma empresa para realizar esta ação." }, { status: 403 }); // Causa raiz original
         }
         console.log(`[API:AdminGroups:PATCH] Usuário não-master ${session.user.id}, Empresa ${userEmpresaId}`);
     } else {
          console.log(`[API:AdminGroups:PATCH] Usuário Master ${session.user.id} autorizado a editar qualquer grupo.`);
     }

    const body = await request.json();
    const validation = updateGroupSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Dados inválidos", details: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    const { id: groupId, ...updateDataValidated } = validation.data;

    // Log do corpo recebido e dados validados
    console.log(`[API:AdminGroups:PATCH] Corpo recebido (bruto):`, body); 
    console.log(`[API:AdminGroups:PATCH] Dados validados (sem ID):`, updateDataValidated);

    // Preparar dados para update, garantindo tipo correto
    const updateDataForSupabase: Database['public']['Tables']['grupos']['Update'] = {};
    if (updateDataValidated.nome !== undefined) updateDataForSupabase.nome = updateDataValidated.nome;
    if (updateDataValidated.descricao !== undefined) updateDataForSupabase.descricao = updateDataValidated.descricao;
    if (updateDataValidated.is_master !== undefined) {
        updateDataForSupabase.is_master = updateDataValidated.is_master;
        if (updateDataValidated.is_master === true) {
             // Garantir que telas_permitidas seja array vazio se is_master for true
             updateDataForSupabase.telas_permitidas = []; 
        } else if (updateDataValidated.telas_permitidas !== undefined) {
            // Se is_master for false e telas_permitidas foi enviado, usá-lo
            updateDataForSupabase.telas_permitidas = updateDataValidated.telas_permitidas;
        }
    } else if (updateDataValidated.telas_permitidas !== undefined) {
        // Se is_master não foi enviado, mas telas_permitidas sim
         updateDataForSupabase.telas_permitidas = updateDataValidated.telas_permitidas;
    }

    // LOG FINAL ANTES DO UPDATE
    console.log(`[API:AdminGroups:PATCH] Objeto FINAL sendo enviado para supabase.update() (ID: ${groupId}):`, updateDataForSupabase);

    if (Object.keys(updateDataForSupabase).length === 0) {
         console.warn("[API:AdminGroups:PATCH] Nenhum dado válido para atualização foi detectado."); // Log adicionado
         return NextResponse.json({ error: "Nenhum dado fornecido para atualização." }, { status: 400 });
    }

    // Usar cliente admin para as operações
    const supabaseAdmin = createClient<Database>(supabaseConfig.url!, supabaseConfig.serviceRoleKey!, { auth: { persistSession: false } });

    // *** Verificação de Segurança ***
    if (!isMaster) {
        const { data: existingGroup, error: checkError } = await supabaseAdmin
           .from('grupos')
           .select('id')
           .eq('id', groupId)
           .eq('empresa_id', userEmpresaId as string) // Tipagem explícita aqui pode ajudar
           .maybeSingle(); 
        if (checkError || !existingGroup) {
             return NextResponse.json({ error: `Grupo com ID ${groupId} não encontrado ou não pertence à sua empresa.` }, { status: 404 });
        }
    }
    // ************************************************************************************

    const { data: updatedGroup, error: updateError } = await supabaseAdmin
      .from('grupos')
      .update(updateDataForSupabase) // Usar objeto tipado
      .eq('id', groupId) 
      .select()
      .single();

    if (updateError) {
      console.error(`[API:AdminGroups:PATCH] Erro ao atualizar grupo (ID: ${groupId}):`, updateError);
       if (updateError.code === '23505') {
        return NextResponse.json({ error: "Já existe um grupo com este nome nesta empresa." }, { status: 409 });
      }
      return NextResponse.json({ error: `Erro do Supabase: ${updateError.message}` }, { status: 500 });
    }

    console.log(`[API:AdminGroups:PATCH] Grupo (ID: ${groupId}) atualizado com sucesso:`, updatedGroup);
    return NextResponse.json({ group: updatedGroup }, { status: 200 });

  } catch (error: any) {
    console.error("[API:AdminGroups:PATCH] Erro inesperado:", error);
     if (error instanceof SyntaxError) {
        return NextResponse.json({ error: "Corpo da requisição inválido (JSON malformado)." }, { status: 400 });
    }
    return NextResponse.json({ error: `Erro interno do servidor: ${error.message}` }, { status: 500 });
  }
}

// DELETE: Remover grupo existente DA EMPRESA DO USUÁRIO (ou por master)
export async function DELETE(request: NextRequest) {
  console.log("[API:AdminGroups:DELETE] Recebida requisição para remover grupo");
   const cookieStore = cookies();
   const supabase = createSupabaseClient(cookieStore); // Usar helper

  try {
    // Lógica de autenticação e verificação isMaster/empresa_id similar ao PATCH
     const { data: { session }, error: sessionError } = await supabase.auth.getSession();
     if (sessionError || !session?.user) {
       return NextResponse.json({ error: "Usuário não autenticado ou erro na sessão." }, { status: 401 });
     }
     
     const isMaster = session.user.user_metadata?.is_master === true;
     let userEmpresaId: string | null = null;

     if (!isMaster) {
         userEmpresaId = session.user.user_metadata?.empresa_id ?? null;
         if (!userEmpresaId) {
            console.error(`[API:AdminGroups:DELETE] Usuário não-master ${session.user.id} não possui empresa_id nos metadados.`);
            return NextResponse.json({ error: "Usuário não associado a uma empresa para realizar esta ação." }, { status: 403 });
         }
          console.log(`[API:AdminGroups:DELETE] Usuário não-master ${session.user.id}, Empresa ${userEmpresaId}`);
     } else {
         console.log(`[API:AdminGroups:DELETE] Usuário Master ${session.user.id} autorizado a remover qualquer grupo.`);
     }

    const groupId = request.nextUrl.searchParams.get('id');
    if (!groupId) {
      return NextResponse.json({ error: "ID do grupo é obrigatório." }, { status: 400 });
    }
    const uuidSchema = z.string().uuid("ID inválido");
    if (!uuidSchema.safeParse(groupId).success) {
         return NextResponse.json({ error: "ID do grupo inválido." }, { status: 400 });
    }

    const supabaseAdmin = createClient<Database>(supabaseConfig.url!, supabaseConfig.serviceRoleKey!, { auth: { persistSession: false } });

    // *** Verificação de Segurança ***
    if (!isMaster) {
        // Não-Master: Garantir que o grupo pertence à empresa do usuário
         const { data: existingGroup, error: checkError } = await supabaseAdmin
           .from('grupos')
           .select('id')
           .eq('id', groupId)
           .eq('empresa_id', userEmpresaId as string)
           .maybeSingle();

         if (checkError || !existingGroup) {
             console.warn(`[API:AdminGroups:DELETE] Tentativa de não-master remover grupo não encontrado ou não pertencente à empresa (ID: ${groupId}, Empresa: ${userEmpresaId})`);
             return NextResponse.json({ error: `Grupo com ID ${groupId} não encontrado ou não pertence à sua empresa.` }, { status: 404 });
        }
    } // Fim da verificação para não-master
     // Master: Pula a verificação de pertencimento à empresa
     // ************************************************************************************


    const { error: deleteError, count } = await supabaseAdmin
      .from('grupos')
      .delete({ count: 'exact' })
      .eq('id', groupId)
      // Não precisa mais filtrar por empresa aqui para master,
      // e para não-master a verificação acima já garantiu
      ;

    if (deleteError) {
      console.error(`[API:AdminGroups:DELETE] Erro ao remover grupo (ID: ${groupId}):`, deleteError);
      return NextResponse.json({ error: `Erro do Supabase: ${deleteError.message}` }, { status: 500 });
    }

    if (count === 0) {
       // Isso não deveria acontecer se a verificação de segurança foi feita,
       // mas é uma checagem extra caso algo falhe (ou se for master e o ID não existir)
        console.warn(`[API:AdminGroups:DELETE] Grupo com ID ${groupId} não encontrado para remoção (count=0).`);
       return NextResponse.json({ error: `Grupo com ID ${groupId} não encontrado.` }, { status: 404 });
    }

    console.log(`[API:AdminGroups:DELETE] Grupo (ID: ${groupId}) removido com sucesso.`);
    return NextResponse.json({ message: `Grupo ${groupId} removido com sucesso.` }, { status: 200 });

  } catch (error: any) {
    console.error("[API:AdminGroups:DELETE] Erro inesperado:", error);
    return NextResponse.json({ error: `Erro interno do servidor: ${error.message}` }, { status: 500 });
  }
} 