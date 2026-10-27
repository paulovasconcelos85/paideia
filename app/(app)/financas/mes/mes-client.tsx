'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronLeft, ChevronRight, CreditCard, FileUp, ListChecks, Plus, SlidersHorizontal } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  CATEGORIAS_DESPESA, despesaMensal, espelharLancamento, formatBRL, formatDiaMes, hojeISO, lancamentoEssencial, nomeMes, parcelasRestantes,
  type Cartao, type Despesa, type FaturaPaga, type Lancamento, type Plano,
} from '@/lib/financas'
import { dataPagamento, montarSaidas, type Saida } from '@/lib/saidas'
import LancamentoSheet from '../_components/lancamento-sheet'
import SaidasLista from './saidas-lista'
import ImportarFatura from './importar-fatura'
import TetosSheet from './tetos-sheet'
import FixosSheet from './fixos-sheet'

interface Props {
  familiaId: string
  userId: string
  competencia: string
  tetos: Record<string, number>
  lancamentos: Lancamento[]
  cartoes: Cartao[]
  despesas: Despesa[]
  plano: Plano | null
  renda: number
  cartaoInicial: string | null // vindo de Gastos fixos: abre a lista daquele cartão
  faturasPagas: FaturaPaga[]
  faturaAnterior: Pick<Lancamento, 'cartao_id' | 'valor'>[]
  atrasados: Lancamento[] // fora do cartão, pendentes de meses anteriores
}

function mesVizinho(competencia: string, delta: number) {
  const d = new Date(`${competencia}T12:00:00`)
  const v = new Date(d.getFullYear(), d.getMonth() + delta, 1)
  return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}`
}

export default function MesClient({
  familiaId, userId, competencia, tetos: tetosIniciais, lancamentos: iniciais, cartoes, despesas, plano, renda, cartaoInicial,
  faturasPagas: faturasIniciais, faturaAnterior, atrasados: atrasadosIniciais,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [, startTransition] = useTransition()
  const [brutos, setLancamentos] = useState(iniciais)
  useEffect(() => { setLancamentos(iniciais) }, [iniciais])
  // O que está ligado a "Fixos e parcelas" aparece com o nome, a categoria e a parcela de lá
  const lancamentos = useMemo(() => brutos.map(l => espelharLancamento(l, despesas)), [brutos, despesas])
  const [tetos, setTetos] = useState(tetosIniciais)
  const [aberta, setAberta] = useState<string | null>(null)
  // Por categoria (resumo) ou em lista (todas as linhas, para conferir com a fatura)
  const [visao, setVisao] = useState<'categorias' | 'lista' | 'saidas'>(cartaoInicial ? 'lista' : 'categorias')
  const [faturasPagas, setFaturasPagas] = useState(faturasIniciais)
  useEffect(() => { setFaturasPagas(faturasIniciais) }, [faturasIniciais])
  const [atrasadosBrutos, setAtrasados] = useState(atrasadosIniciais)
  useEffect(() => { setAtrasados(atrasadosIniciais) }, [atrasadosIniciais])
  const atrasados = useMemo(() => atrasadosBrutos.map(l => espelharLancamento(l, despesas)), [atrasadosBrutos, despesas])
  const [ocupadas, setOcupadas] = useState<Set<string>>(new Set())
  const [filtro, setFiltro] = useState<string>(cartaoInicial ?? 'todos') // 'todos' | 'fora' | id do cartão
  const [sheet, setSheet] = useState<'novo' | 'fatura' | 'tetos' | 'fixos' | null>(null)
  const [editando, setEditando] = useState<Lancamento | null>(null)

  const refresh = () => startTransition(() => router.refresh())

  const gasto = lancamentos.reduce((a, l) => a + Number(l.valor), 0)
  const naoEssencial = lancamentos.filter(l => !lancamentoEssencial(l)).reduce((a, l) => a + Number(l.valor), 0)
  const totalTetos = Object.values(tetos).reduce((a, v) => a + Number(v), 0)
  const planejado = totalTetos > 0 ? totalTetos : despesas.reduce((a, d) => a + despesaMensal(d), 0)
  const restante = planejado - gasto
  const pct = planejado > 0 ? Math.min((gasto / planejado) * 100, 100) : 0

  // Fixos do orçamento que ainda não viraram lançamento neste mês
  const lancadosIds = new Set(lancamentos.map(l => l.despesa_id).filter(Boolean))
  const fixosPendentes = despesas.filter(d =>
    d.ativo && !lancadosIds.has(d.id) &&
    (d.frequencia === 'mensal' || (d.frequencia === 'parcelada' && (parcelasRestantes(d, new Date(`${competencia}T12:00:00`)) ?? 1) > 0))
  )

  // O que sai da conta neste mês, pela data em que sai
  const saidas = montarSaidas({ mes: competencia, lancamentos, atrasados, cartoes, faturasPagas, faturaAnterior, fixosPendentes })
  const hoje = hojeISO()
  const faltaSair = saidas.filter(s => !s.pago).reduce((a, s) => a + s.valor, 0)
  const vencidas = saidas.filter(s => !s.pago && s.data && s.data < hoje).length

  const porCategoria = Object.keys(CATEGORIAS_DESPESA)
    .map(cat => {
      const itens = lancamentos.filter(l => l.categoria === cat)
      return { cat, itens, total: itens.reduce((a, l) => a + Number(l.valor), 0), teto: Number(tetos[cat]) || 0 }
    })
    .filter(g => g.itens.length > 0 || g.teto > 0)
    .sort((a, b) => b.total - a.total || b.teto - a.teto)

  const nomeCartao = (id: string | null) => cartoes.find(c => c.id === id)?.nome
  const porCartao = cartoes
    .map(c => ({ cartao: c, total: lancamentos.filter(l => l.cartao_id === c.id).reduce((a, l) => a + Number(l.valor), 0) }))
    .filter(x => x.total !== 0)
  const foraDoCartao = lancamentos.filter(l => !l.cartao_id).reduce((a, l) => a + Number(l.valor), 0)
  const filtrados = lancamentos.filter(l => filtro === 'todos' || (filtro === 'fora' ? !l.cartao_id : l.cartao_id === filtro))
  const chipFiltro = (ativo: boolean) =>
    `flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
      ativo ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card hover:bg-secondary'
    }`
  const filtrar = (f: string) => { setFiltro(f); setVisao('lista') }

  function aoSalvar(l: Lancamento) {
    setAtrasados(prev => prev.map(x => x.id === l.id ? l : x).filter(x => !x.pago && !x.cartao_id && x.competencia < competencia))
    setLancamentos(prev => {
      const existe = prev.some(x => x.id === l.id)
      const lista = existe ? prev.map(x => x.id === l.id ? l : x) : [l, ...prev]
      return lista.filter(x => x.competencia === competencia) // foi para outro mês (fatura seguinte)
    })
    setEditando(null) // edição fecha; lançamento novo deixa a janela aberta para o próximo
    refresh()
  }

  async function marcar(s: Saida, fn: () => Promise<{ error: unknown }>) {
    setOcupadas(prev => new Set(prev).add(s.chave))
    const { error } = await fn()
    setOcupadas(prev => { const n = new Set(prev); n.delete(s.chave); return n })
    if (error) alert('Não foi possível atualizar. Tente de novo.')
    return !error
  }

  // Círculo da lista de saídas: paga ou volta para pendente
  async function alternar(s: Saida) {
    if (s.tipo === 'conta' && s.lancamento) {
      const l = s.lancamento
      const ok = await marcar(s, async () => await supabase.from('fin_lancamentos').update({ pago: !l.pago }).eq('id', l.id))
      if (!ok) return
      const trocar = (x: Lancamento) => x.id === l.id ? { ...x, pago: !l.pago } : x
      setLancamentos(prev => prev.map(trocar))
      setAtrasados(prev => prev.map(trocar))
    } else if (s.tipo === 'fatura' && s.cartao && s.competenciaFatura) {
      const cartaoId = s.cartao.id, comp = s.competenciaFatura
      const ok = await marcar(s, async () => s.pago
        ? await supabase.from('fin_faturas').delete().eq('cartao_id', cartaoId).eq('competencia', comp)
        : await supabase.from('fin_faturas').insert({ familia_id: familiaId, cartao_id: cartaoId, competencia: comp }))
      if (!ok) return
      setFaturasPagas(prev => s.pago
        ? prev.filter(f => !(f.cartao_id === cartaoId && f.competencia.slice(0, 10) === comp))
        : [...prev, { cartao_id: cartaoId, competencia: comp }])
    } else if (s.tipo === 'previsto' && s.despesa) {
      // Fixo do orçamento pago: vira lançamento do mês, já marcado como pago
      const d = s.despesa
      const data = s.data ?? (hoje.slice(0, 7) === competencia.slice(0, 7) ? hoje : competencia)
      let salvo: Lancamento | null = null
      const ok = await marcar(s, async () => {
        const r = await supabase.from('fin_lancamentos').insert({
          familia_id: familiaId, user_id: userId, data, vencimento: data, competencia, pago: true,
          descricao: d.descricao, valor: d.valor, categoria: d.categoria, cartao_id: null, origem: 'fixo', despesa_id: d.id,
        }).select().single()
        salvo = r.data as Lancamento | null
        return r
      })
      if (!ok || !salvo) return
      const novo: Lancamento = salvo
      setLancamentos(prev => [novo, ...prev])
    }
    refresh()
  }

  function abrir(s: Saida) {
    if (s.lancamento) return setEditando(s.lancamento)
    if (s.tipo === 'previsto') return setSheet('fixos')
    if (s.cartao && s.competenciaFatura) {
      if (s.competenciaFatura === competencia) return filtrar(s.cartao.id)
      router.push(`/financas/mes?mes=${s.competenciaFatura.slice(0, 7)}&cartao=${s.cartao.id}`)
    }
  }

  function aoImportar(novos: Lancamento[]) {
    setLancamentos(prev => [...novos.filter(l => l.competencia === competencia), ...prev])
    setSheet(null)
    refresh()
  }

  return (
    <div className="space-y-5 pb-20 lg:pb-0">
      {/* Navegação entre meses */}
      <div className="flex items-center justify-between">
        <Link href={`/financas/mes?mes=${mesVizinho(competencia, -1)}`} className="p-2 -ml-2 text-muted-foreground hover:text-foreground" aria-label="Mês anterior">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h2 className="font-semibold">{nomeMes(competencia)}</h2>
        <Link href={`/financas/mes?mes=${mesVizinho(competencia, 1)}`} className="p-2 -mr-2 text-muted-foreground hover:text-foreground" aria-label="Próximo mês">
          <ChevronRight className="h-5 w-5" />
        </Link>
      </div>

      {/* O número que importa */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Gasto no mês</p>
            <p className="text-3xl font-semibold tabular-nums">{formatBRL(gasto)}</p>
            {naoEssencial > 0 && (
              <p className="text-xs text-amber-700">{formatBRL(naoEssencial)} não essenciais ({gasto > 0 ? Math.round((naoEssencial / gasto) * 100) : 0}%)</p>
            )}
          </div>
          {planejado > 0 && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{restante >= 0 ? 'Ainda pode gastar' : 'Passou do limite'}</p>
              <p className={`text-lg font-semibold tabular-nums ${restante >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {formatBRL(Math.abs(restante))}
              </p>
            </div>
          )}
        </div>
        {planejado > 0 && (
          <>
            <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
              <div
                className={`h-full rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-green-600'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              de {formatBRL(planejado)} {totalTetos > 0 ? 'nos limites do mês' : 'previstos no orçamento'}
            </p>
          </>
        )}
        {faltaSair > 0 && (
          <button
            type="button"
            onClick={() => setVisao('saidas')}
            className="flex w-full items-center justify-between gap-2 border-t border-border pt-3 text-left text-sm"
          >
            <span className="text-muted-foreground">
              Falta sair da conta
              {vencidas > 0 && <span className="ml-1.5 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">{vencidas} {vencidas === 1 ? 'vencida' : 'vencidas'}</span>}
            </span>
            <span className="flex items-center gap-1 font-semibold tabular-nums">
              {formatBRL(faltaSair)} <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </span>
          </button>
        )}
      </div>

      {(porCartao.length > 0 || foraDoCartao !== 0) && (
        <div className="flex flex-wrap gap-2">
          {porCartao.map(({ cartao, total }) => (
            <button key={cartao.id} type="button" onClick={() => filtrar(cartao.id)} className={chipFiltro(visao === 'lista' && filtro === cartao.id)}>
              <CreditCard className="h-3 w-3 text-primary" /> {cartao.nome}: <strong className="tabular-nums">{formatBRL(total)}</strong>
            </button>
          ))}
          {foraDoCartao !== 0 && (
            <button type="button" onClick={() => filtrar('fora')} className={chipFiltro(visao === 'lista' && filtro === 'fora')}>
              Pix / débito: <strong className="tabular-nums">{formatBRL(foraDoCartao)}</strong>
            </button>
          )}
        </div>
      )}

      {/* Ações do mês */}
      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={() => setSheet('fatura')} className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card px-2 py-3 text-xs hover:bg-secondary">
          <FileUp className="h-5 w-5 text-primary" /> Importar fatura
        </button>
        <button type="button" onClick={() => setSheet('fixos')} className="relative flex flex-col items-center gap-1 rounded-lg border border-border bg-card px-2 py-3 text-xs hover:bg-secondary">
          <ListChecks className="h-5 w-5 text-primary" /> Lançar fixos
          {fixosPendentes.length > 0 && (
            <span className="absolute right-2 top-2 rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">
              {fixosPendentes.length}
            </span>
          )}
        </button>
        <button type="button" onClick={() => setSheet('tetos')} className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card px-2 py-3 text-xs hover:bg-secondary">
          <SlidersHorizontal className="h-5 w-5 text-primary" /> Limites
        </button>
      </div>

      {/* Resumo por categoria ou todas as linhas */}
      {(lancamentos.length > 0 || saidas.length > 0) && (
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex rounded-lg bg-secondary p-1">
            {(['categorias', 'lista', 'saidas'] as const).map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setVisao(v)}
                className={`rounded-md px-3 py-1.5 text-sm ${visao === v ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground'}`}
              >
                {v === 'categorias' ? 'Categorias' : v === 'lista' ? 'Linhas' : 'Saídas'}
              </button>
            ))}
          </div>
          {visao === 'lista' && filtro !== 'todos' && (
            <button type="button" onClick={() => setFiltro('todos')} className="text-xs text-primary">ver todos</button>
          )}
        </div>
      )}

      {visao === 'saidas' ? (
        <SaidasLista mes={competencia} saidas={saidas} ocupadas={ocupadas} onAlternar={alternar} onAbrir={abrir} />
      ) : visao === 'lista' ? (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-border bg-secondary/40 px-4 py-2.5 text-sm">
            <span>{filtrados.length} {filtrados.length === 1 ? 'lançamento' : 'lançamentos'}</span>
            <strong className="tabular-nums">{formatBRL(filtrados.reduce((a, l) => a + Number(l.valor), 0))}</strong>
          </div>
          {filtrados.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Nenhum lançamento aqui neste mês.</p>
          ) : (
            <ul className="divide-y divide-border">
              {filtrados.map(l => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => setEditando(l)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-secondary/60 hover:bg-secondary/30"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{l.descricao}</p>
                      <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                        {new Date(`${l.data}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                        <span className={`rounded px-1.5 ${CATEGORIAS_DESPESA[l.categoria]?.className ?? ''}`}>
                          {CATEGORIAS_DESPESA[l.categoria]?.label ?? l.categoria}
                        </span>
                        {filtro === 'todos' && l.cartao_id && <span>{nomeCartao(l.cartao_id)}</span>}
                        {l.parcelas_total && <span>{l.parcela_atual}/{l.parcelas_total}</span>}
                        {!l.cartao_id && !l.pago && <span className="rounded bg-amber-100 px-1.5 text-amber-800">a pagar · {formatDiaMes(dataPagamento(l))}</span>}
                      </p>
                    </div>
                    <span className={`text-sm tabular-nums ${Number(l.valor) < 0 ? 'text-green-700' : ''}`}>{formatBRL(Number(l.valor))}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : porCategoria.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nada lançado em {nomeMes(competencia).toLowerCase()}. Toque no <strong>+</strong> a cada gasto, ou importe a fatura do cartão.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
          {porCategoria.map(({ cat, itens, total, teto }) => {
            const p = teto > 0 ? (total / teto) * 100 : 0
            const expandida = aberta === cat
            return (
              <div key={cat}>
                <button
                  type="button"
                  onClick={() => setAberta(expandida ? null : cat)}
                  className="w-full px-4 py-3 text-left space-y-1.5 active:bg-secondary/60"
                >
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-1.5">
                      {CATEGORIAS_DESPESA[cat].label}
                      {itens.length > 0 && <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expandida ? 'rotate-180' : ''}`} />}
                    </span>
                    <span className="tabular-nums">
                      <strong className={p > 100 ? 'text-red-600' : ''}>{formatBRL(total)}</strong>
                      {teto > 0 && <span className="text-xs text-muted-foreground"> / {formatBRL(teto)}</span>}
                    </span>
                  </div>
                  {teto > 0 && (
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div
                        className={`h-full rounded-full ${p >= 100 ? 'bg-red-500' : p >= 80 ? 'bg-amber-500' : 'bg-green-600'}`}
                        style={{ width: `${Math.min(p, 100)}%` }}
                      />
                    </div>
                  )}
                </button>
                {expandida && (
                  <ul className="bg-secondary/30 divide-y divide-border">
                    {itens.map(l => (
                      <li key={l.id}>
                        <button
                          type="button"
                          onClick={() => setEditando(l)}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-secondary"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm">{l.descricao}</p>
                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                              {new Date(`${l.data}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                              {l.cartao_id && <><CreditCard className="ml-1 h-3 w-3" /> {nomeCartao(l.cartao_id)}</>}
                              {l.parcelas_total && ` · ${l.parcela_atual}/${l.parcelas_total}`}
                              {!l.cartao_id && !l.pago && <span className="ml-1 rounded bg-amber-100 px-1.5 text-amber-800">a pagar · {formatDiaMes(dataPagamento(l))}</span>}
                            </p>
                          </div>
                          <span className={`text-sm tabular-nums ${Number(l.valor) < 0 ? 'text-green-700' : ''}`}>{formatBRL(Number(l.valor))}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => setSheet('novo')}
        aria-label="Lançar gasto"
        className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] lg:bottom-8 lg:right-8 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95"
      >
        <Plus className="h-6 w-6" />
      </button>

      {(sheet === 'novo' || editando) && (
        <LancamentoSheet
          familiaId={familiaId}
          userId={userId}
          cartoes={cartoes}
          planoPrincipal={plano}
          rendaMensal={renda}
          lancamento={editando}
          onSaved={aoSalvar}
          onDeleted={id => {
            setLancamentos(prev => prev.filter(l => l.id !== id))
            setAtrasados(prev => prev.filter(l => l.id !== id))
            setEditando(null)
            refresh()
          }}
          onClose={() => { setSheet(null); setEditando(null) }}
        />
      )}
      {sheet === 'fatura' && (
        <ImportarFatura
          familiaId={familiaId}
          userId={userId}
          cartoes={cartoes}
          competencia={competencia}
          plano={plano}
          renda={renda}
          onImported={aoImportar}
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
      {sheet === 'fixos' && (
        <FixosSheet
          familiaId={familiaId}
          userId={userId}
          competencia={competencia}
          pendentes={fixosPendentes}
          cartoes={cartoes}
          onSaved={aoImportar}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  )
}
