import { NextRequest, NextResponse } from 'next/server';
import { fetchMarketDataByIds, MarketDataMap } from '@/lib/coingecko'; // Importar a nova função e o tipo

// As definições das interfaces FullCoinData e MarketDataMap foram movidas para @/lib/coingecko.ts

// const REVALIDATE_TIME = 60; // Não é mais necessário aqui, está na lib

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get('ids'); // Obter IDs da query string (ex: "bitcoin,ethereum")

  if (!idsParam) {
    return NextResponse.json({ error: 'Parâmetro "ids" é obrigatório' }, { status: 400 });
  }

  const requestedIds = idsParam.split(',').filter(id => id.trim() !== ''); // Limpa IDs vazios

  if (requestedIds.length === 0) {
    return NextResponse.json({ error: 'Parâmetro "ids" não pode estar vazio' }, { status: 400 });
  }

  console.log(`[API /market-data] Recebida requisição para IDs: ${requestedIds.join(',')}`);

  try {
    // Chamar a função da biblioteca para buscar os dados
    const marketDataMap: MarketDataMap = await fetchMarketDataByIds(requestedIds);

    console.log(`[API /market-data] Retornando mapa de dados de mercado.`);
    return NextResponse.json(marketDataMap);

  } catch (error: unknown) {
    console.error('[API /market-data] Erro ao buscar dados de mercado via Lib:', error);
    // A Lib já logou detalhes, aqui retornamos um erro genérico para o cliente
    // Poderíamos inspecionar o erro para retornar status codes mais específicos (ex: 404 se a CoinGecko não achou)
    // mas por simplicidade, usamos 503 (Service Unavailable)
    const errorMessage = error instanceof Error ? error.message : "Erro interno ao buscar dados de mercado.";
    return NextResponse.json(
      { error: "Não foi possível buscar dados de mercado no momento.", details: errorMessage },
      { status: 503 } // Service Unavailable é apropriado quando a dependência externa falha
    );
  }
} 