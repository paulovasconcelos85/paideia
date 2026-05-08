import { createClient } from '@/lib/supabase/server'
import CitacoesClient from './citacoes-client'

export default async function CitacoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: citacoes }, { data: livros }] = await Promise.all([
    supabase
      .from('citacoes')
      .select('*, livros(id, titulo, autor)')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('livros')
      .select('id, titulo, autor')
      .eq('user_id', user!.id)
      .order('titulo'),
  ])

  return <CitacoesClient citacoes={citacoes ?? []} livros={livros ?? []} />
}
