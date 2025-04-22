"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation"; // Keep if needed for user actions
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  AlertCircle,
  CheckCircle,
  Edit,
  Key,
  Loader2,
  UserPlus,
  Users,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import React from 'react'; // Importar React para Dispatch/SetStateAction
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Importar Select
import { Separator } from "@/components/ui/separator"; // Descomentar importação
import { Checkbox } from "@/components/ui/checkbox"; // Adicionar importação Checkbox
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"; // Descomentado
import { useForm } from "react-hook-form"; // Descomentado
import { z } from "zod"; // Descomentado
import { zodResolver } from "@hookform/resolvers/zod"; // Descomentado
import { Switch } from "@/components/ui/switch"; // Adicionar importação Switch
import { supabase } from '@/lib/supabase/auth';
import { toast } from 'react-hot-toast';
import { Toaster } from 'react-hot-toast';
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Badge } from "@/components/ui/badge";

// Importar tipos compartilhados
import { User, Group, Empresa } from "@/types/admin"; 
// Importar utilitário compartilhado
import { formatDate } from "@/lib/utils"; 

// Descomentar Schemas
const createUserSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres'),
  name: z.string().min(3, 'O nome deve ter no mínimo 3 caracteres')
});
const changePasswordSchema = z.object({
  newPassword: z.string().min(6, "Nova senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});
const editUserSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  empresa_id: z.string().uuid("Selecione uma empresa"),
  grupo_id: z.string().uuid("Selecione um grupo").nullable(),
  ativo: z.boolean(),
  is_master: z.boolean(),
});

// --- Component Props (Adicionar setters) ---
interface UserSectionProps {
  initialUsers: User[];
  groups: Group[]; // Grupos para o dropdown
  empresas: Empresa[]; // Empresas para o dropdown
  loadUsers: () => Promise<void>; // Function to reload users
  loadGroups: () => Promise<void>; // Function to reload groups (if user actions affect them)
  loadingUsers: boolean; // Loading state from parent
  loadingGroups: boolean; // Para desabilitar dropdown de grupo
  loadingEmpresas: boolean; // Para desabilitar dropdown de empresa
  setPageError: React.Dispatch<React.SetStateAction<string | null>>; // Prop para erro global
  setPageSuccess: React.Dispatch<React.SetStateAction<string | null>>; // Prop para sucesso global
}

// --- User Section Component ---
export default function UserSection({
  initialUsers,
  groups,
  empresas,
  loadUsers,
  loadGroups,
  loadingUsers,
  loadingGroups,
  loadingEmpresas,
  setPageError,   // Receber prop
  setPageSuccess  // Receber prop
}: UserSectionProps) {
  // States specific to User Management
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [isDeleteUserOpen, setIsDeleteUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);

  // State for actions within this section
  const [actionLoading, setActionLoading] = useState(false);
  const [modalError, setModalError] = useState<string>('');
  
  const router = useRouter(); // Keep if needed

  // State for password change
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState<string | null>(null);

  // Update local users state if initialUsers prop changes
  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  // AJUSTAR SCHEMA para criar usuário - PRECISA DA EMPRESA!
  const createUserFormSchema = z.object({
    nome: z.string().min(3, 'O nome deve ter no mínimo 3 caracteres'),
    email: z.string().email('Email inválido'),
    password: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres'),
    empresa_id: z.string().uuid('Selecione uma empresa válida'),
    grupo_id: z.string().uuid('Selecione um grupo válido'),
  });

  // --- Forms ---
  type CreateUserFormData = z.infer<typeof createUserFormSchema>;
  const createUserForm = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserFormSchema),
    defaultValues: {
      nome: '',
      email: '',
      password: '',
      empresa_id: '',
      grupo_id: '',
    }
  });

  type EditUserFormData = z.infer<typeof editUserSchema>;
  const editForm = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      nome: '',
      email: '',
      empresa_id: '',
      grupo_id: null,
      ativo: true,
      is_master: false,
    },
  });

  type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
  const passwordForm = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  // --- Handlers ---
  const handleCreateUser = async (data: CreateUserFormData) => {
    const logPrefix = "[UserSection handleCreateUser]";
    setActionLoading(true);
    setModalError('');
    setPageError(null); // Limpar erro global
    setPageSuccess(null); // Limpar sucesso global

    // Payload para a API correta (/api/admin/users)
    const payload = {
      nome: data.nome,
      email: data.email,
      password: data.password,
      empresa_id: data.empresa_id,
      grupo_id: data.grupo_id,
    };

    console.log(`${logPrefix} Tentando criar usuário. Chamando POST /api/admin/users com payload:`, payload);

    try {
      // *** CHAMADA CORRIGIDA PARA /api/admin/users ***
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      // Log da resposta bruta
      const responseText = await response.text();
      console.log(`${logPrefix} Resposta da API status: ${response.status}, body: ${responseText}`);

      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        console.error(`${logPrefix} Erro ao fazer parse do JSON da resposta:`, e);
        // Se não for JSON, considerar o texto como erro (ou um erro genérico)
        throw new Error(response.ok ? "Resposta inesperada do servidor (não JSON)" : responseText || `Erro ${response.status} do servidor`);
      }
      
      console.log(`${logPrefix} Resposta da API (JSON parseado):`, responseData);

      if (!response.ok) {
        console.error(`${logPrefix} Erro na resposta da API (status ${response.status}):`, responseData);
        // Usar a mensagem de erro da API, se disponível
        throw new Error(responseData.error || responseData.message || 'Erro desconhecido ao criar usuário');
      }

      setPageSuccess(responseData.message || 'Usuário criado com sucesso!'); // Usar feedback global
      setIsCreateUserOpen(false);
      await loadUsers(); // Recarrega a lista de usuários
      createUserForm.reset();

    } catch (error: any) {
      console.error(`${logPrefix} Erro ao criar usuário (catch):`, error);
      // Exibir erro no modal e também globalmente
      const errorMessage = error.message || 'Erro ao criar usuário. Tente novamente.';
      setModalError(errorMessage);
      setPageError(errorMessage);
      // toast.error(errorMessage); // Considerar usar toast global via page state
    } finally {
      setActionLoading(false);
      console.log(`${logPrefix} Finalizado.`);
    }
  };
  const handleEditUser = async (values: EditUserFormData) => {
    if (!selectedUser) return;
    setActionLoading(true); 
    setModalError(''); 
    setPageError(null); 
    setPageSuccess(null);
    
    const { empresa_id, grupo_id, ...restOfValues } = values;
    // Enviar grupo_id dentro de um array grupo_ids, como a API espera
    const payload = {
        id: selectedUser.id, // auth_id
        ...restOfValues,
        empresa_id,
        grupo_ids: grupo_id ? [grupo_id] : [] // Envia array com um ID ou vazio
    };
    console.log("Editando usuário com payload:", payload);
    try {
      const response = await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao atualizar usuário");
      setPageSuccess("Usuário atualizado com sucesso!"); // Feedback global
      setIsEditUserOpen(false);
      await loadUsers(); // Reload users
      await loadGroups(); // Reload groups
    } catch (err: any) { 
      setModalError(err.message || "Erro ao atualizar usuário"); // Erro no modal
      console.error("Erro:", err); 
    } finally { setActionLoading(false); }
  };
  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setActionLoading(true); 
    setModalError(''); 
    setPageError(null); 
    setPageSuccess(null);
    try {
      const response = await fetch(`/api/admin/users?id=${selectedUser.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao remover usuário");
      setPageSuccess("Usuário removido com sucesso!"); // Feedback global
      setIsDeleteUserOpen(false);
      await loadUsers(); // Reload users
      await loadGroups(); // Reload groups
    } catch (err: any) { 
      setModalError(err.message || "Erro ao remover usuário"); // Erro no modal
      console.error("Erro:", err); 
    } finally { setActionLoading(false); }
  };
  const handleChangePassword = async (values: ChangePasswordFormData) => {
    if (!selectedUser) return;
    setPasswordChangeLoading(true);
    setPasswordChangeError(null);
    setPasswordChangeSuccess(null);
    setModalError(''); // Limpar erro geral do modal se houver

    try {
      const payload = {
        id: selectedUser.id, // auth_id
        password: values.newPassword,
      };
      console.log("Alterando senha para usuário com payload:", { id: payload.id }); // Não logar senha

      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao alterar senha");
      }

      setPasswordChangeSuccess("Senha alterada com sucesso!");
      passwordForm.reset(); // Limpar campos de senha
      // Não fechar modal automaticamente, usuário pode querer fazer outras edições
      // setIsEditUserOpen(false); 

    } catch (err: any) {
      setPasswordChangeError(err.message || "Erro ao alterar senha");
      console.error("Erro ao alterar senha:", err);
    } finally {
      setPasswordChangeLoading(false);
    }
  };

  // Ajustar open modal para USAR forms (exceto senha)
  const openCreateUserModal = () => {
    setModalError('');
    createUserForm.reset(); // Resetar com valores padrão atualizados
    setIsCreateUserOpen(true);
  };

  const openEditUserModal = (user: User) => {
    setSelectedUser(user);
    setModalError('');
    setPasswordChangeError(null);
    setPasswordChangeSuccess(null);
    // @ts-ignore
    editForm.reset({
        nome: user.nome,
        email: user.email ?? '', 
        ativo: user.ativo,
        empresa_id: user.empresa_id || '',
        grupo_id: user.grupo_id || null,
        is_master: user.is_master,
    });
    passwordForm.reset({ newPassword: "", confirmPassword: "" }); // Descomentar reset do passwordForm
    setIsEditUserOpen(true);
  };

  const openDeleteUserModal = (user: User) => {
    setSelectedUser(user);
    setModalError('');
    setIsDeleteUserOpen(true);
  };

  // --- Renderização ---
  return (
    <div className="w-full px-4 py-10">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold flex items-center">
              <Users className="mr-2 h-6 w-6" />
              Gerenciamento de Usuários
            </CardTitle>
            <CardDescription>
              Gerencie usuários do sistema, senhas e permissões
            </CardDescription>
          </div>
          <Dialog open={isCreateUserOpen} onOpenChange={(open) => {
            if (!open) {
              createUserForm.reset();
              setModalError('');
            }
            setIsCreateUserOpen(open);
          }}>
            <DialogTrigger asChild>
              <Button onClick={openCreateUserModal}>
                <UserPlus className="mr-2 h-4 w-4" />
                Novo Usuário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Usuário</DialogTitle>
                <DialogDescription>Preencha os dados para criar um novo usuário.</DialogDescription>
              </DialogHeader>
              <Form {...createUserForm}>
                <form onSubmit={createUserForm.handleSubmit(handleCreateUser)} className="space-y-4">
                  <FormField
                    control={createUserForm.control}
                    name="nome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome *</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome Completo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createUserForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input placeholder="usuario@email.com" type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createUserForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Senha *</FormLabel>
                        <FormControl>
                          <Input placeholder="••••••••" type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createUserForm.control}
                    name="empresa_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Empresa *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value} // Usar defaultValue
                          disabled={loadingEmpresas}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={loadingEmpresas ? "Carregando..." : "Selecione uma empresa"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {!loadingEmpresas && empresas.map((empresa) => (
                              <SelectItem key={empresa.id} value={empresa.id}>
                                {empresa.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createUserForm.control}
                    name="grupo_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grupo</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={loadingGroups}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={loadingGroups ? "Carregando..." : "Selecione um grupo"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {!loadingGroups && groups.map((group) => (
                              <SelectItem key={String(group.id)} value={String(group.id)}>
                                {group.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {modalError && (
                    <div className="bg-destructive/15 text-destructive flex items-center p-3 rounded-md">
                      <AlertCircle className="h-4 w-4 mr-2" />
                      <span className="text-sm">{modalError}</span>
                    </div>
                  )}
                  <DialogFooter>
                    <Button type="submit" disabled={actionLoading}>
                      {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Criar Usuário
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent>
          {/* User Table */}
          {loadingUsers ? ( <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> )
           : users.length === 0 ? ( <div className="text-center py-8 text-muted-foreground">Nenhum usuário encontrado</div> )
           : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Grupo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>Último login</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.nome || "-"}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.empresa?.nome || "-"}</TableCell>
                      <TableCell>{user.grupo?.nome || "-"}</TableCell>
                      <TableCell>
                        <span className={`inline-flex px-2 py-1 text-xs rounded-full ${ user.ativo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700" }`}>
                          {user.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </TableCell>
                      <TableCell>{formatDate(user.criado_em)}</TableCell>
                      <TableCell>{formatDate(user.ultimo_login)}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <div className="flex items-center justify-end space-x-2">
                          <Button variant="ghost" size="icon" onClick={() => openEditUserModal(user)} title="Editar Usuário"> <Edit className="h-4 w-4" /> </Button>
                          <Button variant="destructive" size="icon" onClick={() => openDeleteUserModal(user)} title="Excluir Usuário"> <Trash2 className="h-4 w-4" /> </Button>
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

      {/* --- User Modals --- */}
      {/* Edit User Modal */}
      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col"> 
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <div className="flex-grow overflow-y-auto pr-6 space-y-4"> 
            {selectedUser && (
              <>
                <Form {...editForm}>
                  <form onSubmit={editForm.handleSubmit(handleEditUser)} className="space-y-4">
                    <FormField control={editForm.control} name="nome" render={({ field }) => ( <FormItem><FormLabel>Nome</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={editForm.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField
                        control={editForm.control}
                        name="empresa_id"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Empresa</FormLabel>
                            <Select
                                onValueChange={field.onChange}
                                value={field.value?.toString() ?? undefined} // Converter para string
                                disabled={loadingEmpresas}
                            >
                                <FormControl>
                                  {/* @ts-ignore */}
                                <SelectTrigger>
                                    {loadingEmpresas ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : field.value ? empresas.find(e => e.id === field.value)?.nome : "Selecione a empresa"}
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {empresas.map((empresa) => (
                                    <SelectItem key={empresa.id.toString()} value={empresa.id.toString()}> {/* Converter para string */}
                                        {empresa.nome}
                                    </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={editForm.control}
                        name="grupo_id"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Grupo</FormLabel>
                            <Select
                                onValueChange={field.onChange}
                                value={field.value?.toString() ?? undefined} // Converter para string
                                disabled={loadingGroups}
                            >
                                <FormControl>
                                  {/* @ts-ignore */}
                                <SelectTrigger>
                                    {loadingGroups ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : field.value ? groups.find(g => g.id === field.value)?.nome : "Selecione o grupo"}
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {groups.map((group) => (
                                    <SelectItem key={String(group.id)} value={String(group.id)}>
                                        {group.nome}
                                    </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={editForm.control}
                        name="is_master"
                        render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                            <FormLabel className="text-base">Usuário Master</FormLabel>
                            <FormDescription>
                                Permite acesso irrestrito a todas as empresas e funcionalidades.
                            </FormDescription>
                            </div>
                            <FormControl>
                            {/* @ts-ignore */}
                            <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                            </FormControl>
                        </FormItem>
                        )}
                    />
                    <FormField
                      control={editForm.control}
                      name="ativo"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Status</FormLabel>
                            <FormDescription>Define se o usuário está ativo ou inativo no sistema.</FormDescription>
                          </div>
                          <FormControl>
                            {/* @ts-ignore - Mantido para Switch */}
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <button type="submit" hidden disabled={actionLoading}></button>
                  </form>
                </Form>

                <Separator className="my-6" /> 
                <div>
                  <h3 className="text-lg font-medium mb-4">Alterar Senha</h3>
                  {passwordChangeError && ( <div className="bg-destructive/15 text-destructive flex items-center p-3 rounded-md mb-2"> <AlertCircle className="h-4 w-4 mr-2" /> <span className="text-sm">{passwordChangeError}</span> </div> )}
                  {passwordChangeSuccess && ( <div className="bg-green-100 text-green-700 flex items-center p-3 rounded-md mb-2"> <CheckCircle className="h-4 w-4 mr-2" /> <span className="text-sm">{passwordChangeSuccess}</span> </div> )}

                  <Form {...passwordForm}>
                    <form onSubmit={passwordForm.handleSubmit(handleChangePassword)} className="space-y-4">
                      <FormField
                        control={passwordForm.control}
                        name="newPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nova Senha</FormLabel>
                            <FormControl>
                              <PasswordInput placeholder="••••••••" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={passwordForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirmar Nova Senha</FormLabel>
                            <FormControl>
                              <PasswordInput placeholder="••••••••" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <DialogFooter>
                        <Button type="submit" disabled={passwordChangeLoading}>
                          {passwordChangeLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          <Key className="mr-2 h-4 w-4" /> Alterar Senha
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </div>
              </>
            )}
          </div> 

          <DialogFooter className="pt-4 border-t"> 
              {modalError && <p className="text-red-500 text-sm mr-auto">{modalError}</p>}
              <Button type="button" variant="outline" onClick={() => setIsEditUserOpen(false)} disabled={actionLoading}>Cancelar</Button>
              <Button type="submit" form="editUserForm" disabled={actionLoading}>
                {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar Alterações
              </Button>
           </DialogFooter> 

        </DialogContent>
      </Dialog>

      {/* Delete User Modal */}
      <Dialog open={isDeleteUserOpen} onOpenChange={setIsDeleteUserOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar Exclusão</DialogTitle><DialogDescription>Tem certeza que deseja remover o usuário {selectedUser?.nome || selectedUser?.email}? Esta ação não pode ser desfeita.</DialogDescription></DialogHeader>
           {modalError && ( <div className="bg-destructive/15 text-destructive flex items-center p-3 rounded-md mb-2"> <AlertCircle className="h-4 w-4 mr-2" /> <span className="text-sm">{modalError}</span> </div> )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteUserOpen(false)} disabled={actionLoading}>Cancelar</Button>
            {/* Garantir estrutura correta com fragmentos */} 
            <Button variant="destructive" onClick={handleDeleteUser} disabled={actionLoading}>
              {actionLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Removendo...</>
              ) : (
                <><Trash2 className="mr-2 h-4 w-4" /> Confirmar Exclusão</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 