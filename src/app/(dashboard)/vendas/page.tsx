import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Dados simulados (apenas para demonstração)
const mockVendas = [
  {
    id: "1",
    numero: "V0001",
    cliente: "Cliente Teste",
    valorTotal: 1500.00,
    dataVenda: "2023-10-15",
    status: "concluída",
  },
  {
    id: "2",
    numero: "V0002",
    cliente: "Empresa ABC",
    valorTotal: 3200.50,
    dataVenda: "2023-10-16",
    status: "pendente",
  },
];

export default function VendasPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Vendas</h1>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Nova Venda
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Valor Total</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockVendas.map((venda) => (
              <TableRow key={venda.id}>
                <TableCell>{venda.numero}</TableCell>
                <TableCell>{venda.cliente}</TableCell>
                <TableCell>
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(venda.valorTotal)}
                </TableCell>
                <TableCell>
                  {new Date(venda.dataVenda).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      venda.status === "concluída"
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                        : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
                    }`}
                  >
                    {venda.status}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm">
                    Detalhes
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
} 