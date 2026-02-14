import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      operations: {
        Row: {
          id: string;
          user_id: string;
          crypto_id: string;
          crypto_name: string;
          operation_type: 'buy' | 'sell';
          amount: number;
          price: number;
          total_value: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          crypto_id: string;
          crypto_name: string;
          operation_type: 'buy' | 'sell';
          amount: number;
          price: number;
          total_value: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          crypto_id?: string;
          crypto_name?: string;
          operation_type?: 'buy' | 'sell';
          amount?: number;
          price?: number;
          total_value?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      portfolio: {
        Row: {
          id: string;
          user_id: string;
          crypto_id: string;
          crypto_name: string;
          amount: number;
          average_price: number;
          total_invested: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          crypto_id: string;
          crypto_name: string;
          amount?: number;
          average_price?: number;
          total_invested?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          crypto_id?: string;
          crypto_name?: string;
          amount?: number;
          average_price?: number;
          total_invested?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}; 