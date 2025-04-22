'use client';

import { useState, useEffect, useCallback } from "react";
import { AlertCircle, CheckCircle, Loader2, PlusCircle, Edit, Trash2, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatDate } from "@/lib/utils";

// --- Schema Zod para o Frontend --- (Espelha a API, mas usado no cliente)
const empresaFormSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  cnpj: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  email_contato: z.string().email({ message: "Email inválido" }).optional().nullable(),
  endereco_rua: z.string().optional().nullable(),
  endereco_numero: z.string().optional().nullable(),
  endereco_complemento: z.string().optional().nullable(),
  endereco_bairro: z.string().optional().nullable(),
  endereco_cidade: z.string().optional().nullable(),
  endereco_estado: z.string().length(2, "UF inválida").optional().nullable(),
  endereco_cep: z.string().optional().nullable(),
  ativo: z.boolean().default(true),
});

type EmpresaFormData = z.infer<typeof empresaFormSchema>;

// Definir tipo Empresa (ajuste conforme sua tabela)
interface Empresa extends EmpresaFormData {
  id: string;
  criado_em: string;
  atualizado_em: string;
}

export default function EmpresaManagementPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Definir valores padrão explicitamente tipados
  const defaultFormValues: EmpresaFormData = {
      nome: "",
      cnpj: null,
      telefone: null,
      email_contato: null,
      endereco_rua: null,
      endereco_numero: null,
      endereco_complemento: null,
      endereco_bairro: null,
      endereco_cidade: null,
      endereco_estado: null,
      endereco_cep: null,
      ativo: true,
  };

  // Configuração dos Formulários
  const formCreate = useForm<EmpresaFormData>({
    // @ts-ignore - Suprimir erro de tipo do resolver
    resolver: zodResolver(empresaFormSchema),
    defaultValues: defaultFormValues, // Usar o objeto tipado
  });

  const formEdit = useForm<EmpresaFormData>({
    // @ts-ignore - Suprimir erro de tipo do resolver
    resolver: zodResolver(empresaFormSchema),
    defaultValues: defaultFormValues, // Usar o objeto tipado (será sobrescrito no openEditModal)
  });

  // Função para carregar empresas
  const loadEmpresas = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Não limpar sucesso aqui para mantê-lo visível após ação
    try {
      const response = await fetch('/api/admin/empresas', { credentials: 'include' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erro ao carregar empresas");
      }
      setEmpresas(data.empresas || []);
    } catch (err: any) {
      console.error("Erro ao carregar empresas:", err);
      setError(err.message);
      setSuccess(null); // Limpar sucesso em caso de erro no carregamento
    } finally {
      setLoading(false);
    }
  }, []);

  // Carregar na inicialização
  useEffect(() => {
    loadEmpresas();
  }, [loadEmpresas]);

  // --- Handlers Implementados ---
  const handleCreateEmpresa = async (values: EmpresaFormData) => {
    setActionLoading(true);
    setModalError(null);
    setSuccess(null); // Limpar sucesso global antes da ação
    try {
      const response = await fetch('/api/admin/empresas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.details ? JSON.stringify(data.details) : data.error || "Erro desconhecido ao criar empresa");
      }
      setSuccess("Empresa criada com sucesso!");
      setIsCreateModalOpen(false);
      await loadEmpresas(); // Recarrega a lista
    } catch (err: any) {
      console.error("Erro ao criar empresa:", err);
      setModalError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditEmpresa = async (values: EmpresaFormData) => {
     if (!selectedEmpresa) return;
     setActionLoading(true);
     setModalError(null);
     setSuccess(null); // Limpar sucesso global antes da ação
     try {
        const payload = { ...values, id: selectedEmpresa.id };
        const response = await fetch('/api/admin/empresas', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'include',
        });
        const data = await response.json();
      if (!response.ok) {
        throw new Error(data.details ? JSON.stringify(data.details) : data.error || "Erro desconhecido ao atualizar empresa");
      }
      setSuccess("Empresa atualizada com sucesso!");
      setIsEditModalOpen(false);
      await loadEmpresas(); // Recarrega a lista
     } catch (err: any) {
        console.error("Erro ao editar empresa:", err);
        setModalError(err.message);
     } finally {
       setActionLoading(false);
     }
  };

  const handleDeleteEmpresa = async () => {
    if (!selectedEmpresa) return;
    setActionLoading(true);
    setModalError(null);
    setSuccess(null); // Limpar sucesso global antes da ação
    try {
       const response = await fetch(`/api/admin/empresas?id=${selectedEmpresa.id}`, {
            method: 'DELETE',
            credentials: 'include',
        });
       const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || "Erro desconhecido ao remover empresa");
        }
        setSuccess("Empresa removida com sucesso!");
        setIsDeleteModalOpen(false);
        await loadEmpresas(); // Recarrega a lista
    } catch (err: any) {
       console.error("Erro ao remover empresa:", err);
       // Mostrar erro no modal de deleção
       setModalError(err.message);
       // Não fechar modal se der erro
    } finally {
      setActionLoading(false);
    }
  };

  // --- Funções para abrir modais ---
  const openCreateModal = () => {
      setModalError(null);
      // Resetar com os valores padrão tipados
      formCreate.reset(defaultFormValues);
      setIsCreateModalOpen(true);
  };

  const openEditModal = (empresa: Empresa) => {
      setSelectedEmpresa(empresa);
      setModalError(null);
      // Resetar formEdit com valores da empresa, garantindo tipo EmpresaFormData
      formEdit.reset({
          nome: empresa.nome,
          cnpj: empresa.cnpj ?? null,
          telefone: empresa.telefone ?? null,
          email_contato: empresa.email_contato ?? null,
          endereco_rua: null, // TODO
          endereco_numero: null, // TODO
          endereco_complemento: null, // TODO
          endereco_bairro: null, // TODO
          endereco_cidade: null, // TODO
          endereco_estado: null, // TODO
          endereco_cep: null, // TODO
          ativo: empresa.ativo ?? true,
      } as EmpresaFormData); // Cast explícito para garantir o tipo
      setIsEditModalOpen(true);
  };

  const openDeleteModal = (empresa: Empresa) => {
      setSelectedEmpresa(empresa);
      setModalError(null); // Limpar erro anterior ao abrir modal
      setIsDeleteModalOpen(true);
  };

  // --- Componente Reutilizável de Formulário ---
  const EmpresaFormFields = ({ formControl }: { formControl: ReturnType<typeof useForm<EmpresaFormData>>['control'] }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto p-1">
      <FormField control={formControl} name="nome" render={({ field }) => ( <FormItem className="md:col-span-2"><FormLabel>Nome *</FormLabel><FormControl><Input placeholder="Nome da Empresa" {...field} /></FormControl><FormMessage /></FormItem> )} />
      <FormField control={formControl} name="cnpj" render={({ field }) => ( <FormItem><FormLabel>CNPJ</FormLabel><FormControl><Input placeholder="00.000.000/0000-00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
      <FormField control={formControl} name="telefone" render={({ field }) => ( <FormItem><FormLabel>Telefone</FormLabel><FormControl><Input placeholder="(99) 99999-9999" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
      <FormField control={formControl} name="email_contato" render={({ field }) => ( <FormItem className="md:col-span-2"><FormLabel>Email de Contato</FormLabel><FormControl><Input type="email" placeholder="contato@empresa.com" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />

      {/* Campos de Endereço (Exemplo) */}
      <FormField control={formControl} name="endereco_cep" render={({ field }) => ( <FormItem><FormLabel>CEP</FormLabel><FormControl><Input placeholder="00000-000" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
      <FormField control={formControl} name="endereco_rua" render={({ field }) => ( <FormItem><FormLabel>Rua</FormLabel><FormControl><Input placeholder="Rua, Av..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
      <FormField control={formControl} name="endereco_numero" render={({ field }) => ( <FormItem><FormLabel>Número</FormLabel><FormControl><Input placeholder="123" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
      <FormField control={formControl} name="endereco_complemento" render={({ field }) => ( <FormItem><FormLabel>Complemento</FormLabel><FormControl><Input placeholder="Apto, Bloco..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
      <FormField control={formControl} name="endereco_bairro" render={({ field }) => ( <FormItem><FormLabel>Bairro</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
      <FormField control={formControl} name="endereco_cidade" render={({ field }) => ( <FormItem><FormLabel>Cidade</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
      <FormField control={formControl} name="endereco_estado" render={({ field }) => ( <FormItem><FormLabel>Estado (UF)</FormLabel><FormControl><Input placeholder="SP" maxLength={2} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />

      <FormField control={formControl} name="ativo" render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm md:col-span-2">
              <div className="space-y-0.5">
                  <FormLabel>Empresa Ativa</FormLabel>
                  <FormDescription>Desmarque para desativar a empresa.</FormDescription>
              </div>
              <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
          </FormItem>
      )} />
    </div>
  );

  // --- Renderização ---
  return (
    <div className="w-full px-4 py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Empresas</h1>
        <Button onClick={openCreateModal}>
          <PlusCircle className="mr-2 h-4 w-4" /> Criar Empresa
        </Button>
      </div>

      {/* Mensagens Globais */} 
       <div className="mb-4 space-y-2">
          {error && (
              <div className="bg-destructive/15 text-destructive flex items-start p-3 rounded-md">
                  <AlertCircle className="h-5 w-5 mr-2 mt-1 flex-shrink-0" />
                  <div><p className="font-semibold mb-1">Erro ao carregar dados</p><p className="text-sm">{error}</p></div>
              </div>
          )}
          {success && (
              <div className="bg-green-100 text-green-700 flex items-start p-3 rounded-md">
                  <CheckCircle className="h-5 w-5 mr-2 mt-1 flex-shrink-0" />
                  <div><p className="text-sm">{success}</p></div>
              </div>
          )}
       </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold flex items-center">
              <Building className="mr-2 h-6 w-6" />
              Gerenciamento de Empresas
            </CardTitle>
            <CardDescription>Adicione, edite ou remova empresas do sistema.</CardDescription>
          </div>
          <Button onClick={openCreateModal}>
            <PlusCircle className="mr-2 h-4 w-4" /> Criar Empresa
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : empresas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhuma empresa encontrada.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Email Contato</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {empresas.map((empresa) => (
                    <TableRow key={empresa.id}>
                      <TableCell className="font-medium">{empresa.nome}</TableCell>
                      <TableCell>{empresa.cnpj || '-'}</TableCell>
                      <TableCell>{empresa.email_contato || '-'}</TableCell>
                      <TableCell>
                         <span className={`inline-flex px-2 py-1 text-xs rounded-full ${ empresa.ativo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700" }`}>
                          {empresa.ativo ? "Ativa" : "Inativa"}
                        </span>
                      </TableCell>
                      <TableCell>{formatDate(empresa.criado_em)}</TableCell>
                      <TableCell className="text-right">
                         <div className="flex items-center justify-end space-x-2">
                            <Button variant="ghost" size="icon" onClick={() => openEditModal(empresa)} title="Editar Empresa">
                                <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="destructive" size="icon" onClick={() => openDeleteModal(empresa)} title="Excluir Empresa">
                                <Trash2 className="h-4 w-4" />
                            </Button>
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

      {/* --- Modais com Formulários --- */} 

      {/* Modal Criar Empresa */}
      <Dialog open={isCreateModalOpen} onOpenChange={(open) => { if (!open) formCreate.reset(); setIsCreateModalOpen(open); }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Criar Nova Empresa</DialogTitle>
          </DialogHeader>
           <Form {...formCreate}>
              {/* @ts-ignore - Suprimir erro de tipo do handleSubmit */}
              <form onSubmit={formCreate.handleSubmit(handleCreateEmpresa)} className="space-y-4">
                 {/* @ts-ignore - Suprimir erro de tipo do control */}
                 <EmpresaFormFields formControl={formCreate.control} />
                 {modalError && <p className='text-sm text-red-600 bg-red-50 p-3 rounded-md'>{modalError}</p>}
                 <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)} disabled={actionLoading}>Cancelar</Button>
                    <Button type="submit" disabled={actionLoading}>
                      {actionLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Criando...</> : 'Criar Empresa'}
                    </Button>
                 </DialogFooter>
              </form>
           </Form>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Empresa */}
       <Dialog open={isEditModalOpen} onOpenChange={(open) => { if (!open) formEdit.reset(); setIsEditModalOpen(open); }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Editar Empresa: {selectedEmpresa?.nome}</DialogTitle>
          </DialogHeader>
          <Form {...formEdit}>
              {/* @ts-ignore - Suprimir erro de tipo do handleSubmit */}
              <form onSubmit={formEdit.handleSubmit(handleEditEmpresa)} className="space-y-4">
                 {/* @ts-ignore - Suprimir erro de tipo do control */}
                 <EmpresaFormFields formControl={formEdit.control} />
                 {modalError && <p className='text-sm text-red-600 bg-red-50 p-3 rounded-md'>{modalError}</p>}
                 <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)} disabled={actionLoading}>Cancelar</Button>
                    <Button type="submit" disabled={actionLoading}>
                      {actionLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Salvando...</> : 'Salvar Alterações'}
                    </Button>
                 </DialogFooter>
              </form>
           </Form>
        </DialogContent>
      </Dialog>

       {/* Modal Deletar Empresa */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Remoção</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover a empresa "{selectedEmpresa?.nome}"?
              Grupos e usuários associados podem ser afetados (se houver dependência).
            </DialogDescription>
          </DialogHeader>
           {modalError && (
                 <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
                    {modalError}
                 </div>
            )}
           <DialogFooter>
             <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)} disabled={actionLoading}>Cancelar</Button>
             <Button variant="destructive" onClick={handleDeleteEmpresa} disabled={actionLoading}>
                {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Remover'}
             </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
} 