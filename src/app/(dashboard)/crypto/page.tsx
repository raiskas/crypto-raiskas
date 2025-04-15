"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, ArrowUpDown, Plus, Trash2, Edit, Search, TrendingUp, Pencil, Wallet, CreditCard, TrendingDown } from "lucide-react";
import { useAuth } from "@/lib/hooks/use-auth";
import { useUserData } from "@/lib/hooks/use-user-data";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// Tipo para as operações de cripto
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

export default function CryptoPage() {
  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, checkAuthState } = useAuth();
  const { userData } = useUserData();
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState("todas");
  const [filtro, setFiltro] = useState("");
  const [mounted, setMounted] = useState(false);
  const [topMoedas, setTopMoedas] = useState<TopMoeda[]>([]);
  const [loadingTopMoedas, setLoadingTopMoedas] = useState(false);
  const [errorTopMoedas, setErrorTopMoedas] = useState<string | null>(null);

  // Verificar se a tabela crypto_operacoes existe e criar se necessário
  const verificarTabelaCryptoOperacoes = async () => {
    try {
      console.log("[Crypto] Verificando se a tabela crypto_operacoes existe");
      
      // Acessar o endpoint público para setup de banco de dados
      const setupResponse = await fetch("/api/admin/setup-database", {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      const setupResult = await setupResponse.json();
      console.log("[Crypto] Resultado da verificação da tabela:", setupResult);
      
      if (!setupResponse.ok) {
        console.warn("[Crypto] A tabela pode não existir:", setupResult.error);
      }
    } catch (err) {
      console.error("[Crypto] Erro ao verificar/criar tabela:", err);
    }
  };

  // Função de carregamento de dados memoizada - sem dependência em mounted
  const carregarDados = useCallback(async (forceLoading = false) => {
    console.log("[Crypto] Carregando dados da página");
    try {
      // Define loading se solicitado
      if (forceLoading) {
        setLoading(true);
        setError(null);
      }
      
      // Buscar dados diretamente - sem verificação de mounted
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
          },
          cache: 'no-store'
        })
      ]);
      
      // Processar resposta das top moedas
      if (topMoedasResponse.status === 429) {
        console.error("[Crypto] Limite de requisições excedido para top moedas");
        setErrorTopMoedas("Limite de requisições excedido. Tente novamente em alguns minutos.");
      } else if (!topMoedasResponse.ok) {
        console.error("[Crypto] Erro ao buscar top moedas:", topMoedasResponse.statusText);
        setErrorTopMoedas("Erro ao buscar dados de criptomoedas.");
      } else {
        // Resposta OK, processar dados
        const topMoedasData = await topMoedasResponse.json();
        setTopMoedas(topMoedasData || []);
        setErrorTopMoedas(null);
      }
      
      // Processar resposta das operações
      if (!operacoesResponse.ok) {
        console.error(`[Crypto] Erro ao buscar operações: ${operacoesResponse.status} - ${operacoesResponse.statusText || 'Erro desconhecido'}`);
        
        // Tentar obter detalhes do erro
        let mensagemErro = "Erro ao buscar operações. Verifique se a tabela crypto_operacoes existe no banco de dados.";
        try {
          const errorData = await operacoesResponse.json();
          console.error("[Crypto] Detalhes do erro:", errorData);
          if (errorData.error) {
            mensagemErro = `Erro: ${errorData.error}`;
          }
        } catch (e) {
          console.error("[Crypto] Erro ao ler resposta de erro:", e);
        }
        
        setError(mensagemErro);
        setOperacoes([]);
      } else {
        // Resposta OK, processar dados
        const operacoesData = await operacoesResponse.json();
        console.log("[Crypto] Resposta completa da API de operações:", operacoesData);
        
        const operacoesApi = operacoesData.operacoes || [];
        if (operacoesApi.length === 0) {
          console.log("[Crypto] Nenhuma operação encontrada");
          setError("Nenhuma operação encontrada. Verifique se você já cadastrou alguma operação.");
        } else {
          console.log(`[Crypto] ${operacoesApi.length} operações carregadas`);
          setError(null);
        }
        
        setOperacoes(operacoesApi);
      }
    } catch (err) {
      console.error("[Crypto] Erro ao carregar dados:", err);
      setError("Erro ao carregar dados. Por favor, tente novamente mais tarde.");
    } finally {
      // Resetar estados de loading
      setLoading(false);
      setLoadingTopMoedas(false);
    }
  }, []);

  // Carregar dados ao iniciar
  useEffect(() => {
    let isMounted = true;
    setMounted(true);
    
    const init = async () => {
      if (!isMounted) return;
      
      try {
        // Verificar se a tabela existe
        await verificarTabelaCryptoOperacoes();
        
        // Usar a função memoizada para carregar os dados com loading=true
        await carregarDados(true);
      } catch (err: any) {
        console.error("Erro na inicialização:", err);
        
        if (isMounted) {
          setError("Erro ao carregar dados. Por favor, tente novamente mais tarde.");
          setLoading(false);
        }
      }
    };
    
    init();
    
    // Configurar intervalo para atualizar automaticamente as top moedas a cada 2 minutos
    const intervalId = setInterval(() => {
      if (isMounted) {
        console.log("[Crypto] Atualizando top moedas automaticamente");
        carregarDados();
      }
    }, 2 * 60 * 1000); // 2 minutos
    
    return () => {
      isMounted = false;
      setMounted(false);
      clearInterval(intervalId);
    };
  }, [carregarDados]);
  
  // Recarregar dados quando o foco retorna à janela
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && mounted) {
        console.log("[Crypto] Página recebeu foco, recarregando dados");
        // Carregar ambos os dados
        carregarDados();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [mounted]);

  // Recarregar dados ao navegar para esta rota
  useEffect(() => {
    // Esta verificação garante que o componente está montado e que estamos na página de criptomoedas
    if (mounted && pathname === '/crypto') {
      console.log("[Crypto] Navegou para a página de criptomoedas, recarregando dados");
      carregarDados();
    }
  }, [pathname, mounted, carregarDados]);

  // Recarregar dados quando a página terminar de carregar completamente
  useEffect(() => {
    const handleLoad = () => {
      if (mounted) {
        console.log("[Crypto] Página completamente carregada, verificando dados");
        // Se não tiver dados, recarregar
        if (topMoedas.length === 0 || operacoes.length === 0) {
          console.log("[Crypto] Dados insuficientes, recarregando...");
          carregarDados();
        }
      }
    };
    
    window.addEventListener('load', handleLoad);
    
    return () => {
      window.removeEventListener('load', handleLoad);
    };
  }, [mounted, topMoedas.length, operacoes.length, carregarDados]);

  // Filtrar operações com base no tipo e texto de busca
  const operacoesFiltradas = operacoes.filter((op) => {
    // Filtrar por tipo (compra/venda/todas)
    const tipoMatch = activeTab === "todas" || op.tipo === activeTab;
    
    // Filtrar por texto (nome, símbolo ou exchange)
    const textMatch = filtro === "" || 
      op.nome.toLowerCase().includes(filtro.toLowerCase()) ||
      op.simbolo.toLowerCase().includes(filtro.toLowerCase()) ||
      op.exchange.toLowerCase().includes(filtro.toLowerCase());
    
    return tipoMatch && textMatch;
  });

  // Calcular totais de investimento
  const calcularTotais = () => {
    const compras = operacoes
      .filter(op => op.tipo === "compra")
      .reduce((total, op) => total + op.valor_total, 0);
    
    const vendas = operacoes
      .filter(op => op.tipo === "venda")
      .reduce((total, op) => total + op.valor_total, 0);
    
    return {
      compras,
      vendas,
      saldo: vendas - compras
    };
  };

  const totais = calcularTotais();

  // Formatar data
  const formatarData = (dataStr: string) => {
    try {
      return format(new Date(dataStr), "dd/MM/yyyy", { locale: ptBR });
    } catch (e) {
      return "Data inválida";
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
      // Para compras: lucro não realizado = valor atual - valor de compra
      lucro = valorAtualizado - op.valor_total;
      percentual = op.valor_total > 0 ? (lucro / op.valor_total) * 100 : 0;
    } else {
      // Para vendas: lucro realizado = valor de venda - custo médio das moedas
      // Encontrar o custo médio das moedas vendidas usando FIFO
      const operacoesAnteriores = operacoes
        .filter(o => o.moeda_id === op.moeda_id && o.tipo === "compra" && new Date(o.data_operacao) <= new Date(op.data_operacao))
        .sort((a, b) => new Date(a.data_operacao).getTime() - new Date(b.data_operacao).getTime());
      
      let quantidadeRestante = op.quantidade;
      let custoTotal = 0;
      
      for (const compra of operacoesAnteriores) {
        if (quantidadeRestante <= 0) break;
        
        const quantidadeUsada = Math.min(quantidadeRestante, compra.quantidade);
        custoTotal += quantidadeUsada * compra.preco_unitario;
        quantidadeRestante -= quantidadeUsada;
      }
      
      lucro = op.valor_total - custoTotal;
      percentual = custoTotal > 0 ? (lucro / custoTotal) * 100 : 0;
    }
    
    return { valor: lucro, percentual };
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

  // Formatar quantidade
  const formatarQuantidade = (valor: number) => {
    // Se o valor for inteiro, não mostra casas decimais
    if (Number.isInteger(valor)) {
      return valor.toString();
    }
    // Se tiver casas decimais, mostra até 8 casas
    return valor.toFixed(8).replace(/\.?0+$/, '');
  };

  // Navegar para criar uma nova operação
  const novaOperacao = () => {
    router.push("/crypto/nova-operacao");
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
      
      console.log(`[Crypto] Excluindo operação ${id}`);
      const response = await fetch(`/api/crypto/operacoes?id=${id}`, {
        method: "DELETE",
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!mounted) return; // Verificar se ainda está montado
      
      // Tratar resposta
      if (!response.ok) {
        console.error(`[Crypto] Erro ao excluir operação: ${response.status}`);
        
        // Tentar obter detalhes do erro
        let mensagemErro = "Erro ao excluir operação. Verifique se a tabela crypto_operacoes existe no banco de dados.";
        try {
          const errorData = await response.json();
          if (errorData.error) {
            mensagemErro = `Erro: ${errorData.error}`;
          }
        } catch (e) {
          // Ignore erros ao tentar ler o corpo da resposta
        }
        
        setError(mensagemErro);
      } else {
        console.log(`[Crypto] Operação ${id} excluída com sucesso`);
        setError(null);
        // Atualizar a lista após excluir
        await carregarDados();
      }
    } catch (err: any) {
      console.error("[Crypto] Erro ao excluir operação:", err);
      
      if (mounted) {
        const errorMessage = err instanceof Error ? err.message : "Erro ao excluir operação";
        setError(errorMessage);
      }
    } finally {
      if (mounted) {
        setLoading(false);
      }
    }
  };

  // Calcular portfólio consolidado (agrupado por moeda)
  const calcularPortfolio = () => {
    // Criar um mapa para armazenar as informações por moeda
    const portfolioMap = new Map<string, {
      moeda_id: string,
      nome: string,
      simbolo: string,
      quantidade: number,
      valorTotal: number,
      valorMedio: number,
      valorAtualizado: number,
      lucro: number,
      percentual: number,
      image?: string,
      custoMedio: number,
      quantidadeDisponivel: number,
      lucroRealizado: number
    }>();
    
    // Processar cada operação em ordem cronológica
    operacoes
      .sort((a, b) => new Date(a.data_operacao).getTime() - new Date(b.data_operacao).getTime())
      .forEach((op) => {
        const moeda = topMoedas.find(m => m.id === op.moeda_id);
        const precoAtual = getPrecoAtual(op.moeda_id);
        
        // Se a moeda já existe no mapa, atualizar os valores
        if (portfolioMap.has(op.moeda_id)) {
          const item = portfolioMap.get(op.moeda_id)!;
          
          if (op.tipo === "compra") {
            // Atualizar quantidade e custo médio para compras
            const novaQuantidade = item.quantidadeDisponivel + op.quantidade;
            const novoCustoMedio = ((item.custoMedio * item.quantidadeDisponivel) + (op.preco_unitario * op.quantidade)) / novaQuantidade;
            
            item.quantidadeDisponivel = novaQuantidade;
            item.custoMedio = novoCustoMedio;
            item.quantidade += op.quantidade;
            item.valorTotal += op.valor_total;
          } else {
            // Processar venda usando FIFO
            if (item.quantidadeDisponivel >= op.quantidade) {
              // Calcular lucro da venda baseado no custo médio atual
              const lucroVenda = (op.preco_unitario - item.custoMedio) * op.quantidade;
              item.lucroRealizado += lucroVenda;
              item.quantidadeDisponivel -= op.quantidade;
              item.quantidade -= op.quantidade;
              item.valorTotal -= (item.custoMedio * op.quantidade);
            }
          }
          
          // Atualizar valores calculados
          item.valorAtualizado = item.quantidadeDisponivel * precoAtual;
          item.valorMedio = item.custoMedio;
          item.lucro = item.lucroRealizado + (item.valorAtualizado - (item.quantidadeDisponivel * item.custoMedio));
          item.percentual = item.valorTotal > 0 ? (item.lucro / item.valorTotal) * 100 : 0;
          
          portfolioMap.set(op.moeda_id, item);
        } else {
          // Se a moeda não existe no mapa, criar novo item
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

          // Se for uma venda, calcular o lucro/prejuízo
          if (op.tipo === "venda") {
            novoItem.lucroRealizado = (op.preco_unitario - op.preco_unitario) * op.quantidade;
            novoItem.lucro = novoItem.lucroRealizado;
            novoItem.quantidadeDisponivel = 0;
            novoItem.quantidade = 0;
            novoItem.valorTotal = 0;
          } else {
            // Se for uma compra, calcular o lucro não realizado
            novoItem.lucro = novoItem.valorAtualizado - novoItem.valorTotal;
            novoItem.percentual = novoItem.valorTotal > 0 ? (novoItem.lucro / novoItem.valorTotal) * 100 : 0;
          }

          portfolioMap.set(op.moeda_id, novoItem);
        }
      });
    
    // Filtrar portfólio para remover moedas com quantidade zero ou negativa
    // e converter para array
    return Array.from(portfolioMap.values())
      .filter(item => item.quantidadeDisponivel > 0 || item.lucroRealizado !== 0)
      .sort((a, b) => b.valorAtualizado - a.valorAtualizado); // Ordenar por valor atualizado
  };
  
  const portfolio = calcularPortfolio();
  
  // Calcular totais do portfólio
  const totaisPortfolio = portfolio.reduce(
    (acc, item) => {
      acc.valorTotalInvestido += item.valorTotal;
      acc.valorTotalAtualizado += item.valorAtualizado;
      acc.lucroTotal += item.lucro;
      return acc;
    },
    { valorTotalInvestido: 0, valorTotalAtualizado: 0, lucroTotal: 0 }
  );
  
  // Calcular percentual total
  const percentualTotalPortfolio = totaisPortfolio.valorTotalInvestido > 0
    ? (totaisPortfolio.lucroTotal / totaisPortfolio.valorTotalInvestido) * 100
    : 0;

  return (
    <div className="container py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Gerenciamento de Criptomoedas</h1>
          <p className="text-muted-foreground">
            Controle suas operações de compra e venda
          </p>
        </div>
        <Button onClick={novaOperacao}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Operação
        </Button>
      </div>

      {/* Cards de resumo */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Portfólio
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatarMoeda(totaisPortfolio.valorTotalAtualizado)}
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
              {formatarMoeda(totaisPortfolio.valorTotalInvestido)}
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
              {formatarMoeda(totaisPortfolio.lucroTotal)} ({formatarPercentual(percentualTotalPortfolio)})
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Inclui lucros realizados e não realizados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Mensagem de erro */}
      {error && (
        <div className="bg-destructive/15 text-destructive flex items-center p-3 rounded-md mb-6">
          <AlertCircle className="h-4 w-4 mr-2" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Top 10 Criptomoedas */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-xl">Top 10 Criptomoedas</CardTitle>
              <CardDescription>Valores atualizados em tempo real</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => carregarDados()}
              disabled={loadingTopMoedas}
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Atualizar
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
          ) : topMoedas.length === 0 ? (
            <div className="flex justify-center items-center py-6">
              <p className="text-muted-foreground">Nenhuma informação disponível</p>
            </div>
          ) : (
            <>
              {/* Versão para desktop */}
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

              {/* Versão para mobile */}
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

      {/* Portfólio */}
      <Card className="mb-6">
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
                      <TableHead>Valor Médio</TableHead>
                      <TableHead>Valor Total Investido</TableHead>
                      <TableHead>Valor Total Atualizado</TableHead>
                      <TableHead>Lucro/Prejuízo</TableHead>
                      <TableHead>Percentual</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {portfolio.map((item) => (
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
                        <TableCell>{formatarQuantidade(item.quantidade)}</TableCell>
                        <TableCell>{formatarMoeda(item.valorMedio)}</TableCell>
                        <TableCell>{formatarMoeda(item.valorTotal)}</TableCell>
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
                      <TableCell></TableCell>
                      <TableCell>{formatarMoeda(totaisPortfolio.valorTotalInvestido)}</TableCell>
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
                {portfolio.map((item) => (
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
                        <span className="text-muted-foreground">Quantidade:</span> {formatarQuantidade(item.quantidade)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Valor Médio:</span> {formatarMoeda(item.valorMedio)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Investido:</span> {formatarMoeda(item.valorTotal)}
                      </div>
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
                    <div>
                      <span className="text-muted-foreground">Investido:</span> {formatarMoeda(totaisPortfolio.valorTotalInvestido)}
                    </div>
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

      {/* Controles de filtragem */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
          <TabsList>
            <TabsTrigger value="todas">Todas</TabsTrigger>
            <TabsTrigger value="compra">Compras</TabsTrigger>
            <TabsTrigger value="venda">Vendas</TabsTrigger>
          </TabsList>
        </Tabs>
        
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar moeda ou exchange..."
            className="pl-8"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
        </div>
      </div>

      {/* Tabela de operações */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-xl">Minhas Operações</CardTitle>
              <CardDescription>Registro de suas compras e vendas de criptomoedas</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                verificarTabelaCryptoOperacoes().then(() => carregarDados());
              }}
              disabled={loading}
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              {loading ? "Atualizando..." : "Atualizar"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <p>Carregando operações...</p>
            </div>
          ) : operacoesFiltradas.length === 0 ? (
            <div className="flex flex-col justify-center items-center py-12">
              <p className="text-muted-foreground mb-4">Nenhuma operação encontrada</p>
              <Button onClick={novaOperacao}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Operação
              </Button>
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
                      <TableHead>Valor Operação</TableHead>
                      <TableHead>Valor Total</TableHead>
                      <TableHead>Valor Total Atualizado</TableHead>
                      <TableHead>Lucro/Prejuízo</TableHead>
                      <TableHead>Percentual</TableHead>
                      <TableHead>Exchange</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {operacoesFiltradas.map((op) => {
                      const precoAtual = getPrecoAtual(op.moeda_id);
                      const valorAtualizado = calcularValorAtualizado(op);
                      const { valor: lucroPrejuizo, percentual } = calcularLucroOuPrejuizo(op);
                      const moeda = topMoedas.find(m => m.id === op.moeda_id);
                      
                      return (
                        <TableRow key={op.id}>
                          <TableCell>{formatarData(op.data_operacao)}</TableCell>
                          <TableCell>
                            <Badge variant={op.tipo === "compra" ? "success" : "destructive"}>
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
                              <span>Moeda não encontrada</span>
                            )}
                          </TableCell>
                          <TableCell>{formatarQuantidade(op.quantidade)}</TableCell>
                          <TableCell>{formatarMoeda(op.preco_unitario)}</TableCell>
                          <TableCell>{formatarMoeda(op.valor_total)}</TableCell>
                          <TableCell>{formatarMoeda(precoAtual)}</TableCell>
                          <TableCell>{formatarMoeda(valorAtualizado)}</TableCell>
                          <TableCell className={cn(
                            lucroPrejuizo > 0 ? "text-green-600" : lucroPrejuizo < 0 ? "text-red-600" : ""
                          )}>
                            {formatarMoeda(lucroPrejuizo)}
                          </TableCell>
                          <TableCell className={cn(
                            percentual > 0 ? "text-green-600" : percentual < 0 ? "text-red-600" : ""
                          )}>
                            {formatarPercentual(percentual)}
                          </TableCell>
                          <TableCell>{op.exchange}</TableCell>
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
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              
              {/* Versão para mobile */}
              <div className="md:hidden">
                {operacoesFiltradas.map((op) => {
                  const precoAtual = getPrecoAtual(op.moeda_id);
                  const valorAtualizado = calcularValorAtualizado(op);
                  const { valor: lucroPrejuizo, percentual } = calcularLucroOuPrejuizo(op);
                  const moeda = topMoedas.find(m => m.id === op.moeda_id);
                  
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
                          <span className="text-muted-foreground">Quantidade:</span> {formatarQuantidade(op.quantidade)}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Valor Operação:</span> {formatarMoeda(op.preco_unitario)}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total:</span> {formatarMoeda(op.valor_total)}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Exchange:</span> {op.exchange}
                        </div>
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
                        <div className={cn(
                          percentual > 0 ? "text-green-600" : percentual < 0 ? "text-red-600" : ""
                        )}>
                          <span className="text-muted-foreground">Percentual:</span> {formatarPercentual(percentual)}
                        </div>
                      </div>
                      
                      <div className="flex justify-end space-x-2 mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => editarOperacao(op.id)}
                        >
                          <Edit className="h-3 w-3 mr-1" />
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
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 