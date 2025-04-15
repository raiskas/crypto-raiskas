"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/hooks/use-auth";
import { useUserData } from "@/lib/hooks/use-user-data";

export function DashboardHeader() {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const { userData, loading } = useUserData();

  const handleLogout = async () => {
    await signOut();
    router.push("/signin");
  };

  return (
    <header className="sticky top-0 z-10 w-full border-b bg-background h-16">
      <div className="flex h-full items-center justify-end px-4 md:px-6">
        <div className="flex items-center gap-4">
          {userData && (
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-medium">{userData.nome || "Usuário"}</span>
              <span className="text-xs text-muted-foreground">{userData.email}</span>
            </div>
          )}
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </div>
    </header>
  );
} 