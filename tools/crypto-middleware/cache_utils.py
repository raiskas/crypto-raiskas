"""
cache_utils.py — cache simples com TTL e anti-stale

Uso:
- Salva JSON com timestamp e payload.
- Lê do cache se ainda estiver dentro do TTL.
- Se estiver stale ou corrompido, ignora e refaz.

Sem dependências externas.
"""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class CacheResult:
    hit: bool
    stale: bool
    age_s: Optional[int]
    data: Optional[dict]
    reason: Optional[str] = None


def _now() -> int:
    return int(time.time())


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def cache_read_json(path: str, ttl_s: int) -> CacheResult:
    if not os.path.exists(path):
        return CacheResult(hit=False, stale=False, age_s=None, data=None, reason="cache_missing")

    try:
        with open(path, "r", encoding="utf-8") as f:
            obj = json.load(f)
        ts = int(obj.get("ts", 0))
        payload = obj.get("data", None)
        if not ts or payload is None:
            return CacheResult(hit=False, stale=False, age_s=None, data=None, reason="cache_invalid_schema")

        age = _now() - ts
        if age < 0:
            # relógio do sistema ajustado; trate como stale
            return CacheResult(hit=True, stale=True, age_s=age, data=payload, reason="cache_clock_skew")

        if age <= ttl_s:
            return CacheResult(hit=True, stale=False, age_s=age, data=payload, reason=None)

        return CacheResult(hit=True, stale=True, age_s=age, data=payload, reason="cache_stale")
    except Exception as e:
        return CacheResult(hit=False, stale=False, age_s=None, data=None, reason=f"cache_read_error:{type(e).__name__}")


def cache_write_json(path: str, data: dict) -> None:
    tmp = f"{path}.tmp"
    obj = {"ts": _now(), "data": data}
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)

