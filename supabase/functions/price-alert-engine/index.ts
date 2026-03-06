import { createClient } from "npm:@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "npm:jose@5";

type AlertRow = {
  id: string;
  usuario_id: string;
  asset_symbol: string;
  provider_asset_id: string | null;
  direction: "gte" | "lte";
  target_price: number;
  enabled: boolean;
  is_triggered: boolean;
  cooldown_minutes: number;
  triggered_count: number;
  next_eligible_at: string | null;
};

type DeviceTokenRow = {
  id: string;
  token: string;
  apns_environment: "sandbox" | "production";
};

type PriceMap = Record<string, number>;

const SYMBOL_TO_COINGECKO: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  XRP: "ripple",
  SOL: "solana",
  ADA: "cardano",
  DOGE: "dogecoin",
  BNB: "binancecoin",
  USDT: "tether",
  USDC: "usd-coin",
};

const PROVIDER_CACHE = new Map<string, { price: number; fetchedAt: number }>();
const PROVIDER_TTL_MS = 30_000;

function resolveProviderId(alert: AlertRow): string {
  if (alert.provider_asset_id && alert.provider_asset_id.trim().length > 0) {
    return alert.provider_asset_id.trim().toLowerCase();
  }
  const symbol = alert.asset_symbol.trim().toUpperCase();
  return SYMBOL_TO_COINGECKO[symbol] ?? symbol.toLowerCase();
}

async function fetchPrices(providerIds: string[]): Promise<PriceMap> {
  if (providerIds.length === 0) return {};

  const now = Date.now();
  const fresh: PriceMap = {};
  const staleIds: string[] = [];
  for (const id of providerIds) {
    const cached = PROVIDER_CACHE.get(id);
    if (cached && now - cached.fetchedAt <= PROVIDER_TTL_MS) {
      fresh[id] = cached.price;
    } else {
      staleIds.push(id);
    }
  }

  if (staleIds.length > 0) {
    const ids = encodeURIComponent(staleIds.join(","));
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      throw new Error(`provider_error_http_${res.status}`);
    }
    const body = (await res.json()) as Record<string, { usd?: number }>;
    for (const id of staleIds) {
      const price = body[id]?.usd;
      if (typeof price === "number" && Number.isFinite(price)) {
        fresh[id] = price;
        PROVIDER_CACHE.set(id, { price, fetchedAt: now });
      }
    }
  }

  return fresh;
}

async function apnsJwt(): Promise<string> {
  const teamId = Deno.env.get("APNS_TEAM_ID") ?? "";
  const keyId = Deno.env.get("APNS_KEY_ID") ?? "";
  const privateKey = Deno.env.get("APNS_PRIVATE_KEY") ?? "";
  if (!teamId || !keyId || !privateKey) {
    throw new Error("apns_secrets_missing");
  }
  const normalizedKey = privateKey.includes("BEGIN PRIVATE KEY")
    ? privateKey
    : privateKey.replace(/\\n/g, "\n");
  const pk = await importPKCS8(normalizedKey, "ES256");
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuedAt(now)
    .setIssuer(teamId)
    .sign(pk);
}

async function sendApnsPush(
  token: string,
  environment: "sandbox" | "production",
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; reason?: string }> {
  const topic = Deno.env.get("APNS_BUNDLE_ID") ?? "";
  if (!topic) {
    throw new Error("apns_bundle_missing");
  }
  const host = environment === "sandbox"
    ? "https://api.sandbox.push.apple.com"
    : "https://api.push.apple.com";

  const jwt = await apnsJwt();
  const url = `${host}/3/device/${token}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": topic,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (res.ok) {
    return { ok: true, status: res.status };
  }
  let reason: string | undefined;
  try {
    const body = await res.json();
    reason = body?.reason;
  } catch {
    reason = undefined;
  }
  return { ok: false, status: res.status, reason };
}

function isEligible(alert: AlertRow): boolean {
  if (!alert.enabled) return false;
  if (!alert.is_triggered) return true;
  if (!alert.next_eligible_at) return false;
  return Date.parse(alert.next_eligible_at) <= Date.now();
}

function isTriggered(alert: AlertRow, currentPrice: number): boolean {
  if (alert.direction === "gte") {
    return currentPrice >= alert.target_price;
  }
  return currentPrice <= alert.target_price;
}

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  if (cronSecret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "missing_supabase_env" }), { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: alerts, error: alertsError } = await supabase
    .from("price_alerts")
    .select("id,usuario_id,asset_symbol,provider_asset_id,direction,target_price,enabled,is_triggered,cooldown_minutes,triggered_count,next_eligible_at")
    .eq("enabled", true)
    .limit(5000);

  if (alertsError) {
    return new Response(JSON.stringify({ error: alertsError.message }), { status: 500 });
  }

  const candidates = (alerts ?? []).filter(isEligible);
  if (candidates.length === 0) {
    return new Response(JSON.stringify({ ok: true, scanned: 0, triggered: 0 }));
  }

  const providerIds = [...new Set(candidates.map(resolveProviderId))];
  let prices: PriceMap;
  try {
    prices = await fetchPrices(providerIds);
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "provider_fetch_failed", details: (error as Error).message }),
      { status: 502 },
    );
  }

  const triggered: Array<{ alert: AlertRow; price: number }> = [];
  for (const alert of candidates) {
    const providerId = resolveProviderId(alert);
    const price = prices[providerId];
    if (typeof price !== "number") continue;
    if (isTriggered(alert, price)) {
      triggered.push({ alert, price });
    } else {
      await supabase
        .from("price_alerts")
        .update({ last_price: price, updated_at: new Date().toISOString() })
        .eq("id", alert.id);
    }
  }

  if (triggered.length === 0) {
    return new Response(JSON.stringify({ ok: true, scanned: candidates.length, triggered: 0 }));
  }

  const userIds = [...new Set(triggered.map((t) => t.alert.usuario_id))];
  const { data: allTokens, error: tokensError } = await supabase
    .from("device_tokens")
    .select("id,usuario_id,token,apns_environment")
    .in("usuario_id", userIds)
    .eq("platform", "ios")
    .eq("ativo", true);

  if (tokensError) {
    return new Response(JSON.stringify({ error: tokensError.message }), { status: 500 });
  }

  const tokensByUser = new Map<string, DeviceTokenRow[]>();
  for (const row of (allTokens ?? []) as Array<DeviceTokenRow & { usuario_id: string }>) {
    const arr = tokensByUser.get(row.usuario_id) ?? [];
    arr.push({ id: row.id, token: row.token, apns_environment: row.apns_environment });
    tokensByUser.set(row.usuario_id, arr);
  }

  let pushesSent = 0;
  for (const item of triggered) {
    const { alert, price } = item;
    const now = new Date();
    const nextEligibleAt = alert.cooldown_minutes > 0
      ? new Date(now.getTime() + alert.cooldown_minutes * 60_000).toISOString()
      : null;

    await supabase
      .from("price_alerts")
      .update({
        is_triggered: true,
        last_price: price,
        last_triggered_at: now.toISOString(),
        next_eligible_at: nextEligibleAt,
        triggered_count: (alert.triggered_count ?? 0) + 1,
        updated_at: now.toISOString(),
      })
      .eq("id", alert.id);

    const tokens = tokensByUser.get(alert.usuario_id) ?? [];
    if (tokens.length === 0) continue;

    const title = `Alerta ${alert.asset_symbol.toUpperCase()}`;
    const body = `${alert.direction === "gte" ? "Subiu para" : "Caiu para"} $${price.toFixed(2)} (alvo $${alert.target_price.toFixed(2)})`;

    for (const tokenRow of tokens) {
      const pushPayload = {
        aps: {
          alert: { title, body },
          sound: "default",
        },
        alertId: alert.id,
        assetSymbol: alert.asset_symbol.toUpperCase(),
        deeplink: `cryptoraiskas://alerts?alertId=${alert.id}&assetSymbol=${alert.asset_symbol.toUpperCase()}`,
      };

      try {
        const result = await sendApnsPush(tokenRow.token, tokenRow.apns_environment, pushPayload);
        if (result.ok) {
          pushesSent += 1;
        } else if ([400, 410].includes(result.status)) {
          await supabase
            .from("device_tokens")
            .update({ ativo: false, updated_at: new Date().toISOString() })
            .eq("id", tokenRow.id);
        }
      } catch {
        // mantém execução do ciclo
      }
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      scanned: candidates.length,
      triggered: triggered.length,
      pushes_sent: pushesSent,
      symbols: [...new Set(triggered.map((t) => t.alert.asset_symbol.toUpperCase()))],
    }),
    { headers: { "content-type": "application/json" } },
  );
});
