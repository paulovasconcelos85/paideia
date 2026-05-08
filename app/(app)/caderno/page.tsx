import { createClient } from '@/lib/supabase/server'
import CadernoClient from './caderno-client'

export default async function CadernoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: pensamentos },
    { data: citacoes },
    { data: prosas },
    { data: livros },
    { data: livrosObservados },
  ] = await Promise.all([
    supabase
      .from('pensamentos')
      .select('*, livros(titulo)')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('citacoes')
      .select('*, livros(titulo, autor)')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('prosas')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('livros')
      .select('id, titulo, autor')
      .eq('user_id', user!.id)
      .order('titulo'),
    supabase
      .from('livros')
      .select('id, titulo, autor, observacoes, updated_at')
      .eq('user_id', user!.id)
      .not('observacoes', 'is', null)
      .order('updated_at', { ascending: false }),
  ])

  return (
    <CadernoClient
      userId={user!.id}
      pensamentos={pensamentos ?? []}
      citacoes={citacoes ?? []}
      prosas={prosas ?? []}
      livros={livros ?? []}
      livrosObservados={livrosObservados ?? []}
    />
  )
}
