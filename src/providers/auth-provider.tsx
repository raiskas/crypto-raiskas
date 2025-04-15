"use client";

import { useRouter, usePathname } from "next/navigation";
import { PropsWithChildren, useEffect } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { AuthLoading } from "@/components/auth-loading";

// Lista de rotas públicas (não exigem autenticação)
const publicPaths = ['/signin', '/signup', '/forgot-password', '/auth-diagnostico'];

interface AuthProviderProps extends PropsWithChildren {
  requireAuth?: boolean;
}

export function AuthProvider({ 
  children, 
  requireAuth = true 
}: AuthProviderProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  
  useEffect(() => {
    // Pular verificação se estiver carregando
    if (loading) return;
    
    // Se estiver na raiz, redirecionar com base na autenticação
    if (pathname === '/') {
      if (user) {
        router.push('/home');
      } else {
        router.push('/signin');
      }
      return;
    }
    
    // Verificação simples: se precisa de auth e não tem usuário → redirecionar para login
    if (requireAuth && !user && !publicPaths.includes(pathname)) {
      router.push('/signin');
      return;
    }
    
    // Se já está autenticado e está tentando acessar página de login/cadastro → redirecionar para home
    if (user && publicPaths.includes(pathname)) {
      router.push('/home');
      return;
    }
  }, [user, loading, pathname, router, requireAuth]);
  
  // Mostrar componente de loading enquanto verifica autenticação
  if (loading) {
    return <AuthLoading />;
  }
  
  return <>{children}</>;
} 