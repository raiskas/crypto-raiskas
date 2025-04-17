"use client";

import Link from "next/link";

const navItems = [
  { href: "/home", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/crypto", label: "Crypto" },
  { href: "/vendas", label: "Vendas" },
  { href: "/perfil", label: "Perfil" },
  { href: "/admin", label: "Admin" },
];

export function TopNav() {
  return (
    <nav className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <span className="font-bold">Crypto Raiskas</span>
        </Link>
        <div className="flex flex-1 items-center space-x-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              {item.label}
            </Link>
          ))}
        </div>
        {/* Adicionar menu do usuário aqui se necessário no futuro */}
      </div>
    </nav>
  );
} 