'use client'

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'

interface Props {
  dataNascimento: string
}

interface Tempo {
  anos: number
  meses: number
  dias: number
  horas: number
  minutos: number
  segundos: number
  totalHoras: number
}

function calcularTempo(nascimento: Date): Tempo {
  const agora = new Date()

  let anos = agora.getFullYear() - nascimento.getFullYear()
  let meses = agora.getMonth() - nascimento.getMonth()
  let dias = agora.getDate() - nascimento.getDate()
  let horas = agora.getHours() - nascimento.getHours()
  let minutos = agora.getMinutes() - nascimento.getMinutes()
  let segundos = agora.getSeconds() - nascimento.getSeconds()

  if (segundos < 0) { segundos += 60; minutos-- }
  if (minutos < 0) { minutos += 60; horas-- }
  if (horas < 0) { horas += 24; dias-- }
  if (dias < 0) {
    const mesAnterior = new Date(agora.getFullYear(), agora.getMonth(), 0)
    dias += mesAnterior.getDate()
    meses--
  }
  if (meses < 0) { meses += 12; anos-- }

  const totalMs = agora.getTime() - nascimento.getTime()
  const totalHoras = Math.floor(totalMs / (1000 * 60 * 60))

  return { anos, meses, dias, horas, minutos, segundos, totalHoras }
}

export default function RelogioVida({ dataNascimento }: Props) {
  const [tempo, setTempo] = useState<Tempo | null>(null)

  useEffect(() => {
    const nascimento = new Date(dataNascimento)
    setTempo(calcularTempo(nascimento))
    const id = setInterval(() => setTempo(calcularTempo(nascimento)), 1000)
    return () => clearInterval(id)
  }, [dataNascimento])

  const unidades = tempo ? [
    { label: 'anos', valor: tempo.anos },
    { label: 'meses', valor: tempo.meses },
    { label: 'dias', valor: tempo.dias },
    { label: 'horas', valor: tempo.horas },
    { label: 'min', valor: tempo.minutos },
    { label: 'seg', valor: tempo.segundos },
  ] : []

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Relógio da vida</span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {tempo ? unidades.map(({ label, valor }) => (
          <div key={label} className="flex flex-col items-center rounded-md bg-muted/50 px-2 py-2">
            <span className="text-xl font-semibold tabular-nums leading-none">
              {String(valor).padStart(2, '0')}
            </span>
            <span className="text-xs text-muted-foreground mt-1">{label}</span>
          </div>
        )) : Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center rounded-md bg-muted/50 px-2 py-2 animate-pulse">
            <span className="text-xl font-semibold tabular-nums leading-none text-transparent">00</span>
            <span className="text-xs text-transparent mt-1">--</span>
          </div>
        ))}
      </div>

      {tempo && (
        <p className="text-xs text-muted-foreground text-center">
          {tempo.totalHoras.toLocaleString('pt-BR')} horas vividas
        </p>
      )}
    </div>
  )
}
