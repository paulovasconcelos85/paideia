import { createClient } from '@/lib/supabase/server'
import type { Despesa, Plano, Renda } from '@/lib/financas'
import { diagnosticar } from '@/lib/financas-diagnostico'
import PlanosClient from './planos-client'

export default async function PlanosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: planos }, { data: despesas }, { data: rendas }] = await Promise.all([
    supabase.from('fin_planos').select('*').eq('user_id', user!.id)
      .order('prioridade', { ascending: false }).order('created_at'),
    supabase.from('fin_despesas').select('*').eq('user_id', user!.id),
    supabase.from('fin_rendas').select('*').eq('user_id', user!.id),
  ])

  const { saldo } = diagnosticar((despesas ?? []) as Despesa[], (rendas ?? []) as Renda[])

  return <PlanosClient userId={user!.id} planos={(planos ?? []) as Plano[]} saldoMensal={saldo} />
}
