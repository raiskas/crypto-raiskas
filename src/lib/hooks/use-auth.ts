'use client';

import { useState, useEffect, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';
import { supabaseConfig } from '@/lib/config';
import { User } from '@supabase/supabase-js'; // Importar User

// Definir tipo AuthUser compatível com User do Supabase
type AuthUser = User;

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // Re-adicionar error para feedback
  const mountedRef = useRef(true);

  // Criar cliente Supabase
  const [supabase] = useState(() => 
    createBrowserClient<Database>(
      supabaseConfig.url!,
      supabaseConfig.anonKey!
    )
  );

  // Efeito principal: Verificar sessão inicial e configurar listener
  useEffect(() => {
    mountedRef.current = true;
    console.log("[Auth Simplified] useEffect: Verificando sessão inicial e configurando listener...");
    setLoading(true);

    // 1. Verificar sessão inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mountedRef.current) return; // Prevenir atualização se desmontado
      console.log("[Auth Simplified] Sessão inicial obtida:", session ? 'Encontrada' : 'Não encontrada');
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch((err) => {
      if (!mountedRef.current) return;
      console.error("[Auth Simplified] Erro ao buscar sessão inicial:", err);
      setError(err.message);
      setUser(null);
      setLoading(false);
    });

    // 2. Configurar listener para mudanças futuras
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mountedRef.current) return;
      console.log(`[Auth Simplified] onAuthStateChange: Evento ${event}, Sessão ${session ? 'existe' : 'null'}`);
      setUser(session?.user ?? null);
      // Limpar erro em qualquer mudança de auth bem-sucedida
      if (event !== 'SIGNED_OUT' && session) {
         setError(null);
      }
      // O loading principal já deve ser false aqui, mas garantimos
      setLoading(false); 
    });

    // Cleanup
    return () => {
      mountedRef.current = false;
      console.log("[Auth Simplified] useEffect desmontado. Desinscrevendo listener.");
      subscription?.unsubscribe();
    };
  // Adicionar supabase como dependência se necessário, mas createBrowserClient deve ser estável
  }, [supabase]); 

  // Função SignIn (simplificada)
  const signIn = async (email: string, password: string) => {
    console.log("[Auth Simplified] signIn chamado.");
    setLoading(true); // Pode usar um estado de loading específico se preferir
    setError(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      // O listener deve atualizar o estado `user`
      console.log("[Auth Simplified] signIn bem-sucedido.");
      setLoading(false);
      return { success: true };
    } catch (err: any) {
      console.error("[Auth Simplified] Erro no signIn:", err);
      setError(err.message); // Definir o estado de erro
      setLoading(false);
      return { success: false, error: err.message }; // Retornar o erro
    }
  };

  // Função SignOut (revisada com try...catch)
  const signOut = async () => {
    console.log("[Auth Simplified] signOut chamado.");
    setLoading(true);
    setError(null);
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        // Lança o erro para ser pego pelo catch
        throw signOutError;
      }
      // Se chegou aqui, o signOut foi bem-sucedido (o listener cuidará de limpar o usuário)
      console.log("[Auth Simplified] signOut bem-sucedido (listener atualizará o estado).");
    } catch (err: any) {
      console.error("[Auth Simplified] Erro no signOut:", err);
      setError(err.message || 'Erro desconhecido ao fazer logout.');
    } finally {
      setLoading(false);
    }
  };

  return {
    user,
    loading,
    error, // Exportar o estado de erro
    signIn,
    signOut,
    isAuthenticated: !!user, // Derivado simples
    // Não exportar mais checkAuthState ou refreshToken
  };
} 