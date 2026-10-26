import type { SupabaseClient } from '@supabase/supabase-js'
import {
  CATEGORIAS_DESPESA, FREQUENCIA_DESPESA_LABEL, FREQUENCIA_RENDA_LABEL, MESES, STATUS_PLANO, TIPOS_RENDA,
  despesaMensal, fimParcelas, formatBRL, formatMesAno, formatMoeda, nomeMes, parcelasRestantes, projetarPlano, valorRestante,
  type Cartao, type Despesa, type Lancamento, type Plano, type Renda,
} from './financas'
import { diagnosticar } from './financas-diagnostico'
import { carregarPatrimonio } from './patrimonio'

interface Opcoes {
  aiPerfil?: string | null
  ptaxVenda: number | null
  competenciaReal: string // mês cujos lançamentos reais entram no contexto
}

/**
 * Retrato completo das finanças da família em texto, para a IA.
 * Usado pelo consultor (sob demanda) e pela carta mensal (automática).
 */
export async function montarContextoFinanceiro(supabase: SupabaseClient, familiaId: string, opcoes: Opcoes) {
  const [
    { data: despesasData }, { data: rendasData }, { data: planosData }, { data: cartoesData },
    { data: lancData }, { data: familia }, patrimonio,
  ] = await Promise.all([
    supabase.from('fin_despesas').select('*').eq('familia_id', familiaId).eq('ativo', true),
    supabase.from('fin_rendas').select('*').eq('familia_id', familiaId).eq('ativo', true),
    supabase.from('fin_planos').select('*').eq('familia_id', familiaId).neq('status', 'concluido'),
    supabase.from('fin_cartoes').select('*').eq('familia_id', familiaId),
    supabase.from('fin_lancamentos').select('valor, categoria').eq('familia_id', familiaId).eq('competencia', opcoes.competenciaReal),
    supabase.from('fin_familias').select('tetos').eq('id', familiaId).single(),
    carregarPatrimonio(supabase, familiaId, opcoes.ptaxVenda),
  ])

  const despesas = (despesasData ?? []) as Despesa[]
  const rendas = (rendasData ?? []) as Renda[]
  const planos = (planosData ?? []) as Plano[]
  const cartoes = (cartoesData ?? []) as Cartao[]
  const lancamentos = (lancData ?? []) as Pick<Lancamento, 'valor' | 'categoria'>[]
  const tetos = (familia?.tetos ?? {}) as Record<string, number>
  const nomeCartao = (id: string | null) => cartoes.find(c => c.id === id)?.nome

  const d = diagnosticar(despesas, rendas)

  const linhasRenda = rendas.map(r =>
    `- ${r.descricao} (${TIPOS_RENDA[r.tipo].label}, ${FREQUENCIA_RENDA_LABEL[r.frequencia].toLowerCase()}` +
    `${r.mes_recebimento ? `, em ${MESES[r.mes_recebimento - 1].toLowerCase()}` : ''}): ${formatBRL(r.valor)}`
  )
  const linhasDespesa = despesas.map(x =>
    `- [${CATEGORIAS_DESPESA[x.categoria]?.label ?? x.categoria}] ${x.descricao}: ${formatBRL(x.valor)} ` +
    `(${FREQUENCIA_DESPESA_LABEL[x.frequencia].toLowerCase()}` +
    `${parcelasRestantes(x) ? `, faltam ${parcelasRestantes(x)} parcelas (${formatBRL(valorRestante(x))}), última em ${formatMesAno(fimParcelas(x)!)}` : ''}` +
    `${nomeCartao(x.cartao_id) ? `, no cartão ${nomeCartao(x.cartao_id)}` : ''}` +
    `${x.frequencia === 'anual' ? `, ${formatBRL(despesaMensal(x))}/mês diluído` : ''}` +
    `, ${x.essencial ? 'essencial' : 'não essencial'})` +
    `${x.observacoes ? `. Obs.: ${x.observacoes}` : ''}`
  )

  const blocosPlanos = planos.map(p => {
    const plano = p.moeda === 'USD' && !p.cotacao && opcoes.ptaxVenda ? { ...p, cotacao: opcoes.ptaxVenda } : p
    const pr = projetarPlano(plano)
    const custos = p.itens.map(i => `  - ${i.descricao}: ${i.valor ? formatMoeda(i.valor, p.moeda) : 'valor ainda não pesquisado'}`)
    const etapas = p.etapas.map(e => `  - [${e.feito ? 'x' : ' '}] ${e.texto}`)
    return [
      `### ${p.titulo} (${STATUS_PLANO[p.status].label.toLowerCase()}${p.prioridade > 0 ? ', plano principal' : ''})`,
      p.descricao ?? '',
      `Meta: ${formatMoeda(pr.meta, p.moeda)}${p.moeda === 'USD' && plano.cotacao ? ` (≈ ${formatBRL(pr.metaBRL)} a R$ ${Number(plano.cotacao).toFixed(2)}/US$)` : ''}. ` +
        `Guardado: ${formatMoeda(Number(p.valor_guardado), p.moeda)}. Aporte: ${formatBRL(Number(p.aporte_mensal))}/mês.` +
        `${p.data_alvo ? ` Data desejada: ${formatMesAno(new Date(`${p.data_alvo}T12:00:00`))}.` : ''}` +
        `${pr.dataPrevista && pr.metaBRL > 0 ? ` Previsão no ritmo atual: ${formatMesAno(pr.dataPrevista)}.` : ''}`,
      custos.length ? `Custos:\n${custos.join('\n')}` : '',
      etapas.length ? `Etapas:\n${etapas.join('\n')}` : '',
    ].filter(Boolean).join('\n')
  })

  const realPorCategoria = Object.entries(
    lancamentos.reduce<Record<string, number>>((acc, l) => { acc[l.categoria] = (acc[l.categoria] ?? 0) + Number(l.valor); return acc }, {})
  ).sort((a, b) => b[1] - a[1])
  const totalReal = realPorCategoria.reduce((a, [, v]) => a + v, 0)

  const p = patrimonio
  const texto = [
    opcoes.aiPerfil?.trim() ? `## Quem sou\n${opcoes.aiPerfil.trim()}` : '',
    `## Resumo mensal do orçamento (anuais diluídos por 12; rendas eventuais fora)
- Renda líquida média: ${formatBRL(d.renda)}
- Gastos previstos: ${formatBRL(d.despesa)} (essenciais ${formatBRL(d.essenciais)}, não essenciais ${formatBRL(d.naoEssenciais)})
- Dívidas e parcelas: ${formatBRL(d.dividas)}
- Saldo previsto: ${formatBRL(d.saldo)}
- Taxa de poupança: ${d.taxaPoupanca === null ? 'indefinida' : `${d.taxaPoupanca.toFixed(1)}%`}
- Meta de reserva de emergência (6x essenciais): ${formatBRL(d.reservaMeta)}`,
    `## Rendas\n${linhasRenda.join('\n') || '- nenhuma cadastrada'}`,
    `## Gastos fixos\n${linhasDespesa.join('\n') || '- nenhum cadastrado'}`,
    p.temDados
      ? `## Patrimônio
- Temos: ${p.contas.map(c => `${c.nome} ${formatBRL(Number(c.saldo))}`).join('; ') || 'nenhuma conta cadastrada'}
- Dólar guardado: ${p.usd > 0 ? `US$ ${p.usd.toFixed(2)} (preço médio R$ ${p.precoMedio!.toFixed(2)}, vale ${formatBRL(p.dolarBRL)} hoje)` : 'nenhum'}
- Devemos: ${p.dividas.map(x => `${x.nome} ${formatBRL(Number(x.saldo))} a ${x.juros_mensal}% a.m., parcela ${formatBRL(Number(x.parcela))}`).join('; ') || 'nada'}
- Patrimônio líquido: ${formatBRL(p.liquido)}`
      : '',
    realPorCategoria.length
      ? `## Gasto real lançado em ${nomeMes(opcoes.competenciaReal)}: ${formatBRL(totalReal)}\n` +
        realPorCategoria.map(([c, v]) =>
          `- ${CATEGORIAS_DESPESA[c]?.label ?? c}: ${formatBRL(v)}${tetos[c] ? ` (limite combinado ${formatBRL(Number(tetos[c]))})` : ''}`
        ).join('\n')
      : '',
    opcoes.ptaxVenda ? `## Câmbio\nDólar PTAX (Banco Central) hoje: R$ ${opcoes.ptaxVenda.toFixed(4)}` : '',
    `## Planos\n${blocosPlanos.join('\n\n') || 'Nenhum plano cadastrado ainda.'}`,
    `## Alertas do diagnóstico automático\n${d.alertas.map(a => `- ${a.titulo}: ${a.texto}`).join('\n')}`,
  ].filter(Boolean).join('\n\n')

  return { texto, temDados: despesas.length > 0 || rendas.length > 0 || totalReal !== 0 }
}
