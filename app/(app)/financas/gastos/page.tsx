import { createClient } from '@/lib/supabase/server'
import type { Cartao, Despesa } from '@/lib/financas'
import GastosClient from './gastos-client'

export default async function GastosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: despesas }, { data: cartoes }] = await Promise.all([
    supabase.from('fin_despesas').select('*').eq('user_id', user!.id).order('valor', { ascending: false }),
    supabase.from('fin_cartoes').select('*').eq('user_id', user!.id).order('created_at'),
  ])

  return (
    <GastosClient
      userId={user!.id}
      despesas={(despesas ?? []) as Despesa[]}
      cartoes={(cartoes ?? []) as Cartao[]}
    />
  )
}
