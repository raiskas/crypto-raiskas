import type { PerformanceMetrics } from "@/lib/crypto/fifoCalculations";

// Re-exportar de fifoCalculations para centralizar tipos relacionados a performance
export type { PerformanceMetrics } from "@/lib/crypto/fifoCalculations"; 

// Tipos client-safe de dados vindos da CoinGecko.
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

export interface MarketDataMap {
  [coinId: string]: FullCoinData | null;
}

export interface Moeda {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number | null;
}

export interface SimpleCoinInfo {
  id: string;
  symbol: string;
  name: string;
}

// Definir estado geral da performance retornado pela API
export interface PerformanceSummary {
  totalRealizado: number;
  totalNaoRealizado: number;
  valorTotalAtual: number;
  saldoCaixa?: number;
  valorAtivos?: number;
  patrimonioTotal?: number;
  valorInicial?: number;
  totalAportes?: number;
  resultadoTotal?: number;
  resultadoPercentual?: number;
}

export interface CryptoPerformanceState {
  performance: { [key: string]: PerformanceMetrics }; // Usar tipo importado
  summary: PerformanceSummary;
}

// Definir tipo Operacao (se não definido globalmente em outro lugar)
// Se já existir em, por exemplo, @/types/index.ts, remover esta definição daqui.
export interface Operacao {
  id: string;
  moeda_id: string;
  simbolo: string;
  nome: string;
  tipo: "compra" | "venda";
  quantidade: number;
  preco_unitario: number;
  valor_total: number;
  taxa: number;
  data_operacao: string; // Manter como string para compatibilidade com DB/API
  exchange: string;
  notas: string | null;
  criado_em: string;
  atualizado_em: string;
  usuario_id: string; // Adicionado usuario_id
  grupo_id?: string;
}

// Adicionar outros tipos relacionados a cripto aqui se necessário 
