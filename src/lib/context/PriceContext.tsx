'use client';

import React, { createContext, useState, useEffect, useContext, useCallback, ReactNode } from 'react';

// Interface para a resposta da nossa API /api/preco
interface ApiResponse {
  price?: number;
  error?: string;
}

// Interface para o valor que o contexto fornecerá
interface PriceContextType {
  price: number | null;
  isLoading: boolean;
  error: string | null;
  isUpdating: boolean; // Indica se uma atualização em background está ocorrendo
}

// Cria o contexto com um valor padrão inicial
const PriceContext = createContext<PriceContextType>({ 
  price: null, 
  isLoading: true, // Começa como loading
  error: null,
  isUpdating: false,
});

// Hook customizado para facilitar o uso do contexto
export const usePrice = () => useContext(PriceContext);

// Interface para as props do Provider
interface PriceProviderProps {
  children: ReactNode;
}

// Componente Provider
export function PriceProvider({ children }: PriceProviderProps) {
  const [price, setPrice] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Loading inicial
  const [isUpdating, setIsUpdating] = useState<boolean>(false); // Atualização periódica

  // Função para buscar o preço (similar à da página anterior)
  const fetchPrice = useCallback(async (isInitialLoad = false) => {
    console.log(`[PriceProvider] Iniciando busca de preço. InitialLoad: ${isInitialLoad}`);
    if (!isInitialLoad) {
      setIsUpdating(true);
    }
    // Não resetamos o erro aqui intencionalmente para que ele persista até a próxima busca bem-sucedida
    // setError(null);

    try {
      const response = await fetch('/api/preco');
      console.log(`[PriceProvider] Resposta da API recebida. Status: ${response.status}`);

      if (!response.ok) {
        let errorMsg = `Erro HTTP: ${response.status}`;
        try {
          const errorData: ApiResponse = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch { /* Ignora erro no parse do JSON */ }
        throw new Error(errorMsg);
      }

      const data: ApiResponse = await response.json();
      console.log('[PriceProvider] Dados da API processados:', data);

      if (typeof data.price === 'number') {
        setPrice(data.price);
        setError(null); // Limpa o erro em caso de sucesso
      } else {
        throw new Error(data.error || 'Formato de preço inválido recebido da API.');
      }
    } catch (err: unknown) {
      console.error("[PriceProvider] Erro ao buscar preço:", err);
      const errorMessage = err instanceof Error ? err.message : 'Falha desconhecida ao buscar o preço.';
      setError(errorMessage);
    } finally {
      if (isInitialLoad) {
        setIsLoading(false);
      }
      setIsUpdating(false);
      console.log("[PriceProvider] Busca de preço finalizada.");
    }
  }, []);

  // Efeito para busca inicial e intervalo
  useEffect(() => {
    fetchPrice(true); // Carga inicial
    const intervalId = setInterval(() => {
      fetchPrice(false); // Atualizações periódicas
    }, 60000); // 60 segundos

    return () => clearInterval(intervalId);
  }, [fetchPrice]);

  // Valor a ser fornecido pelo contexto
  const value = { price, isLoading, error, isUpdating };

  return (
    <PriceContext.Provider value={value}>
      {children}
    </PriceContext.Provider>
  );
} 