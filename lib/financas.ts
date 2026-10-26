export type FrequenciaDespesa = 'mensal' | 'anual' | 'parcelada'
export type FrequenciaRenda = 'mensal' | 'anual' | 'eventual'
export type TipoRenda =
  | 'salario' | 'ferias' | 'decimo_terceiro' | 'beneficio'
  | 'extra' | 'investimento' | 'aluguel' | 'outro'

export interface Despesa {
  id: string
  user_id: string
  descricao: string
  categoria: string
  valor: number
  frequencia: FrequenciaDespesa
  parcelas_restantes: number | null
  dia_vencimento: number | null
  essencial: boolean
  ativo: boolean
  observacoes: string | null
  created_at: string
}

export interface Renda {
  id: string
  user_id: string
  descricao: string
  tipo: TipoRenda
  valor: number
  frequencia: FrequenciaRenda
  mes_recebimento: number | null
  ativo: boolean
  observacoes: string | null
  created_at: string
}

export const CATEGORIAS_DESPESA: Record<string, { label: string; className: string }> = {
  moradia:     { label: 'Moradia',      className: 'bg-blue-100 text-blue-800' },
  alimentacao: { label: 'Alimentação',  className: 'bg-orange-100 text-orange-800' },
  transporte:  { label: 'Transporte',   className: 'bg-cyan-100 text-cyan-800' },
  saude:       { label: 'Saúde',        className: 'bg-red-100 text-red-800' },
  educacao:    { label: 'Educação',     className: 'bg-violet-100 text-violet-800' },
  filhos:      { label: 'Filhos',       className: 'bg-pink-100 text-pink-800' },
  contas:      { label: 'Contas e serviços', className: 'bg-slate-100 text-slate-700' },
  dividas:     { label: 'Dívidas e empréstimos', className: 'bg-rose-100 text-rose-800' },
  igreja:      { label: 'Dízimo e ofertas', className: 'bg-amber-100 text-amber-800' },
  lazer:       { label: 'Lazer',        className: 'bg-green-100 text-green-800' },
  assinaturas: { label: 'Assinaturas',  className: 'bg-indigo-100 text-indigo-800' },
  pessoal:     { label: 'Cuidados pessoais', className: 'bg-fuchsia-100 text-fuchsia-800' },
  impostos:    { label: 'Impostos e taxas', className: 'bg-stone-100 text-stone-700' },
  outros:      { label: 'Outros',       className: 'bg-gray-100 text-gray-700' },
}

export const TIPOS_RENDA: Record<TipoRenda, { label: string; frequenciaPadrao: FrequenciaRenda }> = {
  salario:         { label: 'Salário',          frequenciaPadrao: 'mensal' },
  ferias:          { label: 'Férias (1/3)',     frequenciaPadrao: 'anual' },
  decimo_terceiro: { label: '13º salário',      frequenciaPadrao: 'anual' },
  beneficio:       { label: 'Auxílios e benefícios', frequenciaPadrao: 'mensal' },
  extra:           { label: 'Renda extra',      frequenciaPadrao: 'eventual' },
  investimento:    { label: 'Rendimentos',      frequenciaPadrao: 'mensal' },
  aluguel:         { label: 'Aluguel recebido', frequenciaPadrao: 'mensal' },
  outro:           { label: 'Outro',            frequenciaPadrao: 'mensal' },
}

export const FREQUENCIA_DESPESA_LABEL: Record<FrequenciaDespesa, string> = {
  mensal: 'Mensal',
  anual: 'Anual',
  parcelada: 'Parcelada',
}

export const FREQUENCIA_RENDA_LABEL: Record<FrequenciaRenda, string> = {
  mensal: 'Mensal',
  anual: 'Anual',
  eventual: 'Eventual',
}

export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatBRL(valor: number): string {
  return brl.format(valor)
}

/** Aceita "1.234,56", "1234,56", "1234.56" ou "R$ 1.234". Retorna null se inválido. */
export function parseBRL(texto: string): number | null {
  let s = texto.replace(/[R$\s]/g, '')
  if (!s) return null
  // Vírgula é decimal; sem vírgula, "1.500" ou "12.345.678" são milhares no padrão brasileiro
  if (s.includes(',') || /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '').replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
}

/** Valor da despesa diluído por mês — anuais viram 1/12 para o planejamento. */
export function despesaMensal(d: Pick<Despesa, 'valor' | 'frequencia' | 'parcelas_restantes' | 'ativo'>): number {
  if (!d.ativo) return 0
  if (d.frequencia === 'anual') return d.valor / 12
  if (d.frequencia === 'parcelada' && d.parcelas_restantes === 0) return 0
  return d.valor
}

/** Renda diluída por mês. Eventuais ficam de fora: não se planeja com dinheiro incerto. */
export function rendaMensal(r: Pick<Renda, 'valor' | 'frequencia' | 'ativo'>): number {
  if (!r.ativo) return 0
  if (r.frequencia === 'anual') return r.valor / 12
  if (r.frequencia === 'eventual') return 0
  return r.valor
}

// ─── Planos e cenários ───────────────────────────────────────────────

export type StatusPlano = 'ideia' | 'ativo' | 'pausado' | 'concluido'
export type Moeda = 'BRL' | 'USD'

export interface ItemPlano { descricao: string; valor: number }
export interface EtapaPlano { texto: string; feito: boolean }

export interface Plano {
  id: string
  user_id: string
  titulo: string
  descricao: string | null
  status: StatusPlano
  moeda: Moeda
  cotacao: number | null
  valor_guardado: number
  aporte_mensal: number
  data_alvo: string | null
  prioridade: number
  itens: ItemPlano[]
  etapas: EtapaPlano[]
  created_at: string
}

export const STATUS_PLANO: Record<StatusPlano, { label: string; className: string }> = {
  ideia:     { label: 'Ideia',     className: 'bg-slate-100 text-slate-700' },
  ativo:     { label: 'Ativo',     className: 'bg-blue-100 text-blue-800' },
  pausado:   { label: 'Pausado',   className: 'bg-amber-100 text-amber-800' },
  concluido: { label: 'Concluído', className: 'bg-green-100 text-green-800' },
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export function formatMoeda(valor: number, moeda: Moeda): string {
  return moeda === 'USD' ? usd.format(valor) : brl.format(valor)
}

/** Fator para converter valores do plano em reais. */
function fatorBRL(p: Pick<Plano, 'moeda' | 'cotacao'>): number {
  return p.moeda === 'USD' ? Number(p.cotacao) || 0 : 1
}

export interface ProjecaoPlano {
  meta: number          // na moeda do plano
  metaBRL: number
  guardadoBRL: number
  faltaBRL: number
  progresso: number     // 0–100
  mesesNoRitmo: number | null   // meses para concluir com o aporte atual (null = nunca)
  dataPrevista: Date | null
  mesesAteAlvo: number | null
  aporteNecessario: number | null // R$/mês para chegar na data alvo
  semCotacao: boolean
}

export function mesesEntre(de: Date, ate: Date): number {
  return (ate.getFullYear() - de.getFullYear()) * 12 + (ate.getMonth() - de.getMonth())
}

export function projetarPlano(p: Plano, aporte = Number(p.aporte_mensal), hoje = new Date()): ProjecaoPlano {
  const meta = p.itens.reduce((a, i) => a + (Number(i.valor) || 0), 0)
  const fator = fatorBRL(p)
  const metaBRL = meta * fator
  const guardadoBRL = Number(p.valor_guardado) * fator
  const faltaBRL = Math.max(metaBRL - guardadoBRL, 0)
  const progresso = metaBRL > 0 ? Math.min((guardadoBRL / metaBRL) * 100, 100) : 0

  const mesesNoRitmo = faltaBRL === 0 ? 0 : aporte > 0 ? Math.ceil(faltaBRL / aporte) : null
  const dataPrevista = mesesNoRitmo === null ? null : new Date(hoje.getFullYear(), hoje.getMonth() + mesesNoRitmo, 1)

  let mesesAteAlvo: number | null = null
  let aporteNecessario: number | null = null
  if (p.data_alvo) {
    mesesAteAlvo = Math.max(mesesEntre(hoje, new Date(`${p.data_alvo}T12:00:00`)), 0)
    aporteNecessario = mesesAteAlvo > 0 ? faltaBRL / mesesAteAlvo : faltaBRL
  }

  return {
    meta, metaBRL, guardadoBRL, faltaBRL, progresso, mesesNoRitmo, dataPrevista,
    mesesAteAlvo, aporteNecessario, semCotacao: p.moeda === 'USD' && !fator,
  }
}

export function formatMesAno(data: Date): string {
  return data.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
}
