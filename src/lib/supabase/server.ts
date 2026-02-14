'use server';

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { cookies } from 'next/headers';
import { supabaseConfig } from '@/lib/config';

// Verificação e inicialização de variáveis de ambiente
const getSupabaseCredentials = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl) {
    console.error('NEXT_PUBLIC_SUPABASE_URL não está definido');
    throw new Error('URL do Supabase não configurada');
  }
  
  if (!supabaseServiceKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY não está definido');
    throw new Error('Chave de serviço do Supabase não configurada');
  }
  
  return { supabaseUrl, supabaseServiceKey };
};

// Cria um cliente do Supabase usando a chave de serviço
// Este cliente só deve ser usado em operações do lado do servidor
export async function createServerSupabaseClient() {
  try {
    console.log('[Server] Criando cliente com URL:', supabaseConfig.url.substring(0, 15) + '...');
    
    // Criando o cliente com as credenciais Admin/Service Role
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
    
    // Em ambiente de produção, verificamos a conexão
    if (process.env.NODE_ENV === 'production') {
      try {
        const { error } = await supabase.auth.getUser();
        if (error) {
          console.error('[Server] Erro ao verificar cliente Supabase:', error);
        }
      } catch (verifyError) {
        console.error('[Server] Exceção ao verificar cliente Supabase:', verifyError);
        // Não lançamos erro aqui para permitir operações mesmo com falha na verificação
      }
    }
    
    return supabase;
  } catch (error) {
    console.error('[Server] Falha ao criar cliente Supabase:', error);
    throw new Error('Falha na inicialização do cliente Supabase');
  }
}

// Funções auxiliares para operações comuns no banco de dados
export async function getUserByAuthId(authId: string) {
  const supabase = await createServerSupabaseClient();
  
  try {
    const { data: user, error } = await supabase
      .from('usuarios')
      .select('id, nome, email, empresa_id, ativo')
      .eq('auth_id', authId)
      .single();
      
    if (error) throw error;
    return user;
  } catch (error) {
    console.error('Erro ao obter usuário por auth_id:', error);
    return null;
  }
}

export async function getEmpresaById(empresaId: string) {
  const supabase = await createServerSupabaseClient();
  
  try {
    const { data: empresa, error } = await supabase
      .from('empresas')
      .select('*')
      .eq('id', empresaId)
      .single();
      
    if (error) throw error;
    return empresa;
  } catch (error) {
    console.error('Erro ao obter empresa por ID:', error);
    return null;
  }
}

export async function getGruposByUsuarioId(usuarioId: string) {
  const supabase = await createServerSupabaseClient();
  
  try {
    const { data: grupos, error } = await supabase
      .from('usuarios_grupos')
      .select('grupos(*)')
      .eq('usuario_id', usuarioId);
      
    if (error) throw error;
    return grupos.map(g => g.grupos);
  } catch (error) {
    console.error('Erro ao obter grupos do usuário:', error);
    return [];
  }
} 