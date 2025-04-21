"use client";

import { useRouter, usePathname } from "next/navigation";
import { PropsWithChildren, useEffect } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { AuthLoading } from "@/components/auth-loading";
import { AUTH_ROUTES, HOME_ROUTE } from "@/lib/config/routes";

// Lista de rotas públicas (não exigem autenticação)
// const publicPaths = ['/signin', '/signup', '/forgot-password', '/auth-diagnostico'];

interface AuthProviderProps extends PropsWithChildren {
  requireAuth?: boolean;
}

export function AuthProvider({ 
  children, 
  requireAuth = true // Esta prop pode não ser mais necessária se o middleware fizer tudo
}: AuthProviderProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  
  /* // REMOVIDO: Lógica de redirecionamento agora centralizada em /app/page.tsx e middleware
  useEffect(() => {
    // Pular verificação se estiver carregando ou se a sessão ainda não foi verificada
    if (loading || !sessionChecked) { 
      // console.log("[AuthProvider] useEffect: Pulando redirecionamento (loading || !sessionChecked).");
      return;
    }
    
    // console.log("[AuthProvider] useEffect: Verificando redirecionamento...", { user: !!user, pathname });
    
    // Se está autenticado e está tentando acessar página de login/cadastro → redirecionar para home
    if (user && AUTH_ROUTES.includes(pathname)) {
      // console.log(`[AuthProvider] useEffect: Usuário logado tentando acessar rota de auth (${pathname}). Redirecionando para ${HOME_ROUTE}...`);
      router.push(HOME_ROUTE);
      return;
    }

  }, [user, loading, sessionChecked, pathname, router]); 
  */
  
  // Mostrar componente de loading enquanto verifica autenticação inicial
  if (loading) {
    // REMOVIDO: console.log("[AuthProvider] Estado loading=true. Renderizando AuthLoading...");
    return <AuthLoading />;
  }
  
  // Se não está carregando, simplesmente renderiza os children
  // A proteção de rota é feita pelo middleware
  // REMOVIDO: console.log("[AuthProvider] Estado loading=false. Renderizando children (sem useEffect de redirecionamento).");
  return <>{children}</>;
} 