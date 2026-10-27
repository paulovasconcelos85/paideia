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
  parcelas_restantes: number | null // vale para o mês parcelas_ref; use parcelasRestantes() para hoje
  parcelas_total: number | null
  parcelas_ref: string | null
  cartao_id: string | null
  dia_vencimento: number | null
  essencial: boolean
  ativo: boolean // false = pausada
  observacoes: string | null
  inicio?: string | null // primeiro vencimento (YYYY-MM-DD): antes desse mês a conta não aparece
  created_at: string
}

export interface Cartao {
  id: string
  user_id: string
  nome: string
  dia_vencimento: number | null
  dia_fechamento: number | null
  limite: number | null
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

export const CATEGORIAS_DESPESA: Record<string, { label: string; className: string; descricao: string }> = {
  moradia:      { label: 'Moradia',               className: 'bg-blue-100 text-blue-800',       descricao: 'Aluguel ou financiamento, condomínio, IPTU, manutenção da casa' },
  supermercado: { label: 'Supermercado',          className: 'bg-lime-100 text-lime-800',       descricao: 'Compras do mês para casa: mercado, atacarejo, feira, padaria, açougue' },
  alimentacao:  { label: 'Alimentação fora',      className: 'bg-orange-100 text-orange-800',   descricao: 'Restaurantes, lanches, cafés e delivery (iFood, Rappi)' },
  combustivel:  { label: 'Combustível',           className: 'bg-yellow-100 text-yellow-800',   descricao: 'Gasolina, etanol, diesel, GNV: tudo de posto' },
  transporte:   { label: 'Transporte',            className: 'bg-cyan-100 text-cyan-800',       descricao: 'Uber e 99, ônibus, estacionamento, pedágio, oficina e seguro do carro' },
  saude:        { label: 'Saúde',                 className: 'bg-red-100 text-red-800',         descricao: 'Plano de saúde, consultas, exames, farmácia, dentista' },
  fitness:      { label: 'Fitness',               className: 'bg-emerald-100 text-emerald-800', descricao: 'Wellhub (Gympass), CrossFit, academia, suplementos, esportes' },
  educacao:     { label: 'Educação',              className: 'bg-violet-100 text-violet-800',   descricao: 'Escola, faculdade, cursos, idiomas, livros e material escolar' },
  filhos:       { label: 'Filhos',                className: 'bg-pink-100 text-pink-800',       descricao: 'Roupas, brinquedos, atividades e cuidados das crianças' },
  contas:       { label: 'Contas e serviços',     className: 'bg-slate-100 text-slate-700',     descricao: 'Luz, água, gás, internet, celular, anuidade e tarifas bancárias' },
  dividas:      { label: 'Dívidas e empréstimos', className: 'bg-rose-100 text-rose-800',       descricao: 'Parcelas de empréstimos, juros, encargos e rotativo do cartão' },
  igreja:       { label: 'Dízimo e ofertas',      className: 'bg-amber-100 text-amber-800',     descricao: 'Dízimo, ofertas, missões e doações' },
  viagens:      { label: 'Viagens',               className: 'bg-sky-100 text-sky-800',         descricao: 'Passagens, hotel, Airbnb, aluguel de carro e passeios das viagens' },
  lazer:        { label: 'Lazer',                 className: 'bg-green-100 text-green-800',     descricao: 'Cinema, passeios, shows, jogos e hobbies do dia a dia' },
  assinaturas:  { label: 'Assinaturas',           className: 'bg-indigo-100 text-indigo-800',   descricao: 'Streaming, apps, Amazon Prime e serviços digitais mensais' },
  pessoal:      { label: 'Cuidados pessoais',     className: 'bg-fuchsia-100 text-fuchsia-800', descricao: 'Roupas, salão, barbeiro, cosméticos e presentes' },
  impostos:     { label: 'Impostos e taxas',      className: 'bg-stone-100 text-stone-700',     descricao: 'IPVA, licenciamento, IOF, multas e taxas do governo' },
  outros:       { label: 'Outros',                className: 'bg-gray-100 text-gray-700',       descricao: 'O que não se encaixa nas demais (vale detalhar depois)' },
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

type DespesaParcelas = Pick<Despesa, 'frequencia' | 'parcelas_restantes' | 'parcelas_ref'>

/** Parcelas que faltam pagar a partir do mês de hoje (incluindo a deste mês). null se não for parcelada. */
export function parcelasRestantes(d: DespesaParcelas, hoje = new Date()): number | null {
  if (d.frequencia !== 'parcelada' || d.parcelas_restantes === null) return null
  const ref = d.parcelas_ref ? new Date(`${d.parcelas_ref}T12:00:00`) : hoje
  return Math.max(d.parcelas_restantes - Math.max(mesesEntre(ref, hoje), 0), 0)
}

/** Número da parcela cobrada num mês (ex.: 4 em "4/12"), a partir do orçamento. null se não der para saber. */
export function parcelaNoMes(d: DespesaParcelas & Pick<Despesa, 'parcelas_total'>, competencia: string): number | null {
  if (d.frequencia !== 'parcelada' || !d.parcelas_total) return null
  const mes = new Date(`${competencia}T12:00:00`)
  // Antes do mês de referência faltavam mais parcelas (meses de histórico)
  const antes = d.parcelas_ref ? mesesEntre(mes, new Date(`${d.parcelas_ref}T12:00:00`)) : 0
  const restantes = antes > 0 && d.parcelas_restantes !== null ? d.parcelas_restantes + antes : parcelasRestantes(d, mes)
  if (restantes === null) return null
  const n = d.parcelas_total - restantes + 1
  return n >= 1 && n <= d.parcelas_total ? n : null
}

/** Quanto ainda falta pagar de uma compra parcelada. */
export function valorRestante(d: DespesaParcelas & Pick<Despesa, 'valor' | 'ativo'>, hoje = new Date()): number {
  if (!d.ativo) return 0
  return (parcelasRestantes(d, hoje) ?? 0) * d.valor
}

/** Mês da última parcela. */
export function fimParcelas(d: DespesaParcelas, hoje = new Date()): Date | null {
  const r = parcelasRestantes(d, hoje)
  return r ? new Date(hoje.getFullYear(), hoje.getMonth() + r - 1, 1) : null
}

/** Valor da despesa diluído por mês — anuais viram 1/12 para o planejamento. */
export function despesaMensal(d: DespesaParcelas & Pick<Despesa, 'valor' | 'ativo'>, hoje = new Date()): number {
  if (!d.ativo) return 0
  if (d.frequencia === 'anual') return d.valor / 12
  if (d.frequencia === 'parcelada' && parcelasRestantes(d, hoje) === 0) return 0
  return d.valor
}

/**
 * Quanto será cobrado em cada um dos próximos meses (0 = mês atual): recorrentes + parcelas ainda correndo.
 * Anuais ficam de fora porque caem num único mês, que não registramos.
 */
export function projetarGastosMensais(despesas: Despesa[], meses = 12, hoje = new Date()): number[] {
  return Array.from({ length: meses }, (_, i) =>
    despesas.reduce((total, d) => {
      if (!d.ativo) return total
      if (d.frequencia === 'mensal') return total + d.valor
      if (d.frequencia === 'parcelada') {
        const r = parcelasRestantes(d, hoje)
        return r === null || r > i ? total + d.valor : total // sem total informado: segue cobrando
      }
      return total
    }, 0)
  )
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
  familia_id: string
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

// ─── Lançamentos reais, patrimônio e dívidas ─────────────────────────

export interface Lancamento {
  id: string
  familia_id: string
  user_id: string
  data: string
  competencia: string
  descricao: string
  valor: number
  categoria: string
  cartao_id: string | null
  parcela_atual: number | null
  parcelas_total: number | null
  origem: 'manual' | 'fatura' | 'fixo'
  despesa_id: string | null
  essencial: boolean | null // null = padrão da categoria
  vencimento: string | null // quando o dinheiro sai; null = na data da compra. No cartão, vale o da fatura
  pago: boolean // fora do cartão; no cartão, quem diz é a fatura (fin_faturas)
  created_at: string
}

/** Fatura marcada como paga (a linha existir já é o "pago"). */
export interface FaturaPaga {
  cartao_id: string
  competencia: string
}

export type TipoConta = 'conta' | 'poupanca' | 'reserva' | 'investimento' | 'dolar' | 'bem' | 'outro'
export type TipoDivida = 'cartao' | 'cheque_especial' | 'emprestimo' | 'consignado' | 'financiamento' | 'familia' | 'outro'

export interface Conta {
  id: string
  familia_id: string
  nome: string
  tipo: TipoConta
  saldo: number
  updated_at: string
}

export interface Divida {
  id: string
  familia_id: string
  nome: string
  tipo: TipoDivida
  saldo: number
  juros_mensal: number
  parcela: number
  updated_at: string
}

export interface Fechamento {
  mes: string
  ativos: number
  dividas: number
}

export const TIPOS_CONTA: Record<TipoConta, string> = {
  conta: 'Conta corrente',
  poupanca: 'Poupança',
  reserva: 'Reserva de emergência',
  investimento: 'Investimentos',
  dolar: 'Conta em dólar (valor em R$)',
  bem: 'Bens (carro, imóvel)',
  outro: 'Outro',
}

export const TIPOS_DIVIDA: Record<TipoDivida, string> = {
  cartao: 'Cartão (rotativo/parcelado)',
  cheque_especial: 'Cheque especial',
  emprestimo: 'Empréstimo pessoal',
  consignado: 'Consignado',
  financiamento: 'Financiamento',
  familia: 'Família e amigos',
  outro: 'Outra',
}

// Categorias que costumam ser escolha, não necessidade: nelas mostramos o custo em "dias do sonho"
export const CATEGORIAS_SUPERFLUAS = new Set(['lazer', 'viagens', 'assinaturas', 'pessoal', 'outros'])

/**
 * Lançamento como deve aparecer: se está ligado a um item do orçamento (fixo ou parcela),
 * nome, categoria, essencial e número da parcela vêm de lá. O valor continua o do lançamento
 * (é o que foi cobrado de verdade no mês).
 */
export function espelharLancamento<L extends Pick<Lancamento, 'despesa_id' | 'competencia' | 'descricao' | 'categoria' | 'essencial' | 'parcela_atual' | 'parcelas_total'>>(
  l: L,
  despesas: Despesa[],
): L {
  const d = l.despesa_id ? despesas.find(x => x.id === l.despesa_id) : undefined
  if (!d) return l
  const n = parcelaNoMes(d, l.competencia)
  return {
    ...l,
    descricao: d.descricao,
    categoria: d.categoria,
    essencial: d.essencial,
    ...(d.frequencia === 'parcelada' && n ? { parcela_atual: n, parcelas_total: d.parcelas_total } : {}),
  }
}

/** Essencial se marcado; sem marcação, segue a categoria. */
export function lancamentoEssencial(l: Pick<Lancamento, 'essencial' | 'categoria'>): boolean {
  return l.essencial ?? !CATEGORIAS_SUPERFLUAS.has(l.categoria)
}

/** Primeiro dia do mês, no formato do banco (YYYY-MM-01). */
export function competenciaISO(data = new Date()): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-01`
}

export function hojeISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function nomeMes(competencia: string): string {
  const s = new Date(`${competencia}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** O plano que guia a família: o ativo de maior prioridade. */
export function planoPrincipal(planos: Plano[]): Plano | null {
  const ativos = planos
    .filter(p => p.status === 'ativo')
    .sort((a, b) => b.prioridade - a.prioridade || a.created_at.localeCompare(b.created_at))
  return ativos[0] ?? null
}

/**
 * Quanto um gasto custa em tempo: dias de atraso no plano principal e horas de trabalho.
 * Dias = valor ÷ quanto o plano recebe por dia.
 */
export function custoEmTempo(valor: number, plano: Plano | null, rendaMensal: number) {
  const aporte = plano ? Number(plano.aporte_mensal) : 0
  return {
    dias: plano && aporte > 0 ? valor / (aporte / 30) : null,
    horas: rendaMensal > 0 ? valor / (rendaMensal / 176) : null, // 22 dias × 8 h
    plano: plano?.titulo ?? null,
  }
}

export function fraseCustoEmTempo(valor: number, plano: Plano | null, rendaMensal: number): string | null {
  if (valor <= 0) return null
  const { dias, horas, plano: nome } = custoEmTempo(valor, plano, rendaMensal)
  const partes: string[] = []
  if (horas !== null) partes.push(`${horas < 1 ? 'menos de 1' : Math.round(horas)} h de trabalho`)
  if (dias !== null && nome) partes.push(`${dias < 1 ? 'menos de 1 dia' : `${Math.round(dias)} ${Math.round(dias) === 1 ? 'dia' : 'dias'}`} a mais até "${nome}"`)
  return partes.length ? partes.join(' · ') : null
}

/** Dia X de um mês (YYYY-MM-01) como data YYYY-MM-DD, ajustado para meses curtos. */
export function diaNoMes(competencia: string, dia: number): string {
  const [ano, mes] = competencia.split('-').map(Number)
  const ultimo = new Date(ano, mes, 0).getDate()
  return `${competencia.slice(0, 8)}${String(Math.min(dia, ultimo)).padStart(2, '0')}`
}

/** Mês (YYYY-MM-01) somado de alguns meses. */
export function somarMeses(competencia: string, delta: number): string {
  const d = new Date(`${competencia}T12:00:00`)
  return competenciaISO(new Date(d.getFullYear(), d.getMonth() + delta, 1))
}

// A fatura fecha no mês da competência; se o dia do vencimento vem antes do fechamento, vence no mês seguinte
const venceNoMesSeguinte = (c: Pick<Cartao, 'dia_vencimento' | 'dia_fechamento'>) =>
  !!c.dia_vencimento && !!c.dia_fechamento && c.dia_vencimento <= c.dia_fechamento

/** Data de vencimento da fatura de um mês. null se o cartão não tiver dia de vencimento. */
export function vencimentoFatura(c: Pick<Cartao, 'dia_vencimento' | 'dia_fechamento'>, competencia: string): string | null {
  if (!c.dia_vencimento) return null
  return diaNoMes(venceNoMesSeguinte(c) ? somarMeses(competencia, 1) : competencia, c.dia_vencimento)
}

/** Qual fatura (competência) do cartão é paga dentro de um mês. */
export function faturaPagaNoMes(c: Pick<Cartao, 'dia_vencimento' | 'dia_fechamento'>, mes: string): string {
  return venceNoMesSeguinte(c) ? somarMeses(mes, -1) : mes
}

export function formatDiaMes(dataISO: string): string {
  return new Date(`${dataISO}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

// ── Dízimo: 10% da renda, devolvido ao Senhor. Não é gasto.

export const DIZIMO = 0.1

/** Dízimo de um mês já devolvido. */
export interface DizimoDevolvido {
  competencia: string
  valor: number
  devolvido_em: string
}

/** Renda que entra num mês: as mensais e as anuais (13º, férias) no mês em que caem. Eventuais ficam de fora. */
export function rendaDoMes(rendas: Pick<Renda, 'valor' | 'frequencia' | 'ativo' | 'mes_recebimento'>[], competencia: string): number {
  const mes = Number(competencia.slice(5, 7))
  return rendas
    .filter(r => r.ativo && (r.frequencia === 'mensal' || (r.frequencia === 'anual' && r.mes_recebimento === mes)))
    .reduce((a, r) => a + Number(r.valor), 0)
}

export function dizimoDoMes(rendas: Pick<Renda, 'valor' | 'frequencia' | 'ativo' | 'mes_recebimento'>[], competencia: string): number {
  return Math.round(rendaDoMes(rendas, competencia) * DIZIMO * 100) / 100
}

/** A conta fixa cai neste mês? Respeita início, pausa e o fim das parcelas. Anuais ficam de fora (entram quando lançadas). */
export function ocorreNoMes(d: Despesa, competencia: string): boolean {
  if (!d.ativo) return false
  // Começa no primeiro vencimento; sem ele, no mês em que foi cadastrada (não inventa contas no passado)
  const inicio = d.inicio ?? d.created_at
  if (inicio && inicio.slice(0, 7) > competencia.slice(0, 7)) return false
  if (d.frequencia === 'mensal') return true
  if (d.frequencia === 'parcelada') return (parcelasRestantes(d, new Date(`${competencia}T12:00:00`)) ?? 1) > 0
  return false
}

/** Rótulo da parcela no mês: "2/5", "faltam 3" (sem total conhecido) ou "última". null se não for parcelada. */
export function rotuloParcela(d: Despesa, competencia: string): string | null {
  if (d.frequencia !== 'parcelada') return null
  const n = parcelaNoMes(d, competencia)
  if (n && d.parcelas_total) return `${n}/${d.parcelas_total}`
  if (d.parcelas_total || (d.parcelas_ref && competencia < d.parcelas_ref.slice(0, 10))) return null // fora das parcelas
  const r = parcelasRestantes(d, new Date(`${competencia}T12:00:00`))
  if (r === null) return null
  return r <= 1 ? 'última' : `faltam ${r}`
}
