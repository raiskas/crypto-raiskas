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
import { PerformanceMetrics } from "@/lib/crypto/fifoCalculations";

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

// <<< Novo tipo para o resumo geral da API >>>
interface PerformanceSummary {
  totalRealizado: number;
  totalNaoRealizado: number;
  valorTotalAtual: number;
}

// <<< Novo tipo para o estado da performance >>>
interface CryptoPerformanceState {
  performance: { [key: string]: PerformanceMetrics };
  summary: PerformanceSummary;
}

export default function CryptoPage() {
  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [performanceData, setPerformanceData] = useState<CryptoPerformanceState | null>(null);
  const [loadingPerformance, setLoadingPerformance] = useState(true);
  const [errorPerformance, setErrorPerformance] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { userData, loading: userDataLoading, error: userDataError } = useUserData();
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState("compra");
  const [filtro, setFiltro] = useState("");
  const [mounted, setMounted] = useState(false);
  const [topMoedas, setTopMoedas] = useState<TopMoeda[]>([]);
  const [loadingMarketData, setLoadingMarketData] = useState<boolean>(true);
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

  // <<< ADICIONAR: Lista base de IDs para garantir dados mínimos >>>
  const BASE_COIN_IDS = ['bitcoin', 'ethereum', 'cardano', 'solana', 'ripple', 'dogecoin']; // Exemplo

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

  // Função para carregar todas as operações do usuário
  const carregarDados = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
      setLoadingPerformance(true);
    }
    setError(null);
    setErrorPerformance(null);
    
    // Verifica se o usuário está definido ANTES de prosseguir
    if (!user) {
      console.warn("[Crypto] carregarDados chamado sem usuário. Abortando.");
      setLoading(false);
      setLoadingPerformance(false);
      return; 
    }

    try {
      // --- Busca Performance ---      
      console.log("[Crypto] Carregando dados de performance...");
      const performanceResponse = await fetch('/api/crypto/performance');
      const performanceResult = await performanceResponse.json();
      // <<< LOG FRONTEND 1: DADOS RECEBIDOS >>>
      console.log("[CryptoPage DEBUG] Dados brutos de performance recebidos da API:", JSON.stringify(performanceResult, null, 2));

      if (!performanceResponse.ok) {
        let errorMsg = performanceResult.error || `Erro ao carregar performance: ${performanceResponse.statusText}`;
        if (performanceResponse.status === 429) {
           errorMsg = "Falha ao buscar dados de mercado da CoinGecko: Limite de requisições excedido (429).";
        } 
        console.error("[Crypto] Erro na busca de performance:", errorMsg);
        // Lançar erro específico para performance
        throw new Error(`PERFORMANCE_ERROR: ${errorMsg}`); 
      }
      console.log("[Crypto] Dados de performance recebidos com sucesso.");
      // <<< LOG FRONTEND 2: ESTADO ANTES >>>
      console.log("[CryptoPage DEBUG] Estado performanceData ANTES da atualização:", JSON.stringify(performanceData, null, 2));
      setPerformanceData(performanceResult);

      // --- Busca Operações ---      
      console.log("[Crypto] Buscando operações após performance...");
      const operacoesResponse = await fetch('/api/crypto/operacoes');
      // Logar o status da resposta de operações
      console.log(`[Crypto] Resposta de /api/crypto/operacoes status: ${operacoesResponse.status}`); 
      const operacoesResult = await operacoesResponse.json(); 
       // Logar o resultado bruto de operações
      console.log("[Crypto] Resultado bruto de /api/crypto/operacoes:", operacoesResult);

      if (!operacoesResponse.ok) {
         let errorMsg = operacoesResult.error || `Erro ao buscar operações: ${operacoesResponse.statusText}`;
         console.error("[Crypto] Erro na busca de operações:", errorMsg);
         // Lançar erro específico para operações
         throw new Error(`OPERATIONS_ERROR: ${errorMsg}`); 
      }

       // Processar e definir operações
      // <<< CORREÇÃO: Verificar se operacoesResult É um array >>>
      if (!Array.isArray(operacoesResult)) { 
        console.warn("[Crypto] 'operacoesResult' não é um array:", operacoesResult);
        // Lançar erro se a estrutura esperada não vier (um array direto)
        throw new Error("OPERATIONS_ERROR: Formato inesperado recebido da API de operações. Esperado um array."); 
      }

      // <<< CORREÇÃO: Usar operacoesResult diretamente como o array >>>
      const operacoesProcessadas = operacoesResult.map((op: any) => ({ 
          ...op, 
          quantidade: Number(op.quantidade),
          preco_unitario: Number(op.preco_unitario),
          valor_total: Number(op.valor_total),
          taxa: Number(op.taxa ?? 0),
      }));
      console.log(`[Crypto] ${operacoesProcessadas.length} operações processadas e prontas para setar no estado.`);
      setOperacoes(operacoesProcessadas); // <<< Definir estado das operações
      
      // TODO: Buscar Top Moedas (separar lógica?)

    } catch (err: any) {
      console.error("[Crypto] Erro detalhado em carregarDados:", err);      
      // Identificar o tipo de erro pela mensagem
      if (err.message?.startsWith("PERFORMANCE_ERROR:")) {
        // Erro na performance: definir erro de performance e talvez limpar dados de performance
        setErrorPerformance(err.message.replace("PERFORMANCE_ERROR: ", ""));
        setPerformanceData(null); // Limpar performance em caso de erro
        // NÃO limpar operações aqui
      } else if (err.message?.startsWith("OPERATIONS_ERROR:")) {
        // Erro nas operações: definir erro geral e limpar operações
        setError(err.message.replace("OPERATIONS_ERROR: ", ""));
        setOperacoes([]); // Limpar operações SOMENTE se o erro foi nelas
        // NÃO limpar performance aqui (pode ter carregado ok)
      } else {
        // Erro genérico ou inesperado
        setError(err.message || "Erro desconhecido ao carregar dados.");
        // Limpar ambos em caso de erro genérico? Ou só o que falhou?
        // Por segurança, limpar ambos para evitar estado inconsistente
        setPerformanceData(null);
        setOperacoes([]); 
      }

    } finally {
      setLoading(false);
      setLoadingPerformance(false);
    }
  }, [user]);

  // <<< ADICIONAR useEffect PARA LOGAR performanceData QUANDO MUDAR >>>
  useEffect(() => {
    console.log("[CryptoPage DEBUG] Estado performanceData FOI ATUALIZADO PARA:", JSON.stringify(performanceData, null, 2));
  }, [performanceData]);

  // useEffect para carregar dados iniciais - DEPENDER APENAS DE USER
  useEffect(() => {
    console.log('[Crypto] useEffect [user] disparado.');
    if (user) { 
      console.log('[Crypto] Usuário definido. Carregando dados...');
      verificarTabelaCryptoOperacoes(); 
      carregarDados(true); 
    } else {
      console.log('[Crypto] Usuário não definido, limpando dados e aguardando...');
      setLoading(true); // Mostrar loading enquanto espera user
      setLoadingPerformance(true);
      setOperacoes([]); // Limpar operações se usuário deslogar
      setPerformanceData(null); // Limpar performance se usuário deslogar
      setError(null);
      setErrorPerformance(null);
    }
    // Define que o componente montou
    setMounted(true);
  // <<< REMOVER pathname e carregarDados das dependências >>>
  }, [user]); 

  // <<< REVISAR useEffect: Buscar Market Data (anteriormente Top Moedas) >>>
  useEffect(() => {
    const fetchMarketData = async () => {
      console.log("[Crypto] Iniciando busca de Market Data...");
      setLoadingMarketData(true); // Usar novo estado
      setErrorMarketData(null);   // Usar novo estado

      try {
        // 1. Buscar IDs relevantes das operações do usuário (melhor esforço)
        let userCoinIds: string[] = [];
        try {
          const relevantIdsResponse = await fetch('/api/crypto/relevant-coin-ids', {
            credentials: 'include' // Manter isso
          });
          if (relevantIdsResponse.ok) {
            const ids = await relevantIdsResponse.json();
            if (Array.isArray(ids)) {
              userCoinIds = ids;
              console.log("[Crypto] IDs relevantes das operações obtidos:", userCoinIds);
            } else {
               console.warn("[Crypto] API relevant-coin-ids não retornou um array:", ids);
            }
          } else {
            console.warn(`[Crypto] Falha ao buscar IDs relevantes: ${relevantIdsResponse.status}`);
            // Não lançar erro aqui, continuar com a lista base
          }
        } catch (idError) {
          console.error("[Crypto] Erro ao buscar IDs relevantes:", idError);
          // Não lançar erro aqui, continuar com a lista base
        }

        // 2. Combinar com a lista base e garantir unicidade
        const idsToFetch = [...new Set([...BASE_COIN_IDS, ...userCoinIds])];
        if (idsToFetch.length === 0) {
           console.warn("[Crypto] Nenhuma moeda para buscar dados de mercado.");
           setTopMoedas([]);
           setLoadingMarketData(false);
           return;
        }
        const idsString = idsToFetch.join(',');
        console.log(`[Crypto] Buscando Market Data para IDs: ${idsString}`);

        // 3. Chamar a API /api/crypto/market-data com os IDs
        const response = await fetch(`/api/crypto/market-data?ids=${idsString}`);
        // const data = await response.json(); // Processar depois de checar response.ok

        console.log(`[Crypto] Resposta de market-data status: ${response.status}`);
        // console.log('[Crypto] Dados brutos recebidos de market-data:', data); // Logar depois

        if (!response.ok) {
          let errorMsg = `Erro ao buscar dados de mercado: ${response.statusText}`;
          try {
             const errorData = await response.json();
             errorMsg = errorData.error || errorMsg;
             console.log('[Crypto] Dados brutos recebidos de market-data (erro):', errorData);
          } catch { /* Ignorar erro ao parsear json de erro */ }
          throw new Error(errorMsg);
        }

        // 4. Processar a resposta (espera-se um MAPA)
        const marketDataMap: MarketDataMap = await response.json();
        console.log('[Crypto] Dados brutos recebidos de market-data (sucesso):', marketDataMap);

        // Converter o Mapa para o formato TopMoeda[] usando flatMap
        const moedasProcessadas: TopMoeda[] = idsToFetch.flatMap(id => {
          const coinData: FullCoinData | null = marketDataMap[id];
          if (coinData) {
            return [{ // Retorna um array com um elemento se válido
              id: coinData.id,
              symbol: coinData.symbol,
              name: coinData.name,
              image: coinData.image,
              current_price: coinData.current_price,
              price_change_percentage_24h: coinData.price_change_percentage_24h ?? 0,
              market_cap: coinData.market_cap,
            }];
          }
          // Retorna um array vazio se inválido, que será achatado pelo flatMap
          return []; 
        });

        console.log(`[Crypto] ${moedasProcessadas.length} Moedas processadas de market-data.`);
        setTopMoedas(moedasProcessadas); // Atualiza o estado que a UI usa

      } catch (err: any) {
        console.error("[Crypto] Erro no fetchMarketData:", err);
        setErrorMarketData(err.message);
        setTopMoedas([]); // Limpar em caso de erro
      } finally {
        setLoadingMarketData(false);
      }
    };

    if (user) {
      fetchMarketData();
    } else {
      setTopMoedas([]);
      setLoadingMarketData(true); 
      setErrorMarketData(null);
    }
  }, [user]); // Dependência apenas em user

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

  // <<< RESTAURAR LÓGICA DE FILTRAGEM E PRÉ-CÁLCULO ORIGINAL >>>
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

  // <<< RESTAURAR LÓGICA DE ORDENAÇÃO MANUAL ORIGINAL >>>
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
        // Certificar que estamos comparando números
        const valA = a[key] ?? 0; // Usar 0 se for null/undefined
        const valB = b[key] ?? 0; // Usar 0 se for null/undefined
        comparison = valA - valB;
        break;
      default:
        // Garantir que 'key' seja um SortableColumn para evitar erro de tipo
        const _exhaustiveCheck: never = key;
        return 0;
    }

    // Aplicar direção
    return sortConfig.direction === 'asc' ? comparison : comparison * -1;
  });
  // <<< FIM LÓGICA DE ORDENAÇÃO MANUAL >>>

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

  // <<< Atualizar cálculo de totais do portfólio para usar performanceData >>>
  const totaisPortfolio = performanceData?.summary || { totalRealizado: 0, totalNaoRealizado: 0, valorTotalAtual: 0 };
  const valorTotalInvestidoCalculado = Object.values(performanceData?.performance || {}).reduce((acc, p) => acc + p.custoBaseTotalAtual, 0);

  // <<< Atualizar cálculo da tabela de portfólio para usar performanceData >>>
  const calcularPortfolio = () => {
    if (!performanceData) return [];

    const portfolioCalculado = Object.values(performanceData.performance)
      .map(p => {
        // Buscar informações da moeda (nome, símbolo, imagem)
        const operacaoInfo = operacoes.find(op => op.moeda_id === p.moedaId);
        const topMoedaInfo = topMoedas.find(tm => tm.id === p.moedaId);

        // Priorizar dados de topMoedas (mais completos da API externa), fallback para operacaoInfo
        const nomeMoeda = topMoedaInfo?.name || operacaoInfo?.nome || p.moedaId;
        const simboloMoeda = topMoedaInfo?.symbol || operacaoInfo?.simbolo || '-';
        const imagemMoeda = topMoedaInfo?.image; // Pegar imagem apenas de topMoedas
        
        // Obter o preço atual do contexto
        const precoAtual = prices ? (prices[p.moedaId] ?? 0) : 0;
        
        // Recalcular valor de mercado e lucro não realizado com o preço do contexto
        const valorAtualizadoRecalculado = p.quantidadeAtual * precoAtual;
        const lucroNaoRealizadoRecalculado = valorAtualizadoRecalculado - p.custoBaseTotalAtual;
        const percentualNaoRealizadoRecalculado = p.custoBaseTotalAtual > 0 
          ? (lucroNaoRealizadoRecalculado / p.custoBaseTotalAtual) * 100 
          : (valorAtualizadoRecalculado > 0 ? Infinity : 0); // Evitar divisão por zero, mostrar Infinity se tiver valor mas custo zero

        return {
          moeda_id: p.moedaId,
          nome: nomeMoeda,
          simbolo: simboloMoeda,
          quantidade: p.quantidadeAtual,
          valorMedio: p.custoMedioAtual, // Custo médio FIFO (da API)
          valorTotal: p.custoBaseTotalAtual, // Custo base atual (da API)
          valorAtualizado: valorAtualizadoRecalculado, // <<< USAR VALOR RECALCULADO
          lucro: lucroNaoRealizadoRecalculado, // <<< USAR LUCRO RECALCULADO
          percentual: percentualNaoRealizadoRecalculado, // <<< USAR PERCENTUAL RECALCULADO
          image: imagemMoeda,
          lucroRealizado: p.lucroPrejuizoRealizadoTotal, // Lucro realizado (da API)
          precoAtual: precoAtual // Preço do contexto
        };
      })
      // Filtrar itens com quantidade zero E lucro realizado zero?
      .filter(item => item.quantidade > 1e-9 || Math.abs(item.lucroRealizado) > 1e-9)
      .sort((a, b) => b.valorAtualizado - a.valorAtualizado); // Ordenar por valor atualizado (recalculado)
      
    // <<< REMOVER LOG: PORTFÓLIO CALCULADO PARA TABELA >>>
    // console.log("[CryptoPage DEBUG] Dados do portfólio calculados para a tabela:", JSON.stringify(portfolioCalculado, null, 2));

    return portfolioCalculado;
  };

  const portfolio = calcularPortfolio();

  // <<< REMOVER LOG FRONTEND: DADOS PRONTOS PARA RENDERIZAR >>>
  // console.log("[CryptoPage DEBUG] Variável \'portfolio\' final (usada na renderização):", JSON.stringify(portfolio, null, 2));

  // Calcular totais do portfólio com base nos dados recalculados
  const totaisPortfolioAtualizado = portfolio.reduce(
    (acc, item) => {
        acc.valorTotalInvestido += item.valorTotal; // Custo base atual (vem da API, está correto)
        acc.valorTotalAtualizado += item.valorAtualizado; // <<< Usa valor recalculado
        acc.lucroTotalNaoRealizado += item.lucro; // <<< Usa lucro recalculado
        acc.lucroTotalRealizado += item.lucroRealizado; // Lucro realizado (vem da API, está correto)
        return acc;
    },
    { valorTotalInvestido: 0, valorTotalAtualizado: 0, lucroTotalNaoRealizado: 0, lucroTotalRealizado: 0 }
  );

  // <<< REMOVER LOG FRONTEND: TOTAIS PRONTOS PARA RENDERIZAR >>>
  // console.log("[CryptoPage DEBUG] Variável \'totaisPortfolioAtualizado\' calculada para Cards:", JSON.stringify(totaisPortfolioAtualizado, null, 2));

  // Calcular percentual total
  const percentualTotalPortfolio = totaisPortfolioAtualizado.valorTotalInvestido > 0
    ? (totaisPortfolioAtualizado.lucroTotalNaoRealizado / totaisPortfolioAtualizado.valorTotalInvestido) * 100
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
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Portfólio</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatarMoeda(totaisPortfolioAtualizado.valorTotalAtualizado)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Investido</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatarMoeda(totaisPortfolioAtualizado.valorTotalInvestido)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">L/P Não Realizado</CardTitle>
            {totaisPortfolioAtualizado.lucroTotalNaoRealizado >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totaisPortfolioAtualizado.lucroTotalNaoRealizado >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatarMoeda(totaisPortfolioAtualizado.lucroTotalNaoRealizado)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ({formatarPercentual(totaisPortfolioAtualizado.valorTotalInvestido > 0 ? (totaisPortfolioAtualizado.lucroTotalNaoRealizado / totaisPortfolioAtualizado.valorTotalInvestido) * 100 : 0)})
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">L/P Realizado</CardTitle>
            {totaisPortfolioAtualizado.lucroTotalRealizado >= 0 ? (
              <Bitcoin className="h-4 w-4 text-green-500" />
            ) : (
              <Bitcoin className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totaisPortfolioAtualizado.lucroTotalRealizado >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatarMoeda(totaisPortfolioAtualizado.lucroTotalRealizado)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total desde o início
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Mensagem de erro de performance */}
      {errorPerformance && (
        <div className="bg-destructive/15 text-destructive flex items-center p-3 rounded-md mb-6">
          <AlertCircle className="h-4 w-4 mr-2" />
          <span className="text-sm">Erro ao carregar performance: {errorPerformance}</span>
        </div>
      )}
      {/* Mensagem de erro geral */}
      {error && !errorPerformance && (
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
          {loadingPerformance ? (
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
                      <TableHead>Qtde Atual</TableHead>
                      <TableHead>Custo Médio (FIFO)</TableHead>
                      <TableHead>Custo Base Atual</TableHead>
                      <TableHead>Preço Atual</TableHead>
                      <TableHead>Valor Total Atual</TableHead>
                      <TableHead>L/P Não Realizado</TableHead>
                      <TableHead>% Não Realizado</TableHead>
                      <TableHead>L/P Realizado (Total)</TableHead>
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
                              <span className="font-medium">{item.nome} ({item.simbolo.toUpperCase()})</span>
                            </>
                          ) : (
                            <span className="font-medium">{item.nome} ({item.simbolo.toUpperCase()})</span>
                          )}
                        </TableCell>
                        <TableCell>{formatarQuantidade(item.quantidade)}</TableCell>
                        <TableCell>{formatarMoeda(item.valorMedio)}</TableCell>
                        <TableCell>{formatarMoeda(item.valorTotal)}</TableCell>
                        <TableCell>{formatarMoeda(item.precoAtual)}</TableCell>
                        <TableCell>{formatarMoeda(item.valorAtualizado)}</TableCell>
                        <TableCell className={cn(item.lucro >= 0 ? "text-green-600" : "text-red-600")}>
                          {formatarMoeda(item.lucro)}
                        </TableCell>
                        <TableCell className={cn(item.percentual >= 0 ? "text-green-600" : "text-red-600")}>
                          {formatarPercentual(item.percentual)}
                        </TableCell>
                        <TableCell className={cn(item.lucroRealizado >= 0 ? "text-green-600" : "text-red-600")}>
                          {formatarMoeda(item.lucroRealizado)}
                        </TableCell>
                      </TableRow>
                    ))}

                    <TableRow className="border-t-2 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell>{formatarMoeda(totaisPortfolioAtualizado.valorTotalInvestido)}</TableCell>
                      <TableCell></TableCell>
                      <TableCell>{formatarMoeda(totaisPortfolioAtualizado.valorTotalAtualizado)}</TableCell>
                      <TableCell className={cn(totaisPortfolioAtualizado.lucroTotalNaoRealizado >= 0 ? "text-green-600" : "text-red-600")}>
                        {formatarMoeda(totaisPortfolioAtualizado.lucroTotalNaoRealizado)}
                      </TableCell>
                      <TableCell className={cn(percentualTotalPortfolio > 0 ? "text-green-600" : "text-red-600")}>
                        {formatarPercentual(percentualTotalPortfolio)}
                      </TableCell>
                      <TableCell className={cn(totaisPortfolioAtualizado.lucroTotalRealizado >= 0 ? "text-green-600" : "text-red-600")}>
                        {formatarMoeda(totaisPortfolioAtualizado.lucroTotalRealizado)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              
              {/* Versão para mobile (Atualizada) */}
              <div className="md:hidden">
                {portfolio.map((item) => (
                  <div key={item.moeda_id} className="border-t border-border p-4">
                    <div className="flex items-center mb-2">
                      {item.image ? (
                        <>
                          <div className="relative w-6 h-6">
                            <Image src={item.image} alt={item.nome} fill className="object-contain rounded-full" onError={(e) => { const img = e.target as HTMLImageElement; img.src = "/placeholder-coin.png"; }} />
                          </div>
                          <span className="font-medium ml-2">{item.nome} ({item.simbolo.toUpperCase()})</span>
                        </>
                      ) : (
                        <span className="font-medium">{item.nome} ({item.simbolo.toUpperCase()})</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Qtde Atual:</span> {formatarQuantidade(item.quantidade)}</div>
                      <div><span className="text-muted-foreground">Custo Médio:</span> {formatarMoeda(item.valorMedio)}</div>
                      <div><span className="text-muted-foreground">Custo Base:</span> {formatarMoeda(item.valorTotal)}</div>
                      <div><span className="text-muted-foreground">Preço Atual:</span> {formatarMoeda(item.precoAtual)}</div>
                      <div><span className="text-muted-foreground">Valor Atual:</span> {formatarMoeda(item.valorAtualizado)}</div>
                      <div className={cn(item.lucro >= 0 ? "text-green-600" : "text-red-600")}>
                        <span className="text-muted-foreground">L/P Não Real.:</span> {formatarMoeda(item.lucro)}
                      </div>
                      <div className={cn(item.percentual >= 0 ? "text-green-600" : "text-red-600")}>
                        ({formatarPercentual(item.percentual)})
                      </div>
                      <div className={cn(item.lucroRealizado >= 0 ? "text-green-600" : "text-red-600")}>
                        <span className="text-muted-foreground">L/P Realizado:</span> {formatarMoeda(item.lucroRealizado)}
                      </div>
                    </div>
                  </div>
                ))}

                <div className="border-t-2 border-border p-4">
                  <div className="font-semibold mb-2">Total Portfólio</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Custo Base:</span> {formatarMoeda(totaisPortfolioAtualizado.valorTotalInvestido)}</div>
                    <div><span className="text-muted-foreground">Valor Atual:</span> {formatarMoeda(totaisPortfolioAtualizado.valorTotalAtualizado)}</div>
                    <div className={cn(totaisPortfolioAtualizado.lucroTotalNaoRealizado >= 0 ? "text-green-600" : "text-red-600")}>
                      <span className="text-muted-foreground">L/P Não Real.:</span> {formatarMoeda(totaisPortfolioAtualizado.lucroTotalNaoRealizado)}
                    </div>
                    <div className={cn(totaisPortfolioAtualizado.lucroTotalRealizado >= 0 ? "text-green-600" : "text-red-600")}>
                      <span className="text-muted-foreground">L/P Realizado:</span> {formatarMoeda(totaisPortfolioAtualizado.lucroTotalRealizado)}
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
            <TabsTrigger value="compra">Compras</TabsTrigger>
            <TabsTrigger value="venda">Vendas</TabsTrigger>
            <TabsTrigger value="todas">Todas</TabsTrigger>
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

      {/* Tabela de operações <<< APLICAR CONDIÇÕES AQUI >>> */}
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
          ) : operacoesOrdenadas.length > 0 ? (
            <>
              {/* Versão para desktop */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {/* Data */}
                      {true && (
                        <TableHead>
                          <Button variant="ghost" onClick={() => requestSort('data_operacao')} className="px-2 py-1 h-auto -ml-2">
                            Data {renderSortArrow('data_operacao')}
                          </Button>
                        </TableHead>
                      )}
                      {/* Tipo */}
                      {true && (
                        <TableHead>Tipo</TableHead>
                      )}
                      {/* Moeda */}
                      {true && (
                        <TableHead>
                          <Button variant="ghost" onClick={() => requestSort('nome')} className="px-2 py-1 h-auto -ml-2">
                            Moeda {renderSortArrow('nome')}
                          </Button>
                        </TableHead>
                      )}
                      {/* Qtde */}
                      {true && (
                        <TableHead>
                          <Button variant="ghost" onClick={() => requestSort('quantidade')} className="px-2 py-1 h-auto -ml-2">
                            Qtde {renderSortArrow('quantidade')}
                          </Button>
                        </TableHead>
                      )}
                      {/* Valor Op. */}
                      {true && (
                        <TableHead>Valor Op.</TableHead>
                      )}
                      {/* Total Op. */}
                      {true && (
                        <TableHead>
                          <Button variant="ghost" onClick={() => requestSort('valor_total')} className="px-2 py-1 h-auto -ml-2">
                            Total Op. {renderSortArrow('valor_total')}
                          </Button>
                        </TableHead>
                      )}
                      {/* Valor Atual */}
                      {activeTab === 'compra' && (
                        <TableHead>Valor Atual</TableHead>
                      )}
                      {/* Valor Total Atual */}
                      {activeTab === 'compra' && (
                        <TableHead>
                          <Button variant="ghost" onClick={() => requestSort('valorAtualizado')} className="px-2 py-1 h-auto -ml-2">
                            Valor Total Atual {renderSortArrow('valorAtualizado')}
                          </Button>
                        </TableHead>
                      )}
                      {/* Lucro/Prejuízo */}
                      {activeTab === 'compra' && (
                        <TableHead>
                          <Button variant="ghost" onClick={() => requestSort('lucro')} className="px-2 py-1 h-auto -ml-2">
                            Lucro/Prejuízo {renderSortArrow('lucro')}
                          </Button>
                        </TableHead>
                      )}
                      {/* % */}
                      {activeTab === 'compra' && (
                        <TableHead>
                          <Button variant="ghost" onClick={() => requestSort('percentual')} className="px-2 py-1 h-auto -ml-2">
                            % {renderSortArrow('percentual')}
                          </Button>
                        </TableHead>
                      )}
                      {/* Exchange */}
                      {true && (
                        <TableHead>Exchange</TableHead>
                      )}
                      {/* Ações */}
                      {true && (
                        <TableHead className="text-left">Ações</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {operacoesOrdenadas.map((op) => {
                      const { valorAtualizado, lucro: lucroPrejuizo, percentual } = op;
                      const moeda = topMoedas.find(m => m.id === op.moeda_id);
                      const precoAtual = getPrecoAtual(op.moeda_id);
                      
                      return (
                        <TableRow
                          key={op.id}
                        >
                          {/* Renderização Condicional das Células Desktop */}
                          {activeTab === 'venda' ? (
                            <>
                              {/* Células permitidas para Venda */}
                              {true && <TableCell>{formatarData(op.data_operacao)}</TableCell>}
                              {true && (
                                <TableCell>
                                  <Badge variant={"destructive"}> {/* Sempre Venda aqui */}
                                    {op.tipo.charAt(0).toUpperCase() + op.tipo.slice(1)}
                                  </Badge>
                                </TableCell>
                              )}
                              {true && (
                                <TableCell className="flex items-center space-x-2">
                                  {moeda ? (
                                    <>
                                      {/* ... Imagem e nome ... */}
                                      <div className="relative w-6 h-6">
                                        <Image src={moeda.image} alt={moeda.name} fill className="object-contain rounded-full" onError={(e) => { const img = e.target as HTMLImageElement; img.src = "/placeholder-coin.png"; }} />
                                      </div>
                                      <span className="font-medium">{moeda.name}</span>
                                    </>
                                  ) : (
                                    <span>Moeda não encontrada</span>
                                  )}
                                </TableCell>
                              )}
                              {true && <TableCell>{formatarQuantidade(op.quantidade)}</TableCell>}
                              {true && <TableCell>{formatarMoeda(op.preco_unitario)}</TableCell>}
                              {true && <TableCell>{formatarMoeda(op.valor_total)}</TableCell>}
                              {/* Colunas ocultas para Venda: Valor Atual, Valor Total Atual, Lucro/Prejuízo, % */}
                              {true && <TableCell>{op.exchange}</TableCell>}
                              {true && (
                                <TableCell className="text-left">
                                  <div className="flex space-x-2">
                                    {/* ... Botões Editar/Excluir ... */}
                                    <Button size="sm" variant="outline" onClick={() => editarOperacao(op.id)}><Pencil className="h-4 w-4 mr-1" /> Editar</Button>
                                    <Button size="sm" variant="outline" className="text-red-500 hover:text-red-700" onClick={() => excluirOperacao(op.id)}><Trash2 className="h-4 w-4 mr-1" /> Excluir</Button>
                                  </div>
                                </TableCell>
                              )}
                            </>
                          ) : (
                            <>
                              {/* Células para Compras ou Todas */}
                              {/* Células Comuns - Sempre mostrar */}
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
                                      <Image src={moeda.image} alt={moeda.name} fill className="object-contain rounded-full" onError={(e) => { const img = e.target as HTMLImageElement; img.src = "/placeholder-coin.png"; }} />
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

                              {/* Células Específicas - Mostrar apenas em Compras */}
                              {activeTab === 'compra' && (
                                <>
                                  <TableCell>{formatarMoeda(precoAtual)}</TableCell>
                                  <TableCell>{formatarMoeda(valorAtualizado)}</TableCell>
                                  <TableCell className={cn(lucroPrejuizo > 0 ? "text-green-600" : lucroPrejuizo < 0 ? "text-red-600" : "")}>
                                    {formatarMoeda(lucroPrejuizo)}
                                  </TableCell>
                                  <TableCell className={cn(percentual > 0 ? "text-green-600" : percentual < 0 ? "text-red-600" : "")}>
                                    {formatarPercentual(percentual)}
                                  </TableCell>
                                </>
                              )}

                              {/* Células Comuns Restantes - Sempre mostrar */}
                              <TableCell>{op.exchange}</TableCell>
                              <TableCell className="text-left">
                                <div className="flex space-x-2">
                                  <Button size="sm" variant="outline" onClick={() => editarOperacao(op.id)}><Pencil className="h-4 w-4 mr-1" /> Editar</Button>
                                  <Button size="sm" variant="outline" className="text-red-500 hover:text-red-700" onClick={() => excluirOperacao(op.id)}><Trash2 className="h-4 w-4 mr-1" /> Excluir</Button>
                                </div>
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              
              {/* Versão para mobile (aplica condições aos elementos de dados <<< AQUI >>>) */}
              <div className="md:hidden">
                {operacoesOrdenadas.map((op) => {
                  const { valorAtualizado, lucro: lucroPrejuizo, percentual } = op;
                  const moeda = topMoedas.find(m => m.id === op.moeda_id);
                  const precoAtual = getPrecoAtual(op.moeda_id);
                  return (
                    <div key={op.id} className="border-t border-border p-4">
                      {/* Bloco Moeda/Data/Tipo (sempre visível) */}
                      {true && (
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
                      )}
                      
                      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                        {/* Quantidade */}
                        {true && (
                          <div>
                            <span className="text-muted-foreground">Quantidade:</span> {formatarQuantidade(op.quantidade)}
                          </div>
                        )}
                        {/* Valor Op. */}
                        {true && (
                          <div>
                            <span className="text-muted-foreground">Valor Op.:</span> {formatarMoeda(op.preco_unitario)}
                          </div>
                        )}
                        {/* Total Op. */}
                        {true && (
                          <div>
                            <span className="text-muted-foreground">Total Op.:</span> {formatarMoeda(op.valor_total)}
                          </div>
                        )}
                        {/* Exchange */}
                        {true && (
                          <div>
                            <span className="text-muted-foreground">Exchange:</span> {op.exchange}
                          </div>
                        )}
                        {/* Preço Atual */}
                        {activeTab === 'compra' && (
                          <div>
                            <span className="text-muted-foreground">Preço Atual:</span> {formatarMoeda(precoAtual)}
                          </div>
                        )}
                        {/* Valor Atual */}
                        {activeTab === 'compra' && (
                          <div>
                            <span className="text-muted-foreground">Valor Atual:</span> {formatarMoeda(valorAtualizado)}
                          </div>
                        )}
                        {/* Lucro/Prejuízo */}
                        {activeTab === 'compra' && (
                          <div className={cn(
                            lucroPrejuizo > 0 ? "text-green-600" : lucroPrejuizo < 0 ? "text-red-600" : ""
                          )}>
                            <span className="text-muted-foreground">Lucro/Prejuízo:</span> {formatarMoeda(lucroPrejuizo)}
                          </div>
                        )}
                        {/* % */}
                        {activeTab === 'compra' && (
                          <div className={cn(
                            percentual > 0 ? "text-green-600" : percentual < 0 ? "text-red-600" : ""
                          )}>
                            {formatarPercentual(percentual)}
                          </div>
                        )}
                      </div>
                      
                      {/* Ações */}
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
          ) : (
            <div className="flex flex-col justify-center items-center py-12">
              <p className="text-muted-foreground mb-4">Nenhuma operação encontrada</p>
              <Button onClick={novaOperacao}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Operação
              </Button>
            </div>
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