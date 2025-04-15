#!/usr/bin/env node

/**
 * Script para inicializar o banco de dados do Supabase
 * Executa o script SQL para criar as tabelas e inserir dados iniciais
 * 
 * Uso:
 * 1. Configure as variáveis de ambiente .env.local com suas credenciais Supabase
 * 2. Execute: node scripts/init-db.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Verificar variáveis de ambiente
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Erro: Variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são necessárias');
  process.exit(1);
}

// Criar cliente Supabase com chave de serviço
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Ler arquivo SQL
const sqlPath = path.join(__dirname, '..', 'supabase-schema.sql');
const sqlContent = fs.readFileSync(sqlPath, 'utf8');

// Dividir o conteúdo SQL em instruções individuais
const sqlStatements = sqlContent.split(';')
  .map(statement => statement.trim())
  .filter(statement => statement.length > 0);

// Função para executar o script SQL
async function initializeDatabase() {
  console.log('Inicializando banco de dados Supabase...');
  console.log(`Total de instruções SQL a serem executadas: ${sqlStatements.length}`);

  // Executar cada instrução separadamente
  for (let i = 0; i < sqlStatements.length; i++) {
    const statement = sqlStatements[i] + ';'; // Adicionar o ponto e vírgula de volta
    
    try {
      console.log(`Executando instrução ${i + 1}/${sqlStatements.length}`);
      const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
      
      if (error) {
        console.error(`Erro na instrução ${i + 1}:`, error.message);
        console.error('SQL:', statement);
      }
    } catch (error) {
      console.error(`Erro na instrução ${i + 1}:`, error.message);
      console.error('SQL:', statement);
    }
  }

  console.log('Inicialização do banco de dados concluída!');
}

// Executar a inicialização
initializeDatabase()
  .catch(error => {
    console.error('Erro ao inicializar banco de dados:', error);
    process.exit(1);
  }); 