import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { Database } from '@/types/supabase';
import { supabaseConfig } from '@/lib/config';

/**
 * Cria um cliente do Supabase com gerenciamento de cookies compatível com o Next.js 15+
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  
  return createServerClient<Database>(
    supabaseConfig.url,
    supabaseConfig.anonKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set(name, value, options as any);
          } catch (error) {
            console.error(`Erro ao definir cookie ${name}:`, error);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set(name, '', { ...options, maxAge: 0 } as any);
          } catch (error) {
            console.error(`Erro ao remover cookie ${name}:`, error);
          }
        },
      },
    }
  );
}

/**
 * Obtém a sessão atual do usuário autenticado
 */
export async function getServerSession() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Erro ao buscar sessão:', error);
      return null;
    }
    
    return data?.session || null;
  } catch (error) {
    console.error('Erro ao inicializar Supabase ou buscar sessão:', error);
    return null;
  }
}

/**
 * Obtém os dados completos do usuário autenticado
 */
export async function getServerUser() {
  try {
    console.log('[ServerAuth] Iniciando verificação de sessão');
    const session = await getServerSession();
    
    if (!session) {
      console.log('[ServerAuth] Nenhuma sessão encontrada');
      return null;
    }
    
    console.log('[ServerAuth] Sessão encontrada para usuário:', session.user.id);
    
    // Remover verificação de expiração de sessão
    // Vamos considerar a sessão válida independentemente da data de expiração
    
    // Buscar dados do usuário
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('auth_id', session.user.id)
      .single();
    
    if (error) {
      console.error('[ServerAuth] Erro ao buscar dados do usuário:', error);
      return null;
    }
    
    if (!data) {
      console.error('[ServerAuth] Nenhum dado encontrado para o usuário auth_id:', session.user.id);
      return null;
    }
    
    console.log('[ServerAuth] Dados do usuário recuperados com sucesso:', data.id);
    return data;
  } catch (error) {
    console.error('[ServerAuth] Erro ao buscar usuário:', error);
    return null;
  }
} 