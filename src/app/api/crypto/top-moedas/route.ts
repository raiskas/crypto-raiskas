import { NextRequest, NextResponse } from "next/server";

// Definir tipos para os dados da API
interface TopMoeda {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
}

// Cache simples em memória para reduzir chamadas à API
const CACHE_DURATION = 60 * 1000; // 1 minuto em milissegundos
interface CacheItem {
  timestamp: number;
  data: any;
}

const apiCache: Record<string, CacheItem> = {};

// Função auxiliar para buscar com cache
async function fetchWithCache(url: string, options?: any) {
  // Verificar se os dados estão em cache e são válidos
  if (apiCache[url]) {
    const now = Date.now();
    if (now - apiCache[url].timestamp < CACHE_DURATION) {
      console.log(`[API:top-moedas] Usando dados em cache para ${url}`);
      return apiCache[url].data;
    }
  }

  // Se não estiver em cache ou expirou, buscar novos dados
  console.log(`[API:top-moedas] Buscando dados de ${url}`);
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Accept': 'application/json',
        ...(options?.headers || {})
      },
      timeout: 10000
    });
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Erro na requisição: ${response.status} - ${text}`);
    }
    
    const data = await response.json();
    
    // Armazenar em cache
    apiCache[url] = {
      timestamp: Date.now(),
      data
    };
    
    return data;
  } catch (error) {
    console.error(`[API:top-moedas] Erro ao buscar ${url}:`, error);
    throw error;
  }
}

// Endpoint para buscar as top 10 criptomoedas
export async function GET(request: NextRequest) {
  try {
    console.log('[API:top-moedas] Recebendo requisição para listar top moedas');
    
    try {
      // Buscar direto na API do CoinGecko em vez da CoinCap
      console.log('[API:top-moedas] Buscando no CoinGecko');
      
      const geckoResponse = await fetchWithCache(
        'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=false&locale=en'
      );
      
      if (!Array.isArray(geckoResponse)) {
        throw new Error('Formato de resposta inesperado');
      }
      
      // Formatar para o padrão esperado pelo frontend
      const moedas: TopMoeda[] = geckoResponse.map((coin: any) => ({
        id: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        image: coin.image || "",
        current_price: coin.current_price || 0,
        price_change_percentage_24h: coin.price_change_percentage_24h || 0,
        market_cap: coin.market_cap || 0
      }));
      
      console.log('[API:top-moedas] Retornando resultado da busca');
      return NextResponse.json(moedas);
      
    } catch (apiError: any) {
      console.error('[API:top-moedas] Erro ao buscar moedas:', apiError);
      return NextResponse.json(
        { error: "Não foi possível buscar dados de criptomoedas no momento. Tente novamente mais tarde." },
        { status: 503 }
      );
    }
  } catch (error: any) {
    console.error('[API:top-moedas] Erro ao buscar moedas:', error);
    return NextResponse.json(
      { error: error.message || "Erro interno do servidor" },
      { status: 500 }
    );
  }
} 