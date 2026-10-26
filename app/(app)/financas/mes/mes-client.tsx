'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronLeft, ChevronRight, CreditCard, FileUp, ListChecks, Plus, SlidersHorizontal } from 'lucide-react'
import {
  CATEGORIAS_DESPESA, despesaMensal, formatBRL, lancamentoEssencial, nomeMes, parcelasRestantes,
  type Cartao, type Despesa, type Lancamento, type Plano,
} from '@/lib/financas'
import LancamentoSheet from '../_components/lancamento-sheet'
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
}

function mesVizinho(competencia: string, delta: number) {
  const d = new Date(`${competencia}T12:00:00`)
  const v = new Date(d.getFullYear(), d.getMonth() + delta, 1)
  return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}`
}

export default function MesClient({
  familiaId, userId, competencia, tetos: tetosIniciais, lancamentos: iniciais, cartoes, despesas, plano, renda, cartaoInicial,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [lancamentos, setLancamentos] = useState(iniciais)
  const [tetos, setTetos] = useState(tetosIniciais)
  const [aberta, setAberta] = useState<string | null>(null)
  // Por categoria (resumo) ou em lista (todas as linhas, para conferir com a fatura)
  const [visao, setVisao] = useState<'categorias' | 'lista'>(cartaoInicial ? 'lista' : 'categorias')
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
    setLancamentos(prev => {
      const existe = prev.some(x => x.id === l.id)
      const lista = existe ? prev.map(x => x.id === l.id ? l : x) : [l, ...prev]
      return lista.filter(x => x.competencia === competencia) // foi para outro mês (fatura seguinte)
    })
    setEditando(null) // edição fecha; lançamento novo deixa a janela aberta para o próximo
    refresh()
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
      {lancamentos.length > 0 && (
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex rounded-lg bg-secondary p-1">
            {(['categorias', 'lista'] as const).map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setVisao(v)}
                className={`rounded-md px-3 py-1.5 text-sm ${visao === v ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground'}`}
              >
                {v === 'categorias' ? 'Por categoria' : 'Todas as linhas'}
              </button>
            ))}
          </div>
          {visao === 'lista' && filtro !== 'todos' && (
            <button type="button" onClick={() => setFiltro('todos')} className="text-xs text-primary">ver todos</button>
          )}
        </div>
      )}

      {visao === 'lista' ? (
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
          onDeleted={id => { setLancamentos(prev => prev.filter(l => l.id !== id)); setEditando(null); refresh() }}
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
