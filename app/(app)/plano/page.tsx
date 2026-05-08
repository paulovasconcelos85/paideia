import { createClient } from '@/lib/supabase/server'
import PlanoClient from './plano-client'

export default async function PlanoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: planos } = await supabase
    .from('planos_mensais')
    .select(`
      *,
      plano_livros (
        id,
        papel,
        ordem,
        observacoes,
        livros (
          id,
          titulo,
          autor,
          status,
          nota,
          eixos ( nome, cor )
        )
      )
    `)
    .eq('user_id', user!.id)
    .order('numero_mes')

  return <PlanoClient planos={planos ?? []} />
}
