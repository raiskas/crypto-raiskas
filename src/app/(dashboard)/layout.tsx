import { AuthProvider } from "@/providers/auth-provider";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../globals.css";
import { TopNav } from "@/components/layouts/top-nav";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Dashboard - Crypto Raiskas",
  description: "Área administrativa",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider requireAuth={true}>
      <div className="flex min-h-screen flex-col">
        <TopNav />
        <main className="flex-1 p-4 md:p-6">{children}</main>
        <Toaster />
      </div>
    </AuthProvider>
  );
} 