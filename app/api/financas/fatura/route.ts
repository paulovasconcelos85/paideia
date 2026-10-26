import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { obterFamilia } from '@/lib/familia'
import { carregarAiConfig, gerarTexto, gerarTextoComArquivo } from '@/lib/ai'
import { CATEGORIAS_DESPESA, type Despesa, type Lancamento } from '@/lib/financas'

export const maxDuration = 60

const LIMITE_BYTES = 4 * 1024 * 1024 // limite de corpo das funções da Vercel
const MIMES_ARQUIVO = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']

const SYSTEM_PROMPT = `Você extrai lançamentos de faturas de cartão de crédito brasileiras.
Responda APENAS com JSON válido, sem texto antes ou depois, neste formato:
{"itens":[{"data":"2026-10-03","descricao":"Supermercado X","valor":123.45,"parcela_atual":null,"parcelas_total":null,"categoria":"alimentacao"}],"observacao":"..."}

Regras:
- Um item por compra ou parcela cobrada NESTA fatura.
- "valor" em reais, número com ponto decimal. Estornos e créditos entram com valor negativo.
- IGNORE: pagamento da fatura anterior, saldo anterior, total da fatura, limites, encargos já somados no total como linha de resumo.
- Inclua juros, IOF, anuidade e encargos como itens próprios (categoria "dividas" para juros/encargos, "impostos" para IOF, "contas" para anuidade).
- Parcelas: em "LOJA 03/10" use parcela_atual 3 e parcelas_total 10; remova o "03/10" da descrição.
- "data" no formato AAAA-MM-DD. Se a fatura só mostra dia/mês, deduza o ano pelo período da fatura.
- "descricao": nome legível do estabelecimento, sem códigos.
- "categoria": a chave que melhor descreve a compra, entre estas (chave: o que entra):
${Object.entries(CATEGORIAS_DESPESA).map(([k, v]) => `  ${k}: ${v.descricao}`).join('\n')}
- "observacao": uma frase curta se algo ficou ilegível ou incerto; senão string vazia.`

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

interface ItemExtraido {
  data: string | null
  descricao: string
  valor: number
  parcela_atual: number | null
  parcelas_total: number | null
  categoria: string
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const aiConfig = await carregarAiConfig(supabase, user.id)
  if ('error' in aiConfig) return NextResponse.json({ error: aiConfig.error }, { status: 400 })

  const familiaId = await obterFamilia(supabase)
  const form = await request.formData()
  const arquivo = form.get('arquivo')
  const cartaoId = String(form.get('cartao_id') ?? '') || null
  const competencia = String(form.get('competencia') ?? '')

  if (!(arquivo instanceof File)) return NextResponse.json({ error: 'Envie a foto, o PDF ou o CSV da fatura.' }, { status: 400 })
  if (arquivo.size > LIMITE_BYTES) return NextResponse.json({ error: 'Arquivo grande demais (máximo 4 MB).' }, { status: 400 })

  const mensagem = `Fatura do mês de referência ${competencia || 'atual'}. Extraia todos os lançamentos.`
  let bruto: string
  try {
    if (MIMES_ARQUIVO.includes(arquivo.type)) {
      const base64 = Buffer.from(await arquivo.arrayBuffer()).toString('base64')
      bruto = await gerarTextoComArquivo(aiConfig, SYSTEM_PROMPT, mensagem, { nome: arquivo.name, mime: arquivo.type, base64 })
    } else {
      // CSV, OFX, TXT: vai como texto
      const texto = (await arquivo.text()).slice(0, 60000)
      bruto = await gerarTexto(aiConfig, SYSTEM_PROMPT, `${mensagem}\n\nConteúdo do arquivo:\n${texto}`, 8000)
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  let extraidos: ItemExtraido[] = []
  let observacao = ''
  try {
    const json = JSON.parse(bruto.slice(bruto.indexOf('{'), bruto.lastIndexOf('}') + 1))
    extraidos = Array.isArray(json.itens) ? json.itens : []
    observacao = typeof json.observacao === 'string' ? json.observacao : ''
  } catch {
    return NextResponse.json({ error: 'Não consegui ler essa fatura. Tente uma foto mais nítida ou o PDF.' }, { status: 422 })
  }

  // Marca o que já foi lançado (evita duplicar ao importar duas vezes) e as parcelas já acompanhadas
  const [{ data: existentes }, { data: parceladas }] = await Promise.all([
    supabase.from('fin_lancamentos').select('descricao, valor').eq('familia_id', familiaId).eq('competencia', competencia),
    supabase.from('fin_despesas').select('id, descricao, cartao_id').eq('familia_id', familiaId).eq('frequencia', 'parcelada'),
  ])
  const jaLancados = new Set((existentes as Pick<Lancamento, 'descricao' | 'valor'>[] ?? []).map(l => `${normalizar(l.descricao)}|${Number(l.valor).toFixed(2)}`))
  const acompanhadas = new Map(
    (parceladas as Pick<Despesa, 'id' | 'descricao' | 'cartao_id'>[] ?? [])
      .filter(d => !cartaoId || d.cartao_id === cartaoId)
      .map(d => [normalizar(d.descricao), d.id])
  )

  const itens = extraidos
    .filter(i => i && typeof i.descricao === 'string' && Number.isFinite(Number(i.valor)) && Number(i.valor) !== 0)
    .map(i => {
      const valor = Math.round(Number(i.valor) * 100) / 100
      const parcelasTotal = Number(i.parcelas_total) > 1 ? Number(i.parcelas_total) : null
      return {
        data: /^\d{4}-\d{2}-\d{2}$/.test(i.data ?? '') ? i.data : null,
        descricao: i.descricao.trim().slice(0, 120),
        valor,
        categoria: CATEGORIAS_DESPESA[i.categoria] ? i.categoria : 'outros',
        parcela_atual: parcelasTotal ? Number(i.parcela_atual) || 1 : null,
        parcelas_total: parcelasTotal,
        duplicado: jaLancados.has(`${normalizar(i.descricao)}|${valor.toFixed(2)}`),
        despesa_id: parcelasTotal ? acompanhadas.get(normalizar(i.descricao)) ?? null : null, // parcela já acompanhada no orçamento
      }
    })

  return NextResponse.json({ itens, observacao })
}
