import { createClient, getUser } from '@/lib/supabase/server'
import { obterFamilia } from '@/lib/familia'
import FamiliaClient, { type Membro } from './familia-client'

export default async function FamiliaPage() {
  const supabase = await createClient()
  const [user, familiaId] = await Promise.all([getUser(), obterFamilia(supabase)])

  const [{ data: familia }, { data: membros }] = await Promise.all([
    supabase.from('fin_familias').select('nome').eq('id', familiaId).single(),
    supabase.rpc('fin_membros_familia'),
  ])

  return (
    <FamiliaClient
      familiaId={familiaId}
      userId={user!.id}
      nome={familia?.nome ?? 'Nossa família'}
      membros={(membros ?? []) as Membro[]}
    />
  )
}
