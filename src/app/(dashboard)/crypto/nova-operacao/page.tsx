"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Search } from "lucide-react";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { toast } from "sonner";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/config";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { getServerUser } from '@/lib/supabase/async-cookies';
import { useUserData } from "@/lib/hooks/use-user-data";
import { getSupabase } from "@/lib/supabase/client";

// Tipo para a moeda
interface Moeda {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
}

// Schema de validação para o formulário
const formSchema = z.object({
  moeda_id: z.string().min(1, { message: "Selecione uma moeda" }),
  simbolo: z.string().min(1, { message: "Símbolo é obrigatório" }),
  nome: z.string().min(1, { message: "Nome é obrigatório" }),
  tipo: z.enum(["compra", "venda"], { 
    required_error: "Selecione o tipo de operação" 
  }),
  quantidade: z.coerce.number().positive({ message: "Quantidade deve ser maior que zero" }),
  preco_unitario: z.coerce.number().positive({ message: "Preço unitário deve ser maior que zero" }),
  valor_total: z.coerce.number().min(0, { message: "Valor total não pode ser negativo" }),
  data_operacao: z.string().min(1, { message: "Data é obrigatória" }),
  exchange: z.string(),
  notas: z.string(),
  grupo_id: z.string().uuid("ID do Grupo inválido")
});

type FormValues = z.infer<typeof formSchema>;

// Função auxiliar para formatar valores monetários
const formatarValorMonetario = (valor: number) => {
  return valor.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
    useGrouping: true
  });
};

// Função auxiliar para normalizar entrada de valores monetários
const normalizarValorMonetario = (valor: string) => {
  // Remover caracteres não numéricos, exceto ponto e vírgula
  const filteredValue = valor.replace(/[^\d.,]/g, '');
  
  // Converter vírgula para ponto para processamento correto
  const normalizedValue = filteredValue.replace(',', '.');
  
  // Garantir apenas um ponto decimal
  const parts = normalizedValue.split('.');
  let processedValue = normalizedValue;
  if (parts.length > 2) {
    processedValue = parts[0] + '.' + parts.slice(1).join('');
  }
  
  return processedValue;
};

export default function NovaOperacaoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Moeda[]>([]);
  const [searchingCoins, setSearchingCoins] = useState(false);
  const [selectedCoin, setSelectedCoin] = useState<Moeda | null>(null);

  // Adicionar hook useUserData
  const { userData, loading: loadingUserData, error: errorUserData } = useUserData();

  // Inicializar o formulário
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      moeda_id: "",
      simbolo: "",
      nome: "",
      tipo: "compra",
      quantidade: 0,
      preco_unitario: 0,
      valor_total: 0,
      data_operacao: format(new Date(), 'yyyy-MM-dd'),
      exchange: "",
      notas: "",
      grupo_id: ""
    }
  });

  // Observar quantidade e preço unitário para calcular o valor total
  const quantidade = form.watch("quantidade");
  const precoUnitario = form.watch("preco_unitario");

  useEffect(() => {
    if (quantidade && precoUnitario) {
      // Garantir que os valores são números
      const qtd = Number(quantidade);
      const preco = Number(precoUnitario);
      
      // Calcular o total
      const total = qtd * preco;
      
      // Atualizar o valor no formulário
      form.setValue("valor_total", total);
    } else {
      form.setValue("valor_total", 0);
    }
  }, [quantidade, precoUnitario, form]);

  // Verificar autenticação ao carregar a página - simplificado para nunca redirecionar
  useEffect(() => {
    const init = async () => {
      try {
        console.log("[NovaCripto] Inicializando página...");
        
        // Verificar se a tabela existe e criar se necessário
        await verificarTabelaCryptoOperacoes();
        
      } catch (err) {
        console.error("[NovaCripto] Erro na inicialização:", err);
        setError("Ocorreu um erro ao inicializar. Por favor, recarregue a página.");
      }
    };
    
    init();
  }, []);
  
  // Verificar se a tabela crypto_operacoes existe e criar se necessário
  const verificarTabelaCryptoOperacoes = async () => {
    try {
      console.log("[NovaCripto] Verificando se a tabela crypto_operacoes existe");
      
      // Acessar o endpoint público para setup de banco de dados
      const setupResponse = await fetch("/api/admin/setup-database", {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      const setupResult = await setupResponse.json();
      console.log("[NovaCripto] Resultado da verificação da tabela:", setupResult);
      
      if (!setupResponse.ok) {
        console.warn("[NovaCripto] A tabela pode não existir:", setupResult.error);
      }
    } catch (err) {
      console.error("[NovaCripto] Erro ao verificar/criar tabela:", err);
    }
  };

  // Buscar moedas baseado na pesquisa
  const buscarMoedas = async () => {
    if (!searchQuery.trim()) return;
    setSearchingCoins(true);
    setSearchResults([]);
    setError(null);

    try {
      console.log("[NovaCripto] Iniciando busca por moedas:", searchQuery);
      
      // Remover verificação de autenticação, não é necessária
      
      console.log("[NovaCripto] Enviando requisição para API de listar moedas");
      const response = await fetch(`/api/crypto/listar-moedas?query=${encodeURIComponent(searchQuery)}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      console.log("[NovaCripto] Status da resposta:", response.status);
      
      // Tratar diferentes tipos de erros HTTP
      if (response.status === 429) {
        throw new Error("Limite de requisições excedido. Tente novamente em alguns minutos.");
      } else if (response.status === 503) {
        throw new Error("Serviço temporariamente indisponível. Tente novamente mais tarde.");
      } else if (response.status >= 500) {
        throw new Error("Erro no servidor. Tente novamente mais tarde.");
      } else if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || "Falha ao buscar moedas");
      }
      
      // Se chegou aqui, a resposta está OK
      const data = await response.json();
      
      // Verificar se a resposta é um array (esperado)
      if (!Array.isArray(data)) {
        console.error("[NovaCripto] Resposta da API não é um array:", data);
        throw new Error("Formato de resposta inesperado da API");
      }
      
      console.log(`[NovaCripto] Moedas encontradas: ${data.length}`);
      
      // Verificar a validade de cada imagem e aplicar uma URL de fallback se necessário
      const validatedData = data.map(moeda => {
        // Verificar se a URL da imagem é válida
        if (!moeda.image || moeda.image.includes('undefined')) {
          // URL fallback genérica para ícones de criptomoeda
          moeda.image = `https://cryptoicons.org/api/icon/${moeda.symbol.toLowerCase()}/200`;
        }
        return moeda;
      });
      
      setSearchResults(validatedData);
      
      if (validatedData.length === 0) {
        setError("Nenhuma moeda encontrada com este termo. Tente outro nome ou símbolo.");
      }
    } catch (err) {
      console.error("[NovaCripto] Erro ao buscar moedas:", err);
      setError(err instanceof Error ? err.message : "Não foi possível buscar moedas. Tente novamente.");
    } finally {
      setSearchingCoins(false);
    }
  };

  // Implementar debounce para busca automática
  useEffect(() => {
    // Só buscar se tiver pelo menos 2 caracteres
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    
    // Definir um timer para buscar após 500ms sem digitação
    const timer = setTimeout(() => {
      console.log("[NovaCripto] Iniciando busca automática após debounce");
      buscarMoedas();
    }, 500);
    
    // Limpar o timer se o searchQuery mudar antes do timeout
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const selecionarMoeda = (moeda: Moeda) => {
    setSelectedCoin(moeda);
    form.setValue("moeda_id", moeda.id);
    form.setValue("simbolo", moeda.symbol.toUpperCase());
    form.setValue("nome", moeda.name);
    
    // Não definir preço unitário automaticamente, deixar usuário informar
    // Resetar para zero ou vazio
    form.setValue("preco_unitario", 0);
    
    setSearchResults([]);
    setSearchQuery("");
  };

  const limparSelecao = () => {
    setSelectedCoin(null);
    form.setValue("moeda_id", "");
    form.setValue("simbolo", "");
    form.setValue("nome", "");
  };

  // Função para buscar o grupo_id do usuário
  const fetchUserGroup = async (userId: string): Promise<string | null> => {
    try {
      const supabase = getSupabase(); // Reutilizar cliente Supabase
      const { data, error } = await supabase
        .from('usuarios_grupos')
        .select('grupo_id')
        .eq('usuario_id', userId)
        .limit(1) // Assumir que queremos o primeiro grupo encontrado
        .single();

      if (error) {
        console.error("[NovaCripto] Erro ao buscar grupo do usuário:", error);
        // Tratar erro 'PGRST116' (zero rows) como grupo não encontrado
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error; 
      }
      
      return data?.grupo_id || null;
    } catch (err) {
      console.error("[NovaCripto] Falha geral ao buscar grupo:", err);
      setError("Falha ao buscar informações do grupo do usuário.");
      return null;
    }
  };

  // Efeito para buscar e definir o grupo_id quando userData estiver disponível
  useEffect(() => {
    const setGroup = async () => {
      if (userData?.id) {
        const groupId = await fetchUserGroup(userData.id);
        if (groupId) {
          form.setValue("grupo_id", groupId);
        } else {
          console.warn("[NovaCripto] Nenhum grupo encontrado para o usuário", userData.id);
          setError("Usuário não associado a um grupo. Não é possível registrar operações.");
          // Opcional: desabilitar o form ou botão aqui se grupo for obrigatório
        }
      }
    };
    setGroup();
  }, [userData, form]); // Depender de userData e form

  // Submeter o formulário
  const onSubmit = async (values: FormValues) => {
    console.log("[NovaCripto] onSubmit chamado!");
    console.log("[NovaCripto] Dados do formulário:", values);
    
    // Verificar se uma moeda foi selecionada
    if (!values.moeda_id) {
      setError("Selecione uma criptomoeda antes de continuar");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Verificar se grupo_id está nos values (deve estar agora)
      if (!values.grupo_id) {
        throw new Error("ID do Grupo não definido no formulário. Verifique as permissões ou associação de grupo.");
      }
      
      // Formatar a data no formato ISO 8601 completo
      const dataOperacao = values.data_operacao;
      const dataFormatada = `${dataOperacao}T00:00:00Z`;
      
      // Criar objeto com dados validados para enviar à API
      const dadosOperacao = {
        moeda_id: values.moeda_id,
        simbolo: values.simbolo,
        nome: values.nome,
        tipo: values.tipo,
        quantidade: Number(values.quantidade),
        preco_unitario: Number(values.preco_unitario),
        valor_total: Number(values.valor_total),
        data_operacao: dataFormatada,
        exchange: values.exchange || null,
        notas: values.notas || null,
        grupo_id: values.grupo_id
      };
      
      console.log("[NovaCripto] Enviando dados para API:", dadosOperacao);
      
      const response = await fetch("/api/crypto/operacoes", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify(dadosOperacao)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("[NovaCripto] Erro da API:", errorData);
        throw new Error(errorData.error || "Erro ao registrar operação");
      }
      
      toast.success("Operação registrada com sucesso!");
      router.push("/crypto");
    } catch (err) {
      console.error("[NovaCripto] Erro ao submeter operação:", err);
      const errorMessage = err instanceof Error ? err.message : "Erro desconhecido";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Função para lidar com erros de validação
  const onValidationErrors = (errors: any) => {
    console.error("[NovaCripto] Erros de validação do formulário:", errors);
    setError("Por favor, corrija os erros no formulário.");
  };

  // Renderização da linha de moeda (extraído para melhorar a legibilidade)
  const renderMoedaItem = (moeda: Moeda) => (
    <div 
      key={moeda.id} 
      className="p-3 hover:bg-muted flex items-center gap-3 cursor-pointer"
      onClick={() => selecionarMoeda(moeda)}
    >
      {moeda.image ? (
        <Image 
          src={moeda.image} 
          alt={moeda.name} 
          width={24}
          height={24}
          className="rounded-full"
          onError={(e) => {
            // Se a imagem falhar, usar uma imagem genérica
            const target = e.target as HTMLImageElement;
            target.onerror = null; // Evitar loop infinito
            target.src = `https://cryptoicons.org/api/icon/${moeda.symbol.toLowerCase()}/200`;
          }}
        />
      ) : (
        <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
          {moeda.symbol.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="flex-1">
        <div className="font-medium">{moeda.name}</div>
        <div className="text-sm text-muted-foreground">{moeda.symbol.toUpperCase()}</div>
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-4xl px-4 py-10">
      <div className="flex items-center gap-4 mb-6">
        <Button 
          variant="ghost" 
          className="flex items-center gap-2" 
          onClick={() => router.push("/crypto")}
        >
          <ArrowLeft size={16} />
          Voltar para listagem
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Nova Operação de Criptomoeda</CardTitle>
          <CardDescription>
            Registre uma nova operação de compra ou venda de criptomoedas em sua carteira
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 mb-6 rounded-md">
              {error}
            </div>
          )}
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, onValidationErrors)} className="space-y-6">
              {/* Campos escondidos com valores da moeda */}
              <input type="hidden" {...form.register("moeda_id")} />
              <input type="hidden" {...form.register("simbolo")} />
              <input type="hidden" {...form.register("nome")} />
              <input type="hidden" {...form.register("grupo_id")} />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Criptomoeda</Label>
                  {!selectedCoin ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="relative w-full">
                          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="text"
                            placeholder="Digite para buscar por nome ou símbolo..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8"
                          />
                          {searchingCoins && <p className="text-xs text-muted-foreground mt-1">Buscando moedas...</p>}
                        </div>
                      </div>
                      
                      {error && (
                        <p className="text-sm text-destructive">{error}</p>
                      )}
                      
                      {searchResults.length > 0 && (
                        <div className="mt-2">
                          <p className="text-sm text-muted-foreground mb-2">Resultados da pesquisa:</p>
                          <div className="max-h-[200px] overflow-y-auto border rounded-md divide-y">
                            {searchResults.map((moeda) => renderMoedaItem(moeda))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2 p-3 border rounded-md">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="relative w-8 h-8">
                            <Image
                              src={selectedCoin.image}
                              alt={selectedCoin.name}
                              fill
                              className="object-contain"
                              onError={(e) => {
                                const img = e.target as HTMLImageElement;
                                img.src = `https://cryptoicons.org/api/icon/${selectedCoin.symbol.toLowerCase()}/200`;
                              }}
                            />
                          </div>
                          <div>
                            <p className="font-semibold">{selectedCoin.name}</p>
                            <p className="text-sm text-muted-foreground">{selectedCoin.symbol.toUpperCase()}</p>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={limparSelecao}
                        >
                          Alterar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="tipo"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Tipo de Operação</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="compra" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Compra
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="venda" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Venda
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="quantidade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantidade</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="any"
                          placeholder="0.00000000" 
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="preco_unitario"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preço Unitário (USD)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="any"
                          placeholder="0.00" 
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="valor_total"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor Total (USD)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="any"
                          placeholder="0.00" 
                          {...field}
                          readOnly
                        />
                      </FormControl>
                      <FormDescription>
                        Calculado automaticamente (quantidade × preço)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="data_operacao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data da Operação</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="exchange"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Exchange (opcional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Binance, Coinbase, etc." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="notas"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas (opcional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Adicione observações sobre esta operação..." 
                        className="resize-none" 
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-between mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/crypto")}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit"
                  disabled={loading || !selectedCoin}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Registrando...
                    </div>
                  ) : (
                    "Registrar Operação"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
        
        <CardFooter>
          {/* Footer vazio - botões movidos para dentro do form */}
        </CardFooter>
      </Card>
    </div>
  );
} 