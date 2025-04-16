"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
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
  ChevronRight, 
  Menu as MenuIcon, 
  X, 
  User,
  Laptop,
  FileText,
  Bitcoin
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MenuItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  submenu?: MenuItem[];
}

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<string[]>([]);

  const menuItems: MenuItem[] = [
    {
      title: "Início",
      href: "/home",
      icon: <Home className="h-5 w-5" />,
    },
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: <Laptop className="h-5 w-5" />,
    },
    {
      title: "Criptomoedas",
      href: "/crypto",
      icon: <Bitcoin className="h-5 w-5" />,
    },
    {
      title: "Administrativo",
      href: "/admin",
      icon: <Settings className="h-5 w-5" />,
      submenu: [
        {
          title: "Usuários",
          href: "/admin/usuarios",
          icon: <Users className="h-5 w-5" />,
        }
      ],
    },
    {
      title: "Perfil",
      href: "/perfil",
      icon: <User className="h-5 w-5" />,
    }
  ];

  // Fecha o menu móvel quando muda de página
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

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

  // Toggle para grupos de menu
  const toggleGroup = (title: string) => {
    setOpenGroups(prev => 
      prev.includes(title) 
        ? prev.filter(group => group !== title) 
        : [...prev, title]
    );
  };

  // Renderiza um item de menu
  const renderMenuItem = (item: MenuItem) => {
    const active = isActive(item);
    const hasSubmenu = item.submenu && item.submenu.length > 0;
    const isGroupOpen = openGroups.includes(item.title);
    
    return (
      <div key={item.href} className="mb-1">
        {hasSubmenu ? (
          <>
            <button
              onClick={() => toggleGroup(item.title)}
              className={cn(
                "flex items-center w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none",
                active ? "bg-accent text-accent-foreground" : "transparent"
              )}
            >
              <div className="flex flex-1 items-center">
                {item.icon}
                <span className="ml-3">{item.title}</span>
              </div>
              {isGroupOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            
            {isGroupOpen && (
              <div className="ml-4 mt-1 space-y-1 border-l pl-3">
                {item.submenu?.map(subItem => (
                  <Link
                    key={subItem.href}
                    href={subItem.href}
                    className={cn(
                      "flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none",
                      pathname === subItem.href ? "bg-accent text-accent-foreground" : "transparent"
                    )}
                  >
                    {subItem.icon}
                    <span className="ml-3">{subItem.title}</span>
                  </Link>
                ))}
              </div>
            )}
          </>
        ) : (
          <Link
            href={item.href}
            className={cn(
              "flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none",
              active ? "bg-accent text-accent-foreground" : "transparent"
            )}
          >
            {item.icon}
            <span className="ml-3">{item.title}</span>
          </Link>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Botão do menu móvel */}
      <div className="fixed bottom-4 right-4 z-50 md:hidden">
        <Button
          variant="default"
          size="icon"
          className="h-12 w-12 rounded-full shadow-lg"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
        >
          {isMobileOpen ? <X /> : <MenuIcon />}
        </Button>
      </div>

      {/* Sidebar desktop e móvel */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-background transition-transform duration-300 ease-in-out",
          isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          className
        )}
      >
        <div className="flex h-14 items-center border-b px-4">
          <Link href="/home" className="flex items-center space-x-2">
            <span className="text-xl font-bold">Crypto Raiskas</span>
          </Link>
        </div>
        
        <ScrollArea className="flex-1">
          <nav className="px-2 py-4">
            {menuItems.map(renderMenuItem)}
          </nav>
        </ScrollArea>
      </aside>
    </>
  );
} 