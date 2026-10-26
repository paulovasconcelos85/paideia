import Link from 'next/link'
import {
  AlertOctagon, AlertTriangle, ArrowDownCircle, ArrowUpCircle, CheckCircle2, Circle,
  CircleDot, Lightbulb, PiggyBank, Scale,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { CATEGORIAS_DESPESA, despesaMensal, formatBRL, type Despesa, type Renda } from '@/lib/financas'
import { diagnosticar, type NivelAlerta } from '@/lib/financas-diagnostico'
import ConsultorIA from './consultor-ia'

const ESTILO_ALERTA: Record<NivelAlerta, { icon: typeof AlertOctagon; className: string; iconClass: string }> = {
  critico:      { icon: AlertOctagon,  className: 'border-red-200 bg-red-50',       iconClass: 'text-red-600' },
  atencao:      { icon: AlertTriangle, className: 'border-amber-200 bg-amber-50',   iconClass: 'text-amber-600' },
  oportunidade: { icon: Lightbulb,     className: 'border-blue-200 bg-blue-50',     iconClass: 'text-blue-600' },
  ok:           { icon: CheckCircle2,  className: 'border-green-200 bg-green-50',   iconClass: 'text-green-600' },
}

export default async function FinancasResumoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: despesas }, { data: rendas }] = await Promise.all([
    supabase.from('fin_despesas').select('*').eq('user_id', user!.id),
    supabase.from('fin_rendas').select('*').eq('user_id', user!.id),
  ])

  const listaDespesas = (despesas ?? []) as Despesa[]
  const listaRendas = (rendas ?? []) as Renda[]

  if (listaDespesas.length === 0 && listaRendas.length === 0) {
    return (
      <div className="rounded-lg border border-border p-12 text-center space-y-3">
        <PiggyBank className="w-8 h-8 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">
          Comece registrando seus <Link href="/financas/gastos" className="text-primary underline">gastos</Link> e
          suas <Link href="/financas/rendas" className="text-primary underline">rendas</Link>. O diagnóstico aparece aqui.
        </p>
      </div>
    )
  }

  const d = diagnosticar(listaDespesas, listaRendas)

  const porCategoria = Object.entries(
    listaDespesas.reduce<Record<string, number>>((acc, x) => {
      acc[x.categoria] = (acc[x.categoria] ?? 0) + despesaMensal(x)
      return acc
    }, {})
  )
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])

  const metrics = [
    { label: 'Renda mensal', value: formatBRL(d.renda), sub: 'líquida, com 13º e férias diluídos', icon: ArrowUpCircle, color: 'text-green-600', destaque: false },
    { label: 'Gastos mensais', value: formatBRL(d.despesa), sub: 'com anuais diluídos', icon: ArrowDownCircle, color: 'text-red-600', destaque: false },
    { label: 'Saldo do mês', value: formatBRL(d.saldo), sub: d.saldo >= 0 ? 'sobra para poupar' : 'no vermelho', icon: Scale, color: d.saldo >= 0 ? 'text-green-600' : 'text-red-600', destaque: true },
    { label: 'Taxa de poupança', value: d.taxaPoupanca === null ? '—' : `${d.taxaPoupanca.toFixed(0)}%`, sub: 'meta saudável: 20% ou mais', icon: PiggyBank, color: 'text-violet-600', destaque: false },
  ]

  // 50/30/20 aplicado à renda real
  const referencia = [
    { label: 'Essenciais', atual: d.essenciais, meta: d.renda * 0.5, ref: '50%' },
    { label: 'Não essenciais', atual: d.naoEssenciais, meta: d.renda * 0.3, ref: '30%' },
    { label: 'Poupança', atual: Math.max(d.saldo, 0), meta: d.renda * 0.2, ref: '20%' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map(({ label, value, sub, icon: Icon, color, destaque }) => (
          <div key={label} className="rounded-lg border border-border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{label}</span>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div className={`text-xl sm:text-2xl font-semibold tabular-nums ${destaque ? color : ''}`}>{value}</div>
            <div className="text-xs text-muted-foreground">{sub}</div>
          </div>
        ))}
      </div>

      {/* Diagnóstico */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium">Diagnóstico: onde melhorar</h2>
        <div className="space-y-2">
          {d.alertas.map((a, i) => {
            const { icon: Icon, className, iconClass } = ESTILO_ALERTA[a.nivel]
            return (
              <div key={i} className={`flex gap-3 rounded-lg border p-4 ${className}`}>
                <Icon className={`w-5 h-5 flex-shrink-0 ${iconClass}`} />
                <div className="min-w-0 space-y-1 text-gray-900">
                  <p className="text-sm font-medium">{a.titulo}</p>
                  <p className="text-sm text-gray-700">{a.texto}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Trilha */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div>
          <h2 className="text-sm font-medium">Trilha: do vermelho ao futuro da família</h2>
          <p className="text-xs text-muted-foreground">Um passo de cada vez, nesta ordem</p>
        </div>
        <ol className="space-y-3">
          {d.plano.map((p, i) => (
            <li key={i} className="flex gap-3">
              {p.status === 'feito' && <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-green-600" />}
              {p.status === 'atual' && <CircleDot className="w-5 h-5 flex-shrink-0 text-primary" />}
              {p.status === 'futuro' && <Circle className="w-5 h-5 flex-shrink-0 text-muted-foreground/50" />}
              <div className={p.status === 'futuro' ? 'opacity-60' : ''}>
                <p className={`text-sm ${p.status === 'atual' ? 'font-semibold text-primary' : 'font-medium'}`}>
                  {i + 1}. {p.titulo}{p.status === 'atual' && ' ← você está aqui'}
                </p>
                <p className="text-xs text-muted-foreground">{p.texto}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 50/30/20 */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div>
            <h2 className="text-sm font-medium">Regra 50/30/20 na sua renda</h2>
            <p className="text-xs text-muted-foreground">Quanto você gasta hoje e quanto seria o ideal</p>
          </div>
          {referencia.map(r => {
            const acima = r.label === 'Poupança' ? r.atual < r.meta : r.atual > r.meta
            return (
              <div key={r.label} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span>{r.label} <span className="text-xs text-muted-foreground">(ideal {r.ref})</span></span>
                  <span className={`tabular-nums ${acima ? 'text-red-600' : 'text-green-700'}`}>
                    {formatBRL(r.atual)} <span className="text-xs text-muted-foreground">/ {formatBRL(r.meta)}</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={`h-full rounded-full ${acima ? 'bg-red-500' : 'bg-green-600'}`}
                    style={{ width: `${r.meta > 0 ? Math.min((r.atual / r.meta) * 100, 100) : 0}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Projeção */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div>
            <h2 className="text-sm font-medium">Se você guardar a sobra todo mês</h2>
            <p className="text-xs text-muted-foreground">Sem contar rendimentos. É o que estaria disponível para os seus planos.</p>
          </div>
          {d.saldo > 0 ? (
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map(anos => (
                <div key={anos} className="rounded-md bg-secondary/60 p-3 text-center">
                  <p className="text-xs text-muted-foreground">{anos} {anos === 1 ? 'ano' : 'anos'}</p>
                  <p className="text-sm font-semibold tabular-nums">{formatBRL(d.saldo * 12 * anos)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Hoje não sobra dinheiro para projetar. Feche o mês no azul primeiro: cada real de sobra aparece aqui como fundo para o futuro.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Reserva de emergência recomendada: <strong className="text-foreground">{formatBRL(d.reservaMeta)}</strong> (6 meses de gastos essenciais)
            {d.saldo > 0 && d.reservaMeta > 0 && `, que você forma em cerca de ${Math.ceil(d.reservaMeta / d.saldo)} meses guardando toda a sobra`}.
          </p>
        </div>
      </div>

      <ConsultorIA />

      {porCategoria.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-medium">Para onde vai o dinheiro</h2>
          <div className="space-y-3">
            {porCategoria.map(([cat, valor]) => {
              const pctDespesa = d.despesa > 0 ? (valor / d.despesa) * 100 : 0
              const pctRenda = d.renda > 0 ? (valor / d.renda) * 100 : null
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span>{CATEGORIAS_DESPESA[cat]?.label ?? cat}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatBRL(valor)}
                      {pctRenda !== null && <span className="ml-2 text-xs">({pctRenda.toFixed(0)}% da renda)</span>}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pctDespesa}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
