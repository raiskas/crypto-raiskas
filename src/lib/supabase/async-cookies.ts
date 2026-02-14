import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase';
import { supabaseConfig } from '@/lib/config';

// Define o tipo base do usuário a partir do tipo gerado
type UsuarioBase = Database['public']['Tables']['usuarios']['Row'];

// Definir tipo explícito para o usuário retornado, incluindo campos adicionados
// Estende o tipo base e adiciona/sobrescreve as propriedades necessárias
type UsuarioCompleto = Omit<UsuarioBase, 'is_master'> & { // Remove is_master do base se existir (para evitar conflito)
  is_master: boolean | null | undefined; // Define explicitamente o tipo esperado para is_master
  grupo_ids: string[];
};

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
 * Retorna o tipo UsuarioCompleto ou null
 */
export const getServerUser = async () => {
  const supabase = createClient<Database>(
    supabaseConfig.url,
    supabaseConfig.anonKey
  );

  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session) {
    return null;
  }

  // Buscar informações adicionais do usuário
  const { data: userData, error: userError } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (userError) {
    console.error('Erro ao buscar dados do usuário:', userError);
    return null;
  }

  return {
    ...session.user,
    ...userData
  };
}; 
