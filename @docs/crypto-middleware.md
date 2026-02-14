# Crypto Middleware (Modo Exato do Projeto Original)

## Objetivo

Este documento descreve o modo operacional para manter o **Crypto Middleware exatamente igual ao projeto original**, sem diferenças de UI ou comportamento.

## Arquitetura (sem diferenças)

O projeto original foi mantido em:

- `/Users/claudioraikasfh/Desktop/crypto-raiskas/tools/crypto-middleware`

A rota do app principal:

- `/Users/claudioraikasfh/Desktop/crypto-raiskas/src/app/(dashboard)/crypto-middleware/page.tsx`

apenas carrega o dashboard original (`http://127.0.0.1:8000`) via iframe, preservando 100% da interface e das APIs do projeto original.

## Como executar

No projeto principal:

```bash
pnpm crypto-middleware:dashboard
```

Isso executa:

```bash
python3 tools/crypto-middleware/web_dashboard.py
```

Depois, abra:

- `http://localhost:3000/crypto-middleware`

ou diretamente:

- `http://127.0.0.1:8000`

## Permissões

Permissões adicionadas:

- `crypto_middleware_visualizar`
- `crypto_middleware_executar`

Módulo de permissão:

- `crypto_middleware`

## Navegação e telas permitidas

- `screens.config.json` inclui:
  - `crypto-middleware`

- `DashboardHeader` inclui item no menu superior:
  - `Crypto Middleware`

## Observação

Este modo foi escolhido para garantir **paridade total** com o projeto original, sem variações de layout, payload, regras ou comportamento.

## Ajuste funcional (14/02/2026)

Foi aplicado um ajuste de decisão na UI do middleware para reduzir inconsistência operacional:

- quando existe trade `OPEN` no `recent-trades` para um ativo;
- e a ação calculada do plano está como `AGUARDAR`;
- o card `O Que Fazer Agora` exibe `MANTER POSIÇÃO` para esse ativo.

Arquivo alterado:

- `/Users/claudioraikasfh/Desktop/crypto-raiskas/tools/crypto-middleware/web/app.js`

Objetivo: evitar mensagem ambígua de “aguardar” quando já há posição aberta e o foco deve ser gestão da posição.
