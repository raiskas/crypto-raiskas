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

  // Formata string YYYY-MM-DD para objeto Date (necessário para Calendar)
  // Retorna null se a string for inválida para evitar erros no Calendar
  const parseDateString = (dateString: string | null | undefined): Date | undefined => {
    if (!dateString) return undefined;
    try {
      // Adicionar "T00:00:00" para interpretar como início do dia LOCAL
      // Evita problemas de timezone ao converter de string para Date
      const date = new Date(`${dateString}T00:00:00`);
      if (isNaN(date.getTime())) {
        console.warn("[OperacaoForm] parseDateString: Data inválida recebida:", dateString);
        return undefined;
      }
      return date;
    } catch (e) {
      console.error("[OperacaoForm] parseDateString: Erro:", e);
      return undefined;
    }
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData ? {
          ...initialData,
          // Manter string no form state, mas o Calendar usará Date
          data_operacao: format(parseDateString(initialData.data_operacao as string) || new Date(), 'yyyy-MM-dd'), 
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
          data_operacao: format(new Date(), 'yyyy-MM-dd'), // String YYYY-MM-DD
          exchange: "",
          notas: "",
          grupo_id: grupoIdUsuario ?? undefined, // Usar grupo do usuário se disponível
      },
  });

  // Efeito para definir a moeda selecionada inicial (modo edição)
  useEffect(() => {
    if (isEditing && initialData) {
      setSelectedCoin({
        id: initialData.moeda_id,
        symbol: initialData.simbolo,
        name: initialData.nome,
        // A imagem pode não estar nos initialData, buscar se necessário ou usar placeholder
        image: `https://cryptoicons.org/api/icon/${initialData.simbolo.toLowerCase()}/200`,
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
                      <div className="relative w-8 h-8"><Image src={selectedCoin.image} alt={selectedCoin.name} fill className="object-contain" onError={(e) => { e.currentTarget.src = `https://cryptoicons.org/api/icon/${selectedCoin.symbol.toLowerCase()}/200`; }}/></div>
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
          {/* --- Campo de Data Simplificado (Apenas Input Texto) --- */}
          <FormField
            control={form.control}
            name="data_operacao" // O valor no form state é 'yyyy-MM-dd'
            render={({ field }) => {
              // Estado local para controlar o valor visível no Input (dd/MM/yyyy)
              const [displayValue, setDisplayValue] = useState(() => {
                const date = parseDateString(field.value); // Usa a função parse robusta
                return date ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : '';
              });

              // Atualiza displayValue se o valor do form (field.value) mudar externamente
              useEffect(() => {
                const date = parseDateString(field.value);
                const formatted = date ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : '';
                // Evita loop infinito atualizando só se necessário
                if (formatted !== displayValue) {
                    setDisplayValue(formatted);
                }
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [field.value]); // Dependência apenas em field.value

              const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                const typedValue = e.target.value;
                setDisplayValue(typedValue); // Atualiza visualização imediatamente

                // Tenta fazer parse do valor digitado (dd/MM/yyyy)
                const parts = typedValue.split('/');
                if (parts.length === 3) {
                  const day = parseInt(parts[0], 10);
                  const month = parseInt(parts[1], 10); // Mês digitado é 1-indexed
                  const year = parseInt(parts[2], 10);

                  if (!isNaN(day) && !isNaN(month) && !isNaN(year) && parts[2].length === 4 && month >= 1 && month <= 12 && day > 0 && day <= 31) {
                    // Valida a data criando-a em UTC para checar overflows (ex: 31/04)
                    const validationDate = new Date(Date.UTC(year, month - 1, day));
                    if (
                        !isNaN(validationDate.getTime()) &&
                        validationDate.getUTCDate() === day &&
                        validationDate.getUTCMonth() === month - 1 &&
                        validationDate.getUTCFullYear() === year
                       ) {
                      // Se válida, CONSTRÓI a string 'yyyy-MM-dd' manualmente
                      const monthPadded = month.toString().padStart(2, '0');
                      const dayPadded = day.toString().padStart(2, '0');
                      const newValue = `${year}-${monthPadded}-${dayPadded}`;

                      if (newValue !== field.value) {
                           field.onChange(newValue);
                      }
                      return; // Para aqui se a data for válida
                    }
                  }
                }
                // Data inválida ou incompleta
              };

              return (
                <FormItem className="flex flex-col">
                  <FormLabel>Data da Operação</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="dd/MM/yyyy"
                      value={displayValue}
                      onChange={handleInputChange}
                      onBlur={field.onBlur} // Manter onBlur para validação do react-hook-form
                      name={field.name}
                      ref={field.ref}
                      className="" // Sem padding extra
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              );
            }}
          />
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