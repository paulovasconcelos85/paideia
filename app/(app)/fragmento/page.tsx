import { createClient, getUser } from '@/lib/supabase/server'
import FragmentoClient from './fragmento-client'

export default async function FragmentoPage() {
  const supabase = await createClient()
  const user = await getUser()

  const [{ data: notas }, { data: livros }] = await Promise.all([
    supabase
      .from('pensamentos')
      .select('id, conteudo, tags, publico, imagem_url, livro_id, created_at, updated_at')
      .eq('user_id', user!.id)
      .order('updated_at', { ascending: false })
      .limit(100),
    supabase
      .from('livros')
      .select('id, titulo')
      .eq('user_id', user!.id)
      .order('titulo'),
  ])

  return <FragmentoClient userId={user!.id} notas={notas ?? []} livros={livros ?? []} />
}
