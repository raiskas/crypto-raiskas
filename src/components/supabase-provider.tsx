'use client';

import { createContext, useContext, useEffect, useState } from 'react';
// import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'; // REMOVIDO
import { createBrowserClient } from '@supabase/ssr'; // ADICIONADO
import { useRouter } from 'next/navigation'; // Para lidar com redirecionamentos na mudança de autenticação

// import type { SupabaseClient, Session } from '@supabase/auth-helpers-nextjs'; // REMOVIDO
import type { SupabaseClient, Session } from '@supabase/supabase-js'; // MUDADO para @supabase/supabase-js
import type { Database } from '@/types/supabase'; // Certifique-se que este tipo existe

type SupabaseContextType = {
  supabase: SupabaseClient<Database>;
  session: Session | null;
};

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

export default function SupabaseProvider({
  children,
  session, // Sessão inicial do servidor
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  // Usar state para armazenar a instância do cliente - garante que seja criado uma vez no cliente
  // const [supabase] = useState(() => createClientComponentClient<Database>()); // REMOVIDO
  const [supabase] = useState(() => createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )); // ADICIONADO
  const router = useRouter();

  useEffect(() => {
    // Ouvir mudanças na autenticação no lado do cliente
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Pode adicionar lógica aqui, ex: recarregar dados ou redirecionar
      // console.log('Auth event:', event, session);

      // Exemplo: Recarregar a página no login/logout por simplicidade
      // Uma app mais sofisticada poderia atualizar o estado
      router.refresh();
    });

    // Limpar a inscrição ao desmontar
    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, router]);

  return (
    <SupabaseContext.Provider value={{ supabase, session }}>
      {children}
    </SupabaseContext.Provider>
  );
}

// Hook para usar o cliente Supabase e a sessão em outros componentes cliente
export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
}; 