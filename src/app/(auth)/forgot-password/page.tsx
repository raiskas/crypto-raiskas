"use client";

import Link from "next/link";
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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { AlertCircle, CheckCircle } from "lucide-react";

const forgotPasswordSchema = z.object({
  email: z.string().email("Por favor, informe um email válido"),
});

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const form = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(values: z.infer<typeof forgotPasswordSchema>) {
    setLoading(true);
    setError(null);
    setSuccess(false);
    
    console.log("[ForgotPassword] Solicitando redefinição para:", values.email);
    
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: values.email }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error("[ForgotPassword] Erro na solicitação:", data);
        setError(data.error || "Não foi possível processar sua solicitação. Tente novamente.");
      } else {
        console.log("[ForgotPassword] Solicitação processada com sucesso");
        setSuccess(true);
        form.reset();
      }
    } catch (err) {
      console.error("[ForgotPassword] Exceção durante a solicitação:", err);
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
          <CardTitle className="text-2xl font-bold text-center">Recuperação de Senha</CardTitle>
          <CardDescription className="text-center">
            Digite seu email para receber instruções de recuperação de senha
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
                <span className="font-medium">Email enviado!</span>
                <span className="text-sm">Verifique sua caixa de entrada para instruções de recuperação de senha.</span>
              </div>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="seu@email.com" type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Enviando..." : "Enviar instruções"}
                </Button>
              </form>
            </Form>
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