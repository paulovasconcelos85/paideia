import type { SupabaseClient } from '@supabase/supabase-js'
import type { Fechamento } from './financas'

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

/**
 * Grava o fechamento do mês e devolve os últimos 12 (do mais antigo ao mais recente).
 * A gravação e a leitura correm em paralelo; o mês atual é corrigido em memória com os valores recém-gravados.
 */
export async function historicoPatrimonio(supabase: SupabaseClient, familiaId: string, ativos: number, dividas: number): Promise<Fechamento[]> {
  const hoje = new Date()
  const mes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
  const [, { data }] = await Promise.all([
    registrarFechamento(supabase, familiaId, ativos, dividas),
    supabase.from('fin_fechamentos').select('mes, ativos, dividas')
      .eq('familia_id', familiaId).order('mes', { ascending: false }).limit(12),
  ])
  const anteriores = ((data ?? []) as Fechamento[]).filter(f => f.mes.slice(0, 10) !== mes)
  return [{ mes, ativos, dividas }, ...anteriores].slice(0, 12).reverse()
}
