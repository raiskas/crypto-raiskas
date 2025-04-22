"use client"; // Formulário interativo, precisa ser client component

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Image from "next/image";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Search, Loader2, CalendarIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

// --- Tipos ---
interface Moeda {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
}

// Interface da operação para initialData (simplificada, pode ajustar se necessário)
interface OperacaoData {
  id?: string; // ID só existe na edição
  moeda_id: string;
  simbolo: string;
  nome: string;
  tipo: "compra" | "venda";
  quantidade: number;
  preco_unitario: number;
  valor_total: number;
  data_operacao: string | Date; // Aceitar string ou Date
  exchange: string | null;
  notas: string | null;
  grupo_id?: string; // Adicionado grupo_id
  image?: string; // Adicionado para receber a URL da imagem
}

// Schema de validação Zod (unificado)
export const formSchema = z.object({
  moeda_id: z.string().min(1, { message: "Selecione uma moeda" }),
  simbolo: z.string().min(1, { message: "Símbolo é obrigatório" }),
  nome: z.string().min(1, { message: "Nome é obrigatório" }),
  tipo: z.enum(["compra", "venda"], { required_error: "Selecione o tipo de operação" }),
  quantidade: z.coerce.number().positive({ message: "Quantidade deve ser maior que zero" }),
  preco_unitario: z.coerce.number().positive({ message: "Preço unitário deve ser maior que zero" }),
  valor_total: z.coerce.number().min(0, { message: "Valor total não pode ser negativo" }),
  data_operacao: z.string({
    required_error: "Data da operação é obrigatória.",
  }).min(1, { message: "Data é obrigatória" }), // Manter como string YYYY-MM-DD
  exchange: z.string().nullable().optional(), // Tornar opcional e permitir null
  notas: z.string().nullable().optional(),
  grupo_id: z.string().uuid("ID do Grupo inválido").optional().nullable(), // Tornar opcional aqui também
});

type FormValues = z.infer<typeof formSchema>;

// --- Props do Componente ---
interface OperacaoFormProps {
  initialData?: OperacaoData | null; // Dados para edição (opcional)
  onSubmit: (values: FormValues) => Promise<void>; // Função de submit do pai
  isLoading: boolean; // Estado de loading do pai
  userId?: string; // Passar ID do usuário se necessário para grupo
  grupoIdUsuario?: string | null; // Passar grupo_id do usuário
}

// --- Componente ---
export const OperacaoForm: React.FC<OperacaoFormProps> = ({
  initialData,
  onSubmit,
  isLoading,
  userId,
  grupoIdUsuario
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Moeda[]>([]);
  const [searchingCoins, setSearchingCoins] = useState(false);
  const [coinSearchError, setCoinSearchError] = useState<string | null>(null);
  const [selectedCoin, setSelectedCoin] = useState<Moeda | null>(null);
  const isEditing = !!initialData;

  // Renomeado para clareza
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [displayValue, setDisplayValue] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData ? {
          ...initialData,
          // Lógica revisada para data_operacao
          data_operacao: initialData.data_operacao instanceof Date
            ? format(initialData.data_operacao, 'yyyy-MM-dd') // Se já for Date
            : initialData.data_operacao // Se for string, usar diretamente (assumindo YYYY-MM-DD ou ISO)
              ? format(new Date(`${String(initialData.data_operacao).substring(0, 10)}T00:00:00`), 'yyyy-MM-dd') // Tenta formatar YYYY-MM-DD/ISO
              : format(new Date(), 'yyyy-MM-dd'), // Fallback SÓ se initialData.data_operacao for nulo/vazio
          exchange: initialData.exchange ?? "",
          notas: initialData.notas ?? "",
          grupo_id: initialData.grupo_id ?? grupoIdUsuario ?? undefined,
      } : {
          moeda_id: "",
          simbolo: "",
          nome: "",
          tipo: "compra",
          quantidade: 0,
          preco_unitario: 0,
          valor_total: 0,
          data_operacao: format(new Date(), 'yyyy-MM-dd'), // Default para criação continua o mesmo
          exchange: "",
          notas: "",
          grupo_id: grupoIdUsuario ?? undefined, 
      },
  });

  // Sincroniza displayValue (dd/MM/yyyy) com o valor do form (yyyy-MM-dd)
  const formDataOperacao = form.watch('data_operacao');
  useEffect(() => {
    const date = formDataOperacao ? new Date(`${formDataOperacao}T00:00:00`) : null;
    const formatted = date && !isNaN(date.getTime()) ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : '';
    // Só atualiza o display se for diferente, evitando loops
    if (formatted !== displayValue) {
      setDisplayValue(formatted);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formDataOperacao]); // Reage à mudança no valor do form

  // Efeito para definir a moeda selecionada inicial (modo edição)
  useEffect(() => {
    if (isEditing && initialData) {
      // Remover logs de depuração
      // const imageUrl = `https://cryptoicons.org/api/icon/${initialData.simbolo.toLowerCase()}/200`;

      setSelectedCoin({
        id: initialData.moeda_id,
        symbol: initialData.simbolo,
        name: initialData.nome,
        // Prioriza a imagem passada via initialData, usa cryptoicons como fallback
        image: initialData.image || `https://cryptoicons.org/api/icon/${initialData.simbolo.toLowerCase()}/200`,
        current_price: initialData.preco_unitario // Usar preço da operação como referência inicial
      });
      // Definir grupo_id vindo de initialData se existir
      if (initialData.grupo_id) {
          form.setValue("grupo_id", initialData.grupo_id);
      } else if (grupoIdUsuario) { // Senão, tentar usar o grupo do usuário
          form.setValue("grupo_id", grupoIdUsuario);
      }

    } else if (!isEditing && grupoIdUsuario) {
        // Modo criação: definir grupo_id padrão se disponível
        form.setValue("grupo_id", grupoIdUsuario);
    }
  }, [isEditing, initialData, form, grupoIdUsuario]); // Adicionar grupoIdUsuario como dependência


  // Cálculo do valor total
  const quantidade = form.watch("quantidade");
  const precoUnitario = form.watch("preco_unitario");
  useEffect(() => {
    const qtd = Number(quantidade);
    const preco = Number(precoUnitario);
    if (!isNaN(qtd) && !isNaN(preco)) {
      form.setValue("valor_total", qtd * preco);
    } else {
      form.setValue("valor_total", 0);
    }
  }, [quantidade, precoUnitario, form]);

  // --- Funções de Busca de Moeda ---
  const buscarMoedasAPI = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setSearchingCoins(true);
    setSearchResults([]);
    setCoinSearchError(null);
    try {
      const response = await fetch(`/api/crypto/listar-moedas?query=${encodeURIComponent(query)}`, {
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({})); // Tentar pegar erro do JSON
        throw new Error(data?.error || `Erro ${response.status} ao buscar moedas`);
      }
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("Resposta inválida da API");

      const validatedData = data.map(moeda => ({
        ...moeda,
        image: (moeda.image && !moeda.image.includes('undefined'))
          ? moeda.image
          : `https://cryptoicons.org/api/icon/${moeda.symbol.toLowerCase()}/200`
      }));

      setSearchResults(validatedData);
      if (validatedData.length === 0) {
        setCoinSearchError("Nenhuma moeda encontrada.");
      }
    } catch (err) {
      console.error("[OperacaoForm] Erro ao buscar moedas:", err);
      setCoinSearchError(err instanceof Error ? err.message : "Erro ao buscar moedas.");
    } finally {
      setSearchingCoins(false);
    }
  }, []);

  // Debounce para busca
  useEffect(() => {
    if (isEditing) return; // Não buscar automaticamente na edição
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setCoinSearchError(null);
      return;
    }
    const timer = setTimeout(() => buscarMoedasAPI(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery, isEditing, buscarMoedasAPI]);

  const selecionarMoeda = (moeda: Moeda) => {
    setSelectedCoin(moeda);
    form.setValue("moeda_id", moeda.id);
    form.setValue("simbolo", moeda.symbol.toUpperCase());
    form.setValue("nome", moeda.name);
    // Não preenchemos preço automaticamente, usuário deve informar
    form.setValue("preco_unitario", 0);
    setSearchResults([]);
    setSearchQuery("");
    setCoinSearchError(null);
     // Limpar erro do campo moeda_id ao selecionar
    form.clearErrors("moeda_id");
  };

  const limparSelecao = () => {
    setSelectedCoin(null);
    form.resetField("moeda_id");
    form.resetField("simbolo");
    form.resetField("nome");
    form.resetField("preco_unitario");
    form.resetField("quantidade"); // Resetar quantidade e preço também faz sentido
    form.resetField("valor_total");
  };

  // --- Submit Handler ---
  const handleFormSubmit = (values: FormValues) => {
    // Verificar se grupo_id está presente ANTES de chamar o onSubmit do pai
    // (a menos que a lógica de grupo seja opcional globalmente)
    if (!values.grupo_id) {
      form.setError("grupo_id", { message: "Grupo é necessário para salvar." });
      console.error("Tentativa de submit sem grupo_id:", values);
      return; // Impede o submit
    }
    console.log("Formulário válido, chamando onSubmit do pai com:", values);
    onSubmit(values); // Chama a função passada pelo componente pai
  };

  // Renderização da linha de moeda
  const renderMoedaItem = (moeda: Moeda) => (
    <div key={moeda.id} className="p-3 hover:bg-muted flex items-center gap-3 cursor-pointer" onClick={() => selecionarMoeda(moeda)}>
      {moeda.image ? (
        <Image src={moeda.image} alt={moeda.name} width={24} height={24} className="rounded-full" onError={(e) => { e.currentTarget.src = `https://cryptoicons.org/api/icon/${moeda.symbol.toLowerCase()}/200`; }}/>
      ) : (
        <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">{moeda.symbol.charAt(0).toUpperCase()}</div>
      )}
      <div className="flex-1"><div className="font-medium">{moeda.name}</div><div className="text-sm text-muted-foreground">{moeda.symbol.toUpperCase()}</div></div>
    </div>
  );

  // --- JSX ---
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
        {/* Campos escondidos com valores da moeda */}
        <input type="hidden" {...form.register("moeda_id")} />
        <input type="hidden" {...form.register("simbolo")} />
        <input type="hidden" {...form.register("nome")} />
        {/* Campo grupo_id agora é gerenciado pelo form state, não precisa ser hidden */}
        {/* <input type="hidden" {...form.register("grupo_id")} /> */}

        {/* --- Seleção de Moeda (Condicional) --- */}
        <FormField
          control={form.control}
          name="moeda_id" // Associar ao campo do schema para validação
          render={({ fieldState }) => ( // Usar fieldState para exibir a mensagem de erro
            <FormItem>
              <FormLabel>Criptomoeda</FormLabel>
              {!selectedCoin ? (
                <div className="space-y-2 mt-1">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input type="text" placeholder="Buscar por nome ou símbolo..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8" disabled={isEditing}/>
                    {searchingCoins && <p className="text-xs text-muted-foreground mt-1">Buscando...</p>}
                  </div>
                  {coinSearchError && <p className="text-sm text-destructive">{coinSearchError}</p>}
                  {searchResults.length > 0 && (
                    <div className="mt-2 max-h-[200px] overflow-y-auto border rounded-md divide-y">
                      {searchResults.map(renderMoedaItem)}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-1 p-3 border rounded-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="relative w-8 h-8">
                        <Image
                          // Usar a imagem do estado selectedCoin (que já tem o fallback)
                          src={selectedCoin.image}
                          alt={selectedCoin.name}
                          fill
                          className="object-contain"
                          // Remover log do onError
                          onError={(e) => { 
                            // console.log('[OperacaoForm Edit Mode] Image onError triggered! Trying fallback.');
                            const target = e.target as HTMLImageElement; 
                            target.onerror = null; // Previne loop se o fallback falhar
                            target.src = '/placeholder-coin.png'; 
                          }}
                        />
                      </div>
                      <div><p className="font-semibold">{selectedCoin.name}</p><p className="text-sm text-muted-foreground">{selectedCoin.symbol.toUpperCase()}</p></div>
                    </div>
                    {!isEditing && <Button type="button" variant="ghost" size="sm" onClick={limparSelecao}>Alterar</Button>}
                  </div>
                </div>
              )}
              {/* Exibe a mensagem de erro do Zod aqui */}
              <FormMessage>{fieldState.error?.message}</FormMessage>
            </FormItem>
          )}
        />


        {/* --- Tipo de Operação --- */}
        <FormField control={form.control} name="tipo" render={({ field }) => (
          <FormItem className="space-y-2"><FormLabel>Tipo de Operação</FormLabel><FormControl>
            <RadioGroup onValueChange={field.onChange} value={field.value} className="flex space-x-4">
              <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="compra" /></FormControl><FormLabel className="font-normal">Compra</FormLabel></FormItem>
              <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="venda" /></FormControl><FormLabel className="font-normal">Venda</FormLabel></FormItem>
            </RadioGroup>
          </FormControl><FormMessage /></FormItem>
        )} />

        {/* --- Quantidade, Preço, Valor Total --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField control={form.control} name="quantidade" render={({ field }) => (<FormItem><FormLabel>Quantidade</FormLabel><FormControl><Input type="number" step="any" placeholder="0.00000000" {...field} /></FormControl><FormMessage /></FormItem>)}/>
          <FormField control={form.control} name="preco_unitario" render={({ field }) => (<FormItem><FormLabel>Preço Unitário (USD)</FormLabel><FormControl><Input type="number" step="any" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>)}/>
          <FormField control={form.control} name="valor_total" render={({ field }) => (<FormItem><FormLabel>Valor Total (USD)</FormLabel><FormControl><Input type="number" step="any" placeholder="0.00" {...field} readOnly/></FormControl><FormDescription>Calculado</FormDescription><FormMessage /></FormItem>)}/>
        </div>

        {/* --- Data e Exchange --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* --- Campo de Data Híbrido (Input + Calendário Popover com asChild) --- */}
          <FormField
            control={form.control}
            name="data_operacao"
            render={({ field }) => {
              // Handler para o input de texto (formato UTC corrigido)
              const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                const typedValue = e.target.value;
                setDisplayValue(typedValue); // Atualiza visualização imediata

                const parts = typedValue.split('/');
                if (parts.length === 3) {
                  const day = parseInt(parts[0], 10);
                  const month = parseInt(parts[1], 10);
                  const year = parseInt(parts[2], 10);

                  if (!isNaN(day) && !isNaN(month) && !isNaN(year) && String(year).length === 4) {
                    const dateObj = new Date(Date.UTC(year, month - 1, day));
                    if (
                      !isNaN(dateObj.getTime()) &&
                      dateObj.getUTCDate() === day &&
                      dateObj.getUTCMonth() === month - 1 &&
                      dateObj.getUTCFullYear() === year
                    ) {
                      const yearUTC = dateObj.getUTCFullYear();
                      const monthUTC = (dateObj.getUTCMonth() + 1).toString().padStart(2, '0');
                      const dayUTC = dateObj.getUTCDate().toString().padStart(2, '0');
                      const newValue = `${yearUTC}-${monthUTC}-${dayUTC}`;

                      if (newValue !== field.value) {
                        field.onChange(newValue);
                      }
                      return;
                    }
                  }
                }
              };

              // Handler para seleção no calendário (atualizado para fechar estado local)
              const handleCalendarSelect = (date: Date | undefined) => {
                const formattedDate = date ? format(date, 'yyyy-MM-dd') : "";
                field.onChange(formattedDate);
                setIsCalendarOpen(false); // Fecha o calendário condicional
              };

              return (
                <FormItem className="flex flex-col">
                  <FormLabel>Data da Operação</FormLabel>
                  {/* Container Relativo para posicionar o calendário */}
                  <div className="relative flex items-center gap-2">
                    <FormControl className="flex-grow">
                      <Input
                        type="text"
                        placeholder="dd/MM/yyyy"
                        value={displayValue}
                        onChange={handleInputChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    {/* Botão direto com onClick */}
                    <Button
                      type="button" // Garante que não submete o form
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 flex-shrink-0"
                      onClick={() => setIsCalendarOpen(true)} // Abre o calendário
                    >
                      <CalendarIcon className="h-4 w-4" />
                      <span className="sr-only">Abrir calendário</span>
                    </Button>

                    {/* Renderização Condicional do Calendário */}
                    {isCalendarOpen && (
                      <div className="absolute top-full right-0 mt-1 z-10 bg-background border rounded-md shadow-md p-0 w-auto">
                        <Calendar
                          mode="single"
                          selected={field.value ? new Date(`${field.value}T00:00:00`) : undefined}
                          defaultMonth={field.value ? new Date(`${field.value}T00:00:00`) : undefined}
                          onSelect={handleCalendarSelect}
                          disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                          initialFocus
                          locale={ptBR}
                        />
                      </div>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              );
            }}
          />
          {/* --- Fim do Campo de Data Híbrido --- */}

          <FormField control={form.control} name="exchange" render={({ field }) => (<FormItem><FormLabel>Exchange (opcional)</FormLabel><FormControl><Input {...field} value={field.value ?? ''} placeholder="Binance, Coinbase..." /></FormControl><FormMessage /></FormItem>)}/>
        </div>

        {/* --- Notas --- */}
        <FormField control={form.control} name="notas" render={({ field }) => (<FormItem><FormLabel>Notas (opcional)</FormLabel><FormControl><Textarea placeholder="Observações..." className="resize-none" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)}/>

         {/* --- Mensagem de erro de Grupo ID --- */}
         {form.formState.errors.grupo_id && (
             <p className="text-sm font-medium text-destructive">
                 {form.formState.errors.grupo_id.message}
             </p>
         )}

        {/* O componente pai (Modal) renderizará os botões */}
         {/* Adicionar um botão submit invisível ou referenciar o form no botão do modal */}
         <button type="submit" id="operacao-form-submit" hidden></button>
      </form>
    </Form>
  );
}; 