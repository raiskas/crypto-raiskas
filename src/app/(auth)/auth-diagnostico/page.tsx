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
import { AlertCircle, CheckCircle, Bug, Wrench, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const diagnosticoSchema = z.object({
  email: z.string().email("Por favor, informe um email válido"),
});

interface DiagnosticResult {
  user: {
    id: string;
    email: string;
    emailConfirmed: boolean;
    customRecord: string;
  };
  issues: string[];
  recommendedActions: string[];
  actionsPerformed: string[];
}

export default function AuthDiagnosticoPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [fixing, setFixing] = useState(false);

  const form = useForm<z.infer<typeof diagnosticoSchema>>({
    resolver: zodResolver(diagnosticoSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(values: z.infer<typeof diagnosticoSchema>) {
    setLoading(true);
    setError(null);
    setResult(null);
    
    console.log("[AuthDiagnostico] Solicitando diagnóstico para:", values.email);
    
    try {
      const response = await fetch('/api/auth/debug', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: values.email }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error("[AuthDiagnostico] Erro na solicitação:", data);
        if (response.status === 404) {
          setError(`Usuário não encontrado: ${values.email}`);
        } else {
          setError(data.error || "Não foi possível realizar o diagnóstico. Tente novamente.");
        }
      } else {
        console.log("[AuthDiagnostico] Diagnóstico concluído:", data);
        setResult(data);
      }
    } catch (err) {
      console.error("[AuthDiagnostico] Exceção durante a solicitação:", err);
      setError("Ocorreu um erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function repararProblemas() {
    if (!result) return;
    
    setFixing(true);
    setError(null);
    
    try {
      console.log("[AuthDiagnostico] Reparando problemas para:", result.user.email);
      const response = await fetch('/api/auth/debug', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email: result.user.email,
          action: "FIX_ISSUES"
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error("[AuthDiagnostico] Erro ao reparar:", data);
        setError(data.error || "Não foi possível reparar os problemas. Tente novamente.");
      } else {
        console.log("[AuthDiagnostico] Reparação concluída:", data);
        setResult(data);
      }
    } catch (err) {
      console.error("[AuthDiagnostico] Exceção durante a reparação:", err);
      setError("Ocorreu um erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setFixing(false);
    }
  }

  function getIssueName(issue: string) {
    const issueMap: {[key: string]: string} = {
      'EMAIL_NOT_CONFIRMED': 'Email não confirmado',
      'NO_CUSTOM_RECORD': 'Registro não encontrado no banco de dados',
      'AUTH_ID_MISMATCH': 'ID de autenticação incorreto',
      'USER_INACTIVE': 'Usuário inativo',
    };
    
    return issueMap[issue] || issue;
  }
  
  function getActionName(action: string) {
    const actionMap: {[key: string]: string} = {
      'CONFIRM_EMAIL': 'Confirmar email',
      'CREATE_CUSTOM_RECORD': 'Criar registro no banco',
      'FIX_AUTH_ID': 'Corrigir ID de autenticação',
      'ACTIVATE_USER': 'Ativar usuário',
      'EMAIL_CONFIRMED': 'Email confirmado',
      'AUTH_ID_FIXED': 'ID de autenticação corrigido',
      'USER_ACTIVATED': 'Usuário ativado',
    };
    
    return actionMap[action] || action;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Bug className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl font-bold text-center">Diagnóstico de Autenticação</CardTitle>
          </div>
          <CardDescription className="text-center">
            Esta ferramenta ajuda a identificar e corrigir problemas de login
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-destructive/15 text-destructive flex items-center p-3 rounded-md mb-4">
              <AlertCircle className="h-4 w-4 mr-2" />
              <span className="text-sm">{error}</span>
            </div>
          )}
          
          {!result ? (
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
                  {loading ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Analisando...
                    </>
                  ) : (
                    "Diagnosticar"
                  )}
                </Button>
              </form>
            </Form>
          ) : (
            <div className="space-y-4">
              <Alert>
                <div className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                  <AlertTitle>Diagnóstico concluído</AlertTitle>
                </div>
                <AlertDescription>
                  Usuário: <span className="font-medium">{result.user.email}</span>
                </AlertDescription>
              </Alert>
              
              <div className="mt-4">
                <h3 className="text-sm font-medium mb-2">Status da conta:</h3>
                <div className="flex flex-wrap gap-2 mb-2">
                  <Badge variant={result.user.emailConfirmed ? "success" : "destructive"}>
                    {result.user.emailConfirmed ? "Email confirmado" : "Email não confirmado"}
                  </Badge>
                  <Badge variant={result.user.customRecord === "FOUND" ? "success" : "destructive"}>
                    {result.user.customRecord === "FOUND" ? "Registro encontrado" : "Registro não encontrado"}
                  </Badge>
                </div>
              </div>
              
              {result.issues.length > 0 ? (
                <>
                  <div className="mt-2">
                    <h3 className="text-sm font-medium mb-2">Problemas encontrados:</h3>
                    <ul className="space-y-1">
                      {result.issues.map((issue, i) => (
                        <li key={i} className="text-sm flex items-center">
                          <AlertCircle className="h-3 w-3 mr-2 text-amber-500" />
                          {getIssueName(issue)}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  {result.actionsPerformed.length > 0 && (
                    <div className="mt-2">
                      <h3 className="text-sm font-medium mb-2">Ações realizadas:</h3>
                      <ul className="space-y-1">
                        {result.actionsPerformed.map((action, i) => (
                          <li key={i} className="text-sm flex items-center">
                            <CheckCircle className="h-3 w-3 mr-2 text-green-600" />
                            {getActionName(action)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {result.recommendedActions.length > 0 && (
                    <div className="mt-4">
                      <Button 
                        onClick={repararProblemas} 
                        className="w-full" 
                        disabled={fixing}
                      >
                        {fixing ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Reparando...
                          </>
                        ) : (
                          <>
                            <Wrench className="mr-2 h-4 w-4" />
                            Reparar problemas
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-green-100 text-green-700 flex items-center p-4 rounded-md">
                  <CheckCircle className="h-5 w-5 mr-2" />
                  <div className="flex flex-col">
                    <span className="font-medium">Tudo certo!</span>
                    <span className="text-sm">
                      Não encontramos problemas com sua conta. 
                      {result.actionsPerformed.length > 0 && " Todas as correções foram aplicadas."}
                    </span>
                  </div>
                </div>
              )}
              
              <div className="mt-4">
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => {
                    setResult(null);
                    form.reset();
                  }}
                >
                  Novo diagnóstico
                </Button>
              </div>
            </div>
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