import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// Import date-fns functions needed for formatDate
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Adicionar a função formatDate
export const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "Nunca";
  try {
      // Tentar detectar se é ISO 8601 com timezone (Z ou +/-HH:mm)
      if (dateString.includes('T') && (dateString.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateString))) {
          return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: ptBR });
      }
      // Tentar tratar outros formatos comuns (ex: com espaço)
      // Cuidado: new Date() pode ser inconsistente entre browsers sem timezone
      return format(new Date(dateString.replace(' ', 'T')), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch (err) {
      console.warn("Erro ao formatar data:", dateString, err);
      return "Inválida"; // Retornar string indicando erro
  }
};

/**
 * Formata um valor numérico como moeda usando as convenções dos EUA (en-US).
 *
 * @param value O valor numérico a ser formatado.
 * @param options Opções adicionais do Intl.NumberFormat para sobrescrever os padrões.
 *                Por padrão, usa minimumFractionDigits: 2, maximumFractionDigits: 2.
 *                Passe { maximumFractionDigits: 8 } para exibir mais decimais, por exemplo.
 * @returns A string formatada, ou uma string vazia se o valor não for um número válido.
 */
export const formatCurrency = (
  value: number | null | undefined,
  options?: Intl.NumberFormatOptions
): string => {
  if (typeof value !== 'number' || isNaN(value)) {
    return ""; // Retorna vazio para valores inválidos ou não numéricos
  }

  // Opções padrão
  const defaultOptions: Intl.NumberFormatOptions = {
    style: 'decimal', // Usar 'currency' e 'currency: 'USD'' para adicionar o símbolo $
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    // locale: 'en-US' é implícito no Intl padrão, mas pode ser explicitado se necessário
  };

  // Mescla opções padrão com as opções fornecidas
  const finalOptions = { ...defaultOptions, ...options };

  try {
    return new Intl.NumberFormat('en-US', finalOptions).format(value);
  } catch (error) {
    console.error("Erro ao formatar moeda:", value, error);
    return String(value); // Retorna o número como string em caso de erro
  }
};
