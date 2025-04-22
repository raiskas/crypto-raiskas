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

  // Função SignUp (adicionada)
  const signUp = async (email: string, password: string, nome: string) => {
    console.log("[Auth Simplified] signUp chamado.");
    setLoading(true);
    setError(null);
    try {
      // 1. Criar o usuário na autenticação do Supabase
      // IMPORTANTE: Para não enviar email de confirmação, configure no painel Supabase!
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Adiciona o nome aos metadados que podem ser úteis,
          // mas a tabela 'usuarios' será a fonte principal.
          data: {
            nome: nome,
          },
        },
      });

      if (signUpError) {
        console.error("[Auth Simplified] Erro Supabase signUp:", signUpError);
        throw signUpError;
      }

      // Verificar se o usuário foi criado (pode ser null se a confirmação estiver ativa)
      if (!signUpData.user) {
         // Isso pode acontecer se a confirmação de email estiver habilitada no Supabase
         // e você não estiver tratando o fluxo de confirmação.
         // Se você DESABILITOU a confirmação, isso não deveria acontecer.
         console.warn("[Auth Simplified] Supabase signUp retornou sucesso, mas sem objeto user. Verifique as configurações de confirmação de email.");
         // Considerar retornar sucesso aqui se a confirmação estiver ativa e for esperada.
         // Por ora, vamos lançar um erro se a confirmação estiver desativada e mesmo assim user for null.
         throw new Error("Falha ao obter dados do usuário após cadastro no Supabase.");
      }

      console.log("[Auth Simplified] Usuário criado no Supabase Auth:", signUpData.user.id);

      // 2. Chamar a API interna para criar o registro na tabela 'usuarios'
      //    (A API foi simplificada para não criar empresa/grupo)
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auth_id: signUpData.user.id, // Passa o ID do Supabase Auth
          email: email,
          nome: nome,
        }),
      });

      if (!response.ok) {
        // Se a API falhar, TENTAR excluir o usuário recém-criado no Supabase Auth
        // para manter a consistência (best-effort)
        console.error("[Auth Simplified] Erro ao chamar API /api/auth/register. Tentando reverter Supabase Auth...");
        try {
          // Precisamos de privilégios de admin para excluir, o que não temos no browser.
          // Idealmente, a API /api/auth/register deveria lidar com a reversão se ela mesma criasse o usuário auth.
          // Como estamos separando, logamos o erro e informamos.
          // await supabase.auth.admin.deleteUser(signUpData.user.id); // << NÃO FUNCIONA NO CLIENT-SIDE
          console.error(`[Auth Simplified] FALHA NA REVERSÃO AUTOMÁTICA: Não foi possível excluir o usuário ${signUpData.user.id} do Supabase Auth pelo cliente. Exclusão manual ou ajuste na API /api/auth/register pode ser necessário.`);
        } catch (revertError: any) {
          console.error("[Auth Simplified] Erro ao tentar reverter Supabase Auth:", revertError);
        }
        const errorBody = await response.json().catch(() => ({})); // Tenta pegar corpo do erro
        throw new Error(errorBody.error || `Erro na API de registro: ${response.statusText}`);
      }

      console.log("[Auth Simplified] signUp completo e API /api/auth/register chamada com sucesso.");
      // O listener onAuthStateChange deve pegar o novo usuário logado.
      setLoading(false);
      return { success: true, user: signUpData.user };

    } catch (err: any) {
      console.error("[Auth Simplified] Erro geral no signUp:", err);
      setError(err.message || 'Erro desconhecido durante o cadastro.');
      setLoading(false);
      return { success: false, error: err.message };
    }
  };

  return {
    user,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    isAuthenticated: !!user,
  };
} 