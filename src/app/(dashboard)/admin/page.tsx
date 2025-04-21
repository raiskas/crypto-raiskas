"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Settings, Users, ShieldCheck, Database, Building } from "lucide-react";

export default function AdminPage() {
  const router = useRouter();
  
  const menuItems = [
    {
      title: "Gerenciar Usuários",
      description: "Criar, editar, desativar e redefinir senhas de usuários",
      icon: <Users className="h-8 w-8" />,
      path: "/admin/usuarios",
      color: "bg-blue-100 text-blue-700",
    },
    {
      title: "Gerenciar Empresas",
      description: "Criar, editar e remover empresas",
      icon: <Building className="h-8 w-8" />,
      path: "/admin/empresas",
      color: "bg-indigo-100 text-indigo-700",
    },
  ];
  
  return (
    <div className="container py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Painel Administrativo</h1>
        <p className="text-muted-foreground">
          Gerencie configurações, usuários e permissões do sistema
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {menuItems.map((item, index) => (
          <Card 
            key={index}
            className="cursor-pointer transition-all hover:shadow-md"
            onClick={() => router.push(item.path)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${item.color}`}>
                  {item.icon}
                </div>
                <div>
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline"
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(item.path);
                }}
              >
                Acessar
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
} 