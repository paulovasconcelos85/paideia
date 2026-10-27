'use client'

import { useEffect, useState } from 'react'
import { formatBRL, parseBRL } from '@/lib/financas'
import { simularIR } from '@/lib/ir'

const STORAGE_KEY = 'ekos:ir'

interface Props {
  saudeAnual: number
  educacaoAnual: number
}

const texto = (n: number) => (n ? n.toFixed(2).replace('.', ',') : '')
const inputClass = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-ring'

export default function SimuladorIR({ saudeAnual, educacaoAnual }: Props) {
  const [f, setF] = useState({
    bruto: '', previdencia: '', dependentes: '0', pgbl: '',
    saude: texto(saudeAnual), educacao: texto(educacaoAnual),
  })

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY)
      if (salvo) setF(p => ({ ...p, ...JSON.parse(salvo) }))
    } catch { /* ignorado */ }
  }, [])

  function alterar(campo: keyof typeof f, valor: string) {
    setF(p => {
      const novo = { ...p, [campo]: valor }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(novo)) } catch { /* ignorado */ }
      return novo
    })
  }

  const bruto = parseBRL(f.bruto) ?? 0
  const r = bruto > 0
    ? simularIR({
        brutoMensal: bruto,
        previdenciaMensal: parseBRL(f.previdencia) ?? 0,
        dependentes: Number(f.dependentes) || 0,
        saudeAnual: parseBRL(f.saude) ?? 0,
        educacaoAnual: parseBRL(f.educacao) ?? 0,
        pgblAnual: parseBRL(f.pgbl) ?? 0,
      })
    : null

  const campo = (label: string, k: keyof typeof f, dica?: string) => (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <input inputMode="decimal" value={f[k]} onChange={e => alterar(k, e.target.value)} placeholder="0,00" className={inputClass} />
      {dica && <p className="text-[11px] text-muted-foreground">{dica}</p>}
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {campo('Salário bruto mensal', 'bruto')}
        {campo('Previdência oficial/mês', 'previdencia', 'INSS ou RPPS do servidor')}
        {campo('Saúde no ano', 'saude', 'Plano, consultas, exames')}
        {campo('Educação no ano', 'educacao', 'Escola e faculdade')}
        {campo('PGBL no ano', 'pgbl')}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Dependentes</label>
          <input type="number" min={0} value={f.dependentes} onChange={e => alterar('dependentes', e.target.value)} className={inputClass} />
        </div>
      </div>

      {r && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-center">
            {(['completo', 'simplificado'] as const).map(m => (
              <div key={m} className={`rounded-lg p-3 ${r.melhor === m ? 'bg-green-50 ring-1 ring-green-300 text-gray-900' : 'bg-secondary/60'}`}>
                <p className="text-xs text-muted-foreground capitalize">{m}</p>
                <p className="font-semibold tabular-nums">{formatBRL(m === 'completo' ? r.irCompleto : r.irSimplificado)}</p>
                {r.melhor === m && <p className="text-[11px] text-green-700">melhor para mim</p>}
              </div>
            ))}
          </div>
          {r.economiaModelo > 1 && (
            <p className="text-sm">
              Declarando no modelo <strong>{r.melhor}</strong>, o imposto do ano fica <strong>{formatBRL(r.economiaModelo)}</strong> menor.
            </p>
          )}
          {r.economiaPgbl > 50 && (
            <p className="rounded-lg bg-blue-50 p-3 text-sm text-gray-900">
              Aportando até <strong>{formatBRL(r.pgblMaximo)}</strong> por ano em PGBL (12% da renda tributável), o imposto cai cerca de{' '}
              <strong>{formatBRL(r.economiaPgbl)}</strong>. Só vale no modelo completo, e o dinheiro fica para a aposentadoria: o imposto é
              cobrado no resgate. Compare as taxas antes.
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            Estimativa com a tabela e os limites de referência (o 13º fica fora, por ter tributação exclusiva). Não considera outras
            rendas nem o imposto já retido na fonte. Confirme no programa da Receita.
          </p>
        </div>
      )}
    </div>
  )
}
