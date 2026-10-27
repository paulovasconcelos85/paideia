// Esqueletos exibidos enquanto o servidor busca os dados da página (usados pelos loading.tsx)

export function Bloco({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />
}

/** Página genérica: título, cartões de métricas e uma lista. */
export function CarregandoPagina() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando">
      <div className="space-y-2">
        <Bloco className="h-7 w-48" />
        <Bloco className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-3 rounded-lg border border-border p-4">
            <Bloco className="h-3 w-20" />
            <Bloco className="h-8 w-16" />
          </div>
        ))}
      </div>
      <CarregandoLista />
    </div>
  )
}

/** Conteúdo de uma aba de Finanças: o cabeçalho e as abas continuam visíveis acima. */
export function CarregandoFinancas() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando">
      <div className="space-y-4 rounded-2xl border border-border p-5">
        <Bloco className="h-4 w-32" />
        <Bloco className="h-9 w-48" />
        <Bloco className="h-2 w-full rounded-full" />
        <div className="flex gap-6">
          <Bloco className="h-4 w-24" />
          <Bloco className="h-4 w-24" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="space-y-3 rounded-2xl border border-border p-5">
            <Bloco className="h-4 w-28" />
            <Bloco className="h-7 w-36" />
            <Bloco className="h-4 w-full" />
            <Bloco className="h-4 w-2/3" />
          </div>
        ))}
      </div>
      <CarregandoLista linhas={4} />
    </div>
  )
}

function CarregandoLista({ linhas = 5 }: { linhas?: number }) {
  return (
    <div className="divide-y divide-border rounded-lg border border-border">
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="flex items-center gap-3 p-4">
          <Bloco className="h-9 w-9 flex-shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Bloco className="h-4 w-1/2" />
            <Bloco className="h-3 w-1/3" />
          </div>
          <Bloco className="h-4 w-16" />
        </div>
      ))}
    </div>
  )
}
