import { createClient } from '@/lib/supabase/server'
import BibliotecaClient from './biblioteca-client'

export default async function BibliotecaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: livros }, { data: eixos }] = await Promise.all([
    supabase
      .from('livros')
      .select('*, eixos(*)')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false }),
    supabase.from('eixos').select('*').order('id'),
  ])

  return <BibliotecaClient livros={livros ?? []} eixos={eixos ?? []} />
}
