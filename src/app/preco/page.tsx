'use client';

import { usePrice } from '@/lib/context/PriceContext'; // Importar o hook usePrice

// Remover as interfaces e a lógica de estado/efeito daqui
// interface ApiResponse {...}

export default function PrecoPage() {
  // Consumir os valores do contexto
  const { prices, isLoading, error, isUpdating } = usePrice();
  const btcPrice = prices.bitcoin ?? null;

  // Remover a função fetchPrice e os useEffect/useCallback
  // const fetchPrice = useCallback(...);
  // useEffect(...);

  // A lógica de formatação continua a mesma
  const formattedPrice = btcPrice !== null
    ? btcPrice.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
    : '---';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background text-foreground">
      <div className="text-center p-6 border rounded-lg shadow-md bg-card text-card-foreground max-w-md w-full">
        <h1 className="text-2xl font-bold mb-4">Preço do Bitcoin</h1>
        
        {/* Usar isLoading do contexto */}
        {isLoading ? (
          <p className="text-lg animate-pulse">Carregando...</p>
        ) : (
          <p className="text-3xl font-semibold mb-4">{formattedPrice}</p>
        )}

        {/* Usar isUpdating do contexto */}
        {isUpdating && !isLoading && (
           <p className="text-sm text-muted-foreground animate-pulse">Atualizando...</p>
        )}

        {/* Usar error do contexto */}
        {error && (
          <p className="text-red-500 mt-2 text-sm">Erro: {error}</p>
        )}

        {!isLoading && (
          <p className="text-xs text-muted-foreground mt-4">
            Valor fornecido pelo PriceProvider.
          </p>
        )}
      </div>
    </div>
  );
} 
