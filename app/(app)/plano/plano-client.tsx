'use client'

import { useEffect, useMemo, useRef, useState, useTransition, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, Check, ChevronDown, ChevronUp, Plus, Search, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { STATUS_CONFIG } from '@/lib/utils'
import type { Status } from '@/lib/types'

type EntradaObs = { key: string; value: string }

function parseObs(obs: string | null): EntradaObs[] {
  if (!obs) return []
  try {
    const parsed = JSON.parse(obs)
    if (Array.isArray(parsed)) {
      return parsed.filter(Boolean).map((v: string) => ({ key: Math.random().toString(36).slice(2), value: v }))
    }
  } catch {
    // not JSON
  }
  return obs.trim() ? [{ key: Math.random().toString(36).slice(2), value: obs }] : []
}

function stringifyObs(entries: EntradaObs[]): string | null {
  const values = entries.map(e => e.value).filter(v => v.trim())
  if (!values.length) return null
  return JSON.stringify(values)
}

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

interface LivroSimples {
  id: string
  titulo: string
  autor: string | null
}

interface Props {
  userId: string
  planos: Plano[]
  livrosBiblioteca: LivroSimples[]
}

function normalizePlanoLivro(data: unknown): PlanoLivro {
  const item = data as PlanoLivro & { livros?: (PlanoLivro['livros'] & { eixos?: { nome: string; cor: string }[] | { nome: string; cor: string } | null }) | null }
  const livro = item.livros

  return {
    ...item,
    livros: livro
      ? {
          ...livro,
          eixos: Array.isArray(livro.eixos) ? livro.eixos[0] ?? null : livro.eixos ?? null,
        }
      : null,
  }
}

export default function PlanoClient({ userId, planos: initial, livrosBiblioteca }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [, startTransition] = useTransition()
  const [planos, setPlanos] = useState(initial)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [criandoMes, setCriandoMes] = useState(false)
  const mesAtualRef = useRef<HTMLDivElement>(null)

  const [modalPlanoId, setModalPlanoId] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [novoTitulo, setNovoTitulo] = useState('')
  const [novoAutor, setNovoAutor] = useState('')
  const [novoPapel, setNovoPapel] = useState('literatura')
  const [adicionando, setAdicionando] = useState(false)
  const [modoNovo, setModoNovo] = useState(false)

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

  function isPast(plano: Plano) {
    return plano.ano < anoAtual || (plano.ano === anoAtual && plano.mes < mesAtual)
  }

  function calcProgresso(plano: Plano) {
    const livros = plano.plano_livros.filter(planoLivro => planoLivro.livros)
    if (!livros.length) return 0

    return Math.round(
      (livros.filter(planoLivro =>
        planoLivro.livros?.status === 'lido' || planoLivro.livros?.status === 'reler'
      ).length / livros.length) * 100
    )
  }

  const proximoMes = useMemo(() => {
    if (!planos.length) return { ano: anoAtual, mes: mesAtual, numero_mes: 1 }

    const ultimo = planos[planos.length - 1]
    const proximoMesNumero = ultimo.mes === 12 ? 1 : ultimo.mes + 1
    const proximoAno = ultimo.mes === 12 ? ultimo.ano + 1 : ultimo.ano

    return { ano: proximoAno, mes: proximoMesNumero, numero_mes: ultimo.numero_mes + 1 }
  }, [anoAtual, mesAtual, planos])

  const livrosFiltrados = useMemo(() => {
    if (!busca.trim()) return livrosBiblioteca.slice(0, 8)

    const query = busca.toLowerCase()
    return livrosBiblioteca
      .filter(livro =>
        livro.titulo.toLowerCase().includes(query) || (livro.autor ?? '').toLowerCase().includes(query)
      )
      .slice(0, 8)
  }, [busca, livrosBiblioteca])

  const planoAtualModal = planos.find(plano => plano.id === modalPlanoId)

  async function criarProximoMes() {
    setCriandoMes(true)
    const { ano, mes, numero_mes } = proximoMes
    const titulo = `Mês ${numero_mes} — ${MESES_PT[mes - 1]} ${ano}`

    const { data, error } = await supabase
      .from('planos_mensais')
      .insert({ user_id: userId, numero_mes, ano, mes, titulo, objetivo: '' })
      .select('*, plano_livros(*)')
      .single()

    setCriandoMes(false)

    if (!error && data) {
      const novo = { ...data, plano_livros: [] } as Plano
      setPlanos(prev => [...prev, novo])
      setExpandido(novo.id)
      startTransition(() => router.refresh())
      window.setTimeout(() => {
        document.getElementById(`mes-${novo.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 200)
    }
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

  async function removerLivroDoMes(planoLivroId: string, planoId: string) {
    const { error } = await supabase.from('plano_livros').delete().eq('id', planoLivroId)
    if (!error) {
      setPlanos(prev =>
        prev.map(plano =>
          plano.id === planoId
            ? { ...plano, plano_livros: plano.plano_livros.filter(item => item.id !== planoLivroId) }
            : plano
        )
      )
    }
  }

  async function adicionarLivroExistente(planoId: string, livro: LivroSimples) {
    setAdicionando(true)
    const plano = planos.find(item => item.id === planoId)
    const ordem = (plano?.plano_livros.length ?? 0) + 1

    const { data, error } = await supabase
      .from('plano_livros')
      .insert({ plano_id: planoId, livro_id: livro.id, papel: novoPapel, ordem })
      .select('id, papel, ordem, observacoes, livros(id, titulo, autor, status, nota, eixos(nome, cor))')
      .single()

    setAdicionando(false)

    if (!error && data) {
      const novoItem = normalizePlanoLivro(data)
      setPlanos(prev =>
        prev.map(item =>
          item.id === planoId ? { ...item, plano_livros: [...item.plano_livros, novoItem] } : item
        )
      )
      setBusca('')
      setModalPlanoId(null)
      startTransition(() => router.refresh())
    }
  }

  async function adicionarLivroNovo(planoId: string) {
    if (!novoTitulo.trim()) return

    setAdicionando(true)
    const { data: livro, error: errLivro } = await supabase
      .from('livros')
      .insert({
        user_id: userId,
        titulo: novoTitulo.trim(),
        autor: novoAutor.trim() || null,
        status: 'comprar',
      })
      .select('id, titulo, autor, status, nota, eixos(nome, cor)')
      .single()

    if (errLivro || !livro) {
      setAdicionando(false)
      return
    }

    const plano = planos.find(item => item.id === planoId)
    const ordem = (plano?.plano_livros.length ?? 0) + 1
    const { data, error } = await supabase
      .from('plano_livros')
      .insert({ plano_id: planoId, livro_id: livro.id, papel: novoPapel, ordem })
      .select('id, papel, ordem, observacoes, livros(id, titulo, autor, status, nota, eixos(nome, cor))')
      .single()

    setAdicionando(false)

    if (!error && data) {
      const novoItem = normalizePlanoLivro(data)
      setPlanos(prev =>
        prev.map(item =>
          item.id === planoId ? { ...item, plano_livros: [...item.plano_livros, novoItem] } : item
        )
      )
      setNovoTitulo('')
      setNovoAutor('')
      setModoNovo(false)
      setModalPlanoId(null)
      startTransition(() => router.refresh())
    }
  }

  async function salvarObsMes(planoId: string, observacoes: string | null) {
    const { error } = await supabase
      .from('planos_mensais')
      .update({ observacoes })
      .eq('id', planoId)

    if (!error) {
      setPlanos(prev =>
        prev.map(plano =>
          plano.id === planoId ? { ...plano, observacoes } : plano
        )
      )
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Plano de Leitura</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {planos.length} meses · sem limite de livros por mês
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          {
            label: 'Meses concluídos',
            value: planos.filter(plano => calcProgresso(plano) === 100 && plano.plano_livros.length > 0).length,
          },
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
          const aberto = expandido === plano.id
          const progresso = calcProgresso(plano)
          const livrosOrdenados = [...plano.plano_livros].sort((a, b) => a.ordem - b.ordem)

          return (
            <div
              key={plano.id}
              id={`mes-${plano.id}`}
              ref={atual ? mesAtualRef : undefined}
              className={`rounded-xl border bg-card transition-all ${
                atual ? 'border-primary/50 ring-1 ring-primary/20' : 'border-border'
              }`}
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
                      : passado && progresso === 100 && plano.plano_livros.length > 0
                        ? 'bg-green-500 text-white'
                        : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {passado && progresso === 100 && plano.plano_livros.length > 0 ? '✓' : plano.numero_mes}
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
                    <span className="text-xs text-muted-foreground">
                      {livrosOrdenados.length} livro{livrosOrdenados.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {plano.objetivo && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{plano.objetivo}</p>
                  )}
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
                    {livrosOrdenados.length === 0 && (
                      <p className="py-4 text-center text-sm text-muted-foreground">
                        Nenhum livro neste mês ainda.
                      </p>
                    )}
                    {livrosOrdenados.map(planoLivro => {
                      if (!planoLivro.livros) return null

                      const lido = planoLivro.livros.status === 'lido' || planoLivro.livros.status === 'reler'
                      const carregando = saving === planoLivro.id

                      return (
                        <div
                          key={planoLivro.id}
                          className={`group flex items-start gap-3 rounded-lg p-3 transition-colors ${
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
                          </div>
                          <div className="flex items-center gap-1">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs ${
                                STATUS_CONFIG[planoLivro.livros.status]?.className ?? ''
                              }`}
                            >
                              {STATUS_CONFIG[planoLivro.livros.status]?.label}
                            </span>
                            <button
                              type="button"
                              onClick={() => removerLivroDoMes(planoLivro.id, plano.id)}
                              className="p-1 text-muted-foreground opacity-0 transition-all hover:text-destructive group-hover:opacity-100"
                              aria-label="Remover livro do mês"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setModalPlanoId(plano.id)
                      setBusca('')
                      setModoNovo(false)
                    }}
                    className="flex items-center gap-2 text-sm text-primary transition-colors hover:text-primary/80"
                  >
                    <Plus className="h-4 w-4" /> Adicionar livro
                  </button>

                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <BookOpen className="h-3 w-3" /> Anotações do mês
                    </label>
                    <AnotacoesField
                      initialObs={plano.observacoes}
                      onSave={value => salvarObsMes(plano.id, value)}
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}

        <button
          type="button"
          onClick={criarProximoMes}
          disabled={criandoMes}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-4 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {criandoMes
            ? 'Criando...'
            : `Criar ${MESES_PT[proximoMes.mes - 1]} ${proximoMes.ano} (Mês ${proximoMes.numero_mes})`}
        </button>
      </div>

      {modalPlanoId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={event => {
            if (event.target === event.currentTarget) setModalPlanoId(null)
          }}
        >
          <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-background p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Adicionar livro</h2>
              <button type="button" onClick={() => setModalPlanoId(null)} aria-label="Fechar">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Papel no mês</label>
              <select
                value={novoPapel}
                onChange={event => setNovoPapel(event.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {Object.entries(PAPEL_LABEL).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setModoNovo(false)}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                  !modoNovo ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                }`}
              >
                Da biblioteca
              </button>
              <button
                type="button"
                onClick={() => setModoNovo(true)}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                  modoNovo ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                }`}
              >
                Livro novo
              </button>
            </div>

            {!modoNovo ? (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Buscar título ou autor..."
                    value={busca}
                    onChange={event => setBusca(event.target.value)}
                    autoFocus
                    className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="max-h-56 space-y-1 overflow-y-auto">
                  {livrosFiltrados.map(livro => {
                    const jaNoMes = planoAtualModal?.plano_livros.some(
                      planoLivro => planoLivro.livros?.id === livro.id
                    )

                    return (
                      <button
                        key={livro.id}
                        type="button"
                        disabled={jaNoMes || adicionando}
                        onClick={() => adicionarLivroExistente(modalPlanoId, livro)}
                        className={`w-full rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                          jaNoMes ? 'cursor-not-allowed opacity-40' : 'hover:bg-secondary'
                        }`}
                      >
                        <div className="font-medium">{livro.titulo}</div>
                        {livro.autor && <div className="text-xs text-muted-foreground">{livro.autor}</div>}
                        {jaNoMes && <div className="text-xs italic text-muted-foreground">já neste mês</div>}
                      </button>
                    )
                  })}
                  {livrosFiltrados.length === 0 && (
                    <p className="py-4 text-center text-sm text-muted-foreground">Nenhum livro encontrado.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Título *</label>
                  <input
                    type="text"
                    value={novoTitulo}
                    onChange={event => setNovoTitulo(event.target.value)}
                    placeholder="Ex: Os Miseráveis"
                    autoFocus
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Autor</label>
                  <input
                    type="text"
                    value={novoAutor}
                    onChange={event => setNovoAutor(event.target.value)}
                    placeholder="Ex: Victor Hugo"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => adicionarLivroNovo(modalPlanoId)}
                  disabled={adicionando || !novoTitulo.trim()}
                  className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground transition-colors disabled:opacity-50"
                >
                  {adicionando ? 'Salvando...' : 'Criar e adicionar'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function EntradaObsField({
  value,
  onSave,
  onDelete,
}: {
  value: string
  onSave: (value: string) => void
  onDelete: () => void
}) {
  const [val, setVal] = useState(value)
  const [saved, setSaved] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const next = event.target.value
    setVal(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      onSave(next)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }, 800)
  }

  return (
    <div className="group relative">
      <textarea
        rows={2}
        value={val}
        onChange={handleChange}
        placeholder="Anotação, reflexão ou meta..."
        className="min-h-16 w-full resize rounded-md border border-border bg-background px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {saved && (
        <span className="absolute bottom-2 right-8 flex items-center gap-1 text-xs text-green-500">
          <Check className="h-3 w-3" /> Salvo
        </span>
      )}
      <button
        type="button"
        onClick={onDelete}
        className="absolute right-2 top-2 p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
        aria-label="Remover anotação"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  )
}

function AnotacoesField({
  initialObs,
  onSave,
}: {
  initialObs: string | null
  onSave: (value: string | null) => void
}) {
  const [entries, setEntries] = useState<EntradaObs[]>(() => parseObs(initialObs))

  function adicionarEntrada() {
    setEntries(prev => [...prev, { key: Math.random().toString(36).slice(2), value: '' }])
  }

  function atualizarEntrada(key: string, valor: string) {
    const next = entries.map(e => e.key === key ? { ...e, value: valor } : e)
    setEntries(next)
    onSave(stringifyObs(next))
  }

  function removerEntrada(key: string) {
    const next = entries.filter(e => e.key !== key)
    setEntries(next)
    onSave(stringifyObs(next))
  }

  return (
    <div className="space-y-2">
      {entries.map(entry => (
        <EntradaObsField
          key={entry.key}
          value={entry.value}
          onSave={valor => atualizarEntrada(entry.key, valor)}
          onDelete={() => removerEntrada(entry.key)}
        />
      ))}
      <button
        type="button"
        onClick={adicionarEntrada}
        className="flex items-center gap-1.5 text-xs text-primary transition-colors hover:text-primary/80"
      >
        <Plus className="h-3.5 w-3.5" /> Adicionar anotação
      </button>
    </div>
  )
}
