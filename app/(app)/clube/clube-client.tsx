'use client'

import { useMemo, useState } from 'react'
import { BookOpen, Lightbulb, Quote, Sparkles, Users } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface PensamentoPublico {
  id: string
  conteudo: string
  tags: string[] | null
  nome_publicador: string | null
  created_at: string
  livros?: { titulo: string; autor: string | null } | null
}

interface CitacaoPublica {
  id: string
  texto: string
  pagina: number | null
  nome_publicador: string | null
  created_at: string
  livros?: { titulo: string; autor: string | null } | null
}

interface ProsaPublica {
  id: string
  titulo: string
  frase: string | null
  conteudo: string
  nome_publicador: string | null
  created_at: string
}

type PostClube =
  | { tipo: 'pensamento'; data: PensamentoPublico }
  | { tipo: 'citacao'; data: CitacaoPublica }
  | { tipo: 'prosa'; data: ProsaPublica }

interface Props {
  pensamentos: PensamentoPublico[]
  citacoes: CitacaoPublica[]
  prosas: ProsaPublica[]
}

export default function ClubeClient({ pensamentos, citacoes, prosas }: Props) {
  const [tagAtiva, setTagAtiva] = useState<string | null>(null)

  const feed: PostClube[] = useMemo(() => {
    const todos: PostClube[] = [
      ...pensamentos.map(p => ({ tipo: 'pensamento' as const, data: p })),
      ...citacoes.map(c => ({ tipo: 'citacao' as const, data: c })),
      ...prosas.map(p => ({ tipo: 'prosa' as const, data: p })),
    ]
    return todos.sort(
      (a, b) => new Date(b.data.created_at).getTime() - new Date(a.data.created_at).getTime()
    )
  }, [pensamentos, citacoes, prosas])

  const todasTags = useMemo(() => {
    const set = new Set<string>()
    pensamentos.forEach(p => p.tags?.forEach(t => set.add(t)))
    return Array.from(set).sort()
  }, [pensamentos])

  const feedFiltrado = useMemo(() => {
    if (!tagAtiva) return feed
    return feed.filter(post => {
      if (post.tipo !== 'pensamento') return false
      return post.data.tags?.includes(tagAtiva) ?? false
    })
  }, [feed, tagAtiva])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Users className="h-6 w-6 text-primary" />
          Clube de Leitura
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {feed.length} {feed.length === 1 ? 'publicação' : 'publicações'} da comunidade
        </p>
      </div>

      {todasTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setTagAtiva(null)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              !tagAtiva
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            Todos
          </button>
          {todasTags.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => setTagAtiva(tag === tagAtiva ? null : tag)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                tagAtiva === tag
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {feedFiltrado.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center space-y-3">
          <Users className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {feed.length === 0
              ? 'Nenhuma publicação ainda. Compartilhe pensamentos e citações no Caderno ou em Citações.'
              : 'Nenhuma publicação com essa tag.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {feedFiltrado.map(post => {
            if (post.tipo === 'pensamento') {
              const p = post.data
              return (
                <div key={`p-${p.id}`} className="space-y-3 rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start gap-3">
                    <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                    <p className="min-w-0 flex-1 text-sm leading-relaxed">{p.conteudo}</p>
                  </div>

                  {p.tags && p.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {p.tags.map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setTagAtiva(tag === tagAtiva ? null : tag)}
                          className={`rounded px-1.5 py-0.5 text-xs transition-colors ${
                            tagAtiva === tag
                              ? 'bg-primary/10 text-primary'
                              : 'bg-secondary text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    {p.livros?.titulo ? (
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        {p.livros.titulo}
                      </span>
                    ) : (
                      <span />
                    )}
                    <span>{p.nome_publicador ?? 'Anônimo'} · {formatDate(p.created_at)}</span>
                  </div>
                </div>
              )
            }

            if (post.tipo === 'citacao') {
              const c = post.data
              return (
                <div key={`c-${c.id}`} className="space-y-3 rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start gap-3">
                    <Quote className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary/60" />
                    <blockquote className="min-w-0 flex-1 text-sm italic leading-relaxed">
                      &ldquo;{c.texto}&rdquo;
                    </blockquote>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      {c.livros?.titulo
                        ? `${c.livros.titulo}${c.livros.autor ? ` — ${c.livros.autor}` : ''}${c.pagina ? `, p. ${c.pagina}` : ''}`
                        : ''}
                    </span>
                    <span>{c.nome_publicador ?? 'Anônimo'} · {formatDate(c.created_at)}</span>
                  </div>
                </div>
              )
            }

            const pr = post.data
            return (
              <div key={`pr-${pr.id}`} className="space-y-4 rounded-xl border border-primary/20 bg-card p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <h3 className="min-w-0 flex-1 text-sm font-semibold leading-snug">{pr.titulo}</h3>
                </div>

                {pr.frase && (
                  <div className="rounded-lg border-l-4 border-primary bg-primary/5 px-4 py-3">
                    <p className="text-sm font-medium italic leading-relaxed">
                      &ldquo;{pr.frase}&rdquo;
                    </p>
                  </div>
                )}

                <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">
                  {pr.conteudo.split('\n\n')[0]}
                </p>

                <div className="text-right text-xs text-muted-foreground">
                  {pr.nome_publicador ?? 'Anônimo'} · {formatDate(pr.created_at)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
