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
import { AlertCircle, ArrowUpDown, Plus, Trash2, Edit, Search, TrendingUp, Pencil, Wallet, CreditCard, TrendingDown, Bitcoin } from "lucide-react";
import { useAuth } from "@/lib/hooks/use-auth";
import { useUserData } from "@/lib/hooks/use-user-data";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { OperacaoModal } from "@/components/crypto/OperacaoModal";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase/client";
import { usePrice } from '@/lib/context/PriceContext';
import { MarketDataMap, FullCoinData } from "@/lib/coingecko";

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
  grupo_id?: string;
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

// <<< DEFINIR CHAVES ORDENÁVEIS >>>
type SortableColumn = 'data_operacao' | 'nome' | 'quantidade' | 'valor_total' | 'valorAtualizado' | 'lucro' | 'percentual';
type SortDirection = 'asc' | 'desc';
// <<< FIM DEFINIÇÃO CHAVES >>>

export default function CryptoPage() {
  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { userData, loading: userDataLoading, error: userDataError } = useUserData();
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState("todas");
  const [filtro, setFiltro] = useState("");
  const [mounted, setMounted] = useState(false);
  const [topMoedas, setTopMoedas] = useState<TopMoeda[]>([]);
  const [loadingMarketData, setLoadingMarketData] = useState<boolean>(false);
  const [errorMarketData, setErrorMarketData] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOperation, setEditingOperation] = useState<Operacao | null>(null);
  const [currentUserGrupoId, setCurrentUserGrupoId] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  // <<< Obter o MAPA de preços do contexto
  const { 
    prices, 
    isLoading: isLoadingPrices, // Renomear para clareza
    error: errorPrices // Renomear para clareza
  } = usePrice();

  // <<< ATUALIZAR ESTADO DE ORDENAÇÃO >>>
  const [sortConfig, setSortConfig] = useState<{ key: SortableColumn | null, direction: SortDirection }>({ 
    key: 'data_operacao', // Coluna inicial
    direction: 'desc' 
  });
  // <<< FIM ATUALIZAÇÃO ESTADO >>>

  // LOG INICIAL PARA DEBUG
  console.log("[CryptoPage] Renderizando...", { 
    user: user, 
    userData: userData, 
    userDataLoading: userDataLoading,
    userDataError: userDataError 
  });

  // NOVO useEffect: Buscar grupo_id do usuário via 'usuarios_grupos'
  useEffect(() => {
    const fetchUserGroup = async () => {
      if (userDataLoading || !userData?.id) {
        console.log("[CryptoPage] fetchUserGroup: Aguardando userData básico carregar ou userData.id.", { isLoading: userDataLoading, hasId: !!userData?.id });
        if (!userDataLoading) setLoadingProfile(false);
        return;
      }

      console.log(`[CryptoPage] fetchUserGroup: Buscando grupo para usuário ID: ${userData.id}`);
      setLoadingProfile(true); // Reutilizar o estado de loading
      setProfileError(null);
      setCurrentUserGrupoId(null);

      try {
        const supabase = getSupabase();
        // Buscar na tabela de ligação usuarios_grupos
        // @ts-ignore - Ignorar erro de tipo da tabela (tipos desatualizados)
        const { data: userGroupLink, error: fetchError } = await supabase
          .from('usuarios_grupos') // <<< Tabela de ligação correta
          .select('grupo_id')      // Pegar o ID do grupo
          .eq('usuario_id', userData.id) // Filtrar pelo ID do usuário
          .limit(1) // Pegar apenas o primeiro grupo encontrado
          .maybeSingle(); // Não dar erro se o usuário não estiver em nenhum grupo

        if (fetchError) {
          throw fetchError;
        }

        // @ts-ignore - Ignorar erro de tipo de 'grupo_id' (tipos desatualizados)
        if (userGroupLink?.grupo_id) {
          // @ts-ignore - Ignorar erro de tipo de 'grupo_id' (tipos desatualizados)
          console.log("[CryptoPage] fetchUserGroup: Grupo ID encontrado:", userGroupLink.grupo_id);
           // @ts-ignore - Ignorar erro de tipo de 'grupo_id' (tipos desatualizados)
          setCurrentUserGrupoId(userGroupLink.grupo_id);
        } else {
          console.warn(`[CryptoPage] fetchUserGroup: Usuário ${userData.id} não encontrado em nenhum grupo via 'usuarios_grupos'.`);
          setProfileError("Usuário não associado a nenhum grupo."); // Mensagem mais específica
        }

      } catch (err: any) {
        console.error("[CryptoPage] fetchUserGroup: Erro ao buscar grupo:", err);
        setProfileError(err.message || "Erro ao carregar dados do grupo.");
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchUserGroup();
  }, [userData, userDataLoading]);

  // Função para abrir o modal (criação ou edição)
  const openModal = (operacao: Operacao | null = null) => {
    console.log("[CryptoPage] Abrindo modal.", operacao ? `Editando ID: ${operacao.id}` : "Criando nova.");
    setEditingOperation(operacao); // Define null para criar, ou os dados para editar
    setIsModalOpen(true);
  };

  // Função para fechar o modal
  const closeModal = () => {
    console.log("[CryptoPage] Fechando modal.");
    setIsModalOpen(false);
    setEditingOperation(null); // Limpa a operação em edição
  };

  // Função chamada após sucesso na criação/edição no modal
  const handleSuccess = () => {
    console.log("[CryptoPage] Operação salva com sucesso. Recarregando dados...");
    closeModal(); // Fecha o modal primeiro
    carregarDados(true); // Recarrega a lista de operações (passando true para mostrar loading)
  };

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

  // <<< ENVOLVER FUNÇÕES EM useCallback >>>
  const getPrecoAtual = useCallback((moedaId: string): number => {
    const moeda = topMoedas.find(m => m.id === moedaId);
    return moeda ? moeda.current_price : 0;
  }, [topMoedas]); // Dependência: topMoedas

  const calcularValorAtualizado = useCallback((op: Operacao): number => {
    const precoAtual = getPrecoAtual(op.moeda_id);
    return op.quantidade * precoAtual;
  }, [getPrecoAtual]); // Dependência: getPrecoAtual (memoizada)

  const calcularLucroOuPrejuizo = useCallback((op: Operacao): {valor: number, percentual: number} => {
    const valorAtualizado = calcularValorAtualizado(op);
    let lucro = 0;
    let percentual = 0;
    
    if (op.tipo === "compra") {
      lucro = valorAtualizado - op.valor_total;
      percentual = op.valor_total > 0 ? (lucro / op.valor_total) * 100 : 0;
    } else {
      const operacoesAnteriores = operacoes // <<< Acessa estado operacoes
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
  // Dependências: calcularValorAtualizado (memoizada) e operacoes (estado)
  }, [calcularValorAtualizado, operacoes]); 
  // <<< FIM useCallback >>>

  const carregarDados = useCallback(async (forceLoading = false) => {
    console.log("[Crypto] Carregando dados da página");
    if (forceLoading) {
      setLoading(true);
      setError(null);
    }
    setLoadingMarketData(true); // Inicia loading dos dados de mercado
    setErrorMarketData(null);

    let fetchedOperacoes: Operacao[] = []; // Armazenar operações buscadas

    try {
      // 1. Buscar Operações Primeiro
      console.log("[Crypto] Buscando operações...");
      const operacoesResponse = await fetch("/api/crypto/operacoes", {
        method: "GET",
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
        cache: 'no-store'
      });

      if (!operacoesResponse.ok) {
        console.error(`[Crypto] Erro ao buscar operações: ${operacoesResponse.status}`);
        let mensagemErro = "Erro ao buscar operações.";
        try {
          const errorData = await operacoesResponse.json();
          mensagemErro = errorData.error || mensagemErro;
        } catch { /* ignora */ }
        setError(mensagemErro);
        setOperacoes([]);
        // Não continuar se operações falharem
        setLoading(false);
        setLoadingMarketData(false);
        return; 
      } else {
        const operacoesData = await operacoesResponse.json();
        fetchedOperacoes = Array.isArray(operacoesData) ? operacoesData : [];
        console.log(`[Crypto] ${fetchedOperacoes.length} operações carregadas`);
        setOperacoes(fetchedOperacoes);
        setError(null); // Limpa erro principal se operações carregarem
      }

      // 2. Extrair IDs Únicos das Operações
      const idsDasOperacoes = [...new Set(fetchedOperacoes.map(op => op.moeda_id))];
      console.log("[Crypto] IDs únicos das operações:", idsDasOperacoes);

      if (idsDasOperacoes.length === 0) {
        console.log("[Crypto] Nenhuma operação encontrada, não há IDs para buscar market data.");
        setTopMoedas([]); // Limpar dados de moedas se não há operações
        setLoadingMarketData(false);
        // Definir loading principal como false aqui também
        if (forceLoading) setLoading(false);
        return; // Termina se não há IDs
      }

      // 3. Buscar Market Data para os IDs das Operações
      const marketDataUrl = `/api/crypto/market-data?ids=${idsDasOperacoes.join(',')}`;
      console.log("[Crypto] Buscando Market Data de:", marketDataUrl);
      const marketDataResponse = await fetch(marketDataUrl);

      if (marketDataResponse.status === 429) {
        setErrorMarketData("Limite de requisições excedido. Tente novamente mais tarde.");
        setTopMoedas([]);
      } else if (!marketDataResponse.ok) {
        const errorData = await marketDataResponse.json().catch(() => ({}));
        console.error("[Crypto] Erro ao buscar market-data:", marketDataResponse.status, errorData);
        setErrorMarketData(`Erro ${marketDataResponse.status} ao buscar dados das moedas.`);
        setTopMoedas([]);
      } else {
        const marketDataMap: MarketDataMap = await marketDataResponse.json();
        console.log("[Crypto] MarketDataMap recebido:", Object.keys(marketDataMap).length);

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
          console.warn(`[Crypto] Moeda com ID "${id}" não encontrada no marketDataMap (esperado para cálculo).`);
          return null;
        }).filter((moeda): moeda is TopMoeda => moeda !== null);
        
        console.log("[Crypto] Dados de mercado processados para array:", marketDataArray.length);
        setTopMoedas(marketDataArray); // Atualiza o estado usado por getPrecoAtual
        setErrorMarketData(null);
      }

    } catch (err) {
      console.error("[Crypto] Erro geral ao carregar dados:", err);
      setError("Erro inesperado ao carregar dados."); // Erro genérico
    } finally {
      setLoading(false); // Finaliza loading principal
      setLoadingMarketData(false); // Finaliza loading de market data
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
          setLoadingMarketData(false);
        }
      }
    };
    
    init();
    
    return () => {
      isMounted = false;
      setMounted(false);
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

  // <<< GENERALIZAR FUNÇÃO DE MUDAR ORDENAÇÃO >>>
  const requestSort = (key: SortableColumn) => {
    let direction: SortDirection = 'asc'; // Padrão ascendente para strings
    if (key !== 'nome') { // Padrão descendente para números/datas
      direction = 'desc';
    }
    // Se clicou na mesma coluna, inverte a direção
    if (sortConfig.key === key) {
      direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    }
    setSortConfig({ key, direction });
    console.log(`[CryptoPage] Ordenação alterada para: ${key} ${direction}`);
  };
  // <<< FIM GENERALIZAÇÃO FUNÇÃO >>>

  // Filtrar operações com base no tipo e texto de busca
  const operacoesFiltradas = operacoes.filter((op) => {
    const tipoMatch = activeTab === "todas" || op.tipo === activeTab;

    // Sanitizar o termo de busca
    const filtroLimpo = filtro.trim().toLowerCase();

    // Filtrar por texto (nome, símbolo ou exchange), verificando se campos existem
    const textMatch = filtroLimpo === "" || 
      (op.nome && op.nome.toLowerCase().includes(filtroLimpo)) ||
      (op.simbolo && op.simbolo.toLowerCase().includes(filtroLimpo)) ||
      (op.exchange && op.exchange.toLowerCase().includes(filtroLimpo));
    
    return tipoMatch && textMatch;
  });

  // <<< PRÉ-CALCULAR VALORES PARA ORDENAÇÃO >>>
  const operacoesParaOrdenar = operacoesFiltradas.map(op => {
    const valorAtualizado = calcularValorAtualizado(op);
    const { valor: lucro, percentual } = calcularLucroOuPrejuizo(op);
    return {
      ...op, // Inclui todos os campos originais da operação
      valorAtualizado, 
      lucro,
      percentual
    };
  });
  // <<< FIM PRÉ-CÁLCULO >>>

  // <<< EXPANDIR LÓGICA DE ORDENAÇÃO >>>
  const operacoesOrdenadas = [...operacoesParaOrdenar].sort((a, b) => {
    if (!sortConfig.key) return 0; // Não ordenar se a chave for null

    const key = sortConfig.key;
    let comparison = 0;

    // Lógica de comparação baseada na chave
    switch (key) {
      case 'data_operacao':
        comparison = new Date(a.data_operacao).getTime() - new Date(b.data_operacao).getTime();
        break;
      case 'nome':
        comparison = a.nome.localeCompare(b.nome);
        break;
      case 'quantidade':
      case 'valor_total':
      case 'valorAtualizado':
      case 'lucro':
      case 'percentual':
        comparison = a[key] - b[key];
        break;
      default:
        return 0;
    }

    // Aplicar direção
    return sortConfig.direction === 'asc' ? comparison : comparison * -1;
  });
  // <<< FIM EXPANSÃO LÓGICA >>>

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

  // Formatar quantidade
  const formatarQuantidade = (valor: number) => {
    // Se o valor for inteiro, não mostra casas decimais
    if (Number.isInteger(valor)) {
      return valor.toString();
    }
    // Se tiver casas decimais, mostra até 8 casas
    return valor.toFixed(8).replace(/\.?0+$/, '');
  };

  // MODIFICAR: Função para lidar com clique em "Nova Operação"
  const novaOperacao = () => {
    if (userDataLoading || loadingProfile) { // Checar ambos loadings
       toast.info("Aguarde, carregando dados do usuário/grupo..."); // Mensagem ajustada
       console.log("[CryptoPage] Click Nova Operação: Aguardando loading", { userDataLoading, loadingProfile });
       return;
    }
    if (!currentUserGrupoId) {
       // Usar profileError se existir, senão a mensagem genérica
       toast.error(profileError || "Não foi possível determinar o grupo padrão do usuário."); // Mensagem ajustada
       console.error("[CryptoPage] Tentativa de criar operação sem grupoId do usuário.", { currentUserGrupoId, profileError });
       return;
    }
   openModal();
 };

 // MODIFICAR: Função para lidar com clique em "Editar"
 const editarOperacao = (id: string) => {
   const operacaoParaEditar = operacoes.find((op) => op.id === id);
   if (operacaoParaEditar) {
     // Encontrar a imagem correspondente na lista topMoedas
     const moedaInfo = topMoedas.find(m => m.id === operacaoParaEditar.moeda_id);
     // Criar objeto com a imagem (se encontrada)
     const initialDataComImagem = { 
       ...operacaoParaEditar, 
       image: moedaInfo?.image // Adiciona a URL da imagem de topMoedas
     };
     console.log("[CryptoPage] Editando operação com dados:", initialDataComImagem);
     openModal(initialDataComImagem); // Abre o modal com os dados da operação + imagem
   } else {
     console.error(`[CryptoPage] Operação com ID ${id} não encontrada para edição.`);
     toast.error("Operação não encontrada. Tente atualizar a lista.");
   }
 };

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
      lucroRealizado: number,
      precoAtual: number
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
          item.precoAtual = precoAtual;
          
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
            image: moeda?.image,
            precoAtual: precoAtual
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

  // <<< Usar o preço do Bitcoin do MAPA
  const btcPriceFromContext = prices ? prices['bitcoin'] : null;
  const formattedBtcPrice = btcPriceFromContext !== null && btcPriceFromContext !== undefined
    ? btcPriceFromContext.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
    : '---';

  // Função auxiliar para renderizar ícone de ordenação
  const renderSortArrow = (columnKey: SortableColumn) => {
    if (sortConfig.key !== columnKey) {
      return <ArrowUpDown className="ml-2 h-3 w-3 opacity-30" />;
    }
    return sortConfig.direction === 'asc' ? 
      <span className="ml-1">▲</span> : 
      <span className="ml-1">▼</span>;
  };

  return (
    <div className="w-full px-4 py-6">
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
                      <TableHead>Qtde</TableHead>
                      <TableHead>Valor Médio</TableHead>
                      <TableHead>Valor Total Investido</TableHead>
                      <TableHead>Valor Atual</TableHead>
                      <TableHead>Valor Total Atual</TableHead>
                      <TableHead>Lucro/Prejuízo</TableHead>
                      <TableHead>%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {portfolio.map((item) => (
                      <TableRow key={item.moeda_id}>
                        <TableCell className="flex items-center space-x-2">
                          {item.image ? (
                            <>
                              <div className="relative w-6 h-6">
                                <Image
                                  src={item.image}
                                  alt={item.nome}
                                  fill
                                  className="object-contain rounded-full"
                                  onError={(e) => {
                                    const img = e.target as HTMLImageElement;
                                    img.src = "/placeholder-coin.png";
                                  }}
                                />
                              </div>
                              <span className="font-medium">{item.nome}</span>
                            </>
                          ) : (
                            <span>Moeda não encontrada</span>
                          )}
                        </TableCell>
                        <TableCell>{formatarQuantidade(item.quantidade)}</TableCell>
                        <TableCell>{formatarMoeda(item.valorMedio)}</TableCell>
                        <TableCell>{formatarMoeda(item.valorTotal)}</TableCell>
                        <TableCell>{formatarMoeda(item.precoAtual)}</TableCell>
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
                      <TableCell></TableCell>
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
                        <>
                          <div className="relative w-6 h-6">
                            <Image
                              src={item.image}
                              alt={item.nome}
                              fill
                              className="object-contain rounded-full"
                              onError={(e) => {
                                const img = e.target as HTMLImageElement;
                                img.src = "/placeholder-coin.png";
                              }}
                            />
                          </div>
                          <span>{item.nome}</span>
                        </>
                      ) : (
                        <span>Moeda não encontrada</span>
                      )}
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
                        <span className="text-muted-foreground">Valor Atual:</span> {formatarMoeda(item.precoAtual)}
                      </div>
                      <div className={cn(
                        item.lucro > 0 ? "text-green-600" : item.lucro < 0 ? "text-red-600" : ""
                      )}>
                        <span className="text-muted-foreground">Lucro/Prejuízo:</span> {formatarMoeda(item.lucro)}
                      </div>
                      <div className={cn(
                        item.percentual > 0 ? "text-green-600" : item.percentual < 0 ? "text-red-600" : ""
                      )}>
                        {formatarPercentual(item.percentual)}
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
                      {formatarPercentual(percentualTotalPortfolio)}
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
          ) : operacoesOrdenadas.length === 0 ? (
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
                      <TableHead>
                        <Button variant="ghost" onClick={() => requestSort('data_operacao')} className="px-2 py-1 h-auto -ml-2">
                          Data {renderSortArrow('data_operacao')}
                        </Button>
                      </TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => requestSort('nome')} className="px-2 py-1 h-auto -ml-2">
                          Moeda {renderSortArrow('nome')}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => requestSort('quantidade')} className="px-2 py-1 h-auto -ml-2">
                          Qtde {renderSortArrow('quantidade')}
                        </Button>
                      </TableHead>
                      <TableHead>Valor Op.</TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => requestSort('valor_total')} className="px-2 py-1 h-auto -ml-2">
                          Total Op. {renderSortArrow('valor_total')}
                        </Button>
                      </TableHead>
                      <TableHead>Valor Atual</TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => requestSort('valorAtualizado')} className="px-2 py-1 h-auto -ml-2">
                          Valor Total Atual {renderSortArrow('valorAtualizado')}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => requestSort('lucro')} className="px-2 py-1 h-auto -ml-2">
                          Lucro/Prejuízo {renderSortArrow('lucro')}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => requestSort('percentual')} className="px-2 py-1 h-auto -ml-2">
                          % {renderSortArrow('percentual')}
                        </Button>
                      </TableHead>
                      <TableHead>Exchange</TableHead>
                      <TableHead className="text-left">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {operacoesOrdenadas.map((op) => {
                      const { valorAtualizado, lucro: lucroPrejuizo, percentual } = op;
                      const moeda = topMoedas.find(m => m.id === op.moeda_id);
                      const precoAtual = getPrecoAtual(op.moeda_id);
                      
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
                                <div className="relative w-6 h-6">
                                  <Image
                                    src={moeda.image}
                                    alt={moeda.name}
                                    fill
                                    className="object-contain rounded-full"
                                    onError={(e) => {
                                      const img = e.target as HTMLImageElement;
                                      img.src = "/placeholder-coin.png";
                                    }}
                                  />
                                </div>
                                <span className="font-medium">{moeda.name}</span>
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
                          <TableCell className={cn(lucroPrejuizo > 0 ? "text-green-600" : lucroPrejuizo < 0 ? "text-red-600" : "")}>
                            {formatarMoeda(lucroPrejuizo)}
                          </TableCell>
                          <TableCell className={cn(percentual > 0 ? "text-green-600" : percentual < 0 ? "text-red-600" : "")}>
                            {formatarPercentual(percentual)}
                          </TableCell>
                          <TableCell>{op.exchange}</TableCell>
                          <TableCell className="text-left">
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
              
              {/* Versão para mobile (usa a mesma lista `operacoesOrdenadas`) */}
              <div className="md:hidden">
                {operacoesOrdenadas.map((op) => {
                  const { valorAtualizado, lucro: lucroPrejuizo, percentual } = op;
                  const moeda = topMoedas.find(m => m.id === op.moeda_id);
                  const precoAtual = getPrecoAtual(op.moeda_id);
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
                          <span className="text-muted-foreground">Valor Op.:</span> {formatarMoeda(op.preco_unitario)}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total Op.:</span> {formatarMoeda(op.valor_total)}
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
                          {formatarPercentual(percentual)}
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

      {/* Renderizar o Modal */}
      {isModalOpen && (
        <OperacaoModal
          isOpen={isModalOpen}
          onClose={closeModal}
          initialData={editingOperation}
          onSuccess={handleSuccess}
          userId={user?.id}
          grupoIdUsuario={currentUserGrupoId}
        />
      )}

    </div>
  );
} 