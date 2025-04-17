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
  // Conteúdo mínimo para garantir que o Next.js gere os arquivos necessários
  return (
    <div className="hidden">
      <h1>Dashboard</h1>
    </div>
  );
}

// Redirecionamento após o conteúdo ser renderizado
export function generateMetadata() {
  permanentRedirect('/home');
} 