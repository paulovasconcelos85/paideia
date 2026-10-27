'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronDown, ChevronLeft, ChevronRight, FileSpreadsheet, FileText, FileUp, Loader2, MessageCircle, Plus, SlidersHorizontal,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  CATEGORIAS_DESPESA, espelharLancamento, formatBRL, hojeISO, lancamentoEssencial, nomeMes, rendaDoMes,
  type Aporte, type Cartao, type Despesa, type DizimoDevolvido, type FaturaPaga, type Lancamento, type Plano, type Receita, type Renda,
} from '@/lib/financas'
import { montarContas, type Conta } from '@/lib/contas'
import { abrirWhatsApp, compartilharArquivo, gerarExcel, gerarPdf, type MesParaExportar } from '@/lib/exportar-mes'
import LancamentoSheet from '../_components/lancamento-sheet'
import ContasLista from './contas-lista'
import ContaSheet from './conta-sheet'
import NovaContaSheet from './nova-conta-sheet'
import DizimoSheet from './dizimo-sheet'
import Entradas, { montarEntradas, type Entrada } from './entradas'
import ReceitaSheet from './receita-sheet'
import ImportarFatura from './importar-fatura'
import TetosSheet from './tetos-sheet'

interface Props {
  familiaId: string
  userId: string
  competencia: string
  tetos: Record<string, number>
  lancamentos: Lancamento[]
  cartoes: Cartao[]
  despesas: Despesa[]
  plano: Plano | null
  planos: Plano[]
  aportes: Aporte[] // aportes dos planos registrados neste mês
  renda: number
  cartaoInicial: string | null // vindo do Orçamento: abre a fatura daquele cartão
  faturasPagas: FaturaPaga[]
  faturaAnterior: Lancamento[]
  atrasados: Lancamento[]
  rendas: Renda[]
  receitas: Receita[] // entradas que pagam este mês
  dizimoDesde: string | null
  dizimos: DizimoDevolvido[]
  verAtrasos: boolean
}

function mesVizinho(competencia: string, delta: number) {
  const d = new Date(`${competencia}T12:00:00`)
  const v = new Date(d.getFullYear(), d.getMonth() + delta, 1)
  return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}`
}

export default function MesClient({
  familiaId, userId, competencia, tetos: tetosIniciais, lancamentos: iniciais, cartoes, despesas, plano, renda, cartaoInicial,
  faturasPagas: faturasIniciais, faturaAnterior: anteriorInicial, atrasados: atrasadosIniciais,
  rendas, receitas: receitasIniciais, dizimoDesde, dizimos: dizimosIniciais, verAtrasos, planos, aportes: aportesIniciais,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [, startTransition] = useTransition()
  const refresh = () => startTransition(() => router.refresh())

  // Estado local: marcar pago e mudar valor respondem na hora, sem recarregar a página
  const [brutos, setLancamentos] = useState(iniciais)
  useEffect(() => { setLancamentos(iniciais) }, [iniciais])
  const [atrasadosBrutos, setAtrasados] = useState(atrasadosIniciais)
  useEffect(() => { setAtrasados(atrasadosIniciais) }, [atrasadosIniciais])
  const [faturasPagas, setFaturasPagas] = useState(faturasIniciais)
  useEffect(() => { setFaturasPagas(faturasIniciais) }, [faturasIniciais])
  const [dizimos, setDizimos] = useState(dizimosIniciais)
  useEffect(() => { setDizimos(dizimosIniciais) }, [dizimosIniciais])
  const [tetos, setTetos] = useState(tetosIniciais)
  const [receitas, setReceitas] = useState(receitasIniciais)
  const [aportes, setAportes] = useState(aportesIniciais)
  useEffect(() => { setAportes(aportesIniciais) }, [aportesIniciais])
  useEffect(() => { setReceitas(receitasIniciais) }, [receitasIniciais])
  const [receitaAberta, setReceitaAberta] = useState<{ entrada: Entrada | null } | null>(null)

  const lancamentos = useMemo(() => brutos.map(l => espelharLancamento(l, despesas)), [brutos, despesas])
  const atrasados = useMemo(() => atrasadosBrutos.map(l => espelharLancamento(l, despesas)), [atrasadosBrutos, despesas])
  const faturaAnterior = useMemo(() => anteriorInicial.map(l => espelharLancamento(l, despesas)), [anteriorInicial, despesas])

  const [ocupadas, setOcupadas] = useState<Set<string>>(new Set())
  const [abertas, setAbertas] = useState<Set<string>>(new Set(cartaoInicial ? [`f-${cartaoInicial}`] : []))
  const [verCategorias, setVerCategorias] = useState(false)
  const [catAberta, setCatAberta] = useState<string | null>(null)
  const [sheet, setSheet] = useState<'gasto' | 'fatura' | 'tetos' | 'nova' | null>(null)
  const [editando, setEditando] = useState<Lancamento | null>(null)
  const [contaAberta, setContaAberta] = useState<Conta | null>(null)
  const [dizimoAberto, setDizimoAberto] = useState<Conta | null>(null)

  const hoje = hojeISO()
  const contas = montarContas({
    mes: competencia, lancamentos, atrasados, cartoes, despesas, faturasPagas, faturaAnterior,
    rendas, receitas, dizimos, dizimoDesde, verAtrasos, planos, aportes,
  })
  const entradas = montarEntradas(rendas, receitas, competencia)
  const rendaRecebida = receitas.some(r => r.competencia.slice(0, 10) === competencia && r.tipo !== 'saldo')
  const pausadas = despesas.filter(d => !d.ativo && !d.cartao_id && d.inicio)

  // Os números do mês
  const soma = (l: Conta[]) => l.reduce((a, c) => a + c.valor, 0)
  const total = soma(contas)
  const pago = soma(contas.filter(c => c.pago))
  const vencido = soma(contas.filter(c => !c.pago && c.vencimento && c.vencimento < hoje))
  const aPagar = total - pago
  const rendaMes = rendaDoMes(rendas, competencia, receitas)
  const sobra = rendaMes - total

  // ── Ações da planilha

  async function ocupar<T>(chave: string, fn: () => Promise<T>): Promise<T> {
    setOcupadas(prev => new Set(prev).add(chave))
    try { return await fn() } finally {
      setOcupadas(prev => { const n = new Set(prev); n.delete(chave); return n })
    }
  }

  const trocarLancamento = (l: Lancamento) => {
    const t = (x: Lancamento) => (x.id === l.id ? l : x)
    setLancamentos(prev => (prev.some(x => x.id === l.id) ? prev.map(t) : l.competencia === competencia ? [l, ...prev] : prev))
    setAtrasados(prev => prev.map(t))
  }

  /** Conta do cadastro sem registro no mês: cria o registro (com valor e situação escolhidos). */
  async function registrar(c: Conta, campos: { valor: number; pago: boolean }) {
    const d = c.despesa!
    const venc = c.vencimento ?? competencia
    const { data, error } = await supabase.from('fin_lancamentos').insert({
      familia_id: familiaId, user_id: userId, data: venc, vencimento: venc, competencia,
      descricao: d.descricao, categoria: d.categoria, cartao_id: null, origem: 'fixo', despesa_id: d.id, ...campos,
    }).select().single()
    if (error || !data) return alert('Não foi possível salvar. Tente de novo.')
    trocarLancamento(data as Lancamento)
  }

  async function alternar(c: Conta) {
    if (c.tipo === 'conta') {
      if (!c.lancamento) return ocupar(c.chave, () => registrar(c, { valor: c.valor, pago: true }))
      const l = c.lancamento
      trocarLancamento({ ...l, pago: !l.pago }) // otimista
      const { error } = await supabase.from('fin_lancamentos').update({ pago: !l.pago }).eq('id', l.id)
      if (error) { trocarLancamento(l); alert('Não foi possível atualizar. Tente de novo.') }
    } else if (c.tipo === 'fatura' && c.cartao && c.competenciaFatura) {
      const cartaoId = c.cartao.id, comp = c.competenciaFatura
      const antes = faturasPagas
      setFaturasPagas(prev => c.pago
        ? prev.filter(f => !(f.cartao_id === cartaoId && f.competencia.slice(0, 10) === comp))
        : [...prev, { cartao_id: cartaoId, competencia: comp }])
      const { error } = c.pago
        ? await supabase.from('fin_faturas').delete().eq('cartao_id', cartaoId).eq('competencia', comp)
        : await supabase.from('fin_faturas').insert({ familia_id: familiaId, cartao_id: cartaoId, competencia: comp })
      if (error) { setFaturasPagas(antes); alert('Não foi possível atualizar. Tente de novo.') }
    } else if (c.tipo === 'aporte' && c.plano) {
      await gravarAporte(c, { pago: !c.pago })
    } else if (c.tipo === 'dizimo' && c.competenciaDizimo) {
      const comp = c.competenciaDizimo
      const registro = { competencia: comp, valor: c.valor, devolvido_em: hoje }
      const antes = dizimos
      aoDevolver(comp, c.pago ? null : registro)
      const { error } = c.pago
        ? await supabase.from('fin_dizimos').delete().eq('familia_id', familiaId).eq('competencia', comp)
        : await supabase.from('fin_dizimos').upsert({ familia_id: familiaId, ...registro })
      if (error) { setDizimos(antes); alert('Não foi possível atualizar. Tente de novo.') }
    }
  }

  /** Aporte do plano no mês: cria ou atualiza o registro (o "já guardado" do plano soma os pagos). */
  async function gravarAporte(c: Conta, campos: { pago?: boolean; valor?: number }) {
    const plano = c.plano!
    const antes = aportes
    const registro = {
      familia_id: familiaId, plano_id: plano.id, competencia, data: hoje,
      valor: campos.valor ?? c.valor, pago: campos.pago ?? c.pago,
    }
    setAportes(prev => [...prev.filter(a => a.plano_id !== plano.id), { id: c.aporte?.id ?? 'novo', ...registro }])
    const { data, error } = await supabase.from('fin_aportes').upsert(registro, { onConflict: 'plano_id,competencia' }).select().single()
    if (error || !data) { setAportes(antes); return alert('Não foi possível salvar o aporte. Tente de novo.') }
    setAportes(prev => [...prev.filter(a => a.plano_id !== plano.id), data as Aporte])
  }

  async function mudarValor(c: Conta, valor: number) {
    if (c.tipo === 'aporte') return gravarAporte(c, { valor })
    if (!c.lancamento) return ocupar(c.chave, () => registrar(c, { valor, pago: false }))
    const l = c.lancamento
    trocarLancamento({ ...l, valor })
    const { error } = await supabase.from('fin_lancamentos').update({ valor }).eq('id', l.id)
    if (error) { trocarLancamento(l); alert('Não foi possível salvar o valor. Tente de novo.') }
  }

  // ── Mandar o mês: WhatsApp, Excel, PDF

  const [gerando, setGerando] = useState<'xlsx' | 'pdf' | null>(null)

  const paraExportar = (): MesParaExportar => ({
    competencia, hoje, contas, total, pago, aPagar, vencido, renda: rendaMes, rendaRecebida,
    entradas: entradas.map(e => ({ descricao: e.descricao, data: e.data, valor: e.valor, recebida: e.recebida, saldo: e.tipo === 'saldo' })),
  })

  async function exportar(ext: 'xlsx' | 'pdf') {
    setGerando(ext)
    try {
      const m = paraExportar()
      const blob = ext === 'xlsx' ? await gerarExcel(m) : await gerarPdf(m)
      await compartilharArquivo(blob, m, ext)
    } catch {
      alert('Não foi possível gerar o arquivo. Tente de novo.')
    } finally {
      setGerando(null)
    }
  }

  // ── Entradas: o salário previsto vira registro quando cai

  const trocarReceita = (r: Receita) => setReceitas(prev => (prev.some(x => x.id === r.id) ? prev.map(x => (x.id === r.id ? r : x)) : [...prev, r]))

  async function registrarEntrada(e: Entrada, valor: number) {
    const { data, error } = await supabase.from('fin_receitas').insert({
      familia_id: familiaId, user_id: userId, data: e.data ?? hoje, competencia, tipo: e.tipo, valor,
      descricao: e.renda?.descricao ?? null,
    }).select().single()
    if (error || !data) return alert('Não foi possível salvar. Tente de novo.')
    trocarReceita(data as Receita)
  }

  async function alternarEntrada(e: Entrada) {
    if (!e.receita) return ocupar(e.chave, () => registrarEntrada(e, e.valor))
    const r = e.receita
    setReceitas(prev => prev.filter(x => x.id !== r.id)) // volta a ser prevista
    const { error } = await supabase.from('fin_receitas').delete().eq('id', r.id)
    if (error) { trocarReceita(r); alert('Não foi possível desfazer. Tente de novo.') }
  }

  async function valorEntrada(e: Entrada, valor: number) {
    if (!e.receita) return ocupar(e.chave, () => registrarEntrada(e, valor))
    const r = e.receita
    trocarReceita({ ...r, valor })
    const { error } = await supabase.from('fin_receitas').update({ valor }).eq('id', r.id)
    if (error) { trocarReceita(r); alert('Não foi possível salvar o valor. Tente de novo.') }
  }

  function aoDevolver(comp: string, d: DizimoDevolvido | null) {
    setDizimos(prev => [...prev.filter(x => x.competencia.slice(0, 10) !== comp), ...(d ? [d] : [])])
    setDizimoAberto(null)
  }

  async function retomar(d: Despesa) {
    const { error } = await supabase.from('fin_despesas').update({ ativo: true, updated_at: new Date().toISOString() }).eq('id', d.id)
    if (error) return alert('Não foi possível retomar. Tente de novo.')
    refresh()
  }

  function abrir(c: Conta) {
    if (c.tipo === 'dizimo') setDizimoAberto(c)
    else if (c.tipo === 'aporte' && c.plano) router.push(`/financas/planos/${c.plano.id}`)
    else if (c.tipo === 'conta') setContaAberta(c)
  }

  function alternarFatura(chave: string) {
    setAbertas(prev => {
      const n = new Set(prev)
      if (n.has(chave)) n.delete(chave)
      else n.add(chave)
      return n
    })
  }

  // ── Gastos por categoria (o que foi consumido no mês, inclusive no cartão)

  const gasto = lancamentos.reduce((a, l) => a + Number(l.valor), 0)
  const naoEssencial = lancamentos.filter(l => !lancamentoEssencial(l)).reduce((a, l) => a + Number(l.valor), 0)
  const porCategoria = Object.keys(CATEGORIAS_DESPESA)
    .map(cat => {
      const itens = lancamentos.filter(l => l.categoria === cat)
      return { cat, itens, total: itens.reduce((a, l) => a + Number(l.valor), 0), teto: Number(tetos[cat]) || 0 }
    })
    .filter(g => g.itens.length > 0 || g.teto > 0)
    .sort((a, b) => b.total - a.total || b.teto - a.teto)

  function aoSalvarGasto(l: Lancamento) {
    trocarLancamento(l)
    setLancamentos(prev => prev.filter(x => x.competencia === competencia)) // foi para a fatura seguinte
    setEditando(null)
    refresh()
  }

  return (
    <div className="space-y-4 pb-24 lg:pb-8">
      {/* Mês */}
      <div className="flex items-center justify-between">
        <Link href={`/financas/mes?mes=${mesVizinho(competencia, -1)}`} className="-ml-2 p-2 text-muted-foreground hover:text-foreground" aria-label="Mês anterior">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h2 className="font-semibold">{nomeMes(competencia)}</h2>
        <Link href={`/financas/mes?mes=${mesVizinho(competencia, 1)}`} className="-mr-2 p-2 text-muted-foreground hover:text-foreground" aria-label="Próximo mês">
          <ChevronRight className="h-5 w-5" />
        </Link>
      </div>

      {/* Os números: total, pago, a pagar e o que sobra */}
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Contas do mês</p>
            <p className="text-3xl font-semibold tabular-nums">{formatBRL(total)}</p>
          </div>
          {rendaMes > 0 && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{sobra >= 0 ? 'Sobra da renda' : 'Falta na renda'}</p>
              <p className={`text-lg font-semibold tabular-nums ${sobra >= 0 ? 'text-green-700' : 'text-red-600'}`}>{formatBRL(Math.abs(sobra))}</p>
              <p className="text-[11px] text-muted-foreground">renda {rendaRecebida ? 'recebida' : 'prevista'} {formatBRL(rendaMes)}</p>
            </div>
          )}
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-red-100">
          <div className="h-full bg-green-600 transition-all" style={{ width: `${total > 0 ? (pago / total) * 100 : 0}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[11px] text-muted-foreground">Pago</p>
            <p className="text-sm font-semibold tabular-nums text-green-700">{formatBRL(pago)}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">A pagar</p>
            <p className="text-sm font-semibold tabular-nums text-red-600">{formatBRL(aPagar)}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Vencido</p>
            <p className={`text-sm font-semibold tabular-nums ${vencido > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>{formatBRL(vencido)}</p>
          </div>
        </div>
      </div>

      {/* Mandar o mês adiante */}
      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={() => abrirWhatsApp(paraExportar())} className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card py-2 text-xs font-medium hover:bg-secondary">
          <MessageCircle className="h-4 w-4 text-green-600" /> WhatsApp
        </button>
        <button type="button" onClick={() => exportar('xlsx')} disabled={!!gerando} className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card py-2 text-xs font-medium hover:bg-secondary disabled:opacity-50">
          {gerando === 'xlsx' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 text-emerald-700" />} Excel
        </button>
        <button type="button" onClick={() => exportar('pdf')} disabled={!!gerando} className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card py-2 text-xs font-medium hover:bg-secondary disabled:opacity-50">
          {gerando === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4 text-red-600" />} PDF
        </button>
      </div>

      {/* O que entra para pagar o mês */}
      <Entradas
        entradas={entradas}
        ocupadas={ocupadas}
        onAlternar={alternarEntrada}
        onValor={valorEntrada}
        onAbrir={e => setReceitaAberta({ entrada: e })}
        onNova={() => setReceitaAberta({ entrada: null })}
      />

      {/* A planilha */}
      <ContasLista
        contas={contas}
        hoje={hoje}
        ocupadas={ocupadas}
        abertas={abertas}
        pausadas={pausadas}
        onAlternar={alternar}
        onValor={mudarValor}
        onAbrir={abrir}
        onExpandir={alternarFatura}
        onLinha={l => setEditando(l)}
        onRetomar={retomar}
        onNova={() => setSheet('nova')}
      />
      <p className="px-1 text-xs text-muted-foreground">
        Toque no círculo para marcar como pago. Toque no valor para mudar. Toque no nome para vencimento e outros detalhes.
      </p>

      {/* Gastos por categoria: recolhido, para quem quer olhar onde o dinheiro foi */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <button
          type="button"
          onClick={() => setVerCategorias(v => !v)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-secondary/40"
        >
          <span className="flex items-center gap-1.5 text-sm font-medium">
            Para onde foi o dinheiro
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${verCategorias ? 'rotate-180' : ''}`} />
          </span>
          <span className="text-right">
            <span className="block text-sm font-semibold tabular-nums">{formatBRL(gasto)}</span>
            {naoEssencial > 0 && <span className="block text-[11px] text-amber-700">{formatBRL(naoEssencial)} não essenciais</span>}
          </span>
        </button>

        {verCategorias && (
          <div className="border-t border-border">
            <div className="flex gap-2 px-4 py-3">
              <button type="button" onClick={() => setSheet('fatura')} className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-secondary">
                <FileUp className="h-3.5 w-3.5 text-primary" /> Importar fatura
              </button>
              <button type="button" onClick={() => setSheet('tetos')} className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-secondary">
                <SlidersHorizontal className="h-3.5 w-3.5 text-primary" /> Limites
              </button>
            </div>
            {porCategoria.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground">Nada lançado ainda.</p>
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {porCategoria.map(({ cat, itens, total: t, teto }) => {
                  const p = teto > 0 ? (t / teto) * 100 : 0
                  return (
                    <li key={cat}>
                      <button type="button" onClick={() => setCatAberta(catAberta === cat ? null : cat)} className="w-full space-y-1.5 px-4 py-2.5 text-left">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span>{CATEGORIAS_DESPESA[cat].label}</span>
                          <span className="tabular-nums">
                            <strong className={p > 100 ? 'text-red-600' : ''}>{formatBRL(t)}</strong>
                            {teto > 0 && <span className="text-xs text-muted-foreground"> / {formatBRL(teto)}</span>}
                          </span>
                        </div>
                        {teto > 0 && (
                          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                            <div className={`h-full rounded-full ${p >= 100 ? 'bg-red-500' : p >= 80 ? 'bg-amber-500' : 'bg-green-600'}`} style={{ width: `${Math.min(p, 100)}%` }} />
                          </div>
                        )}
                      </button>
                      {catAberta === cat && (
                        <ul className="max-h-72 divide-y divide-border overflow-y-auto bg-secondary/30">
                          {itens.map(l => (
                            <li key={l.id}>
                              <button type="button" onClick={() => setEditando(l)} className="flex w-full items-center gap-3 px-4 py-2 text-left text-xs hover:bg-secondary">
                                <span className="min-w-0 flex-1 truncate">{l.descricao}</span>
                                <span className="text-muted-foreground">{l.data.slice(8, 10)}/{l.data.slice(5, 7)}</span>
                                <span className="w-24 text-right tabular-nums">{formatBRL(Number(l.valor))}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Gasto do dia a dia */}
      <button
        type="button"
        onClick={() => setSheet('gasto')}
        aria-label="Lançar gasto"
        className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 lg:bottom-8 lg:right-8"
      >
        <Plus className="h-6 w-6" />
      </button>

      {(sheet === 'gasto' || editando) && (
        <LancamentoSheet
          familiaId={familiaId}
          userId={userId}
          cartoes={cartoes}
          planoPrincipal={plano}
          rendaMensal={renda}
          lancamento={editando}
          onSaved={aoSalvarGasto}
          onDeleted={id => {
            setLancamentos(prev => prev.filter(l => l.id !== id))
            setAtrasados(prev => prev.filter(l => l.id !== id))
            setEditando(null)
            refresh()
          }}
          onClose={() => { setSheet(null); setEditando(null) }}
        />
      )}
      {sheet === 'nova' && (
        <NovaContaSheet
          familiaId={familiaId}
          userId={userId}
          onSaved={mes => {
            setSheet(null)
            if (mes === competencia) refresh()
            else router.push(`/financas/mes?mes=${mes.slice(0, 7)}`)
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {contaAberta && (
        <ContaSheet
          familiaId={familiaId}
          userId={userId}
          competencia={contaAberta.lancamento?.competencia ?? competencia}
          conta={contaAberta}
          onSaved={l => { trocarLancamento(l); setContaAberta(null) }}
          onDeleted={id => {
            setLancamentos(prev => prev.filter(l => l.id !== id))
            setAtrasados(prev => prev.filter(l => l.id !== id))
            setContaAberta(null)
          }}
          onCadastroAlterado={refresh}
          onClose={() => setContaAberta(null)}
        />
      )}
      {receitaAberta && (
        <ReceitaSheet
          familiaId={familiaId}
          userId={userId}
          receita={receitaAberta.entrada?.receita ?? null}
          inicial={receitaAberta.entrada && !receitaAberta.entrada.receita ? receitaAberta.entrada : undefined}
          onSaved={r => {
            setReceitaAberta(null)
            if (r.competencia.slice(0, 10) === competencia) trocarReceita(r)
            else setReceitas(prev => prev.filter(x => x.id !== r.id)) // passou a pagar outro mês
          }}
          onDeleted={id => { setReceitas(prev => prev.filter(x => x.id !== id)); setReceitaAberta(null) }}
          onClose={() => setReceitaAberta(null)}
        />
      )}
      {dizimoAberto && (
        <DizimoSheet familiaId={familiaId} saida={dizimoAberto} onSaved={aoDevolver} onClose={() => setDizimoAberto(null)} />
      )}
      {sheet === 'fatura' && (
        <ImportarFatura
          familiaId={familiaId}
          userId={userId}
          cartoes={cartoes}
          competencia={competencia}
          plano={plano}
          renda={renda}
          onImported={novos => {
            setLancamentos(prev => [...novos.filter(l => l.competencia === competencia), ...prev])
            setSheet(null)
            refresh()
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'tetos' && (
        <TetosSheet
          familiaId={familiaId}
          tetos={tetos}
          despesas={despesas}
          onSaved={t => { setTetos(t); setSheet(null); refresh() }}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  )
}
