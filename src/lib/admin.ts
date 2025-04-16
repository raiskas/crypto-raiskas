import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { supabaseConfig } from '@/lib/config';

// Criar cliente com role de serviço para operações administrativas
const adminClient = createClient<Database>(
  supabaseConfig.url,
  supabaseConfig.serviceRoleKey
);

export async function forceResetPassword(
  email: string,
  newPassword: string,
  adminKey: string
) {
  try {
    // Verificar se a chave administrativa está correta
    if (adminKey !== process.env.ADMIN_KEY) {
      return {
        success: false,
        error: "Chave administrativa inválida"
      };
    }

    // Buscar usuário pelo email usando a API de administração
    const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();
    
    if (listError) {
      return {
        success: false,
        error: "Erro ao buscar usuário"
      };
    }

    const user = users.find(u => u.email === email);
    if (!user) {
      return {
        success: false,
        error: "Usuário não encontrado"
      };
    }

    // Atualizar a senha usando a API de administração do Supabase
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (updateError) {
      return {
        success: false,
        error: "Erro ao atualizar senha"
      };
    }

    return {
      success: true
    };
  } catch (error) {
    console.error("[Admin] Erro ao forçar reset de senha:", error);
    return {
      success: false,
      error: "Erro interno ao processar a solicitação"
    };
  }
}

export async function getUsers() {
  try {
    const { data: users, error } = await adminClient.auth.admin.listUsers();
    
    if (error) {
      console.error('Erro ao buscar usuários:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: users };
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    return { success: false, error: 'Erro ao buscar usuários' };
  }
} 