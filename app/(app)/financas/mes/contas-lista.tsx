'use client'

import { useState } from 'react'
import { CheckCircle2, ChevronDown, Circle, CreditCard, Loader2, PauseCircle, Plus } from 'lucide-react'
import { formatBRL, nomeMes, parseBRL, type Despesa, type Lancamento } from '@/lib/financas'
import type { Conta } from '@/lib/contas'

interface Props {
  contas: Conta[]
  hoje: string
  ocupadas: Set<string>
  abertas: Set<string> // faturas expandidas
  pausadas: Despesa[]
  onAlternar: (c: Conta) => void // pago ↔ a pagar
  onValor: (c: Conta, valor: number) => void
  onAbrir: (c: Conta) => void
  onExpandir: (chave: string) => void
  onLinha: (l: Lancamento) => void
  onRetomar: (d: Despesa) => void
  onNova: () => void
}

const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/** A planilha do mês: uma linha por conta, valor em vermelho (a pagar) ou verde (pago). */
export default function ContasLista({
  contas, hoje, ocupadas, abertas, pausadas, onAlternar, onValor, onAbrir, onExpandir, onLinha, onRetomar, onNova,
}: Props) {
  const [editando, setEditando] = useState<{ chave: string; texto: string } | null>(null)
  const [verPausadas, setVerPausadas] = useState(false)

  function salvarValor(c: Conta) {
    if (!editando) return
    const v = parseBRL(editando.texto)
    setEditando(null)
    if (v !== null && Math.abs(v - c.valor) >= 0.005) onValor(c, v)
  }

  const linha = (c: Conta) => {
    const ocupada = ocupadas.has(c.chave)
    const vencida = !c.pago && !!c.vencimento && c.vencimento < hoje
    const dizimo = c.tipo === 'dizimo'
    const fatura = c.tipo === 'fatura'
    const aberta = abertas.has(c.chave)
    const Icone = ocupada ? Loader2 : c.pago ? CheckCircle2 : Circle
    const corValor = c.pago ? 'text-green-700' : 'text-red-600'
    const emEdicao = editando?.chave === c.chave

    return (
      <li key={c.chave} className={dizimo ? 'bg-amber-50/70 text-gray-900' : ''}>
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => onAlternar(c)}
            disabled={ocupada}
            aria-label={c.pago ? 'Marcar como a pagar' : dizimo ? 'Marcar como devolvido' : 'Marcar como pago'}
            className="flex h-14 w-12 flex-shrink-0 items-center justify-center"
          >
            <Icone className={`h-6 w-6 ${ocupada ? 'animate-spin text-muted-foreground' : c.pago ? 'text-green-600' : vencida ? 'text-red-500' : dizimo ? 'text-amber-600' : 'text-muted-foreground/60'}`} />
          </button>

          <button
            type="button"
            onClick={() => (fatura ? onExpandir(c.chave) : onAbrir(c))}
            className="min-w-0 flex-1 py-2.5 text-left"
          >
            <p className={`flex items-center gap-1.5 text-sm ${c.pago ? 'text-muted-foreground' : 'font-medium'}`}>
              {fatura && <CreditCard className="h-3.5 w-3.5 flex-shrink-0 text-primary" />}
              <span className="truncate">
                {c.descricao}
                {dizimo && c.atrasada && c.competenciaDizimo ? ` de ${nomeMes(c.competenciaDizimo).split(' ')[0].toLowerCase()}` : ''}
              </span>
              {c.parcela && <span className="flex-shrink-0 rounded bg-secondary px-1.5 text-[11px] font-normal text-muted-foreground">{c.parcela}</span>}
              {fatura && <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 text-muted-foreground transition-transform ${aberta ? 'rotate-180' : ''}`} />}
            </p>
            <p className="text-xs text-muted-foreground">
              {dizimo
                ? c.pago && c.vencimento ? `devolvido ${diaMes(c.vencimento)}` : `10% de ${formatBRL(c.renda ?? 0)}`
                : c.vencimento
                  ? <span className={vencida ? 'font-medium text-red-600' : ''}>{vencida ? 'venceu' : c.pago ? 'vencimento' : 'vence'} {diaMes(c.vencimento)}</span>
                  : 'sem vencimento'}
              {c.atrasada && !c.pago && <span className="text-red-600"> · em aberto</span>}
              {fatura && c.linhas && <> · {c.linhas.length} {c.linhas.length === 1 ? 'compra' : 'compras'}</>}
            </p>
          </button>

          {emEdicao ? (
            <input
              autoFocus
              inputMode="decimal"
              value={editando.texto}
              onChange={e => setEditando({ chave: c.chave, texto: e.target.value })}
              onBlur={() => salvarValor(c)}
              onKeyDown={e => { if (e.key === 'Enter') salvarValor(c); if (e.key === 'Escape') setEditando(null) }}
              className="mr-3 w-28 rounded-md border border-primary bg-background px-2 py-1.5 text-right text-sm tabular-nums focus:outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => (c.tipo === 'conta' ? setEditando({ chave: c.chave, texto: c.valor.toFixed(2).replace('.', ',') }) : fatura ? onExpandir(c.chave) : onAbrir(c))}
              title={c.tipo === 'conta' ? 'Tocar para mudar o valor' : undefined}
              className={`py-3 pl-2 pr-4 text-right text-sm tabular-nums ${corValor} ${vencida ? 'font-bold' : 'font-semibold'}`}
            >
              {formatBRL(c.valor)}
            </button>
          )}
        </div>

        {fatura && aberta && (
          <ul className="max-h-72 divide-y divide-border overflow-y-auto overscroll-contain border-t border-border bg-secondary/30">
            {(c.linhas ?? []).map(l => (
              <li key={l.id}>
                <button type="button" onClick={() => onLinha(l)} className="flex w-full items-center gap-3 py-2 pl-12 pr-4 text-left hover:bg-secondary/60">
                  <span className="min-w-0 flex-1 truncate text-xs">
                    {l.descricao}
                    {l.parcelas_total ? <span className="text-muted-foreground"> · {l.parcela_atual}/{l.parcelas_total}</span> : null}
                  </span>
                  <span className="text-xs text-muted-foreground">{diaMes(l.data)}</span>
                  <span className={`w-24 text-right text-xs tabular-nums ${Number(l.valor) < 0 ? 'text-green-700' : ''}`}>{formatBRL(Number(l.valor))}</span>
                </button>
              </li>
            ))}
            {!!c.previstoNaFatura && (
              <li className="flex items-center justify-between py-2 pl-12 pr-4 text-xs text-muted-foreground">
                <span>Fixos e parcelas que ainda vão entrar</span>
                <span className="tabular-nums">{formatBRL(c.previstoNaFatura)}</span>
              </li>
            )}
          </ul>
        )}
      </li>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {contas.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma conta neste mês.</p>
      ) : (
        <ul className="divide-y divide-border">{contas.map(linha)}</ul>
      )}

      <button
        type="button"
        onClick={onNova}
        className="flex w-full items-center gap-2 border-t border-border px-4 py-3 text-sm font-medium text-primary hover:bg-secondary/50"
      >
        <Plus className="h-4 w-4" /> Nova conta
      </button>

      {pausadas.length > 0 && (
        <div className="border-t border-border">
          <button
            type="button"
            onClick={() => setVerPausadas(v => !v)}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-xs text-muted-foreground hover:bg-secondary/50"
          >
            <PauseCircle className="h-3.5 w-3.5" />
            {pausadas.length} {pausadas.length === 1 ? 'conta pausada' : 'contas pausadas'}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${verPausadas ? 'rotate-180' : ''}`} />
          </button>
          {verPausadas && (
            <ul className="divide-y divide-border bg-secondary/30">
              {pausadas.map(d => (
                <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                  <span className="min-w-0 truncate text-muted-foreground">{d.descricao} · {formatBRL(Number(d.valor))}</span>
                  <button type="button" onClick={() => onRetomar(d)} className="text-xs font-medium text-primary">retomar</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
