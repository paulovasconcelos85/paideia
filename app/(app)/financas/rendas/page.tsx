import { createClient } from '@/lib/supabase/server'
import type { Renda } from '@/lib/financas'
import RendasClient from './rendas-client'

export default async function RendasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: rendas } = await supabase
    .from('fin_rendas')
    .select('*')
    .eq('user_id', user!.id)
    .order('valor', { ascending: false })

  return <RendasClient userId={user!.id} rendas={(rendas ?? []) as Renda[]} />
}
