import { NextRequest, NextResponse } from "next/server";
// import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'; // <<< REMOVER IMPORT ANTIGO
import { createServerClient, type CookieOptions } from '@supabase/ssr'; // <<< IMPORTAR NOVO HELPER
import { cookies } from 'next/headers';
import { calcularPerformanceFifo, PerformanceMetrics } from "@/lib/crypto/fifoCalculations";
import { Operacao } from "@/types/crypto";
import { fetchMarketDataByIds } from "@/lib/coingecko";
import { Database } from "@/types/supabase"; // <<< IMPORTAR TIPOS DO DATABASE

export async function GET(request: NextRequest) {
  // <<< Criar response inicial para poder manipular cookies >>>
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  try {
    console.log("[API /crypto/performance] Recebida requisição GET");

    const cookieStore = cookies();

    // <<< LOGAR COOKIES RECEBIDOS (Manter para debug por enquanto) >>>
    // console.log("[API /crypto/performance] Cookies recebidos (pre-ssr):", JSON.stringify(cookieStore.getAll()));
    // <<< FIM LOG >>>

    // <<< Criar cliente usando createServerClient (SSR) >>>
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            // Se precisar definir um cookie (ex: refresh token), faça no cookieStore e na response
            try {
              cookieStore.set({ name, value, ...options });
              response.cookies.set({ name, value, ...options }); // <<< Adicionar na response também
            } catch (error) {
              // O cookieStore só pode ser modificado em Server Actions/Route Handlers, ignorar erro em outros casos
              // console.warn(`[API /crypto/performance] Falha ao definir cookie '${name}' no cookieStore (ignorado)`);
            }
          },
          remove(name: string, options: CookieOptions) {
             // Se precisar remover um cookie, faça no cookieStore e na response
             try {
               cookieStore.set({ name, value: '', ...options });
               response.cookies.set({ name, value: '', ...options }); // <<< Adicionar na response também
            } catch (error) {
               // console.warn(`[API /crypto/performance] Falha ao remover cookie '${name}' do cookieStore (ignorado)`);
            }
          },
        },
      }
    );

    // <<< Obter usuário usando o NOVO cliente (createServerClient) >>>
    const { data: { user }, error: sessionError } = await supabase.auth.getUser();

    if (sessionError || !user) {
      console.error("[API /crypto/performance] Erro de autenticação (SSR Client):"); // <<< Atualizar log
      if (sessionError) console.error(sessionError.message);
      // <<< Retornar response com status 401, NÃO a response inicial >>>
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const authUserId = user.id;
    console.log(`[API /crypto/performance] [LOG DEBUG] Usuário autenticado (Auth ID): ${authUserId}`);

    // <<< ETAPA EXTRA: Buscar ID interno do usuário na tabela 'usuarios' >>>
    console.log(`[API /crypto/performance] [LOG DEBUG] Buscando ID interno para Auth ID: ${authUserId}`);
    const { data: userData, error: userDbError } = await supabase
      .from('usuarios')
      .select('id') // Seleciona apenas o ID interno
      .eq('auth_id', authUserId)
      .single(); // Espera encontrar exatamente um usuário

    if (userDbError || !userData) {
      console.error(`[API /crypto/performance] Erro ao buscar usuário interno (auth_id: ${authUserId}):`, userDbError?.message);
      // Pode ser um erro 500 ou talvez 404 se o perfil não existe
      return NextResponse.json({ error: "Usuário não encontrado no sistema interno." }, { status: 404 }); 
    }
    
    const internalUserId = userData.id;
    console.log(`[API /crypto/performance] [LOG DEBUG] ID interno encontrado: ${internalUserId}`);
    // <<< FIM ETAPA EXTRA >>>

    // Usar o ID INTERNO na consulta de operações
    console.log(`[API /crypto/performance] [LOG DEBUG] Buscando operações para usuario_id (interno) = ${internalUserId}`); 
    const { data: operacoesData, error: operacoesError } = await supabase
      .from('crypto_operacoes')
      .select('*')
      .eq('usuario_id', internalUserId) // <<< USAR ID INTERNO AQUI >>>
      .order('data_operacao', { ascending: true });

     if (operacoesError) {
       console.error("[API /crypto/performance] Erro ao buscar operações:", operacoesError.message);
       throw new Error("Erro ao buscar operações de cripto.");
     }

    console.log(`[API /crypto/performance] [LOG DEBUG] Operações brutas encontradas (DB): ${operacoesData?.length ?? 0}`); 

    // Definir um tipo para os dados brutos do DB (ou usar any)
    type DbOperacao = { [key: string]: any };

    // Garantir que os dados correspondem ao tipo Operacao, especialmente a coluna 'tipo'
    const operacoes: Operacao[] = ((operacoesData as DbOperacao[]) || []).map((op: DbOperacao): Operacao => ({ // <<< Mapear explicitamente para Operacao
      id: op.id,
      moeda_id: op.moeda_id,
      simbolo: op.simbolo,
      nome: op.nome,
      tipo: op.tipo as "compra" | "venda", // Validar se 'tipo' é realmente "compra" ou "venda"
      quantidade: Number(op.quantidade),
      preco_unitario: Number(op.preco_unitario),
      valor_total: Number(op.valor_total),
      taxa: Number(op.taxa ?? 0), // Usar ?? 0 para taxa opcional
      data_operacao: op.data_operacao,
      exchange: op.exchange,
      notas: op.notas,
      criado_em: op.criado_em,
      atualizado_em: op.atualizado_em,
      usuario_id: op.usuario_id, // Mantém o ID interno aqui no objeto final
      grupo_id: op.grupo_id // Adicionar se existir no DB
    })).filter(op => {
        const isValidType = op.tipo === 'compra' || op.tipo === 'venda';
        // if (!isValidType) console.warn(`[API /crypto/performance] [LOG DEBUG] Operação filtrada por tipo inválido:`, op); // Log opcional para tipos inválidos
        return isValidType;
    });

    console.log(`[API /crypto/performance] [LOG DEBUG] Operações mapeadas e filtradas: ${operacoes.length}`); // <<< LOG OPERACOES MAPEADAS

    if (operacoes.length === 0) {
       console.log("[API /crypto/performance] [LOG DEBUG] Nenhuma operação válida encontrada após mapeamento/filtragem. Retornando vazio."); // <<< LOG VAZIO
      // <<< Retornar response com status 200 >>>
      return NextResponse.json({ performance: {}, summary: { totalRealizado: 0, totalNaoRealizado: 0, valorTotalAtual: 0 } }, { status: 200 });
    }

    // Agrupar operações por moeda_id
    const operacoesPorMoeda: { [key: string]: Operacao[] } = {};
    const allMoedaIds = new Set<string>();
    for (const op of operacoes) {
      if (!operacoesPorMoeda[op.moeda_id]) {
        operacoesPorMoeda[op.moeda_id] = [];
      }
      operacoesPorMoeda[op.moeda_id].push(op);
      allMoedaIds.add(op.moeda_id);
    }
    console.log(`[API /crypto/performance] [LOG DEBUG] Operações agrupadas por ${allMoedaIds.size} moedas.`);

    // Buscar preços atuais para todas as moedas envolvidas
    // NOTA: fetchMarketDataByIds provavelmente não precisa de autenticação, mas se precisasse,
    // teria que ser adaptado ou chamado pelo frontend.
     console.log(`[API /crypto/performance] [LOG DEBUG] Buscando dados de mercado para IDs: ${Array.from(allMoedaIds).join(', ')}`); // <<< LOG ANTES COINGECKO
    const marketDataMap = await fetchMarketDataByIds(Array.from(allMoedaIds));
    console.log(`[API /crypto/performance] [LOG DEBUG] Dados de mercado recebidos:`, marketDataMap); // <<< LOG DADOS COINGECKO
    console.log(`[API /crypto/performance] Dados de mercado buscados para ${Object.keys(marketDataMap).length} moedas.`);

    // Calcular performance para cada moeda
    const performancePorMoeda: { [key: string]: PerformanceMetrics } = {};
    let totalRealizadoGeral = 0;
    let totalNaoRealizadoGeral = 0;
    let valorTotalDeMercadoGeral = 0;

    for (const moedaId of allMoedaIds) {
      const precoAtual = marketDataMap[moedaId]?.current_price ?? 0;
      if (precoAtual === 0) {
        console.warn(`[API /crypto/performance] Preço atual não encontrado para ${moedaId}. Cálculo de P/L não realizado será 0.`);
      }
      
      // <<< GARANTIR CÓPIA PROFUNDA DAS OPERAÇÕES AO CHAMAR A FUNÇÃO >>>
      // Isso cria uma cópia completamente nova dos objetos de operação para garantir isolamento total
      // entre os cálculos de diferentes moedas, prevenindo mutações inesperadas.
      const operacoesCopiaProfunda = JSON.parse(JSON.stringify(operacoesPorMoeda[moedaId]));

      const performance = calcularPerformanceFifo(operacoesCopiaProfunda, precoAtual);
      performancePorMoeda[moedaId] = performance;

      // Acumular totais gerais
      totalRealizadoGeral += performance.lucroPrejuizoRealizadoTotal;
      totalNaoRealizadoGeral += performance.lucroPrejuizoNaoRealizado;
      valorTotalDeMercadoGeral += performance.valorDeMercadoAtual;
    }

    console.log("[API /crypto/performance] Cálculos FIFO concluídos.");

    // <<< LOG ANTES DE RETORNAR >>>
    const summary = {
        totalRealizado: totalRealizadoGeral,
        totalNaoRealizado: totalNaoRealizadoGeral,
        valorTotalAtual: valorTotalDeMercadoGeral,
      };
    console.log(`[API /crypto/performance] [LOG DEBUG] Dados a serem retornados:`, { performance: performancePorMoeda, summary });
    // <<< FIM LOG >>>

    // Retornar os resultados na response final
    // <<< Retornar response com status 200 >>>
    return NextResponse.json({
      performance: performancePorMoeda,
      summary: summary
    }, { status: 200 });

  } catch (error: any) {
    console.error("[API /crypto/performance] Erro inesperado:", error.message, error.stack); // Logar stack trace também
    // <<< Retornar response com status 500 >>>
    return NextResponse.json({ error: error.message || "Erro interno do servidor" }, { status: 500 });
  }
} 