'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, CircleAlert, Lightbulb, TrendingDown, TrendingUp } from 'lucide-react'
import { formatBRL, formatMesAno, nomeMes } from '@/lib/financas'
import type { Retrato } from '@/lib/retrato'

// ─── Peças ────────────────────────────────────────────────────────────

const mesCurto = (iso: string) => formatMesAno(new Date(iso.length === 10 ? `${iso}T12:00:00` : iso))
const primeiroNome = (competencia: string) => nomeMes(competencia).split(' ')[0]

function Rotulo({ children, claro }: { children: React.ReactNode; claro?: boolean }) {
  return (
    <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${claro ? 'text-white/70' : 'text-muted-foreground'}`}>
      {children}
    </p>
  )
}

/** Barra de medição com o estado escrito ao lado: a cor nunca fala sozinha. */
function Medidor({ pct, estado }: { pct: number; estado: 'bom' | 'atencao' | 'critico' | 'neutro' }) {
  const cor = { bom: 'bg-[#0ca30c]', atencao: 'bg-[#fab219]', critico: 'bg-[#d03b3b]', neutro: 'bg-primary' }[estado]
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-secondary" role="meter" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${cor} transition-[width] duration-700`} style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }} />
    </div>
  )
}

function Estado({ tipo, children }: { tipo: 'bom' | 'atencao' | 'critico'; children: React.ReactNode }) {
  const Icone = tipo === 'bom' ? CheckCircle2 : tipo === 'atencao' ? AlertTriangle : CircleAlert
  const cor = tipo === 'bom' ? 'text-green-700' : tipo === 'atencao' ? 'text-amber-700' : 'text-red-700'
  return (
    <p className={`flex items-start gap-1.5 text-sm ${cor}`}>
      <Icone className="mt-0.5 h-4 w-4 flex-shrink-0" /> <span>{children}</span>
    </p>
  )
}

/** Linha do patrimônio mês a mês, sobre o fundo escuro da capa. Tocar mostra o valor. */
function LinhaPatrimonio({ historico }: { historico: { mes: string; valor: number }[] }) {
  const [sel, setSel] = useState(historico.length - 1)
  if (historico.length < 2) return null

  const valores = historico.map(h => h.valor)
  const min = Math.min(...valores, 0)
  const max = Math.max(...valores, 0)
  const faixa = max - min || 1
  const W = 300
  const H = 64
  const x = (i: number) => (i / (historico.length - 1)) * W
  const y = (v: number) => 6 + (1 - (v - min) / faixa) * (H - 12)
  const pontos = historico.map((h, i) => `${x(i)},${y(h.valor)}`).join(' ')

  function escolher(clientX: number, rect: DOMRect) {
    const i = Math.round(((clientX - rect.left) / rect.width) * (historico.length - 1))
    setSel(Math.min(Math.max(i, 0), historico.length - 1))
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-white/80">
        {mesCurto(historico[sel].mes)}: <strong className="text-white">{formatBRL(historico[sel].valor)}</strong>
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-16 w-full touch-none"
        onPointerMove={e => escolher(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerDown={e => escolher(e.clientX, e.currentTarget.getBoundingClientRect())}
        role="img"
        aria-label="Patrimônio líquido nos últimos meses"
      >
        {min < 0 && max > 0 && (
          <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="white" strokeOpacity="0.35" strokeDasharray="3 4" strokeWidth="1" />
        )}
        <polyline points={pontos} fill="none" stroke="white" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <line x1={x(sel)} x2={x(sel)} y1="0" y2={H} stroke="white" strokeOpacity="0.3" strokeWidth="1" />
        <circle cx={x(sel)} cy={y(historico[sel].valor)} r="4.5" fill="white" stroke="#3b2fb0" strokeWidth="2" />
      </svg>
    </div>
  )
}

/** Barras horizontais de uma série só (uma cor); tocar mostra a fatia do mês. */
function BarrasCategorias({ itens, total }: { itens: { cat: string; label: string; valor: number }[]; total: number }) {
  const [sel, setSel] = useState<string | null>(null)
  const max = Math.max(...itens.map(i => i.valor), 1)
  return (
    <ul className="space-y-3">
      {itens.map(i => (
        <li key={i.cat}>
          <button
            type="button"
            onMouseEnter={() => setSel(i.cat)}
            onMouseLeave={() => setSel(null)}
            onClick={() => setSel(sel === i.cat ? null : i.cat)}
            className="w-full space-y-1.5 text-left"
          >
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate">{i.label}</span>
              <span className="whitespace-nowrap font-medium">
                {sel === i.cat && total > 0 && <span className="mr-2 text-xs font-normal text-muted-foreground">{Math.round((i.valor / total) * 100)}% do mês</span>}
                {formatBRL(i.valor)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-secondary">
              <div className="h-full rounded-[4px] bg-primary" style={{ width: `${(i.valor / max) * 100}%`, opacity: sel && sel !== i.cat ? 0.45 : 1 }} />
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}

// ─── Capítulos ────────────────────────────────────────────────────────

export function Capa({ r }: { r: Retrato }) {
  const p = r.patrimonio
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#2a2185] via-[#3b2fb0] to-[#6b57e0] p-6 text-white shadow-lg sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
      <div className="relative space-y-5">
        <div>
          <Rotulo claro>{r.familiaNome}</Rotulo>
          <h2 className="mt-1 text-2xl font-semibold">{nomeMes(r.competencia)}</h2>
        </div>

        {p ? (
          <>
            <div>
              <p className="text-sm text-white/80">{p.liquido >= 0 ? 'Temos mais do que devemos' : 'Hoje devemos mais do que temos'}</p>
              <p className="text-5xl font-semibold leading-tight sm:text-6xl">{formatBRL(p.liquido)}</p>
              <p className="mt-1 text-xs text-white/70">patrimônio líquido: o que temos menos o que devemos</p>
            </div>
            {p.variacao !== null && p.variacao !== 0 && (
              <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-sm">
                {p.variacao > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {p.variacao > 0 ? 'Melhoramos' : 'Pioramos'} {formatBRL(Math.abs(p.variacao))} desde o mês passado
              </p>
            )}
            <LinhaPatrimonio historico={p.historico} />
          </>
        ) : (
          <div>
            <p className="text-sm text-white/80">Este mês gastamos</p>
            <p className="text-5xl font-semibold leading-tight">{formatBRL(r.mes.gasto)}</p>
            <Link href="/financas/patrimonio" className="mt-3 inline-block text-sm text-white underline underline-offset-4">
              Cadastrar o que temos e o que devemos →
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}

export function EsteMes({ r }: { r: Retrato }) {
  const m = r.mes
  const pct = m.planejado > 0 ? (m.gasto / m.planejado) * 100 : 0
  const estado = pct >= 100 ? 'critico' : pct >= 80 ? 'atencao' : 'bom'
  const diferenca = m.gastoMesAnterior !== null ? m.gasto - m.gastoMesAnterior : null

  return (
    <section className="space-y-4 rounded-3xl border border-border bg-card p-6 sm:p-8">
      <Rotulo>Este mês</Rotulo>
      {m.planejado > 0 ? (
        <>
          <div>
            <p className="text-base text-muted-foreground">{m.restante >= 0 ? 'Ainda podemos gastar' : 'Passamos do combinado em'}</p>
            <p className={`text-5xl font-semibold leading-tight ${m.restante < 0 ? 'text-red-700' : ''}`}>{formatBRL(Math.abs(m.restante))}</p>
          </div>
          <Medidor pct={pct} estado={estado} />
          <p className="text-sm text-muted-foreground">
            Gastamos <strong className="text-foreground">{formatBRL(m.gasto)}</strong> de {formatBRL(m.planejado)} combinados.
          </p>
          {m.porDia !== null ? (
            <Estado tipo={estado}>
              Dá <strong>{formatBRL(m.porDia)} por dia</strong> nos {r.diasRestantes} {r.diasRestantes === 1 ? 'dia que falta' : 'dias que faltam'} de {primeiroNome(r.competencia).toLowerCase()}.
            </Estado>
          ) : m.restante < 0 ? (
            <Estado tipo="critico">Daqui até o fim do mês, só o essencial.</Estado>
          ) : null}
        </>
      ) : (
        <>
          <p className="text-5xl font-semibold leading-tight">{formatBRL(m.gasto)}</p>
          <p className="text-sm text-muted-foreground">
            gastos lançados. Combinem limites na aba <Link href="/financas/mes" className="text-primary underline">Mês</Link> para saber quanto ainda podem gastar.
          </p>
        </>
      )}
      {diferenca !== null && diferenca !== 0 && (
        <p className="text-sm text-muted-foreground">
          {diferenca < 0 ? `${formatBRL(-diferenca)} a menos` : `${formatBRL(diferenca)} a mais`} que no mês passado até agora.
        </p>
      )}
    </section>
  )
}

export function ParaOndeFoi({ r }: { r: Retrato }) {
  const m = r.mes
  const top = m.categorias.slice(0, 5)
  const resto = m.categorias.slice(5).reduce((a, c) => a + c.valor, 0)
  const itens = resto > 0 ? [...top, { cat: '_resto', label: 'Demais categorias', valor: resto }] : top
  const pctNao = m.gasto > 0 ? Math.round((m.naoEssencial / m.gasto) * 100) : 0

  return (
    <section className="space-y-5 rounded-3xl border border-border bg-card p-6 sm:p-8">
      <div className="space-y-1">
        <Rotulo>Para onde foi o dinheiro</Rotulo>
        {top[0] && (
          <p className="text-xl font-semibold leading-snug">
            {top[0].label} é o maior gasto do mês: {formatBRL(top[0].valor)}.
          </p>
        )}
      </div>
      <BarrasCategorias itens={itens} total={m.gasto} />
      {m.naoEssencial > 0 && (
        <Estado tipo={pctNao > 30 ? 'atencao' : 'bom'}>
          {formatBRL(m.naoEssencial)} ({pctNao}%) foram gastos não essenciais{pctNao > 30 ? ': é onde dá para cortar primeiro.' : '.'}
        </Estado>
      )}
    </section>
  )
}

export function NossasDividas({ r }: { r: Retrato }) {
  const d = r.dividas!
  return (
    <section className="space-y-4 rounded-3xl border border-border bg-card p-6 sm:p-8">
      <Rotulo>Nossas dívidas</Rotulo>
      {d.livreEm ? (
        <div>
          <p className="text-base text-muted-foreground">Livres das dívidas em</p>
          <p className="text-5xl font-semibold capitalize leading-tight">{mesCurto(d.livreEm)}</p>
          <p className="mt-1 text-sm text-muted-foreground">daqui a {d.meses} meses, guardando a sobra de cada mês para elas</p>
        </div>
      ) : (
        <div>
          <p className="text-5xl font-semibold leading-tight">{formatBRL(d.total)}</p>
          <Estado tipo="critico">No ritmo atual, os juros crescem mais rápido do que os pagamentos. É preciso renegociar ou aumentar a sobra.</Estado>
        </div>
      )}
      <p className="text-sm text-muted-foreground">Devemos <strong className="text-foreground">{formatBRL(d.total)}</strong> no total.</p>
      {d.primeira && (
        <p className="rounded-xl bg-secondary/70 px-4 py-3 text-sm">
          Primeiro alvo: <strong>{d.primeira.nome}</strong>{d.primeira.juros > 0 && `, que cobra ${String(d.primeira.juros).replace('.', ',')}% ao mês`}.
        </p>
      )}
    </section>
  )
}

export function NossoSonho({ r }: { r: Retrato }) {
  const p = r.plano!
  return (
    <section className="space-y-4 rounded-3xl border border-border bg-card p-6 sm:p-8">
      <Rotulo>Nosso sonho</Rotulo>
      <p className="text-2xl font-semibold leading-snug">{p.titulo}</p>
      {p.metaDefinida ? (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-semibold leading-tight">{Math.round(p.progresso)}%</span>
            <span className="text-sm text-muted-foreground">do caminho</span>
          </div>
          <Medidor pct={p.progresso} estado="neutro" />
          <p className="text-sm text-muted-foreground">
            Faltam <strong className="text-foreground">{formatBRL(p.falta)}</strong>
            {p.previsao ? <> e, guardando {formatBRL(p.aporte)} por mês, chegamos lá em <strong className="text-foreground">{mesCurto(p.previsao)}</strong>.</> : '. Definam quanto guardar por mês para ver a data.'}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Preencham os custos do plano para medir o caminho.</p>
      )}
      <Link href={`/financas/planos/${p.id}`} className="inline-block text-sm text-primary">Ver o plano →</Link>
    </section>
  )
}

export function FocoDoMes({ r, onPedirCarta, escrevendo }: { r: Retrato; onPedirCarta?: () => void; escrevendo?: boolean }) {
  return (
    <section className="space-y-4 rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6 text-gray-900 sm:p-8">
      <Rotulo>O foco agora</Rotulo>
      {r.foco && (
        <div className="flex gap-3">
          <Lightbulb className="mt-1 h-6 w-6 flex-shrink-0 text-amber-500" />
          <div className="space-y-1">
            <p className="text-xl font-semibold leading-snug">{r.foco.titulo}</p>
            <p className="text-sm text-gray-700">{r.foco.texto}</p>
          </div>
        </div>
      )}
      {r.carta ? (
        <blockquote className="border-l-2 border-amber-300 pl-4 font-serif text-[15px] italic leading-relaxed text-gray-800">
          {r.carta.split(/\n+/).filter(Boolean)[0]}
        </blockquote>
      ) : onPedirCarta && (
        <button type="button" onClick={onPedirCarta} disabled={escrevendo} className="text-sm text-amber-800 underline underline-offset-4">
          {escrevendo ? 'O consultor está escrevendo a carta do mês…' : 'Pedir a carta do mês ao consultor'}
        </button>
      )}
      <Link href="/financas/diagnostico" className="inline-block text-sm text-amber-800">Diagnóstico completo →</Link>
    </section>
  )
}

/** Os capítulos que têm dados, na ordem da apresentação. */
export function capitulos(r: Retrato) {
  return [
    { id: 'capa', titulo: 'Como estamos', mostrar: true },
    { id: 'mes', titulo: 'Este mês', mostrar: true },
    { id: 'para-onde', titulo: 'Para onde foi', mostrar: r.mes.categorias.length > 0 },
    { id: 'dividas', titulo: 'Dívidas', mostrar: !!r.dividas },
    { id: 'sonho', titulo: 'Nosso sonho', mostrar: !!r.plano },
    { id: 'foco', titulo: 'O foco', mostrar: !!r.foco || !!r.carta },
  ].filter(c => c.mostrar)
}

export function Capitulo({ id, r, onPedirCarta, escrevendo }: { id: string; r: Retrato; onPedirCarta?: () => void; escrevendo?: boolean }) {
  switch (id) {
    case 'capa': return <Capa r={r} />
    case 'mes': return <EsteMes r={r} />
    case 'para-onde': return <ParaOndeFoi r={r} />
    case 'dividas': return <NossasDividas r={r} />
    case 'sonho': return <NossoSonho r={r} />
    case 'foco': return <FocoDoMes r={r} onPedirCarta={onPedirCarta} escrevendo={escrevendo} />
    default: return null
  }
}
