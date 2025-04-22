"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"; // Removed DialogTrigger as it's not used directly here for group modal
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import {
  AlertCircle,
  CheckCircle,
  Edit,
  Loader2,
  ShieldPlus,
  Shield,
  Trash2
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import React from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Importar tipos compartilhados
import { Group, Empresa } from "@/types/admin"; 
// Importar utilitário compartilhado
import { formatDate } from "@/lib/utils"; 

// Interface para o formato esperado da tela vinda da API
interface ScreenConfig {
  id: string;
  label: string;
}

// --- Schema Zod para o formulário de grupo (adicionar empresa_id) ---
// Pode ser necessário refinar isso se o schema for compartilhado ou mais complexo
const groupFormSchema = z.object({
  nome: z.string().min(1, "Nome do grupo é obrigatório"),
  descricao: z.string().optional().nullable(),
  is_master: z.boolean().default(false),
  telas_permitidas: z.array(z.string().min(1)).optional().default([]),
  empresa_id: z.string().uuid("Selecione uma empresa").nullable(), // Adicionado para master
});
type GroupFormData = z.infer<typeof groupFormSchema>;

// --- Component Props ---
interface GroupSectionProps {
  initialGroups: Group[];
  loadGroups: () => Promise<void>;
  loadUsers: () => Promise<void>;
  loadingGroups: boolean;
  empresas: Empresa[];
  loadingEmpresas: boolean;
  isMaster: boolean;
  setPageError: React.Dispatch<React.SetStateAction<string | null>>;
  setPageSuccess: React.Dispatch<React.SetStateAction<string | null>>;
}

// --- Group Section Component ---
export default function GroupSection({ 
  initialGroups, 
  loadGroups,
  loadUsers,
  loadingGroups,
  empresas,
  loadingEmpresas,
  isMaster,
  setPageError,
  setPageSuccess
}: GroupSectionProps) {
  // States specific to Group Management
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [isDeleteGroupOpen, setIsDeleteGroupOpen] = useState(false);

  // State for actions within this section
  const [actionLoading, setActionLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isLoadingGroupDetails, setIsLoadingGroupDetails] = useState(false);

  // Estados para as telas disponíveis
  const [availableScreens, setAvailableScreens] = useState<ScreenConfig[]>([]);
  const [loadingScreens, setLoadingScreens] = useState(true);
  const [screensError, setScreensError] = useState<string | null>(null);

  // Buscar telas disponíveis ao montar o componente
  useEffect(() => {
    const fetchScreens = async () => {
      setLoadingScreens(true);
      setScreensError(null);
      try {
        const response = await fetch('/api/admin/available-screens');
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Erro ao buscar telas disponíveis');
        }
        // FILTRAR AQUI ANTES DE DEFINIR O ESTADO
        const screensToExclude = ['vendas', 'dashboard', 'perfil']; // Adicionado 'perfil'
        const filteredScreens = (data.screens || []).filter(
          (screen: ScreenConfig) => !screensToExclude.includes(screen.id)
        );
        setAvailableScreens(filteredScreens); // Define o estado com a lista filtrada
      } catch (err: any) {
        console.error("Erro ao buscar telas disponíveis:", err);
        setScreensError(`Erro ao carregar telas: ${err.message}`);
        setAvailableScreens([]); // Limpa caso haja erro
      } finally {
        setLoadingScreens(false);
      }
    };

    fetchScreens();
  }, []); // Executa apenas uma vez ao montar

  // Update local groups state if initialGroups prop changes
  useEffect(() => {
    setGroups(initialGroups);
  }, [initialGroups]);

  // --- Form with new schema and default value ---
  const groupForm = useForm<GroupFormData>({
    // @ts-ignore // Ignorar erro no resolver por enquanto
    resolver: zodResolver(groupFormSchema),
    defaultValues: { 
      nome: "", 
      descricao: "",
      is_master: false, 
      telas_permitidas: [],
      empresa_id: null, 
    },
  });

  // --- Handlers (handleGroupSubmit needs to send empresa_id) ---
  const handleGroupSubmit = async (values: GroupFormData) => { 
    setActionLoading(true); setModalError(null); setPageError(null); setPageSuccess(null);
    const method = isEditingGroup ? 'PATCH' : 'POST';
    const url = '/api/admin/groups';

    console.log('[handleGroupSubmit] Valores recebidos do form:', values);

    // Construir payload - The API POST already expects empresa_id in the body for masters
    // The API PATCH does not expect empresa_id in the body
    let payload: any;
    if (isEditingGroup) {
        // Para PATCH, envie apenas os campos que podem ser atualizados + ID
        payload = { 
          id: selectedGroup?.id, // ID é crucial
          nome: values.nome,
          descricao: values.descricao,
          is_master: values.is_master,
          telas_permitidas: values.is_master ? [] : values.telas_permitidas, // Ajuste telas_permitidas
          // NÃO envie empresa_id no PATCH, ele não deve ser alterado
        };
        console.log('[handleGroupSubmit] Payload para PATCH (sem empresa_id):', payload);
    } else {
        // Para POST, envie todos os valores do form (API tratará empresa_id)
        payload = values; 
        console.log('[handleGroupSubmit] Payload para POST:', payload);
    }
    
    // Garantir que telas_permitidas seja um array vazio se is_master for true (redundante com ajuste acima, mas seguro)
    if (payload.is_master) {
      payload.telas_permitidas = []; // Garantir que seja array vazio
    }

    if (isEditingGroup && !selectedGroup?.id) {
      setModalError("Erro: ID do grupo não encontrado para atualização.");
      setActionLoading(false);
      return;
    }

    // Log do payload final a ser enviado (após ajuste)
    // console.log('[handleGroupSubmit] Payload final enviado para API:', payload); // Log já feito acima

    try {
      const response = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      
      // Tentar ler o corpo JSON mesmo se a resposta não for OK
      const data = await response.json(); 

      if (!response.ok) {
          // Usar a mensagem de erro do corpo da resposta se disponível
          console.error('[handleGroupSubmit] API Error Response:', data); // Log extra
          throw new Error(data.error || `Erro ${response.status}: ${response.statusText}`); 
      }

      setPageSuccess(`Grupo ${isEditingGroup ? 'atualizado' : 'criado'} com sucesso!`);
      setIsGroupModalOpen(false);
      await loadGroups();
      await loadUsers(); // Recarregar usuários também, pois a associação pode ter mudado indiretamente
    } catch (err: any) {
        // Logar o erro completo para depuração (não visível para o usuário)
        console.error("[handleGroupSubmit] Erro capturado:", err); 
        // Definir a mensagem do modal com a mensagem do erro capturado
        setModalError(err.message || `Erro desconhecido ao ${isEditingGroup ? 'atualizar' : 'criar'} grupo`); 
        // Não definir pageError aqui, pois o erro é específico do modal
    } finally { 
        setActionLoading(false); 
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroup) return;
    setActionLoading(true); setModalError(null); setPageError(null); setPageSuccess(null);
    try {
      const response = await fetch(`/api/admin/groups?id=${selectedGroup.id}`, { method: 'DELETE' });
      // Melhorar tratamento de erro aqui também
      const data = await response.json();
      if (!response.ok) {
        console.error('[handleDeleteGroup] API Error Response:', data);
        throw new Error(data.error || `Erro ${response.status}: ${response.statusText}`);
      }

      setPageSuccess("Grupo removido com sucesso!");
      setIsDeleteGroupOpen(false);
      await loadGroups();
      await loadUsers(); // Recarregar usuários pode ser necessário se a exclusão desvincula
    } catch (err: any) {
       console.error("[handleDeleteGroup] Erro capturado:", err);
       // Sempre mostrar o erro no modal correspondente
       setModalError(err.message || "Erro desconhecido ao remover grupo");
    } finally {
      setActionLoading(false);
    }
  };

  // Open Group Modals
  const openCreateGroupModal = () => {
    setIsEditingGroup(false);
    setSelectedGroup(null);
    groupForm.reset({ nome: "", descricao: "", is_master: false, telas_permitidas: [], empresa_id: null });
    setModalError(null); setPageError(null); setPageSuccess(null);
    setIsGroupModalOpen(true);
  };

  // Modificado para buscar dados completos do grupo
  const openEditGroupModal = async (group: Group) => {
    setIsEditingGroup(true);
    setSelectedGroup(group); // Mantém o grupo selecionado
    setModalError(null);
    setPageError(null);
    setPageSuccess(null);
    setIsLoadingGroupDetails(true); // Inicia loading
    setIsGroupModalOpen(true); // Abre o modal imediatamente (mostrará loading)
    groupForm.reset(); // Limpa o form enquanto carrega

    try {
      console.log(`[openEditGroupModal] Buscando detalhes do grupo ID: ${group.id}`);
      const response = await fetch(`/api/admin/groups?id=${group.id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Erro ${response.status} ao buscar detalhes do grupo.`);
      }
      
      const groupDetails = data.group; // Assumindo que a API retorna { group: {...} }
      console.log("[openEditGroupModal] Detalhes recebidos:", groupDetails);

      if (!groupDetails) {
          throw new Error("Detalhes do grupo não encontrados na resposta da API.");
      }

      // Preenche o formulário com os dados COMPLETOS recebidos da API
      groupForm.reset({ 
        nome: groupDetails.nome ?? '', 
        descricao: groupDetails.descricao ?? '',
        is_master: groupDetails.is_master ?? false, 
        telas_permitidas: groupDetails.telas_permitidas ?? [], // Usar dados da API
        empresa_id: groupDetails.empresa_id ?? null,          // Usar dados da API
      }); 

    } catch (err: any) {
      console.error("[openEditGroupModal] Erro ao buscar detalhes do grupo:", err);
      setModalError(`Erro ao carregar dados do grupo: ${err.message}`);
      // Opcional: Fechar o modal ou manter aberto com erro? Manter aberto com erro.
      // setIsGroupModalOpen(false); 
    } finally {
      setIsLoadingGroupDetails(false); // Finaliza loading
    }
  };

  const openDeleteGroupModal = (group: Group) => {
    setSelectedGroup(group);
    setModalError(null); setPageError(null); setPageSuccess(null);
    setIsDeleteGroupOpen(true);
  };

  // --- Renderização ---
  return (
    <div className="w-full px-4 pb-10">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold flex items-center">
              <Shield className="mr-2 h-6 w-6" />
              Gerenciamento de Grupos
            </CardTitle>
            <CardDescription>
              Crie, edite e remova grupos de permissão.
            </CardDescription>
          </div>
          <Button onClick={openCreateGroupModal}>
            <ShieldPlus className="mr-2 h-4 w-4" /> Criar Grupo
          </Button>
        </CardHeader>

        <CardContent>
           {/* Display global Group Section Error/Success were here and are now removed */}

          {/* Group Table */}
          {loadingGroups ? (
            <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : groups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhum grupo encontrado. Crie um novo grupo.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    
                    <TableHead>Nome</TableHead>
                    <TableHead>Empresa</TableHead> 
                    <TableHead>Descrição</TableHead>
                    
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((group) => (
                    <TableRow key={group.id}>
                      
                      <TableCell className="font-medium">{group.nome}</TableCell>
                      <TableCell>{group.empresa?.nome || "-"}</TableCell> 
                      <TableCell className="text-muted-foreground">{group.descricao || "-"}</TableCell>
                      
                      <TableCell className="text-right space-x-2">
                        <div className="flex items-center justify-end space-x-2">
                          <Button variant="ghost" size="icon" onClick={() => openEditGroupModal(group)} title="Editar Grupo"> <Edit className="h-4 w-4" /> </Button>
                          <Button variant="destructive" size="icon" onClick={() => openDeleteGroupModal(group)} title="Excluir Grupo"> <Trash2 className="h-4 w-4" /> </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* --- Group Modals (Exibir modalError dentro deles) --- */}
      {/* Create/Edit Group Modal */}
       <Dialog open={isGroupModalOpen} onOpenChange={(open) => {
           if (!open) { setModalError(null); groupForm.clearErrors(); groupForm.reset(); }
           setIsGroupModalOpen(open);
       }}>
         <DialogContent className="sm:max-w-[500px]">
           <DialogHeader>
             <DialogTitle>{isEditingGroup ? 'Editar Grupo' : 'Criar Novo Grupo'}</DialogTitle>
           </DialogHeader>

           {/* Mostrar loading ou erro DENTRO do modal */}
           {isLoadingGroupDetails && (
             <div className="flex justify-center items-center h-40">
               <Loader2 className="h-8 w-8 animate-spin text-primary" />
               <span className="ml-2">Carregando dados do grupo...</span>
             </div>
           )}

           {modalError && !isLoadingGroupDetails && ( // Mostrar erro apenas se não estiver carregando
             <div className="bg-destructive/15 text-destructive flex items-center p-3 rounded-md mb-2"> 
               <AlertCircle className="h-4 w-4 mr-2" /> 
               <span className="text-sm">{modalError}</span> 
             </div> 
           )}

           {/* Esconder form enquanto carrega ou se houve erro fatal no load */}
           {!isLoadingGroupDetails && !modalError?.startsWith("Erro ao carregar dados") && (
               <Form {...groupForm}>
                 {/* @ts-ignore */} 
                 <form onSubmit={groupForm.handleSubmit(handleGroupSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">

                   {/* Conteúdo do Formulário (renderiza normalmente quando não está carregando) */}
                   {/* Nome do Grupo */}
                   {/* @ts-ignore */}
                   <FormField control={groupForm.control} name="nome" render={({ field }) => ( <FormItem><FormLabel>Nome do Grupo *</FormLabel><FormControl><Input placeholder="Ex: Administradores, Vendedores" {...field} /></FormControl><FormMessage /></FormItem> )} />

                   {/* Descrição */}
                   {/* @ts-ignore */}
                   <FormField control={groupForm.control} name="descricao" render={({ field }) => ( <FormItem><FormLabel>Descrição</FormLabel><FormControl><Textarea placeholder="Descreva as permissões e propósito deste grupo..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />

                   {/* Campo Empresa (visível apenas para master, desabilitado na edição) */}
                   {isMaster && (
                       <FormField
                        // @ts-ignore // Ignorar erro de tipo no control por enquanto
                        control={groupForm.control}
                        name="empresa_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Empresa</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value ?? undefined}        // Controlar o valor
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione a empresa" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {loadingEmpresas ? (
                                  <SelectItem value="loading" disabled>Carregando...</SelectItem>
                                ) : (
                                  empresas.map((empresa) => (
                                    <SelectItem key={empresa.id} value={empresa.id}>
                                      {empresa.nome}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Selecione a qual empresa este grupo pertence.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                   {/* Opção Grupo Master */}
                   {/* @ts-ignore */}
                   <FormField control={groupForm.control} name="is_master" render={({ field }) => (
                     <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow">
                       <FormControl>
                         <Checkbox
                           checked={field.value}
                           onCheckedChange={field.onChange}
                           disabled={actionLoading} // Opcional: desabilitar enquanto carrega
                         />
                       </FormControl>
                       <div className="space-y-1 leading-none">
                         <FormLabel>
                           Grupo Master (Acesso Total)
                         </FormLabel>
                         <FormDescription>
                           Marca esta opção se o grupo deve ter acesso irrestrito a todas as telas e funcionalidades.
                         </FormDescription>
                       </div>
                     </FormItem>
                   )} />

                   {/* Screens Checkbox Group (only if not master) */}
                   {!groupForm.watch("is_master") && (
                       /* @ts-ignore */
                       <FormField
                       // @ts-ignore
                       control={groupForm.control}
                       name="telas_permitidas"
                       render={({ field }) => (
                           <FormItem className="space-y-3">
                           <FormLabel>Telas Permitidas</FormLabel>
                           <FormDescription>
                               Selecione as telas que os membros deste grupo poderão acessar.
                           </FormDescription>
                           {loadingScreens ? (
                             <div className="flex items-center text-sm text-muted-foreground">
                               <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando telas...
                             </div>
                           ) : screensError ? (
                              <div className="text-sm text-destructive flex items-center">
                                <AlertCircle className="mr-2 h-4 w-4" /> {screensError}
                              </div>
                           ) : availableScreens.length === 0 ? (
                             <div className="text-sm text-muted-foreground">
                               Nenhuma tela configurada.
                             </div>
                           ) : (
                             <div className="grid grid-cols-2 gap-4">
                                 {availableScreens.map((screen) => (
                                 <FormField
                                     key={screen.id}
                                     // @ts-ignore
                                     control={groupForm.control}
                                     name="telas_permitidas"
                                     render={({ field: itemField }) => { 
                                     return (
                                         <FormItem
                                         key={screen.id}
                                         className="flex flex-row items-start space-x-3 space-y-0"
                                         >
                                         <FormControl>
                                             <Checkbox
                                             checked={itemField.value?.includes(screen.id)}
                                             onCheckedChange={(checked: boolean) => {
                                                 return checked
                                                 ? itemField.onChange([...(itemField.value ?? []), screen.id])
                                                 : itemField.onChange(
                                                     (itemField.value ?? []).filter(
                                                     (value) => value !== screen.id
                                                     )
                                                 );
                                             }}
                                             disabled={actionLoading}
                                             />
                                         </FormControl>
                                         <FormLabel className="font-normal capitalize">
                                             {screen.label} 
                                         </FormLabel>
                                         </FormItem>
                                     );
                                     }}
                                 />
                                 ))}
                             </div>
                           )}
                           <FormMessage />
                           </FormItem>
                       )}
                       />
                   )}

                   <DialogFooter>
                     <Button variant="outline" onClick={() => setIsGroupModalOpen(false)} disabled={actionLoading}> Cancelar </Button>
                     <Button type="submit" disabled={actionLoading || (!isEditingGroup && isMaster && loadingEmpresas)}> {/* Desabilitar se master e empresas carregando */}
                       {actionLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Aguarde...</>) : (isEditingGroup ? 'Salvar Alterações' : 'Criar Grupo')}
                     </Button>
                   </DialogFooter>
                 </form>
               </Form>
           )}
         </DialogContent>
       </Dialog>

       {/* Delete Group Modal */}
       <Dialog open={isDeleteGroupOpen} onOpenChange={setIsDeleteGroupOpen}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>Confirmar Remoção</DialogTitle>
             <DialogDescription>
               Tem certeza que deseja remover o grupo "{selectedGroup?.nome}"? Esta ação não pode ser desfeita.
             </DialogDescription>
           </DialogHeader>
           {/* Display Error inside Modal */}
           {modalError && ( <div className="bg-destructive/15 text-destructive flex items-center p-3 rounded-md mb-2"> <AlertCircle className="h-4 w-4 mr-2" /> <span className="text-sm">{modalError}</span> </div> )}
           <DialogFooter>
             <Button variant="outline" onClick={() => setIsDeleteGroupOpen(false)} disabled={actionLoading}> Cancelar </Button>
             <Button variant="destructive" onClick={handleDeleteGroup} disabled={actionLoading}>
               {actionLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Removendo...</>) : 'Remover Grupo'}
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
    </div>
  );
} 