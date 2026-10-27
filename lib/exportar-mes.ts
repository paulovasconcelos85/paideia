import { formatBRL, nomeMes } from './financas'
import type { Conta } from './contas'

// O mês para mandar adiante: WhatsApp (texto), Excel e PDF. As bibliotecas só carregam no clique.

export interface MesParaExportar {
  competencia: string
  hoje: string
  contas: Conta[]
  entradas: { descricao: string; data: string | null; valor: number; recebida: boolean; saldo: boolean }[]
  renda: number
  rendaRecebida: boolean
  total: number
  pago: number
  aPagar: number
  vencido: number
}

type Situacao = 'Pago' | 'A pagar' | 'Vencido'

const diaMes = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)} ` : '')
const dataBR = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '')

function situacao(c: Conta, hoje: string): Situacao {
  if (c.pago) return 'Pago'
  return c.vencimento && c.vencimento < hoje ? 'Vencido' : 'A pagar'
}

function nomeConta(c: Conta) {
  const mes = c.tipo === 'dizimo' && c.atrasada && c.competenciaDizimo ? ` de ${nomeMes(c.competenciaDizimo).split(' ')[0].toLowerCase()}` : ''
  return `${c.descricao}${mes}${c.parcela ? ` (${c.parcela})` : ''}`
}

const nomeArquivo = (m: MesParaExportar, ext: string) => `contas-${m.competencia.slice(0, 7)}.${ext}`

// ── WhatsApp

export function textoWhatsApp(m: MesParaExportar): string {
  const sobra = m.renda - m.total
  const icone: Record<Situacao, string> = { Pago: '✅', 'A pagar': '⏳', Vencido: '⚠️' }
  const linhas = [
    `*Contas de ${nomeMes(m.competencia).toLowerCase()}*`,
    '',
    ...(m.renda > 0 ? [`💰 Renda ${m.rendaRecebida ? 'recebida' : 'prevista'}: ${formatBRL(m.renda)}`] : []),
    `📋 Contas: ${formatBRL(m.total)}`,
    `✅ Pago: ${formatBRL(m.pago)}`,
    `⏳ A pagar: ${formatBRL(m.aPagar)}`,
    ...(m.vencido > 0 ? [`⚠️ Vencido: ${formatBRL(m.vencido)}`] : []),
    ...(m.renda > 0 ? [`${sobra >= 0 ? '🟢 Sobra' : '🔴 Falta'}: ${formatBRL(Math.abs(sobra))}`] : []),
  ]
  const entradas = m.entradas.filter(e => !e.saldo)
  if (entradas.length) {
    linhas.push('', '*Entradas*')
    for (const e of entradas) linhas.push(`${e.recebida ? '🔵' : '⚪'} ${diaMes(e.data)}${e.descricao}: ${formatBRL(e.valor)}${e.recebida ? '' : ' (prevista)'}`)
  }
  linhas.push('', '*Contas*')
  for (const c of m.contas) linhas.push(`${icone[situacao(c, m.hoje)]} ${diaMes(c.vencimento)}${nomeConta(c)}: ${formatBRL(c.valor)}`)
  return linhas.join('\n')
}

export function abrirWhatsApp(m: MesParaExportar) {
  window.open(`https://wa.me/?text=${encodeURIComponent(textoWhatsApp(m))}`, '_blank', 'noopener')
}

// ── Excel: a planilha do mês, com vermelho (a pagar) e verde (pago)

const COR: Record<Situacao, string> = { Pago: 'FF15803D', 'A pagar': 'FFDC2626', Vencido: 'FFDC2626' }
const MOEDA = '"R$" #,##0.00;[Red]-"R$" #,##0.00'

export async function gerarExcel(m: MesParaExportar): Promise<Blob> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(nomeMes(m.competencia))
  ws.columns = [{ width: 13 }, { width: 38 }, { width: 16 }, { width: 12 }]

  ws.addRow([`Contas de ${nomeMes(m.competencia).toLowerCase()}`]).font = { bold: true, size: 14 }
  ws.addRow([])
  const resumo: [string, number, string?][] = [
    ...(m.renda > 0 ? [[`Renda ${m.rendaRecebida ? 'recebida' : 'prevista'}`, m.renda, 'FF1D4ED8'] as [string, number, string]] : []),
    ['Contas do mês', m.total],
    ['Pago', m.pago, COR.Pago],
    ['A pagar', m.aPagar, COR['A pagar']],
    ['Vencido', m.vencido, COR.Vencido],
    ...(m.renda > 0 ? [[m.renda - m.total >= 0 ? 'Sobra' : 'Falta', Math.abs(m.renda - m.total)] as [string, number]] : []),
  ]
  for (const [rotulo, valor, cor] of resumo) {
    const r = ws.addRow(['', rotulo, valor])
    r.getCell(3).numFmt = MOEDA
    r.getCell(3).font = { bold: true, ...(cor ? { color: { argb: cor } } : {}) }
  }

  const cabecalho = (titulos: string[]) => {
    ws.addRow([])
    const r = ws.addRow(titulos)
    r.font = { bold: true }
    r.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } } })
  }

  const entradas = m.entradas.filter(e => !e.saldo)
  if (entradas.length) {
    cabecalho(['Data', 'Entrada', 'Valor', 'Situação'])
    for (const e of entradas) {
      const r = ws.addRow([dataBR(e.data), e.descricao, e.valor, e.recebida ? 'Recebida' : 'Prevista'])
      r.getCell(3).numFmt = MOEDA
      r.getCell(3).font = { color: { argb: e.recebida ? 'FF1D4ED8' : 'FF93C5FD' } }
    }
  }

  cabecalho(['Vencimento', 'Conta', 'Valor', 'Situação'])
  for (const c of m.contas) {
    const s = situacao(c, m.hoje)
    const r = ws.addRow([dataBR(c.vencimento), nomeConta(c), c.valor, s])
    r.getCell(3).numFmt = MOEDA
    r.getCell(3).font = { color: { argb: COR[s] }, bold: s === 'Vencido' }
    r.getCell(4).font = { color: { argb: COR[s] } }
  }
  const t = ws.addRow(['', 'Total', m.total])
  t.font = { bold: true }
  t.getCell(3).numFmt = MOEDA

  const buffer = await wb.xlsx.writeBuffer()
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

// ── PDF

export async function gerarPdf(m: MesParaExportar): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const { autoTable } = await import('jspdf-autotable')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const rgb: Record<Situacao, [number, number, number]> = { Pago: [21, 128, 61], 'A pagar': [220, 38, 38], Vencido: [220, 38, 38] }

  doc.setFontSize(16)
  doc.text(`Contas de ${nomeMes(m.competencia).toLowerCase()}`, 40, 50)
  doc.setFontSize(9)
  doc.setTextColor(120)
  doc.text(`Gerado em ${dataBR(m.hoje)} · Paideia Ekos`, 40, 66)
  doc.setTextColor(0)

  const sobra = m.renda - m.total
  autoTable(doc, {
    startY: 80,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    body: [
      ...(m.renda > 0 ? [[`Renda ${m.rendaRecebida ? 'recebida' : 'prevista'}`, formatBRL(m.renda)]] : []),
      ['Contas do mês', formatBRL(m.total)],
      ['Pago', formatBRL(m.pago)],
      ['A pagar', formatBRL(m.aPagar)],
      ['Vencido', formatBRL(m.vencido)],
      ...(m.renda > 0 ? [[sobra >= 0 ? 'Sobra' : 'Falta', formatBRL(Math.abs(sobra))]] : []),
    ],
    tableWidth: 260,
    didParseCell: d => {
      const rotulo = String(d.row.raw && (d.row.raw as string[])[0])
      if (d.column.index !== 1) return
      if (rotulo === 'Pago') d.cell.styles.textColor = rgb.Pago
      if (rotulo === 'A pagar' || rotulo === 'Vencido' || rotulo === 'Falta') d.cell.styles.textColor = rgb['A pagar']
      if (rotulo.startsWith('Renda')) d.cell.styles.textColor = [29, 78, 216]
    },
  })

  const ultimaY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

  const entradas = m.entradas.filter(e => !e.saldo)
  if (entradas.length) {
    autoTable(doc, {
      startY: ultimaY() + 16,
      head: [['Data', 'Entrada', 'Valor', 'Situação']],
      body: entradas.map(e => [dataBR(e.data), e.descricao, formatBRL(e.valor), e.recebida ? 'Recebida' : 'Prevista']),
      headStyles: { fillColor: [37, 99, 235] },
      styles: { fontSize: 9 },
      columnStyles: { 2: { halign: 'right' } },
      didParseCell: d => { if (d.column.index === 2) d.cell.styles.halign = 'right' },
    })
  }

  const situacoes = m.contas.map(c => situacao(c, m.hoje))
  autoTable(doc, {
    startY: ultimaY() + 16,
    head: [['Vencimento', 'Conta', 'Valor', 'Situação']],
    body: m.contas.map((c, i) => [dataBR(c.vencimento), nomeConta(c), formatBRL(c.valor), situacoes[i]]),
    foot: [['', 'Total', formatBRL(m.total), '']],
    headStyles: { fillColor: [42, 33, 133] },
    footStyles: { fillColor: [243, 244, 246], textColor: 20 },
    styles: { fontSize: 9 },
    columnStyles: { 2: { halign: 'right' } },
    didParseCell: d => {
      if (d.column.index === 2) d.cell.styles.halign = 'right'
      if (d.section !== 'body' || (d.column.index !== 2 && d.column.index !== 3)) return
      const s = situacoes[d.row.index]
      d.cell.styles.textColor = rgb[s]
      if (s === 'Vencido') d.cell.styles.fontStyle = 'bold'
    },
  })

  return doc.output('blob')
}

/** No celular, abre o "Compartilhar" (dá para mandar no WhatsApp); no computador, baixa o arquivo. */
export async function compartilharArquivo(blob: Blob, m: MesParaExportar, ext: 'xlsx' | 'pdf') {
  const nome = nomeArquivo(m, ext)
  const arquivo = new File([blob], nome, { type: blob.type })
  const toque = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  if (toque && navigator.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: `Contas de ${nomeMes(m.competencia).toLowerCase()}` })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return // a pessoa fechou o compartilhar
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
