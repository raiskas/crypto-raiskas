'use client';

import React, { createContext, useState, useEffect, useContext, useCallback, ReactNode } from 'react';

// Interface para a resposta da nossa API /api/crypto/prices
interface PriceMap {
  [coinId: string]: number | null;
}

// Interface para o valor que o contexto fornecerá
interface PriceContextType {
  prices: PriceMap; // Alterado de price para prices
  isLoading: boolean;
  error: string | null;
  isUpdating: boolean; 
}

// Cria o contexto com um valor padrão inicial
const PriceContext = createContext<PriceContextType>({ 
  prices: {}, // Começa com mapa vazio
  isLoading: true, 
  error: null,
  isUpdating: false,
});

// Hook customizado para facilitar o uso do contexto
export const usePrice = () => useContext(PriceContext);

// Interface para as props do Provider
interface PriceProviderProps {
  children: ReactNode;
}

// Remover lista fixa
// const COIN_IDS_TO_TRACK = [...].join(',');

// Componente Provider Refatorado
export function PriceProvider({ children }: PriceProviderProps) {
  const [prices, setPrices] = useState<PriceMap>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true); 
  const [isUpdating, setIsUpdating] = useState<boolean>(false); 
  const [trackedCoinIds, setTrackedCoinIds] = useState<string[]>([]); // <<< Novo estado para IDs
  const [isLoadingIds, setIsLoadingIds] = useState<boolean>(true); // <<< Loading para IDs

  // <<< useEffect para buscar os IDs relevantes
  useEffect(() => {
    const fetchRelevantIds = async () => {
      console.log("[PriceProvider] Buscando IDs de moedas relevantes...");
      setIsLoadingIds(true);
      try {
        const response = await fetch('/api/crypto/relevant-coin-ids', {
          credentials: 'include' // Incluir cookies de autenticação
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Erro HTTP: ${response.status}`);
        }
        const ids: string[] = await response.json();
        console.log("[PriceProvider] IDs relevantes recebidos:", ids);
        setTrackedCoinIds(ids);
        // Não definimos erro aqui, pois a busca de preços pode funcionar mesmo sem todos os IDs
      } catch (err) {
        console.error("[PriceProvider] Erro ao buscar IDs relevantes:", err);
        setError("Erro ao determinar moedas para rastrear."); // Define um erro se a busca de IDs falhar
        setTrackedCoinIds([]); // Usa lista vazia em caso de erro
      } finally {
        setIsLoadingIds(false);
      }
    };

    fetchRelevantIds();
  }, []); // Executa apenas uma vez na montagem do provider

  // Função refatorada para buscar múltiplos preços
  const fetchPrices = useCallback(async (isInitialLoad = false) => {
    // <<< Só busca preços se tivermos IDs e não estiver carregando IDs
    if (isLoadingIds || trackedCoinIds.length === 0) {
      console.log("[PriceProvider] Aguardando IDs relevantes ou lista vazia, pulando busca de preços.");
       if (isInitialLoad && !isLoadingIds) setIsLoading(false); // Se terminou de carregar IDs mas a lista está vazia, termina o loading inicial
      return;
    }

    const idsString = trackedCoinIds.join(',');
    console.log(`[PriceProvider] Iniciando busca de preços para: ${idsString}`);
    if (!isInitialLoad) {
      setIsUpdating(true);
    }

    try {
      // <<< Usa a string de IDs dinâmica
      const response = await fetch(`/api/crypto/prices?ids=${idsString}`);
      console.log(`[PriceProvider] Resposta da API /prices recebida. Status: ${response.status}`);

      if (!response.ok) {
        let errorMsg = `Erro HTTP: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData?.error || errorMsg;
        } catch { /* Ignora */ }
        throw new Error(errorMsg);
      }

      const data: PriceMap = await response.json();
      console.log('[PriceProvider] Mapa de preços recebido:', data);

      setPrices(prevPrices => ({ ...prevPrices, ...data })); 
      setError(null); 

    } catch (err: unknown) {
      console.error("[PriceProvider] Erro ao buscar preços:", err);
      const errorMessage = err instanceof Error ? err.message : 'Falha desconhecida ao buscar preços.';
      setError(errorMessage);
    } finally {
      if (isInitialLoad) {
        setIsLoading(false);
      }
      setIsUpdating(false);
      console.log("[PriceProvider] Busca de preços finalizada.");
    }
  // <<< Adiciona trackedCoinIds e isLoadingIds às dependências
  }, [trackedCoinIds, isLoadingIds]); 

  // Efeito para busca inicial e intervalo (agora depende de fetchPrices)
  useEffect(() => {
    // Só inicia o fetch inicial e o intervalo se os IDs já foram carregados
    if (!isLoadingIds) {
        fetchPrices(true); // Carga inicial
        const intervalId = setInterval(() => {
          fetchPrices(false); // Atualizações periódicas
        }, 60000); // 60 segundos

        return () => clearInterval(intervalId); // Limpa o intervalo
    }
  }, [fetchPrices, isLoadingIds]); // Roda quando fetchPrices muda ou isLoadingIds se torna false

  // O valor do contexto agora reflete o loading combinado (IDs + Preços)
  const combinedLoading = isLoading || isLoadingIds;
  const value = { prices, isLoading: combinedLoading, error, isUpdating };

  return (
    <PriceContext.Provider value={value}>
      {children}
    </PriceContext.Provider>
  );
} 