import { supabase } from './supabase';
import type { Database } from './supabase';

type Operation = Database['public']['Tables']['operations']['Insert'];
type Portfolio = Database['public']['Tables']['portfolio']['Insert'];

export const createOperation = async (operation: Operation) => {
  const { data, error } = await supabase
    .from('operations')
    .insert(operation)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updatePortfolio = async (portfolio: Portfolio) => {
  const { data, error } = await supabase
    .from('portfolio')
    .upsert(portfolio, {
      onConflict: 'user_id,crypto_id',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getPortfolio = async (userId: string) => {
  const { data, error } = await supabase
    .from('portfolio')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;
  return data;
};

export const getOperations = async (userId: string) => {
  const { data, error } = await supabase
    .from('operations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

export const calculatePortfolioValue = async (userId: string) => {
  const portfolio = await getPortfolio(userId);
  const operations = await getOperations(userId);

  const totalInvested = portfolio.reduce(
    (acc, item) => acc + item.total_invested,
    0
  );

  const totalOperations = operations.reduce(
    (acc, item) => acc + item.total_value,
    0
  );

  return {
    totalInvested,
    totalOperations,
    profit: totalOperations - totalInvested,
    profitPercentage: totalInvested > 0 ? ((totalOperations - totalInvested) / totalInvested) * 100 : 0,
  };
}; 