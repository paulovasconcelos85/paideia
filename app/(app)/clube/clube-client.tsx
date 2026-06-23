'use client'

import { useOptimistic, useTransition, useMemo, useState } from 'react'
import { BookOpen, Lightbulb, Quote, Sparkles, Users } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { toggleReacao, type PostTipo } from './actions'
import { EMOJIS, type Emoji } from './constants'

export interface PostFeed {
  id: string
  tipo: 'pensamento' | 'citacao' | 'prosa'
  conteudo: string
  frase?: string | null
  titulo?: string
  tags?: string[] | null
  pagina?: number | null
  livro?: { titulo: string; autor: string | null } | null
  nome_publicador: string | null
  created_at: string
  isMine: boolean
  colorIndex: number
  reacoes: { emoji: string; count: number; minha: boolean }[]
}

// Cores sóbrias para usuários diferentes — índice 0-5
const CORES = [
  { bubble: 'bg-slate-100 border-slate-200',    autor: 'text-slate-500'    },
  { bubble: 'bg-sky-50 border-sky-200',          autor: 'text-sky-600'      },
  { bubble: 'bg-emerald-50 border-emerald-200',  autor: 'text-emerald-600'  },
  { bubble: 'bg-amber-50 border-amber-200',      autor: 'text-amber-600'    },
  { bubble: 'bg-rose-50 border-rose-200',        autor: 'text-rose-500'     },
  { bubble: 'bg-violet-50 border-violet-200',    autor: 'text-violet-500'   },
]
const COR_MINHA = { bubble: 'bg-primary/10 border-primary/30', autor: 'text-primary' }

const TIPO_CONFIG = {
  pensamento: { icon: Lightbulb, label: 'Pensamento' },
  citacao:    { icon: Quote,     label: 'Citação'    },
  prosa:      { icon: Sparkles,  label: 'Prosa'      },
}

type ReacaoItem = PostFeed['reacoes'][number]

function toggleReacaoLocal(reacoes: ReacaoItem[], emoji: string): ReacaoItem[] {
  const idx = reacoes.findIndex(r => r.emoji === emoji)
  if (idx >= 0) {
    const novoCount = reacoes[idx].count - 1
    return novoCount > 0
      ? reacoes.map((r, i) => i === idx ? { ...r, count: novoCount, minha: false } : r)
      : reacoes.filter((_, i) => i !== idx)
  }
  return [...reacoes, { emoji, count: 1, minha: true }]
}

interface Props {
  feed: PostFeed[]
}

export default function ClubeClient({ feed }: Props) {
  const [tagAtiva, setTagAtiva] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [optimisticFeed, addOptimistic] = useOptimistic(
    feed,
    (state: PostFeed[], { tipo, id, emoji }: { tipo: string; id: string; emoji: string }) =>
      state.map(post =>
        post.tipo === tipo && post.id === id
          ? { ...post, reacoes: toggleReacaoLocal(post.reacoes, emoji) }
          : post
      )
  )

  function handleReacao(tipo: PostTipo, id: string, emoji: Emoji) {
    startTransition(async () => {
      addOptimistic({ tipo, id, emoji })
      await toggleReacao(tipo, id, emoji)
    })
  }

  const todasTags = useMemo(() => {
    const set = new Set<string>()
    feed.forEach(p => Array.isArray(p.tags) && p.tags.forEach(t => set.add(t)))
    return Array.from(set).sort()
  }, [feed])

  const feedFiltrado = useMemo(() => {
    if (!tagAtiva) return optimisticFeed
    return optimisticFeed.filter(p => p.tags?.includes(tagAtiva))
  }, [optimisticFeed, tagAtiva])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Users className="h-6 w-6 text-primary" />
          Clube de Leitura
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {feed.length} {feed.length === 1 ? 'publicação' : 'publicações'}
        </p>
      </div>

      {todasTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setTagAtiva(null)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              !tagAtiva ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
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
                tagAtiva === tag ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
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
            const cor = post.isMine ? COR_MINHA : CORES[post.colorIndex]
            const { icon: TipoIcon, label: tipoLabel } = TIPO_CONFIG[post.tipo]
            const autor = post.nome_publicador ?? (post.isMine ? 'Você' : 'Anônimo')

            return (
              <div key={`${post.tipo}-${post.id}`} className={`flex ${post.isMine ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[88%] space-y-1 sm:max-w-[78%]">

                  {/* Bubble */}
                  <div className={`rounded-2xl border p-4 ${cor.bubble} ${post.isMine ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}>

                    {/* Tipo */}
                    <div className="mb-2.5 flex items-center gap-1.5 text-xs opacity-50">
                      <TipoIcon className="h-3 w-3" />
                      <span>{tipoLabel}</span>
                    </div>

                    {/* Conteúdo por tipo */}
                    {post.tipo === 'pensamento' && (
                      <div className="space-y-2.5">
                        <p className="text-sm leading-relaxed">{post.conteudo}</p>
                        {Array.isArray(post.tags) && post.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {post.tags.map(tag => (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => setTagAtiva(tag === tagAtiva ? null : tag)}
                                className={`rounded px-1.5 py-0.5 text-xs transition-colors ${
                                  tagAtiva === tag ? 'bg-primary/20 text-primary' : 'bg-black/5 text-foreground/60 hover:text-foreground'
                                }`}
                              >
                                #{tag}
                              </button>
                            ))}
                          </div>
                        )}
                        {post.livro?.titulo && (
                          <p className="flex items-center gap-1 text-xs opacity-50">
                            <BookOpen className="h-3 w-3" />{post.livro.titulo}
                          </p>
                        )}
                      </div>
                    )}

                    {post.tipo === 'citacao' && (
                      <div className="space-y-2">
                        <blockquote className="text-sm italic leading-relaxed">
                          &ldquo;{post.conteudo}&rdquo;
                        </blockquote>
                        {post.livro?.titulo && (
                          <p className="text-xs opacity-50">
                            {post.livro.titulo}
                            {post.livro.autor ? ` — ${post.livro.autor}` : ''}
                            {post.pagina ? `, p. ${post.pagina}` : ''}
                          </p>
                        )}
                      </div>
                    )}

                    {post.tipo === 'prosa' && (
                      <div className="space-y-3">
                        <p className="text-sm font-semibold">{post.titulo}</p>
                        {post.frase && (
                          <div className="border-l-2 border-current pl-3 opacity-70">
                            <p className="text-sm italic">&ldquo;{post.frase}&rdquo;</p>
                          </div>
                        )}
                        <p className="line-clamp-3 text-sm leading-relaxed opacity-80">
                          {post.conteudo.split('\n\n')[0]}
                        </p>
                      </div>
                    )}

                    {/* Reações */}
                    <div className={`mt-3 flex flex-wrap gap-1 ${post.isMine ? 'justify-end' : 'justify-start'}`}>
                      {EMOJIS.map(emoji => {
                        const reacao = post.reacoes.find(r => r.emoji === emoji)
                        return reacao ? (
                          <button
                            key={emoji}
                            type="button"
                            disabled={isPending}
                            onClick={() => handleReacao(post.tipo as PostTipo, post.id, emoji)}
                            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
                              reacao.minha
                                ? 'border-primary/40 bg-primary/10 text-primary font-medium'
                                : 'border-black/10 bg-white/60 text-foreground/70 hover:border-black/20 hover:bg-white'
                            }`}
                          >
                            <span>{emoji}</span>
                            <span>{reacao.count}</span>
                          </button>
                        ) : (
                          <button
                            key={emoji}
                            type="button"
                            disabled={isPending}
                            onClick={() => handleReacao(post.tipo as PostTipo, post.id, emoji)}
                            className="rounded-full border border-transparent px-2 py-0.5 text-xs text-foreground/20 transition-colors hover:border-black/10 hover:bg-white/60 hover:text-foreground/60"
                          >
                            {emoji}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Autor + data */}
                  <p className={`px-1 text-xs text-muted-foreground ${post.isMine ? 'text-right' : 'text-left'}`}>
                    <span className={`font-medium ${cor.autor}`}>{autor}</span>
                    {' · '}{formatDate(post.created_at)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
