"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { Settings, TrendingUp, Wallet, CreditCard, TrendingDown, AlertCircle, Bitcoin } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Image from "next/image";
import { usePrice } from '@/lib/context/PriceContext';

interface TopMoeda {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
}

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
  grupo_id?: string;
}

export default function HomePage() {
  console.log("[HomePage] Iniciando renderização...");
  const router = useRouter();
  const { user } = useAuth();
  const [loadingPortfolio, setLoadingPortfolio] = useState(true);
  const [totaisPortfolio, setTotaisPortfolio] = useState({
    valorTotalInvestido: 0,
    valorTotalAtualizado: 0,
    lucroTotal: 0,
  });
  const [percentualTotalPortfolio, setPercentualTotalPortfolio] = useState(0);
  
  const [topMoedas, setTopMoedas] = useState<TopMoeda[]>([]);
  const [loadingTopMoedas, setLoadingTopMoedas] = useState(true);
  const [errorTopMoedas, setErrorTopMoedas] = useState<string | null>(null);
  
  const { 
    price: btcPrice, 
    isLoading: isLoadingBtcPrice, 
    error: errorBtcPrice 
  } = usePrice();

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

  const getPrecoAtual = (moedaId: string, moedas: TopMoeda[]): number => {
    const moeda = moedas.find(m => m.id === moedaId);
    return moeda?.current_price || 0;
  };

  const calcularPortfolio = (operacoes: Operacao[], moedas: TopMoeda[]) => {
    const portfolioMap = new Map<string, {
      moeda_id: string;
      nome: string;
      simbolo: string;
      quantidade: number;
      valorTotal: number;
      valorMedio: number;
      valorAtualizado: number;
      lucro: number;
      percentual: number;
      image?: string;
      custoMedio: number;
      quantidadeDisponivel: number;
      lucroRealizado: number
    }>();
    
    operacoes
      .sort((a, b) => new Date(a.data_operacao).getTime() - new Date(b.data_operacao).getTime())
      .forEach((op) => {
        const moeda = moedas.find(m => m.id === op.moeda_id);
        const precoAtual = getPrecoAtual(op.moeda_id, moedas);
        
        if (portfolioMap.has(op.moeda_id)) {
          const item = portfolioMap.get(op.moeda_id)!;
          
          if (op.tipo === "compra") {
            const novaQuantidade = item.quantidadeDisponivel + op.quantidade;
            const novoCustoMedio = novaQuantidade > 0 
              ? ((item.custoMedio * item.quantidadeDisponivel) + (op.preco_unitario * op.quantidade)) / novaQuantidade 
              : 0;
            
            item.quantidadeDisponivel = novaQuantidade;
            item.custoMedio = novoCustoMedio;
            item.quantidade += op.quantidade;
            item.valorTotal += op.valor_total;
          } else { 
            if (item.quantidadeDisponivel >= op.quantidade) {
              const lucroVenda = (op.preco_unitario - item.custoMedio) * op.quantidade;
              item.lucroRealizado += lucroVenda;
              item.quantidadeDisponivel -= op.quantidade;
              item.quantidade -= op.quantidade;
              item.valorTotal -= (item.custoMedio * op.quantidade); 
            }
          }
          
          item.valorAtualizado = item.quantidadeDisponivel * precoAtual;
          item.valorMedio = item.custoMedio;
          item.lucro = item.lucroRealizado + (item.valorAtualizado - (item.quantidadeDisponivel * item.custoMedio));
          const valorCustoAtual = item.quantidadeDisponivel * item.custoMedio;
          item.percentual = valorCustoAtual > 0 ? (item.lucro / valorCustoAtual) * 100 : 0;
          
          portfolioMap.set(op.moeda_id, item);
        } else {
          if(op.tipo === "compra") { 
            const novoItem = {
              moeda_id: op.moeda_id,
              nome: op.nome,
              simbolo: op.simbolo,
              quantidade: op.quantidade,
              quantidadeDisponivel: op.quantidade,
              valorTotal: op.valor_total,
              valorMedio: op.preco_unitario,
              custoMedio: op.preco_unitario,
              valorAtualizado: op.quantidade * precoAtual,
              lucro: 0,
              lucroRealizado: 0,
              percentual: 0,
              image: moeda?.image
            };
            novoItem.lucro = novoItem.valorAtualizado - novoItem.valorTotal;
            novoItem.percentual = novoItem.valorTotal > 0 ? (novoItem.lucro / novoItem.valorTotal) * 100 : 0;
            portfolioMap.set(op.moeda_id, novoItem);
          }
        }
      });
    
    return Array.from(portfolioMap.values())
      .filter(item => item.quantidadeDisponivel > 0.00000001)
      .sort((a, b) => b.valorAtualizado - a.valorAtualizado);
  };

  const formattedBtcPrice = btcPrice !== null
    ? btcPrice.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
    : '---';

  const carregarDados = useCallback(async (refreshTopOnly = false) => {
    console.log("[HomePage] Carregando dados...", { refreshTopOnly });
    if (!refreshTopOnly) {
      setLoadingPortfolio(true);
    }
    setLoadingTopMoedas(true);
    setErrorTopMoedas(null);

    try {
      let localTopMoedasData: TopMoeda[] = [];

      const fetchPromises = [
        fetch("/api/crypto/top-moedas", { headers: { /* ... */ } })
      ];
      if (!refreshTopOnly) {
        fetchPromises.push(
          fetch("/api/crypto/operacoes", { method: "GET", headers: { /* ... */ } })
        );
      }

      const responses = await Promise.all(fetchPromises);
      const topMoedasResponse = responses[0];
      const operacoesResponse = responses.length > 1 ? responses[1] : null;

      if (topMoedasResponse.status === 429) {
        setErrorTopMoedas("Limite de requisições excedido. Tente novamente em alguns minutos."); 
        setTopMoedas([]);
      } else if (!topMoedasResponse.ok) {
        setErrorTopMoedas("Erro ao buscar dados de criptomoedas."); 
        setTopMoedas([]);
      } else {
        const fetchedData = await topMoedasResponse.json();
        localTopMoedasData = fetchedData || [];
        console.log("[HomePage] Dados de Top Moedas recebidos:", localTopMoedasData.length);
        setTopMoedas(localTopMoedasData);
        setErrorTopMoedas(null);
      }
      
      if (operacoesResponse) {
        if (!operacoesResponse.ok) {
           console.error(/* ... */);
        } else {
          const operacoesData = await operacoesResponse.json();
          console.log("[HomePage] Dados de Operações recebidos:", operacoesData?.length);
          if (!Array.isArray(operacoesData)) {
            console.error(/* ... */);
          } else {
            const portfolioCalculado = calcularPortfolio(operacoesData || [], localTopMoedasData);
            console.log("[HomePage] Portfólio Calculado:", portfolioCalculado);
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
            
            const percentual = totais.valorTotalInvestido > 0
              ? (totais.lucroTotal / totais.valorTotalInvestido) * 100
              : 0;
              
            setPercentualTotalPortfolio(percentual);
          }
        }
      }
    } catch (err) {
      console.error("Erro geral ao carregar dados:", err);
      if (!errorTopMoedas) setErrorTopMoedas("Erro ao carregar dados.");
    } finally {
      setLoadingPortfolio(false);
      setLoadingTopMoedas(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      carregarDados();
    }
  }, [user, carregarDados]);
  
  console.log("[HomePage] Renderização concluída.");
  return (
    <div className="w-full px-4 py-10">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Bem-vindo, {user?.email}</h1>
        <p className="text-muted-foreground">
          O que você gostaria de fazer hoje?
        </p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Portfólio
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingPortfolio ? "Carregando..." : formatarMoeda(totaisPortfolio.valorTotalAtualizado)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Investido
            </CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingPortfolio ? "Carregando..." : formatarMoeda(totaisPortfolio.valorTotalInvestido)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Lucro/Prejuízo
            </CardTitle>
            {totaisPortfolio.lucroTotal >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totaisPortfolio.lucroTotal >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {loadingPortfolio ? "Carregando..." : (
                `${formatarMoeda(totaisPortfolio.lucroTotal)} (${formatarPercentual(percentualTotalPortfolio)})`
              )}
            </div>
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
              onClick={() => carregarDados(true)} 
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
              <span className="text-sm">{errorTopMoedas}</span>
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
                    {topMoedas.map((moeda, index) => (
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
                          {formatarMoeda(moeda.current_price)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={moeda.price_change_percentage_24h >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {moeda.price_change_percentage_24h.toFixed(2)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatarMoeda(moeda.market_cap)}
                        </TableCell>
                      </TableRow>
                    ))}
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
                      <div className="font-medium">{formatarMoeda(moeda.current_price)}</div>
                      <div className={moeda.price_change_percentage_24h >= 0 ? 'text-green-600 text-xs' : 'text-red-600 text-xs'}>
                        {moeda.price_change_percentage_24h.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="w-full md:w-auto md:max-w-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Preço Bitcoin (USD)</CardTitle>
          <Bitcoin className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {isLoadingBtcPrice ? (
            <div className="text-2xl font-bold animate-pulse">Carregando...</div>
          ) : errorBtcPrice ? (
            <div className="text-sm font-medium text-destructive">{errorBtcPrice}</div>
          ) : (
            <div className="text-2xl font-bold">{formattedBtcPrice}</div>
          )}
          <p className="text-xs text-muted-foreground">
            Atualizado via PriceProvider
          </p>
        </CardContent>
      </Card>
    </div>
  );
} 