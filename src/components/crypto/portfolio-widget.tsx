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
import { TrendingUp, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
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

// Item do portfólio
interface PortfolioItem {
  moeda_id: string;
  nome: string;
  simbolo: string;
  quantidade: number;
  valorTotal: number;
  valorAtualizado: number;
  lucro: number;
  percentual: number;
  image?: string;
}

// Props do componente
interface PortfolioWidgetProps {
  compact?: boolean;
  className?: string;
}

export function PortfolioWidget({ compact = false, className }: PortfolioWidgetProps) {
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [topMoedas, setTopMoedas] = useState<TopMoeda[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totaisPortfolio, setTotaisPortfolio] = useState({
    valorTotalInvestido: 0,
    valorTotalAtualizado: 0,
    lucroTotal: 0,
  });
  const [percentualTotalPortfolio, setPercentualTotalPortfolio] = useState(0);

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

  // Carregar dados de portfólio e preços
  const carregarDados = async () => {
    try {
      setLoading(true);
      setError(null);
      setTopMoedas([]);
      setPortfolio([]);
      
      // 1. Buscar Operações
      console.log("[PortfolioWidget] Buscando operações...");
      const operacoesResponse = await fetch("/api/crypto/operacoes", {
        method: "GET",
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });

      if (!operacoesResponse.ok) {
        throw new Error(`Erro ${operacoesResponse.status} ao buscar operações`);
      }
      
      const operacoesData = await operacoesResponse.json();
      const fetchedOperacoes = operacoesData?.operacoes || [];
      
      if (!Array.isArray(fetchedOperacoes)) {
          console.error("[PortfolioWidget] Formato inesperado de operações:", fetchedOperacoes);
          throw new Error("Formato inválido de operações recebido.");
      }
      console.log(`[PortfolioWidget] ${fetchedOperacoes.length} operações carregadas.`);

      // 2. Extrair IDs Únicos
      const idsDasOperacoes = [...new Set(fetchedOperacoes.map(op => op.moeda_id))];
      console.log("[PortfolioWidget] IDs únicos das operações:", idsDasOperacoes);

      if (idsDasOperacoes.length === 0) {
        console.log("[PortfolioWidget] Nenhuma operação, nada para exibir.");
        setTotaisPortfolio({ valorTotalInvestido: 0, valorTotalAtualizado: 0, lucroTotal: 0 });
        setPercentualTotalPortfolio(0);
        setLoading(false);
        return; 
      }

      // 3. Buscar Market Data
      const marketDataUrl = `/api/crypto/market-data?ids=${idsDasOperacoes.join(',')}`;
      console.log("[PortfolioWidget] Buscando Market Data de:", marketDataUrl);
      const marketDataResponse = await fetch(marketDataUrl);

      if (!marketDataResponse.ok) {
         // Tratar erro específico de market data (ex: 429)
         const errorText = await marketDataResponse.text().catch(() => "Erro desconhecido");
         console.error(`[PortfolioWidget] Erro ${marketDataResponse.status} ao buscar market data: ${errorText}`);
         throw new Error(`Erro ${marketDataResponse.status} ao buscar preços das moedas.`);
      }
      
      const marketDataMap: MarketDataMap = await marketDataResponse.json();
      console.log("[PortfolioWidget] MarketDataMap recebido:", Object.keys(marketDataMap).length);

      // Transformar o mapa em array TopMoeda para compatibilidade
      const marketDataArray = idsDasOperacoes.map(id => {
        const coinData: FullCoinData | null = marketDataMap[id];
        if (coinData) {
          return {
            id: coinData.id,
            symbol: coinData.symbol,
            name: coinData.name,
            image: coinData.image,
            current_price: coinData.current_price,
            price_change_percentage_24h: coinData.price_change_percentage_24h ?? 0,
            market_cap: coinData.market_cap,
          };
        }
        console.warn(`[PortfolioWidget] Moeda com ID "${id}" não encontrada no marketDataMap.`);
        return null;
      }).filter((moeda): moeda is TopMoeda => moeda !== null);

      setTopMoedas(marketDataArray);
      
      // 4. Calcular portfólio usando os dados de mercado buscados
      const portfolioCalculado = calcularPortfolio(fetchedOperacoes, marketDataArray);
      setPortfolio(portfolioCalculado);
      
      // 5. Calcular totais (usando o portfólio calculado)
      const totais = portfolioCalculado.reduce(
        (acc, item) => {
          acc.valorTotalInvestido += item.valorTotal;
          acc.valorTotalAtualizado += item.valorAtualizado;
          acc.lucroTotal += item.lucro;
          return acc;
        },
        { valorTotalInvestido: 0, valorTotalAtualizado: 0, lucroTotal: 0 }
      );
      
      setTotaisPortfolio(totais);
      
      // Calcular percentual
      const percentual = totais.valorTotalInvestido > 0
        ? (totais.lucroTotal / totais.valorTotalInvestido) * 100
        : 0;
        
      setPercentualTotalPortfolio(percentual);
      
    } catch (err) {
      console.error("[PortfolioWidget] Erro ao carregar dados:", err);
      const errorMessage = err instanceof Error ? err.message : "Erro ao carregar dados do portfólio";
      setError(errorMessage);
      setPortfolio([]);
      setTopMoedas([]);
      setTotaisPortfolio({ valorTotalInvestido: 0, valorTotalAtualizado: 0, lucroTotal: 0 });
      setPercentualTotalPortfolio(0);
    } finally {
      setLoading(false);
    }
  };

  // Obter o preço atual de uma moeda a partir do ID
  const getPrecoAtual = (moedaId: string, moedas: TopMoeda[]): number => {
    const moeda = moedas.find(m => m.id === moedaId);
    return moeda?.current_price || 0;
  };

  // Calcular portfólio consolidado (agrupado por moeda)
  const calcularPortfolio = (operacoes: any[], moedas: TopMoeda[]): PortfolioItem[] => {
    const portfolioMap = new Map<string, PortfolioItem>();
    
    operacoes.forEach((op) => {
      const moedaInfo = moedas.find(m => m.id === op.moeda_id);
      const precoAtual = moedaInfo?.current_price || 0;
      
      let item: PortfolioItem;
      if (portfolioMap.has(op.moeda_id)) {
         item = portfolioMap.get(op.moeda_id)!;
      } else {
         item = {
           moeda_id: op.moeda_id,
           nome: op.nome,
           simbolo: op.simbolo,
           quantidade: 0,
           valorTotal: 0,
           valorAtualizado: 0,
           lucro: 0,
           percentual: 0,
           image: moedaInfo?.image
         };
      }

      if (op.tipo === "compra") {
        item.quantidade += op.quantidade;
        item.valorTotal += op.valor_total;
      } else {
        item.quantidade -= op.quantidade;
      }

      item.valorAtualizado = item.quantidade * precoAtual;
      item.lucro = item.valorAtualizado - item.valorTotal;
      item.percentual = item.valorTotal > 0 ? (item.lucro / item.valorTotal) * 100 : (item.valorAtualizado > 0 ? Infinity : 0);

      portfolioMap.set(op.moeda_id, item);
      
    });
    
    return Array.from(portfolioMap.values())
      .filter(item => item.quantidade > 0.00000001)
      .sort((a, b) => b.valorAtualizado - a.valorAtualizado);
  };

  useEffect(() => {
    carregarDados();
  }, []);

  return (
    <Card className={cn("mb-6", className)}>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-xl">Meu Portfólio</CardTitle>
            <CardDescription>Visão consolidada por criptomoeda</CardDescription>
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
            <p>Carregando portfólio...</p>
          </div>
        ) : portfolio.length === 0 ? (
          <div className="flex justify-center items-center py-12">
            <p className="text-muted-foreground">Nenhuma moeda no portfólio</p>
          </div>
        ) : (
          <>
            {/* Versão para desktop */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Moeda</TableHead>
                    <TableHead>Quantidade</TableHead>
                    {!compact && <TableHead>Valor Total Investido</TableHead>}
                    <TableHead>Valor Total Atual</TableHead>
                    <TableHead>Lucro/Prejuízo</TableHead>
                    <TableHead>%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Mostrar até 5 itens apenas se for compacto */}
                  {(compact ? portfolio.slice(0, 5) : portfolio).map((item) => (
                    <TableRow key={item.moeda_id}>
                      <TableCell className="flex items-center space-x-2">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.nome}
                            className="w-6 h-6 rounded-full"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "/placeholder-coin.png";
                            }}
                          />
                        ) : (
                          <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                            {item.simbolo.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="font-medium">{item.nome}</span>
                        <span className="text-xs text-muted-foreground">
                          ({item.simbolo.toUpperCase()})
                        </span>
                      </TableCell>
                      <TableCell>{item.quantidade.toFixed(8)}</TableCell>
                      {!compact && <TableCell>{formatarMoeda(item.valorTotal)}</TableCell>}
                      <TableCell>{formatarMoeda(item.valorAtualizado)}</TableCell>
                      <TableCell className={cn(
                        item.lucro > 0 ? "text-green-600" : item.lucro < 0 ? "text-red-600" : ""
                      )}>
                        {formatarMoeda(item.lucro)}
                      </TableCell>
                      <TableCell className={cn(
                        item.percentual > 0 ? "text-green-600" : item.percentual < 0 ? "text-red-600" : ""
                      )}>
                        <span className="text-muted-foreground">Rentabilidade:</span> {formatarPercentual(item.percentual)}
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  {/* Linha de totais */}
                  <TableRow className="border-t-2 font-semibold">
                    <TableCell>Total do Portfólio</TableCell>
                    <TableCell></TableCell>
                    {!compact && <TableCell>{formatarMoeda(totaisPortfolio.valorTotalInvestido)}</TableCell>}
                    <TableCell>{formatarMoeda(totaisPortfolio.valorTotalAtualizado)}</TableCell>
                    <TableCell className={cn(
                      totaisPortfolio.lucroTotal > 0 ? "text-green-600" : totaisPortfolio.lucroTotal < 0 ? "text-red-600" : ""
                    )}>
                      {formatarMoeda(totaisPortfolio.lucroTotal)}
                    </TableCell>
                    <TableCell className={cn(
                      percentualTotalPortfolio > 0 ? "text-green-600" : percentualTotalPortfolio < 0 ? "text-red-600" : ""
                    )}>
                      <span className="text-muted-foreground">Rentabilidade:</span> {formatarPercentual(percentualTotalPortfolio)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            
            {/* Versão para mobile */}
            <div className="md:hidden">
              {/* Mostrar até 3 itens apenas se for compacto */}
              {(compact ? portfolio.slice(0, 3) : portfolio).map((item) => (
                <div key={item.moeda_id} className="border-t border-border p-4">
                  <div className="flex items-center mb-2">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.nome}
                        className="w-6 h-6 rounded-full mr-2"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/placeholder-coin.png";
                        }}
                      />
                    ) : (
                      <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center mr-2">
                        {item.simbolo.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="font-medium">{item.nome}</div>
                      <div className="text-xs text-muted-foreground">{item.simbolo.toUpperCase()}</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Quantidade:</span> {item.quantidade.toFixed(8)}
                    </div>
                    {!compact && (
                      <div>
                        <span className="text-muted-foreground">Investido:</span> {formatarMoeda(item.valorTotal)}
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Valor Atual:</span> {formatarMoeda(item.valorAtualizado)}
                    </div>
                    <div className={cn(
                      item.lucro > 0 ? "text-green-600" : item.lucro < 0 ? "text-red-600" : ""
                    )}>
                      <span className="text-muted-foreground">Lucro/Prejuízo:</span> {formatarMoeda(item.lucro)}
                    </div>
                    <div className={cn(
                      item.percentual > 0 ? "text-green-600" : item.percentual < 0 ? "text-red-600" : ""
                    )}>
                      <span className="text-muted-foreground">Rentabilidade:</span> {formatarPercentual(item.percentual)}
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Totais do portfólio para mobile */}
              <div className="border-t-2 border-border p-4">
                <div className="font-semibold mb-2">Total do Portfólio</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {!compact && (
                    <div>
                      <span className="text-muted-foreground">Investido:</span> {formatarMoeda(totaisPortfolio.valorTotalInvestido)}
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Valor Atual:</span> {formatarMoeda(totaisPortfolio.valorTotalAtualizado)}
                  </div>
                  <div className={cn(
                    totaisPortfolio.lucroTotal > 0 ? "text-green-600" : totaisPortfolio.lucroTotal < 0 ? "text-red-600" : ""
                  )}>
                    <span className="text-muted-foreground">Lucro/Prejuízo:</span> {formatarMoeda(totaisPortfolio.lucroTotal)}
                  </div>
                  <div className={cn(
                    percentualTotalPortfolio > 0 ? "text-green-600" : percentualTotalPortfolio < 0 ? "text-red-600" : ""
                  )}>
                    <span className="text-muted-foreground">Rentabilidade:</span> {formatarPercentual(percentualTotalPortfolio)}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
} 