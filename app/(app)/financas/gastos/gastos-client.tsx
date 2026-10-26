'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, CreditCard, Pencil, Plus, Receipt, Settings2, Trash2, Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  CATEGORIAS_DESPESA, FREQUENCIA_DESPESA_LABEL, competenciaISO, despesaMensal, espelharLancamento, lancamentoEssencial, parcelaNoMes, fimParcelas, formatBRL, formatMesAno,
  parcelasRestantes, parseBRL, projetarGastosMensais, valorRestante,
  type Cartao, type Despesa, type FrequenciaDespesa, type Lancamento, type Plano,
} from '@/lib/financas'
import CartoesModal from './cartoes-modal'
import LancamentoSheet, { ULTIMO_PAGAMENTO_KEY } from '../_components/lancamento-sheet'

interface Props {
  userId: string
  familiaId: string
  despesas: Despesa[]
  cartoes: Cartao[]
  lancamentosMes: Lancamento[] // lançado nos cartões neste mês (a fatura real)
  plano: Plano | null
  renda: number
}

const FORM_VAZIO = {
  cartao_id: '',
  descricao: '',
  categoria: 'alimentacao',
  valor: '',
  frequencia: 'mensal' as FrequenciaDespesa,
  parcela_atual: '1',
  parcelas_total: '',
  dia_vencimento: '',
  essencial: true,
  observacoes: '',
}

const inputClass = 'w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring'

function mesAtualISO() {
  const hoje = new Date()
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
}

/** Barras dos próximos 12 meses: mostra o gasto caindo conforme as parcelas terminam. */
function ProjecaoGastos({ valores }: { valores: number[] }) {
  const [sel, setSel] = useState(0)
  const max = Math.max(...valores, 1)
  const hoje = new Date()
  const queda = valores[0] - valores[valores.length - 1]

  return (
    <div className="space-y-3">
      <div className="flex h-32 items-end gap-1">
        {valores.map((v, i) => {
          const mes = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1)
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSel(i)}
              onMouseEnter={() => setSel(i)}
              className="flex h-full flex-1 flex-col justify-end"
              aria-label={`${mes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}: ${formatBRL(v)}`}
            >
              <div
                className={`w-full rounded-t ${i === sel ? 'bg-primary' : 'bg-primary/40'}`}
                style={{ height: `${(v / max) * 100}%`, minHeight: v > 0 ? 2 : 0 }}
              />
              <span className={`mt-1 text-center text-[10px] ${i === sel ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                {mes.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
              </span>
            </button>
          )
        })}
      </div>
      <p className="text-sm">
        <span className="text-muted-foreground">
          {new Date(hoje.getFullYear(), hoje.getMonth() + sel, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}:
        </span>{' '}
        <strong className="tabular-nums">{formatBRL(valores[sel])}</strong>
      </p>
      <p className="text-xs text-muted-foreground">
        {queda > 0
          ? <>Daqui a 12 meses, com as parcelas atuais terminando, o gasto mensal cai <strong className="text-green-700">{formatBRL(queda)}</strong>, de {formatBRL(valores[0])} para {formatBRL(valores[valores.length - 1])}. Isso só acontece se você não fizer parcelas novas.</>
          : 'Sem parcelas terminando nos próximos 12 meses.'}
      </p>
    </div>
  )
}

export default function GastosClient({ userId, familiaId, despesas: initialDespesas, cartoes: initialCartoes, lancamentosMes, plano, renda }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [, startTransition] = useTransition()

  const [despesas, setDespesas] = useState(initialDespesas)
  const [cartoes, setCartoes] = useState(initialCartoes)
  const [modalOpen, setModalOpen] = useState(false)
  const [cartoesOpen, setCartoesOpen] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  // Lançamento em sequência: a janela fica aberta e conta o que já foi salvo
  const [salvos, setSalvos] = useState<{ ultimo: string; total: number } | null>(null)
  const descricaoRef = useRef<HTMLInputElement>(null)
  // Fatura real do mês, por cartão, com edição completa de cada linha
  const [lancMes, setLancMes] = useState(lancamentosMes)
  const [abaCartao, setAbaCartao] = useState<Record<string, 'fatura' | 'fixos'>>({})
  const [lancSheet, setLancSheet] = useState<{ lancamento: Lancamento | null; cartaoId: string } | null>(null)
  // Lançar um parcelado ou "todo mês" cria item no orçamento: acompanha os dados novos do servidor
  useEffect(() => { setDespesas(initialDespesas) }, [initialDespesas])
  useEffect(() => { setLancMes(lancamentosMes) }, [lancamentosMes])

  const realPorCartao = lancMes.reduce<Record<string, number>>((acc, l) => {
    acc[l.cartao_id!] = (acc[l.cartao_id!] ?? 0) + Number(l.valor)
    return acc
  }, {})
  const [form, setForm] = useState(FORM_VAZIO)
  const [filtroProjecao, setFiltroProjecao] = useState('todos')
  const [ultimoPagamento, setUltimoPagamento] = useState<string | null>(null)

  useEffect(() => {
    try { setUltimoPagamento(localStorage.getItem(ULTIMO_PAGAMENTO_KEY)) } catch { /* ignorado */ }
  }, [])

  const totalPlanejado = despesas.reduce((a, d) => a + despesaMensal(d), 0)
  const doCartao = (id: string | null) => despesas.filter(d => d.cartao_id === id)
  const foraDoCartao = despesas.filter(d => !d.cartao_id || !cartoes.some(c => c.id === d.cartao_id))
  const totalFaturas = cartoes.reduce((a, c) => a + projetarGastosMensais(doCartao(c.id), 1)[0], 0)
  const totalFora = projetarGastosMensais(foraDoCartao, 1)[0]
  const totalParcelado = despesas.reduce((a, d) => a + valorRestante(d), 0)

  const baseProjecao =
    filtroProjecao === 'todos' ? despesas : filtroProjecao === 'fora' ? foraDoCartao : doCartao(filtroProjecao)
  const projecao = projetarGastosMensais(baseProjecao)

  function abrirNovo(cartaoId?: string) {
    // A maioria dos gastos vai no cartão: sugere o último usado, ou o primeiro cadastrado
    const padrao = cartaoId
      ?? (ultimoPagamento !== null && (ultimoPagamento === '' || cartoes.some(c => c.id === ultimoPagamento)) ? ultimoPagamento : cartoes[0]?.id ?? '')
    setEditandoId(null)
    setForm({ ...FORM_VAZIO, cartao_id: padrao })
    setErro(null)
    setSalvos(null)
    setModalOpen(true)
  }

  function abrirEdicao(d: Despesa) {
    const restantes = parcelasRestantes(d)
    const total = d.parcelas_total ?? restantes
    setEditandoId(d.id)
    setForm({
      cartao_id: d.cartao_id ?? '',
      descricao: d.descricao,
      categoria: d.categoria,
      valor: Number(d.valor).toFixed(2).replace('.', ','),
      frequencia: d.frequencia,
      parcela_atual: total && restantes !== null ? String(Math.max(total - restantes + 1, 1)) : '1',
      parcelas_total: total?.toString() ?? '',
      dia_vencimento: d.dia_vencimento?.toString() ?? '',
      essencial: d.essencial,
      observacoes: d.observacoes ?? '',
    })
    setErro(null)
    setModalOpen(true)
  }

  // Prévia do "quanto falta" enquanto preenche uma compra parcelada
  const previaTotal = Number(form.parcelas_total) || 0
  const previaAtual = Number(form.parcela_atual) || 1
  const previaRestantes = Math.max(previaTotal - previaAtual + 1, 0)
  const previaValor = parseBRL(form.valor) ?? 0

  async function salvar() {
    const valor = parseBRL(form.valor)
    if (!form.descricao.trim()) return setErro('Informe a descrição.')
    if (valor === null) return setErro('Valor inválido. Use o formato 1.234,56.')
    if (form.frequencia === 'parcelada') {
      if (!previaTotal) return setErro('Informe o total de parcelas.')
      if (previaAtual > previaTotal) return setErro('A parcela atual não pode ser maior que o total.')
    }

    setSaving(true)
    const parcelada = form.frequencia === 'parcelada'
    const payload = {
      user_id: userId,
      familia_id: familiaId,
      cartao_id: form.cartao_id || null,
      descricao: form.descricao.trim(),
      categoria: form.categoria,
      valor,
      frequencia: form.frequencia,
      parcelas_total: parcelada ? previaTotal : null,
      parcelas_restantes: parcelada ? previaRestantes : null,
      parcelas_ref: parcelada ? mesAtualISO() : null,
      dia_vencimento: !form.cartao_id && form.dia_vencimento ? Number(form.dia_vencimento) : null,
      essencial: form.essencial,
      observacoes: form.observacoes.trim() || null,
    }

    const query = editandoId
      ? supabase.from('fin_despesas').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editandoId)
      : supabase.from('fin_despesas').insert(payload)
    const { data, error } = await query.select().single()

    setSaving(false)
    if (error || !data) return setErro(`Não foi possível salvar.${error ? ` (${error.code}: ${error.message})` : ''}`)

    try { localStorage.setItem(ULTIMO_PAGAMENTO_KEY, form.cartao_id) } catch { /* ignorado */ }
    setUltimoPagamento(form.cartao_id)

    const salvo = data as Despesa
    setDespesas(prev => editandoId ? prev.map(d => d.id === editandoId ? salvo : d) : [salvo, ...prev])
    startTransition(() => router.refresh())

    if (editandoId) {
      // Leva a correção para o lançamento deste mês ligado a este item (descrição, categoria, parcela)
      const competencia = competenciaISO()
      const n = parcelaNoMes(salvo, competencia)
      const mudancas = {
        descricao: salvo.descricao,
        categoria: salvo.categoria,
        essencial: salvo.essencial,
        ...(salvo.frequencia === 'parcelada' && n ? { parcela_atual: n, parcelas_total: salvo.parcelas_total } : {}),
      }
      const { error: erroSync } = await supabase.from('fin_lancamentos').update(mudancas)
        .eq('despesa_id', editandoId).eq('competencia', competencia)
      if (!erroSync) setLancMes(prev => prev.map(l => l.despesa_id === editandoId && l.competencia === competencia ? { ...l, ...mudancas } : l))
      setModalOpen(false)
      return
    }
    // Gasto novo: continua na janela para o próximo, mantendo cartão e categoria
    setSalvos(prev => ({ ultimo: salvo.descricao, total: (prev?.total ?? 0) + 1 }))
    setForm(p => ({ ...FORM_VAZIO, cartao_id: p.cartao_id, categoria: p.categoria, essencial: p.essencial }))
    setErro(null)
    descricaoRef.current?.focus()
  }

  async function excluir(d: Despesa) {
    if (!confirm(`Excluir "${d.descricao}"?`)) return false
    const anterior = despesas
    setDespesas(prev => prev.filter(x => x.id !== d.id))
    const { error } = await supabase.from('fin_despesas').delete().eq('id', d.id)
    if (error) setDespesas(anterior)
    else startTransition(() => router.refresh())
    return !error
  }

  async function toggleAtivo(d: Despesa) {
    const novo = !d.ativo
    setDespesas(prev => prev.map(x => x.id === d.id ? { ...x, ativo: novo } : x))
    const { error } = await supabase.from('fin_despesas').update({ ativo: novo }).eq('id', d.id)
    if (error) setDespesas(prev => prev.map(x => x.id === d.id ? { ...x, ativo: !novo } : x))
    else startTransition(() => router.refresh())
  }

  function atualizarCartoes(novos: Cartao[]) {
    // Cartão excluído: os gastos dele ficam sem cartão (on delete set null no banco)
    const ids = new Set(novos.map(c => c.id))
    setDespesas(prev => prev.map(d => d.cartao_id && !ids.has(d.cartao_id) ? { ...d, cartao_id: null } : d))
    setCartoes(novos)
    startTransition(() => router.refresh())
  }

  function linhaDespesa(d: Despesa, mostrarCategoria: boolean) {
    const restantes = parcelasRestantes(d)
    const fim = fimParcelas(d)
    const total = d.parcelas_total
    const encerrada = d.frequencia === 'parcelada' && restantes === 0

    return (
      <li key={d.id} onClick={() => abrirEdicao(d)} className={`flex cursor-pointer items-center gap-3 px-4 py-3 active:bg-secondary/60 sm:cursor-default sm:active:bg-transparent ${d.ativo && !encerrada ? '' : 'opacity-50'}`}>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className={`text-sm truncate ${d.ativo ? '' : 'line-through'}`}>{d.descricao}</p>
          <p className="text-xs text-muted-foreground">
            {mostrarCategoria && (
              <span className={`mr-1.5 rounded px-1.5 py-px ${CATEGORIAS_DESPESA[d.categoria]?.className ?? ''}`}>
                {CATEGORIAS_DESPESA[d.categoria]?.label ?? d.categoria}
              </span>
            )}
            {d.frequencia === 'parcelada' && restantes !== null
              ? encerrada
                ? 'Parcelas quitadas'
                : `Parcela ${total ? `${total - restantes + 1}/${total}` : `· faltam ${restantes}`}`
              : FREQUENCIA_DESPESA_LABEL[d.frequencia]}
            {d.dia_vencimento && !d.cartao_id && ` · vence dia ${d.dia_vencimento}`}
            {!d.essencial && ' · não essencial'}
          </p>
          {restantes !== null && restantes > 0 && fim && (
            <p className="text-xs text-amber-700">
              Faltam {formatBRL(valorRestante(d))} · {restantes === 1 ? 'última parcela este mês' : `termina em ${formatMesAno(fim)}`}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-sm font-medium tabular-nums">{formatBRL(Number(d.valor))}</p>
          {d.frequencia === 'anual' && (
            <p className="text-xs text-muted-foreground tabular-nums">{formatBRL(d.valor / 12)}/mês</p>
          )}
        </div>
        <div className="hidden items-center gap-1 sm:flex" onClick={e => e.stopPropagation()}>
          <button
            type="button"
            role="switch"
            aria-checked={d.ativo}
            onClick={() => toggleAtivo(d)}
            title={d.ativo ? 'Ativo — clique para pausar' : 'Pausado — clique para reativar'}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors ${d.ativo ? 'bg-primary' : 'bg-input'}`}
          >
            <span className={`mt-0.5 inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${d.ativo ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </button>
          <button type="button" onClick={() => abrirEdicao(d)} className="p-1.5 text-muted-foreground hover:text-foreground" title="Editar">
            <Pencil className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => excluir(d)} className="p-1.5 text-muted-foreground hover:text-red-600" title="Excluir">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </li>
    )
  }

  const gruposFora = Object.keys(CATEGORIAS_DESPESA)
    .map(cat => ({ cat, itens: foraDoCartao.filter(d => d.categoria === cat) }))
    .filter(g => g.itens.length > 0)

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Custo mensal da família</p>
          <p className="text-2xl font-semibold tabular-nums">{formatBRL(totalPlanejado)}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCartoesOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-md border border-border text-sm hover:bg-secondary transition-colors"
          >
            <Settings2 className="w-4 h-4" />
            Cartões
          </button>
          <button
            onClick={() => abrirNovo()}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo gasto fixo
          </button>
        </div>
      </div>

      {despesas.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Previsto nos cartões</p>
            <p className="text-lg font-semibold tabular-nums">{formatBRL(totalFaturas)}</p>
            <p className="text-xs text-muted-foreground">só fixos e parcelas · o gasto real fica na aba Mês</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Fora do cartão (este mês)</p>
            <p className="text-lg font-semibold tabular-nums">{formatBRL(totalFora)}</p>
            <p className="text-xs text-muted-foreground">boleto, débito, Pix</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs text-amber-800">Parcelado: quanto ainda falta pagar</p>
            <p className="text-lg font-semibold tabular-nums text-amber-900">{formatBRL(totalParcelado)}</p>
            <p className="text-xs text-amber-800">soma de todas as parcelas futuras</p>
          </div>
        </div>
      )}

      {despesas.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-medium">O futuro dos seus gastos</h2>
              <p className="text-xs text-muted-foreground">Quanto vai sair em cada mês: recorrentes mais as parcelas que ainda correm</p>
            </div>
            <select
              value={filtroProjecao}
              onChange={e => setFiltroProjecao(e.target.value)}
              className="px-2 py-1.5 rounded-md border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="todos">Todos os gastos</option>
              {cartoes.map(c => <option key={c.id} value={c.id}>Fatura {c.nome}</option>)}
              <option value="fora">Fora do cartão</option>
            </select>
          </div>
          <ProjecaoGastos valores={projecao} />
        </div>
      )}

      {despesas.length === 0 && cartoes.length === 0 ? (
        <div className="rounded-lg border border-border p-12 text-center space-y-4">
          <Receipt className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            Comece cadastrando seus cartões de crédito. Depois lance cada gasto dentro do cartão em que ele é pago.
          </p>
          <button
            onClick={() => setCartoesOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            <CreditCard className="w-4 h-4" /> Cadastrar cartão
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Um bloco por cartão, com a fatura e os gastos dentro */}
          {cartoes.map(c => {
            const itens = doCartao(c.id)
            const fatura = projetarGastosMensais(itens, 1)[0]
            const parcelado = itens.reduce((a, d) => a + valorRestante(d), 0)
            const recorrente = itens.filter(d => d.ativo && d.frequencia === 'mensal').reduce((a, d) => a + Number(d.valor), 0)
            const anuais = itens.filter(d => d.ativo && d.frequencia === 'anual').reduce((a, d) => a + Number(d.valor), 0)
            const limite = Number(c.limite) || 0
            // Limite preso: todas as parcelas futuras ficam reservadas, mais os recorrentes do mês
            const comprometido = parcelado + recorrente
            const pctLimite = limite > 0 ? Math.min((comprometido / limite) * 100, 100) : 0

            return (
              <div key={c.id} className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 bg-secondary/50 border-b border-border space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <CreditCard className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="font-medium truncate">{c.nome}</span>
                      {c.dia_vencimento && <span className="text-xs text-muted-foreground whitespace-nowrap">vence dia {c.dia_vencimento}</span>}
                    </div>
                    {realPorCartao[c.id] ? (
                      <Link href={`/financas/mes?cartao=${c.id}`} className="text-right hover:text-primary">
                        <p className="text-xs text-muted-foreground">Lançado no mês ›</p>
                        <p className="font-semibold tabular-nums">{formatBRL(realPorCartao[c.id])}</p>
                        <p className="text-[11px] text-muted-foreground">previsto: {formatBRL(fatura)}</p>
                      </Link>
                    ) : (
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Previsto (fixos + parcelas)</p>
                        <p className="font-semibold tabular-nums">{formatBRL(fatura)}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {parcelado > 0 && <span>Parcelas a pagar: <strong className="text-amber-700">{formatBRL(parcelado)}</strong></span>}
                    {anuais > 0 && <span>Anuais neste cartão: {formatBRL(anuais)}/ano (fora da fatura mensal)</span>}
                  </div>
                  {limite > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Limite comprometido</span>
                        <span className="tabular-nums">{formatBRL(comprometido)} de {formatBRL(limite)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-background overflow-hidden">
                        <div
                          className={`h-full rounded-full ${pctLimite > 80 ? 'bg-red-500' : pctLimite > 50 ? 'bg-amber-500' : 'bg-green-600'}`}
                          style={{ width: `${pctLimite}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                {(() => {
                  const linhas = lancMes.filter(l => l.cartao_id === c.id).map(l => espelharLancamento(l, despesas))
                  const aba = abaCartao[c.id] ?? (linhas.length > 0 ? 'fatura' : 'fixos')
                  return (
                    <>
                      <div className="flex border-b border-border text-sm">
                        {([['fatura', `Fatura do mês (${linhas.length})`], ['fixos', `Fixos e parcelas (${itens.length})`]] as const).map(([k, label]) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setAbaCartao(p => ({ ...p, [c.id]: k }))}
                            className={`-mb-px flex-1 border-b-2 px-3 py-2 ${aba === k ? 'border-primary font-medium text-primary' : 'border-transparent text-muted-foreground'}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      {aba === 'fatura' ? (
                        linhas.length > 0 ? (
                          <ul className="divide-y divide-border">
                            {linhas.map(l => (
                              <li key={l.id}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    // Abre já com a parcela que o orçamento indica para este mês
                                    const d = l.despesa_id ? despesas.find(x => x.id === l.despesa_id) : null
                                    const n = d ? parcelaNoMes(d, l.competencia) : null
                                    setLancSheet({ lancamento: d && n ? { ...l, parcela_atual: n, parcelas_total: d.parcelas_total } : l, cartaoId: c.id })
                                  }}
                                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-secondary/60 hover:bg-secondary/30"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm">{l.descricao}</p>
                                    <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                                      {new Date(`${l.data}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                      <span className={`rounded px-1.5 ${CATEGORIAS_DESPESA[l.categoria]?.className ?? ''}`}>
                                        {CATEGORIAS_DESPESA[l.categoria]?.label ?? l.categoria}
                                      </span>
                                      {(() => {
                                        // Parcela ligada ao orçamento: o orçamento é a fonte da verdade
                                        const d = l.despesa_id ? despesas.find(x => x.id === l.despesa_id) : null
                                        const n = d ? parcelaNoMes(d, l.competencia) : null
                                        if (d && n) return <span>{n}/{d.parcelas_total}</span>
                                        return l.parcelas_total ? <span>{l.parcela_atual}/{l.parcelas_total}</span> : null
                                      })()}
                                      {!lancamentoEssencial(l) && <span className="text-amber-700">não essencial</span>}
                                    </p>
                                  </div>
                                  <span className={`text-sm tabular-nums ${Number(l.valor) < 0 ? 'text-green-700' : ''}`}>{formatBRL(Number(l.valor))}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="px-4 py-5 text-center text-sm text-muted-foreground">Nada lançado neste cartão este mês.</p>
                        )
                      ) : itens.length > 0 ? (
                        <ul className="divide-y divide-border">
                          {itens.map(d => linhaDespesa(d, true))}
                        </ul>
                      ) : (
                        <p className="px-4 py-5 text-center text-sm text-muted-foreground">Nenhum fixo ou parcela neste cartão.</p>
                      )}

                      <button
                        type="button"
                        onClick={() => aba === 'fatura' ? setLancSheet({ lancamento: null, cartaoId: c.id }) : abrirNovo(c.id)}
                        className="flex w-full items-center gap-2 border-t border-border px-4 py-2.5 text-sm text-primary hover:bg-secondary/50"
                      >
                        <Plus className="w-4 h-4" /> {aba === 'fatura' ? `Lançar gasto no ${c.nome}` : 'Novo fixo ou parcela'}
                      </button>
                    </>
                  )
                })()}
              </div>
            )
          })}

          {/* Fora do cartão, agrupado por categoria */}
          {foraDoCartao.length > 0 && (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-3 bg-secondary/50 border-b border-border">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Fora do cartão</span>
                  <span className="text-xs text-muted-foreground">boleto, débito, Pix</span>
                </div>
                <span className="font-semibold tabular-nums">{formatBRL(totalFora)}</span>
              </div>
              {gruposFora.map(({ cat, itens }) => (
                <div key={cat}>
                  <div className="flex items-center justify-between px-4 pt-3 pb-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${CATEGORIAS_DESPESA[cat].className}`}>
                      {CATEGORIAS_DESPESA[cat].label}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatBRL(itens.reduce((a, d) => a + despesaMensal(d), 0))}
                    </span>
                  </div>
                  <ul className="divide-y divide-border">
                    {itens.map(d => linhaDespesa(d, false))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => abrirNovo()}
        aria-label="Novo gasto fixo"
        className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 lg:hidden"
      >
        <Plus className="h-6 w-6" />
      </button>

      {lancSheet && (
        <LancamentoSheet
          familiaId={familiaId}
          userId={userId}
          cartoes={cartoes}
          planoPrincipal={plano}
          rendaMensal={renda}
          lancamento={lancSheet.lancamento}
          cartaoPadrao={lancSheet.cartaoId}
          onSaved={l => {
            setLancMes(prev => {
              const lista = prev.some(x => x.id === l.id) ? prev.map(x => x.id === l.id ? l : x) : [l, ...prev]
              return lista.filter(x => x.cartao_id && x.competencia === competenciaISO()) // foi para a fatura seguinte: sai da lista
            })
            if (lancSheet.lancamento) setLancSheet(null)
            startTransition(() => router.refresh())
          }}
          onDeleted={id => { setLancMes(prev => prev.filter(x => x.id !== id)); setLancSheet(null); startTransition(() => router.refresh()) }}
          onClose={() => setLancSheet(null)}
        />
      )}

      {cartoesOpen && (
        <CartoesModal userId={userId} familiaId={familiaId} cartoes={cartoes} onChange={atualizarCartoes} onClose={() => setCartoesOpen(false)} />
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}
        >
          <div className="bg-background rounded-t-2xl sm:rounded-xl border border-border w-full sm:max-w-lg shadow-xl p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6 space-y-5 max-h-[92vh] overflow-y-auto">
            <h2 className="text-lg font-semibold">{editandoId ? 'Editar gasto fixo' : 'Novo gasto fixo'}</h2>

            {salvos && !editandoId && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span className="min-w-0 flex-1 truncate">&quot;{salvos.ultimo}&quot; salvo</span>
                <span className="whitespace-nowrap text-xs">{salvos.total} {salvos.total === 1 ? 'lançado' : 'lançados'} agora</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Pago com</label>
                <div className="flex flex-wrap gap-2">
                  {cartoes.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, cartao_id: c.id }))}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                        form.cartao_id === c.id ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border hover:bg-secondary'
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5" /> {c.nome}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, cartao_id: '' }))}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      form.cartao_id === '' ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border hover:bg-secondary'
                    }`}
                  >
                    Boleto / débito / Pix
                  </button>
                </div>
                {cartoes.length === 0 && (
                  <button type="button" onClick={() => { setModalOpen(false); setCartoesOpen(true) }} className="text-xs text-primary hover:underline">
                    + Cadastrar um cartão de crédito
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Descrição *</label>
                <input
                  ref={descricaoRef}
                  value={form.descricao}
                  onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                  placeholder="Ex: Mercado, Gasolina, Netflix, Geladeira"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Frequência</label>
                  <select
                    value={form.frequencia}
                    onChange={e => setForm(p => ({ ...p, frequencia: e.target.value as FrequenciaDespesa }))}
                    className={inputClass}
                  >
                    {Object.entries(FREQUENCIA_DESPESA_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{form.frequencia === 'parcelada' ? 'Valor da parcela (R$) *' : 'Valor (R$) *'}</label>
                  <input
                    inputMode="decimal"
                    value={form.valor}
                    onChange={e => setForm(p => ({ ...p, valor: e.target.value }))}
                    placeholder="0,00"
                    className={inputClass}
                  />
                </div>
              </div>

              {form.frequencia === 'parcelada' && (
                <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-900">
                    <span>Parcela</span>
                    <input
                      type="number"
                      min={1}
                      value={form.parcela_atual}
                      onChange={e => setForm(p => ({ ...p, parcela_atual: e.target.value }))}
                      className="w-16 px-2 py-1 rounded-md border border-border bg-background text-sm text-center focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <span>de</span>
                    <input
                      type="number"
                      min={1}
                      value={form.parcelas_total}
                      onChange={e => setForm(p => ({ ...p, parcelas_total: e.target.value }))}
                      placeholder="10"
                      className="w-16 px-2 py-1 rounded-md border border-border bg-background text-sm text-center focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <span className="text-xs text-gray-600">(como aparece na fatura deste mês)</span>
                  </div>
                  {previaTotal > 0 && previaValor > 0 && previaAtual <= previaTotal && (
                    <p className="text-xs text-amber-900">
                      Faltam <strong>{previaRestantes} parcelas = {formatBRL(previaRestantes * previaValor)}</strong>
                      {previaRestantes > 1 && `, última em ${formatMesAno(new Date(new Date().getFullYear(), new Date().getMonth() + previaRestantes - 1, 1))}`}.
                      {' '}Compra total: {formatBRL(previaTotal * previaValor)}.
                    </p>
                  )}
                  <p className="text-[11px] text-gray-600">A contagem avança sozinha a cada mês. Não precisa atualizar.</p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Categoria</label>
                  <select
                    value={form.categoria}
                    onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}
                    className={inputClass}
                  >
                    {Object.entries(CATEGORIAS_DESPESA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <p className="text-xs text-muted-foreground">{CATEGORIAS_DESPESA[form.categoria]?.descricao}</p>
                </div>
                {!form.cartao_id && form.frequencia !== 'parcelada' && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Dia do vencimento</label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={form.dia_vencimento}
                      onChange={e => setForm(p => ({ ...p, dia_vencimento: e.target.value }))}
                      placeholder="Ex: 10"
                      className={inputClass}
                    />
                  </div>
                )}
              </div>

              {form.frequencia === 'anual' && (
                <p className="text-xs text-muted-foreground">
                  Gastos anuais (IPVA, IPTU, seguro, material escolar) são diluídos em 12 no planejamento mensal.
                </p>
              )}

              <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.essencial}
                  onClick={() => setForm(p => ({ ...p, essencial: !p.essencial }))}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors ${form.essencial ? 'bg-primary' : 'bg-input'}`}
                >
                  <span className={`mt-0.5 inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.essencial ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{form.essencial ? 'Essencial' : 'Não essencial'}</p>
                  <p className="text-xs text-muted-foreground">
                    {form.essencial ? 'A família não vive sem' : 'Dá para cortar ou reduzir se precisar'}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Observações</label>
                <textarea
                  rows={2}
                  value={form.observacoes}
                  onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))}
                  className={inputClass}
                />
              </div>

              {erro && <p className="text-sm text-red-600">{erro}</p>}
            </div>

            {editandoId && (() => {
              const atual = despesas.find(x => x.id === editandoId)
              if (!atual) return null
              return (
                <div className="flex gap-2 sm:hidden">
                  <button
                    type="button"
                    onClick={() => { toggleAtivo(atual); setModalOpen(false) }}
                    className="flex-1 px-3 py-2 rounded-md border border-border text-sm"
                  >
                    {atual.ativo ? 'Pausar gasto' : 'Reativar gasto'}
                  </button>
                  <button
                    type="button"
                    onClick={async () => { if (await excluir(atual)) setModalOpen(false) }}
                    className="flex-1 px-3 py-2 rounded-md border border-red-200 text-sm text-red-600"
                  >
                    Excluir
                  </button>
                </div>
              )
            })()}

            <div className="flex gap-3 justify-end pt-2 [&>button]:flex-1 sm:[&>button]:flex-none">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className={`px-4 py-2 rounded-md border text-sm transition-colors ${
                  salvos && !editandoId ? 'border-primary text-primary font-medium hover:bg-primary/5' : 'border-border hover:bg-secondary'
                }`}
              >
                {salvos && !editandoId ? 'Concluir' : 'Cancelar'}
              </button>
              <button
                type="button"
                onClick={salvar}
                disabled={saving}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Salvando...' : editandoId ? 'Salvar' : salvos ? 'Salvar e lançar outro' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
