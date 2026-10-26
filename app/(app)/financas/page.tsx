import { createClient } from '@/lib/supabase/server'
import { obterFamilia } from '@/lib/familia'
import { carregarRetrato } from '@/lib/retrato'
import InicioClient from './inicio-client'

export default async function FinancasInicioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const familiaId = await obterFamilia(supabase)
  const retrato = await carregarRetrato(supabase, familiaId)

  return <InicioClient familiaId={familiaId} userId={user!.id} retrato={retrato} />
}
