"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface AuthLoadingProps {
  message?: string;
}

export function AuthLoading({ message = "Autenticando..." }: AuthLoadingProps) {
  const [dots, setDots] = useState("");
  
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev.length >= 3) return "";
        return prev + ".";
      });
    }, 500);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-lg font-medium">
          {message}{dots}
        </p>
        <p className="text-sm text-muted-foreground mt-2 max-w-md text-center">
          Por favor, aguarde enquanto verificamos sua sessão.
          Se esta tela persistir por mais de 10 segundos, recarregue a página.
        </p>
      </div>
    </div>
  );
} 