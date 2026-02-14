"use client";

import Link from "next/link";
import { LogOut, ChevronDown, Menu } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger, 
  SheetClose
} from "@/components/ui/sheet";
import { useAuth } from "@/lib/hooks/use-auth";
import { useUserData } from "@/lib/hooks/use-user-data";
import { toast } from "sonner";
import { useState } from "react";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";

const navItems = [
  { href: "/home", label: "Home" },
  { href: "/crypto", label: "Crypto" },
  { href: "/crypto-middleware", label: "Crypto Middleware" },
];

const adminNavItems = [
  { href: "/admin", label: "Visão Geral" },
  { href: "/admin/usuarios", label: "Usuários" },
  { href: "/admin/empresas", label: "Empresas" },
];

export function DashboardHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { userData, loading } = useUserData();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    console.log("[Header] handleLogout iniciado.");
    try {
      console.log("[Header] Chamando POST /api/auth/logout...");
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("[Header] Erro ao chamar API de logout:", response.status, errorData);
        toast.error(errorData.error || "Erro no servidor ao fazer logout.");
        return;
      }

      console.log("[Header] API de logout retornou sucesso. Limpando estado local e redirecionando...");
      
      toast.success("Logout realizado com sucesso");
      window.location.href = "/signin";

    } catch (error) {
      console.error("[Header] Exceção em handleLogout:", error);
      toast.error("Erro inesperado ao tentar fazer logout.");
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 h-16">
      <div className="container flex h-full items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-4 md:gap-6">
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Abrir menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-full sm:w-[300px]">
              <nav className="flex flex-col gap-2 pt-6">
                {navItems.map((item) => (
                  <SheetClose asChild key={`${item.href}-mobile`}>
                    <Link
                      href={item.href}
                      className={`flex w-full items-center py-2 px-3 rounded-md text-base font-medium transition-colors ${ 
                        pathname === item.href 
                          ? 'bg-accent text-accent-foreground' 
                          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                      }`}
                    >
                      {item.label}
                    </Link>
                  </SheetClose>
                ))}
                
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="admin-links" className="border-b-0">
                    <AccordionTrigger className="py-2 px-3 text-base font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground hover:no-underline rounded-md">
                      Painel Administrativo
                    </AccordionTrigger>
                    <AccordionContent className="pl-6 pb-0 pt-1 flex flex-col gap-1">
                      {adminNavItems.map((item) => (
                        <SheetClose asChild key={`${item.href}-mobile`}>
                          <Link
                            href={item.href}
                            className={`flex w-full items-center py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${ 
                              pathname === item.href 
                                ? 'bg-accent/80 text-accent-foreground'
                                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                            }`}
                          >
                            {item.label}
                          </Link>
                        </SheetClose>
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </nav>
            </SheetContent>
          </Sheet>

          <Link href="/" className="flex items-center space-x-2">
            <img 
              src="/logo-no-background.png" 
              alt="Crypto Raiskas Logo"
              className="h-8"
            />
          </Link>

          <nav className="hidden md:flex items-center gap-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition-colors hover:text-primary ${ 
                  pathname === item.href 
                    ? 'text-primary' 
                    : 'text-muted-foreground'
                }`}
              >
                {item.label}
              </Link>
            ))}

            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                Painel Administrativo
                <ChevronDown className="relative top-[1px] ml-1 h-3 w-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {adminNavItems.map((item) => (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link href={item.href}>{item.label}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          {userData && (
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-medium">{userData.nome || "Usuário"}</span>
              <span className="text-xs text-muted-foreground">{userData.email}</span>
            </div>
          )}
          <ThemeToggle />
          <Button variant="outline" size="icon" onClick={handleLogout} className="md:hidden">
            <LogOut className="h-5 w-5" />
            <span className="sr-only">Sair</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleLogout} className="hidden md:inline-flex">
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </div>
    </header>
  );
} 
