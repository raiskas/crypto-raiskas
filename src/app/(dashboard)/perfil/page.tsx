"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserData } from "@/lib/hooks/use-user-data";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";
import { updateUser } from "@/lib/api/users";

export default function PerfilPage() {
  const { userData, loading, refetch } = useUserData();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    nome: userData?.nome || "",
    email: userData?.email || "",
  });

  const handleEdit = () => {
    setIsEditing(true);
    setFormData({
      nome: userData?.nome || "",
      email: userData?.email || "",
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({
      nome: userData?.nome || "",
      email: userData?.email || "",
    });
  };

  const handleSave = async () => {
    try {
      await updateUser(userData?.id || "", formData);
      await refetch();
      setIsEditing(false);
      toast.success("Seus dados foram atualizados com sucesso.");
    } catch (error) {
      toast.error("Não foi possível atualizar seus dados. Tente novamente.");
    }
  };

  if (loading) {
    return (
      <div className="container py-10">
        <div className="space-y-4">
          <Skeleton className="h-8 w-[200px]" />
          <Skeleton className="h-4 w-[300px]" />
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
            <Skeleton className="h-[200px]" />
            <Skeleton className="h-[200px]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Meu Perfil</h1>
        <p className="text-muted-foreground">
          Gerencie suas informações pessoais e preferências
        </p>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Informações Pessoais</CardTitle>
                <CardDescription>
                  Atualize seus dados cadastrais
                </CardDescription>
              </div>
              {!isEditing ? (
                <Button variant="outline" onClick={handleEdit}>
                  Editar
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleCancel}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSave}>
                    Salvar
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome</Label>
                {isEditing ? (
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">{userData?.nome || "Não informado"}</p>
                )}
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                {isEditing ? (
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">{userData?.email || "Não informado"}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preferências</CardTitle>
            <CardDescription>
              Configure suas preferências de uso
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Tema</Label>
                <p className="text-sm text-muted-foreground">Claro/Escuro (automático)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 