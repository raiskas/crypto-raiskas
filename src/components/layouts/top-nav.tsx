"use client";

import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { APP_CONTRACT } from "@/lib/cross-platform-contract";

const navItems = APP_CONTRACT.mainNav;
const adminNavItems = APP_CONTRACT.adminNav;

export function TopNav() {
  return (
    <nav className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <span className="font-bold">{APP_CONTRACT.appName}</span>
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

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
              {APP_CONTRACT.adminMenuTitle}
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
        </div>
        {/* Adicionar menu do usuário aqui se necessário no futuro */}
      </div>
    </nav>
  );
} 
