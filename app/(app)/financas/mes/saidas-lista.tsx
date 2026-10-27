'use client'

import { useState } from 'react'
import { CheckCircle2, ChevronDown, Circle, CircleDashed, CreditCard, ListChecks, Loader2, Plus } from 'lucide-react'
import { CATEGORIAS_DESPESA, formatBRL, formatDiaMes, hojeISO, nomeMes } from '@/lib/financas'
import type { Saida } from '@/lib/saidas'
import type { Atalho } from './conta-fixa-sheet'

interface Props {
  mes: string
  saidas: Saida[]
  ocupadas: Set<string>
  atalhos: Atalho[] // minhas contas que ainda não foram cadastradas
  onAlternar: (s: Saida) => void
  onAbrir: (s: Saida) => void
  onNovaConta: (a: Atalho | null) => void
  onLancarFixos?: () => void
}

export default function SaidasLista({ mes, saidas, ocupadas, atalhos, onAlternar, onAbrir, onNovaConta, onLancarFixos }: Props) {
  const hoje = hojeISO()
  const [verPagas, setVerPagas] = useState(false)

  // O dízimo fica à parte, no topo: não é conta, é devolução
  const dizimos = saidas.filter(s => s.tipo === 'dizimo')
  const contas = saidas.filter(s => s.tipo !== 'dizimo')
  const vencidas = contas.filter(s => !s.pago && s.data && s.data < hoje)
  const aPagar = contas.filter(s => !s.pago && !(s.data && s.data < hoje))
  const pagas = contas.filter(s => s.pago)
  const dizimoAberto = dizimos.filter(s => !s.pago)
  const soma = (l: Saida[]) => l.reduce((a, s) => a + s.valor, 0)

  const cadastro = (
    <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
      <button type="button" onClick={() => onNovaConta(null)} className="flex items-center gap-1.5 text-sm font-medium text-primary">
        <Plus className="h-4 w-4" /> Nova conta do mês
      </button>
      {atalhos.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">Ainda não cadastradas:</p>
          <div className="flex flex-wrap gap-1.5">
            {atalhos.map(a => (
              <button
                key={a.nome}
                type="button"
                onClick={() => onNovaConta(a)}
                className="rounded-full border border-border bg-card px-2.5 py-1 text-xs hover:bg-secondary"
              >
                + {a.nome}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )

  if (saidas.length === 0) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhuma conta prevista em {nomeMes(mes).toLowerCase()}.
        </div>
        {cadastro}
      </div>
    )
  }

  const linha = (s: Saida) => {
    const ocupada = ocupadas.has(s.chave)
    const Icone = ocupada ? Loader2 : s.pago ? CheckCircle2 : s.tipo === 'previsto' ? CircleDashed : Circle
    const vencida = !s.pago && s.data && s.data < hoje
    const rotulo = s.pago
      ? s.tipo === 'fatura' ? 'Desmarcar fatura paga' : 'Marcar como pendente'
      : s.tipo === 'previsto' ? 'Lançar como pago' : 'Marcar como pago'
    return (
      <li key={s.chave} className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onAlternar(s)}
          disabled={ocupada}
          aria-label={rotulo}
          title={rotulo}
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center"
        >
          <Icone className={`h-6 w-6 ${ocupada ? 'animate-spin text-muted-foreground' : s.pago ? 'text-green-600' : vencida ? 'text-red-500' : 'text-muted-foreground'}`} />
        </button>
        <button type="button" onClick={() => onAbrir(s)} className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-4 text-left">
          <div className="min-w-0 flex-1">
            <p className={`truncate text-sm ${s.pago ? 'text-muted-foreground' : ''}`}>
              {s.tipo === 'fatura' && <CreditCard className="mr-1 inline h-3.5 w-3.5 text-primary" />}
              {s.descricao}
            </p>
            <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
              <span className={vencida ? 'font-medium text-red-600' : ''}>
                {s.data
                  ? `${s.pago ? (s.tipo === 'fatura' ? 'vencia' : 'pago') : vencida ? 'venceu' : 'vence'} ${formatDiaMes(s.data)}`
                  : 'sem dia de vencimento'}
              </span>
              {s.tipo === 'previsto' && <span className="rounded border border-dashed border-border px-1.5">previsto</span>}
              {s.atrasada && s.lancamento && <span className="rounded bg-red-50 px-1.5 text-red-700">de {nomeMes(s.lancamento.competencia).toLowerCase()}</span>}
              {s.categoria && s.tipo !== 'fatura' && (
                <span className={`rounded px-1.5 ${CATEGORIAS_DESPESA[s.categoria]?.className ?? ''}`}>
                  {CATEGORIAS_DESPESA[s.categoria]?.label ?? s.categoria}
                </span>
              )}
              {s.tipo === 'fatura' && s.competenciaFatura && s.competenciaFatura !== mes && <span>fatura de {nomeMes(s.competenciaFatura).toLowerCase()}</span>}
              {!!s.previstoNaFatura && <span>inclui {formatBRL(s.previstoNaFatura)} previstos</span>}
            </p>
          </div>
          <span className={`text-sm tabular-nums ${s.pago ? 'text-muted-foreground line-through decoration-muted-foreground/40' : 'font-medium'}`}>
            {formatBRL(s.valor)}
          </span>
        </button>
      </li>
    )
  }

  const grupo = (titulo: string, itens: Saida[], className = '') => itens.length > 0 && (
    <div>
      <div className={`flex items-center justify-between border-b border-border bg-secondary/40 px-4 py-2 text-xs font-medium ${className}`}>
        <span>{titulo} · {itens.length}</span>
        <span className="tabular-nums">{formatBRL(soma(itens))}</span>
      </div>
      <ul className="divide-y divide-border">{itens.map(linha)}</ul>
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Falta sair</p>
          <p className="text-lg font-semibold tabular-nums">{formatBRL(soma(vencidas) + soma(aPagar) + soma(dizimoAberto))}</p>
          {vencidas.length > 0 && (
            <p className="text-xs text-red-600">{vencidas.length} {vencidas.length === 1 ? 'vencida' : 'vencidas'}: {formatBRL(soma(vencidas))}</p>
          )}
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Já saiu</p>
          <p className="text-lg font-semibold tabular-nums text-green-700">{formatBRL(soma(pagas) + soma(dizimos.filter(s => s.pago)))}</p>
        </div>
      </div>

      {dizimos.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50/60 text-gray-900">
          <div className="flex items-center justify-between border-b border-amber-200 px-4 py-2 text-xs font-medium text-amber-900">
            <span>Primícias · devolver ao Senhor</span>
            {dizimoAberto.length > 1 && <span className="tabular-nums">em aberto: {formatBRL(soma(dizimoAberto))}</span>}
          </div>
          <ul className="divide-y divide-amber-200">
            {dizimos.map(s => {
              const ocupada = ocupadas.has(s.chave)
              const Icone = ocupada ? Loader2 : s.pago ? CheckCircle2 : Circle
              const rotulo = s.pago ? 'Desfazer devolução' : 'Marcar como devolvido'
              return (
                <li key={s.chave} className="flex items-center gap-1">
                  <button type="button" onClick={() => onAlternar(s)} disabled={ocupada} aria-label={rotulo} title={rotulo}
                    className="flex h-12 w-12 flex-shrink-0 items-center justify-center">
                    <Icone className={`h-6 w-6 ${ocupada ? 'animate-spin text-muted-foreground' : s.pago ? 'text-green-600' : 'text-amber-600'}`} />
                  </button>
                  <button type="button" onClick={() => onAbrir(s)} className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-4 text-left">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        Dízimo{s.atrasada && s.competenciaDizimo ? ` de ${nomeMes(s.competenciaDizimo).toLowerCase()}` : ''}
                      </p>
                      <p className="text-xs text-amber-900/80">
                        {s.pago && s.data ? `devolvido ${formatDiaMes(s.data)}` : `10% de ${formatBRL(s.renda ?? 0)}`}
                        {s.atrasada && !s.pago && ' · em aberto'}
                      </p>
                    </div>
                    <span className={`text-sm tabular-nums ${s.pago ? 'text-muted-foreground line-through decoration-muted-foreground/40' : 'font-semibold'}`}>
                      {formatBRL(s.valor)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {grupo('Vencidas', vencidas, 'text-red-700')}
        {grupo('A pagar', aPagar)}
        {pagas.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setVerPagas(v => !v)}
              className="flex w-full items-center justify-between border-b border-border bg-secondary/40 px-4 py-2 text-xs font-medium text-green-700"
            >
              <span className="flex items-center gap-1">
                Pagas · {pagas.length}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${verPagas ? 'rotate-180' : ''}`} />
              </span>
              <span className="tabular-nums">{formatBRL(soma(pagas))}</span>
            </button>
            {verPagas && <ul className="divide-y divide-border">{pagas.map(linha)}</ul>}
          </div>
        )}
      </div>
      {cadastro}

      {onLancarFixos && (
        <button type="button" onClick={onLancarFixos} className="flex items-center gap-1.5 px-1 text-xs text-primary">
          <ListChecks className="h-3.5 w-3.5" /> Lançar vários fixos de uma vez
        </button>
      )}
      <p className="px-1 text-xs text-muted-foreground">
        Toque no círculo para marcar como pago, ou na conta para informar o valor real e a data. No cartão, quem se paga é a fatura.
      </p>
    </div>
  )
}
