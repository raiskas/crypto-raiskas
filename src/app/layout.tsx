import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { DevServiceWorkerReset } from "@/components/dev/dev-service-worker-reset";
// Importar AuthProvider
import { AuthProvider } from "@/providers/auth-provider"; 
// REMOVIDO: Imports Supabase para simplificação
// import { createServerClient } from '@supabase/ssr';
// import { cookies } from 'next/headers';
// import { Database } from '@/types/supabase';
// import SupabaseProvider from '@/components/supabase-provider';
// import { supabaseConfig } from '@/lib/config';

const inter = Inter({ subsets: ["latin"] });
const LOCALHOST_SW_RESET_KEY = "crypto-raiskas:localhost-sw-reset";

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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                if (typeof window === 'undefined') return;
                var host = window.location.hostname;
                var isLocalhost = host === 'localhost' || host === '127.0.0.1';
                if (!isLocalhost) return;
                if (!('serviceWorker' in navigator)) return;

                function resetLocalhostServiceWorker() {
                  navigator.serviceWorker.getRegistrations()
                    .then(function (registrations) {
                      var hadRegistrations = registrations.length > 0;
                      return Promise.all(registrations.map(function (registration) {
                        return registration.unregister();
                      })).then(function () {
                        if (!('caches' in window)) return hadRegistrations;
                        return window.caches.keys().then(function (keys) {
                          return Promise.all(keys.map(function (key) {
                            return window.caches.delete(key);
                          })).then(function () {
                            return hadRegistrations;
                          });
                        });
                      });
                    })
                    .then(function (hadRegistrations) {
                      if (!hadRegistrations) return;
                      if (window.sessionStorage.getItem('${LOCALHOST_SW_RESET_KEY}')) return;
                      window.sessionStorage.setItem('${LOCALHOST_SW_RESET_KEY}', '1');
                      window.location.reload();
                    })
                    .catch(function (error) {
                      console.warn('[LocalhostSWReset] Falha ao limpar service workers locais:', error);
                    });
                }

                resetLocalhostServiceWorker();
              })();
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          {process.env.NODE_ENV === "development" && <DevServiceWorkerReset />}
          {/* Envolver children com AuthProvider */}
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
