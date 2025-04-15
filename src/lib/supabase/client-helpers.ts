'use client';

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { getSupabase } from './client';

/**
 * Retorna uma instância do cliente Supabase para o navegador
 * Usa o cliente já existente para consistência
 */
export function createClientSupabaseClient() {
  return getSupabase();
}

/**
 * Busca dados do usuário logado a partir do ID de autenticação
 */
export async function getUserData(authId: string) {
  try {
    const client = createClientSupabaseClient();
    
    // Buscar na tabela de usuários
    const { data, error } = await client
      .from('usuarios')
      .select('id, nome, email, empresa_id')
      .eq('auth_id', authId)
      .single();
    
    if (error) {
      console.error('Erro ao buscar dados do usuário:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Exceção ao buscar dados do usuário:', error);
    return null;
  }
}

/**
 * Busca dados da empresa a partir do ID
 */
export async function getCompanyData(empresaId: string) {
  try {
    const client = createClientSupabaseClient();
    
    // Buscar na tabela de empresas
    const { data, error } = await client
      .from('empresas')
      .select('id, nome')
      .eq('id', empresaId)
      .single();
    
    if (error) {
      console.error('Erro ao buscar dados da empresa:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Exceção ao buscar dados da empresa:', error);
    return null;
  }
} 