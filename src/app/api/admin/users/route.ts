import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
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

// Schema de validação para criação de usuário (ajuste conforme necessário)
const createUserSchema = z.object({
  nome: z.string().min(3, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  empresa_id: z.string().uuid("Empresa inválida"),
  // Adicione outros campos se necessário (ex: grupo_id inicial)
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
    console.log(`[API:AdminUsers:GET][DEBUG] Grupos do usuário ${requesterUserId}:`, userGroupIds);

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
         console.log(`[API:AdminUsers:GET][DEBUG] Resultado da verificação de grupos master (${userGroupIds.join(', ')}):`, masterGroupsResult);
    } else {
        console.log(`[API:AdminUsers:GET][DEBUG] Usuário ${requesterUserId} não pertence a nenhum grupo.`);
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
                       
      // Log para cada usuário combinado (pode ser verboso)
      // console.log(`[API:AdminUsers:GET] Combinando authUser ${authUser.id} com dbUser ${dbUser?.id}`);
                       
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
        console.log(`[API:AdminUsers:GET] Entrando no bloco de filtro final. Requester Empresa ID: ${requesterEmpresaId}`);
        mergedUsers = mergedUsers.filter(user => {
            const userEmpresaId = user.empresa_id;
            const shouldKeep = userEmpresaId === requesterEmpresaId;
            return shouldKeep;
        });
        console.log(`[API:AdminUsers:GET] ${mergedUsers.length} usuários após filtro final de empresa.`);
    } else {
        console.log(`[API:AdminUsers:GET] Pulando o bloco de filtro final pois isRequesterMaster é true.`);
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

  try {
    // 1. Criar cliente Supabase que LÊ COOKIES DIRETAMENTE AQUI
    const cookieStore = cookies(); // Obter o cookie store
    const supabaseCookieClient = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, // Usar variáveis de ambiente
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, // Usar variáveis de ambiente
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          // Não precisamos de set/remove aqui, apenas get para a sessão
        },
      }
    );
    console.log(`${logPrefix} Cliente Supabase (cookie-aware) criado.`);

    // 2. Obter sessão do administrador
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

    // 3. Verificar permissão (Placeholder)
    console.warn(`${logPrefix} ATENÇÃO: Verificação de permissão ('usuario_criar') está desativada para depuração.`);

    // 4. Obter e validar corpo da requisição
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
    const { nome, email, password, empresa_id } = validation.data;
    console.log(`${logPrefix} Dados validados com sucesso.`);

    // --- Operações Críticas --- 
    // 5. Criar cliente com ROLE DE SERVIÇO
    const supabaseServiceRoleClient: SupabaseClient<Database> = await createServiceRoleClient();
    console.log(`${logPrefix} Cliente Supabase (service role) criado para operações admin.`);
    
    let newAuthUser = null;
    try {
      // 6. Criar usuário na autenticação (usando cliente de serviço)
      console.log(`${logPrefix} Tentando criar usuário na Supabase Auth (service role):`, { email });
      const { data: authData, error: authError } = await supabaseServiceRoleClient.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true, 
        user_metadata: { nome: nome }, 
      });

      if (authError) {
        console.error(`${logPrefix} Erro ao criar usuário na Supabase Auth:`, authError);
        if (authError.message.includes('duplicate key value violates unique constraint')) {
           throw new Error(`O email '${email}' já está em uso.`);
        } else if (authError.message.includes('Password should be at least 6 characters')) {
           throw new Error('A senha fornecida é muito fraca ou curta.');
        }
        throw new Error("Falha ao criar usuário na autenticação: " + authError.message);
      }
      
      newAuthUser = authData.user;
      if (!newAuthUser) {
         throw new Error("Resposta da criação na Auth não retornou um usuário.");
      }
      console.log(`${logPrefix} Usuário criado na Supabase Auth com sucesso. auth_id: ${newAuthUser.id}`);

      // 7. Inserir usuário na tabela 'public.usuarios' (usando cliente de serviço)
      console.log(`${logPrefix} Tentando inserir na tabela 'usuarios' (service role):`, { auth_id: newAuthUser.id, nome, email, empresa_id });
      const { data: profileData, error: profileError } = await supabaseServiceRoleClient
        .from("usuarios")
        .insert({
          auth_id: newAuthUser.id, 
          nome: nome,
          email: email,
          empresa_id: empresa_id, 
          ativo: true, 
        })
        .select()
        .single();

      if (profileError) {
        console.error(`${logPrefix} Erro ao inserir na tabela 'usuarios':`, profileError);
        console.warn(`${logPrefix} Tentando reverter criação na Auth para ${newAuthUser.id}...`);
        const { error: deleteError } = await supabaseServiceRoleClient.auth.admin.deleteUser(newAuthUser.id);
        if (deleteError) {
            console.error(`${logPrefix} FALHA AO REVERTER criação na Auth:`, deleteError);
        } else {
            console.log(`${logPrefix} Reversão na Auth bem-sucedida.`);
        }
        throw new Error("Falha ao salvar perfil do usuário no banco de dados: " + profileError.message);
      }
      console.log(`${logPrefix} Usuário inserido na tabela 'usuarios' com sucesso:`, profileData);
      
      // 8. (Opcional) Adicionar usuário a um grupo padrão
      console.log(`${logPrefix} TODO: Implementar adição a grupo padrão, se necessário (usando service role client).`);

      // 9. Sucesso - Retornar resposta
       const successResponse = { message: "Usuário criado com sucesso!", userId: profileData.id };
       console.log(`${logPrefix} Retornando sucesso:`, successResponse);
       return NextResponse.json(successResponse, { status: 201 });

    } catch (operationError: any) {
        console.error(`${logPrefix} Erro durante as operações críticas:`, operationError);
        if (newAuthUser && newAuthUser.id) { 
          console.warn(`${logPrefix} Erro após criação na Auth. Tentando reverter criação na Auth para ${newAuthUser.id}...`);
          const { error: deleteError } = await supabaseServiceRoleClient.auth.admin.deleteUser(newAuthUser.id);
          if (deleteError) {
              console.error(`${logPrefix} FALHA AO REVERTER criação na Auth durante tratamento de erro:`, deleteError);
          }
        }
        const errorResponse = { error: operationError.message || "Erro interno nas operações de banco de dados." };
        console.log(`${logPrefix} Retornando erro da operação:`, errorResponse);
        return NextResponse.json(errorResponse, { status: 400 }); 
    }

  } catch (error: any) {
     console.error(`${logPrefix} Erro inesperado no handler:`, error);
     const finalErrorResponse = { error: error.message || "Erro interno do servidor." };
     console.log(`${logPrefix} Retornando erro geral:`, finalErrorResponse);
     return NextResponse.json(finalErrorResponse, { status: 500 });
  }
}

// Patch para atualizar usuário
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("[API:AdminUsers:PATCH] Corpo da requisição recebido:", body);
    // Extrair todos os campos possíveis, incluindo os novos
    const {
      id, // auth_id do usuário a ser atualizado
      nome, email, password, empresa_id, ativo,
      is_master, // Novo
      grupo_ids, // Esperamos um array, mas por enquanto usaremos apenas o primeiro ID
      telefone, // Novo
      endereco_rua, endereco_numero, endereco_complemento, // Novo
      endereco_bairro, endereco_cidade, endereco_estado, endereco_cep // Novo
    } = body;
    
    if (!id) {
      console.error("[API:AdminUsers:PATCH] ID do usuário (auth_id) faltando no corpo da requisição");
      return NextResponse.json({ error: "ID do usuário é obrigatório" }, { status: 400 });
    }

    // Buscar o ID da tabela usuarios (db_id) correspondente ao auth_id
    const { data: dbUserLookup, error: lookupError } = await supabase
      .from('usuarios')
      .select('id')
      .eq('auth_id', id)
      .single();

    if (lookupError || !dbUserLookup) {
      console.error(`[API:AdminUsers:PATCH] Erro ao buscar db_id para auth_id ${id}:`, lookupError);
      return NextResponse.json({ error: "Usuário não encontrado na tabela local." }, { status: 404 });
    }
    const usuarioDbId = dbUserLookup.id;
    console.log(`[API:AdminUsers:PATCH] Encontrado usuario.id (db_id): ${usuarioDbId} para auth_id ${id}`);

    // Preparar dados para atualizar na tabela usuarios
    const updateDbData: any = {};
    if (nome !== undefined) updateDbData.nome = nome;
    if (email !== undefined) updateDbData.email = email;
    if (empresa_id !== undefined) updateDbData.empresa_id = empresa_id;
    if (ativo !== undefined) updateDbData.ativo = ativo;
    if (is_master !== undefined) updateDbData.is_master = is_master;
    if (telefone !== undefined) updateDbData.telefone = telefone;
    if (endereco_rua !== undefined) updateDbData.endereco_rua = endereco_rua;
    if (endereco_numero !== undefined) updateDbData.endereco_numero = endereco_numero;
    if (endereco_complemento !== undefined) updateDbData.endereco_complemento = endereco_complemento;
    if (endereco_bairro !== undefined) updateDbData.endereco_bairro = endereco_bairro;
    if (endereco_cidade !== undefined) updateDbData.endereco_cidade = endereco_cidade;
    if (endereco_estado !== undefined) updateDbData.endereco_estado = endereco_estado;
    if (endereco_cep !== undefined) updateDbData.endereco_cep = endereco_cep;
    
    let dbUpdateError: any = null;
    if (Object.keys(updateDbData).length > 0) {
      console.log(`[API:AdminUsers:PATCH] Atualizando tabela usuarios (ID: ${usuarioDbId}) com:`, updateDbData);
      const { error } = await supabase
        .from('usuarios')
        .update(updateDbData)
        .eq('id', usuarioDbId); // Usar o ID da tabela usuarios
      dbUpdateError = error;
    }

    if (dbUpdateError) {
      console.error(`[API:AdminUsers:PATCH] Erro ao atualizar tabela usuarios (ID: ${usuarioDbId}):`, dbUpdateError);
      // Verificar se é erro de duplicação de email
      if (dbUpdateError.code === '23505' && dbUpdateError.message.includes('usuarios_email_key')) {
         return NextResponse.json({ error: "Este email já está em uso por outro usuário" }, { status: 409 });
      }
      return NextResponse.json({ error: dbUpdateError.message }, { status: 500 });
    }
    console.log(`[API:AdminUsers:PATCH] Tabela usuarios (ID: ${usuarioDbId}) atualizada com sucesso.`);

    // Atualizar usuário na autenticação (email, senha)
    const updateAuthData: any = {};
    if (email !== undefined) updateAuthData.email = email;
    if (password) updateAuthData.password = password; // Apenas se a senha for fornecida
    
    let authUpdateError: any = null;
    if (Object.keys(updateAuthData).length > 0) {
      console.log(`[API:AdminUsers:PATCH] Atualizando tabela auth.users (ID: ${id}) com:`, Object.keys(updateAuthData));
      const { error } = await supabase.auth.admin.updateUserById(id, updateAuthData);
      authUpdateError = error;
    }

    if (authUpdateError) {
      console.error(`[API:AdminUsers:PATCH] Erro ao atualizar auth.users (ID: ${id}):`, authUpdateError);
      // Poderíamos tentar reverter a atualização no banco aqui, mas por ora só retornamos erro
      return NextResponse.json({ error: `Erro ao atualizar autenticação: ${authUpdateError.message}` }, { status: 500 });
    }
     console.log(`[API:AdminUsers:PATCH] Tabela auth.users (ID: ${id}) atualizada com sucesso.`);

    // --- Atualizar Associação de Grupos --- 
    console.log(`[API:AdminUsers:PATCH] Atualizando grupos para usuario.id: ${usuarioDbId}`);
    // 1. Remover associações antigas
    const { error: deleteGroupsError } = await supabase
        .from('usuarios_grupos')
        .delete()
        .eq('usuario_id', usuarioDbId);

    if (deleteGroupsError) {
        // Logar erro mas continuar, atualização principal foi bem-sucedida
        console.error(`[API:AdminUsers:PATCH] Erro ao remover associações de grupo antigas para usuario ${usuarioDbId}:`, deleteGroupsError.message);
        // Poderia retornar um aviso parcial
    }

    // 2. Inserir nova associação (se grupo_ids for fornecido e tiver um ID válido)
    let newGroupId = null;
    if (grupo_ids && Array.isArray(grupo_ids) && grupo_ids.length > 0 && typeof grupo_ids[0] === 'string' && grupo_ids[0]) {
      newGroupId = grupo_ids[0]; // Usamos apenas o primeiro ID por enquanto
      console.log(`[API:AdminUsers:PATCH] Associando usuário ${usuarioDbId} ao novo grupo: ${newGroupId}`);
      const { error: insertGroupError } = await supabase
        .from('usuarios_grupos')
        .insert({ usuario_id: usuarioDbId, grupo_id: newGroupId });

      if (insertGroupError) {
        // Logar erro mas continuar
        console.error(`[API:AdminUsers:PATCH] Erro ao associar usuário ${usuarioDbId} ao novo grupo ${newGroupId}:`, insertGroupError.message);
        // Poderia retornar um aviso parcial
        newGroupId = null; // Define como null se a inserção falhou
      }
    }
    // --- Fim da Atualização de Grupos ---

    // Buscar dados atualizados para retornar (opcional, mas bom para feedback)
    const { data: updatedUser, error: fetchError } = await supabase
      .from('usuarios')
      .select('*, grupo_id:usuarios_grupos(grupo_id)') // Reutiliza a busca com grupo do GET
      .eq('id', usuarioDbId)
      .single();

    const finalGroupId = updatedUser?.grupo_id && updatedUser.grupo_id.length > 0 ? updatedUser.grupo_id[0].grupo_id : null;
    
    return NextResponse.json(
      { 
        message: "Usuário atualizado com sucesso",
        user: {
          id: id, // auth_id
          nome: updatedUser?.nome || nome,
          email: updatedUser?.email || email,
          ativo: updatedUser?.ativo ?? ativo,
          is_master: updatedUser?.is_master ?? is_master,
          empresa_id: updatedUser?.empresa_id || empresa_id,
          db_id: usuarioDbId,
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
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: "ID do usuário é obrigatório" },
        { status: 400 }
      );
    }
    
    console.log("[API:AdminUsers] Deletando usuário:", id);
    
    // Deletar usuário da autenticação
    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(id);
    
    if (deleteAuthError) {
      console.error("[API:AdminUsers] Erro ao deletar usuário da autenticação:", deleteAuthError);
      return NextResponse.json({ error: deleteAuthError.message }, { status: 500 });
    }
    
    // Deletar ou apenas inativar na tabela personalizada
    const { error: deleteDbError } = await supabase
      .from('usuarios')
      .update({ ativo: false })
      .eq('auth_id', id);
    
    if (deleteDbError) {
      console.error("[API:AdminUsers] Erro ao inativar usuário no banco:", deleteDbError);
      // Não retornar erro, pois o usuário já foi removido da autenticação
      console.warn("[API:AdminUsers] Usuário removido da autenticação, mas não do banco");
    }
    
    return NextResponse.json({ message: "Usuário removido com sucesso" });
  } catch (error: any) {
    console.error("[API:AdminUsers] Erro inesperado:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 