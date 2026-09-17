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

export async function getDevocionalDoDia(): Promise<Devocional | null> {
  try {
    const res = await fetch(CADADIA_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store',
    })
    if (!res.ok) return null

    const html = await res.text()
    const blockquoteMatch = html.match(/<blockquote>([\s\S]*?)<\/blockquote>/i)
    if (!blockquoteMatch) return null

    const inner = blockquoteMatch[1]

    const titleMatch = inner.match(/<strong>([\s\S]*?)<\/strong>/i)
    if (!titleMatch) return null

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

    if (!titulo || !texto) return null

    return { titulo, texto }
  } catch {
    return null
  }
}
