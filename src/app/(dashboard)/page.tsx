import { permanentRedirect } from 'next/navigation';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Painel de controle do sistema',
};

/**
 * Página principal do dashboard
 * Redireciona permanentemente para a página home que contém o dashboard completo
 */
export default function DashboardPage() {
  // Força a geração dos arquivos necessários
  if (typeof window === 'undefined') {
    return null;
  }
  
  permanentRedirect('/home');
}

// Redirecionamento após o conteúdo ser renderizado
export function generateMetadata() {
  permanentRedirect('/home');
} 