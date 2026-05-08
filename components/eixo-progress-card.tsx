import type { Eixo } from '@/lib/types'

export default function EixoProgressCard({ eixo, lidos }: { eixo: Eixo; lidos: number }) {
  const pct = Math.min(Math.round((lidos / eixo.total_planejado) * 100), 100)

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{eixo.nome}</span>
        <span className="text-xs text-muted-foreground">{lidos}/{eixo.total_planejado}</span>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: eixo.cor }}
        />
      </div>
      <div className="text-xs text-muted-foreground">{pct}% concluído</div>
    </div>
  )
}
