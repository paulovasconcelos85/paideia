import { createClient } from '@/lib/supabase/server'
import { obterFamilia } from '@/lib/familia'
import type { Cartao, Despesa } from '@/lib/financas'
import GastosClient from './gastos-client'

export default async function GastosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const familiaId = await obterFamilia(supabase)

  const [{ data: despesas }, { data: cartoes }] = await Promise.all([
    supabase.from('fin_despesas').select('*').eq('familia_id', familiaId).order('valor', { ascending: false }),
    supabase.from('fin_cartoes').select('*').eq('familia_id', familiaId).order('created_at'),
  ])

  return (
    <GastosClient
      userId={user!.id}
      familiaId={familiaId}
      despesas={(despesas ?? []) as Despesa[]}
      cartoes={(cartoes ?? []) as Cartao[]}
    />
  )
}
