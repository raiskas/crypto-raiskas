import { NextResponse } from "next/server";
import { fetchCoinList, SimpleCoinInfo } from "@/lib/coingecko";

export async function GET() {
  console.log("[API /coin-list] Recebida requisição para lista completa de moedas.");

  try {
    // Chamar a função da biblioteca para buscar a lista
    const coinList: SimpleCoinInfo[] = await fetchCoinList();

    console.log(`[API /coin-list] Retornando ${coinList.length} moedas.`);
    return NextResponse.json(coinList);

  } catch (error: unknown) {
    console.error("[API /coin-list] Erro ao buscar lista de moedas via Lib:", error);
    // A Lib já logou detalhes, retornar erro genérico
    const errorMessage = error instanceof Error ? error.message : "Erro interno ao buscar lista de moedas.";
    return NextResponse.json(
      { error: "Não foi possível buscar a lista de moedas no momento.", details: errorMessage },
      { status: 503 } // Service Unavailable
    );
  }
} 