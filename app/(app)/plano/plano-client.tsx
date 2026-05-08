'use client'

import { useEffect, useRef, useState, useTransition, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { STATUS_CONFIG } from '@/lib/utils'
import type { Status } from '@/lib/types'

const PAPEL_LABEL: Record<string, string> = {
  principal: 'Principal',
  literatura: 'Literatura',
  complementar: 'Complementar',
  teologia: 'Teologia',
  politica: 'Política',
  economia: 'Economia',
  historia: 'História',
  arte: 'Arte',
  musica: 'Música',
  cinema: 'Cinema',
  biografia: 'Biografia',
}

const PAPEL_COR: Record<string, string> = {
  principal: 'bg-violet-100 text-violet-700',
  literatura: 'bg-red-100 text-red-700',
  complementar: 'bg-slate-100 text-slate-600',
  teologia: 'bg-violet-100 text-violet-700',
  politica: 'bg-emerald-100 text-emerald-700',
  economia: 'bg-amber-100 text-amber-700',
  historia: 'bg-blue-100 text-blue-700',
  arte: 'bg-slate-100 text-slate-600',
  musica: 'bg-orange-100 text-orange-700',
  cinema: 'bg-pink-100 text-pink-700',
  biografia: 'bg-green-100 text-green-700',
}

const MESES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

interface PlanoLivro {
  id: string
  papel: string
  ordem: number
  observacoes: string | null
  livros: {
    id: string
    titulo: string
    autor: string | null
    status: Status
    nota: number | null
    eixos: { nome: string; cor: string } | null
  } | null
}

interface Plano {
  id: string
  numero_mes: number
  ano: number
  mes: number
  titulo: string
  objetivo: string | null
  observacoes: string | null
  plano_livros: PlanoLivro[]
}

export default function PlanoClient({ planos: initial }: { planos: Plano[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [, startTransition] = useTransition()
  const [planos, setPlanos] = useState(initial)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const mesAtualRef = useRef<HTMLDivElement>(null)

  const hoje = new Date()
  const mesAtual = hoje.getMonth() + 1
  const anoAtual = hoje.getFullYear()

  useEffect(() => {
    const atual = initial.find(plano => plano.ano === anoAtual && plano.mes === mesAtual)
    if (!atual) return

    setExpandido(atual.id)
    window.setTimeout(() => {
      mesAtualRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 200)
  }, [anoAtual, initial, mesAtual])

  function isAtual(plano: Plano) {
    return plano.ano === anoAtual && plano.mes === mesAtual
  }

  function isFuturo(plano: Plano) {
    return plano.ano > anoAtual || (plano.ano === anoAtual && plano.mes > mesAtual)
  }

  function isPast(plano: Plano) {
    return plano.ano < anoAtual || (plano.ano === anoAtual && plano.mes < mesAtual)
  }

  function calcProgresso(plano: Plano) {
    const livros = plano.plano_livros.filter(planoLivro => planoLivro.livros)
    if (!livros.length) return 0

    const lidos = livros.filter(planoLivro =>
      planoLivro.livros?.status === 'lido' || planoLivro.livros?.status === 'reler'
    ).length

    return Math.round((lidos / livros.length) * 100)
  }

  async function toggleStatus(planoLivro: PlanoLivro) {
    if (!planoLivro.livros) return

    const novoStatus: Status = planoLivro.livros.status === 'lido' ? 'comprar' : 'lido'
    setSaving(planoLivro.id)

    const { data, error } = await supabase
      .from('livros')
      .update({ status: novoStatus })
      .eq('id', planoLivro.livros.id)
      .select('id, titulo, autor, status, nota, eixos(nome, cor)')
      .single()

    setSaving(null)

    if (!error && data) {
      const livroAtualizado = {
        ...data,
        eixos: Array.isArray(data.eixos) ? data.eixos[0] ?? null : data.eixos,
      } as PlanoLivro['livros']

      setPlanos(prev =>
        prev.map(plano => ({
          ...plano,
          plano_livros: plano.plano_livros.map(item =>
            item.id === planoLivro.id ? { ...item, livros: livroAtualizado } : item
          ),
        }))
      )
      startTransition(() => router.refresh())
    }
  }

  async function salvarObsMes(planoId: string, observacoes: string) {
    const { error } = await supabase
      .from('planos_mensais')
      .update({ observacoes: observacoes.trim() || null })
      .eq('id', planoId)

    if (!error) {
      setPlanos(prev =>
        prev.map(plano =>
          plano.id === planoId ? { ...plano, observacoes: observacoes.trim() || null } : plano
        )
      )
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Plano de Leitura</h1>
        <p className="mt-1 text-sm text-muted-foreground">24 meses · 3 livros por mês</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Meses concluídos', value: planos.filter(plano => calcProgresso(plano) === 100).length },
          {
            label: 'Em andamento',
            value: planos.filter(plano => calcProgresso(plano) > 0 && calcProgresso(plano) < 100).length,
          },
          {
            label: 'Livros no plano',
            value: planos.reduce(
              (total, plano) => total + plano.plano_livros.filter(planoLivro => planoLivro.livros).length,
              0
            ),
          },
        ].map(metric => (
          <div key={metric.label} className="rounded-lg border border-border bg-card p-3 text-center">
            <div className="text-2xl font-semibold">{metric.value}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{metric.label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {planos.map(plano => {
          const atual = isAtual(plano)
          const passado = isPast(plano)
          const futuro = isFuturo(plano)
          const aberto = expandido === plano.id
          const progresso = calcProgresso(plano)
          const livrosOrdenados = [...plano.plano_livros].sort((a, b) => a.ordem - b.ordem)

          return (
            <div
              key={plano.id}
              ref={atual ? mesAtualRef : undefined}
              className={`rounded-xl border bg-card transition-all ${
                atual ? 'border-primary/50 shadow-sm ring-1 ring-primary/20' : 'border-border'
              } ${futuro ? 'opacity-90' : ''}`}
            >
              <button
                type="button"
                className="flex w-full items-center gap-4 px-5 py-4 text-left"
                onClick={() => setExpandido(aberto ? null : plano.id)}
              >
                <div
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                    atual
                      ? 'bg-primary text-primary-foreground'
                      : passado && progresso === 100
                        ? 'bg-green-500 text-white'
                        : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {passado && progresso === 100 ? '✓' : plano.numero_mes}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">
                      {MESES_PT[plano.mes - 1]} {plano.ano}
                    </span>
                    {atual && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        Mês atual
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {plano.objetivo ?? plano.titulo}
                  </p>
                </div>

                <div className="flex flex-shrink-0 items-center gap-3">
                  <div className="hidden items-center gap-2 sm:flex">
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={`h-full rounded-full transition-all ${
                          progresso === 100 ? 'bg-green-500' : 'bg-primary'
                        }`}
                        style={{ width: `${progresso}%` }}
                      />
                    </div>
                    <span className="w-8 text-xs text-muted-foreground">{progresso}%</span>
                  </div>
                  {aberto ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {aberto && (
                <div className="space-y-4 border-t border-border px-5 pb-5 pt-4">
                  <div className="space-y-2">
                    {livrosOrdenados.map(planoLivro => {
                      if (!planoLivro.livros) return null

                      const lido = planoLivro.livros.status === 'lido' || planoLivro.livros.status === 'reler'
                      const carregando = saving === planoLivro.id

                      return (
                        <div
                          key={planoLivro.id}
                          className={`flex items-start gap-3 rounded-lg p-3 transition-colors ${
                            lido ? 'bg-green-50' : 'bg-secondary/30'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleStatus(planoLivro)}
                            disabled={carregando}
                            className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors ${
                              lido
                                ? 'border-green-500 bg-green-500 text-white'
                                : 'border-border hover:border-primary'
                            }`}
                            aria-label={lido ? 'Marcar como não lido' : 'Marcar como lido'}
                          >
                            {carregando ? (
                              <span className="h-2.5 w-2.5 animate-spin rounded-full border border-current border-t-transparent" />
                            ) : lido ? (
                              <Check className="h-3 w-3" />
                            ) : null}
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`text-sm font-medium ${
                                  lido ? 'text-muted-foreground line-through' : ''
                                }`}
                              >
                                {planoLivro.livros.titulo}
                              </span>
                              <span
                                className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                                  PAPEL_COR[planoLivro.papel] ?? 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {PAPEL_LABEL[planoLivro.papel] ?? planoLivro.papel}
                              </span>
                            </div>
                            {planoLivro.livros.autor && (
                              <p className="mt-0.5 text-xs text-muted-foreground">{planoLivro.livros.autor}</p>
                            )}
                            {planoLivro.livros.eixos && (
                              <span
                                className="mt-1 inline-block rounded px-1.5 py-0.5 text-xs"
                                style={{
                                  backgroundColor: `${planoLivro.livros.eixos.cor}20`,
                                  color: planoLivro.livros.eixos.cor,
                                }}
                              >
                                {planoLivro.livros.eixos.nome}
                              </span>
                            )}
                          </div>

                          <span
                            className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs ${
                              STATUS_CONFIG[planoLivro.livros.status]?.className ?? ''
                            }`}
                          >
                            {STATUS_CONFIG[planoLivro.livros.status]?.label ?? planoLivro.livros.status}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <BookOpen className="h-3 w-3" /> Anotações do mês
                    </label>
                    <ObsField
                      initialValue={plano.observacoes ?? ''}
                      onSave={value => salvarObsMes(plano.id, value)}
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ObsField({ initialValue, onSave }: { initialValue: string; onSave: (value: string) => void }) {
  const [value, setValue] = useState(initialValue)
  const [saved, setSaved] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const nextValue = event.target.value
    setValue(nextValue)

    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      onSave(nextValue)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }, 800)
  }

  return (
    <div className="relative">
      <textarea
        rows={2}
        value={value}
        onChange={handleChange}
        placeholder="Anotações, metas ou reflexões sobre este mês..."
        className="min-h-20 w-full resize rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {saved && (
        <span className="absolute bottom-2 right-3 flex items-center gap-1 text-xs text-green-500">
          <Check className="h-3 w-3" /> Salvo
        </span>
      )}
    </div>
  )
}
