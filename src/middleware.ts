// middleware.ts desativado temporariamente 
// para evitar conflitos com a autenticação do lado do cliente

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Permitir todas as solicitações, sem verificação de autenticação
  // A autenticação é gerenciada pelo AuthProvider no cliente
  return NextResponse.next();
}

// Matcher opcional - você pode ajustar conforme necessário
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}; 