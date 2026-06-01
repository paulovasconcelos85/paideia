import { createClient } from '@/lib/supabase/server'
import ClubeClient from './clube-client'

export default async function ClubePage() {
  const supabase = await createClient()

  const [{ data: pensamentos }, { data: citacoes }, { data: prosas }] = await Promise.all([
    supabase
      .from('pensamentos')
      .select('id, conteudo, tags, created_at, nome_publicador, livros(titulo, autor)')
      .eq('publico', true)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('citacoes')
      .select('id, texto, pagina, created_at, nome_publicador, livros(titulo, autor)')
      .eq('publico', true)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('prosas')
      .select('id, titulo, frase, conteudo, created_at, nome_publicador')
      .eq('publico', true)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  return (
    <ClubeClient
      pensamentos={pensamentos ?? []}
      citacoes={citacoes ?? []}
      prosas={prosas ?? []}
    />
  )
}
