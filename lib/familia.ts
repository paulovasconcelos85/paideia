import type { SupabaseClient } from '@supabase/supabase-js'

/** Família do usuário logado (criada no primeiro acesso). Todos os dados financeiros pertencem a ela. */
export async function obterFamilia(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase.rpc('fin_minha_familia')
  if (error || !data) {
    throw new Error('Não foi possível carregar a família. A migração ekos_familia.sql já foi aplicada no Supabase?')
  }
  return data as string
}

/** Grava o retrato do patrimônio no mês atual. Assim o histórico se forma sozinho, sem ritual de fechamento. */
export async function registrarFechamento(supabase: SupabaseClient, familiaId: string, ativos: number, dividas: number) {
  const hoje = new Date()
  const mes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
  await supabase
    .from('fin_fechamentos')
    .upsert({ familia_id: familiaId, mes, ativos, dividas, updated_at: hoje.toISOString() })
}
