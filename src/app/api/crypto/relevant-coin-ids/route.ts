import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
// <<< CORRIGIR IMPORT: Gerar tipos com `supabase gen types typescript --local > src/lib/database.types.ts` ou ajustar caminho >>>
import { Database } from '@/lib/database.types'; 
import { createServerClient, type CookieOptions } from '@supabase/ssr'

// Lista base de IDs (Top 10 da CoinGecko - pode ser atualizada)
const BASE_COIN_IDS = [
  'bitcoin', 'ethereum', 'tether', 'ripple', 'binancecoin', 
  'solana', 'usd-coin', 'dogecoin', 'cardano', 'tron'
];

export async function GET() {
  console.log('[API /relevant-coin-ids] Recebida requisição GET');
  try {
    const cookieStore = cookies();
    console.log('[API /relevant-coin-ids] Cookies recebidos:', JSON.stringify(cookieStore.getAll()));

    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          // NOTA: set e remove podem não ser estritamente necessários em uma API GET,
          // mas incluí-los para completude e caso a biblioteca os utilize internamente.
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.delete({ name, ...options })
          },
        },
      }
    )

    // 1. Obter ID do usuário autenticado (a partir dos cookies)
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[API /relevant-coin-ids] Erro de autenticação:', authError);
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 });
    }
    const authUserId = user.id; // <<< Renomear para clareza (ID de autenticação)
    console.log(`[API /relevant-coin-ids] Usuário autenticado (Auth ID): ${authUserId}`);

    // 2. Buscar ID do usuário na tabela 'usuarios'
    const { data: userData, error: userError } = await supabase
      .from('usuarios')
      .select('id')
      .eq('auth_id', authUserId) // <<< Usar authUserId aqui
      .single();

    if (userError || !userData) {
      console.error(`[API /relevant-coin-ids] Erro ao buscar usuário na tabela 'usuarios' para auth_id ${authUserId}:`, userError);
      // Retornar 404 se o usuário autenticado não existir na nossa tabela 'usuarios'
      return NextResponse.json({ error: 'Usuário autenticado não encontrado no sistema' }, { status: 404 });
    }
    const appUserId = userData.id; // <<< ID da tabela 'usuarios'
    console.log(`[API /relevant-coin-ids] ID do usuário na tabela 'usuarios': ${appUserId}`);

    // 3. Buscar IDs distintos das operações do usuário
    const { data: operacoesIds, error: operacoesError } = await supabase
      .from('crypto_operacoes')
      .select('moeda_id')
      .eq('usuario_id', appUserId); // <<< Usar appUserId (ID da tabela 'usuarios')

    if (operacoesError) {
      console.error('[API /relevant-coin-ids] Erro ao buscar IDs de operações:', operacoesError);
      throw new Error('Erro ao buscar operações do usuário');
    }

    const userCoinIds = operacoesIds
                        ? [...new Set(operacoesIds.map(op => op.moeda_id))]
                        : [];
    console.log(`[API /relevant-coin-ids] IDs das moedas do usuário:`, userCoinIds);

    // 4. Combinar com a lista base e garantir unicidade
    const combinedIds = [...new Set([...BASE_COIN_IDS, ...userCoinIds])];
    console.log(`[API /relevant-coin-ids] IDs combinados e únicos:`, combinedIds);

    // 5. Retornar a lista de IDs
    return NextResponse.json(combinedIds);

  } catch (error: unknown) {
    console.error('[API /relevant-coin-ids] Exceção:', error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno ao buscar IDs de moedas relevantes.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// Adicionar configuração para garantir que não seja cacheado estaticamente
export const dynamic = 'force-dynamic'; 