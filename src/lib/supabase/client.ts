import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';
import { supabaseConfig } from '@/lib/config';

// Cria um cliente do Supabase para uso no lado do cliente
// Utiliza o helper específico para Next.js que já lida com persistência de sessão
export const createClient = () => {
  return createClientComponentClient<Database>({
    supabaseUrl: supabaseConfig.url,
    supabaseKey: supabaseConfig.anonKey,
  });
};

// Singleton para evitar múltiplas instâncias
let supabaseInstance: ReturnType<typeof createClientComponentClient<Database>> | null = null;

export const getSupabase = () => {
  if (!supabaseInstance) {
    supabaseInstance = createClient();
  }
  return supabaseInstance;
};

// Resetar cliente para forçar nova instância limpa
export const resetSupabaseClient = () => {
  supabaseInstance = null;
}; 