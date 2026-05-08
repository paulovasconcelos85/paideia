import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada.' }, { status: 500 })
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
    fragmentos.push(
      '## Anotações mensais\n' +
        planosObs.map(plano => `- [${plano.titulo}]: ${plano.observacoes}`).join('\n')
    )
  }

  if (!fragmentos.length) {
    return NextResponse.json({ error: 'Nenhuma anotação encontrada ainda.' }, { status: 400 })
  }

  const modelCandidates = [
    process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5',
  ].filter((model, index, models) => models.indexOf(model) === index)

  const payload = {
      max_tokens: 2000,
      system: `Você é um assistente literário de um leitor cristão reformado, conservador e amante da boa literatura e da arte clássica.
Sua tarefa é pegar fragmentos de pensamentos, citações, observações de leitura e reflexões e transformá-los em um texto corrido, coeso e elegante, como um ensaio pessoal, na primeira pessoa, no estilo de um caderno intelectual.
O texto deve conectar as ideias naturalmente, sem listar, sem tópicos, sem cabeçalhos. Prosa contínua.
Preserve o espírito cristão reformado, conservador e literário das anotações.
Escreva em português brasileiro culto mas não artificioso. Tom reflexivo, sério, mas não hermético.
Não invente informações além do que está nos fragmentos. Conecte, elabore, aprofunde, mas a partir do que está ali.`,
      messages: [
        {
          role: 'user',
          content: `Aqui estão meus fragmentos de leitura e pensamento. Transforme-os em um texto corrido, como páginas de um caderno intelectual pessoal:\n\n${fragmentos.join('\n\n')}`,
        },
      ],
  }

  let response: Response | null = null
  let lastErrorText = ''
  let usedModel = modelCandidates[0]

  for (const model of modelCandidates) {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model, ...payload }),
    })

    if (response.ok) {
      usedModel = model
      break
    }

    lastErrorText = await response.text()

    if (!lastErrorText.includes('not_found_error')) {
      break
    }
  }

  if (!response?.ok) {
    return NextResponse.json({ error: `Erro na API Claude: ${lastErrorText}` }, { status: 500 })
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
    .insert({
      user_id: user.id,
      titulo,
      conteudo: prosa,
      fontes,
    })
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
    model: usedModel,
  })
}
