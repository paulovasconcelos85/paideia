import type { SupabaseClient } from '@supabase/supabase-js'
import { gerarTexto, type AiConfig } from './ai'
import { competenciaISO, formatBRL, nomeMes, type Fechamento } from './financas'
import { montarContextoFinanceiro } from './financas-contexto'

const SYSTEM_PROMPT = `Você é o conselheiro financeiro de uma família cristã brasileira que quer sair do vermelho, tornar-se poupadora e um dia se mudar para os Estados Unidos.
Todo início de mês você escreve a eles uma carta curta sobre o mês que terminou.

Como escrever:
- Dirija-se à família ("Vocês"), em tom caloroso, honesto e direto, como um amigo sábio. Português brasileiro.
- No máximo 220 palavras, em 3 ou 4 parágrafos curtos. Sem títulos, listas ou tabelas.
- 1º parágrafo: o que aconteceu no mês, com 2 ou 3 números concretos (gasto real × combinado, categoria que mais pesou, variação do patrimônio).
- 2º: uma coisa que fizeram bem, de verdade, se houver.
- 3º: UM foco claro para o mês que começa, com valor em reais. Só um.
- Feche com uma frase sobre mordomia, contentamento ou provisão, sem sermão. Pode citar um versículo curto, se couber naturalmente.
- Se faltarem lançamentos do mês, diga com gentileza que a carta fica melhor quando tudo é lançado.
- Não invente números: use só os dados fornecidos.`

/** Escreve e grava a carta do mês atual, falando do mês anterior. */
export async function gerarCarta(supabase: SupabaseClient, familiaId: string, aiConfig: AiConfig, ptaxVenda: number | null) {
  const hoje = new Date()
  const mesAtual = competenciaISO(hoje)
  const mesAnterior = competenciaISO(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1))

  const [{ texto, temDados }, { data: fechamentos }] = await Promise.all([
    montarContextoFinanceiro(supabase, familiaId, { aiPerfil: aiConfig.aiPerfil, ptaxVenda, competenciaReal: mesAnterior }),
    supabase.from('fin_fechamentos').select('mes, ativos, dividas').eq('familia_id', familiaId)
      .order('mes', { ascending: false }).limit(3),
  ])
  if (!temDados) return null

  // Variação do patrimônio entre os dois últimos retratos mensais
  const [ultimo, penultimo] = (fechamentos ?? []) as Fechamento[]
  const variacao = ultimo && penultimo
    ? `\n\n## Variação do patrimônio líquido\nDe ${formatBRL(Number(penultimo.ativos) - Number(penultimo.dividas))} para ${formatBRL(Number(ultimo.ativos) - Number(ultimo.dividas))}.`
    : ''

  const mensagem = `Escreva a carta de ${nomeMes(mesAtual).toLowerCase()}, sobre ${nomeMes(mesAnterior).toLowerCase()}.\n\n${texto}${variacao}`
  const carta = (await gerarTexto(aiConfig, SYSTEM_PROMPT, mensagem, 1200)).trim()
  if (!carta) return null

  await supabase.from('fin_cartas').upsert({ familia_id: familiaId, mes: mesAtual, texto: carta })
  return carta
}
