import { NextRequest, NextResponse } from "next/server";

// Definir tipos para os dados da API
interface Moeda {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
}

// Cache simples em memória para reduzir chamadas à API
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos em milissegundos
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
      console.log(`[API:listar-moedas] Usando dados em cache para ${url}`);
      return apiCache[url].data;
    }
  }

  // Se não estiver em cache ou expirou, buscar novos dados
  console.log(`[API:listar-moedas] Buscando dados de ${url}`);
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Accept': 'application/json',
        ...(options?.headers || {})
      }
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
    console.error(`[API:listar-moedas] Erro ao buscar ${url}:`, error);
    throw error;
  }
}

// Endpoint para buscar moedas
export async function GET(request: NextRequest) {
  try {
    console.log('[API:listar-moedas] Recebendo requisição de busca de moedas');
    
    // Obter o termo de busca da query
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query')?.toLowerCase();
    
    if (!query) {
      return NextResponse.json(
        { error: "É necessário fornecer um termo de busca" },
        { status: 400 }
      );
    }
    
    console.log(`[API:listar-moedas] Buscando termo: ${query}`);
    
    try {
      // Usar diretamente o CoinGecko como fonte primária
      // A CoinCap está com problemas e será descontinuada
      console.log('[API:listar-moedas] Buscando diretamente no CoinGecko');
      
      // Buscar moedas no CoinGecko
      const geckoResponse = await fetch(
        `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`,
        {
          headers: {
            'Accept': 'application/json'
          }
        }
      );
      
      if (!geckoResponse.ok) {
        throw new Error(`Erro CoinGecko: ${geckoResponse.status}`);
      }
      
      const data = await geckoResponse.json();
      
      if (!data.coins || !Array.isArray(data.coins)) {
        throw new Error('Formato de resposta inesperado');
      }
      
      // Filtrar e formatar os resultados
      const moedas: Moeda[] = data.coins.slice(0, 10).map((coin: any) => ({
        id: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        image: coin.thumb || "",
        current_price: 0 // Preço será estimado
      }));
      
      // Adicionar preços estimados
      for (const moeda of moedas) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          const priceResponse = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${moeda.id}&vs_currencies=usd`,
            { signal: controller.signal }
          );
          
          clearTimeout(timeoutId);
          
          if (priceResponse.ok) {
            const priceData = await priceResponse.json();
            if (priceData[moeda.id]?.usd) {
              moeda.current_price = priceData[moeda.id].usd;
            }
          }
        } catch (e) {
          console.warn(`[API:listar-moedas] Não foi possível obter preço para ${moeda.id}`);
        }
      }
      
      console.log('[API:listar-moedas] Retornando resultado da busca do CoinGecko');
      return NextResponse.json(moedas);
      
    } catch (apiError: any) {
      console.error('[API:listar-moedas] Erro ao comunicar com CoinGecko:', apiError);
      return NextResponse.json(
        { error: "Não foi possível buscar dados de criptomoedas no momento. Tente novamente mais tarde." },
        { status: 503 }
      );
    }
  } catch (error: any) {
    console.error('[API:listar-moedas] Erro ao buscar moedas:', error);
    return NextResponse.json(
      { error: error.message || "Erro interno do servidor" },
      { status: 500 }
    );
  }
} 