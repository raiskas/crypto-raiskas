import { redirect } from 'next/navigation';

/**
 * Página principal do dashboard
 * Redireciona para a página home que contém o dashboard completo
 */
export default function DashboardPage() {
  // Redireciona para a página home que contém o dashboard completo
  redirect('/home');
} 