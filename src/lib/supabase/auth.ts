import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase';
import { getServiceRoleKey, supabaseConfig } from '@/lib/config';
import { getServerUser } from './async-cookies';

export const supabase = createClient<Database>(
  supabaseConfig.url,
  supabaseConfig.anonKey
);

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
};

export const getCurrentUser = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session) {
    return null;
  }

  const { data: userData, error: userError } = await supabase
    .from('usuarios')
    .select('*')
    .eq('auth_id', session.user.id)
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

/**
 * Obtém o cliente do Supabase com a chave de serviço
 */
export function getServiceClient() {
  return createClient<Database>(
    supabaseConfig.url,
    getServiceRoleKey(),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

/**
 * Obtém o cliente do Supabase com o cookie do usuário
 */
export async function getClientWithCookies() {
  const cookieStore = await cookies();
  
  return createServerClient<Database>(
    supabaseConfig.url,
    supabaseConfig.anonKey,
    {
      cookies: {
        get(name) {
          const cookie = cookieStore.get(name);
          return cookie?.value;
        },
        set(name, value, options) {
          cookieStore.set(name, value, options);
        },
        remove(name, options) {
          cookieStore.set(name, '', { ...options, maxAge: 0 });
        },
      },
    }
  );
}

/**
 * Mantida por compatibilidade. Não cria mais usuário temporário nem busca "qualquer usuário".
 */
export async function getCurrentUserFallback() {
  try {
    const userData = await getServerUser();
    if (userData) {
      return userData;
    }

    const supabase = await getClientWithCookies();
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error('[Auth] Detalhes do erro de sessão:', sessionError);
      return null;
    }

    if (sessionData?.session) {
      const { data: userData2, error: userError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('auth_id', sessionData.session.user.id)
        .single();

      if (!userError && userData2) {
        return userData2;
      }

      if (userError) {
        console.error('[Auth] Erro ao buscar usuário pela auth_id:', userError);
      }
    }

    return null;
  } catch (error) {
    console.error('[Auth] Erro na verificação de usuário:', error);
    return null;
  }
} 
