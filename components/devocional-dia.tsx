import { createClient } from '@/lib/supabase/server'

export default async function DevocionalDia() {
  const supabase = await createClient()

  const { data: devocional } = await supabase
    .from('devocional_dia')
    .select('titulo, texto')
    .order('data', { ascending: false })
    .limit(1)
    .single()

  if (!devocional) return null

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
        Devocional do dia
      </h2>
      <h3 className="text-lg font-semibold">{devocional.titulo}</h3>
      <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
        {devocional.texto}
      </p>
    </div>
  )
}
