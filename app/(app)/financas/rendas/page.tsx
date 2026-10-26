import { createClient } from '@/lib/supabase/server'
import { obterFamilia } from '@/lib/familia'
import type { Renda } from '@/lib/financas'
import RendasClient from './rendas-client'

export default async function RendasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const familiaId = await obterFamilia(supabase)

  const { data: rendas } = await supabase
    .from('fin_rendas')
    .select('*')
    .eq('familia_id', familiaId)
    .order('valor', { ascending: false })

  return <RendasClient userId={user!.id} familiaId={familiaId} rendas={(rendas ?? []) as Renda[]} />
}
