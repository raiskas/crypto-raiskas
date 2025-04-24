import { NextRequest, NextResponse } from 'next/server';

// Interface para a resposta da nossa API
// Ex: { bitcoin: 64000, ethereum: 1800 }
interface PriceMap {
  [coinId: string]: number | null;
}

// Interface para a resposta da CoinGecko /simple/price
// Ex: { "bitcoin": { "usd": 64000 }, "ethereum": { "usd": 1800 } }
interface CoinGeckoSimpleResponse {
  [coinId: string]: {
    usd?: number;
  };
}

const REVALIDATE_TIME = 60; // Cache de 60 segundos

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ids = searchParams.get('ids'); // Obter IDs da query string (ex: "bitcoin,ethereum")

  if (!ids) {
    return NextResponse.json({ error: 'Parâmetro "ids" é obrigatório' }, { status: 400 });
  }

  const coingeckoUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
  console.log(`[API /api/crypto/prices] Buscando dados para IDs: ${ids} de ${coingeckoUrl}`);

  try {
    const response = await fetch(coingeckoUrl, {
      headers: {
        'Accept': 'application/json',
      },
      next: { 
        revalidate: REVALIDATE_TIME 
      }
    });

    console.log(`[API /api/crypto/prices] Resposta da CoinGecko recebida. Status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API /api/crypto/prices] Erro da CoinGecko API: ${response.status} - ${errorText}`);
      throw new Error(`Falha ao buscar preços da CoinGecko: ${response.status}`);
    }

    const data: CoinGeckoSimpleResponse = await response.json();
    console.log('[API /api/crypto/prices] Dados da CoinGecko processados.');

    // Transformar a resposta da CoinGecko no nosso formato de mapa simples
    const priceMap: PriceMap = {};
    for (const coinId in data) {
      if (Object.prototype.hasOwnProperty.call(data, coinId)) {
        priceMap[coinId] = data[coinId].usd ?? null; // Mapeia ID para preço ou null se não existir
      }
    }

    // Adicionar IDs que foram pedidos mas não retornados pela CoinGecko (ex: ID inválido)
    const requestedIds = ids.split(',');
    requestedIds.forEach(id => {
      if (!priceMap.hasOwnProperty(id)) {
        console.warn(`[API /api/crypto/prices] ID "${id}" não encontrado na resposta da CoinGecko.`);
        priceMap[id] = null; // Marca como null se não foi retornado
      }
    });

    console.log(`[API /api/crypto/prices] Retornando mapa de preços:`, priceMap);
    return NextResponse.json(priceMap);

  } catch (error: unknown) {
    console.error('[API /api/crypto/prices] Exceção ao buscar preços:', error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno ao buscar preços.";
    return NextResponse.json(
      { error: "Não foi possível buscar preços de criptomoedas no momento." }, 
      { status: 503 }
    );
  }
} 