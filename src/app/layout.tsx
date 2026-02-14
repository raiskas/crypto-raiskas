import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
// Importar AuthProvider
import { AuthProvider } from "@/providers/auth-provider"; 
// REMOVIDO: Imports Supabase para simplificação
// import { createServerClient } from '@supabase/ssr';
// import { cookies } from 'next/headers';
// import { Database } from '@/types/supabase';
// import SupabaseProvider from '@/components/supabase-provider';
// import { supabaseConfig } from '@/lib/config';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Crypto Raiskas",
  description: "Plataforma financeira",
  manifest: "/manifest.json",
  themeColor: "#000000",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Crypto Raiskas",
  },
};

// Layout MÁXIMAMENTE SIMPLIFICADO
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // REMOVIDO: console.log("--- [RootLayout] Renderizando --- // Adicionado para depuração");
  // console.log("[RootLayout] Renderizando layout com ThemeProvider e AuthProvider."); // Log antigo comentado

  /* REMOVIDO: useEffect para logar montagem/desmontagem
  useEffect(() => {
    console.log("[RootLayout] <<< MONTADO >>>");
    return () => {
      console.log("[RootLayout] <<< DESMONTADO >>>");
    };
  }, []);
  */

  // REMOVIDO: Lógica de busca de sessão no servidor
  // const cookieStore = cookies();
  // const supabase = createServerClient... 
  // const { data: { session } } = await supabase.auth.getSession();
  // console.log(...);

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#000000" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          {/* Envolver children com AuthProvider */}
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
