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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, LogIn } from "lucide-react";
import { useAuth } from "@/lib/hooks/use-auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

const loginSchema = z.object({
  email: z.string().email("Por favor, informe um email válido"),
  password: z.string().min(1, "Por favor, informe sua senha"),
});

export default function SigninPage() {
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof loginSchema>) {
    console.log("[SignIn Page] onSubmit iniciado."); 
    setLoading(true);
    
    try {
      console.log("[SignIn Page] Tentando chamar signIn do useAuth com:", values.email);
      
      const result = await signIn(values.email, values.password);
      
      console.log("[SignIn Page] Resultado recebido de signIn:", result);
      
      if (result.success) {
        console.log("[SignIn Page] Login sucesso. Redirecionando para a raiz ('/')...");
        // TESTE: Usar window.location.href para forçar reload
        // window.location.href = "/home";
        // REVERTER: Usar router.push
        // router.push("/home"); // Comentado
        // router.refresh(); // Comentado
        router.push('/'); // REVERTIDO PARA push('/')
      } else {
        console.error("[SignIn Page] Login reportado como falha:", result.error);
      }
    } catch (err: any) {
      console.error("[SignIn Page] Exceção capturada em onSubmit:", err);
    } finally {
      console.log("[SignIn Page] onSubmit finalizado."); 
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="w-1/2 flex items-center justify-center p-8 bg-muted/30 hidden md:flex">
        <Image 
           src="/logo-sem-fundo.png" 
           alt="Crypto Raiskas Logo Login"
           width={300}
           height={100}
           priority 
         />
      </div>

      <div className="w-full md:w-1/2 flex items-center justify-center p-4 md:p-8">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="md:hidden mb-4 flex justify-center">
              <Image 
                 src="/logo-sem-fundo.png" 
                 alt="Crypto Raiskas Logo Login Small"
                 width={100} 
                 height={33} 
               />
            </div>
            <CardTitle className="text-2xl font-bold text-center">Entrar</CardTitle>
            <CardDescription className="text-center">
              Entre com seu email e senha para acessar o sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha</FormLabel>
                      <FormControl>
                        <PasswordInput placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Entrando..." : (
                    <>
                      <LogIn className="mr-2 h-4 w-4" />
                      Entrar
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2">
            <div className="text-center text-sm">
              <Link 
                href="/signup" 
                className="text-primary hover:underline underline-offset-4 transition-all"
              >
                Não tem uma conta? Cadastre-se
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
} 