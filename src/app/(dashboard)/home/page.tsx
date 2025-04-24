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
import { MarketDataMap, FullCoinData } from "@/lib/coingecko";

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

// Interface para TopMoeda (manter)
interface TopMoeda { /* ... */ }
// Interface para Operacao (manter)
interface Operacao { /* ... */ }

// --- Novas Interfaces para Tipagem ---
interface PortfolioItem {
  moeda_id: string;
  nome: string;
  simbolo: string;
  quantidade: number;
  valorTotal: number; // Usado no reduce
  valorMedio: number;
  valorAtualizado: number; // Usado no reduce
  lucro: number; // Usado no reduce
  percentual: number;
  image?: string;
  custoMedio: number;
  quantidadeDisponivel: number;
  lucroRealizado: number
}

interface TotaisPortfolio {
  valorTotalInvestido: number;
  valorTotalAtualizado: number;
  lucroTotal: number;
}
// --- Fim Novas Interfaces ---

// Definir os IDs das Top 10 moedas (ajuste conforme necessário)
const TOP_10_COIN_IDS = [
  'bitcoin', 
  'ethereum', 
  'tether', 
  'binancecoin', 
  'solana', 
  'usd-coin', 
  'ripple', 
  'staked-ether', // steth -> staked-ether (ID correto na CoinGecko)
  'dogecoin', 
  'cardano'
];

export default function HomePage() {
  console.log("[HomePage] Iniciando renderização...");
  const router = useRouter();
  const { user } = useAuth();
  const [loadingPortfolio, setLoadingPortfolio] = useState(true);
  const [totaisPortfolio, setTotaisPortfolio] = useState<TotaisPortfolio>({ 
    valorTotalInvestido: 0, 
    valorTotalAtualizado: 0, 
    lucroTotal: 0 
  });
  const [percentualTotalPortfolio, setPercentualTotalPortfolio] = useState(0);
  
  const [topMoedas, setTopMoedas] = useState<TopMoeda[]>([]);
  const [loadingTopMoedas, setLoadingTopMoedas] = useState(true);
  const [errorTopMoedas, setErrorTopMoedas] = useState<string | null>(null);
  
  const { 
    prices, 
    isLoading: isLoadingPrices,
    error: errorPrices
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

  const getPrecoAtual = (moedaId: string, moedasApi: TopMoeda[]): number => {
    const moeda = moedasApi.find(m => m.id === moedaId);
    return moeda ? moeda.current_price : 0;
  };

  const calcularPortfolio = (operacoes: Operacao[], moedasApi: TopMoeda[]): PortfolioItem[] => { 
    console.log("[HomePage] Calculando portfólio com", operacoes.length, "operações e", moedasApi.length, "preços de referência.");
    const portfolioMap = new Map<string, PortfolioItem>(); // Usar a interface

    operacoes
      .sort((a, b) => new Date(a.data_operacao).getTime() - new Date(b.data_operacao).getTime())
      .forEach((op) => {
        const moeda = moedasApi.find(m => m.id === op.moeda_id);
        const precoAtual = getPrecoAtual(op.moeda_id, moedasApi);

        let item: PortfolioItem;
        if (portfolioMap.has(op.moeda_id)) {
          item = portfolioMap.get(op.moeda_id)!;
        } else {
          // Inicializar com valores padrão se for a primeira operação da moeda
          item = {
            moeda_id: op.moeda_id,
            nome: op.nome,
            simbolo: op.simbolo,
            quantidade: 0,
            quantidadeDisponivel: 0,
            valorTotal: 0,
            valorMedio: 0,
            custoMedio: 0,
            valorAtualizado: 0,
            lucro: 0,
            lucroRealizado: 0,
            percentual: 0,
            image: moeda?.image
          };
        }

        if (op.tipo === "compra") {
          const novaQuantidade = item.quantidadeDisponivel + op.quantidade;
          const novoCustoMedio = novaQuantidade > 0
            ? ((item.custoMedio * item.quantidadeDisponivel) + (op.preco_unitario * op.quantidade)) / novaQuantidade
            : 0;

          item.quantidadeDisponivel = novaQuantidade;
          item.custoMedio = novoCustoMedio;
          item.quantidade += op.quantidade; // Quantidade total comprada (histórico)
          item.valorTotal += op.valor_total; // Valor total investido (histórico)
        } else { // Venda
          if (item.quantidadeDisponivel >= op.quantidade) {
            const custoDaVenda = item.custoMedio * op.quantidade;
            const lucroVenda = (op.preco_unitario * op.quantidade) - custoDaVenda;
            item.lucroRealizado += lucroVenda;
            item.quantidadeDisponivel -= op.quantidade;
            // Não decrementamos item.quantidade ou item.valorTotal para manter histórico
          } else {
            console.warn(`[HomePage] Tentativa de vender mais ${op.simbolo} do que disponível.`);
            // Tratar como venda parcial ou ignorar? Por ora, ignora venda inválida.
          }
        }

        // Recalcular valores atuais com base na quantidade disponível
        item.valorAtualizado = item.quantidadeDisponivel * precoAtual;
        const custoAtualDisponivel = item.quantidadeDisponivel * item.custoMedio;
        const lucroNaoRealizado = item.valorAtualizado - custoAtualDisponivel;
        
        item.lucro = item.lucroRealizado + lucroNaoRealizado;
        item.percentual = custoAtualDisponivel > 0 ? (item.lucro / custoAtualDisponivel) * 100 : (item.valorAtualizado > 0 ? Infinity : 0);
        item.valorMedio = item.custoMedio; // Renomear para custoMedio? Já existe.
        
        portfolioMap.set(op.moeda_id, item);
      });

    return Array.from(portfolioMap.values())
       .filter(item => item.quantidadeDisponivel > 0.00000001) // Filtrar moedas zeradas
       .sort((a, b) => b.valorAtualizado - a.valorAtualizado);
  };

  const carregarDados = useCallback(async (refreshTopOnly = false) => {
    console.log("[HomePage] Carregando dados...", { refreshTopOnly });
    if (!refreshTopOnly) {
      setLoadingPortfolio(true);
    }
    setLoadingTopMoedas(true);
    setErrorTopMoedas(null);

    try {
      const topMoedasUrl = `/api/crypto/market-data?ids=${TOP_10_COIN_IDS.join(',')}`;
      console.log("[HomePage] Buscando Top Moedas de:", topMoedasUrl);

      const fetchPromises = [
        fetch(topMoedasUrl)
      ];
      if (!refreshTopOnly) {
        fetchPromises.push(
          fetch("/api/crypto/operacoes", { method: "GET" })
        );
      }

      const responses = await Promise.all(fetchPromises);
      const topMoedasResponse = responses[0];
      const operacoesResponse = responses.length > 1 ? responses[1] : null;

      let localTopMoedasData: TopMoeda[] = []; 

      if (topMoedasResponse.status === 429) {
         setErrorTopMoedas("Limite de requisições excedido. Tente novamente em alguns minutos.");
         setTopMoedas([]);
      } else if (!topMoedasResponse.ok) {
         const errorData = await topMoedasResponse.json().catch(() => ({}));
         console.error("[HomePage] Erro ao buscar market-data:", topMoedasResponse.status, errorData);
         setErrorTopMoedas(`Erro ${topMoedasResponse.status} ao buscar dados das moedas.`);
         setTopMoedas([]); 
      } else {
         const marketDataMap: MarketDataMap = await topMoedasResponse.json();
         console.log("[HomePage] Dados de MarketDataMap recebidos:", Object.keys(marketDataMap).length, "moedas no mapa.");
        
         localTopMoedasData = TOP_10_COIN_IDS.map(id => {
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
           console.warn(`[HomePage] Moeda com ID "${id}" não encontrada no marketDataMap.`);
           return null; 
         }).filter((moeda): moeda is TopMoeda => moeda !== null);

         console.log("[HomePage] Dados de Top Moedas processados:", localTopMoedasData.length);
         setTopMoedas(localTopMoedasData);
         setErrorTopMoedas(null);
      }
      
      if (operacoesResponse) {
        if (!operacoesResponse.ok) {
            console.error("[HomePage] Erro ao buscar operações:", operacoesResponse.status);
        } else {
          const operacoesData = await operacoesResponse.json();
          console.log("[HomePage] Dados de Operações recebidos:", operacoesData?.length);
          if (!Array.isArray(operacoesData)) {
              console.error("[HomePage] Formato inesperado para operações:", operacoesData);
          } else {
             const portfolioCalculado: PortfolioItem[] = calcularPortfolio(operacoesData || [], localTopMoedasData);
             console.log("[HomePage] Portfólio Calculado:", portfolioCalculado);
             // Adicionar tipos ao reduce
             const totaisCalculados: TotaisPortfolio = portfolioCalculado.reduce(
              (acc: TotaisPortfolio, item: PortfolioItem) => {
                // Usar valorTotal da operação histórica ou custoAtualDisponivel?
                // A lógica anterior parecia usar o custo baseado no custo médio.
                // Para corresponder aos cards, precisamos do valor atualizado total e do lucro/prejuízo total.
                // Valor Investido Total: Soma do (custoMedio * quantidadeDisponivel) ? Ou soma do valor_total das compras?
                // Vamos usar o custo atual para consistência com o lucro.
                const custoAtualDisponivelItem = item.quantidadeDisponivel * item.custoMedio;
                acc.valorTotalInvestido += custoAtualDisponivelItem; // Custo atual do que está em carteira
                acc.valorTotalAtualizado += item.valorAtualizado;
                acc.lucroTotal += item.lucro;
                return acc;
              },
              // Inicializar com a estrutura TotaisPortfolio
              { valorTotalInvestido: 0, valorTotalAtualizado: 0, lucroTotal: 0 }
            );
            setTotaisPortfolio(totaisCalculados); // Usar o resultado tipado
            const percentual = totaisCalculados.valorTotalInvestido > 0
              ? (totaisCalculados.lucroTotal / totaisCalculados.valorTotalInvestido) * 100
              : 0;
            setPercentualTotalPortfolio(percentual);
          }
        }
      }
    } catch (err) {
       console.error("[HomePage] Erro geral ao carregar dados:", err);
       if (!errorTopMoedas) setErrorTopMoedas("Erro ao carregar dados.");
       setTopMoedas([]);
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
                            {formatarMoeda(displayPrice)}
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
                      <div className="font-medium">{formatarMoeda(getPrecoAtual(moeda.id, topMoedas))}</div>
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
    </div>
  );
} 