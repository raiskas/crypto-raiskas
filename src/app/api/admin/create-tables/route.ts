import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from '@/lib/config';
import { getCurrentUser } from '@/lib/supabase/auth';

// Interface para os resultados de criação de tabelas
interface TableResult {
  tableName: string;
  success: boolean;
  error?: string;
}

// GET: Criar tabelas necessárias
export async function GET(request: NextRequest) {
  try {
    // Verificar se o usuário é admin
    const user = await getCurrentUser();
    console.log(`[Admin:create-tables] Usuário: ${user.id}`);
    
    if (!user || !user.ativo) {
      return NextResponse.json(
        { error: "Acesso negado. Usuário não autorizado." },
        { status: 403 }
      );
    }
    
    // Lista de tabelas a serem criadas
    const tables = ['crypto_operacoes'];
    
    // Resultados da criação
    const results: TableResult[] = [];
    
    // Criar cada tabela
    for (const table of tables) {
      if (table === 'crypto_operacoes') {
        // Verificar se a tabela já existe
        const supabase = createClient(
          supabaseConfig.url,
          supabaseConfig.serviceRoleKey,
          {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
            },
          }
        );
        
        const { error: tableError } = await supabase
          .from('crypto_operacoes')
          .select('id')
          .limit(1);
        
        if (!tableError) {
          console.log('[Admin:create-tables] Tabela crypto_operacoes já existe');
          results.push({ tableName: 'crypto_operacoes', success: true });
          continue;
        }
        
        // SQL para criar a tabela
        const createTableSQL = `
          CREATE TABLE IF NOT EXISTS crypto_operacoes (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            usuario_id UUID NOT NULL REFERENCES usuarios(id),
            moeda_id TEXT NOT NULL,
            simbolo TEXT NOT NULL,
            nome TEXT NOT NULL,
            tipo TEXT NOT NULL CHECK (tipo IN ('compra', 'venda')),
            quantidade DECIMAL NOT NULL,
            preco_unitario DECIMAL NOT NULL,
            valor_total DECIMAL NOT NULL,
            taxa DECIMAL DEFAULT 0,
            data_operacao TIMESTAMP WITH TIME ZONE NOT NULL,
            exchange TEXT NOT NULL,
            notas TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `;
        
        // Executar SQL diretamente
        const { error: sqlError } = await supabase.rpc('exec_sql', { sql: createTableSQL });
        
        if (sqlError) {
          console.error('[Admin:create-tables] Erro ao executar SQL diretamente:', sqlError);
          results.push({ 
            tableName: 'crypto_operacoes', 
            success: false, 
            error: sqlError.message 
          });
          continue;
        }
        
        // Verificar se a tabela foi criada
        const { error: checkError } = await supabase
          .from('crypto_operacoes')
          .select('id')
          .limit(1);
        
        if (checkError) {
          console.error('[Admin:create-tables] Falha ao verificar se a tabela foi criada:', checkError);
          results.push({ 
            tableName: 'crypto_operacoes', 
            success: false, 
            error: checkError.message 
          });
        } else {
          console.log('[Admin:create-tables] Tabela crypto_operacoes criada com sucesso');
          results.push({ tableName: 'crypto_operacoes', success: true });
        }
      } else {
        results.push({ 
          tableName: table, 
          success: false, 
          error: 'Tabela não suportada' 
        });
      }
    }
    
    return NextResponse.json({ results });
  } catch (error: any) {
    console.error('[Admin:create-tables] Erro ao criar tabelas:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
} 