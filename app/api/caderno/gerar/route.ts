import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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
    `Sua tarefa é pegar fragmentos de pensamentos, citações, observações de leitura e reflexões e transformá-los em um texto corrido, coeso e elegante, como um ensaio pessoal, na primeira pessoa, no estilo de um caderno intelectual.
O texto deve conectar as ideias naturalmente, sem listar, sem tópicos, sem cabeçalhos. Prosa contínua.
Escreva em português brasileiro culto mas não artificioso. Tom reflexivo, sério, mas não hermético.
Não invente informações além do que está nos fragmentos. Conecte, elabore, aprofunde, mas a partir do que está ali.`
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

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('anthropic_api_key, ai_perfil, ai_instrucoes')
    .eq('id', user.id)
    .single()

  const apiKey = profile?.anthropic_api_key?.trim()

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Chave da API Anthropic não configurada. Acesse Configurações para adicionar a sua.' },
      { status: 400 }
    )
  }

  const [
    { data: pensamentos },
    { data: citacoes },
    { data: livrosObs },
    { data: planosObs },
  ] = await Promise.all([
    supabase
      .from('pensamentos')
      .select('conteudo, created_at, livros(titulo)')
      .eq('user_id', user.id)
      .order('created_at'),
    supabase
      .from('citacoes')
      .select('texto, pagina, livros(titulo, autor)')
      .eq('user_id', user.id)
      .order('created_at'),
    supabase
      .from('livros')
      .select('titulo, autor, observacoes, status')
      .eq('user_id', user.id)
      .not('observacoes', 'is', null),
    supabase
      .from('planos_mensais')
      .select('titulo, observacoes, numero_mes')
      .eq('user_id', user.id)
      .not('observacoes', 'is', null),
  ])

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

  const model = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5'
  const systemPrompt = buildSystemPrompt(profile?.ai_perfil ?? null, profile?.ai_instrucoes ?? null)

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Aqui estão meus fragmentos de leitura e pensamento. Transforme-os em um texto corrido, como páginas de um caderno intelectual pessoal:\n\n${fragmentos.join('\n\n')}`,
        },
      ],
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    return NextResponse.json({ error: `Erro na API Claude: ${errorText}` }, { status: 500 })
  }

  const data = await response.json()
  const prosa = data.content?.find((part: { type?: string }) => part.type === 'text')?.text ?? ''
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
    .insert({ user_id: user.id, titulo, conteudo: prosa, fontes })
    .select()
    .single()

  if (saveError) {
    return NextResponse.json({ error: saveError.message }, { status: 500 })
  }

  return NextResponse.json({
    prosa,
    id: saved?.id,
    titulo: saved?.titulo ?? titulo,
    fontes: saved?.fontes ?? fontes,
    created_at: saved?.created_at,
    model,
  })
}
