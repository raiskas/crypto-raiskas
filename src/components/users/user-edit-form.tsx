"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

// Schema de validação para o formulário
const formSchema = z.object({
  nome: z.string().min(3, {
    message: "Nome deve ter pelo menos 3 caracteres.",
  }),
  email: z.string().email({
    message: "Por favor, insira um email válido.",
  }),
  // Adicionar outros campos conforme necessário (ex: role, ativo)
});

// Tipo para os dados do formulário
type UserFormValues = z.infer<typeof formSchema>;

// Props do componente
interface UserEditFormProps {
  initialData: Partial<UserFormValues>; // Permite dados iniciais parciais
  onSubmit: (values: UserFormValues) => Promise<void>;
  isLoading?: boolean;
  // mode?: 'profile' | 'admin'; // Adicionar se precisar diferenciar comportamento
}

export function UserEditForm({
  initialData,
  onSubmit,
  isLoading = false,
}: UserEditFormProps) {
  const form = useForm<UserFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      email: "",
      ...initialData, // Sobrescreve com dados iniciais se fornecidos
    },
  });

  // Resetar o formulário se os dados iniciais mudarem
  useEffect(() => {
    form.reset({
        nome: "",
        email: "",
        ...initialData,
    });
  }, [initialData, form]);

  const handleSubmit = async (values: UserFormValues) => {
    await onSubmit(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="nome"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome</FormLabel>
              <FormControl>
                <Input placeholder="Nome completo" {...field} disabled={isLoading} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="email@exemplo.com" {...field} disabled={isLoading} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Adicionar mais campos aqui (ex: Role, Ativo) se necessário,
            possivelmente com renderização condicional baseada na prop 'mode' */}

        <div className="flex justify-end pt-2">
             <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Alterações
             </Button>
        </div>
      </form>
    </Form>
  );
} 