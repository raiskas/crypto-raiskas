import type { PerformanceMetrics } from "@/lib/crypto/fifoCalculations";

// Re-exportar de fifoCalculations para centralizar tipos relacionados a performance
export type { PerformanceMetrics } from "@/lib/crypto/fifoCalculations"; 

// Definir estado geral da performance retornado pela API
export interface PerformanceSummary {
  totalRealizado: number;
  totalNaoRealizado: number;
  valorTotalAtual: number;
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