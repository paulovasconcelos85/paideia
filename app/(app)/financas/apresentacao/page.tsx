import { createClient } from '@/lib/supabase/server'
import { obterFamilia } from '@/lib/familia'
import { carregarRetrato } from '@/lib/retrato'
import Apresentacao from './apresentacao'

export default async function ApresentacaoPage() {
  const supabase = await createClient()
  const familiaId = await obterFamilia(supabase)
  const retrato = await carregarRetrato(supabase, familiaId)
  return <Apresentacao retrato={retrato} />
}
