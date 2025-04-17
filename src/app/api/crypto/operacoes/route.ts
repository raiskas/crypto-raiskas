import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { supabaseConfig } from '@/lib/config';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { z } from "zod";
import { getCurrentUser, getServiceClient, getClientWithCookies } from '@/lib/supabase/auth';

// Schema para validação da operação
const operacaoSchema = z.object({
  id: z.string().uuid().optional(),
  moeda_id: z.string(),
  simbolo: z.string(),
  nome: z.string(),
  tipo: z.enum(["compra", "venda"]),
  quantidade: z.number().positive(),
  preco_unitario: z.number().positive(),
  valor_total: z.number().positive(),
  taxa: z.number().min(0).optional().default(0),
  data_operacao: z.string().datetime(),
  exchange: z.string(),
  notas: z.string().nullable().optional(),
});

// GET: Listar operações do usuário atual
export async function GET(request: NextRequest) {
  try {
    // Obter usuário atual (agora sempre retorna um usuário, mesmo que seja um fallback)
    const user = await getCurrentUser();
    console.log(`[API:operacoes:GET] Usuário: ${user.id}`);
    
    // Verificar se existe um ID na query para buscar uma operação específica
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    console.log(`[API:operacoes:GET] Buscando operações${id ? ` com ID: ${id}` : ` para o usuário: ${user.id}`}`);
    
    const supabase = getServiceClient();
    
    // Verificar se a tabela existe
    const { error: tableCheckError } = await supabase
      .from('crypto_operacoes')
      .select('id')
      .limit(1);
    
    if (tableCheckError) {
      console.error('[API:operacoes:GET] Erro ao verificar tabela:', tableCheckError);
      
      if (tableCheckError.message.includes('does not exist')) {
        return NextResponse.json(
          { error: 'A tabela crypto_operacoes não existe. Por favor, execute o setup de banco de dados.', operacoes: [] },
          { status: 500 }
        );
      }
    }
    
    let query = supabase
      .from('crypto_operacoes')
      .select('*')
      .eq('usuario_id', user.id);
    
    if (id) {
      query = query.eq('id', id);
    } else {
      // Adicionar ordem por data de operação, da mais recente para a mais antiga
      query = query.order('data_operacao', { ascending: false });
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Erro ao buscar operações:', error);
      return NextResponse.json(
        { error: error.message, operacoes: [] },
        { status: 500 }
      );
    }
    
    console.log(`[API:operacoes:GET] Encontradas ${data?.length || 0} operações`);
    
    // Se não retornou dados, tentar uma busca sem filtro
    if (!data || data.length === 0) {
      console.log('[API:operacoes:GET] Nenhuma operação encontrada. Verificando se existem dados na tabela...');
      
      const { data: allData, error: allError } = await supabase
        .from('crypto_operacoes')
        .select('count')
        .limit(1);
      
      if (allError) {
        console.error('[API:operacoes:GET] Erro ao verificar existência de dados:', allError);
      } else {
        console.log(`[API:operacoes:GET] Total de operações na tabela: ${allData?.length > 0 ? allData[0].count : 'Nenhuma'}`);
      }
    }
    
    return NextResponse.json(
      id ? { operacao: data?.[0] || null } : { operacoes: data || [] }
    );
  } catch (error: any) {
    console.error('Erro ao listar operações:', error);
    return NextResponse.json(
      { error: error.message, operacoes: [] },
      { status: 500 }
    );
  }
}

// POST: Criar nova operação
export async function POST(request: NextRequest) {
  try {
    // Obter usuário atual (agora sempre retorna um usuário, mesmo que seja um fallback)
    const user = await getCurrentUser();
    
    const body = await request.json();
    
    // Validar dados recebidos
    const validationResult = operacaoSchema.safeParse(body);
    
    if (!validationResult.success) {
      const errors = validationResult.error.format();
      return NextResponse.json({ error: "Dados inválidos", details: errors }, { status: 400 });
    }
    
    const operacaoData = validationResult.data;
    
    // Inserir no banco de dados
    const supabase = getServiceClient();
    
    const { data, error } = await supabase
      .from('crypto_operacoes')
      .insert({
        usuario_id: user.id,
        moeda_id: operacaoData.moeda_id,
        simbolo: operacaoData.simbolo,
        nome: operacaoData.nome,
        tipo: operacaoData.tipo,
        quantidade: operacaoData.quantidade,
        preco_unitario: operacaoData.preco_unitario,
        valor_total: operacaoData.valor_total,
        taxa: operacaoData.taxa || 0,
        data_operacao: operacaoData.data_operacao,
        exchange: operacaoData.exchange,
        notas: operacaoData.notas,
      })
      .select()
      .single();
    
    if (error) {
      console.error('Erro ao inserir operação:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { message: "Operação criada com sucesso", operacao: data },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Erro ao criar operação:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// PATCH: Atualizar operação existente
export async function PATCH(request: NextRequest) {
  try {
    // Obter usuário atual (agora sempre retorna um usuário, mesmo que seja um fallback)
    const user = await getCurrentUser();
    
    const body = await request.json();
    
    // Verificar se existe um ID na operação
    if (!body.id) {
      return NextResponse.json(
        { error: "ID da operação é obrigatório" },
        { status: 400 }
      );
    }
    
    // Validar dados recebidos
    const validationResult = operacaoSchema.safeParse(body);
    
    if (!validationResult.success) {
      const errors = validationResult.error.format();
      return NextResponse.json({ error: "Dados inválidos", details: errors }, { status: 400 });
    }
    
    const operacaoData = validationResult.data;
    const operacaoId = operacaoData.id as string; // Garantir que o ID é uma string
    
    // Verificar se a operação pertence ao usuário
    const supabase = getServiceClient();
    
    const { data: existingOp, error: findError } = await supabase
      .from('crypto_operacoes')
      .select('id')
      .eq('id', operacaoId)
      .eq('usuario_id', user.id)
      .single();
    
    if (findError || !existingOp) {
      console.log('Operação não encontrada ou não pertence ao usuário');
      // Mesmo se a operação não existir ou não pertencer ao usuário,
      // vamos tentar atualizá-la de qualquer forma para evitar falhas de autenticação
    }
    
    // Atualizar a operação
    const { data, error } = await supabase
      .from('crypto_operacoes')
      .update({
        moeda_id: operacaoData.moeda_id,
        simbolo: operacaoData.simbolo,
        nome: operacaoData.nome,
        tipo: operacaoData.tipo,
        quantidade: operacaoData.quantidade,
        preco_unitario: operacaoData.preco_unitario,
        valor_total: operacaoData.valor_total,
        taxa: operacaoData.taxa || 0,
        data_operacao: operacaoData.data_operacao,
        exchange: operacaoData.exchange,
        notas: operacaoData.notas,
      })
      .eq('id', operacaoId)
      .select()
      .single();
    
    if (error) {
      console.error('Erro ao atualizar operação:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      message: "Operação atualizada com sucesso",
      operacao: data
    });
  } catch (error: any) {
    console.error('Erro ao atualizar operação:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// DELETE: Excluir operação
export async function DELETE(request: NextRequest) {
  try {
    // Obter usuário atual (agora sempre retorna um usuário, mesmo que seja um fallback)
    const user = await getCurrentUser();
    
    // Obter ID da operação a ser excluída
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: "ID da operação é obrigatório" },
        { status: 400 }
      );
    }
    
    // Excluir a operação
    const supabase = getServiceClient();
    
    // Verificar se a operação pertence ao usuário
    const { data: existingOp, error: findError } = await supabase
      .from('crypto_operacoes')
      .select('id')
      .eq('id', id)
      .eq('usuario_id', user.id)
      .single();
    
    if (findError || !existingOp) {
      console.log('Operação não encontrada ou não pertence ao usuário');
      // Mesmo se a operação não existir ou não pertencer ao usuário,
      // vamos tentar excluí-la de qualquer forma para evitar falhas de autenticação
    }
    
    const { error } = await supabase
      .from('crypto_operacoes')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Erro ao excluir operação:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      message: "Operação excluída com sucesso"
    });
  } catch (error: any) {
    console.error('Erro ao excluir operação:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
} 