import type { StaticImageData } from 'next/image'
import aspen from '@/public/eua/aspen.jpg'
import bandeira from '@/public/eua/bandeira.jpg'
import bostonCentro from '@/public/eua/boston-centro.jpg'
import bostonCharles from '@/public/eua/boston-charles.jpg'
import bostonPorto from '@/public/eua/boston-porto.jpg'
import bostonQuincy from '@/public/eua/boston-quincy.jpg'
import bostonRua from '@/public/eua/boston-rua.jpg'
import bostonSkyline from '@/public/eua/boston-skyline.jpg'
import disney from '@/public/eua/disney.jpg'
import dolar from '@/public/eua/dolar.jpg'
import harvard from '@/public/eua/harvard.png'
import miami from '@/public/eua/miami.jpg'
import neve from '@/public/eua/neve.jpg'
import novaYork from '@/public/eua/nova-york.jpg'

// O destino que motiva cada real guardado

export interface Foto {
  src: StaticImageData
  lugar: string
}

export const FOTOS = {
  bostonSkyline: { src: bostonSkyline, lugar: 'Boston, vista de Cambridge' },
  bostonCharles: { src: bostonCharles, lugar: 'Boston, rio Charles' },
  bostonPorto: { src: bostonPorto, lugar: 'Boston, porto ao anoitecer' },
  bostonQuincy: { src: bostonQuincy, lugar: 'Boston, Quincy Market' },
  bostonRua: { src: bostonRua, lugar: 'Boston, centro histórico' },
  bostonCentro: { src: bostonCentro, lugar: 'Boston, Downtown Crossing' },
  novaYork: { src: novaYork, lugar: 'Nova York, Central Park' },
  miami: { src: miami, lugar: 'Miami Beach' },
  disney: { src: disney, lugar: 'Orlando, Magic Kingdom' },
  aspen: { src: aspen, lugar: 'Aspen, Colorado' },
  neve: { src: neve, lugar: 'Inverno em família' },
  bandeira: { src: bandeira, lugar: 'Estados Unidos' },
  dolar: { src: dolar, lugar: 'Dólar' },
} satisfies Record<string, Foto>

export const BRASAO_HARVARD = harvard

// Capa das finanças: uma por dia, em rodízio
const CAPAS: Foto[] = [FOTOS.bostonCharles, FOTOS.bostonSkyline, FOTOS.bostonPorto, FOTOS.novaYork, FOTOS.bostonQuincy, FOTOS.bostonCentro]

/** Foto do dia. Recebe a data do servidor para não trocar de foto entre servidor e navegador. */
export function capaDoDia(dataISO: string): Foto {
  const dia = Math.floor(new Date(dataISO).getTime() / 86400000)
  return CAPAS[dia % CAPAS.length]
}

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Palavras do título ou da descrição do plano → foto
const REGRAS: { termos: RegExp; foto: Foto; harvard?: boolean }[] = [
  { termos: /harvard|ll\.?m|mestrado|cambridge|pos-graduacao|pos graduacao/, foto: FOTOS.bostonCharles, harvard: true },
  { termos: /paralegal|advoga|juridic|direito/, foto: FOTOS.bostonRua }, // a placa "Swartz & Swartz Lawyers"
  { termos: /boston|massachusetts/, foto: FOTOS.bostonPorto },
  { termos: /nova york|new york|\bny\b|manhattan/, foto: FOTOS.novaYork },
  { termos: /disney|orlando/, foto: FOTOS.disney },
  { termos: /miami|florida/, foto: FOTOS.miami },
  { termos: /neve|aspen|esqui|ski|inverno|colorado/, foto: FOTOS.aspen },
  { termos: /filho|crianca|escola/, foto: FOTOS.neve },
  { termos: /dolar|cambio/, foto: FOTOS.dolar },
  { termos: /eua|estados unidos|america|visto|green card|mudanca|morar/, foto: FOTOS.bostonCentro },
]

/** Foto de um plano, pelo que ele fala. Planos em dólar sem pista ganham a bandeira; os outros, nenhuma. */
export function fotoDoPlano(p: { titulo: string; descricao?: string | null; moeda?: string }): { foto: Foto; harvard: boolean } | null {
  const texto = normalizar(`${p.titulo} ${p.descricao ?? ''}`)
  const regra = REGRAS.find(r => r.termos.test(texto))
  if (regra) return { foto: regra.foto, harvard: !!regra.harvard }
  return p.moeda === 'USD' ? { foto: FOTOS.bandeira, harvard: false } : null
}
