import type { Status } from './types'

export const STATUS_CONFIG: Record<Status, { label: string; className: string }> = {
  quero:      { label: 'Na fila',    className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  comprar:    { label: 'Comprar',    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
  lendo:      { label: 'Lendo',      className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  lido:       { label: 'Lido',       className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  reler:      { label: 'Reler',      className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  abandonado: { label: 'Abandonado', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
}

export function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ')
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function starArray(nota: number | null): boolean[] {
  return Array.from({ length: 5 }, (_, i) => i < (nota ?? 0))
}
