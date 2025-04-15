"use client";

import { useEffect, useState } from "react";
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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { AlertCircle, CheckCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const resetPasswordSchema = z.object({
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

export default function ResetPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (!tokenParam) {
      setError("Link de redefinição inválido. Solicite uma nova redefinição de senha.");
      return;
    }
    setToken(tokenParam);
  }, [searchParams]);

  const form = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: z.infer<typeof resetPasswordSchema>) {
    if (!token) {
      setError("Token de redefinição não encontrado");
      return;
    }

    setLoading(true);
    setError(null);
    
    console.log("[ResetPassword] Confirmando redefinição de senha");
    
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          token: token,
          password: values.password
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error("[ResetPassword] Erro na confirmação:", data);
        setError(data.error || "Não foi possível redefinir sua senha. Tente novamente.");
      } else {
        console.log("[ResetPassword] Senha atualizada com sucesso");
        setSuccess(true);
        form.reset();
        
        // Redirecionar para login após 3 segundos
        setTimeout(() => {
          router.push('/signin');
        }, 3000);
      }
    } catch (err) {
      console.error("[ResetPassword] Exceção durante a confirmação:", err);
      setError("Ocorreu um erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Redefinir Senha</CardTitle>
          <CardDescription className="text-center">
            Digite sua nova senha para continuar
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-destructive/15 text-destructive flex items-center p-3 rounded-md mb-4">
              <AlertCircle className="h-4 w-4 mr-2" />
              <span className="text-sm">{error}</span>
            </div>
          )}
          
          {success ? (
            <div className="bg-green-100 text-green-700 flex items-center p-4 rounded-md">
              <CheckCircle className="h-5 w-5 mr-2" />
              <div className="flex flex-col">
                <span className="font-medium">Senha atualizada!</span>
                <span className="text-sm">Sua senha foi redefinida com sucesso. Você será redirecionado para fazer login.</span>
              </div>
            </div>
          ) : (
            token ? (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nova senha</FormLabel>
                        <FormControl>
                          <Input placeholder="••••••••" type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirmar senha</FormLabel>
                        <FormControl>
                          <Input placeholder="••••••••" type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Redefinindo..." : "Redefinir senha"}
                  </Button>
                </form>
              </Form>
            ) : (
              <div className="text-center py-4">
                <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                <p>Link de redefinição inválido ou expirado.</p>
              </div>
            )
          )}
        </CardContent>
        <CardFooter className="flex flex-col">
          <div className="mt-2 text-center text-sm">
            <Link href="/signin" className="font-medium text-primary underline-offset-4 hover:underline">
              Voltar para o login
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
} 