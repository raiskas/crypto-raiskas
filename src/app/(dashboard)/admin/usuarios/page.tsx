"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertCircle, CheckCircle } from "lucide-react";

// Importar os novos componentes
import UserSection from "./components/UserSection";
import GroupSection from "./components/GroupSection";

// Importar tipos compartilhados
import { User, Group, Empresa } from "@/types/admin";

// REMOVER definições locais de User e Group
// interface User { ... }
// interface Group { ... }

// REMOVER Schemas Zod daqui - Eles pertencem aos componentes filhos
// const createUserSchema = ...
// const changePasswordSchema = ...
// const editUserSchema = ...
// const groupSchema = ...

export default function UserManagementPage() {
    // Estados para dados carregados e erro de carregamento inicial
    const [users, setUsers] = useState<User[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [empresas, setEmpresas] = useState<Empresa[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [loadingGroups, setLoadingGroups] = useState(true);
    const [loadingEmpresas, setLoadingEmpresas] = useState(true);
    const [initialLoadError, setInitialLoadError] = useState<string | null>(null);

    // Novos estados para feedback global de ações
    const [pageError, setPageError] = useState<string | null>(null);
    const [pageSuccess, setPageSuccess] = useState<string | null>(null);

    // REMOVER Estados de Modais, Seleção, Ações - Pertencem aos filhos
    // const [selectedUser, setSelectedUser] = useState<User | null>(null);
    // const [isCreateOpen, setIsCreateOpen] = useState(false);
    // ... outros estados de modais/ações ...
    // const [actionLoading, setActionLoading] = useState(false);
    // const [success, setSuccess] = useState<string | null>(null); 
    
    // REMOVER useRouter - Se necessário, pertence aos filhos
    // const router = useRouter();

    // REMOVER Definições de Forms - Pertencem aos filhos
    // const createForm = useForm(...);
    // const passwordForm = useForm(...);
    // const editForm = useForm(...);
    // const groupForm = useForm(...);

    // Funções de Carregamento (limpar erros/sucesso globais ao recarregar)
    const loadUsers = useCallback(async () => {
        console.log("[UserManagementPage:loadUsers] Iniciando carregamento..."); // Log: Iniciando
        setLoadingUsers(true);
        setInitialLoadError(null);
        setPageError(null); // Limpar erros/sucesso globais
        setPageSuccess(null);
        try {
            const response = await fetch('/api/admin/users', { credentials: 'include' });
            const rawResponseText = await response.text(); // Ler como texto primeiro
            console.log("[UserManagementPage:loadUsers] Resposta bruta da API:", rawResponseText); // Log: Resposta bruta
            
            const data = JSON.parse(rawResponseText); // Fazer parse do JSON
            if (!response.ok) {
                console.error("[UserManagementPage:loadUsers] Erro na resposta da API:", data.error || response.statusText);
                throw new Error(data.error || `Erro ${response.status} ao carregar usuários`);
            }
            
            const usersData = data.users || [];
            console.log("[UserManagementPage:loadUsers] Dados de usuários recebidos:", usersData); // Log: Dados recebidos
            setUsers(usersData);
            console.log("[UserManagementPage:loadUsers] Estado 'users' atualizado."); // Log: Estado atualizado
        } catch (err: any) {
            console.error("[UserManagementPage:loadUsers] Erro durante fetch/processamento:", err);
            setInitialLoadError(`Erro ao carregar usuários: ${err.message}`);
        } finally {
            setLoadingUsers(false);
            console.log("[UserManagementPage:loadUsers] Carregamento finalizado."); // Log: Finalizado
        }
    }, []);

    const loadGroups = useCallback(async () => {
        setLoadingGroups(true);
        // Não limpar initialLoadError aqui intencionalmente
        setPageError(null); // Limpar erros/sucesso globais
        setPageSuccess(null);
        try {
            const response = await fetch('/api/admin/groups', { credentials: 'include' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Erro ao carregar grupos");
            setGroups(data.groups || []);
        } catch (err: any) {
            console.error("Erro ao carregar grupos:", err);
            setInitialLoadError(prevError => prevError ? `${prevError}\nErro ao carregar grupos: ${err.message}` : `Erro ao carregar grupos: ${err.message}`);
        } finally {
            setLoadingGroups(false);
        }
    }, []);

    // Nova função para carregar empresas
    const loadEmpresas = useCallback(async () => {
        setLoadingEmpresas(true);
        setPageError(null);
        setPageSuccess(null);
        try {
            const response = await fetch('/api/admin/empresas', { credentials: 'include' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Erro ao carregar empresas");
            setEmpresas(data.empresas || []);
        } catch (err: any) {
            console.error("Erro ao carregar empresas:", err);
            setInitialLoadError(prevError => prevError ? `${prevError}\nErro ao carregar empresas: ${err.message}` : `Erro ao carregar empresas: ${err.message}`);
        } finally {
            setLoadingEmpresas(false);
        }
    }, []);

    // Carregar dados na inicialização
    useEffect(() => {
        loadUsers();
        loadGroups();
        loadEmpresas();
    }, [loadUsers, loadGroups, loadEmpresas]);

    // REMOVER TODOS OS HANDLERS (handleCreateUser, handleEditUser, etc.) - Pertencem aos filhos
    // const handleCreateUser = async (...) => { ... };
    // const handleChangePassword = async (...) => { ... };
    // ... outros handlers ...
    // const handleGroupSubmit = async (...) => { ... };
    // const handleDeleteGroup = async (...) => { ... };

    // REMOVER Funções de Abrir Modais - Pertencem aos filhos
    // const openPasswordModal = (...) => { ... };
    // ... outras funções de abrir modais ...

    // REMOVER formatDate - Se usada, pertence aos filhos ou a utils
    // const formatDate = (...) => { ... };

    // --- Renderização --- 
    return (
        <div className="w-full px-4 pt-4 space-y-3"> {/* Container para mensagens - MANTIDO pt-4 */}
            {/* Mensagens de sucesso/erro */}
            {initialLoadError && (
                <div className="bg-destructive/15 text-destructive flex items-start p-3 rounded-md whitespace-pre-line">
                    <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0 mt-1" />
                    <span className="text-sm">{initialLoadError}</span>
                </div>
            )}
            {pageError && (
                <div className="bg-destructive/15 text-destructive flex items-start p-3 rounded-md whitespace-pre-line">
                    <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0 mt-1" />
                    <span className="text-sm">{pageError}</span>
                </div>
            )}
            {pageSuccess && (
                 <div className="bg-green-100 text-green-700 flex items-start p-3 rounded-md whitespace-pre-line">
                     <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0 mt-1" />
                     <span className="text-sm">{pageSuccess}</span>
                </div>
            )}

            <UserSection 
                initialUsers={users} 
                groups={groups} 
                empresas={empresas}
                loadUsers={loadUsers} 
                loadGroups={loadGroups}
                loadingUsers={loadingUsers} 
                loadingGroups={loadingGroups}
                loadingEmpresas={loadingEmpresas}
                // Passar setters para feedback global
                setPageError={setPageError}
                setPageSuccess={setPageSuccess}
            />
            
            <GroupSection 
                initialGroups={groups}
                loadUsers={loadUsers}
                loadGroups={loadGroups}
                loadingGroups={loadingGroups}
                empresas={empresas}
                loadingEmpresas={loadingEmpresas}
                isMaster={true}
                setPageError={setPageError}
                setPageSuccess={setPageSuccess}
            />
        </div>
    );
} 