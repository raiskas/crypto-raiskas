import CryptoCarteiraPage, { type CarteiraInitialData } from "./carteira-client-page";
import { fetchInternalJson } from "@/lib/server/internal-request";

export const dynamic = "force-dynamic";

async function getInitialCarteiraData(carteiraIdParam?: string | null): Promise<CarteiraInitialData> {
  try {
    const carteiraQueryParam = carteiraIdParam
      ? `?carteira_id=${encodeURIComponent(carteiraIdParam)}`
      : "";
    const carteiraPayload = await fetchInternalJson<any>(`/api/crypto/carteira${carteiraQueryParam}`);
    const carteiras = Array.isArray(carteiraPayload?.carteiras) ? carteiraPayload.carteiras : [];
    const carteiraAtual =
      carteiraPayload?.carteira ??
      (carteiraIdParam ? carteiras.find((item: any) => item.id === carteiraIdParam) : null) ??
      carteiras[0] ??
      null;
    const carteiraId = carteiraAtual?.id ?? null;
    const carteiraQuery = carteiraId ? `?carteira_id=${encodeURIComponent(carteiraId)}` : "";

    const [performancePayload, operacoesPayload, snapshotsPayload] = await Promise.all([
      fetchInternalJson<any>(`/api/crypto/performance${carteiraQuery}`),
      fetchInternalJson<any[]>(`/api/crypto/operacoes${carteiraQuery}`),
      carteiraId
        ? fetchInternalJson<any>(`/api/crypto/carteira/snapshots${carteiraQuery}&months=12`)
        : Promise.resolve({ snapshots: [] }),
    ]);

    return {
      summary: performancePayload?.summary ?? {
        totalRealizado: 0,
        totalNaoRealizado: 0,
        valorTotalAtual: 0,
      },
      performanceMap: performancePayload?.performance ?? {},
      operacoes: Array.isArray(operacoesPayload) ? operacoesPayload : [],
      carteira: carteiraAtual,
      carteiras,
      selectedPortfolioId: carteiraId,
      aportes: Array.isArray(carteiraPayload?.aportes) ? carteiraPayload.aportes : [],
      snapshots: Array.isArray(snapshotsPayload?.snapshots) ? snapshotsPayload.snapshots : [],
      warning: performancePayload?.warning ?? carteiraPayload?.warning ?? null,
      error: null,
    };
  } catch (error: any) {
    return {
      summary: {
        totalRealizado: 0,
        totalNaoRealizado: 0,
        valorTotalAtual: 0,
      },
      performanceMap: {},
      operacoes: [],
      carteira: null,
      carteiras: [],
      selectedPortfolioId: null,
      aportes: [],
      snapshots: [],
      warning: null,
      error: error?.message || "Erro ao carregar carteira.",
    };
  }
}

export default async function CryptoCarteiraServerPage({
  searchParams,
}: {
  searchParams?: { carteira_id?: string };
}) {
  const initialData = await getInitialCarteiraData(searchParams?.carteira_id ?? null);
  return <CryptoCarteiraPage initialData={initialData} />;
}
