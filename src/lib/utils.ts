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
