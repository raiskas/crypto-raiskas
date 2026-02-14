'use client';

import { useEffect, useState, useRef } from 'react';
import { getSupabase } from '@/lib/supabase/client';

interface UserData {
  id: string;
  nome: string;
  email: string;
  empresa_id: string | null;
  ativo: boolean | null;
}

export function useUserData() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);
  const fetchInProgress = useRef(false);

  const fetchUserData = async () => {
    // Evitar múltiplas chamadas simultâneas
    if (fetchInProgress.current || !isMounted.current) return;
    
    fetchInProgress.current = true;
    
    try {
      setLoading(true);
      setError(null);
      
      const supabase = getSupabase();
      
      // Verificar sessão atual
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw new Error(`Erro ao verificar sessão: ${sessionError.message}`);
      }
      
      if (!session?.user) {
        if (isMounted.current) {
          setUserData(null);
        }
        return;
      }
      
      // Verificar se a sessão expirou
      if (session.expires_at && new Date(session.expires_at * 1000) <= new Date()) {
        if (isMounted.current) {
          setUserData(null);
          setError("Sessão expirada");
        }
        return;
      }
      
      // Buscar dados completos do usuário no banco de dados
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome, email, empresa_id, ativo')
        .eq('auth_id', session.user.id)
        .single();
      
      if (error) {
        throw error;
      }
      
      if (!isMounted.current) return;
      
      if (data) {
        setUserData(data);
      } else {
        setUserData(null);
        setError("Usuário autenticado, mas dados não encontrados.");
      }
    } catch (error: any) {
      console.error('Erro ao buscar dados do usuário:', error);
      if (isMounted.current) {
        setError(error.message);
        setUserData(null);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
      fetchInProgress.current = false;
    }
  };

  useEffect(() => {
    isMounted.current = true;
    
    // Buscar dados apenas na montagem inicial
    fetchUserData();
    
    // Configurar listener para mudanças de autenticação
    const supabase = getSupabase();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      if (isMounted.current) {
        fetchUserData();
      }
    });
    
    return () => {
      isMounted.current = false;
      subscription?.unsubscribe();
    };
  }, []);

  return {
    userData,
    loading,
    error,
    refetch: fetchUserData
  };
} 