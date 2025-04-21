"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
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
import { useAuth } from "@/lib/hooks/use-auth";
import { z as zod } from "zod";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { useUserData } from "@/lib/hooks/use-user-data";

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
  exchange: z.string().optional(),
  notas: z.string().nullable().optional()
});

type FormValues = z.infer<typeof formSchema>;

// Interface da operação retornada pela API
interface Operacao {
  id: string;
  moeda_id: string;
  simbolo: string;
  nome: string;
  tipo: "compra" | "venda";
  quantidade: number;
  preco_unitario: number;
  valor_total: number;
  taxa: number;
  data_operacao: string;
  exchange: string | null;
  notas: string | null;
  criado_em: string;
  atualizado_em: string;
}

// Formata a data para o formato do input date (YYYY-MM-DD)
const formatarDataFormulario = (dataString: string): string => {
  try {
    // A data pode vir em formato ISO completo, então precisamos extrair apenas a data
    const dataObj = new Date(dataString);
    return format(dataObj, 'yyyy-MM-dd');
  } catch (e) {
    console.error("[EditarOperacao] Erro ao formatar data:", e);
    return format(new Date(), 'yyyy-MM-dd');
  }
};

// Função para formatar valores monetários
const formatarValorMonetario = (valor: number): string => {
  // Se o valor for menor que 1, mostrar mais casas decimais
  if (valor < 1) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8
    }).format(valor);
  }
  
  // Para valores maiores que 1, manter 2 casas decimais
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(valor);
};

export default function EditarOperacaoPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { userData } = useUserData();
  
  const [loading, setLoading] = useState(true);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCoin, setSelectedCoin] = useState<Moeda | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Moeda[]>([]);
  const [searchingCoins, setSearchingCoins] = useState(false);
  const [operacao, setOperacao] = useState<Operacao | null>(null);

  // Inicialização do formulário
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
      exchange: undefined,
      notas: ""
    }
  });

  // Observar quantidade e preço unitário para calcular o valor total
  const quantidade = form.watch("quantidade");
  const precoUnitario = form.watch("preco_unitario");

  useEffect(() => {
    if (quantidade && precoUnitario) {
      const total = quantidade * precoUnitario;
      form.setValue("valor_total", total);
    }
  }, [quantidade, precoUnitario, form]);

  // Buscar dados da operação ao carregar a página
  useEffect(() => {
    const carregarOperacao = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log("[EditarOperacao] Buscando dados da operação:", id);
        
        const response = await fetch(`/api/crypto/operacoes?id=${id}`, {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Erro ao buscar dados da operação");
        }
        
        const data = await response.json();
        
        if (!data.operacao) {
          throw new Error("Operação não encontrada");
        }
        
        const operacaoData = data.operacao;
        setOperacao(operacaoData);
        
        // Formatar a data para o formato do input date
        const dataFormatada = formatarDataFormulario(operacaoData.data_operacao);
        
        // Preenche o formulário com os dados da operação
        form.setValue("moeda_id", operacaoData.moeda_id);
        form.setValue("simbolo", operacaoData.simbolo);
        form.setValue("nome", operacaoData.nome);
        form.setValue("tipo", operacaoData.tipo);
        form.setValue("quantidade", operacaoData.quantidade);
        form.setValue("preco_unitario", operacaoData.preco_unitario);
        form.setValue("valor_total", operacaoData.valor_total);
        form.setValue("data_operacao", dataFormatada);
        form.setValue("exchange", operacaoData.exchange || undefined);
        form.setValue("notas", operacaoData.notas || "");
        
        // Criar objeto para moeda selecionada
        setSelectedCoin({
          id: operacaoData.moeda_id,
          symbol: operacaoData.simbolo,
          name: operacaoData.nome,
          image: `https://cryptoicons.org/api/icon/${operacaoData.simbolo.toLowerCase()}/200`,
          current_price: operacaoData.preco_unitario
        });
        
      } catch (err) {
        console.error("[EditarOperacao] Erro ao carregar operação:", err);
        setError(err instanceof Error ? err.message : "Erro ao carregar dados da operação");
      } finally {
        setLoading(false);
      }
    };
    
    if (id) {
      carregarOperacao();
    }
  }, [id, form]);

  // Buscar moedas baseado na pesquisa
  const buscarMoedas = async () => {
    if (!searchQuery.trim()) return;
    setSearchingCoins(true);
    setSearchResults([]);
    setError(null);

    try {
      console.log("[EditarOperacao] Iniciando busca por moedas:", searchQuery);
      
      console.log("[EditarOperacao] Enviando requisição para API de listar moedas");
      const response = await fetch(`/api/crypto/listar-moedas?query=${encodeURIComponent(searchQuery)}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
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
        console.error("[EditarOperacao] Resposta da API não é um array:", data);
        throw new Error("Formato de resposta inesperado da API");
      }
      
      console.log(`[EditarOperacao] Moedas encontradas: ${data.length}`);
      
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
      console.error("[EditarOperacao] Erro ao buscar moedas:", err);
      setError(err instanceof Error ? err.message : "Não foi possível buscar moedas. Tente novamente.");
    } finally {
      setSearchingCoins(false);
    }
  };

  const selecionarMoeda = (moeda: Moeda) => {
    setSelectedCoin(moeda);
    form.setValue("moeda_id", moeda.id);
    form.setValue("simbolo", moeda.symbol);
    form.setValue("nome", moeda.name);
    form.setValue("preco_unitario", moeda.current_price);
    setSearchResults([]);
    setSearchQuery("");
  };

  const limparSelecao = () => {
    setSelectedCoin(null);
    form.setValue("moeda_id", "");
    form.setValue("simbolo", "");
    form.setValue("nome", "");
  };

  // Submeter o formulário
  const onSubmit = form.handleSubmit(async (values) => {
    // Verificar se uma moeda foi selecionada
    if (!values.moeda_id) {
      setError("Selecione uma criptomoeda antes de continuar");
      return;
    }
    
    setLoadingSubmit(true);
    setError(null);
    
    try {
      // Formatar a data no formato ISO 8601 completo
      const dataOperacao = values.data_operacao;
      const dataFormatada = `${dataOperacao}T00:00:00Z`;
      
      // Criar objeto com dados validados para enviar à API
      const dadosOperacao = {
        id: id,
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
        taxa: 0 // Adicionando taxa com valor padrão 0
      };
      
      console.log("[EditarOperacao] Enviando dados para atualização:", dadosOperacao);
      
      const response = await fetch("/api/crypto/operacoes", {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify(dadosOperacao)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao atualizar operação");
      }
      
      toast.success("Operação atualizada com sucesso!");
      router.push("/crypto");
    } catch (err) {
      console.error("[EditarOperacao] Erro ao atualizar operação:", err);
      const errorMessage = err instanceof Error ? err.message : "Erro ao atualizar operação";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoadingSubmit(false);
    }
  });

  // Renderização da linha de moeda
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
      <div>
        <div className="font-medium">{moeda.name}</div>
        <div className="text-sm text-muted-foreground">{moeda.symbol.toUpperCase()}</div>
      </div>
      <div className="ml-auto font-medium">
        {new Intl.NumberFormat('pt-BR', { 
          style: 'currency', 
          currency: 'USD'
        }).format(moeda.current_price)}
      </div>
    </div>
  );

  // Ajuste no onChange do preço unitário
  const handlePrecoUnitarioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value.replace(/[^0-9.]/g, '');
    const partes = valor.split('.');
    
    if (partes.length > 2) return;
    if (partes[1] && partes[1].length > 8) return;
    
    // Permitir números fracionados
    const numericValue = valor === '' ? 0 : parseFloat(valor);
    form.setValue('preco_unitario', numericValue);
    
    const quantidade = form.getValues('quantidade');
    const valorTotal = quantidade * numericValue;
    form.setValue('valor_total', valorTotal);
  };

  // Ajuste no onBlur do preço unitário
  const handlePrecoUnitarioBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const valor = e.target.value;
    if (valor) {
      const numericValue = parseFloat(valor.replace(/,/g, ''));
      form.setValue('preco_unitario', numericValue);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Editar Operação</h1>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : error ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-destructive">{error}</div>
          </CardContent>
        </Card>
      ) : (
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-6">
            {/* Campos escondidos com valores da moeda */}
            <input type="hidden" {...form.register("moeda_id")} />
            <input type="hidden" {...form.register("simbolo")} />
            <input type="hidden" {...form.register("nome")} />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Criptomoeda</Label>
                <div className="mt-2 p-3 border rounded-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="relative w-8 h-8">
                        <Image
                          src={selectedCoin?.image || `https://cryptoicons.org/api/icon/${selectedCoin?.symbol?.toLowerCase()}/200`}
                          alt={selectedCoin?.name || ''}
                          fill
                          className="object-contain"
                          onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            if (selectedCoin?.symbol) {
                              img.src = `https://cryptoicons.org/api/icon/${selectedCoin.symbol.toLowerCase()}/200`;
                            }
                          }}
                        />
                      </div>
                      <div>
                        <p className="font-semibold">{selectedCoin?.name}</p>
                        <p className="text-sm text-muted-foreground">{selectedCoin?.symbol?.toUpperCase()}</p>
                      </div>
                    </div>
                  </div>
                </div>
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

            <CardFooter className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loadingSubmit}>
                {loadingSubmit ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Atualizando...
                  </div>
                ) : (
                  "Atualizar Operação"
                )}
              </Button>
            </CardFooter>
          </form>
        </Form>
      )}
    </div>
  );
}