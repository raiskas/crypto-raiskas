import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
// @ts-ignore - Ignorar erro de tipo devido à falha na geração de tipos
import { Database } from '@/types/supabase';
import { supabaseConfig } from '@/lib/config';
import { z } from "zod";
import { createServerSupabaseClient as createServiceRoleClient } from "@/lib/supabase/server";
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SupabaseClient } from "@supabase/supabase-js";
// import { hasPermission } from "@/lib/utils/permissions"; // Assumindo que a função existe

// Cliente Supabase com chave administrativa
const supabase = createClient<Database>(
  supabaseConfig.url,
  supabaseConfig.serviceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

// Schema de validação para criação de usuário
const createUserSchema = z.object({
  nome: z.string().min(3, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  empresa_id: z.string().uuid("Empresa inválida"),
  grupo_id: z.string().uuid("Grupo inválido"), // ADICIONADO grupo_id como obrigatório
});

// Endpoint para listar todos os usuários
export async function GET(request: NextRequest) {
  try {
    console.log("[API:AdminUsers:GET] Iniciando listagem de usuários");

    // 1. Obter usuário que está fazendo a requisição
    const cookieStore = cookies();
    const supabaseClient = createServerClient<Database>(
      supabaseConfig.url!,
      supabaseConfig.anonKey!, // Usar chave anon para ler cookies
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError || !session) {
      console.warn("[API:AdminUsers:GET] Sessão não encontrada ou erro:", sessionError?.message);
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    const requesterAuthId = session.user.id;
    console.log(`[API:AdminUsers:GET] Requisição feita por: ${requesterAuthId}`);

    // 2. Buscar perfil do usuário requisitante (apenas ID interno e empresa_id agora)
    // Removido 'is_master' daqui, pois verificaremos via grupos
    const { data: requesterProfile, error: profileError } = await supabase
      .from('usuarios')
      .select('id, empresa_id') // Não busca mais is_master aqui
      .eq('auth_id', requesterAuthId)
      .single();

    if (profileError || !requesterProfile) {
      console.error(`[API:AdminUsers:GET] Erro ao buscar perfil do requisitante ${requesterAuthId}:`, profileError?.message);
      return NextResponse.json({ error: "Perfil do requisitante não encontrado" }, { status: 403 }); // Usar 403 Forbidden
    }
    const requesterUserId = requesterProfile.id; // ID interno para a próxima consulta
    const requesterEmpresaId = requesterProfile.empresa_id; // Mantém para filtro posterior
    console.log(`[API:AdminUsers:GET] ID Interno do Requisitante: ${requesterUserId}, Empresa: ${requesterEmpresaId}`);

    // ---- INÍCIO: Lógica REVISADA para verificar is_master (duas etapas) ----
    // 3a. Buscar todos os IDs de grupos aos quais o usuário pertence
    const { data: userGroupLinks, error: userGroupsError } = await supabase
      .from('usuarios_grupos')
      .select('grupo_id')
      .eq('usuario_id', requesterUserId);

    if (userGroupsError) {
       console.error(`[API:AdminUsers:GET] Erro ao buscar grupos do requisitante ${requesterUserId}: ${userGroupsError.message}`);
       return NextResponse.json({ error: "Erro ao buscar grupos do usuário" }, { status: 500 });
    }

    const userGroupIds = userGroupLinks?.map(link => link.grupo_id) || [];

    // 3b. Verificar se ALGUM desses grupos é master
    let isRequesterMaster = false;
    if (userGroupIds.length > 0) {
        const { data: masterGroupsResult, error: masterCheckError } = await supabase
          .from('grupos')
          .select('id') // Apenas para verificar existência
          .in('id', userGroupIds)
          .eq('is_master', true)
          .limit(1); // Basta encontrar um

        if (masterCheckError) {
            console.error(`[API:AdminUsers:GET] Erro ao verificar status master dos grupos [${userGroupIds.join(', ')}]: ${masterCheckError.message}`);
            return NextResponse.json({ error: "Erro ao verificar status master do grupo" }, { status: 500 });
        }

        isRequesterMaster = !!masterGroupsResult && masterGroupsResult.length > 0;
    }

    // Log final da verificação
    console.log(`[API:AdminUsers:GET] Requisitante é Master (via Grupo): ${isRequesterMaster}`);
    // ---- FIM: Lógica REVISADA para verificar is_master ----

    // 4. Buscar usuários da autenticação (mantém buscando todos, pois master precisa ver todos)
    console.log("[API:AdminUsers:GET] Buscando usuários da autenticação...");
    const { data: { users: authUsersList }, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error("[API:AdminUsers:GET] Erro ao listar usuários auth:", authError);
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }
    console.log(`[API:AdminUsers:GET] ${authUsersList.length} usuários encontrados na autenticação.`);
    
    // 4. Buscar dados da tabela 'usuarios' COM FILTRO CONDICIONAL
    console.log("[API:AdminUsers:GET] Buscando dados da tabela 'usuarios'...");
    let dbUsersQuery = supabase
      .from('usuarios')
      .select(`
        id, 
        nome, 
        email, 
        empresa_id, 
        ativo, 
        auth_id,
        is_master,
        empresa:empresas(id, nome), 
        usuarios_grupos(grupo:grupos(id, nome))
      `);

    if (isRequesterMaster) {
      console.log("[API:AdminUsers:GET] Requisitante é master, buscando todos os usuários do DB.");
    }

    // Executar a query para buscar dados do banco ANTES do merge
    const { data: dbUsersData, error: dbError } = await dbUsersQuery;

    if (dbError) {
      console.error("[API:AdminUsers:GET] Erro ao listar usuários do banco:", dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }
     console.log(`[API:AdminUsers:GET] ${dbUsersData?.length ?? 0} registros encontrados na tabela 'usuarios'.`);

    // 5. Combinar os dados
    console.log("[API:AdminUsers:GET] Combinando dados...");
    let mergedUsers = authUsersList.map(authUser => {
      // Usar dbUsersData (resultados da query) em vez de dbUsersQuery
      const dbUser = dbUsersData?.find(db => db.auth_id === authUser.id);
      const firstGroup = dbUser?.usuarios_grupos?.[0]?.grupo;
                       
      return {
        id: authUser.id, // auth_id
        email: authUser.email,
        nome: dbUser?.nome || "",
        empresa_id: dbUser?.empresa_id || null,
        ativo: dbUser?.ativo !== undefined ? dbUser.ativo : false, // Garantir um booleano
        criado_em: authUser.created_at,
        ultimo_login: authUser.last_sign_in_at,
        confirmado: !!authUser.email_confirmed_at,
        db_id: dbUser?.id || null,
        empresa: dbUser?.empresa || null, 
        grupo: firstGroup || null,
        grupo_id: firstGroup?.id || null,
        // Remover is_master daqui se não estiver mais selecionando de usuarios?
        // Decidi manter a leitura de usuarios.is_master aqui APENAS para exibição no frontend,
        // mas a LÓGICA de filtro usa o isRequesterMaster correto (baseado em grupo).
        is_master: dbUser?.is_master !== undefined ? dbUser.is_master : false,
      };
    }).filter(user => user.email); // Filtrar usuários sem email (caso ocorra)

    // 6. Filtrar resultado final se o requisitante NÃO for master (ESTE FILTRO AGORA DEVE FUNCIONAR)
    if (!isRequesterMaster) {
        console.log(`[API:AdminUsers:GET] Aplicando filtro de empresa para usuário não-master. Empresa: ${requesterEmpresaId}`); // Log informativo
        mergedUsers = mergedUsers.filter(user => {
            const userEmpresaId = user.empresa_id;
            const shouldKeep = userEmpresaId === requesterEmpresaId;
            return shouldKeep;
        });
        console.log(`[API:AdminUsers:GET] ${mergedUsers.length} usuários após filtro final de empresa.`);
    } else {
        console.log(`[API:AdminUsers:GET] Usuário é master (via grupo). Pulando filtro de empresa.`); // Log informativo
    }

    console.log(`[API:AdminUsers:GET] ${mergedUsers.length} usuários combinados para retornar.`);
    return NextResponse.json({ users: mergedUsers });
  } catch (error: any) {
    console.error("[API:AdminUsers:GET] Erro inesperado:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Endpoint para criar novo usuário
export async function POST(request: NextRequest) {
  const logPrefix = "[API /api/admin/users POST]";
  console.log(`${logPrefix} Recebida requisição para criar usuário.`);
  
  // Cliente Supabase com ROLE_SERVICE (para operações admin)
  const supabaseAdmin = await createServiceRoleClient();
  console.log(`${logPrefix} Cliente Supabase (service_role) criado.`);

  try {
    // 1. Obter sessão do administrador (USANDO CLIENTE QUE LÊ COOKIES)
    const cookieStore = cookies();
    const supabaseCookieClient = createServerClient<Database>(
      supabaseConfig.url!,
      supabaseConfig.anonKey!, // Chave ANON para ler sessão
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );
    console.log(`${logPrefix} Cliente Supabase (cookie-aware) criado para verificação de sessão.`);

    // Usar supabaseCookieClient para getSession
    const { data: { session }, error: sessionError } = await supabaseCookieClient.auth.getSession();
    if (sessionError) {
      console.error(`${logPrefix} Erro ao obter sessão:`, sessionError);
      throw new Error("Erro ao verificar sessão do administrador.");
    }
    if (!session) {
      console.warn(`${logPrefix} Tentativa de acesso não autenticada (getSession falhou).`);
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    const adminUserId = session.user.id;
    console.log(`${logPrefix} Chamada feita pelo admin com auth_id: ${adminUserId}`);

    // 2. Verificar permissão (Placeholder - CONTINUA USANDO adminUserId)
    console.warn(`${logPrefix} ATENÇÃO: Verificação de permissão ('usuario_criar') está desativada para depuração.`);

    // 3. Obter e validar corpo da requisição
    let body;
    try {
      body = await request.json();
      console.log(`${logPrefix} Corpo da requisição recebido:`, body);
    } catch (jsonError) {
      console.error(`${logPrefix} Erro ao fazer parse do JSON da requisição:`, jsonError);
      return NextResponse.json({ error: "Corpo da requisição inválido (não é JSON)" }, { status: 400 });
    }

    const validation = createUserSchema.safeParse(body);
    if (!validation.success) {
      console.warn(`${logPrefix} Falha na validação dos dados:`, validation.error.format());
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.format() },
        { status: 400 }
      );
    }
    const { nome, email, password, empresa_id, grupo_id } = validation.data;
    console.log(`${logPrefix} Dados validados:`, { nome, email, empresa_id, grupo_id }); // Não logar senha

    // --- Operações que exigem ROLE_SERVICE --- 
    // USAR supabaseAdmin daqui em diante

    // 4. Criar usuário na autenticação Supabase (usando cliente admin)
    console.log(`${logPrefix} Criando usuário na autenticação Supabase para ${email}...`);
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Marcar como confirmado? Depende do fluxo desejado
      user_metadata: { nome: nome }, // Adicionar nome aos metadados se útil
    });

    if (authError) {
      console.error(`${logPrefix} Erro ao criar usuário na autenticação:`, authError);
      // Tratar erro de usuário já existente
      if (authError.message.includes("User already registered")) {
         return NextResponse.json({ error: "Email já cadastrado." }, { status: 409 }); // Conflict
      }
      throw authError; // Lançar outros erros de autenticação
    }

    const newAuthUserId = authData.user.id;
    console.log(`${logPrefix} Usuário criado na autenticação com auth_id: ${newAuthUserId}`);

    // 5. Inserir usuário na tabela 'usuarios' (usando cliente admin)
    console.log(`${logPrefix} Inserindo usuário na tabela 'usuarios'...`);
    const { data: dbUserData, error: dbError } = await supabaseAdmin
      .from('usuarios')
      .insert({
        auth_id: newAuthUserId,
        nome: nome,
        email: email,
        empresa_id: empresa_id,
        // Adicionar outros campos padrões se necessário (ativo=true?)
      })
      .select('id') // Selecionar o ID interno do usuário recém-criado
      .single();

    if (dbError) {
      console.error(`${logPrefix} Erro ao inserir usuário na tabela 'usuarios':`, dbError);
      // Tentar deletar o usuário da autenticação se a inserção no DB falhar?
      // await supabaseAdmin.auth.admin.deleteUser(newAuthUserId);
      throw dbError;
    }

    const newDbUserId = dbUserData.id;
    console.log(`${logPrefix} Usuário inserido na tabela 'usuarios' com id: ${newDbUserId}`);

    // 6. Associar usuário ao grupo (usando cliente admin)
    console.log(`${logPrefix} Associando usuário ${newDbUserId} ao grupo ${grupo_id}...`);
    const { error: groupLinkError } = await supabaseAdmin
        .from('usuarios_grupos')
        .insert({ usuario_id: newDbUserId, grupo_id: grupo_id });

    if (groupLinkError) {
        console.error(`${logPrefix} Erro ao associar usuário ao grupo:`, groupLinkError);
        // Considerar deletar usuário do auth e da tabela usuarios se a ligação falhar?
        // await supabaseAdmin.auth.admin.deleteUser(newAuthUserId);
        // await supabaseAdmin.from('usuarios').delete().eq('id', newDbUserId);
        throw groupLinkError;
    }
    console.log(`${logPrefix} Usuário ${newDbUserId} associado ao grupo ${grupo_id} com sucesso.`);

    // 7. Retornar sucesso
    console.log(`${logPrefix} Usuário ${email} criado e associado ao grupo ${grupo_id} com sucesso.`);
    return NextResponse.json({ message: "Usuário criado com sucesso!", userId: newDbUserId });

  } catch (error: any) {
    console.error(`${logPrefix} Erro inesperado no processo:`, error);
    const errorMessage = error.message || "Erro interno do servidor";
    // Definir status baseado no tipo de erro, se possível
    let statusCode = 500;
    if (errorMessage.includes("Não autenticado")) statusCode = 401;
    if (errorMessage.includes("Dados inválidos")) statusCode = 400;
    if (errorMessage.includes("Email já cadastrado")) statusCode = 409;
    
    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
}

// Patch para atualizar usuário
export async function PATCH(request: NextRequest) {
  try {
    // 1. Obter usuário requisitante para verificações de permissão
    const cookieStore = cookies();
    const supabaseCookieClient = createServerClient<Database>(
      supabaseConfig.url!,
      supabaseConfig.anonKey!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );
    const { data: { session }, error: sessionError } = await supabaseCookieClient.auth.getSession();
    if (sessionError || !session) {
      console.warn("[API:AdminUsers:PATCH] Sessão do requisitante não encontrada.");
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    const requesterAuthId = session.user.id;

    // Buscar perfil do requisitante (incluindo is_master)
    const { data: requesterProfile, error: requesterProfileError } = await supabase
      .from('usuarios')
      .select('id, is_master')
      .eq('auth_id', requesterAuthId)
      .single();

    if (requesterProfileError || !requesterProfile) {
      console.error(`[API:AdminUsers:PATCH] Erro ao buscar perfil do requisitante ${requesterAuthId}:`, requesterProfileError?.message);
      return NextResponse.json({ error: "Perfil do requisitante não encontrado" }, { status: 403 });
    }
    const requesterDbId = requesterProfile.id;
    const isRequesterTrulyMaster = requesterProfile.is_master === true; // Verifica a flag direta
    console.log(`[API:AdminUsers:PATCH] Requisitante: auth_id=${requesterAuthId}, db_id=${requesterDbId}, is_master_flag=${isRequesterTrulyMaster}`);

    // 2. Obter corpo da requisição
    const body = await request.json();
    console.log("[API:AdminUsers:PATCH] Corpo da requisição recebido:", body);

    // Extrair ID do usuário alvo e flag is_master (se presente)
    const { id: targetAuthId, is_master: isMasterPayload, ...otherData } = body;
    const isAttemptingToChangeMaster = isMasterPayload !== undefined; // Verifica se a chave 'is_master' está presente

    if (!targetAuthId) {
      console.error("[API:AdminUsers:PATCH] ID do usuário alvo (auth_id) faltando no corpo da requisição");
      return NextResponse.json({ error: "ID do usuário alvo é obrigatório" }, { status: 400 });
    }

    // 3. Buscar o ID da tabela usuarios (db_id) correspondente ao auth_id do ALVO
    const { data: targetDbUserLookup, error: targetLookupError } = await supabase
      .from('usuarios')
      .select('id')
      .eq('auth_id', targetAuthId)
      .single();

    if (targetLookupError || !targetDbUserLookup) {
      console.error(`[API:AdminUsers:PATCH] Erro ao buscar db_id para auth_id alvo ${targetAuthId}:`, targetLookupError);
      return NextResponse.json({ error: "Usuário alvo não encontrado na tabela local." }, { status: 404 });
    }
    const targetDbId = targetDbUserLookup.id;
    console.log(`[API:AdminUsers:PATCH] Encontrado usuario.id (db_id) alvo: ${targetDbId} para auth_id ${targetAuthId}`);

    // --- INÍCIO: Verificações de Permissão para Alterar 'is_master' --- 
    if (isAttemptingToChangeMaster) {
        console.log(`[API:AdminUsers:PATCH] Tentativa de alterar is_master para usuário alvo ${targetAuthId} (db_id: ${targetDbId})`);

        // Regra 1: Requisitante precisa ter is_master = true
        if (!isRequesterTrulyMaster) {
            console.warn(`[API:AdminUsers:PATCH] Permissão negada: Requisitante ${requesterAuthId} (db_id: ${requesterDbId}) não é master (flag is_master é ${requesterProfile.is_master}).`);
            return NextResponse.json({ error: "Apenas usuários master podem alterar o status master de outros usuários." }, { status: 403 });
        }
        console.log(`[API:AdminUsers:PATCH] Verificação 1 OK: Requisitante ${requesterAuthId} é master.`);

        // Regra 2: Requisitante não pode alterar o próprio status master
        if (requesterDbId === targetDbId) {
            console.warn(`[API:AdminUsers:PATCH] Permissão negada: Requisitante ${requesterAuthId} (db_id: ${requesterDbId}) tentou alterar o próprio status master.`);
            return NextResponse.json({ error: "Você não pode alterar seu próprio status de master." }, { status: 403 });
        }
         console.log(`[API:AdminUsers:PATCH] Verificação 2 OK: Requisitante ${requesterAuthId} não está alterando o próprio status.`);
    }
    // --- FIM: Verificações de Permissão --- 

    // Preparar dados para atualizar na tabela usuarios (usando otherData e isMasterPayload)
    const updateDbData: any = { ...otherData }; // Começa com outros dados
    if (isAttemptingToChangeMaster) {
        updateDbData.is_master = isMasterPayload; // Adiciona is_master apenas se estava no payload e passou nas verificações
    }
    // Remover campos que não pertencem à tabela 'usuarios' diretamente
    delete updateDbData.id; // Já temos targetAuthId e targetDbId
    delete updateDbData.grupo_ids; // Será tratado separadamente
    delete updateDbData.password; // Será tratado na auth
    const password = otherData.password; // Pegar senha de otherData se existir
    const grupo_ids = otherData.grupo_ids; // Pegar grupos de otherData se existir

    // Continuar com as atualizações como antes...
    let dbUpdateError: any = null;
    if (Object.keys(updateDbData).length > 0) {
      console.log(`[API:AdminUsers:PATCH] Atualizando tabela usuarios (ID: ${targetDbId}) com:`, updateDbData);
      const { error } = await supabase
        .from('usuarios')
        .update(updateDbData)
        .eq('id', targetDbId); // Usar o ID da tabela usuarios do ALVO
      dbUpdateError = error;
    }

    if (dbUpdateError) {
      console.error(`[API:AdminUsers:PATCH] Erro ao atualizar tabela usuarios (ID: ${targetDbId}):`, dbUpdateError);
      // Verificar se é erro de duplicação de email
      if (dbUpdateError.code === '23505' && dbUpdateError.message.includes('usuarios_email_key')) {
         return NextResponse.json({ error: "Este email já está em uso por outro usuário" }, { status: 409 });
      }
      return NextResponse.json({ error: dbUpdateError.message }, { status: 500 });
    }
    console.log(`[API:AdminUsers:PATCH] Tabela usuarios (ID: ${targetDbId}) atualizada com sucesso.`);

    // Atualizar usuário na autenticação (email, senha)
    const updateAuthData: any = {};
    if (updateDbData.email !== undefined) updateAuthData.email = updateDbData.email; // Usar email do updateDbData se presente
    if (password) updateAuthData.password = password; // Apenas se a senha for fornecida em otherData
    
    let authUpdateError: any = null;
    if (Object.keys(updateAuthData).length > 0) {
      console.log(`[API:AdminUsers:PATCH] Atualizando tabela auth.users (ID: ${targetAuthId}) com:`, Object.keys(updateAuthData));
      const { error } = await supabase.auth.admin.updateUserById(targetAuthId, updateAuthData);
      authUpdateError = error;
    }

    if (authUpdateError) {
      console.error(`[API:AdminUsers:PATCH] Erro ao atualizar auth.users (ID: ${targetAuthId}):`, authUpdateError);
      // Poderíamos tentar reverter a atualização no banco aqui, mas por ora só retornamos erro
      return NextResponse.json({ error: `Erro ao atualizar autenticação: ${authUpdateError.message}` }, { status: 500 });
    }
     console.log(`[API:AdminUsers:PATCH] Tabela auth.users (ID: ${targetAuthId}) atualizada com sucesso.`);

    // --- Atualizar Associação de Grupos --- 
    console.log(`[API:AdminUsers:PATCH] Atualizando grupos para usuario.id: ${targetDbId}`);
    // 1. Remover associações antigas
    const { error: deleteGroupsError } = await supabase
        .from('usuarios_grupos')
        .delete()
        .eq('usuario_id', targetDbId); // Usar ID do alvo

    if (deleteGroupsError) {
        // Logar erro mas continuar, atualização principal foi bem-sucedida
        console.error(`[API:AdminUsers:PATCH] Erro ao remover associações de grupo antigas para usuario ${targetDbId}:`, deleteGroupsError.message);
        // Poderia retornar um aviso parcial
    }

    // 2. Inserir nova associação (se grupo_ids for fornecido e tiver um ID válido)
    let newGroupId = null;
    if (grupo_ids && Array.isArray(grupo_ids) && grupo_ids.length > 0 && typeof grupo_ids[0] === 'string' && grupo_ids[0]) {
      newGroupId = grupo_ids[0]; // Usamos apenas o primeiro ID por enquanto
      console.log(`[API:AdminUsers:PATCH] Associando usuário ${targetDbId} ao novo grupo: ${newGroupId}`);
      const { error: insertGroupError } = await supabase
        .from('usuarios_grupos')
        .insert({ usuario_id: targetDbId, grupo_id: newGroupId }); // Usar ID do alvo

      if (insertGroupError) {
        // Logar erro mas continuar
        console.error(`[API:AdminUsers:PATCH] Erro ao associar usuário ${targetDbId} ao novo grupo ${newGroupId}:`, insertGroupError.message);
        // Poderia retornar um aviso parcial
        newGroupId = null; // Define como null se a inserção falhou
      }
    }
    // --- Fim da Atualização de Grupos ---

    // Buscar dados atualizados para retornar (opcional, mas bom para feedback)
    const { data: updatedUser, error: fetchError } = await supabase
      .from('usuarios')
      .select('*, grupo_id:usuarios_grupos(grupo_id)') // Reutiliza a busca com grupo do GET
      .eq('id', targetDbId) // Usar ID do alvo
      .single();

    if (fetchError) {
        console.error(`[API:AdminUsers:PATCH] Erro ao buscar dados atualizados do usuário alvo ${targetDbId}:`, fetchError);
        // Retorna sucesso mesmo assim, pois a atualização principal ocorreu
         return NextResponse.json({ message: "Usuário atualizado, mas houve erro ao buscar dados finais." }, { status: 200 });
    }

    const finalGroupId = updatedUser?.grupo_id && updatedUser.grupo_id.length > 0 ? updatedUser.grupo_id[0].grupo_id : null;
    const finalIsMaster = updatedUser?.is_master ?? isMasterPayload; // Usa o valor do banco ou o payload se o banco falhar

    
    return NextResponse.json(
      { 
        message: "Usuário atualizado com sucesso",
        user: {
          id: targetAuthId, // auth_id do alvo
          nome: updatedUser?.nome || otherData.nome, // Usar valor do banco ou do payload
          email: updatedUser?.email || otherData.email,
          ativo: updatedUser?.ativo ?? otherData.ativo,
          is_master: finalIsMaster, 
          empresa_id: updatedUser?.empresa_id || otherData.empresa_id,
          db_id: targetDbId,
          grupo_id: finalGroupId // Retorna o grupo que foi efetivamente associado
        }
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[API:AdminUsers:PATCH] Erro inesperado:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Endpoint para deletar usuário
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id'); // Este é o auth_id
    
    if (!id) {
      return NextResponse.json(
        { error: "ID do usuário (auth_id) é obrigatório" }, 
        { status: 400 }
      );
    }
    
    console.log("[API:AdminUsers:DELETE] Deletando usuário com auth_id:", id);

    // Cliente com role de serviço para operações admin
    const supabaseAdmin = await createServiceRoleClient();
    
    // 1. Deletar da tabela public.usuarios PRIMEIRO (se houver restrições de FK)
    //    ou depois, dependendo da sua configuração.
    //    Vamos deletar DEPOIS da auth por enquanto.

    // 2. Deletar usuário da autenticação
    console.log(`[API:AdminUsers:DELETE] Tentando deletar usuário da Supabase Auth (auth_id: ${id})...`);
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(id);
    
    // Tratar erro específico onde o usuário pode já não existir na Auth (talvez por exclusão manual)
    // mas ainda existir no DB.
    if (deleteAuthError && deleteAuthError.message !== "User not found") { // <<< Atenção a esta condição
      console.error("[API:AdminUsers:DELETE] Erro ao deletar usuário da autenticação:", deleteAuthError);
      // Não retornar erro fatal aqui ainda, tentar deletar do banco mesmo assim.
      // return NextResponse.json({ error: deleteAuthError.message }, { status: 500 });
    } else if (deleteAuthError && deleteAuthError.message === "User not found"){
       console.warn(`[API:AdminUsers:DELETE] Usuário com auth_id ${id} não encontrado na Auth. Prosseguindo para deletar do banco.`);
    } else {
       console.log(`[API:AdminUsers:DELETE] Usuário auth_id ${id} deletado da Auth (ou já não existia).`);
    }
    
    // 3. Deletar da tabela public.usuarios
    console.log(`[API:AdminUsers:DELETE] Tentando deletar usuário da tabela usuarios (auth_id: ${id})...`);
    const { error: deleteDbError } = await supabaseAdmin
      .from('usuarios')
      .delete() // <<< CORRIGIDO: Usar delete() em vez de update()
      .eq('auth_id', id);
    
    if (deleteDbError) {
      console.error("[API:AdminUsers:DELETE] Erro ao deletar usuário da tabela usuarios:", deleteDbError);
      // Se falhou ao deletar do DB, mas conseguiu deletar da Auth, pode ser um problema.
      // Retornar erro aqui é mais apropriado.
      return NextResponse.json({ error: `Erro ao deletar usuário do banco: ${deleteDbError.message}` }, { status: 500 });
    }
    console.log(`[API:AdminUsers:DELETE] Usuário deletado da tabela usuarios (auth_id: ${id}).`);
    
    return NextResponse.json({ message: "Usuário removido com sucesso" });
  } catch (error: any) {
    console.error("[API:AdminUsers:DELETE] Erro inesperado:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 