import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { carregarAiConfig, gerarTexto } from '@/lib/ai'
import {
  CATEGORIAS_DESPESA, FREQUENCIA_DESPESA_LABEL, FREQUENCIA_RENDA_LABEL, MESES, STATUS_PLANO, TIPOS_RENDA,
  despesaMensal, formatBRL, formatMesAno, formatMoeda, projetarPlano,
  type Despesa, type Plano, type Renda,
} from '@/lib/financas'
import { diagnosticar } from '@/lib/financas-diagnostico'

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

  const body = await request.json().catch(() => ({}))
  const contexto = typeof body.contexto === 'string' ? body.contexto.trim().slice(0, 2000) : ''

  const [{ data: despesasData }, { data: rendasData }, { data: planosData }] = await Promise.all([
    supabase.from('fin_despesas').select('*').eq('user_id', user.id).eq('ativo', true),
    supabase.from('fin_rendas').select('*').eq('user_id', user.id).eq('ativo', true),
    supabase.from('fin_planos').select('*').eq('user_id', user.id).neq('status', 'concluido'),
  ])
  const despesas = (despesasData ?? []) as Despesa[]
  const rendas = (rendasData ?? []) as Renda[]
  const planos = (planosData ?? []) as Plano[]

  if (despesas.length === 0 && rendas.length === 0) {
    return NextResponse.json({ error: 'Cadastre seus gastos e rendas antes de pedir a análise.' }, { status: 400 })
  }

  const d = diagnosticar(despesas, rendas)

  const linhasRenda = rendas.map(r =>
    `- ${r.descricao} (${TIPOS_RENDA[r.tipo].label}, ${FREQUENCIA_RENDA_LABEL[r.frequencia].toLowerCase()}` +
    `${r.mes_recebimento ? `, em ${MESES[r.mes_recebimento - 1].toLowerCase()}` : ''}): ${formatBRL(r.valor)}`
  )
  const linhasDespesa = despesas.map(x =>
    `- [${CATEGORIAS_DESPESA[x.categoria]?.label ?? x.categoria}] ${x.descricao}: ${formatBRL(x.valor)} ` +
    `(${FREQUENCIA_DESPESA_LABEL[x.frequencia].toLowerCase()}` +
    `${x.frequencia === 'parcelada' && x.parcelas_restantes !== null ? `, ${x.parcelas_restantes} parcelas restantes` : ''}` +
    `${x.frequencia === 'anual' ? `, ${formatBRL(despesaMensal(x))}/mês diluído` : ''}` +
    `, ${x.essencial ? 'essencial' : 'não essencial'})` +
    `${x.observacoes ? `. Obs.: ${x.observacoes}` : ''}`
  )

  const blocosPlanos = planos.map(p => {
    const pr = projetarPlano(p)
    const custos = p.itens.map(i => `  - ${i.descricao}: ${i.valor ? formatMoeda(i.valor, p.moeda) : 'valor ainda não pesquisado'}`)
    const etapas = p.etapas.map(e => `  - [${e.feito ? 'x' : ' '}] ${e.texto}`)
    return [
      `### ${p.titulo} (${STATUS_PLANO[p.status].label.toLowerCase()})`,
      p.descricao ?? '',
      `Meta: ${formatMoeda(pr.meta, p.moeda)}${p.moeda === 'USD' && p.cotacao ? ` (≈ ${formatBRL(pr.metaBRL)} a R$ ${p.cotacao}/US$)` : ''}. ` +
        `Guardado: ${formatMoeda(Number(p.valor_guardado), p.moeda)}. Aporte: ${formatBRL(Number(p.aporte_mensal))}/mês.` +
        `${p.data_alvo ? ` Data desejada: ${formatMesAno(new Date(`${p.data_alvo}T12:00:00`))}.` : ''}` +
        `${pr.dataPrevista && pr.metaBRL > 0 ? ` Previsão no ritmo atual: ${formatMesAno(pr.dataPrevista)}.` : ''}`,
      custos.length ? `Custos:\n${custos.join('\n')}` : '',
      etapas.length ? `Etapas:\n${etapas.join('\n')}` : '',
    ].filter(Boolean).join('\n')
  })

  const userMessage = [
    aiConfig.aiPerfil?.trim() ? `## Quem sou\n${aiConfig.aiPerfil.trim()}` : '',
    `## Resumo mensal (anuais diluídos por 12; rendas eventuais fora)
- Renda líquida média: ${formatBRL(d.renda)}
- Gastos: ${formatBRL(d.despesa)} (essenciais ${formatBRL(d.essenciais)}, não essenciais ${formatBRL(d.naoEssenciais)})
- Dívidas e parcelas: ${formatBRL(d.dividas)}
- Saldo: ${formatBRL(d.saldo)}
- Taxa de poupança: ${d.taxaPoupanca === null ? 'indefinida' : `${d.taxaPoupanca.toFixed(1)}%`}
- Meta de reserva de emergência (6x essenciais): ${formatBRL(d.reservaMeta)}`,
    `## Rendas\n${linhasRenda.join('\n') || '- nenhuma cadastrada'}`,
    `## Gastos\n${linhasDespesa.join('\n') || '- nenhum cadastrado'}`,
    `## Planos\n${blocosPlanos.join('\n\n') || 'Nenhum plano cadastrado ainda.'}`,
    `## Alertas do diagnóstico automático\n${d.alertas.map(a => `- ${a.titulo}: ${a.texto}`).join('\n')}`,
    contexto ? `## Contexto adicional que eu quero que você considere\n${contexto}` : '',
  ].filter(Boolean).join('\n\n')

  try {
    const analise = await gerarTexto(aiConfig, SYSTEM_PROMPT, userMessage, 3000)
    return NextResponse.json({ analise: analise.trim() })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
