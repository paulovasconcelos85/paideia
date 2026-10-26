import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { carregarAiConfig, gerarTexto } from '@/lib/ai'

function buildSystemPrompt(aiPerfil: string | null, aiInstrucoes: string | null): string {
  const parts: string[] = []

  parts.push('Você é um assistente literário personalizado.')

  if (aiPerfil?.trim()) {
    parts.push(
      `O leitor para quem você escreve tem o seguinte perfil: ${aiPerfil.trim()}.\n` +
      `Ao gerar o texto, respeite esse perfil: os valores, a perspectiva e o vocabulário devem refletir quem é esse leitor.`
    )
  }

  parts.push(
    `Sua tarefa é pegar fragmentos de pensamentos, citações, observações de leitura e reflexões e transformá-los em dois elementos: uma frase de efeito e um texto de reflexão.

Siga EXATAMENTE este formato na resposta, sem texto fora das tags:

<frase>Uma única frase memorável e profunda que capture a essência do texto. Máximo 20 palavras. Deve poder ser lida sozinha, como uma sentença para meditar.</frase>

<texto>O texto completo em prosa corrida, na primeira pessoa, no estilo de um caderno intelectual devocional. Sem listas, sem tópicos, sem cabeçalhos. Conecte as ideias naturalmente. Entre 400 e 600 palavras, terminando sempre com uma frase fechada — nunca no meio de uma ideia. Português brasileiro culto, tom reflexivo e sério.</texto>`
  )

  if (aiInstrucoes?.trim()) {
    parts.push(`Instruções adicionais do leitor:\n${aiInstrucoes.trim()}`)
  }

  return parts.join('\n\n')
}

function parseObsEntries(obs: string | null): string[] {
  if (!obs) return []
  try {
    const parsed = JSON.parse(obs)
    if (Array.isArray(parsed)) return parsed.filter(Boolean)
  } catch {
    // plain text
  }
  return obs.trim() ? [obs] : []
}

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
  const dataInicio: string | undefined = body.dataInicio
  const dataFim: string | undefined = body.dataFim

  let qPensamentos = supabase
    .from('pensamentos')
    .select('conteudo, created_at, livros(titulo)')
    .eq('user_id', user.id)
    .order('created_at')
  if (dataInicio) qPensamentos = qPensamentos.gte('created_at', dataInicio)
  if (dataFim) qPensamentos = qPensamentos.lte('created_at', dataFim)

  let qCitacoes = supabase
    .from('citacoes')
    .select('texto, pagina, livros(titulo, autor)')
    .eq('user_id', user.id)
    .order('created_at')
  if (dataInicio) qCitacoes = qCitacoes.gte('created_at', dataInicio)
  if (dataFim) qCitacoes = qCitacoes.lte('created_at', dataFim)

  let qLivros = supabase
    .from('livros')
    .select('titulo, autor, observacoes, status')
    .eq('user_id', user.id)
    .not('observacoes', 'is', null)
  if (dataInicio) qLivros = qLivros.gte('updated_at', dataInicio)
  if (dataFim) qLivros = qLivros.lte('updated_at', dataFim)

  let qPlanos = supabase
    .from('planos_mensais')
    .select('titulo, observacoes, numero_mes')
    .eq('user_id', user.id)
    .not('observacoes', 'is', null)
  if (dataInicio) qPlanos = qPlanos.gte('updated_at', dataInicio)
  if (dataFim) qPlanos = qPlanos.lte('updated_at', dataFim)

  const [
    { data: pensamentos },
    { data: citacoes },
    { data: livrosObs },
    { data: planosObs },
  ] = await Promise.all([qPensamentos, qCitacoes, qLivros, qPlanos])

  const fragmentos: string[] = []

  if (pensamentos?.length) {
    fragmentos.push(
      '## Pensamentos e reflexões\n' +
        pensamentos
          .map(pensamento => {
            const livro = Array.isArray(pensamento.livros) ? pensamento.livros[0] : pensamento.livros
            return `- ${pensamento.conteudo}${livro?.titulo ? ` [${livro.titulo}]` : ''}`
          })
          .join('\n')
    )
  }

  if (citacoes?.length) {
    fragmentos.push(
      '## Citações de livros\n' +
        citacoes
          .map(citacao => {
            const livro = Array.isArray(citacao.livros) ? citacao.livros[0] : citacao.livros
            return `- "${citacao.texto}" — ${livro?.titulo ?? 'sem livro'}${
              citacao.pagina ? `, p.${citacao.pagina}` : ''
            }`
          })
          .join('\n')
    )
  }

  const livrosComObs = livrosObs?.filter(livro => livro.observacoes?.trim()) ?? []

  if (livrosComObs.length) {
    fragmentos.push(
      '## Observações sobre livros\n' +
        livrosComObs
          .map(livro => `- [${livro.titulo}${livro.autor ? ` — ${livro.autor}` : ''}]: ${livro.observacoes}`)
          .join('\n')
    )
  }

  if (planosObs?.length) {
    const linhas = planosObs.flatMap(plano => {
      const entries = parseObsEntries(plano.observacoes)
      return entries.map(entry => `- [${plano.titulo}]: ${entry}`)
    })
    if (linhas.length) {
      fragmentos.push('## Anotações mensais\n' + linhas.join('\n'))
    }
  }

  if (!fragmentos.length) {
    return NextResponse.json({ error: 'Nenhuma anotação encontrada ainda.' }, { status: 400 })
  }

  const systemPrompt = buildSystemPrompt(aiConfig.aiPerfil, aiConfig.aiInstrucoes)
  const userMessage = `Aqui estão meus fragmentos de leitura e pensamento. Transforme-os em um texto corrido, como páginas de um caderno intelectual pessoal:\n\n${fragmentos.join('\n\n')}`

  let raw: string
  try {
    raw = await gerarTexto(aiConfig, systemPrompt, userMessage)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  const fraseMatch = raw.match(/<frase>([\s\S]*?)<\/frase>/)
  const textoMatch = raw.match(/<texto>([\s\S]*?)<\/texto>/)

  const frase = fraseMatch?.[1]?.trim() ?? ''
  const prosa = textoMatch?.[1]?.trim() ?? raw.trim()

  const titulo = `Caderno — ${new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })}`
  const fontes = {
    pensamentos: pensamentos?.length ?? 0,
    citacoes: citacoes?.length ?? 0,
    observacoes_livros: livrosComObs.length,
    observacoes_meses: planosObs?.length ?? 0,
  }

  const { data: saved, error: saveError } = await supabase
    .from('prosas')
    .insert({ user_id: user.id, titulo, conteudo: prosa, frase: frase || null, fontes })
    .select()
    .single()

  if (saveError) {
    return NextResponse.json({ error: saveError.message }, { status: 500 })
  }

  return NextResponse.json({
    prosa,
    frase,
    id: saved?.id,
    titulo: saved?.titulo ?? titulo,
    fontes: saved?.fontes ?? fontes,
    created_at: saved?.created_at,
  })
}
