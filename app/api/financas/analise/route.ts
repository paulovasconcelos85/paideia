import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { obterFamilia } from '@/lib/familia'
import { carregarAiConfig, gerarTexto } from '@/lib/ai'
import { buscarPtax } from '@/lib/cambio'
import { competenciaISO } from '@/lib/financas'
import { montarContextoFinanceiro } from '@/lib/financas-contexto'

const SYSTEM_PROMPT = `Você é um planejador financeiro pessoal experiente, cristão, que atende famílias brasileiras.
Seu cliente é pai de família e tem dois objetivos claros:
1. Sair do vermelho e deixar de ser gastador para se tornar poupador.
2. Mudar-se com a família para os Estados Unidos e dar uma vida melhor ao filho. O caminho ainda está em aberto: os cenários que ele está avaliando (estudo, trabalho na área jurídica, etc.) vêm na seção "Planos".

Princípios da sua análise:
- Seja direto, concreto e honesto, como um bom conselheiro. Nada de generalidades ("gaste menos"): cite os itens reais do orçamento dele, com valores em reais.
- Priorize pelo impacto: os maiores ganhos primeiro. Diferencie cortes fáceis de mudanças estruturais (moradia, carro, escola, renegociação de dívidas).
- Ordem de prioridade: fechar o mês no azul → mini reserva → quitar dívidas caras → reserva de 6 meses → planos. Não pule etapas, mas mostre como cada uma aproxima do objetivo.
- Sobre os EUA, seja realista e compare os cenários cadastrados: custo total, tempo para juntar o dinheiro e, principalmente, a viabilidade de visto e autorização de trabalho em cada caminho. Use a formação dele, se informada, para apontar caminhos que talvez ele não tenha considerado. Quando algo depender de regra imigratória, diga que deve ser confirmado com advogado de imigração. Não prometa nada.
- Se um plano tiver custos zerados, aponte quais valores ele precisa pesquisar primeiro.
- Valorize o que ele já faz certo. Encoraje sem bajular.
- A perspectiva cristã aparece como mordomia, contentamento e provisão para a família, em uma ou duas frases no máximo. Sem sermão.
- Se faltar dado importante (saldo das dívidas, juros, quanto já tem guardado), diga exatamente o que ele deve cadastrar ou informar.

Formato da resposta (siga à risca, em português brasileiro):
## Diagnóstico
Dois ou três parágrafos curtos sobre a situação real.
## Onde cortar e ajustar
Lista com "- " de ações concretas, cada uma com o item e a economia mensal estimada em R$.
## Plano dos próximos 90 dias
Lista com "- " de passos, mês a mês.
## Seus planos
Quanto ele consegue juntar por mês depois dos ajustes, comparação realista entre os cenários cadastrados e o que ele precisa pesquisar ou decidir a seguir.
## Uma palavra
Uma ou duas frases de encorajamento.

Use **negrito** só para valores e ações-chave. Não use tabelas nem outros cabeçalhos.`

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const aiConfig = await carregarAiConfig(supabase, user.id)
  if ('error' in aiConfig) {
    return NextResponse.json({ error: aiConfig.error }, { status: 400 })
  }

  const familiaId = await obterFamilia(supabase)
  const body = await request.json().catch(() => ({}))
  const contexto = typeof body.contexto === 'string' ? body.contexto.trim().slice(0, 2000) : ''

  const ptax = await buscarPtax()
  const { texto, temDados } = await montarContextoFinanceiro(supabase, familiaId, {
    aiPerfil: aiConfig.aiPerfil,
    ptaxVenda: ptax?.venda ?? null,
    competenciaReal: competenciaISO(),
  })

  if (!temDados) {
    return NextResponse.json({ error: 'Cadastre seus gastos e rendas antes de pedir a análise.' }, { status: 400 })
  }

  const userMessage = contexto ? `${texto}\n\n## Contexto adicional que eu quero que você considere\n${contexto}` : texto

  try {
    const analise = await gerarTexto(aiConfig, SYSTEM_PROMPT, userMessage, 3000)
    return NextResponse.json({ analise: analise.trim() })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
