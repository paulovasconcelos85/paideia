'use client'

import { useState } from 'react'
import { CheckCircle2, Circle, Loader2, Plus } from 'lucide-react'
import {
  TIPOS_RECEITA, formatBRL, parseBRL, rendasPrevistas,
  type Receita, type Renda, type TipoReceita, type TipoRenda,
} from '@/lib/financas'

/** Uma linha de entrada: já caiu (receita) ou ainda prevista (renda cadastrada). */
export interface Entrada {
  chave: string
  descricao: string
  tipo: TipoReceita
  valor: number
  data: string | null
  recebida: boolean
  receita?: Receita
  renda?: Renda
}

export function tipoDaRenda(t: TipoRenda): TipoReceita {
  return t === 'salario' || t === 'decimo_terceiro' || t === 'ferias' ? t : 'extra'
}

/** Entradas que pagam o mês: as que caíram e as previstas que ainda não caíram. */
export function montarEntradas(rendas: Renda[], receitas: Receita[], competencia: string): Entrada[] {
  const doMes = receitas.filter(r => r.competencia.slice(0, 10) === competencia)
  const recebidas = doMes.map((r): Entrada => ({
    chave: `r-${r.id}`, descricao: r.descricao || TIPOS_RECEITA[r.tipo], tipo: r.tipo, valor: Number(r.valor),
    data: r.data, recebida: true, receita: r,
  }))
  // Prevista some quando já entrou uma do mesmo tipo neste mês
  const tiposRecebidos = new Set(doMes.map(r => r.tipo))
  const previstas = rendasPrevistas(rendas, competencia)
    .filter(p => !tiposRecebidos.has(tipoDaRenda(p.renda.tipo)))
    .map((p): Entrada => ({
      chave: `p-${p.renda.id}`, descricao: p.renda.descricao, tipo: tipoDaRenda(p.renda.tipo), valor: Number(p.renda.valor),
      data: p.data, recebida: false, renda: p.renda,
    }))
  return [...recebidas, ...previstas].sort((a, b) => (a.data ?? '9999').localeCompare(b.data ?? '9999'))
}

interface Props {
  entradas: Entrada[]
  ocupadas: Set<string>
  onAlternar: (e: Entrada) => void
  onValor: (e: Entrada, valor: number) => void
  onAbrir: (e: Entrada) => void
  onNova: () => void
}

const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

export default function Entradas({ entradas, ocupadas, onAlternar, onValor, onAbrir, onNova }: Props) {
  const [editando, setEditando] = useState<{ chave: string; texto: string } | null>(null)

  function salvar(e: Entrada) {
    if (!editando) return
    const v = parseBRL(editando.texto)
    setEditando(null)
    if (v !== null && Math.abs(v - e.valor) >= 0.005) onValor(e, v)
  }

  return (
    <div className="overflow-hidden rounded-xl border border-blue-200 bg-blue-50/40">
      <ul className="divide-y divide-blue-100">
        {entradas.map(e => {
          const ocupada = ocupadas.has(e.chave)
          const Icone = ocupada ? Loader2 : e.recebida ? CheckCircle2 : Circle
          const saldo = e.tipo === 'saldo'
          return (
            <li key={e.chave} className="flex items-center">
              <button
                type="button"
                onClick={() => onAlternar(e)}
                disabled={ocupada}
                aria-label={e.recebida ? 'Desfazer: ainda não caiu' : 'Marcar como recebido'}
                className="flex h-12 w-12 flex-shrink-0 items-center justify-center"
              >
                <Icone className={`h-6 w-6 ${ocupada ? 'animate-spin text-muted-foreground' : e.recebida ? 'text-blue-600' : 'text-blue-300'}`} />
              </button>
              <button type="button" onClick={() => onAbrir(e)} className="min-w-0 flex-1 py-2 text-left">
                <p className={`truncate text-sm ${e.recebida ? 'font-medium' : 'text-muted-foreground'}`}>{e.descricao}</p>
                <p className="text-xs text-muted-foreground">
                  {e.data ? `${e.recebida ? 'caiu' : 'cai'} ${diaMes(e.data)}` : 'sem data'}
                  {saldo && ' · não conta como renda'}
                </p>
              </button>
              {editando?.chave === e.chave ? (
                <input
                  autoFocus
                  inputMode="decimal"
                  value={editando.texto}
                  onChange={ev => setEditando({ chave: e.chave, texto: ev.target.value })}
                  onBlur={() => salvar(e)}
                  onKeyDown={ev => { if (ev.key === 'Enter') salvar(e); if (ev.key === 'Escape') setEditando(null) }}
                  className="mr-3 w-28 rounded-md border border-blue-400 bg-background px-2 py-1.5 text-right text-sm tabular-nums focus:outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditando({ chave: e.chave, texto: e.valor.toFixed(2).replace('.', ',') })}
                  className={`py-3 pl-2 pr-4 text-right text-sm font-semibold tabular-nums ${e.recebida ? 'text-blue-700' : 'text-blue-400'}`}
                >
                  {formatBRL(e.valor)}
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        onClick={onNova}
        className={`flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-50 ${entradas.length ? 'border-t border-blue-100' : ''}`}
      >
        <Plus className="h-4 w-4" /> Entrada (13º, abono, férias, extra)
      </button>
    </div>
  )
}
