#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ativa venv
if [ -f ".venv312/bin/activate" ]; then
  source .venv312/bin/activate
fi

# exporta variáveis do .env local (se existir)
if [ -f ".env" ]; then
  set -a
  source .env
  set +a
fi

# cria pasta de logs
mkdir -p logs

# roda e salva log com data
python3 middleware.py >> "logs/middleware_$(date +%Y-%m-%d).log" 2>&1
