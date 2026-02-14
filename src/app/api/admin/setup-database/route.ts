import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from '@/lib/config';

// Endpoint para inicializar o banco de dados - acessível sem autenticação
export async function GET(request: NextRequest) {
  try {
    console.log('[Setup] Iniciando configuração do banco de dados');
    
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
    
    console.log('[Setup] Verificando se a tabela crypto_operacoes existe');
    
    // Verificar se a tabela crypto_operacoes já existe
    const { data: tableExists, error: tableError } = await supabase
      .from('crypto_operacoes')
      .select('id')
      .limit(1);
    
    // Mapear o erro para melhor diagnóstico
    if (tableError) {
      console.error('[Setup] Erro ao verificar tabela:', tableError);
      
      if (tableError.message.includes('does not exist')) {
        console.log('[Setup] A tabela não existe e será criada');
      } else {
        // Outros tipos de erros
        console.error('[Setup] Erro inesperado ao verificar tabela:', tableError);
      }
    } else {
      console.log('[Setup] Tabela crypto_operacoes já existe');
      return NextResponse.json(
        { message: "Tabela crypto_operacoes já existe", success: true }
      );
    }
    
    console.log('[Setup] Criando tabela crypto_operacoes');
    
    // Definir SQL para criar a tabela
    const createTableSQL = `
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
    `;
    
    // Tentar executar SQL diretamente usando RPC
    const { error: sqlError } = await supabase.rpc('execute_sql', {
      sql_string: createTableSQL
    });
    
    if (sqlError) {
      console.error('[Setup] Erro ao executar SQL via RPC:', sqlError);
      
      // Verificar se o erro é porque a função execute_sql não existe
      if (sqlError.message.includes('function') && sqlError.message.includes('does not exist')) {
        console.log('[Setup] A função execute_sql não existe no banco de dados');
      }
      
      // Tentar uma abordagem alternativa via REST API
      console.log('[Setup] Tentando criar tabela via REST API');
      
      const response = await fetch('/api/admin/create-tables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tables: ['crypto_operacoes']
        })
      });
      
      if (!response.ok) {
        console.error('[Setup] Erro ao criar tabela via endpoint:', await response.text());
        
        return NextResponse.json(
          { 
            error: "Não foi possível criar a tabela automaticamente",
            message: "Por favor, execute o script SQL manualmente no seu banco de dados Supabase." 
          },
          { status: 500 }
        );
      }
      
      console.log('[Setup] Resposta da criação da tabela via endpoint:', await response.text());
      
      // Verificar novamente se a tabela foi criada
      const { error: checkError } = await supabase
        .from('crypto_operacoes')
        .select('id')
        .limit(1);
      
      if (checkError) {
        console.error('[Setup] Tabela ainda não existe após tentativas:', checkError);
        
        return NextResponse.json(
          { 
            error: "Não foi possível criar a tabela automaticamente",
            message: "Por favor, verifique seu banco de dados e a função execute_sql." 
          },
          { status: 500 }
        );
      }
      
      console.log('[Setup] Tabela criada com sucesso!');
      return NextResponse.json({
        message: "Tabela crypto_operacoes criada com sucesso!",
        success: true
      });
    }
    
    console.log('[Setup] Tabela crypto_operacoes criada com sucesso via RPC!');
    return NextResponse.json({
      message: "Configuração do banco de dados concluída com sucesso",
      success: true
    });
  } catch (error: any) {
    console.error('[Setup] Erro na configuração do banco de dados:', error);
    
    return NextResponse.json(
      { 
        error: error.message || "Erro na configuração do banco de dados",
        message: "Verifique os logs do servidor para mais detalhes."
      },
      { status: 500 }
    );
  }
} 