import { Calendar } from 'lucide-react'

const PLANO = [
  { mes: 'Maio 2026', livros: [
    { tipo: 'principal', titulo: 'Somos Todos Teólogos', autor: 'R. C. Sproul' },
    { tipo: 'literário', titulo: 'O Hobbit', autor: 'J. R. R. Tolkien' },
    { tipo: 'complementar', titulo: 'A Lei', autor: 'Frédéric Bastiat' },
  ]},
  { mes: 'Junho 2026', livros: [
    { tipo: 'principal', titulo: 'Cristianismo e Liberalismo', autor: 'J. G. Machen' },
    { tipo: 'literário', titulo: 'Crime e Castigo', autor: 'Dostoiévski' },
    { tipo: 'complementar', titulo: 'Reflexões sobre a Revolução na França', autor: 'Edmund Burke' },
  ]},
  { mes: 'Julho 2026', livros: [
    { tipo: 'principal', titulo: 'A Abolição do Homem', autor: 'C. S. Lewis' },
    { tipo: 'literário', titulo: 'E Não Sobrou Nenhum', autor: 'Agatha Christie' },
    { tipo: 'complementar', titulo: 'O Caminho da Servidão', autor: 'F. A. Hayek' },
  ]},
  { mes: 'Agosto 2026', livros: [
    { tipo: 'principal', titulo: 'A Mortificação do Pecado', autor: 'John Owen' },
    { tipo: 'literário', titulo: 'O Senhor dos Anéis', autor: 'J. R. R. Tolkien' },
    { tipo: 'complementar', titulo: 'Conflito de Visões', autor: 'Thomas Sowell' },
  ]},
  { mes: 'Setembro 2026', livros: [
    { tipo: 'principal', titulo: 'A Morte da Razão', autor: 'Francis Schaeffer' },
    { tipo: 'literário', titulo: 'Frankenstein', autor: 'Mary Shelley' },
    { tipo: 'complementar', titulo: 'A Mentalidade Conservadora', autor: 'Russell Kirk' },
  ]},
  { mes: 'Outubro 2026', livros: [
    { tipo: 'principal', titulo: 'Calvinismo', autor: 'Abraham Kuyper' },
    { tipo: 'literário', titulo: 'Os Miseráveis', autor: 'Victor Hugo' },
    { tipo: 'complementar', titulo: 'A Democracia na América', autor: 'Tocqueville' },
  ]},
  { mes: 'Novembro 2026', livros: [
    { tipo: 'principal', titulo: 'Teologia Sistemática', autor: 'Louis Berkhof' },
    { tipo: 'literário', titulo: 'O Conde de Monte Cristo', autor: 'Alexandre Dumas' },
    { tipo: 'complementar', titulo: 'A Mentalidade Anticapitalista', autor: 'Ludwig von Mises' },
  ]},
  { mes: 'Dezembro 2026', livros: [
    { tipo: 'principal', titulo: 'As Institutas da Religião Cristã', autor: 'João Calvino' },
    { tipo: 'literário', titulo: 'Os Irmãos Karamázov', autor: 'Dostoiévski' },
    { tipo: 'complementar', titulo: 'A História da Arte', autor: 'E. H. Gombrich' },
  ]},
]

const TIPO_CONFIG = {
  principal:    { label: 'Principal',    dot: 'bg-violet-500' },
  literário:    { label: 'Literário',    dot: 'bg-red-500' },
  complementar: { label: 'Complementar', dot: 'bg-blue-500' },
}

export default function PlanoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Plano Mensal</h1>
        <p className="text-sm text-muted-foreground mt-1">24 meses de formação — 3 leituras por mês</p>
      </div>

      {/* Legenda */}
      <div className="flex gap-4 flex-wrap">
        {Object.entries(TIPO_CONFIG).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className={`w-2 h-2 rounded-full ${v.dot}`} />
            {v.label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PLANO.map(({ mes, livros }) => (
          <div key={mes} className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{mes}</span>
            </div>
            <div className="space-y-2">
              {livros.map(l => {
                const cfg = TIPO_CONFIG[l.tipo as keyof typeof TIPO_CONFIG]
                return (
                  <div key={l.titulo} className="flex gap-2.5">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${cfg.dot}`} />
                    <div>
                      <p className="text-sm leading-snug">{l.titulo}</p>
                      <p className="text-xs text-muted-foreground">{l.autor}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
