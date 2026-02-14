import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Configuração do rate limit
const RATE_LIMIT = {
  windowMs: 60 * 1000, // 1 minuto
  max: 100, // limite de requisições por IP
};

// Cache simples para armazenar contadores
const ipCounters: Record<string, { count: number; resetTime: number }> = {};

export function rateLimit(request: NextRequest) {
  const ip = request.ip || 'unknown';
  const now = Date.now();

  // Inicializar ou resetar contador se necessário
  if (!ipCounters[ip] || now > ipCounters[ip].resetTime) {
    ipCounters[ip] = {
      count: 0,
      resetTime: now + RATE_LIMIT.windowMs,
    };
  }

  // Incrementar contador
  ipCounters[ip].count++;

  // Verificar se excedeu o limite
  if (ipCounters[ip].count > RATE_LIMIT.max) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    );
  }

  return null;
} 