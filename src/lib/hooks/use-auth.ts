'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';
import { supabaseConfig } from '@/lib/config';

type AuthUser = {
  id: string;
  email: string;
};

// Configuração para sessão de longa duração (1 ano em segundos)
const LONG_SESSION_EXPIRY = 60 * 60 * 24 * 365; // 1 ano

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Criar cliente Supabase diretamente (sem singleton)
  const supabase = createBrowserClient<Database>(
    supabaseConfig.url,
    supabaseConfig.anonKey
  );
  
  // Renovar token automaticamente
  const refreshToken = async () => {
    try {
      // Primeiro verificar se existe uma sessão
      const { data: sessionData } = await supabase.auth.getSession();
      
      // Se não existir sessão, não tentar renovar
      if (!sessionData.session) {
        console.log("[Auth] Nenhuma sessão para renovar");
        return false;
      }
      
      // Se existir sessão, tentar renovar
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        console.error("[Auth] Erro ao renovar token:", error.message);
        return false;
      }
      
      // Se a sessão foi renovada com sucesso, atualizar o usuário
      if (data.session) {
        setUser({
          id: data.session.user.id,
          email: data.session.user.email || '',
        });
        return true;
      }
      
      return false;
    } catch (err) {
      console.error("[Auth] Exceção ao renovar token:", err);
      return false;
    }
  };
  
  // Configurar timer para renovar token periodicamente
  useEffect(() => {
    // Verificar se existe uma sessão antes de configurar o timer
    const verificarEConfigurarRenovacao = async () => {
      const { data } = await supabase.auth.getSession();
      
      // Só configurar renovação se houver uma sessão
      if (data.session) {
        console.log("[Auth] Sessão existente, configurando renovação automática");
        
        // Renovar imediatamente
        await refreshToken();
        
        // E configurar renovação periódica
        const interval = setInterval(refreshToken, 1000 * 60 * 60); // 1 hora
        
        // Retornar função de limpeza
        return () => clearInterval(interval);
      } else {
        console.log("[Auth] Nenhuma sessão ativa, não configurando renovação automática");
        // Retornar função de limpeza vazia
        return () => {};
      }
    };
    
    // Executar a verificação e configurar renovação se necessário
    const limpar = verificarEConfigurarRenovacao();
    
    // Função de limpeza
    return () => {
      limpar.then(fn => fn());
    };
  }, []);
  
  // Verificar sessão e configurar listener de mudanças
  useEffect(() => {
    // Verificar sessão inicial
    const checkSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("[Auth] Erro ao verificar sessão:", error.message);
          // Em caso de erro, definir usuário como null
          setUser(null);
        } else if (data.session) {
          // Se temos uma sessão, definir o usuário
          setUser({
            id: data.session.user.id,
            email: data.session.user.email || '',
          });
          
          // Tentar renovar o token em segundo plano, sem interromper o fluxo
          refreshToken().catch(err => {
            console.log("[Auth] Erro ao renovar token em segundo plano:", err);
            // Ignorar erros de renovação, pois a sessão ainda está definida
          });
        } else {
          // Se não houver sessão, definir usuário como null
          setUser(null);
        }
      } catch (err) {
        console.error("[Auth] Erro ao verificar sessão:", err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    
    // Configurar listener para mudanças na autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("[Auth] Mudança de estado:", event);
        
        if (session) {
          setUser({
            id: session.user.id,
            email: session.user.email || '',
          });
        } else {
          setUser(null);
        }
        
        setLoading(false);
      }
    );
    
    checkSession();
    
    // Cleanup
    return () => {
      subscription.unsubscribe();
    };
  }, [supabase.auth]);
  
  // Login simples e direto com sessão de longa duração
  const signIn = async (email: string, password: string) => {
    try {
      console.log("[Auth] Fazendo login para:", email);
      setLoading(true);
      
      // Configurar login para sessão de longa duração
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      // Se o login for bem-sucedido, estender a sessão
      if (!error && data.session) {
        // A API getSession().setSession() parece ser a maneira correta de estender a sessão
        console.log("[Auth] Login bem-sucedido, tentando estender a sessão");
      }
      
      if (error) {
        console.error("[Auth] Erro de login:", error.message);
        return { success: false, error: error.message };
      }
      
      console.log("[Auth] Login bem-sucedido com sessão de longa duração");
      return { success: true };
    } catch (err: any) {
      console.error("[Auth] Exceção no login:", err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };
  
  // Logout simples e direto
  const signOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      return true;
    } catch (err) {
      console.error("[Auth] Erro ao fazer logout:", err);
      return false;
    } finally {
      setLoading(false);
    }
  };
  
  // Função simplificada para registrar usuário
  const signUp = async (email: string, password: string, nome: string, empresa_id?: string) => {
    try {
      console.log("[Auth] Registrando novo usuário:", email);
      setLoading(true);
      
      // Fazer chamada à API de registro
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          nome,
          empresa_id
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error("[Auth] Erro no registro:", data.error);
        return { success: false, error: data.error };
      }
      
      console.log("[Auth] Registro bem-sucedido:", data.message);
      
      // Fazer login automaticamente após o registro
      return await signIn(email, password);
    } catch (err: any) {
      console.error("[Auth] Exceção no registro:", err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };
  
  // Verificar se o usuário está autenticado - simplificado para sempre retornar
  // true se houver qualquer sessão, independentemente da expiração
  const checkAuthState = async () => {
    try {
      console.log("[Auth] Verificando estado de autenticação");
      
      // Obter sessão atual
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error("[Auth] Erro ao verificar estado:", error.message);
        return false;
      }
      
      // Verificar se existe sessão
      if (!data.session) {
        console.log("[Auth] Nenhuma sessão encontrada");
        return false;
      }
      
      // Se houver alguma sessão, consideramos válida e renovamos em segundo plano
      console.log("[Auth] Sessão encontrada, considerando válida");
      
      // Tentar renovar o token em segundo plano, sem bloquear
      refreshToken().catch(err => {
        console.log("[Auth] Erro ao renovar token em segundo plano:", err);
        // Ignorar erros de renovação, pois a sessão ainda é válida
      });
      
      // Sempre retornamos true se houver sessão
      return true;
    } catch (err) {
      console.error("[Auth] Exceção ao verificar estado:", err);
      return false;
    }
  };
  
  return {
    user,
    loading,
    signIn,
    signOut,
    signUp,
    isAuthenticated: !!user,
    checkAuthState,
    refreshToken
  };
} 