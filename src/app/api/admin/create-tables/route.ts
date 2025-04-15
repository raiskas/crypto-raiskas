import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from '@/lib/config';
import { getCurrentUser } from '../../crypto/operacoes/route';

// Interface para os resultados de criação de tabelas
interface TableResults {
  [key: string]: {
    status: 'exists' | 'created' | 'error' | 'unknown' | 'not_supported';
    message: string;
    error?: string;
  };
}

// Endpoint para criar tabelas necessárias no Supabase
export async function POST(request: NextRequest) {
  try {
    console.log('[Admin:create-tables] Iniciando criação de tabelas');
    
    // Verificar se o usuário está autenticado
    const user = await getCurrentUser();
    
    if (!user) {
      console.log('[Admin:create-tables] Usuário não autenticado');
      return NextResponse.json(
        { error: "Você precisa estar autenticado para criar tabelas" },
        { status: 401 }
      );
    }
    
    // Obter array de tabelas a serem criadas
    const body = await request.json();
    const tables = body.tables || ['crypto_operacoes']; // Default para crypto_operacoes
    
    console.log(`[Admin:create-tables] Tabelas a serem criadas: ${tables.join(', ')}`);
    
    // Criar cliente do Supabase com a chave de serviço
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
    
    const results: TableResults = {};
    
    // Processar cada tabela solicitada
    for (const table of tables) {
      if (table === 'crypto_operacoes') {
        console.log('[Admin:create-tables] Verificando se a tabela crypto_operacoes existe');
        
        // Verificar se a tabela crypto_operacoes já existe
        const { data: tableExists, error: tableError } = await supabase
          .from('crypto_operacoes')
          .select('id')
          .limit(1);
        
        // Se não houver erro, a tabela já existe
        if (!tableError) {
          console.log('[Admin:create-tables] Tabela crypto_operacoes já existe');
          results['crypto_operacoes'] = { status: 'exists', message: 'Tabela já existe' };
          continue;
        }
        
        console.log('[Admin:create-tables] Criando tabela crypto_operacoes');
        
        // Tentar criar diretamente com SQL
        const { error: sqlError } = await supabase.rpc('execute_sql', {
          sql_string: `
            CREATE TABLE IF NOT EXISTS crypto_operacoes (
              id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
              usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
              moeda_id VARCHAR(100) NOT NULL,
              simbolo VARCHAR(20) NOT NULL,
              nome VARCHAR(100) NOT NULL,
              tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('compra', 'venda')),
              quantidade DECIMAL(24, 8) NOT NULL,
              preco_unitario DECIMAL(18, 2) NOT NULL,
              valor_total DECIMAL(18, 2) NOT NULL,
              taxa DECIMAL(18, 2) NOT NULL DEFAULT 0,
              data_operacao TIMESTAMP WITH TIME ZONE NOT NULL,
              exchange VARCHAR(100),
              notas TEXT,
              criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            
            CREATE INDEX IF NOT EXISTS idx_crypto_operacoes_usuario_id ON crypto_operacoes(usuario_id);
            CREATE INDEX IF NOT EXISTS idx_crypto_operacoes_moeda_id ON crypto_operacoes(moeda_id);
            CREATE INDEX IF NOT EXISTS idx_crypto_operacoes_data ON crypto_operacoes(data_operacao);
          `
        });
        
        if (sqlError) {
          console.error('[Admin:create-tables] Erro ao executar SQL diretamente:', sqlError);
          results['crypto_operacoes'] = { 
            status: 'error', 
            message: 'Erro ao criar tabela', 
            error: sqlError.message 
          };
          continue;
        }
        
        // Verificar se a tabela foi realmente criada
        const { error: checkError } = await supabase
          .from('crypto_operacoes')
          .select('id')
          .limit(1);
        
        if (checkError) {
          console.error('[Admin:create-tables] Falha ao verificar se a tabela foi criada:', checkError);
          results['crypto_operacoes'] = { 
            status: 'unknown', 
            message: 'Falha ao verificar criação da tabela',
            error: checkError.message 
          };
        } else {
          console.log('[Admin:create-tables] Tabela crypto_operacoes criada com sucesso');
          results['crypto_operacoes'] = { status: 'created', message: 'Tabela criada com sucesso' };
        }
      } else {
        results[table] = { status: 'not_supported', message: 'Tabela não suportada' };
      }
    }
    
    return NextResponse.json({
      message: "Processo de criação de tabelas concluído",
      results: results
    });
  } catch (error: any) {
    console.error('[Admin:create-tables] Erro ao criar tabelas:', error);
    return NextResponse.json(
      { error: error.message || "Erro interno ao criar tabelas" },
      { status: 500 }
    );
  }
} 