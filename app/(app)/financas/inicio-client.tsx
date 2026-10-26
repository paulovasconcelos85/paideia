'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, ChevronRight, Lightbulb, Loader2, Mail, Plus, Star, TrendingDown, TrendingUp } from 'lucide-react'
import { formatBRL, formatMesAno, nomeMes, type Cartao, type Plano } from '@/lib/financas'
import type { Alerta } from '@/lib/financas-diagnostico'
import LancamentoSheet from './_components/lancamento-sheet'

interface Props {
  familiaId: string
  userId: string
  cartoes: Cartao[]
  renda: number
  mes: { competencia: string; gasto: number; planejado: number }
  patrimonio: { liquido: number; variacao: number | null } | null
  plano: Plano | null
  projecao: { progresso: number; dataPrevista: string | null; metaDefinida: boolean } | null
  foco: Alerta | null
  carta: string | null
  podeEscreverCarta: boolean
  setup: { rendas: boolean; fixos: boolean; cartoes: boolean; familia: boolean; planos: boolean }
}

const cartao = 'block rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 active:bg-secondary/40'

export default function InicioClient({ familiaId, userId, cartoes, renda, mes, patrimonio, plano, projecao, foco, carta: cartaInicial, podeEscreverCarta, setup }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [lancando, setLancando] = useState(false)
  const [gasto, setGasto] = useState(mes.gasto)
  const [carta, setCarta] = useState(cartaInicial)
  const [cartaAberta, setCartaAberta] = useState(false)
  const [escrevendo, setEscrevendo] = useState(false)
  const [erroCarta, setErroCarta] = useState<string | null>(null)

  async function escreverCarta() {
    setEscrevendo(true)
    setErroCarta(null)
    try {
      const res = await fetch('/api/financas/carta', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Não foi possível escrever a carta.')
      setCarta(data.carta)
      setCartaAberta(true)
    } catch (e) {
      setErroCarta((e as Error).message)
    } finally {
      setEscrevendo(false)
    }
  }

  const restante = mes.planejado - gasto
  const pct = mes.planejado > 0 ? Math.min((gasto / mes.planejado) * 100, 100) : 0

  const passos = [
    { ok: setup.rendas, texto: 'Cadastrar as rendas', href: '/financas/rendas' },
    { ok: setup.fixos, texto: 'Cadastrar os gastos fixos', href: '/financas/gastos' },
    { ok: setup.cartoes, texto: 'Cadastrar os cartões', href: '/financas/gastos' },
    { ok: setup.familia, texto: 'Convidar quem divide a casa', href: '/financas/familia' },
    { ok: setup.planos, texto: 'Criar o primeiro plano', href: '/financas/planos' },
  ]
  const configurando = passos.some(p => !p.ok)

  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      {configurando && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-3">
          <p className="text-sm font-medium">Primeiros passos</p>
          <ul className="space-y-1.5">
            {passos.map(p => (
              <li key={p.texto}>
                <Link href={p.href} className={`flex items-center gap-2 text-sm ${p.ok ? 'text-muted-foreground line-through' : 'hover:text-primary'}`}>
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${p.ok ? 'border-green-600 bg-green-600 text-white' : 'border-border'}`}>
                    {p.ok && <Check className="h-3 w-3" />}
                  </span>
                  {p.texto}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* O mês */}
      <Link href="/financas/mes" className={cartao}>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{nomeMes(mes.competencia)}</p>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
        {mes.planejado > 0 ? (
          <>
            <p className="mt-1 text-sm text-muted-foreground">{restante >= 0 ? 'Ainda podemos gastar' : 'Passamos do combinado em'}</p>
            <p className={`text-3xl font-semibold tabular-nums ${restante >= 0 ? '' : 'text-red-600'}`}>{formatBRL(Math.abs(restante))}</p>
            <div className="mt-3 h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className={`h-full rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-green-600'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{formatBRL(gasto)} gastos de {formatBRL(mes.planejado)}</p>
          </>
        ) : (
          <>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{formatBRL(gasto)}</p>
            <p className="text-xs text-muted-foreground">gastos lançados no mês</p>
          </>
        )}
      </Link>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* O placar */}
        <Link href="/financas/patrimonio" className={cartao}>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Patrimônio líquido</p>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
          {patrimonio ? (
            <>
              <p className={`mt-1 text-2xl font-semibold tabular-nums ${patrimonio.liquido >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {formatBRL(patrimonio.liquido)}
              </p>
              {patrimonio.variacao !== null && patrimonio.variacao !== 0 && (
                <p className={`flex items-center gap-1 text-xs ${patrimonio.variacao > 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {patrimonio.variacao > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {patrimonio.variacao > 0 ? '+' : ''}{formatBRL(patrimonio.variacao)} no mês
                </p>
              )}
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Quanto temos menos quanto devemos. Toque para começar.</p>
          )}
        </Link>

        {/* O sonho */}
        <Link href={plano ? `/financas/planos/${plano.id}` : '/financas/planos'} className={cartao}>
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1 text-xs text-muted-foreground"><Star className="h-3 w-3" /> Plano principal</p>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
          {plano && projecao ? (
            <>
              <p className="mt-1 truncate font-semibold">{plano.titulo}</p>
              <div className="mt-2 h-2 rounded-full bg-secondary overflow-hidden">
                <div className="h-full rounded-full bg-primary" style={{ width: `${projecao.progresso}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {!projecao.metaDefinida
                  ? 'Preencha os custos do plano'
                  : projecao.dataPrevista
                    ? `${projecao.progresso.toFixed(0)}% · previsão ${formatMesAno(new Date(projecao.dataPrevista))}`
                    : `${projecao.progresso.toFixed(0)}% · defina um aporte mensal`}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Marque um plano ativo como principal para acompanhar aqui.</p>
          )}
        </Link>
      </div>

      {/* A carta do mês */}
      {carta ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <button type="button" onClick={() => setCartaAberta(v => !v)} className="flex w-full items-center gap-3 text-left">
            <Mail className="h-5 w-5 flex-shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Carta de {nomeMes(mes.competencia).split(' ')[0].toLowerCase()}</p>
              {!cartaAberta && <p className="truncate text-sm">{carta.split('\n')[0]}</p>}
            </div>
            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${cartaAberta ? 'rotate-90' : ''}`} />
          </button>
          {cartaAberta && (
            <div className="mt-3 space-y-3 font-serif text-[15px] leading-relaxed">
              {carta.split(/\n+/).filter(Boolean).map((par, i) => <p key={i}>{par}</p>)}
            </div>
          )}
        </div>
      ) : podeEscreverCarta && (
        <button
          type="button"
          onClick={escreverCarta}
          disabled={escrevendo}
          className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border p-4 text-left text-sm text-muted-foreground hover:bg-secondary/50"
        >
          {escrevendo ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mail className="h-5 w-5" />}
          <span className="flex-1">
            {escrevendo ? 'Escrevendo a carta do mês...' : 'Pedir a carta do mês ao consultor'}
            {erroCarta && <span className="block text-xs text-red-600">{erroCarta}</span>}
          </span>
        </button>
      )}

      {/* O foco */}
      {foco && (
        <Link href="/financas/diagnostico" className={`${cartao} flex gap-3`}>
          <Lightbulb className="h-5 w-5 flex-shrink-0 text-amber-500" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Foco agora</p>
            <p className="text-sm font-medium">{foco.titulo}</p>
            <p className="mt-0.5 text-xs text-primary">Diagnóstico completo e consultor →</p>
          </div>
        </Link>
      )}

      <button
        type="button"
        onClick={() => setLancando(true)}
        aria-label="Lançar gasto"
        className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] lg:bottom-8 lg:right-8 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95"
      >
        <Plus className="h-6 w-6" />
      </button>

      {lancando && (
        <LancamentoSheet
          familiaId={familiaId}
          userId={userId}
          cartoes={cartoes}
          planoPrincipal={plano}
          rendaMensal={renda}
          onSaved={l => {
            if (l.competencia === mes.competencia) setGasto(g => g + Number(l.valor))
            setLancando(false)
            startTransition(() => router.refresh())
          }}
          onClose={() => setLancando(false)}
        />
      )}
    </div>
  )
}
