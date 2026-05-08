"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, Edit, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase/client";
import { useUserData } from "@/lib/hooks/use-user-data";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type RepeatMode = "once" | "always";

type AlertRow = {
  id: string;
  asset_symbol: string;
  provider_asset_id: string | null;
  direction: string;
  repeat_mode: RepeatMode;
  target_price: number;
  enabled: boolean;
  is_triggered: boolean;
  last_price: number | null;
  last_triggered_at: string | null;
  updated_at: string;
};

type CoinOption = {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  current_price?: number | null;
};

type AlertFormState = {
  assetSymbol: string;
  providerAssetId: string;
  targetPrice: string;
  repeatMode: RepeatMode;
};

const EMPTY_FORM: AlertFormState = {
  assetSymbol: "",
  providerAssetId: "",
  targetPrice: "",
  repeatMode: "always",
};

export default function AdminAlertasPage() {
  const supabase = useMemo(() => getSupabase(), []);
  const { userData, loading: loadingUser } = useUserData();

  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAlertId, setEditingAlertId] = useState<string | null>(null);
  const [form, setForm] = useState<AlertFormState>(EMPTY_FORM);

  const [coinQuery, setCoinQuery] = useState("");
  const [coinOptions, setCoinOptions] = useState<CoinOption[]>([]);
  const [loadingCoins, setLoadingCoins] = useState(false);

  async function loadAlerts() {
    if (!userData?.id) return;

    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("price_alerts")
      .select("id,asset_symbol,provider_asset_id,direction,repeat_mode,target_price,enabled,is_triggered,last_price,last_triggered_at,updated_at")
      .eq("usuario_id", userData.id)
      .order("updated_at", { ascending: false });

    if (error) {
      setError(error.message);
      setAlerts([]);
      setLoading(false);
      return;
    }

    setAlerts((data ?? []) as AlertRow[]);
    setLoading(false);
  }

  useEffect(() => {
    if (!loadingUser && userData?.id) {
      loadAlerts();
    }
  }, [loadingUser, userData?.id]);

  useEffect(() => {
    if (!dialogOpen) return;

    const trimmed = coinQuery.trim();
    if (trimmed.length < 2) {
      setCoinOptions([]);
      setLoadingCoins(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoadingCoins(true);
      try {
        const response = await fetch(`/api/crypto/listar-moedas?query=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || "Falha ao buscar moedas");
        }
        setCoinOptions(payload ?? []);
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setCoinOptions([]);
        }
      } finally {
        setLoadingCoins(false);
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [coinQuery, dialogOpen]);

  function openCreateDialog() {
    setEditingAlertId(null);
    setForm(EMPTY_FORM);
    setCoinQuery("");
    setCoinOptions([]);
    setDialogOpen(true);
  }

  function openEditDialog(alert: AlertRow) {
    setEditingAlertId(alert.id);
    setForm({
      assetSymbol: alert.asset_symbol,
      providerAssetId: alert.provider_asset_id ?? "",
      targetPrice: String(alert.target_price),
      repeatMode: (alert.repeat_mode ?? "always") as RepeatMode,
    });
    setCoinQuery(alert.provider_asset_id ? `${alert.asset_symbol} (${alert.provider_asset_id})` : alert.asset_symbol);
    setCoinOptions([]);
    setDialogOpen(true);
  }

  async function saveAlert() {
    if (!userData?.id) return;

    const assetSymbol = form.assetSymbol.trim().toUpperCase();
    const providerAssetId = form.providerAssetId.trim() || null;
    const targetPrice = Number(form.targetPrice);

    if (!assetSymbol || !Number.isFinite(targetPrice) || targetPrice <= 0) {
      toast.error("Preencha moeda e valor corretamente.");
      return;
    }

    setSaving(true);

    const payload = {
      usuario_id: userData.id,
      asset_symbol: assetSymbol,
      provider_asset_id: providerAssetId,
      direction: "cross",
      repeat_mode: form.repeatMode,
      target_price: targetPrice,
      enabled: true,
      cooldown_minutes: 0,
      is_triggered: false,
      next_eligible_at: null,
      updated_at: new Date().toISOString(),
    };

    const query = editingAlertId
      ? supabase.from("price_alerts").update(payload).eq("id", editingAlertId).eq("usuario_id", userData.id)
      : supabase.from("price_alerts").insert(payload);

    const { error } = await query;

    setSaving(false);

    if (error) {
      toast.error(`Falha ao salvar alerta: ${error.message}`);
      return;
    }

    toast.success(editingAlertId ? "Alerta atualizado." : "Alerta criado.");
    setDialogOpen(false);
    setForm(EMPTY_FORM);
    setCoinQuery("");
    await loadAlerts();
  }

  async function toggleAlert(alert: AlertRow, enabled: boolean) {
    const { error } = await supabase
      .from("price_alerts")
      .update({
        enabled,
        is_triggered: false,
        next_eligible_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", alert.id);

    if (error) {
      toast.error(`Falha ao atualizar alerta: ${error.message}`);
      return;
    }

    setAlerts((current) =>
      current.map((item) =>
        item.id === alert.id ? { ...item, enabled, is_triggered: false, updated_at: new Date().toISOString() } : item,
      ),
    );
  }

  async function deleteAlert(alertId: string) {
    const confirmed = window.confirm("Deseja excluir este alerta?");
    if (!confirmed) return;

    const { error } = await supabase.from("price_alerts").delete().eq("id", alertId);

    if (error) {
      toast.error(`Falha ao excluir alerta: ${error.message}`);
      return;
    }

    setAlerts((current) => current.filter((item) => item.id !== alertId));
    toast.success("Alerta excluído.");
  }

  function selectCoin(option: CoinOption) {
    setForm((current) => ({
      ...current,
      assetSymbol: option.symbol.toUpperCase(),
      providerAssetId: option.id,
    }));
    setCoinQuery(`${option.name} (${option.symbol.toUpperCase()})`);
    setCoinOptions([]);
  }

  return (
    <div className="w-full px-4 py-10 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Alertas de Preço</h1>
          <p className="text-sm text-muted-foreground">
            Receba alerta quando o preço cruzar o valor definido, em qualquer direção.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Alerta
        </Button>
      </div>

      {error && (
        <Card className="border-red-200">
          <CardContent className="py-4 text-sm text-red-600">{error}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Meus Alertas</CardTitle>
          <CardDescription>Modo de repetição: uma vez ou sempre.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando alertas...
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhum alerta cadastrado.</div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div key={alert.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <BellRing className="h-4 w-4 text-blue-600" />
                        <span className="font-semibold">{alert.asset_symbol.toUpperCase()}</span>
                        <Badge variant={alert.enabled ? "default" : "secondary"}>
                          {alert.enabled ? "Ativo" : "Desativado"}
                        </Badge>
                        <Badge variant="outline">
                          {alert.repeat_mode === "always" ? "Sempre" : "Uma vez"}
                        </Badge>
                        {alert.is_triggered && <Badge className="bg-orange-500 hover:bg-orange-500">Disparado</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Cruzar {formatCurrency(alert.target_price)} USD
                      </p>
                      {alert.last_price !== null && (
                        <p className="text-xs text-muted-foreground">
                          Último preço: {formatCurrency(alert.last_price)} USD
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Atualizado em {formatDate(alert.updated_at)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={alert.enabled}
                          onCheckedChange={(checked) => toggleAlert(alert, checked)}
                        />
                        <Label>{alert.enabled ? "Ligado" : "Desligado"}</Label>
                      </div>
                      <Button variant="outline" size="icon" onClick={() => openEditDialog(alert)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => deleteAlert(alert.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingAlertId ? "Editar Alerta" : "Criar Alerta"}</DialogTitle>
            <DialogDescription>
              Escolha a moeda, defina o valor e se o alerta deve disparar uma vez ou sempre.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="coin-search">Criptomoeda</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="coin-search"
                  value={coinQuery}
                  onChange={(event) => setCoinQuery(event.target.value)}
                  className="pl-9"
                  placeholder="Buscar por nome ou símbolo"
                />
              </div>
              {loadingCoins && <p className="text-xs text-muted-foreground">Buscando moedas...</p>}
              {coinOptions.length > 0 && (
                <div className="max-h-56 overflow-y-auto rounded-md border">
                  {coinOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className="w-full border-b last:border-b-0 px-3 py-2 text-left hover:bg-muted"
                      onClick={() => selectCoin(option)}
                    >
                      <div className="font-medium">{option.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {option.symbol.toUpperCase()}
                        {typeof option.current_price === "number" ? ` • ${formatCurrency(option.current_price)} USD` : ""}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {form.assetSymbol && (
                <p className="text-xs text-muted-foreground">
                  Selecionada: {form.assetSymbol.toUpperCase()}
                  {form.providerAssetId ? ` (${form.providerAssetId})` : ""}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="target-price">Valor do alerta (USD)</Label>
              <Input
                id="target-price"
                inputMode="decimal"
                value={form.targetPrice}
                onChange={(event) => setForm((current) => ({ ...current, targetPrice: event.target.value }))}
                placeholder="Ex.: 77320"
              />
              <p className="text-xs text-muted-foreground">
                O alerta dispara quando o preço cruzar esse valor, vindo de cima ou de baixo.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Repetição</Label>
              <Select
                value={form.repeatMode}
                onValueChange={(value: RepeatMode) => setForm((current) => ({ ...current, repeatMode: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a repetição" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="always">Sempre</SelectItem>
                  <SelectItem value="once">Uma vez</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveAlert} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
