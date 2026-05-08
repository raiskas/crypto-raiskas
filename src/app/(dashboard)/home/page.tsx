import HomePage, { type HomeInitialData } from "./home-client-page";
import { fetchInternalJson } from "@/lib/server/internal-request";

export const dynamic = "force-dynamic";

async function getInitialHomeData(): Promise<HomeInitialData> {
  try {
    const [performanceData, marketDataMap] = await Promise.all([
      fetchInternalJson<any>("/api/crypto/performance"),
      fetchInternalJson<Record<string, any>>(
        "/api/crypto/market-data?ids=bitcoin,ethereum,tether,binancecoin,solana,usd-coin,ripple,staked-ether,dogecoin,cardano"
      ),
    ]);

    const topMoedas = [
      "bitcoin",
      "ethereum",
      "tether",
      "binancecoin",
      "solana",
      "usd-coin",
      "ripple",
      "staked-ether",
      "dogecoin",
      "cardano",
    ]
      .map((id) => marketDataMap[id])
      .filter(Boolean);

    return {
      performanceData,
      topMoedas,
      errorPerformance: null,
      errorTopMoedas: null,
    };
  } catch (error: any) {
    return {
      performanceData: null,
      topMoedas: [],
      errorPerformance: error?.message || "Erro ao carregar dashboard.",
      errorTopMoedas: null,
    };
  }
}

export default async function HomeServerPage() {
  const initialData = await getInitialHomeData();
  return <HomePage initialData={initialData} />;
}
