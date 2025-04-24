// Interface para os dados completos de uma moeda vindos da CoinGecko (/coins/markets)
export interface FullCoinData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number | null;
  fully_diluted_valuation: number | null;
  total_volume: number;
  high_24h: number | null;
  low_24h: number | null;
  price_change_24h: number | null;
  price_change_percentage_24h: number | null;
  market_cap_change_24h: number | null;
  market_cap_change_percentage_24h: number | null;
  circulating_supply: number;
  total_supply: number | null;
  max_supply: number | null;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  atl: number;
  atl_change_percentage: number;
  atl_date: string;
  roi: null | { times: number; currency: string; percentage: number };
  last_updated: string;
}

// Interface para a resposta da nossa API: um mapa de ID para dados completos
export interface MarketDataMap {
  [coinId: string]: FullCoinData | null; // Usar null se a moeda não for encontrada
}

// Interface para dados simplificados de moeda (usado na busca)
export interface Moeda {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number | null; // Permitir null se o preço não for encontrado
}

// Interface para informações básicas de moeda (usado na lista completa)
export interface SimpleCoinInfo {
  id: string;
  symbol: string;
  name: string;
}

const REVALIDATE_TIME = 60; // Cache de 60 segundos (usado pelo fetch do Next.js)
const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';
const SEARCH_REVALIDATE_TIME = 300; // 5 minutos para cache de busca
const PRICE_REVALIDATE_TIME = 60; // 1 minuto para cache de preço (mais volátil)
const COIN_LIST_REVALIDATE_TIME = 60 * 60 * 24; // Cache de 24 horas para a lista de moedas

/**
 * Busca dados de mercado completos para uma lista de IDs de moedas da CoinGecko.
 * Utiliza o cache nativo do Next.js fetch.
 * @param ids Array de IDs de moedas (ex: ["bitcoin", "ethereum"])
 * @returns Uma Promise que resolve para um MarketDataMap.
 * @throws Lança um erro se a chamada à API CoinGecko falhar.
 */
export async function fetchMarketDataByIds(ids: string[]): Promise<MarketDataMap> {
  if (!ids || ids.length === 0) {
    return {};
  }

  const idsString = ids.join(',');
  // Usar o endpoint /coins/markets que retorna dados mais completos
  // Aumentar per_page para garantir que pegamos todos os IDs solicitados se forem muitos
  const url = `${COINGECKO_API_URL}/coins/markets?vs_currency=usd&ids=${idsString}&order=market_cap_desc&per_page=250&page=1&sparkline=false&locale=en`;
  console.log(`[CoinGecko Lib] Buscando dados para IDs: ${idsString} de ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      next: {
        revalidate: REVALIDATE_TIME
      }
    });

    console.log(`[CoinGecko Lib] Resposta da CoinGecko recebida. Status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[CoinGecko Lib] Erro da CoinGecko API: ${response.status} - ${errorText}`);
      // Lançar erro para ser tratado pela função chamadora (a API route)
      throw new Error(`Falha ao buscar dados de mercado da CoinGecko: ${response.status}`);
    }

    // A resposta de /coins/markets é um ARRAY
    const data: FullCoinData[] = await response.json();
    console.log(`[CoinGecko Lib] Dados da CoinGecko processados. ${data.length} moedas retornadas.`);

    // Transformar o array em um mapa [coinId]: FullCoinData
    const marketDataMap: MarketDataMap = {};
    data.forEach(coinData => {
      marketDataMap[coinData.id] = coinData; // Mapeia ID para o objeto completo
    });

    // Verificar se todos os IDs solicitados foram encontrados e adicionar null para os ausentes
    ids.forEach(id => {
      if (!marketDataMap.hasOwnProperty(id)) {
        console.warn(`[CoinGecko Lib] ID "${id}" não encontrado na resposta da CoinGecko.`);
        marketDataMap[id] = null; // Marca como null se não foi retornado
      }
    });

    return marketDataMap;

  } catch (error) {
    console.error('[CoinGecko Lib] Exceção ao buscar dados de mercado:', error);
    // Relança o erro para que a camada da API possa decidir como responder ao cliente
    // Poderia ser mais específico, mas por enquanto relançamos o erro original ou um genérico
    if (error instanceof Error) {
        throw error; // Relança o erro original (pode conter detalhes úteis como o status HTTP)
    } else {
        throw new Error("Erro desconhecido ao processar dados da CoinGecko.");
    }
  }
}

/**
 * Busca moedas na CoinGecko com base em uma query.
 * Retorna os top 10 resultados com seus preços atuais.
 * @param query Termo de busca.
 * @returns Uma Promise que resolve para um array de Moeda.
 * @throws Lança um erro se a chamada à API CoinGecko falhar.
 */
export async function searchCoins(query: string): Promise<Moeda[]> {
  if (!query) {
    return [];
  }

  const searchUrl = `${COINGECKO_API_URL}/search?query=${encodeURIComponent(query)}`;
  console.log(`[CoinGecko Lib] Buscando moedas com query: "${query}" de ${searchUrl}`);

  try {
    // 1. Buscar moedas correspondentes à query
    const searchResponse = await fetch(searchUrl, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: SEARCH_REVALIDATE_TIME }
    });

    console.log(`[CoinGecko Lib] Resposta da busca recebida. Status: ${searchResponse.status}`);
    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error(`[CoinGecko Lib] Erro na API de busca CoinGecko: ${searchResponse.status} - ${errorText}`);
      throw new Error(`Falha ao buscar moedas na CoinGecko: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    if (!searchData.coins || !Array.isArray(searchData.coins)) {
      console.error('[CoinGecko Lib] Formato de resposta inesperado da API de busca.', searchData);
      throw new Error('Formato de resposta inesperado da API de busca CoinGecko.');
    }

    // Pegar os top 10 resultados e mapear para a estrutura inicial de Moeda
    const topCoins = searchData.coins.slice(0, 10).map((coin: any) => ({
      id: coin.id as string,
      symbol: coin.symbol as string,
      name: coin.name as string,
      image: (coin.thumb || coin.large || coin.small || "") as string, // Usar thumb ou outra imagem disponível
      current_price: null // Inicializa como null
    })) as Moeda[];

    if (topCoins.length === 0) {
      console.log(`[CoinGecko Lib] Nenhuma moeda encontrada para a query "${query}"`);
      return [];
    }

    // 2. Buscar preços para as moedas encontradas
    const coinIdsForPrice = topCoins.map(coin => coin.id);
    const priceUrl = `${COINGECKO_API_URL}/simple/price?ids=${coinIdsForPrice.join(',')}&vs_currencies=usd`;
    console.log(`[CoinGecko Lib] Buscando preços para IDs: ${coinIdsForPrice.join(',')}`);

    try {
      const priceResponse = await fetch(priceUrl, {
          headers: { 'Accept': 'application/json' },
          next: { revalidate: PRICE_REVALIDATE_TIME } // Usar revalidate menor para preços
      });

      console.log(`[CoinGecko Lib] Resposta de preços recebida. Status: ${priceResponse.status}`);
      if (priceResponse.ok) {
        const priceData = await priceResponse.json();

        // Atualizar os preços no array topCoins
        topCoins.forEach(coin => {
          if (priceData[coin.id]?.usd !== undefined) {
            coin.current_price = priceData[coin.id].usd;
          }
        });
      } else {
          // Logar erro mas não parar tudo, apenas os preços ficarão como null
          const errorText = await priceResponse.text();
          console.warn(`[CoinGecko Lib] Falha ao buscar preços da CoinGecko: ${priceResponse.status} - ${errorText}`);
      }
    } catch(priceError) {
        // Logar erro de fetch de preço mas continuar
        console.warn(`[CoinGecko Lib] Exceção ao buscar preços da CoinGecko:`, priceError);
    }

    console.log(`[CoinGecko Lib] Retornando ${topCoins.length} moedas encontradas para a query "${query}"`);
    return topCoins;

  } catch (error) {
    console.error(`[CoinGecko Lib] Exceção ao buscar moedas com query "${query}":`, error);
    // Relança o erro para a camada da API decidir como responder
    if (error instanceof Error) {
        throw error;
    } else {
        throw new Error("Erro desconhecido ao buscar moedas na CoinGecko.");
    }
  }
}

/**
 * Busca a lista completa de moedas suportadas pela CoinGecko.
 * Utiliza cache de longa duração.
 * @returns Uma Promise que resolve para um array de SimpleCoinInfo.
 * @throws Lança um erro se a chamada à API CoinGecko falhar.
 */
export async function fetchCoinList(): Promise<SimpleCoinInfo[]> {
  const url = `${COINGECKO_API_URL}/coins/list`;
  console.log(`[CoinGecko Lib] Buscando lista completa de moedas de ${url}`);

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: COIN_LIST_REVALIDATE_TIME }
    });

    console.log(`[CoinGecko Lib] Resposta da lista de moedas recebida. Status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[CoinGecko Lib] Erro na API /coins/list CoinGecko: ${response.status} - ${errorText}`);
      throw new Error(`Falha ao buscar lista de moedas da CoinGecko: ${response.status}`);
    }

    const data: SimpleCoinInfo[] = await response.json();
    console.log(`[CoinGecko Lib] Lista de moedas processada. ${data.length} moedas retornadas.`);
    return data;

  } catch (error) {
    console.error(`[CoinGecko Lib] Exceção ao buscar lista de moedas:`, error);
    // Relança o erro
    if (error instanceof Error) {
        throw error;
    } else {
        throw new Error("Erro desconhecido ao buscar lista de moedas da CoinGecko.");
    }
  }
}

// TODO: Adicionar função fetchCoinIds() aqui no futuro, se necessário. 