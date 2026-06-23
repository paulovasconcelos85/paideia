import { createClient } from '@/lib/supabase/server'
import ClubeClient, { type PostFeed } from './clube-client'

export default async function ClubePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: pensamentos }, { data: citacoes }, { data: prosas }] = await Promise.all([
    supabase
      .from('pensamentos')
      .select('id, user_id, conteudo, tags, created_at, nome_publicador, livros(titulo, autor)')
      .eq('publico', true)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('citacoes')
      .select('id, user_id, texto, pagina, created_at, nome_publicador, livros(titulo, autor)')
      .eq('publico', true)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('prosas')
      .select('id, user_id, titulo, frase, conteudo, created_at, nome_publicador')
      .eq('publico', true)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  // Mapeia user_id → índice de cor (0-5), determinístico, sem expor o ID
  const todosIds = [...new Set([
    ...(pensamentos ?? []).map(p => p.user_id),
    ...(citacoes ?? []).map(c => c.user_id),
    ...(prosas ?? []).map(p => p.user_id),
  ].filter(Boolean))]
  const corMap = new Map(todosIds.map((id, i) => [id, i % 6]))

  // Busca reações de todos os posts em uma única query
  const allIds = [
    ...(pensamentos ?? []).map(p => p.id),
    ...(citacoes ?? []).map(c => c.id),
    ...(prosas ?? []).map(p => p.id),
  ]

  type ReacaoRow = { post_tipo: string; post_id: string; emoji: string; user_id: string }
  const reacaoMap = new Map<string, ReacaoRow[]>()

  if (allIds.length) {
    const { data: reacoesData } = await supabase
      .from('clube_reacoes')
      .select('post_tipo, post_id, emoji, user_id')
      .in('post_id', allIds)

    for (const r of reacoesData ?? []) {
      const key = `${r.post_tipo}-${r.post_id}`
      if (!reacaoMap.has(key)) reacaoMap.set(key, [])
      reacaoMap.get(key)!.push(r)
    }
  }

  function buildReacoes(tipo: string, id: string): PostFeed['reacoes'] {
    const rows = reacaoMap.get(`${tipo}-${id}`) ?? []
    const counts: Record<string, number> = {}
    const minhas = new Set<string>()
    for (const r of rows) {
      counts[r.emoji] = (counts[r.emoji] ?? 0) + 1
      if (r.user_id === user?.id) minhas.add(r.emoji)
    }
    return Object.entries(counts).map(([emoji, count]) => ({ emoji, count, minha: minhas.has(emoji) }))
  }

  function mapear<T extends { id: string; user_id: string; created_at: string; nome_publicador: string | null }>(
    items: T[],
    tipo: PostFeed['tipo'],
    extra: (item: T) => Partial<PostFeed>
  ): PostFeed[] {
    return items.map(item => ({
      id: item.id,
      tipo,
      conteudo: '',
      frase: null,
      titulo: undefined,
      tags: null,
      pagina: null,
      livro: null,
      nome_publicador: item.nome_publicador,
      created_at: item.created_at,
      isMine: item.user_id === user?.id,
      colorIndex: corMap.get(item.user_id) ?? 0,
      reacoes: buildReacoes(tipo, item.id),
      ...extra(item),
    }))
  }

  type PensamentoRow = { id: string; user_id: string; conteudo: string; tags: string[] | null; created_at: string; nome_publicador: string | null; livros: { titulo: string; autor: string | null } | { titulo: string; autor: string | null }[] | null }
  type CitacaoRow = { id: string; user_id: string; texto: string; pagina: number | null; created_at: string; nome_publicador: string | null; livros: { titulo: string; autor: string | null } | { titulo: string; autor: string | null }[] | null }
  type ProosaRow = { id: string; user_id: string; titulo: string; frase: string | null; conteudo: string; created_at: string; nome_publicador: string | null }

  const feed: PostFeed[] = [
    ...mapear(pensamentos as PensamentoRow[] ?? [], 'pensamento', item => ({
      conteudo: item.conteudo,
      tags: Array.isArray(item.tags) ? item.tags : null,
      livro: Array.isArray(item.livros) ? item.livros[0] ?? null : item.livros,
    })),
    ...mapear(citacoes as CitacaoRow[] ?? [], 'citacao', item => ({
      conteudo: item.texto,
      pagina: item.pagina,
      livro: Array.isArray(item.livros) ? item.livros[0] ?? null : item.livros,
    })),
    ...mapear(prosas as ProosaRow[] ?? [], 'prosa', item => ({
      conteudo: item.conteudo,
      frase: item.frase,
      titulo: item.titulo,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return <ClubeClient feed={feed} />
}
