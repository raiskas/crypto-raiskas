"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, AlertCircle, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { MarketDataMap, FullCoinData } from "@/lib/coingecko";

// Tipo para top moedas
interface TopMoeda {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
}

// Tipo para as operações
interface Operacao {
  id: string;
  moeda_id: string;
  simbolo: string;
  nome: string;
  tipo: "compra" | "venda";
  quantidade: number;
  preco_unitario: number;
  valor_total: number;
  taxa: number;
  data_operacao: string;
  exchange: string;
  notas: string | null;
  criado_em: string;
  atualizado_em: string;
}

// Props do componente
interface OperacoesWidgetProps {
  compact?: boolean;
  className?: string;
}

export function OperacoesWidget({ compact = false, className }: OperacoesWidgetProps) {
  const router = useRouter();
  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [topMoedas, setTopMoedas] = useState<TopMoeda[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Formatar data (String Split para evitar timezone)
  const formatarData = (dataStr: string | null | undefined): string => {
    if (!dataStr || typeof dataStr !== 'string' || !dataStr.includes('T')) {
      // Retorna um valor padrão ou a string original se o formato for inesperado
      return dataStr || "Data inválida";
    }
    try {
      // Pega a parte antes do 'T' -> "YYYY-MM-DD"
      const datePart = dataStr.split('T')[0];
      // Divide em ano, mês, dia
      const [year, month, day] = datePart.split('-');
      // Valida se temos 3 partes
      if (!year || !month || !day) {
        return dataStr; // Retorna original se o split falhar
      }
      // Remonta como "DD/MM/YYYY"
      return `${day}/${month}/${year}`;
    } catch (e) {
      console.error("Erro ao formatar data (string split):", dataStr, e);
      return dataStr; // Retorna original em caso de erro
    }
  };

  // Formatar valores monetários
  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD'
    }).format(valor);
  };

  // Formatar valores percentuais
  const formatarPercentual = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(valor / 100);
  };

  // Carregar dados
  const carregarDados = async () => {
    try {
      setLoading(true);
      setError(null);
      setOperacoes([]); // Limpar dados antigos
      setTopMoedas([]);
      
      // 1. Buscar Operações
      console.log("[OperacoesWidget] Buscando operações...");
      const operacoesResponse = await fetch("/api/crypto/operacoes", {
        method: "GET",
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      
      if (!operacoesResponse.ok) {
        throw new Error(`Erro ${operacoesResponse.status} ao buscar operações`);
      }
      
      const operacoesData = await operacoesResponse.json();
      // A API /operacoes parece retornar { operacoes: [] }
      const fetchedOperacoes = operacoesData?.operacoes || []; 
      
      if (!Array.isArray(fetchedOperacoes)) {
          console.error("[OperacoesWidget] Formato inesperado de operações:", fetchedOperacoes);
          throw new Error("Formato inválido de operações recebido.");
      }
      console.log(`[OperacoesWidget] ${fetchedOperacoes.length} operações carregadas.`);
      setOperacoes(fetchedOperacoes); // Define as operações

      // 2. Extrair IDs Únicos das Operações Carregadas
      const idsDasOperacoes = [...new Set(fetchedOperacoes.map(op => op.moeda_id))];
      console.log("[OperacoesWidget] IDs únicos das operações:", idsDasOperacoes);

      if (idsDasOperacoes.length === 0) {
        console.log("[OperacoesWidget] Nenhuma operação, não precisa buscar market data.");
        setLoading(false);
        return; 
      }

      // 3. Buscar Market Data
      const marketDataUrl = `/api/crypto/market-data?ids=${idsDasOperacoes.join(',')}`;
      console.log("[OperacoesWidget] Buscando Market Data de:", marketDataUrl);
      const marketDataResponse = await fetch(marketDataUrl);

      if (!marketDataResponse.ok) {
         const errorText = await marketDataResponse.text().catch(() => "Erro desconhecido");
         console.error(`[OperacoesWidget] Erro ${marketDataResponse.status} ao buscar market data: ${errorText}`);
         // Definir um erro geral, ou um específico para preços?
         // Por simplicidade, usaremos o erro geral do widget.
         throw new Error(`Erro ${marketDataResponse.status} ao buscar preços das moedas.`);
      }
      
      const marketDataMap: MarketDataMap = await marketDataResponse.json();
      console.log("[OperacoesWidget] MarketDataMap recebido:", Object.keys(marketDataMap).length);

      // Transformar e armazenar no estado topMoedas
      const marketDataArray = idsDasOperacoes.map(id => {
        const coinData: FullCoinData | null = marketDataMap[id];
        if (coinData) {
          return { // Mapear para a interface TopMoeda existente no widget
            id: coinData.id,
            symbol: coinData.symbol,
            name: coinData.name,
            image: coinData.image,
            current_price: coinData.current_price,
            price_change_percentage_24h: coinData.price_change_percentage_24h ?? 0,
            market_cap: coinData.market_cap,
          };
        }
        console.warn(`[OperacoesWidget] Moeda com ID "${id}" não encontrada no marketDataMap.`);
        return null;
      }).filter((moeda): moeda is TopMoeda => moeda !== null);

      setTopMoedas(marketDataArray); // Armazena os dados de mercado para uso em getPrecoAtual
      setError(null); // Limpa erro se tudo correu bem
      
    } catch (err) {
      console.error("[OperacoesWidget] Erro ao carregar dados:", err);
      const errorMessage = err instanceof Error ? err.message : "Erro ao carregar dados de operações";
      setError(errorMessage);
      setOperacoes([]); // Limpar em caso de erro
      setTopMoedas([]);
    } finally {
      setLoading(false);
    }
  };

  // Obter o preço atual de uma moeda a partir do ID
  const getPrecoAtual = (moedaId: string): number => {
    const moeda = topMoedas.find(m => m.id === moedaId);
    return moeda?.current_price || 0;
  };

  // Calcular valor total atualizado
  const calcularValorAtualizado = (op: Operacao): number => {
    const precoAtual = getPrecoAtual(op.moeda_id);
    return op.quantidade * precoAtual;
  };

  // Calcular lucro/prejuízo e sua porcentagem
  const calcularLucroOuPrejuizo = (op: Operacao): {valor: number, percentual: number} => {
    const valorAtualizado = calcularValorAtualizado(op);
    let lucro = 0;
    let percentual = 0;
    
    if (op.tipo === "compra") {
      lucro = valorAtualizado - op.valor_total;
      percentual = op.valor_total > 0 ? (lucro / op.valor_total) * 100 : 0;
    } else {
      // Para vendas, o lucro já foi realizado e não depende do preço atual
      lucro = op.valor_total - (op.quantidade * op.preco_unitario);
      percentual = op.preco_unitario > 0 ? (lucro / (op.quantidade * op.preco_unitario)) * 100 : 0;
    }
    
    return { valor: lucro, percentual };
  };

  // Navegar para editar uma operação
  const editarOperacao = (id: string) => {
    router.push(`/crypto/editar-operacao/${id}`);
  };

  // Excluir uma operação
  const excluirOperacao = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta operação?")) {
      return;
    }

    try {
      setLoading(true);
      
      const response = await fetch(`/api/crypto/operacoes?id=${id}`, {
        method: "DELETE",
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error("Erro ao excluir operação");
      }
      
      // Recarregar dados após exclusão
      await carregarDados();
      
    } catch (err) {
      console.error("Erro ao excluir operação:", err);
      setError("Erro ao excluir operação");
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // Inverter e limitar operações para mostrar as mais recentes primeiro
  const operacoesRecentes = [...operacoes]
    .sort((a, b) => new Date(b.data_operacao).getTime() - new Date(a.data_operacao).getTime())
    .slice(0, compact ? 5 : operacoes.length);

  return (
    <Card className={cn("mb-6", className)}>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-xl">Minhas Operações</CardTitle>
            <CardDescription>Registro de suas compras e vendas de criptomoedas</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => carregarDados()}
            disabled={loading}
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            {loading ? "Atualizando..." : "Atualizar"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {error && (
          <div className="bg-destructive/15 text-destructive flex items-center p-3 rounded-md mb-4 mx-6 mt-4">
            <AlertCircle className="h-4 w-4 mr-2" />
            <span className="text-sm">{error}</span>
          </div>
        )}
        
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <p>Carregando operações...</p>
          </div>
        ) : operacoesRecentes.length === 0 ? (
          <div className="flex justify-center items-center py-12">
            <p className="text-muted-foreground">Nenhuma operação encontrada</p>
          </div>
        ) : (
          <>
            {/* Versão para desktop */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Moeda</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Preço Unitário</TableHead>
                    <TableHead>Valor Total</TableHead>
                    {!compact && (
                      <>
                        <TableHead>Valor Atual</TableHead>
                        <TableHead>Lucro/Prejuízo</TableHead>
                      </>
                    )}
                    <TableHead>Exchange</TableHead>
                    {!compact && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {operacoesRecentes.map((op) => {
                    const precoAtual = getPrecoAtual(op.moeda_id);
                    const valorAtualizado = calcularValorAtualizado(op);
                    const { valor: lucroPrejuizo, percentual } = calcularLucroOuPrejuizo(op);
                    const moeda = topMoedas.find(m => m.id === op.moeda_id);
                    
                    return (
                      <TableRow key={op.id}>
                        <TableCell>{formatarData(op.data_operacao)}</TableCell>
                        <TableCell>
                          <Badge color={op.tipo === "compra" ? "green" : "red"}>
                            {op.tipo.charAt(0).toUpperCase() + op.tipo.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="flex items-center space-x-2">
                          {moeda ? (
                            <>
                              <img
                                src={moeda.image}
                                alt={moeda.name}
                                className="w-6 h-6 rounded-full"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = "/placeholder-coin.png";
                                }}
                              />
                              <span>{moeda.name}</span>
                            </>
                          ) : (
                            <span>{op.nome}</span>
                          )}
                        </TableCell>
                        <TableCell>{op.quantidade.toFixed(8)}</TableCell>
                        <TableCell>{formatarMoeda(op.preco_unitario)}</TableCell>
                        <TableCell>{formatarMoeda(op.valor_total)}</TableCell>
                        {!compact && (
                          <>
                            <TableCell>{formatarMoeda(valorAtualizado)}</TableCell>
                            <TableCell className={cn(
                              lucroPrejuizo > 0 ? "text-green-600" : lucroPrejuizo < 0 ? "text-red-600" : ""
                            )}>
                              {formatarMoeda(lucroPrejuizo)}
                            </TableCell>
                          </>
                        )}
                        <TableCell>{op.exchange}</TableCell>
                        {!compact && (
                          <TableCell className="text-right">
                            <div className="flex space-x-2">
                              <Button size="sm" variant="outline" onClick={() => editarOperacao(op.id)}>
                                <Pencil className="h-4 w-4 mr-1" />
                                Editar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-500 hover:text-red-700"
                                onClick={() => excluirOperacao(op.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Excluir
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            
            {/* Versão para mobile */}
            <div className="md:hidden">
              {operacoesRecentes.map((op) => {
                const precoAtual = getPrecoAtual(op.moeda_id);
                const valorAtualizado = calcularValorAtualizado(op);
                const { valor: lucroPrejuizo, percentual } = calcularLucroOuPrejuizo(op);
                
                return (
                  <div key={op.id} className="border-t border-border p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium">{op.nome} ({op.simbolo.toUpperCase()})</div>
                        <div className="text-sm text-muted-foreground">{formatarData(op.data_operacao)}</div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        op.tipo === "compra" 
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" 
                          : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                      }`}>
                        {op.tipo === "compra" ? "Compra" : "Venda"}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <div>
                        <span className="text-muted-foreground">Quantidade:</span> {op.quantidade.toFixed(8)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Preço Unit.:</span> {formatarMoeda(op.preco_unitario)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Total:</span> {formatarMoeda(op.valor_total)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Exchange:</span> {op.exchange}
                      </div>
                      {!compact && (
                        <>
                          <div>
                            <span className="text-muted-foreground">Preço Atual:</span> {formatarMoeda(precoAtual)}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Valor Atual:</span> {formatarMoeda(valorAtualizado)}
                          </div>
                          <div className={cn(
                            lucroPrejuizo > 0 ? "text-green-600" : lucroPrejuizo < 0 ? "text-red-600" : ""
                          )}>
                            <span className="text-muted-foreground">Lucro/Prejuízo:</span> {formatarMoeda(lucroPrejuizo)}
                          </div>
                        </>
                      )}
                    </div>
                    
                    {!compact && (
                      <div className="flex justify-end space-x-2 mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => editarOperacao(op.id)}
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => excluirOperacao(op.id)}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Excluir
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
} 