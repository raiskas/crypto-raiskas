import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server'; // Assumindo que esta função existe e funciona

// Lista base de IDs (Top 10 da CoinGecko - pode ser atualizada)
const BASE_COIN_IDS = [
  'bitcoin', 'ethereum', 'tether', 'ripple', 'binancecoin', 
  'solana', 'usd-coin', 'dogecoin', 'cardano', 'tron'
];

export async function GET() {
  console.log('[API /relevant-coin-ids] Recebida requisição GET');
  try {
    const supabase = await createServerSupabaseClient();

    // 1. Obter ID do usuário autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[API /relevant-coin-ids] Erro de autenticação:', authError);
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 });
    }
    const userId = user.id;
    console.log(`[API /relevant-coin-ids] Usuário autenticado: ${userId}`);

    // 2. Buscar IDs distintos das operações do usuário
    // Precisamos buscar o ID do usuário na nossa tabela 'usuarios' a partir do auth_id
    const { data: userData, error: userError } = await supabase
      .from('usuarios')
      .select('id')
      .eq('auth_id', userId)
      .single();

    if (userError || !userData) {
      console.error(`[API /relevant-coin-ids] Erro ao buscar usuário na tabela 'usuarios' para auth_id ${userId}:`, userError);
      return NextResponse.json({ error: 'Usuário não encontrado no sistema' }, { status: 404 });
    }
    const appUserId = userData.id;
    console.log(`[API /relevant-coin-ids] ID do usuário na tabela 'usuarios': ${appUserId}`);

    const { data: operacoesIds, error: operacoesError } = await supabase
      .from('crypto_operacoes')
      .select('moeda_id') // Seleciona apenas a coluna moeda_id
      .eq('usuario_id', appUserId); // Filtra pelo ID do usuário da tabela 'usuarios'
      // Não precisamos de distinct aqui ainda, vamos tratar no código

    if (operacoesError) {
      console.error('[API /relevant-coin-ids] Erro ao buscar IDs de operações:', operacoesError);
      throw new Error('Erro ao buscar operações do usuário');
    }

    const userCoinIds = operacoesIds 
                        ? [...new Set(operacoesIds.map(op => op.moeda_id))] 
                        : []; // Usa Set para garantir IDs únicos
    console.log(`[API /relevant-coin-ids] IDs das moedas do usuário:`, userCoinIds);

    // 3. Combinar com a lista base e garantir unicidade
    const combinedIds = [...new Set([...BASE_COIN_IDS, ...userCoinIds])];
    console.log(`[API /relevant-coin-ids] IDs combinados e únicos:`, combinedIds);

    // 4. Retornar a lista de IDs
    return NextResponse.json(combinedIds);

  } catch (error: unknown) {
    console.error('[API /relevant-coin-ids] Exceção:', error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno ao buscar IDs de moedas relevantes.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// Adicionar configuração para garantir que não seja cacheado estaticamente
export const dynamic = 'force-dynamic'; 