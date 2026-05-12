'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, CalendarDays, Lightbulb, Plus, Quote, Sparkles, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'

interface Pensamento {
  id: string
  conteudo: string
  tags: string[] | null
  created_at: string
  livros?: { titulo: string } | null
}

interface Citacao {
  id: string
  texto: string
  pagina: number | null
  created_at: string
  livros?: { titulo: string; autor: string | null } | null
}

interface Prosa {
  id: string
  titulo: string
  conteudo: string
  frase: string | null
  fontes: {
    pensamentos: number
    citacoes: number
    observacoes_livros: number
    observacoes_meses: number
  } | null
  created_at: string
}

interface Livro {
  id: string
  titulo: string
  autor: string | null
}

interface LivroObservado extends Livro {
  observacoes: string | null
  updated_at: string
}

interface PlanoObs {
  id: string
  titulo: string
  observacoes: string | null
  updated_at: string
}

interface Props {
  userId: string
  pensamentos: Pensamento[]
  citacoes: Citacao[]
  prosas: Prosa[]
  livros: Livro[]
  livrosObservados: LivroObservado[]
  planosComObs: PlanoObs[]
}

function parsePlanoObs(obs: string | null): string[] {
  if (!obs) return []
  try {
    const parsed = JSON.parse(obs)
    if (Array.isArray(parsed)) return parsed.filter(Boolean)
  } catch {
    // plain text (backward compat)
  }
  return obs.trim() ? [obs] : []
}

type Aba = 'fragmentos' | 'caderno'
type Janela = '7d' | '30d' | 'ultima' | 'custom'

const JANELA_LABEL: Record<Janela, string> = {
  '7d': '7 dias',
  '30d': '30 dias',
  'ultima': 'Última geração',
  'custom': 'Personalizado',
}

export default function CadernoClient({
  userId,
  pensamentos: initPensamentos,
  citacoes: initCitacoes,
  prosas: initProsas,
  livros,
  livrosObservados: initLivrosObservados,
  planosComObs,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [, startTransition] = useTransition()

  const [aba, setAba] = useState<Aba>('fragmentos')
  const [pensamentos, setPensamentos] = useState(initPensamentos)
  const [citacoes] = useState(initCitacoes)
  const [prosas, setProsas] = useState(initProsas)
  const [prosaAtiva, setProsaAtiva] = useState<Prosa | null>(initProsas[0] ?? null)
  const [livrosObservados, setLivrosObservados] = useState(initLivrosObservados)

  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [gerando, setGerando] = useState(false)
  const [erroGerar, setErroGerar] = useState('')
  const [form, setForm] = useState({ conteudo: '', livro_id: '', tags: '' })

  const [janela, setJanela] = useState<Janela>('ultima')
  const hoje = new Date().toISOString().slice(0, 10)
  const [customInicio, setCustomInicio] = useState(hoje)
  const [customFim, setCustomFim] = useState(hoje)

  function calcDatas(): { dataInicio: string; dataFim: string } {
    const agora = new Date()
    const fim = agora.toISOString()

    if (janela === '7d') {
      const inicio = new Date(agora)
      inicio.setDate(inicio.getDate() - 7)
      return { dataInicio: inicio.toISOString(), dataFim: fim }
    }
    if (janela === '30d') {
      const inicio = new Date(agora)
      inicio.setDate(inicio.getDate() - 30)
      return { dataInicio: inicio.toISOString(), dataFim: fim }
    }
    if (janela === 'ultima') {
      const ultimaProsa = prosas[0]?.created_at
      const inicio = ultimaProsa
        ? new Date(ultimaProsa).toISOString()
        : new Date(0).toISOString()
      return { dataInicio: inicio, dataFim: fim }
    }
    // custom
    return {
      dataInicio: new Date(customInicio + 'T00:00:00').toISOString(),
      dataFim: new Date(customFim + 'T23:59:59').toISOString(),
    }
  }

  const totalEntradasPlano = planosComObs.reduce(
    (acc, plano) => acc + parsePlanoObs(plano.observacoes).length,
    0
  )
  const totalFragmentos = pensamentos.length + citacoes.length + livrosObservados.length + totalEntradasPlano

  async function salvarPensamento() {
    if (!form.conteudo.trim()) return

    setSaving(true)
    const tags = form.tags
      ? form.tags.split(',').map(tag => tag.trim()).filter(Boolean)
      : null

    const { data, error } = await supabase
      .from('pensamentos')
      .insert({
        user_id: userId,
        conteudo: form.conteudo.trim(),
        livro_id: form.livro_id || null,
        tags,
      })
      .select('*, livros(titulo)')
      .single()

    setSaving(false)

    if (!error && data) {
      setPensamentos(prev => [data as Pensamento, ...prev])
      setModalOpen(false)
      setForm({ conteudo: '', livro_id: '', tags: '' })
      startTransition(() => router.refresh())
    }
  }

  async function deletarPensamento(id: string) {
    const { error } = await supabase.from('pensamentos').delete().eq('id', id)
    if (!error) {
      setPensamentos(prev => prev.filter(pensamento => pensamento.id !== id))
    }
  }

  async function deletarObsLivro(livroId: string) {
    const { error } = await supabase.from('livros').update({ observacoes: null }).eq('id', livroId)
    if (!error) {
      setLivrosObservados(prev => prev.filter(l => l.id !== livroId))
    }
  }

  async function gerarProsa() {
    setGerando(true)
    setErroGerar('')

    try {
      const { dataInicio, dataFim } = calcDatas()
      const response = await fetch('/api/caderno/gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataInicio, dataFim }),
      })
      const data = await response.json()

      if (!response.ok) {
        setErroGerar(data.error ?? 'Erro ao gerar.')
        setGerando(false)
        return
      }

      const nova: Prosa = {
        id: data.id,
        titulo: data.titulo,
        conteudo: data.prosa,
        frase: data.frase ?? null,
        fontes: data.fontes ?? null,
        created_at: data.created_at ?? new Date().toISOString(),
      }

      setProsas(prev => [nova, ...prev])
      setProsaAtiva(nova)
      setAba('caderno')
      startTransition(() => router.refresh())
    } catch {
      setErroGerar('Erro de conexão.')
    }

    setGerando(false)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Caderno de Pensamentos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {totalFragmentos} fragmentos · {prosas.length} prosas geradas
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors hover:bg-secondary"
          >
            <Plus className="h-4 w-4" />
            Fragmento
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3">
          <div className="flex flex-1 flex-wrap gap-1.5">
            {(Object.entries(JANELA_LABEL) as [Janela, string][]).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setJanela(key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  janela === key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {janela === 'custom' && (
            <div className="flex items-center gap-2 text-xs">
              <input
                type="date"
                value={customInicio}
                onChange={e => setCustomInicio(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <span className="text-muted-foreground">até</span>
              <input
                type="date"
                value={customFim}
                onChange={e => setCustomFim(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}

          <button
            type="button"
            onClick={gerarProsa}
            disabled={gerando || totalFragmentos === 0}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {gerando ? 'Gerando...' : 'Gerar prosa'}
          </button>
        </div>
      </div>

      {erroGerar && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erroGerar}
          <button type="button" onClick={() => setErroGerar('')} aria-label="Fechar erro">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex gap-0 border-b border-border">
        {([
          ['fragmentos', 'Fragmentos'],
          ['caderno', 'Caderno'],
        ] as [Aba, string][]).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setAba(id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm transition-colors ${
              aba === id
                ? 'border-primary font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {aba === 'fragmentos' && (
        <div className="space-y-6">
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Lightbulb className="h-3.5 w-3.5" /> Pensamentos ({pensamentos.length})
            </h2>
            {pensamentos.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Nenhum pensamento ainda. Clique em "Fragmento" para registrar o primeiro.
              </div>
            ) : (
              <div className="space-y-2">
                {pensamentos.map(pensamento => (
                  <div key={pensamento.id} className="group rounded-lg border border-border bg-card p-4">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-relaxed">{pensamento.conteudo}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          {pensamento.livros?.titulo && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <BookOpen className="h-3 w-3" /> {pensamento.livros.titulo}
                            </span>
                          )}
                          {pensamento.tags?.map(tag => (
                            <span key={tag} className="rounded bg-secondary px-1.5 py-0.5 text-xs">
                              #{tag}
                            </span>
                          ))}
                          <span className="ml-auto text-xs text-muted-foreground">
                            {formatDate(pensamento.created_at)}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => deletarPensamento(pensamento.id)}
                        className="p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                        aria-label="Excluir pensamento"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Quote className="h-3.5 w-3.5" /> Citações ({citacoes.length})
            </h2>
            {citacoes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Nenhuma citação ainda. Registre em <strong>Citações</strong>.
              </div>
            ) : (
              <div className="space-y-2">
                {citacoes.map(citacao => (
                  <div key={citacao.id} className="rounded-lg border border-border bg-card p-4">
                    <blockquote className="border-l-2 border-primary/40 pl-3 text-sm italic leading-relaxed">
                      "{citacao.texto}"
                    </blockquote>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      {citacao.livros?.titulo && (
                        <span>
                          {citacao.livros.titulo}
                          {citacao.livros.autor ? ` — ${citacao.livros.autor}` : ''}
                        </span>
                      )}
                      {citacao.pagina && <span>p. {citacao.pagina}</span>}
                      <span className="ml-auto">{formatDate(citacao.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5" /> Observações de livros ({livrosObservados.length})
            </h2>

            {livrosObservados.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Nenhuma observação de livro ainda. Abra um livro na Biblioteca e preencha o campo de observações.
              </div>
            ) : (
              <div className="space-y-2">
                {livrosObservados.map(livro => (
                  <div key={livro.id} className="group rounded-lg border border-border bg-card p-4">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-relaxed">{livro.observacoes}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <BookOpen className="h-3 w-3" /> {livro.titulo}
                          </span>
                          {livro.autor && <span>— {livro.autor}</span>}
                          <span className="ml-auto">{formatDate(livro.updated_at)}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => deletarObsLivro(livro.id)}
                        className="p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                        aria-label="Excluir observação"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" /> Anotações do plano ({totalEntradasPlano})
            </h2>
            {planosComObs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Nenhuma anotação de plano ainda. Abra um mês no Plano e use "Adicionar anotação".
              </div>
            ) : (
              <div className="space-y-2">
                {planosComObs.map(plano => {
                  const entradas = parsePlanoObs(plano.observacoes)
                  if (!entradas.length) return null
                  return entradas.map((entrada, i) => (
                    <div key={`${plano.id}-${i}`} className="rounded-lg border border-border bg-card p-4">
                      <p className="text-sm leading-relaxed">{entrada}</p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <CalendarDays className="h-3 w-3" />
                        <span>{plano.titulo}</span>
                        <span className="ml-auto">{formatDate(plano.updated_at)}</span>
                      </div>
                    </div>
                  ))
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {aba === 'caderno' && (
        <div className="space-y-4">
          {prosas.length === 0 ? (
            <div className="space-y-3 rounded-xl border border-dashed border-border p-12 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Nenhuma prosa gerada ainda.
                <br />
                Adicione fragmentos e clique em <strong>Gerar prosa</strong>.
              </p>
            </div>
          ) : (
            <>
              {prosas.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {prosas.map(prosa => (
                    <button
                      key={prosa.id}
                      type="button"
                      onClick={() => setProsaAtiva(prosa)}
                      className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                        prosaAtiva?.id === prosa.id
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {formatDate(prosa.created_at)}
                    </button>
                  ))}
                </div>
              )}

              {prosaAtiva && (
                <div className="space-y-6 rounded-xl border border-border bg-card p-6 md:p-8">
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="text-lg font-semibold">{prosaAtiva.titulo}</h2>
                    <span className="text-xs text-muted-foreground">{formatDate(prosaAtiva.created_at)}</span>
                  </div>

                  {prosaAtiva.frase && (
                    <div className="rounded-lg border-l-4 border-primary bg-primary/5 px-5 py-4">
                      <p className="text-base font-medium italic leading-relaxed text-foreground">
                        &ldquo;{prosaAtiva.frase}&rdquo;
                      </p>
                    </div>
                  )}

                  {prosaAtiva.fontes && (
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>{prosaAtiva.fontes.pensamentos} pensamentos</span>
                      <span>{prosaAtiva.fontes.citacoes} citações</span>
                      <span>{prosaAtiva.fontes.observacoes_livros} obs. de livros</span>
                      <span>{prosaAtiva.fontes.observacoes_meses} obs. mensais</span>
                    </div>
                  )}

                  <div className="max-w-none text-foreground">
                    {prosaAtiva.conteudo.split('\n\n').map((paragrafo, index) => (
                      <p key={index} className="mb-4 text-sm leading-7 last:mb-0">
                        {paragrafo}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={event => {
            if (event.target === event.currentTarget) setModalOpen(false)
          }}
        >
          <div className="w-full max-w-lg space-y-5 rounded-xl border border-border bg-background p-6 shadow-xl">
            <h2 className="text-lg font-semibold">Novo fragmento</h2>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Pensamento *</label>
                <textarea
                  rows={4}
                  value={form.conteudo}
                  onChange={event => setForm(prev => ({ ...prev, conteudo: event.target.value }))}
                  placeholder="Uma ideia, reflexão, conexão entre livros, observação..."
                  className="min-h-32 w-full resize rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Livro relacionado</label>
                  <select
                    value={form.livro_id}
                    onChange={event => setForm(prev => ({ ...prev, livro_id: event.target.value }))}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Nenhum</option>
                    {livros.map(livro => (
                      <option key={livro.id} value={livro.id}>
                        {livro.titulo}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Tags</label>
                  <input
                    type="text"
                    value={form.tags}
                    onChange={event => setForm(prev => ({ ...prev, tags: event.target.value }))}
                    placeholder="fé, política, arte..."
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-md border border-border px-4 py-2 text-sm transition-colors hover:bg-secondary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarPensamento}
                disabled={saving || !form.conteudo.trim()}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
