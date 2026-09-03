import { DIE_PALETTES, DieColorway } from './colorways'
import { DieStyle } from './kinds'

export const DIE_NUMERAL_PX = 256

export interface PaintDieNumeralOptions {
  scale?: number
  colorway?: DieColorway
  style?: DieStyle
  // Cube faces must be opaque; polyhedron labels stay punched out.
  opaque?: boolean
}

const FONT = '"Iowan Old Style", Palatino, "Times New Roman", serif'

export function paintDieNumeral(value: number, opts: PaintDieNumeralOptions = {}): HTMLCanvasElement {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Die numeral must be a positive integer, got ${value}`)
  }
  const scale = opts.scale ?? 1
  const pal = DIE_PALETTES[opts.colorway ?? 'ivory']
  const ornate = (opts.style ?? 'numeral') === 'ornate'
  const S = Math.round(DIE_NUMERAL_PX * scale)
  const canvas = document.createElement('canvas')
  canvas.width = S
  canvas.height = S
  const ctx = canvas.getContext('2d')!

  ctx.clearRect(0, 0, S, S)
  if (opts.opaque) {
    ctx.fillStyle = pal.face
    ctx.fillRect(0, 0, S, S)
  }
  const text = String(value)
  const px = (text.length === 1 ? 150 : 108) * scale
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 ${px}px ${FONT}`
  if (ornate) {
    ctx.strokeStyle = pal.accent
    ctx.lineWidth = 6 * scale
    ctx.strokeText(text, S / 2, S / 2 + 4 * scale)
  }
  ctx.fillStyle = pal.pip
  ctx.fillText(text, S / 2, S / 2 + 4 * scale)
  return canvas
}
