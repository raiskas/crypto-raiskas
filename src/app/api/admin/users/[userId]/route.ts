import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js'; // Usar createClient diretamente
import { Database } from '@/types/supabase';
import { supabaseConfig } from '@/lib/config'; // Importar config
// import { getUserSession } from '@/lib/auth/session'; // !! Implementar ou verificar helper para pegar sessão !!

// !! ALERTA DE SEGURANÇA !!
// Criar cliente Supabase com chave administrativa (SERVICE ROLE KEY).
// Isso bypassa RLS e permite buscar qualquer usuário.
// É ESSENCIAL adicionar verificação de sessão e permissão de admin
// antes que o código chame esta API para garantir que apenas admins
// possam buscar dados de outros usuários.
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

export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  const userIdToFetch = params.userId;

  // --- 1. Verificar Autenticação e Permissões (PLACEHOLDER - NECESSÁRIO IMPLEMENTAR!) ---
  // try {
    // --- Obter Sessão (!! IMPLEMENTAR !!) ---
    // const session = await getUserSession(); 
    // if (!session?.user) { ... }

    // --- Verificar Permissão de Admin (!! IMPLEMENTAR CRÍTICO !!) ---
    // const isAdmin = session.user.role === 'admin'; 
    // if (!isAdmin) { ... }
    // console.log(`[API ADMIN GET USER] Admin check PASSED (Placeholder) for user: ${userIdToFetch}`);

    // --- 2. Buscar Dados do Usuário no Banco (usando cliente admin) --- 
    console.log(`[API ADMIN GET USER] Buscando usuário no DB com auth_id: ${userIdToFetch}`);
    const { data: userDataFromDb, error: dbError } = await supabase
      .from('usuarios') // Confirmar nome da tabela
      .select('id, nome, email') // Selecionar campos
      .eq('auth_id', userIdToFetch) // Assume que userIdToFetch é o ID da autenticação
      .single();

    console.log(`[API ADMIN GET USER] Resultado da busca no DB:`, { userDataFromDb, dbError });

    // --- 3. Tratar Erros do Banco --- 
    if (dbError) {
      console.error(`[API ADMIN GET USER] Erro ao buscar usuário ${userIdToFetch} no DB:`, dbError);
      if (dbError.code === 'PGRST116') { 
         return NextResponse.json({ error: 'User not found' }, { status: 404 });
      } 
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }

    // --- 4. Verificar se o Usuário Foi Encontrado --- 
    if (!userDataFromDb) {
      console.warn(`[API ADMIN GET USER] Usuário ${userIdToFetch} não encontrado no DB.`);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // --- 5. Formatar e Retornar Dados --- 
    console.log(`[API ADMIN GET USER] Dados encontrados para usuário ${userIdToFetch}:`, userDataFromDb);
    
    // Simplificando ao máximo a resposta para teste
    const simpleResponse = {
        id: userDataFromDb.id, // Usar o ID do banco (db id)
        auth_id: userIdToFetch, // Manter o auth_id para referência, se necessário
        nome: userDataFromDb.nome,
        email: userDataFromDb.email
    };

    console.log(`[API ADMIN GET USER] Enviando resposta:`, simpleResponse);

    return NextResponse.json(simpleResponse);

  // } catch (error) { ... } // Try/Catch comentado pois a verificação de sessão/admin está comentada
}

// Outros métodos (PATCH, DELETE para este usuário específico) podem ser adicionados aqui 