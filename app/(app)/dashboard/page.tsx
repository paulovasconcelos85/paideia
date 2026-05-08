import { createClient } from '@/lib/supabase/server'
import type { DashboardStats } from '@/lib/types'
import { BookOpen, BookMarked, ShoppingCart, Star } from 'lucide-react'
import EixoProgressCard from '@/components/eixo-progress-card'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: livros }, { data: eixos }] = await Promise.all([
    supabase.from('livros').select('status, nota, eixo_id').eq('user_id', user!.id),
    supabase.from('eixos').select('*').order('id'),
  ])

  const lidos = livros?.filter(l => l.status === 'lido') ?? []
  const emLeitura = livros?.filter(l => l.status === 'lendo').length ?? 0
  const aComprar = livros?.filter(l => l.status === 'comprar').length ?? 0
  const notasValidas = lidos.filter(l => l.nota)
  const mediaNotas = notasValidas.length
    ? (notasValidas.reduce((a, b) => a + (b.nota ?? 0), 0) / notasValidas.length).toFixed(1)
    : null
  const totalPlanejado = eixos?.reduce((a, e) => a + e.total_planejado, 0) ?? 0

  const lidosPorEixo = (eixos ?? []).map(e => ({
    eixo: e,
    lidos: lidos.filter(l => l.eixo_id === e.id).length,
  }))

  const metrics = [
    { label: 'Livros lidos', value: lidos.length, sub: `de ${totalPlanejado} planejados`, icon: BookOpen, color: 'text-violet-600' },
    { label: 'Lendo agora', value: emLeitura, sub: 'em andamento', icon: BookMarked, color: 'text-blue-600' },
    { label: 'A comprar', value: aComprar, sub: 'registrados', icon: ShoppingCart, color: 'text-amber-600' },
    { label: 'Nota média', value: mediaNotas ?? '—', sub: 'dos livros avaliados', icon: Star, color: 'text-yellow-500' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral da sua formação intelectual</p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="rounded-lg border border-border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{label}</span>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div className="text-3xl font-semibold">{value}</div>
            <div className="text-xs text-muted-foreground">{sub}</div>
          </div>
        ))}
      </div>

      {/* Progresso por eixo */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
          Progresso por eixo
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {lidosPorEixo.map(({ eixo, lidos }) => (
            <EixoProgressCard key={eixo.id} eixo={eixo} lidos={lidos} />
          ))}
        </div>
      </div>
    </div>
  )
}
