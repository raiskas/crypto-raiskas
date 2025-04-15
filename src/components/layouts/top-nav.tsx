"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Home, 
  Settings, 
  Users, 
  ShoppingCart, 
  BarChart, 
  Shield, 
  Database, 
  ChevronDown, 
  Menu as MenuIcon, 
  X, 
  User,
  Laptop,
  FileText,
  LogOut,
  Bitcoin
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/lib/hooks/use-auth";
import { useUserData } from "@/lib/hooks/use-user-data";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MenuItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  submenu?: MenuItem[];
}

export function TopNav() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { signOut, user } = useAuth();
  const { userData } = useUserData();
  const router = useRouter();

  // Fecha o menu móvel quando muda de página
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await signOut();
    router.push("/signin");
  };

  const menuItems: MenuItem[] = [
    {
      title: "Início",
      href: "/home",
      icon: <Home className="h-4 w-4" />,
    },
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: <Laptop className="h-4 w-4" />,
    },
    {
      title: "Criptomoedas",
      href: "/crypto",
      icon: <Bitcoin className="h-4 w-4" />,
    },
    {
      title: "Administrativo",
      href: "/admin",
      icon: <Settings className="h-4 w-4" />,
      submenu: [
        {
          title: "Usuários",
          href: "/admin/usuarios",
          icon: <Users className="h-4 w-4" />,
        }
      ],
    },
    {
      title: "Perfil",
      href: "/perfil",
      icon: <User className="h-4 w-4" />,
    }
  ];

  // Verifica se um item ou subitem está ativo
  const isActive = (item: MenuItem): boolean => {
    if (pathname === item.href) return true;
    
    if (item.submenu) {
      return item.submenu.some(subitem => 
        pathname === subitem.href || pathname.startsWith(subitem.href + '/')
      );
    }
    
    return pathname.startsWith(item.href + '/');
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-gradient-to-r from-background via-background to-background shadow-sm">
      <div className="container flex h-16 items-center">
        {/* Logo */}
        <Link href="/home" className="flex items-center mr-6">
          <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 text-transparent bg-clip-text">Crypto Raiskas</span>
        </Link>

        {/* Menu de hamburger para mobile */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-expanded={isMobileMenuOpen}
          aria-controls="mobile-menu"
          aria-label={isMobileMenuOpen ? "Fechar menu" : "Abrir menu"}
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X size={20} /> : <MenuIcon size={20} />}
        </Button>

        {/* Menu principal - desktop */}
        <nav className="hidden md:flex items-center space-x-1 flex-1" aria-label="Menu principal">
          {menuItems.map((item) => 
            item.submenu ? (
              <DropdownMenu key={item.href}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className={cn(
                      "h-10 px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground relative",
                      isActive(item) ? "text-primary" : "text-foreground",
                      isActive(item) && "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[3px] after:bg-primary"
                    )}
                  >
                    <div className="flex items-center">
                      {item.icon}
                      <span className="ml-2">{item.title}</span>
                      <ChevronDown className="ml-1 h-4 w-4" />
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  {item.submenu.map((subItem) => (
                    <DropdownMenuItem key={subItem.href} asChild>
                      <Link 
                        href={subItem.href}
                        className={cn(
                          "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                          pathname === subItem.href && "bg-accent text-accent-foreground"
                        )}
                      >
                        {subItem.icon}
                        <span className="ml-2">{subItem.title}</span>
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-10 items-center px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-accent hover:text-accent-foreground relative",
                  isActive(item) ? "text-primary" : "text-foreground", 
                  isActive(item) && "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[3px] after:bg-primary"
                )}
              >
                {item.icon}
                <span className="ml-2">{item.title}</span>
              </Link>
            )
          )}
        </nav>

        {/* Seção direita - usuário, tema, etc. */}
        <div className="ml-auto flex items-center space-x-2">
          {userData && (
            <div className="hidden md:flex flex-col items-end mr-2">
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

      {/* Menu móvel */}
      <div 
        id="mobile-menu"
        role="navigation"
        aria-label="Menu de navegação mobile"
        className={cn(
          "md:hidden border-t overflow-hidden transition-all duration-300 ease-in-out", 
          isMobileMenuOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="container py-2">
          <nav className="flex flex-col space-y-1">
            {menuItems.map((item) => 
              item.submenu ? (
                <div key={item.href} className="py-1">
                  <div className="flex items-center px-3 py-2 text-sm font-medium">
                    {item.icon}
                    <span className="ml-2">{item.title}</span>
                  </div>
                  <div className="ml-4 pl-2 border-l space-y-1">
                    {item.submenu.map((subItem) => (
                      <Link
                        key={subItem.href}
                        href={subItem.href}
                        className={cn(
                          "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-accent hover:text-accent-foreground",
                          pathname === subItem.href && "bg-accent text-accent-foreground"
                        )}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {subItem.icon}
                        <span className="ml-2">{subItem.title}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-accent hover:text-accent-foreground",
                    isActive(item) && "bg-accent text-accent-foreground"
                  )}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.icon}
                  <span className="ml-2">{item.title}</span>
                </Link>
              )
            )}
          </nav>
        </div>
      </div>
    </header>
  );
} 