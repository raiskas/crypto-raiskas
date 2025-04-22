"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { UserEditForm } from "@/components/users/user-edit-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Key, Loader2 } from "lucide-react";
// Imports adicionais para o form de senha
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

// Tipo simplificado para os dados do usuário (ajustar conforme necessário)
interface UserData {
    id: string;
    nome: string;
    email: string;
    // Adicionar outros campos que a API retorna e podem ser úteis
}

// Schema para o formulário de senha (reutilizado da página de listagem)
const changePasswordSchema = z.object({
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  passwordConfirm: z.string().min(6, "Confirme a senha"),
}).refine(data => data.password === data.passwordConfirm, {
  message: "As senhas não coincidem",
  path: ["passwordConfirm"],
});

export default function AdminEditUserPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string; // Pega o ID da URL

  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [passwordSubmitLoading, setPasswordSubmitLoading] = useState(false); // Loading para senha

  // Formulário para alterar senha
  const passwordForm = useForm<z.infer<typeof changePasswordSchema>>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      password: "",
      passwordConfirm: "",
    },
  });

  // Função para buscar os dados do usuário específico
  useEffect(() => {
    const fetchUserData = async () => {
      if (!userId) return;
      console.log(`[EditUserPage] Buscando dados para userId: ${userId}`); // Log userId
      setLoading(true);
      try {
        // TODO: Verificar/Criar a API GET /api/admin/users/[userId]
        const response = await fetch(`/api/admin/users/${userId}`);
        console.log(`[EditUserPage] Resposta da API status: ${response.status}`); // Log status

        if (!response.ok) {
          let errorData = { error: "Erro desconhecido na API" };
          try {
             errorData = await response.json();
             console.error('[EditUserPage] Erro da API (JSON):', errorData);
          } catch (jsonError) {
            console.error('[EditUserPage] Erro ao parsear JSON da resposta de erro:', jsonError);
            const textError = await response.text();
            console.error('[EditUserPage] Corpo da resposta de erro (texto):', textError);
            errorData.error = textError || `Erro ${response.status}`;
          }
          throw new Error(errorData.error || "Usuário não encontrado ou erro na API");
        }
        
        const data = await response.json();
        console.log("[EditUserPage] Dados recebidos da API:", data); // Log dados recebidos

        // Ajuste: Verificar se a API retorna data.user ou diretamente os dados
        const userDataToSet = data.user || data; // Tenta data.user primeiro, depois data diretamente
        console.log("[EditUserPage] Dados do usuário para setar no estado:", userDataToSet);

        if (!userDataToSet || Object.keys(userDataToSet).length === 0) {
            throw new Error("Dados do usuário recebidos estão vazios ou em formato incorreto.");
        }

        setUserData(userDataToSet);
      } catch (error: any) {
        console.error("[EditUserPage] Erro ao buscar dados do usuário:", error);
        toast.error(error.message || "Erro ao carregar dados do usuário.");
        setUserData(null); // Garante que userData seja null em caso de erro
        // Redirecionar se não encontrar ou erro grave?
        // router.push("/admin/usuarios");
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [userId, router]);

  // Função para submeter a atualização para a API admin
  const handleUpdateUser = async (formData: { nome: string; email: string }) => {
    setSubmitLoading(true);
    try {
      // Usando a mesma API PATCH que a página de listagem usa
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: userId, // Inclui o ID do usuário sendo editado
          ...formData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao atualizar usuário");
      }

      toast.success("Usuário atualizado com sucesso!");
      // Opcional: redirecionar de volta para a lista após sucesso
      router.push("/admin/usuarios"); 

    } catch (error: any) {
      console.error("Erro ao atualizar usuário:", error);
      toast.error(error.message || "Erro ao atualizar usuário.");
    } finally {
      setSubmitLoading(false);
    }
  };

  // Função para submeter a atualização de SENHA para a API admin
  const handleChangePassword = async (values: z.infer<typeof changePasswordSchema>) => {
    setPasswordSubmitLoading(true);
    try {
      // Usa a mesma API PATCH, mas envia apenas ID e a nova senha
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: userId,
          password: values.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao alterar senha");
      }

      toast.success("Senha alterada com sucesso!");
      passwordForm.reset(); // Limpa o formulário de senha

    } catch (error: any) {
      console.error("Erro ao alterar senha:", error);
      toast.error(error.message || "Erro ao alterar senha.");
    } finally {
      setPasswordSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full px-4 py-10">
        <Skeleton className="h-8 w-1/4 mb-4" />
        <Skeleton className="h-12 w-full mb-6" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/3 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-1/4 ml-auto" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!userData) {
    // Se não estiver carregando e não houver dados, mostra mensagem
    return (
        <div className="w-full px-4 py-10 text-center">
            <p className="text-red-500">Usuário não encontrado ou erro ao carregar.</p>
            <Button variant="outline" asChild className="mt-4">
                <Link href="/admin/usuarios">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Usuários
                </Link>
            </Button>
        </div>
    );
  }

  return (
    <div className="w-full px-4 py-10">
       <Button variant="outline" asChild className="mb-4">
           <Link href="/admin/usuarios">
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Usuários
           </Link>
       </Button>
      <h1 className="text-3xl font-bold mb-6">Editar Usuário</h1>
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Card para Informações Pessoais */}
        <Card>
          <CardHeader>
            <CardTitle>Informações Pessoais</CardTitle>
            <CardDescription>Atualize nome e email do usuário.</CardDescription>
          </CardHeader>
          <CardContent>
            <UserEditForm
              initialData={userData}
              onSubmit={handleUpdateUser}
              isLoading={submitLoading}
            />
          </CardContent>
        </Card>

        {/* Card para Alterar Senha */}
        <Card>
          <CardHeader>
            <CardTitle>Alterar Senha</CardTitle>
            <CardDescription>Defina uma nova senha para o usuário.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(handleChangePassword)} className="space-y-4">
                <FormField
                  control={passwordForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nova senha</FormLabel>
                      <FormControl>
                        <Input placeholder="••••••••" type="password" {...field} disabled={passwordSubmitLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="passwordConfirm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar nova senha</FormLabel>
                      <FormControl>
                        <Input placeholder="••••••••" type="password" {...field} disabled={passwordSubmitLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={passwordSubmitLoading}>
                    {passwordSubmitLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Key className="mr-2 h-4 w-4" />
                    Alterar Senha
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 