"use client";

import { ThemeToggle } from "@/components/theme-toggle";

export function AuthHeader() {
  return (
    <header className="w-full bg-background">
      <div className="container flex h-16 items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">Crypto Raiskas</h1>
        </div>

        <div className="flex items-center">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
} 