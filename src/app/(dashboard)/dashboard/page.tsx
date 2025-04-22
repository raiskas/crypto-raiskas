import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="w-full px-4 py-8">
      <h1 className="text-2xl font-semibold mb-4">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Vendas</CardTitle>
            <CardDescription>Total de vendas recentes</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">0</p>
            <p className="text-sm text-muted-foreground">Nenhuma venda registrada</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Usuários</CardTitle>
            <CardDescription>Total de usuários ativos</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">1</p>
            <p className="text-sm text-muted-foreground">1 usuário ativo</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Empresas</CardTitle>
            <CardDescription>Total de empresas registradas</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">1</p>
            <p className="text-sm text-muted-foreground">1 empresa ativa</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 