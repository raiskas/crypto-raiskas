import { AuthProvider } from "@/providers/auth-provider";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../globals.css";
import { AuthHeader } from "@/components/layouts/auth-header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Autenticação - Crypto Raiskas",
  description: "Entre ou cadastre-se",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  console.log("[(Auth) Layout] Renderizando layout de autenticação...");
  return (
    <AuthProvider requireAuth={false}>
      <div className="flex min-h-screen flex-col">
        {/* <AuthHeader /> // Manter comentado por enquanto */}
        <main className="flex-1">{children}</main>
      </div>
    </AuthProvider>
  );
} 