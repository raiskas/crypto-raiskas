"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil, Trash2 } from "lucide-react";

type CarteiraData = {
  id: string;
  nome: string;
  valor_inicial: number;
};

type AporteData = {
  id: string;
  carteira_id: string;
  valor: number;
  data_aporte: string;
  descricao: string | null;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  carteira: CarteiraData | null;
  aportes: AporteData[];
  onSaved: () => Promise<void> | void;
};

function toDateInput(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function CarteiraAdminModal({
  isOpen,
  onClose,
  carteira,
  aportes,
  onSaved,
}: Props) {
  const [nome, setNome] = useState(carteira?.nome || "Carteira Principal");
  const [valorInicial, setValorInicial] = useState(String(carteira?.valor_inicial ?? 0));
  const [salvandoCarteira, setSalvandoCarteira] = useState(false);

  const [aporteIdEditando, setAporteIdEditando] = useState<string | null>(null);
  const [valorAporte, setValorAporte] = useState("");
  const [dataAporte, setDataAporte] = useState(new Date().toISOString().slice(0, 10));
  const [descricaoAporte, setDescricaoAporte] = useState("");
  const [salvandoAporte, setSalvandoAporte] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const aporteEditando = useMemo(
    () => aportes.find((a) => a.id === aporteIdEditando) || null,
    [aportes, aporteIdEditando]
  );

  const resetAporteForm = () => {
    setAporteIdEditando(null);
    setValorAporte("");
    setDataAporte(new Date().toISOString().slice(0, 10));
    setDescricaoAporte("");
  };

  const carregarParaEdicao = (aporte: AporteData) => {
    setAporteIdEditando(aporte.id);
    setValorAporte(String(aporte.valor));
    setDataAporte(toDateInput(aporte.data_aporte));
    setDescricaoAporte(aporte.descricao || "");
  };

  const salvarCarteira = async () => {
    const valor = Number(valorInicial.replace(",", "."));
    if (!Number.isFinite(valor) || valor < 0) {
      setErro("Valor inicial inválido.");
      return;
    }
    setErro(null);
    setSalvandoCarteira(true);
    try {
      const response = await fetch("/api/crypto/carteira", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim() || "Carteira Principal",
          valor_inicial: valor,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Falha ao salvar carteira.");
      await onSaved();
    } catch (e: any) {
      setErro(e?.message || "Erro ao salvar carteira.");
    } finally {
      setSalvandoCarteira(false);
    }
  };

  const salvarAporte = async () => {
    if (!carteira?.id) {
      setErro("Crie a carteira antes de lançar aportes.");
      return;
    }
    const valor = Number(valorAporte.replace(",", "."));
    if (!Number.isFinite(valor) || valor <= 0) {
      setErro("Valor do aporte inválido.");
      return;
    }
    if (!dataAporte) {
      setErro("Data do aporte é obrigatória.");
      return;
    }

    setErro(null);
    setSalvandoAporte(true);
    try {
      const body = {
        carteira_id: carteira.id,
        valor,
        data_aporte: `${dataAporte}T00:00:00Z`,
        descricao: descricaoAporte.trim() || null,
      };

      const response = await fetch("/api/crypto/carteira/aportes", {
        method: aporteIdEditando ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aporteIdEditando ? { ...body, id: aporteIdEditando } : body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Falha ao salvar aporte.");

      resetAporteForm();
      await onSaved();
    } catch (e: any) {
      setErro(e?.message || "Erro ao salvar aporte.");
    } finally {
      setSalvandoAporte(false);
    }
  };

  const excluirAporte = async (id: string) => {
    setErro(null);
    try {
      const response = await fetch(`/api/crypto/carteira/aportes?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Falha ao excluir aporte.");
      if (aporteIdEditando === id) resetAporteForm();
      await onSaved();
    } catch (e: any) {
      setErro(e?.message || "Erro ao excluir aporte.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Administrar Carteira</DialogTitle>
          <DialogDescription>
            Configure dados da carteira e gerencie aportes de capital.
          </DialogDescription>
        </DialogHeader>

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <Tabs defaultValue="dados" className="w-full">
          <TabsList>
            <TabsTrigger value="dados">Dados da Carteira</TabsTrigger>
            <TabsTrigger value="aportes">Aportes</TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="space-y-4 pt-3">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-1">
                <label className="text-sm font-medium">Nome da carteira</label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="grid gap-1">
                <label className="text-sm font-medium">Valor inicial</label>
                <Input
                  value={valorInicial}
                  onChange={(e) => setValorInicial(e.target.value)}
                  placeholder="Ex: 10000"
                />
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Alterar o valor inicial ajusta a base da carteira. Aportes devem ser lançados na aba
              de aportes.
            </div>
            <Button onClick={salvarCarteira} disabled={salvandoCarteira}>
              {salvandoCarteira ? "Salvando..." : carteira ? "Atualizar Carteira" : "Criar Carteira"}
            </Button>
          </TabsContent>

          <TabsContent value="aportes" className="space-y-4 pt-3">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="grid gap-1">
                <label className="text-sm font-medium">Valor</label>
                <Input
                  value={valorAporte}
                  onChange={(e) => setValorAporte(e.target.value)}
                  placeholder="Ex: 1500"
                />
              </div>
              <div className="grid gap-1">
                <label className="text-sm font-medium">Data</label>
                <Input type="date" value={dataAporte} onChange={(e) => setDataAporte(e.target.value)} />
              </div>
              <div className="grid gap-1 md:col-span-2">
                <label className="text-sm font-medium">Descrição</label>
                <Input
                  value={descricaoAporte}
                  onChange={(e) => setDescricaoAporte(e.target.value)}
                  placeholder="Aporte mensal"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={salvarAporte} disabled={salvandoAporte || !carteira?.id}>
                {salvandoAporte
                  ? "Salvando..."
                  : aporteEditando
                  ? "Atualizar Aporte"
                  : "Adicionar Aporte"}
              </Button>
              {aporteEditando && (
                <Button variant="outline" onClick={resetAporteForm}>
                  Cancelar Edição
                </Button>
              )}
            </div>

            <div className="max-h-[300px] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-[120px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aportes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Sem aportes.
                      </TableCell>
                    </TableRow>
                  )}
                  {aportes.map((aporte) => (
                    <TableRow key={aporte.id}>
                      <TableCell>
                        {new Date(aporte.data_aporte).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(Number(aporte.valor || 0))}
                      </TableCell>
                      <TableCell>{aporte.descricao || "-"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => carregarParaEdicao(aporte)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => excluirAporte(aporte.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

