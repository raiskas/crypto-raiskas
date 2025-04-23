import { NextResponse } from 'next/server';

// Define a interface para a resposta esperada da CoinGecko
interface CoinGeckoResponse {
  bitcoin: {
    usd: number;
  };
}

// Define a interface para a resposta da nossa API
interface ApiResponse {
  price?: number;
  error?: string;
}

// Tempo de revalidação do cache em segundos
const REVALIDATE_TIME = 60;

export async function GET(): Promise<NextResponse<ApiResponse>> {
  console.log('[API /api/preco] Recebida requisição GET'); // Log para depuração
  try {
    const coingeckoUrl = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd';
    console.log(`[API /api/preco] Buscando dados de: ${coingeckoUrl}`);

    const response = await fetch(coingeckoUrl, {
      next: { 
        revalidate: REVALIDATE_TIME 
      }, // Instrução para Next.js/Vercel cachear por 60 segundos
    });

    console.log(`[API /api/preco] Resposta da CoinGecko recebida. Status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API /api/preco] Erro da CoinGecko API: ${response.status} - ${errorText}`);
      throw new Error(`Erro da CoinGecko API: ${response.status} - ${errorText}`);
    }

    const data: CoinGeckoResponse = await response.json();
    console.log('[API /api/preco] Dados da CoinGecko processados:', data);

    // Validação extra para garantir que a estrutura da resposta é a esperada
    if (!data.bitcoin || typeof data.bitcoin.usd !== 'number') {
      console.error('[API /api/preco] Formato inesperado da resposta da CoinGecko:', data);
      throw new Error('Formato inesperado da resposta da CoinGecko API');
    }

    const price = data.bitcoin.usd;
    console.log(`[API /api/preco] Preço do Bitcoin extraído: ${price}`);

    return NextResponse.json({ price });

  } catch (error: unknown) {
    console.error("[API /api/preco] Exceção ao buscar preço:", error);
    // Garante que error seja tratado como Error para acessar a propriedade message
    const errorMessage = error instanceof Error ? error.message : 'Falha ao buscar preço do Bitcoin';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 