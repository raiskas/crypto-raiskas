'use client';

import { useState, useEffect, useCallback } from 'react';

// Define a interface para a resposta esperada da nossa API
interface ApiResponse {
  price?: number;
  error?: string;
}

export default function PrecoPage() {
  const [price, setPrice] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Estado de loading inicial, será true apenas na primeira carga
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // Estado para indicar se uma atualização periódica está em andamento
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const fetchPrice = useCallback(async (isInitialLoad = false) => {
    console.log(`[Página /preco] Iniciando busca de preço. InitialLoad: ${isInitialLoad}`);
    if (!isInitialLoad) {
      setIsUpdating(true); // Indica que uma atualização periódica começou
    }
    setError(null); // Limpa erro anterior a cada tentativa

    try {
      const response = await fetch('/api/preco');
      console.log(`[Página /preco] Resposta da API recebida. Status: ${response.status}`);

      // Se a resposta não for OK, tenta extrair a mensagem de erro da API
      if (!response.ok) {
        let errorMsg = `Erro HTTP: ${response.status}`;
        try {
          const errorData: ApiResponse = await response.json();
          if (errorData.error) {
            errorMsg = errorData.error;
          }
        } catch (jsonError) {
          // Ignora se não conseguir parsear o JSON do erro
          console.warn("[Página /preco] Não foi possível parsear JSON da resposta de erro.");
        }
        throw new Error(errorMsg);
      }

      const data: ApiResponse = await response.json();
      console.log('[Página /preco] Dados da API processados:', data);

      if (typeof data.price === 'number') {
        setPrice(data.price);
      } else {
        // Se a API retornar sucesso mas sem preço, considera um erro
        throw new Error(data.error || 'Formato de preço inválido recebido da API.');
      }
    } catch (err: unknown) {
      console.error("[Página /preco] Erro ao buscar preço:", err);
      const errorMessage = err instanceof Error ? err.message : 'Falha desconhecida ao buscar o preço.';
      setError(errorMessage);
      // Não limpamos o preço aqui para que o último valor válido possa continuar sendo exibido
      // setPrice(null);
    } finally {
      // Marca o fim do loading inicial apenas uma vez
      if (isInitialLoad) {
        setIsLoading(false);
      }
      setIsUpdating(false); // Indica que a atualização periódica terminou
      console.log("[Página /preco] Busca de preço finalizada.");
    }
  }, []); // useCallback para evitar recriação desnecessária da função

  // Efeito para buscar o preço na montagem inicial e configurar o intervalo
  useEffect(() => {
    // Passa true para indicar que é a carga inicial
    fetchPrice(true);

    const intervalId = setInterval(() => {
      // Passa false para as buscas periódicas
      fetchPrice(false);
    }, 60000); // Atualiza a cada 60 segundos

    // Limpa o intervalo quando o componente é desmontado
    return () => clearInterval(intervalId);
  }, [fetchPrice]); // Inclui fetchPrice como dependência do useEffect

  // Formatação do preço
  const formattedPrice = price !== null
    ? price.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
    : '---';

  return (
    // Usa classes Tailwind comuns para centralizar e dar espaçamento
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background text-foreground">
      <div className="text-center p-6 border rounded-lg shadow-md bg-card text-card-foreground max-w-md w-full">
        <h1 className="text-2xl font-bold mb-4">Preço do Bitcoin</h1>
        
        {isLoading ? (
          <p className="text-lg animate-pulse">Carregando...</p>
        ) : (
          <p className="text-3xl font-semibold mb-4">{formattedPrice}</p>
        )}

        {isUpdating && !isLoading && (
           <p className="text-sm text-muted-foreground animate-pulse">Atualizando...</p>
        )}

        {error && (
          <p className="text-red-500 mt-2 text-sm">Erro: {error}</p>
        )}

        {!isLoading && (
          <p className="text-xs text-muted-foreground mt-4">
            Atualizado automaticamente a cada 60 segundos.
          </p>
        )}
      </div>
    </div>
  );
} 