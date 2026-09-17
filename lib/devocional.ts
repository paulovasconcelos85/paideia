const CADADIA_URL = 'https://cadadia.org.br/site/'

export type Devocional = {
  titulo: string
  texto: string
}

function decodeEntities(html: string): string {
  return html
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '')
}

export async function getDevocionalDoDia(): Promise<Devocional> {
  const res = await fetch(CADADIA_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`falha ao buscar cadadia.org.br: HTTP ${res.status} ${res.statusText}`)
  }

  const html = await res.text()
  const blockquoteMatch = html.match(/<blockquote>([\s\S]*?)<\/blockquote>/i)
  if (!blockquoteMatch) {
    throw new Error('blockquote não encontrado no HTML retornado')
  }

  const inner = blockquoteMatch[1]

  const titleMatch = inner.match(/<strong>([\s\S]*?)<\/strong>/i)
  if (!titleMatch) {
    throw new Error('título (<strong>) não encontrado dentro do blockquote')
  }

  const titulo = decodeEntities(stripTags(titleMatch[1]))
    .replace(/\s+/g, ' ')
    .trim()

  const rest = inner.slice(titleMatch.index! + titleMatch[0].length)

  const texto = decodeEntities(
    stripTags(
      rest
        .replace(/(<br\s*\/?>\s*){2,}/gi, '\n\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>\s*<p>/gi, '\n\n')
    )
  )
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (!titulo || !texto) {
    throw new Error('título ou texto ficaram vazios após o parsing')
  }

  return { titulo, texto }
}
