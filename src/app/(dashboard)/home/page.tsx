"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { Settings, TrendingUp, Wallet, CreditCard, TrendingDown, AlertCircle, Bitcoin } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Image from "next/image";
import { MarketDataMap, FullCoinData } from "@/lib/coingecko";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { CryptoPerformanceState, PerformanceSummary } from "@/types/crypto";

interface TopMoeda {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
}

const TOP_10_COIN_IDS = [
  'bitcoin', 
  'ethereum', 
  'tether', 
  'binancecoin', 
  'solana', 
  'usd-coin', 
  'ripple', 
  'staked-ether',
  'dogecoin', 
  'cardano'
];

export default function HomePage() {
  console.log("[HomePage] Iniciando renderização...");
  const router = useRouter();
  const { user } = useAuth();
  
  const [performanceData, setPerformanceData] = useState<CryptoPerformanceState | null>(null);
  const [loadingPerformance, setLoadingPerformance] = useState(true);
  const [errorPerformance, setErrorPerformance] = useState<string | null>(null);

  const [topMoedas, setTopMoedas] = useState<TopMoeda[]>([]);
  const [loadingTopMoedas, setLoadingTopMoedas] = useState(true);
  const [errorTopMoedas, setErrorTopMoedas] = useState<string | null>(null);

  const formatarPercentual = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(valor / 100);
  };

  const getPrecoAtual = (moedaId: string, moedasApi: TopMoeda[]): number => {
    const moeda = moedasApi.find(m => m.id === moedaId);
    return moeda ? moeda.current_price : 0;
  };

  const carregarPerformance = useCallback(async () => {
    console.log("[HomePage] Carregando dados de performance...");
    setLoadingPerformance(true);
    setErrorPerformance(null);

    if (!user) {
      console.warn("[HomePage] carregarPerformance chamado sem usuário.");
      setLoadingPerformance(false);
      setPerformanceData(null);
      return;
    }

    try {
      const response = await fetch('/api/crypto/performance');
      const result = await response.json();
      
      if (!response.ok) {
        let errorMsg = result.error || `Erro ao carregar performance: ${response.statusText}`;
        if (response.status === 429) {
           errorMsg = "Falha ao buscar dados de mercado da CoinGecko: Limite de requisições excedido (429).";
        }
        if (result.details && result.details.error) {
            errorMsg = result.details.error;
        } else if (typeof result === 'string') {
            errorMsg = result;
        }
        console.error("[HomePage] Erro recebido da API de performance:", result);
        throw new Error(errorMsg);
      }
      
      console.log("[HomePage] Dados de performance recebidos:", result);
      if (!result || !result.summary) {
          console.error("[HomePage] Formato inesperado para dados de performance:", result);
          throw new Error("Formato de dados de performance inesperado recebido da API.");
      }
      setPerformanceData(result);

    } catch (err: any) {
      console.error("[HomePage] Erro ao buscar dados de performance:", err);
      setErrorPerformance(err.message || "Erro desconhecido ao carregar performance.");
      setPerformanceData(null);
    } finally {
      setLoadingPerformance(false);
    }
  }, [user]);

  const carregarTopMoedas = useCallback(async () => {
    console.log("[HomePage] Carregando Top Moedas...");
    setLoadingTopMoedas(true);
    setErrorTopMoedas(null);
    try {
      const topMoedasUrl = `/api/crypto/market-data?ids=${TOP_10_COIN_IDS.join(',')}`;
      const response = await fetch(topMoedasUrl);
      if (response.status === 429) throw new Error("Limite de requisições excedido (CoinGecko).");
      if (!response.ok) {
           const errorData = await response.json().catch(() => ({}));
           const errorMsg = errorData?.error?.message || errorData?.status?.error_message || `Erro ${response.status} ao buscar dados das moedas.`;
           console.error("[HomePage] Erro ao buscar market-data:", response.status, errorData);
           throw new Error(errorMsg);
      }

      const marketDataMap: MarketDataMap = await response.json();
      const moedasProcessadas = TOP_10_COIN_IDS.map(id => {
          const coinData: FullCoinData | null = marketDataMap[id];
          if (coinData) {
             return {
                id: coinData.id,
                symbol: coinData.symbol,
                name: coinData.name,
                image: coinData.image,
                current_price: coinData.current_price ?? 0,
                price_change_percentage_24h: coinData.price_change_percentage_24h ?? 0,
                market_cap: coinData.market_cap ?? 0,
              };
          }
          console.warn(`[HomePage] Moeda com ID "${id}" não encontrada no marketDataMap.`);
          return null;
        }).filter(Boolean) as TopMoeda[];
      setTopMoedas(moedasProcessadas);

    } catch (err: any) {
      console.error("[HomePage] Erro ao buscar Top Moedas:", err);
      setErrorTopMoedas(err.message || "Erro desconhecido ao carregar top moedas.");
      setTopMoedas([]);
    } finally {
      setLoadingTopMoedas(false);
    }
  }, []);

  useEffect(() => {
    console.log('[HomePage] useEffect [user] disparado.');
    if (user) {
      console.log('[HomePage] Usuário definido. Carregando dados...');
      carregarPerformance();
      carregarTopMoedas();
    } else {
      console.log('[HomePage] Usuário não definido, limpando dados...');
      setPerformanceData(null);
      setLoadingPerformance(true);
      setTopMoedas([]);
      setLoadingTopMoedas(true);
      setErrorTopMoedas(null);
    }
  }, [user, carregarPerformance, carregarTopMoedas]);
  
  console.log("[HomePage] Renderização concluída.");

  const { summary } = performanceData || {};
  const valorTotalAtual = summary?.valorTotalAtual ?? 0;
  const totalInvestido = summary ? (summary.valorTotalAtual - summary.totalNaoRealizado) : 0;
  const lucroNaoRealizado = summary?.totalNaoRealizado ?? 0;
  const lucroRealizado = summary?.totalRealizado ?? 0;

  return (
    <div className="w-full px-4 py-10">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Bem-vindo, {user?.email?.split('@')[0] ?? 'Usuário'}</h1>
        <p className="text-muted-foreground">
          Aqui está um resumo do seu portfólio.
        </p>
      </div>
      
      {errorPerformance && (
            <div className="bg-destructive/15 text-destructive flex items-center p-3 rounded-md mb-4">
              <AlertCircle className="h-4 w-4 mr-2" />
              <span className="text-sm">Erro ao carregar resumo do portfólio: {errorPerformance}</span>
            </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Portfólio
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              $ {loadingPerformance ? "Carregando..." : formatCurrency(valorTotalAtual)}
            </div>
             <p className="text-xs text-muted-foreground">
                Valor atual de mercado
             </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Custo Base Total
            </CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              $ {loadingPerformance ? "Carregando..." : formatCurrency(totalInvestido)}
            </div>
             <p className="text-xs text-muted-foreground">
                Custo total de aquisição
             </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              L/P Não Realizado
            </CardTitle>
            {lucroNaoRealizado >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${lucroNaoRealizado >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {lucroNaoRealizado >= 0 ? '+' : '-'} $ {loadingPerformance ? "Carregando..." : formatCurrency(Math.abs(lucroNaoRealizado))}
            </div>
             <p className="text-xs text-muted-foreground">
                Ganhos/Perdas em ativos atuais
             </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              L/P Realizado
            </CardTitle>
             <Bitcoin className="h-4 w-4 text-muted-foreground" /> 
          </CardHeader>
          <CardContent>
             <div className={`text-2xl font-bold ${lucroRealizado >= 0 ? '' : 'text-red-500'}`}>
               {lucroRealizado >= 0 ? '+' : '-'} $ {loadingPerformance ? "Carregando..." : formatCurrency(Math.abs(lucroRealizado))}
            </div>
             <p className="text-xs text-muted-foreground">
               Ganhos/Perdas de vendas
             </p>
          </CardContent>
        </Card>
      </div>
      
      <Card className="mb-8">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-xl">Top 10 Criptomoedas</CardTitle>
              <CardDescription>Valores atualizados do mercado</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={carregarTopMoedas}
              disabled={loadingTopMoedas}
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              {loadingTopMoedas ? "Atualizando..." : "Atualizar"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {errorTopMoedas && (
            <div className="bg-destructive/15 text-destructive flex items-center p-3 rounded-md mb-4">
              <AlertCircle className="h-4 w-4 mr-2" />
              <span className="text-sm">Erro ao carregar top moedas: {errorTopMoedas}</span>
            </div>
          )}
          
          {loadingTopMoedas ? (
            <div className="flex justify-center items-center py-6">
              <p>Carregando top criptomoedas...</p>
            </div>
          ) : topMoedas.length === 0 && !errorTopMoedas ? (
            <div className="flex justify-center items-center py-6">
              <p className="text-muted-foreground">Nenhuma informação disponível</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Moeda</TableHead>
                      <TableHead className="text-right">Preço</TableHead>
                      <TableHead className="text-right">24h %</TableHead>
                      <TableHead className="text-right">Cap. de Mercado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topMoedas.map((moeda, index) => {
                      const displayPrice = getPrecoAtual(moeda.id, topMoedas);
                      
                      return (
                        <TableRow key={moeda.id}>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              {moeda.image && (
                                <div className="relative w-6 h-6 mr-2">
                                  <Image
                                    src={moeda.image}
                                    alt={moeda.name}
                                    fill
                                    className="object-contain"
                                  />
                                </div>
                              )}
                              <span className="font-medium">{moeda.name}</span>
                              <span className="ml-2 text-xs text-muted-foreground uppercase">
                                {moeda.symbol}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            $ {formatCurrency(displayPrice)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={moeda.price_change_percentage_24h >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {moeda.price_change_percentage_24h?.toFixed(2) ?? '0.00'}%
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            $ {moeda.market_cap ? formatCurrency(moeda.market_cap) : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="md:hidden space-y-4">
                {topMoedas.map((moeda, index) => (
                  <div key={moeda.id} className="flex items-center justify-between p-2 border-b border-border">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium w-6 text-center">{index + 1}</span>
                      <div className="relative w-6 h-6">
                        {moeda.image && (
                          <Image
                            src={moeda.image}
                            alt={moeda.name}
                            fill
                            className="object-contain"
                          />
                        )}
                      </div>
                      <div>
                        <div className="font-medium">{moeda.name}</div>
                        <div className="text-xs text-muted-foreground uppercase">{moeda.symbol}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">$ {formatCurrency(getPrecoAtual(moeda.id, topMoedas))}</div>
                      <div className={moeda.price_change_percentage_24h >= 0 ? 'text-green-600 text-xs' : 'text-red-600 text-xs'}>
                        {moeda.price_change_percentage_24h?.toFixed(2) ?? '0.00'}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 