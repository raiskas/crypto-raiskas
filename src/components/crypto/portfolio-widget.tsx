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
      
      const [topMoedasResponse, operacoesResponse] = await Promise.all([
        fetch("/api/crypto/top-moedas", {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        }),
        fetch("/api/crypto/operacoes", {
          method: "GET",
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        })
      ]);
      
      if (!topMoedasResponse.ok || !operacoesResponse.ok) {
        throw new Error("Erro ao carregar dados de criptomoedas");
      }
      
      const topMoedasData = await topMoedasResponse.json();
      const operacoesData = await operacoesResponse.json();
      
      setTopMoedas(topMoedasData || []);
      
      // Calcular portfólio
      const portfolioCalculado = calcularPortfolio(operacoesData.operacoes || [], topMoedasData);
      setPortfolio(portfolioCalculado);
      
      // Calcular totais
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
      console.error("Erro ao carregar portfólio:", err);
      setError("Erro ao carregar dados do portfólio");
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
  const calcularPortfolio = (operacoes: any[], moedas: TopMoeda[]) => {
    // Criar um mapa para armazenar as informações por moeda
    const portfolioMap = new Map<string, PortfolioItem>();
    
    // Processar cada operação
    operacoes.forEach((op) => {
      const moeda = moedas.find(m => m.id === op.moeda_id);
      const precoAtual = getPrecoAtual(op.moeda_id, moedas);
      
      // Se a moeda já existe no mapa, atualizar os valores
      if (portfolioMap.has(op.moeda_id)) {
        const item = portfolioMap.get(op.moeda_id)!;
        
        // Atualizar quantidade (adicionar para compras, subtrair para vendas)
        if (op.tipo === "compra") {
          item.quantidade += op.quantidade;
          item.valorTotal += op.valor_total;
        } else {
          item.quantidade -= op.quantidade;
        }
        
        // Atualizar valores calculados
        item.valorAtualizado = item.quantidade * precoAtual;
        item.lucro = item.valorAtualizado - item.valorTotal;
        item.percentual = item.valorTotal > 0 ? (item.lucro / item.valorTotal) * 100 : 0;
        
        portfolioMap.set(op.moeda_id, item);
      } else {
        // Se a moeda não existe no mapa e for uma compra, adicionar
        if (op.tipo === "compra") {
          portfolioMap.set(op.moeda_id, {
            moeda_id: op.moeda_id,
            nome: op.nome,
            simbolo: op.simbolo,
            quantidade: op.quantidade,
            valorTotal: op.valor_total,
            valorAtualizado: op.quantidade * precoAtual,
            lucro: (op.quantidade * precoAtual) - op.valor_total,
            percentual: op.valor_total > 0 ? (((op.quantidade * precoAtual) - op.valor_total) / op.valor_total) * 100 : 0,
            image: moeda?.image
          });
        }
      }
    });
    
    // Filtrar portfólio para remover moedas com quantidade zero ou negativa
    // e converter para array
    return Array.from(portfolioMap.values())
      .filter(item => item.quantidade > 0)
      .sort((a, b) => b.valorAtualizado - a.valorAtualizado); // Ordenar por valor atualizado
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
                    <TableHead>Percentual</TableHead>
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
                        {formatarPercentual(item.percentual)}
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
                      {formatarPercentual(percentualTotalPortfolio)}
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