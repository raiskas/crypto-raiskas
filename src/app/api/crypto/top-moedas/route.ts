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

// Tempo de revalidação do cache (igual ao /api/preco)
const REVALIDATE_TIME = 60; 

// Endpoint para buscar as top 10 criptomoedas
export async function GET(request: NextRequest) {
  console.log('[API:top-moedas] Recebendo requisição para listar top moedas');
  const coingeckoUrl = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=false&locale=en';
  
  try {
    console.log(`[API:top-moedas] Buscando dados de: ${coingeckoUrl}`);
    
    // Usar fetch diretamente com revalidate do Next.js
    const response = await fetch(coingeckoUrl, {
      headers: {
        'Accept': 'application/json',
      },
      next: { 
        revalidate: REVALIDATE_TIME 
      } // Cache gerenciado pelo Next.js/Vercel
    });
    
    console.log(`[API:top-moedas] Resposta da CoinGecko recebida. Status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API:top-moedas] Erro da CoinGecko API: ${response.status} - ${errorText}`);
      // Retornar um erro mais específico se possível, mas manter genérico para o usuário
      throw new Error(`Falha ao buscar dados da CoinGecko: ${response.status}`); 
    }
    
    const geckoResponse = await response.json();
    console.log('[API:top-moedas] Dados da CoinGecko processados.');

    if (!Array.isArray(geckoResponse)) {
      console.error('[API:top-moedas] Formato de resposta inesperado da CoinGecko:', geckoResponse);
      throw new Error('Formato de resposta inesperado da CoinGecko API');
    }
    
    // Formatar para o padrão esperado pelo frontend (manter esta lógica)
    const moedas: TopMoeda[] = geckoResponse.map((coin: any) => ({
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      image: coin.image || "", // Garantir que image seja sempre string
      current_price: coin.current_price ?? 0, // Usar ?? para tratar null/undefined
      price_change_percentage_24h: coin.price_change_percentage_24h ?? 0,
      market_cap: coin.market_cap ?? 0
    }));
    
    console.log('[API:top-moedas] Retornando ${moedas.length} moedas formatadas.');
    return NextResponse.json(moedas);
      
  } catch (error: unknown) {
    console.error('[API:top-moedas] Exceção ao buscar moedas:', error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno ao buscar top moedas.";
    // Considerar retornar um status 503 (Service Unavailable) se o erro for da API externa
    // Ou manter 500 para erro interno
    return NextResponse.json(
      { error: "Não foi possível buscar dados de criptomoedas no momento." }, 
      { status: 503 } // Indica que o problema pode ser externo
    );
  }
} 