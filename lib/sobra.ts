import type { SupabaseClient } from '@supabase/supabase-js'
import { montarContas } from './contas'
import {
  competenciaISO, rendaDoMes, somarMeses,
  type Cartao, type Despesa, type DizimoDevolvido, type FaturaPaga, type Lancamento, type Receita, type Renda,
} from './financas'

/**
 * O que sobra num mês para os planos: a renda (recebida ou prevista) menos as contas do mês,
 * sem contar os próprios aportes. É a mesma conta da tela do Mês, antes de guardar.
 */
export async function sobraDoMes(supabase: SupabaseClient, familiaId: string, competencia = competenciaISO()) {
  const anterior = somarMeses(competencia, -1)
  const [
    { data: lancamentos }, { data: faturaAnterior }, { data: cartoes }, { data: despesas }, { data: rendas },
    { data: receitas }, { data: faturasPagas }, { data: config }, { data: dizimos },
  ] = await Promise.all([
    supabase.from('fin_lancamentos').select('*').eq('familia_id', familiaId).eq('competencia', competencia),
    supabase.from('fin_lancamentos').select('*').eq('familia_id', familiaId).eq('competencia', anterior).not('cartao_id', 'is', null),
    supabase.from('fin_cartoes').select('*').eq('familia_id', familiaId),
    supabase.from('fin_despesas').select('*').eq('familia_id', familiaId),
    supabase.from('fin_rendas').select('*').eq('familia_id', familiaId),
    supabase.from('fin_receitas').select('*').eq('familia_id', familiaId).eq('competencia', competencia),
    supabase.from('fin_faturas').select('cartao_id, competencia').eq('familia_id', familiaId).in('competencia', [anterior, competencia]),
    supabase.from('fin_familias').select('dizimo_desde').eq('id', familiaId).maybeSingle(),
    supabase.from('fin_dizimos').select('competencia, valor, devolvido_em').eq('familia_id', familiaId).eq('competencia', competencia),
  ])

  const listaRendas = (rendas ?? []) as Renda[]
  const listaReceitas = (receitas ?? []) as Receita[]
  const contas = montarContas({
    mes: competencia,
    lancamentos: (lancamentos ?? []) as Lancamento[],
    atrasados: [],
    cartoes: (cartoes ?? []) as Cartao[],
    despesas: (despesas ?? []) as Despesa[],
    faturasPagas: (faturasPagas ?? []) as FaturaPaga[],
    faturaAnterior: (faturaAnterior ?? []) as Lancamento[],
    rendas: listaRendas,
    receitas: listaReceitas,
    dizimos: (dizimos ?? []) as DizimoDevolvido[],
    dizimoDesde: (config?.dizimo_desde as string | undefined) ?? null,
    verAtrasos: false,
  })
  const renda = rendaDoMes(listaRendas, competencia, listaReceitas)
  const total = contas.reduce((a, c) => a + c.valor, 0)
  return { competencia, renda, contas: total, sobra: renda - total }
}
