import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { DashboardHeader } from "@/components/layouts/dashboard-header";
import { DashboardRuntimeBoundary } from "@/components/layouts/dashboard-runtime-boundary";

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
    <DashboardRuntimeBoundary>
      <div className="flex min-h-screen flex-col">
        <DashboardHeader />
        <main className="flex-1 p-4 pt-6 md:p-6">
          {children}
        </main>
        <Toaster />
      </div>
    </DashboardRuntimeBoundary>
  );
} 
