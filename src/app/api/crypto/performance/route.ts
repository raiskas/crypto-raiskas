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

    const carteiraIdParam = request.nextUrl.searchParams.get("carteira_id");
    const supabaseAny: any = supabase;

    // Buscar carteira ativa/principal (se o schema de carteira existir)
    let carteiraSelecionada: any = null;
    let hasCarteiraSchema = true;
    let carteiraWarning: string | null = null;
    let totalAportes = 0;

    try {
      let carteiraQuery = supabaseAny
        .from("crypto_carteiras")
        .select("*")
        .eq("usuario_id", internalUserId)
        .eq("ativo", true);

      if (carteiraIdParam) {
        carteiraQuery = carteiraQuery.eq("id", carteiraIdParam);
      }

      const { data: carteiraData, error: carteiraError } = await carteiraQuery
        .order("criado_em", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (carteiraError) {
        if (carteiraError.code === "42P01") {
          hasCarteiraSchema = false;
          carteiraWarning =
            "Schema de carteira não encontrado. Execute a migração SQL para ativar caixa + ativos.";
        } else {
          carteiraWarning = `Falha ao consultar carteira: ${carteiraError.message}`;
        }
      } else if (carteiraData) {
        carteiraSelecionada = carteiraData;
      }
    } catch (e: any) {
      hasCarteiraSchema = false;
      carteiraWarning =
        e?.message || "Falha ao consultar carteira. Fluxo seguirá em modo legado.";
    }

    if (hasCarteiraSchema && carteiraSelecionada?.id) {
      try {
        const { data: aportesData, error: aportesError } = await supabaseAny
          .from("crypto_carteira_aportes")
          .select("valor")
          .eq("carteira_id", carteiraSelecionada.id);

        if (aportesError) {
          if (aportesError.code === "42P01") {
            carteiraWarning = [carteiraWarning, "Tabela de aportes não encontrada."].filter(Boolean).join(" | ");
          } else {
            carteiraWarning = [carteiraWarning, `Falha ao ler aportes: ${aportesError.message}`]
              .filter(Boolean)
              .join(" | ");
          }
        } else {
          totalAportes = (aportesData || []).reduce((acc: number, row: any) => acc + Number(row.valor || 0), 0);
        }
      } catch (e: any) {
        carteiraWarning = [carteiraWarning, e?.message || "Falha ao processar aportes."].filter(Boolean).join(" | ");
      }
    }

    // Usar o ID INTERNO na consulta de operações
    console.log(`[API /crypto/performance] [LOG DEBUG] Buscando operações para usuario_id (interno) = ${internalUserId}`); 
    let operacoesQuery = supabase
      .from('crypto_operacoes')
      .select('*')
      .eq('usuario_id', internalUserId);

    if (hasCarteiraSchema && carteiraSelecionada?.id) {
      operacoesQuery = operacoesQuery.eq("carteira_id", carteiraSelecionada.id);
    }

    const { data: operacoesData, error: operacoesError } = await operacoesQuery
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
      const valorInicial = Number(carteiraSelecionada?.valor_inicial ?? 0);
      const capitalTotal = valorInicial + totalAportes;
      const saldoCaixa = valorInicial;
      const summarySemOps = {
        totalRealizado: 0,
        totalNaoRealizado: 0,
        valorTotalAtual: 0,
        saldoCaixa: capitalTotal,
        valorAtivos: 0,
        patrimonioTotal: capitalTotal,
        valorInicial,
        totalAportes,
        resultadoTotal: capitalTotal - capitalTotal,
        resultadoPercentual: capitalTotal > 0 ? 0 : 0,
      };
      return NextResponse.json({
        performance: {},
        summary: summarySemOps,
        carteira: carteiraSelecionada,
        warning: carteiraWarning,
      }, { status: 200 });
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
    let marketDataMap: Record<string, { current_price?: number | null } | null> = {};
    let marketDataWarning: string | null = null;
    try {
      marketDataMap = await fetchMarketDataByIds(Array.from(allMoedaIds));
      console.log(`[API /crypto/performance] [LOG DEBUG] Dados de mercado recebidos:`, marketDataMap); // <<< LOG DADOS COINGECKO
      console.log(`[API /crypto/performance] Dados de mercado buscados para ${Object.keys(marketDataMap).length} moedas.`);
    } catch (marketError: unknown) {
      const errMsg = marketError instanceof Error ? marketError.message : "erro_mercado";
      marketDataWarning = `Dados de mercado indisponíveis agora (${errMsg}). Cálculo feito sem preço atual.`;
      console.warn(`[API /crypto/performance] ${marketDataWarning}`);
      marketDataMap = {};
    }

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

    // Fluxo de caixa da carteira (caixa + ativos)
    const valorInicial = Number(carteiraSelecionada?.valor_inicial ?? 0);
    const capitalTotal = valorInicial + totalAportes;
    const comprasBrutas = operacoes
      .filter((op) => op.tipo === "compra")
      .reduce((acc, op) => acc + Number(op.valor_total) + Number(op.taxa ?? 0), 0);
    const vendasLiquidas = operacoes
      .filter((op) => op.tipo === "venda")
      .reduce((acc, op) => acc + Number(op.valor_total) - Number(op.taxa ?? 0), 0);
    const saldoCaixa = capitalTotal - comprasBrutas + vendasLiquidas;
    const valorAtivos = valorTotalDeMercadoGeral;
    const patrimonioTotal = saldoCaixa + valorAtivos;
    const resultadoTotal = patrimonioTotal - capitalTotal;
    const resultadoPercentual = capitalTotal > 0 ? (resultadoTotal / capitalTotal) * 100 : 0;

    const summaryComCarteira = {
      ...summary,
      saldoCaixa,
      valorAtivos,
      patrimonioTotal,
      valorInicial,
      totalAportes,
      resultadoTotal,
      resultadoPercentual,
    };
    console.log(`[API /crypto/performance] [LOG DEBUG] Dados a serem retornados:`, { performance: performancePorMoeda, summary });
    // <<< FIM LOG >>>

    // Retornar os resultados na response final
    // <<< Retornar response com status 200 >>>
    return NextResponse.json({
      performance: performancePorMoeda,
      summary: summaryComCarteira,
      carteira: carteiraSelecionada,
      warning: [marketDataWarning, carteiraWarning].filter(Boolean).join(" | ") || null,
    }, { status: 200 });

  } catch (error: any) {
    console.error("[API /crypto/performance] Erro inesperado:", error.message, error.stack); // Logar stack trace também
    // <<< Retornar response com status 500 >>>
    return NextResponse.json({ error: error.message || "Erro interno do servidor" }, { status: 500 });
  }
} 
