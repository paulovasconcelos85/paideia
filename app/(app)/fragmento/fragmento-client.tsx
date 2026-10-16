'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { BookOpen, ChevronLeft, Globe, ImagePlus, SquarePen, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Nota {
  id: string
  conteudo: string
  tags: string[] | null
  publico: boolean
  imagem_url: string | null
  livro_id: string | null
  created_at: string
  updated_at: string
}

interface Livro {
  id: string
  titulo: string
}

interface Props {
  userId: string
  notas: Nota[]
  livros: Livro[]
}

// Nota sendo editada. `chave` identifica o rascunho antes de ele ganhar um id no banco.
interface Rascunho {
  chave: string
  id: string | null
  conteudo: string
  tagsOriginais: string[]
  publico: boolean
  imagem_url: string | null
  livro_id: string | null
  created_at: string
}

type Status = 'idle' | 'salvando' | 'salvo' | 'erro'

const ESPERA_AUTOSAVE = 700

function novoRascunho(): Rascunho {
  return {
    chave: crypto.randomUUID(),
    id: null,
    conteudo: '',
    tagsOriginais: [],
    publico: false,
    imagem_url: null,
    livro_id: null,
    created_at: new Date().toISOString(),
  }
}

function rascunhoDe(nota: Nota): Rascunho {
  return {
    chave: nota.id,
    id: nota.id,
    conteudo: nota.conteudo,
    tagsOriginais: nota.tags ?? [],
    publico: nota.publico,
    imagem_url: nota.imagem_url,
    livro_id: nota.livro_id,
    created_at: nota.created_at,
  }
}

// #hashtags escritas no texto viram tags, como no app Notas
function extrairTags(conteudo: string, originais: string[]): string[] | null {
  const doTexto = Array.from(conteudo.matchAll(/#([\p{L}\p{N}_-]+)/gu), m => m[1].toLowerCase())
  const tags = Array.from(new Set([...originais, ...doTexto]))
  return tags.length ? tags : null
}

function titulo(conteudo: string) {
  return conteudo.trim().split('\n')[0] || 'Nova nota'
}

function resumo(conteudo: string) {
  return conteudo.trim().split('\n').slice(1).find(l => l.trim())?.trim() ?? 'Sem texto adicional'
}

function dataCurta(iso: string) {
  const data = new Date(iso)
  const hoje = new Date()
  if (data.toDateString() === hoje.toDateString()) {
    return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function dataLonga(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })
}

export default function FragmentoClient({ userId, notas: initNotas, livros }: Props) {
  const supabase = createClient()

  const [notas, setNotas] = useState(initNotas)
  const [atual, setAtualState] = useState<Rascunho>(novoRascunho)
  const [status, setStatus] = useState<Status>('idle')
  const [focado, setFocado] = useState(false)
  const [verLista, setVerLista] = useState(false)
  const [enviandoImagem, setEnviandoImagem] = useState(false)
  const [erroImagem, setErroImagem] = useState('')

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const atualRef = useRef(atual)
  const sujoRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const filaRef = useRef<Promise<void>>(Promise.resolve())
  const nomeClubeRef = useRef<string | null | undefined>(undefined)

  // Mantém o ref sincronizado na hora — o autosave lê dele, não do estado renderizado
  const setAtual = useCallback((fn: (prev: Rascunho) => Rascunho) => {
    atualRef.current = fn(atualRef.current)
    setAtualState(atualRef.current)
  }, [])

  async function nomePublicador(publico: boolean) {
    if (!publico) return null
    if (nomeClubeRef.current === undefined) {
      const { data } = await supabase.from('profiles').select('nome_clube').eq('id', userId).single()
      nomeClubeRef.current = data?.nome_clube ?? null
    }
    return nomeClubeRef.current
  }

  async function persistir() {
    if (!sujoRef.current) return
    sujoRef.current = false

    const nota = atualRef.current
    const conteudo = nota.conteudo.trim()
    if (!conteudo) return

    setStatus('salvando')
    const campos = {
      conteudo,
      tags: extrairTags(conteudo, nota.tagsOriginais),
      publico: nota.publico,
      nome_publicador: await nomePublicador(nota.publico),
      imagem_url: nota.imagem_url,
      livro_id: nota.livro_id,
      updated_at: new Date().toISOString(),
    }

    const colunas = 'id, conteudo, tags, publico, imagem_url, livro_id, created_at, updated_at'
    const { data, error } = nota.id
      ? await supabase.from('pensamentos').update(campos).eq('id', nota.id).select(colunas).single()
      : await supabase.from('pensamentos').insert({ ...campos, user_id: userId }).select(colunas).single()

    if (error || !data) {
      sujoRef.current = true
      setStatus('erro')
      return
    }

    const salva = data as Nota
    if (!nota.id && atualRef.current.chave === nota.chave) {
      setAtual(prev => ({ ...prev, id: salva.id }))
    }
    setNotas(prev => [salva, ...prev.filter(n => n.id !== salva.id)])
    setStatus('salvo')
  }

  const salvarAgora = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    filaRef.current = filaRef.current.then(persistir).catch(() => setStatus('erro'))
    return filaRef.current
    // persistir só lê refs; não precisa entrar nas dependências
  }, [])

  function agendarSalvar() {
    sujoRef.current = true
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(salvarAgora, ESPERA_AUTOSAVE)
  }

  function editar(mudancas: Partial<Rascunho>) {
    setAtual(prev => ({ ...prev, ...mudancas }))
    agendarSalvar()
  }

  // Ao sair de uma nota: grava o que falta e descarta se ficou vazia
  async function fecharNotaAtual() {
    await salvarAgora()
    const nota = atualRef.current
    if (nota.id && !nota.conteudo.trim()) {
      await supabase.from('pensamentos').delete().eq('id', nota.id)
      setNotas(prev => prev.filter(n => n.id !== nota.id))
    }
  }

  async function abrirNota(nota: Nota | null) {
    await fecharNotaAtual()
    setAtual(() => (nota ? rascunhoDe(nota) : novoRascunho()))
    setStatus('idle')
    setErroImagem('')
    setVerLista(false)
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      if (nota) el.setSelectionRange(el.value.length, el.value.length)
    })
  }

  async function excluirNota() {
    const nota = atualRef.current
    if (nota.id && !window.confirm('Excluir esta nota?')) return
    if (timerRef.current) clearTimeout(timerRef.current)
    sujoRef.current = false
    await filaRef.current
    const id = atualRef.current.id
    if (id) {
      await supabase.from('pensamentos').delete().eq('id', id)
      setNotas(prev => prev.filter(n => n.id !== id))
    }
    setAtual(() => novoRascunho())
    setStatus('idle')
  }

  async function uploadImagem(file: File) {
    if (!file.type.startsWith('image/')) {
      setErroImagem('Apenas imagens são permitidas.')
      return
    }
    setErroImagem('')
    setEnviandoImagem(true)

    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${userId}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('fragmentos').upload(path, file)
    setEnviandoImagem(false)

    if (error) {
      setErroImagem('Erro ao enviar imagem.')
      return
    }
    const { data } = supabase.storage.from('fragmentos').getPublicUrl(path)
    editar({ imagem_url: data.publicUrl })
  }

  function handlePaste(event: React.ClipboardEvent) {
    const item = Array.from(event.clipboardData.items).find(i => i.type.startsWith('image/'))
    const file = item?.getAsFile()
    if (!file) return
    event.preventDefault()
    uploadImagem(file)
  }

  function handleDrop(event: React.DragEvent) {
    const file = Array.from(event.dataTransfer.files).find(f => f.type.startsWith('image/'))
    if (!file) return
    event.preventDefault()
    uploadImagem(file)
  }

  // Textarea cresce com o texto, como uma folha de papel
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [atual.conteudo, verLista])

  // Não perder nada ao trocar de app ou fechar a aba
  useEffect(() => {
    const flush = () => {
      if (sujoRef.current) salvarAgora()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [salvarAgora])

  const livroAtual = livros.find(l => l.id === atual.livro_id)
  const statusTexto = {
    idle: '',
    salvando: 'Salvando…',
    salvo: 'Salvo',
    erro: 'Não salvou — tentando de novo ao digitar',
  }[status]

  const listaNotas = (
    <div className="space-y-1">
      {notas.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhuma nota ainda.</p>
      ) : (
        notas.map(nota => (
          <button
            key={nota.id}
            type="button"
            onClick={() => abrirNota(nota)}
            className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
              nota.id === atual.id ? 'bg-primary/10' : 'hover:bg-secondary'
            }`}
          >
            <p className="truncate text-sm font-semibold">{titulo(nota.conteudo)}</p>
            <p className="truncate text-xs text-muted-foreground">
              <span className="mr-2 text-foreground/70">{dataCurta(nota.updated_at)}</span>
              {resumo(nota.conteudo)}
            </p>
          </button>
        ))
      )}
    </div>
  )

  return (
    <div className="lg:grid lg:grid-cols-[17rem_1fr] lg:gap-8">
      {/* Lista de notas: coluna fixa no desktop, tela própria no celular */}
      <aside className={`${verLista ? 'block' : 'hidden'} lg:block`}>
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Notas</h1>
          <button
            type="button"
            onClick={() => abrirNota(null)}
            aria-label="Nova nota"
            className="rounded-md p-2 text-primary transition-colors hover:bg-secondary"
          >
            <SquarePen className="h-5 w-5" />
          </button>
        </div>
        <div className="lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">{listaNotas}</div>
      </aside>

      <section className={`${verLista ? 'hidden' : 'flex'} min-h-[calc(100dvh-7rem)] flex-col lg:flex lg:min-h-[calc(100vh-3rem)]`}>
        {/* Barra superior */}
        <div className="sticky top-[env(safe-area-inset-top)] z-10 -mx-4 flex items-center gap-1 bg-background/95 px-2 py-1 backdrop-blur sm:-mx-6 sm:px-4 lg:mx-0 lg:px-0">
          <button
            type="button"
            onClick={async () => {
              await salvarAgora()
              setVerLista(true)
            }}
            className="flex items-center gap-0.5 rounded-md py-2 pr-2 text-primary lg:hidden"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="text-[15px]">Notas</span>
          </button>

          <span className="ml-1 truncate text-xs text-muted-foreground">{statusTexto}</span>

          <div className="ml-auto flex items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={event => {
                const file = event.target.files?.[0]
                if (file) uploadImagem(file)
                event.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={enviandoImagem}
              aria-label="Adicionar foto"
              className="rounded-md p-2 text-primary transition-colors hover:bg-secondary disabled:opacity-50"
            >
              <ImagePlus className="h-5 w-5" />
            </button>

            <label
              className={`relative rounded-md p-2 transition-colors hover:bg-secondary ${livroAtual ? 'text-primary' : 'text-primary/70'}`}
              title="Livro relacionado"
            >
              <BookOpen className="h-5 w-5" />
              <select
                value={atual.livro_id ?? ''}
                onChange={event => editar({ livro_id: event.target.value || null })}
                aria-label="Livro relacionado"
                className="absolute inset-0 cursor-pointer opacity-0"
              >
                <option value="">Nenhum livro</option>
                {livros.map(livro => (
                  <option key={livro.id} value={livro.id}>{livro.titulo}</option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => editar({ publico: !atual.publico })}
              aria-pressed={atual.publico}
              title={atual.publico ? 'Publicado no Clube — toque para tornar privado' : 'Publicar no Clube'}
              className={`rounded-md p-2 transition-colors hover:bg-secondary ${atual.publico ? 'text-primary' : 'text-muted-foreground'}`}
            >
              <Globe className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={excluirNota}
              aria-label="Excluir nota"
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
            >
              <Trash2 className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => abrirNota(null)}
              aria-label="Nova nota"
              className="rounded-md p-2 text-primary transition-colors hover:bg-secondary"
            >
              <SquarePen className="h-5 w-5" />
            </button>

            {focado && (
              <button
                type="button"
                onMouseDown={event => event.preventDefault()}
                onClick={() => {
                  textareaRef.current?.blur()
                  salvarAgora()
                }}
                className="ml-1 rounded-md px-2 py-2 text-[15px] font-semibold text-primary"
              >
                OK
              </button>
            )}
          </div>
        </div>

        {/* Folha */}
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col pt-2">
          <p className="mb-3 text-center text-xs text-muted-foreground">
            {dataLonga(atual.created_at)}
            {atual.publico && ' · No Clube'}
          </p>

          {livroAtual && (
            <p className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
              <BookOpen className="h-3 w-3" /> {livroAtual.titulo}
            </p>
          )}

          <textarea
            ref={textareaRef}
            value={atual.conteudo}
            onChange={event => editar({ conteudo: event.target.value })}
            onFocus={() => setFocado(true)}
            onBlur={() => {
              setFocado(false)
              salvarAgora()
            }}
            onPaste={handlePaste}
            onDrop={handleDrop}
            onDragOver={event => event.preventDefault()}
            placeholder="Escreva um pensamento…"
            autoFocus
            autoCapitalize="sentences"
            spellCheck
            rows={8}
            className="w-full flex-none resize-none overflow-hidden bg-transparent text-[17px] leading-7 placeholder:text-muted-foreground/60 focus:outline-none"
          />

          {enviandoImagem && <p className="text-xs text-muted-foreground">Enviando foto…</p>}
          {erroImagem && <p className="text-xs text-destructive">{erroImagem}</p>}

          {atual.imagem_url && (
            <div className="relative mt-2 w-fit">
              <Image
                src={atual.imagem_url}
                alt=""
                width={480}
                height={320}
                className="max-h-72 w-auto rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() => editar({ imagem_url: null })}
                aria-label="Remover foto"
                className="absolute -right-2 -top-2 rounded-full bg-background p-1 text-muted-foreground shadow ring-1 ring-border hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Área clicável abaixo do texto devolve o foco, como tocar no papel em branco */}
          <div className="min-h-24 flex-1 cursor-text" onClick={() => textareaRef.current?.focus()} />
        </div>
      </section>
    </div>
  )
}
