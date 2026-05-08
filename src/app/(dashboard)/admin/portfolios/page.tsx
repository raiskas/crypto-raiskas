"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, Loader2, Pencil, PlusCircle, RefreshCw, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Portfolio = {
  id: string;
  nome: string;
  valor_inicial: number;
  ativo: boolean;
  criado_em?: string | null;
  atualizado_em?: string | null;
};

type PortfolioFormState = {
  nome: string;
  valorInicial: string;
};

const EMPTY_FORM: PortfolioFormState = {
  nome: "",
  valorInicial: "0",
};

export default function AdminPortfoliosPage() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPortfolioId, setEditingPortfolioId] = useState<string | null>(null);
  const [form, setForm] = useState<PortfolioFormState>(EMPTY_FORM);

  const portfolioAtivoCount = useMemo(
    () => portfolios.filter((item) => item.ativo).length,
    [portfolios]
  );

  async function loadPortfolios() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/crypto/carteira?include_inactive=true", {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "Falha ao carregar portfolios.");
      }

      setPortfolios(Array.isArray(payload?.carteiras) ? payload.carteiras : []);
    } catch (err: any) {
      setError(err?.message || "Falha ao carregar portfolios.");
      setPortfolios([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPortfolios();
  }, []);

  function openCreateDialog() {
    setEditingPortfolioId(null);
    setForm({ nome: "", valorInicial: "0" });
    setDialogOpen(true);
  }

  function openEditDialog(portfolio: Portfolio) {
    setEditingPortfolioId(portfolio.id);
    setForm({
      nome: portfolio.nome,
      valorInicial: String(portfolio.valor_inicial ?? 0),
    });
    setDialogOpen(true);
  }

  async function savePortfolio() {
    const nome = form.nome.trim();
    const valorInicial = Number(form.valorInicial.replace(",", "."));

    if (!nome) {
      toast.error("Informe o nome do portfolio.");
      return;
    }

    if (!Number.isFinite(valorInicial) || valorInicial < 0) {
      toast.error("Informe um valor inicial válido.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/crypto/carteira", {
        method: editingPortfolioId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingPortfolioId,
          nome,
          valor_inicial: valorInicial,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "Falha ao salvar portfolio.");
      }

      toast.success(editingPortfolioId ? "Portfolio atualizado." : "Portfolio criado.");
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      await loadPortfolios();
    } catch (err: any) {
      toast.error(err?.message || "Falha ao salvar portfolio.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePortfolio(portfolio: Portfolio) {
    setSaving(true);

    try {
      const response = await fetch("/api/crypto/carteira", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: portfolio.id,
          ativo: !portfolio.ativo,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "Falha ao atualizar status do portfolio.");
      }

      toast.success(portfolio.ativo ? "Portfolio arquivado." : "Portfolio reativado.");
      await loadPortfolios();
    } catch (err: any) {
      toast.error(err?.message || "Falha ao atualizar status do portfolio.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="w-full px-4 py-10 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Portfolios</h1>
          <p className="text-sm text-muted-foreground">
            Crie, renomeie e organize seus portfolios. A página de carteira e a nova operação usam o portfolio selecionado.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => void loadPortfolios()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button onClick={openCreateDialog}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Novo Portfolio
          </Button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total de portfolios</CardDescription>
            <CardTitle className="text-2xl">{portfolios.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ativos</CardDescription>
            <CardTitle className="text-2xl">{portfolioAtivoCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Arquivados</CardDescription>
            <CardTitle className="text-2xl">{Math.max(portfolios.length - portfolioAtivoCount, 0)}</CardTitle>
          </CardHeader>
        </Card>
      </section>

      {error && (
        <Card className="border-red-500/30">
          <CardHeader>
            <CardTitle className="text-red-600">Erro ao carregar</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Lista de Portfolios</CardTitle>
          <CardDescription>
            Cada portfolio mantém operações, aportes, snapshots e performance separados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando portfolios...
            </div>
          ) : portfolios.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              Nenhum portfolio cadastrado ainda.
            </div>
          ) : (
            portfolios.map((portfolio) => (
              <div
                key={portfolio.id}
                className="flex flex-col gap-4 rounded-xl border p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{portfolio.nome}</span>
                    <Badge variant={portfolio.ativo ? "default" : "secondary"}>
                      {portfolio.ativo ? "Ativo" : "Arquivado"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Valor inicial: {portfolio.valor_inicial.toLocaleString("pt-BR", { style: "currency", currency: "USD" })}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" onClick={() => openEditDialog(portfolio)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void togglePortfolio(portfolio)}
                    disabled={saving}
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    {portfolio.ativo ? "Arquivar" : "Reativar"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPortfolioId ? "Editar Portfolio" : "Novo Portfolio"}</DialogTitle>
            <DialogDescription>
              Defina o nome e o capital inicial do portfolio.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome</label>
              <Input
                value={form.nome}
                onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))}
                placeholder="Ex: Swing Trade, Longo Prazo, DeFi"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Valor inicial</label>
              <Input
                value={form.valorInicial}
                onChange={(event) =>
                  setForm((current) => ({ ...current, valorInicial: event.target.value }))
                }
                placeholder="0"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void savePortfolio()} disabled={saving}>
              {saving ? "Salvando..." : editingPortfolioId ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
