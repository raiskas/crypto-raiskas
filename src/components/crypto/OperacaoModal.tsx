"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose, // Para o botão Cancelar
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { OperacaoForm } from "./OperacaoForm"; // Importar o formulário
import { Loader2 } from "lucide-react";
import { toast } from "sonner"; // Para notificações
import { z } from "zod";
import type { formSchema } from "./OperacaoForm"; // Importar o tipo do schema exportado

// Interface da operação (pode ser importada de um local centralizado se já existir)
interface OperacaoData {
  id?: string;
  moeda_id: string;
  simbolo: string;
  nome: string;
  tipo: "compra" | "venda";
  quantidade: number;
  preco_unitario: number;
  valor_total: number;
  data_operacao: string | Date;
  exchange: string | null;
  notas: string | null;
  grupo_id?: string;
}

// Tipos para os valores do formulário (usando o schema importado)
type FormValuesFromSchema = z.infer<typeof formSchema>;

// Props do Modal
interface OperacaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: OperacaoData | null; // Dados para edição
  onSuccess: () => void; // Callback para atualizar a lista após sucesso
  userId?: string; // ID do usuário logado
  grupoIdUsuario?: string | null; // Grupo ID do usuário logado
}

export const OperacaoModal: React.FC<OperacaoModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSuccess,
  userId,
  grupoIdUsuario,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const isEditing = !!initialData;
  const modalTitle = isEditing ? "Editar Operação" : "Nova Operação";
  const modalDescription = isEditing
    ? "Modifique os detalhes da sua operação."
    : "Adicione uma nova operação de compra ou venda.";
  const actionButtonLabel = isEditing ? "Salvar Alterações" : "Criar Operação";

  // Resetar estado de loading quando o modal fecha ou initialData muda
  useEffect(() => {
    if (!isOpen) {
      setIsLoading(false);
    }
  }, [isOpen]);

  // Função de submit que chama a API
  // Usar o tipo inferido diretamente do schema Zod importado
  const handleFormSubmit = async (values: FormValuesFromSchema) => {
    setIsLoading(true);
    console.log("OperacaoModal: Submetendo dados:", values);

    // Garantir que grupo_id está definido, usando o do usuário se necessário
    const finalValues = {
        ...values,
        // Prioriza o grupo_id vindo do form (se o usuário o tiver selecionado)
        // Senão, usa o grupo_id inicial (edição)
        // Senão, usa o grupoIdUsuario (criação ou edição sem grupo específico)
        grupo_id: values.grupo_id || initialData?.grupo_id || grupoIdUsuario || undefined,
    };

    // Validação final do grupo_id antes de enviar
    if (!finalValues.grupo_id) {
        toast.error("Erro: ID do Grupo é obrigatório.");
        console.error("OperacaoModal: Tentativa de submit sem grupo_id final:", finalValues);
        setIsLoading(false);
        return;
    }

    try {
      const url = `/api/crypto/operacoes`; // Mesma URL para POST e PATCH
      const method = isEditing ? "PATCH" : "POST";

      const body = isEditing
        ? JSON.stringify({ ...finalValues, id: initialData?.id }) // Incluir ID na edição (PATCH)
        : JSON.stringify(finalValues); // Corpo padrão para criação (POST)

      console.log(`[OperacaoModal] Enviando ${method} para ${url} com body:`, body);

      const response = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: body,
      });

      const result = await response.json();
      console.log("[OperacaoModal] Resposta da API:", response.status, result);

      if (!response.ok) {
        throw new Error(result.error || `Erro ${response.status}`);
      }

      toast.success(
        isEditing ? "Operação atualizada com sucesso!" : "Operação criada com sucesso!"
      );
      onSuccess(); // Chama o callback para atualizar a lista na página principal
      onClose(); // Fecha o modal
    } catch (error: any) {
      console.error("Erro ao salvar operação:", error);
      toast.error(
        `Falha ao ${isEditing ? "atualizar" : "criar"} operação: ${error.message}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handler para o botão "Salvar" que dispara o submit do form interno
  const triggerSubmit = () => {
      // Acessa o botão submit oculto dentro do OperacaoForm
      const submitButton = document.getElementById('operacao-form-submit') as HTMLButtonElement | null;
      if (submitButton) {
          console.log("[OperacaoModal] Acionando submit do formulário interno...");
          submitButton.click();
      } else {
          console.error("[OperacaoModal] Botão de submit do formulário interno não encontrado.");
          toast.error("Ocorreu um erro interno ao tentar salvar.");
      }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[625px]"> {/* Ajustar largura se necessário */}
        <DialogHeader>
          <DialogTitle>{modalTitle}</DialogTitle>
          <DialogDescription>{modalDescription}</DialogDescription>
        </DialogHeader>

        {/* Renderiza o formulário, passando os dados e callbacks */}
        <OperacaoForm
          initialData={initialData}
          onSubmit={handleFormSubmit} // Agora o tipo deve corresponder
          isLoading={isLoading}
          userId={userId}
          grupoIdUsuario={grupoIdUsuario}
        />

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isLoading}>
              Cancelar
            </Button>
          </DialogClose>
          <Button
            type="button" // Importante: Não é submit direto, ele aciona o submit do form interno
            onClick={triggerSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {actionButtonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 