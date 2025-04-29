import { Operacao } from '@/types/crypto';

interface LoteCompra {
  id: string; // ID da operação de compra original
  quantidade: number;
  precoCustoUnitario: number; // Preço unitário da compra original
  dataCompra: Date;
}

export interface PerformanceMetrics {
  moedaId: string;
  quantidadeAtual: number;
  custoBaseTotalAtual: number; // Custo total dos lotes restantes
  custoMedioAtual: number; // Custo médio ponderado dos lotes restantes (custoBaseTotalAtual / quantidadeAtual)
  valorDeMercadoAtual: number; // quantidadeAtual * precoAtualMercado
  lucroPrejuizoNaoRealizado: number; // valorDeMercadoAtual - custoBaseTotalAtual
  lucroPrejuizoNaoRealizadoPercentual: number;
  lucroPrejuizoRealizadoTotal: number; // Soma do P/L de todas as vendas
}

/**
 * Calcula a performance de um conjunto de operações para UMA moeda específica
 * usando o método FIFO (First-In, First-Out).
 *
 * @param operacoes - Array de operações (compras e vendas) para UMA ÚNICA moeda, ordenadas por data.
 * @param precoAtualMercado - O preço de mercado atual da moeda.
 * @returns Um objeto PerformanceMetrics com os resultados calculados.
 */
export function calcularPerformanceFifo(operacoes: Operacao[], precoAtualMercado: number): PerformanceMetrics {
  const lotesCompraAbertos: LoteCompra[] = [];
  let lucroPrejuizoRealizadoAcumulado = 0;

  // Garante ordenação por data (segurança extra)
  const operacoesOrdenadas = [...operacoes].sort(
    (a, b) => new Date(a.data_operacao).getTime() - new Date(b.data_operacao).getTime()
  );

  for (const op of operacoesOrdenadas) {
    const dataOperacao = new Date(op.data_operacao);
    // <<< LOG INÍCIO OPERAÇÃO >>>
    console.log(`\n[FIFO DEBUG ${op.moeda_id}] Processando Op ID: ${op.id}, Tipo: ${op.tipo}, Qtd: ${op.quantidade}, Preço: ${op.preco_unitario}`);
    console.log(`[FIFO DEBUG ${op.moeda_id}] Lotes Abertos ANTES (${lotesCompraAbertos.length}):`, JSON.stringify(lotesCompraAbertos));

    if (op.tipo === 'compra') {
      lotesCompraAbertos.push({
        id: op.id,
        quantidade: op.quantidade,
        precoCustoUnitario: op.preco_unitario, // Usar preço unitário como custo
        dataCompra: dataOperacao,
      });
    } else if (op.tipo === 'venda') {
      let quantidadeVendida = op.quantidade;
      let custoBaseDaVenda = 0;

      // Consome os lotes FIFO
      while (quantidadeVendida > 0 && lotesCompraAbertos.length > 0) {
        const loteMaisAntigo = lotesCompraAbertos[0];
        const quantidadeConsumidaDoLote = Math.min(quantidadeVendida, loteMaisAntigo.quantidade);

        custoBaseDaVenda += quantidadeConsumidaDoLote * loteMaisAntigo.precoCustoUnitario;

        loteMaisAntigo.quantidade -= quantidadeConsumidaDoLote;
        quantidadeVendida -= quantidadeConsumidaDoLote;

        // Se o lote foi totalmente consumido, remove da lista
        if (loteMaisAntigo.quantidade <= 1e-9) { // Usar tolerância pequena para floats
          lotesCompraAbertos.shift(); // Remove o primeiro elemento (FIFO)
        }
      }

      // <<< ADICIONAR VERIFICAÇÃO EXTRA APÓS O LOOP >>>
      // Garantir que, se o primeiro lote ficou zerado após o loop, ele seja removido.
      // Isso cobre casos onde o loop termina exatamente quando o lote é zerado.
      if (lotesCompraAbertos.length > 0 && lotesCompraAbertos[0].quantidade <= 1e-9) {
           // console.log(`[FIFO DEBUG] Removendo lote zerado ${lotesCompraAbertos[0].id} após o loop while.`); // Log de Debug opcional
           lotesCompraAbertos.shift();
      }

      // <<< CALCULAR A QUANTIDADE REALMENTE COBERTA PELOS LOTES >>>
      const quantidadeCoberta = op.quantidade - quantidadeVendida; // O que foi consumido

      // Se vendeu mais do que tinha (situação de erro ou short?), logar aviso.
      if (quantidadeVendida > 0) {
         // O log já existe e está correto, apenas informa a discrepância.
         console.warn(`[FIFO] Venda da operação ${op.id} (${op.nome}) tentou consumir ${op.quantidade}, mas só havia lotes para cobrir ${quantidadeCoberta}. Isso pode indicar um problema nos dados ou venda a descoberto não suportada.`);
      }

      // <<< USAR quantidadeCoberta PARA CALCULAR O VALOR DA VENDA CORRESPONDENTE AO CUSTO BASE >>>
      const valorVendaCorrespondenteAoCusto = quantidadeCoberta * op.preco_unitario; 
      const lucroPrejuizoDaVenda = valorVendaCorrespondenteAoCusto - custoBaseDaVenda;
      lucroPrejuizoRealizadoAcumulado += lucroPrejuizoDaVenda;
    }

    // <<< LOG FIM OPERAÇÃO >>>
    console.log(`[FIFO DEBUG ${op.moeda_id}] Lotes Abertos DEPOIS (${lotesCompraAbertos.length}):`, JSON.stringify(lotesCompraAbertos));
    console.log(`[FIFO DEBUG ${op.moeda_id}] Lucro Realizado Acumulado: ${lucroPrejuizoRealizadoAcumulado}`);
  }

  // Calcula métricas da posição atual (lotes restantes)
  const quantidadeAtual = lotesCompraAbertos.reduce((acc, lote) => acc + lote.quantidade, 0);
  const custoBaseTotalAtual = lotesCompraAbertos.reduce((acc, lote) => acc + (lote.quantidade * lote.precoCustoUnitario), 0);
  const custoMedioAtual = quantidadeAtual > 0 ? custoBaseTotalAtual / quantidadeAtual : 0;

  const valorDeMercadoAtual = quantidadeAtual * precoAtualMercado;
  const lucroPrejuizoNaoRealizado = valorDeMercadoAtual - custoBaseTotalAtual;
  const lucroPrejuizoNaoRealizadoPercentual = custoBaseTotalAtual > 0 ? (lucroPrejuizoNaoRealizado / custoBaseTotalAtual) * 100 : 0;

  return {
    moedaId: operacoes[0]?.moeda_id || 'desconhecida',
    quantidadeAtual,
    custoBaseTotalAtual,
    custoMedioAtual,
    valorDeMercadoAtual,
    lucroPrejuizoNaoRealizado,
    lucroPrejuizoNaoRealizadoPercentual,
    lucroPrejuizoRealizadoTotal: lucroPrejuizoRealizadoAcumulado,
  };
} 