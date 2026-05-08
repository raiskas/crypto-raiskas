import CryptoPage, { type CryptoInitialData } from "./crypto-client-page";
import { fetchInternalJson } from "@/lib/server/internal-request";
import { PriceProvider } from "@/lib/context/PriceContext";

export const dynamic = "force-dynamic";

async function getInitialCryptoData(): Promise<CryptoInitialData> {
  try {
    const carteiraPayload = await fetchInternalJson<any>("/api/crypto/carteira");
    const carteiras = Array.isArray(carteiraPayload?.carteiras) ? carteiraPayload.carteiras : [];
    const carteiraAtual = carteiraPayload?.carteira ?? carteiras[0] ?? null;
    const carteiraId = carteiraAtual?.id ?? null;
    const carteiraQuery = carteiraId ? `?carteira_id=${encodeURIComponent(carteiraId)}` : "";

    const [performanceData, operacoes] = await Promise.all([
      fetchInternalJson<any>(`/api/crypto/performance${carteiraQuery}`),
      fetchInternalJson<any[]>(`/api/crypto/operacoes${carteiraQuery}`),
    ]);

    return {
      operacoes: Array.isArray(operacoes) ? operacoes : [],
      performanceData,
      portfolios: carteiras,
      selectedPortfolioId: carteiraId,
      error: null,
      errorPerformance: null,
    };
  } catch (error: any) {
    return {
      operacoes: [],
      performanceData: null,
      portfolios: [],
      selectedPortfolioId: null,
      error: error?.message || "Erro ao carregar dados de crypto.",
      errorPerformance: null,
    };
  }
}

export default async function CryptoServerPage() {
  const initialData = await getInitialCryptoData();
  return (
    <PriceProvider>
      <CryptoPage initialData={initialData} />
    </PriceProvider>
  );
}
