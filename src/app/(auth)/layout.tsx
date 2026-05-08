import type { Metadata } from "next";
import { Inter } from "next/font/google";

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
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">{children}</main>
    </div>
  );
} 
