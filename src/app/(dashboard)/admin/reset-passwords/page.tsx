"use client";

import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle, LockIcon } from "lucide-react";
import { useAuth } from "@/lib/hooks/use-auth";
import { useRouter } from "next/navigation";
import { forceResetPassword } from "@/lib/admin";

const adminResetSchema = z.object({
  email: z.string().email("Por favor, informe um email válido"),
  newPassword: z.string().min(6, "A nova senha deve ter pelo menos 6 caracteres"),
  adminKey: z.string().min(1, "A chave administrativa é obrigatória"),
});

export default function AdminResetPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  const form = useForm<z.infer<typeof adminResetSchema>>({
    resolver: zodResolver(adminResetSchema),
    defaultValues: {
      email: "",
      newPassword: "",
      adminKey: "",
    },
  });

  async function onSubmit(values: z.infer<typeof adminResetSchema>) {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    console.log("[AdminReset] Iniciando redefinição forçada para:", values.email);
    
    try {
      const result = await forceResetPassword(
        values.email, 
        values.newPassword, 
        values.adminKey
      );
      
      if (result.success) {
        console.log("[AdminReset] Redefinição realizada com sucesso");
        setSuccess(`Senha atualizada com sucesso para o usuário ${values.email}`);
        // Limpar apenas os campos de email e senha, mantendo a chave admin
        form.reset({ 
          email: "", 
          newPassword: "", 
          adminKey: values.adminKey 
        });
      } else {
        console.error("[AdminReset] Erro na redefinição:", result.error);
        setError(result.error || "Falha na operação. Verifique os dados e tente novamente.");
      }
    } catch (err) {
      console.error("[AdminReset] Exceção durante a redefinição:", err);
      setError("Ocorreu um erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto py-10">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <div className="flex items-center mb-2">
            <LockIcon className="mr-2 h-5 w-5 text-muted-foreground" />
            <CardTitle>Redefinição Administrativa de Senha</CardTitle>
          </div>
          <CardDescription>
            Esta ferramenta permite que administradores redefinam senhas de usuários diretamente.
            Use com responsabilidade.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-destructive/15 text-destructive flex items-center p-3 rounded-md mb-4">
              <AlertCircle className="h-4 w-4 mr-2" />
              <span className="text-sm">{error}</span>
            </div>
          )}
          
          {success && (
            <div className="bg-green-100 text-green-700 flex items-center p-3 rounded-md mb-4">
              <CheckCircle className="h-4 w-4 mr-2" />
              <span className="text-sm">{success}</span>
            </div>
          )}
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email do usuário</FormLabel>
                    <FormControl>
                      <Input placeholder="usuario@exemplo.com" type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nova senha</FormLabel>
                    <FormControl>
                      <Input placeholder="••••••••" type="password" {...field} />
                    </FormControl>
                    <FormDescription>
                      A nova senha deve ter no mínimo 6 caracteres
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="adminKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chave administrativa</FormLabel>
                    <FormControl>
                      <Input placeholder="Chave de autorização" type="password" {...field} />
                    </FormControl>
                    <FormDescription>
                      Insira a chave administrativa para autorizar esta operação
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Processando..." : "Redefinir senha"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
} 