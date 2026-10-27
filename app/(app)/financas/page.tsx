import { createClient, getUser } from '@/lib/supabase/server'
import { obterFamilia } from '@/lib/familia'
import { carregarRetrato } from '@/lib/retrato'
import InicioClient from './inicio-client'

export default async function FinancasInicioPage() {
  const supabase = await createClient()
  const [user, familiaId] = await Promise.all([getUser(), obterFamilia(supabase)])
  const retrato = await carregarRetrato(supabase, familiaId)

  return <InicioClient familiaId={familiaId} userId={user!.id} retrato={retrato} />
}
