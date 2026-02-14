export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server";
import { searchCoins, Moeda } from "@/lib/coingecko"; // Importar a nova função

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query')?.trim(); // Usar trim para limpar espaços

  if (!query) {
    return NextResponse.json(
      { error: "Parâmetro 'query' é obrigatório" },
      { status: 400 }
    );
  }

  console.log(`[API:listar-moedas] Recebida requisição de busca para query: "${query}"`);

  try {
    // Chamar a função da biblioteca
    const moedas: Moeda[] = await searchCoins(query);

    console.log(`[API:listar-moedas] Retornando ${moedas.length} moedas encontradas.`);
    return NextResponse.json(moedas);

  } catch (error: unknown) {
    console.error(`[API:listar-moedas] Erro ao buscar moedas via Lib para query "${query}":`, error);
    // A Lib já logou detalhes, retornar erro genérico
    const errorMessage = error instanceof Error ? error.message : "Erro interno ao buscar moedas.";
    return NextResponse.json(
      { error: "Não foi possível buscar moedas no momento.", details: errorMessage },
      { status: 503 } // Service Unavailable
    );
  }
} 