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
  usuario_id: string; // Adicionar explicitamente se necessário
  grupo_id?: string;
}

// Adicionar outros tipos relacionados a cripto aqui se necessário 