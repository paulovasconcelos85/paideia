import { createClient } from '@/lib/supabase/server'
import type { Despesa } from '@/lib/financas'
import GastosClient from './gastos-client'

export default async function GastosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: despesas } = await supabase
    .from('fin_despesas')
    .select('*')
    .eq('user_id', user!.id)
    .order('valor', { ascending: false })

  return <GastosClient userId={user!.id} despesas={(despesas ?? []) as Despesa[]} />
}
