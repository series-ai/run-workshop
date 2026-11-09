// The UI kit (the cat editor's UI KIT tab, and Mochimon's export): screen-space speech, thought and shout bubbles with bold marks in them (! ? … a heart, a note), and a
// set of small pixel icons (hearts, coins, keys, arrows, play / pause...). Drawn as codes, painted with the palette:
//   bubbles: 0 empty, 1 outline, 2 fill, 3 mark (outline colour), 4 warm mark (a heart)
//   icons:   0 empty, 1 outline, 2 body, 3 shade, 4 shine

export interface Drawn { w: number; h: number; px: Uint8Array; anchor?: [number, number] }

// ---------------------------------------------------------------- bubbles

export const BUBBLE_SHAPES = ['speech', 'thought', 'shout'] as const
export type BubbleShape = typeof BUBBLE_SHAPES[number]

/** The marks: '#' outline-coloured, '@' warm (the heart). Two-pixel strokes so they read at sprite size. */
export const MARKS: Record<string, string[]> = {
  blank: ['     ', '     ', '     ', '     ', '     '],
  '!': ['##', '##', '##', '##', '  ', '##'],
  '?': [' ### ', '## ##', '   ##', '  ## ', '     ', '  ## '],
  '!?': ['##  ### ', '## ## ##', '##    ##', '##   ## ', '        ', '##   ## '],
  '...': ['## ## ##', '## ## ##'],
  heart: [' @@ @@ ', '@@@@@@@', '@@@@@@@', ' @@@@@ ', '  @@@  ', '   @   '],
  note: ['  ####', '  #  #', '  #  #', '###  #', '### ##', '    ##'],
  anger: [' # # ', '## ##', '     ', '## ##', ' # # '],
  sweat: ['  #  ', ' ### ', '#####', '#####', ' ### '],
  zzz: ['#### ', '  #  ', ' #   ', '#### ', '   ##', '   # ', '   ##'],
  star: ['  #  ', ' ### ', '#####', ' ### ', ' # # '],
}
export const MARK_NAMES = Object.keys(MARKS)

/** A bubble with a mark in it: its codes, and its anchor (the tip of its tail: put that on the speaker). */
export function drawBubble(shape: BubbleShape, mark: string): Drawn {
  const g = MARKS[mark] ?? MARKS.blank
  const gw = Math.max(...g.map((r) => r.length)), gh = g.length
  const bw = Math.max(gw + 8, 13), bh = Math.max(gh + 7, 12)
  const M = 4, TAIL = 6
  const w = bw + M * 2, h = bh + M * 2 + TAIL
  const x0 = M, y0 = M, cx = x0 + bw / 2 - 0.5, cy = y0 + bh / 2 - 0.5
  let inside: (x: number, y: number) => boolean
  let anchor: [number, number]
  if (shape === 'speech') {
    // a rounded box, a little pointed tail down and to the left
    const r = 3.5
    const box = (x: number, y: number) => {
      const dx = Math.max(x0 + r - x, 0, x - (x0 + bw - 1 - r)), dy = Math.max(y0 + r - y, 0, y - (y0 + bh - 1 - r))
      return x >= x0 && x < x0 + bw && y >= y0 && y < y0 + bh && dx * dx + dy * dy <= r * r
    }
    const tx = x0 + Math.round(bw * 0.3), tb = y0 + bh - 1
    const tail = (x: number, y: number) => { const v = y - tb; return v >= 0 && v <= TAIL - 1 && x >= tx - 2 - v * 0.6 && x <= tx + 2 - v * 1.1 }
    inside = (x, y) => box(x, y) || tail(x, y)
    anchor = [Math.round(tx - 2 - (TAIL - 1) * 0.6 + 1), tb + TAIL - 1]
  } else if (shape === 'thought') {
    // a puffy cloud (an oval with scalloped edges), trailing two little bubbles down to the left
    const rx = bw / 2, ry = bh / 2
    const puffs: [number, number, number][] = []
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2 + 0.3; puffs.push([cx + Math.cos(a) * (rx - 2.2), cy + Math.sin(a) * (ry - 2), 3.2]) }
    const p1: [number, number, number] = [x0 + bw * 0.28, y0 + bh + 1.6, 1.7], p2: [number, number, number] = [x0 + bw * 0.16, y0 + bh + 4.4, 1.1]
    inside = (x, y) => ((x - cx) / (rx - 3.2)) ** 2 + ((y - cy) / (ry - 3)) ** 2 <= 1 || [...puffs, p1, p2].some(([px, py, pr]) => Math.hypot(x - px, y - py) <= pr)
    anchor = [Math.round(p2[0]), Math.round(p2[1] + 2)]
  } else {
    // a shout: a jagged burst
    const N = 12, rx = bw / 2 + 0.5, ry = bh / 2 + 0.5
    const verts: [number, number][] = []
    for (let i = 0; i < N * 2; i++) { const a = (i / (N * 2)) * Math.PI * 2 + 0.1, k = i % 2 === 0 ? 1.18 : 0.9; verts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]) }
    inside = (x, y) => {
      let c = false
      for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
        const [xi, yi] = verts[i], [xj, yj] = verts[j]
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
      }
      return c || (((x - cx) / (rx * 0.9)) ** 2 + ((y - cy) / (ry * 0.9)) ** 2 <= 1)
    }
    anchor = [Math.round(cx - rx * 0.7), Math.round(cy + ry * 1.05)]
  }
  const px = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x, y)) px[y * w + x] = 2
  outline(px, w, h)
  // the mark, centred in the body of the bubble
  const mx = Math.round(cx - gw / 2 + 0.5), my = Math.round(cy - gh / 2 + 0.5)
  g.forEach((row, yy) => [...row].forEach((ch, xx) => { if (ch === '#' || ch === '@') px[(my + yy) * w + mx + xx] = ch === '@' ? 4 : 3 }))
  return { w, h, px, anchor }
}

/** Give every filled shape a one-pixel outline (code 1) round it. */
function outline(px: Uint8Array, w: number, h: number): void {
  const add: number[] = []
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (px[y * w + x] !== 0) continue
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const X = x + dx, Y = y + dy; return X >= 0 && Y >= 0 && X < w && Y < h && px[Y * w + X] > 1 })) add.push(y * w + x)
  }
  for (const i of add) px[i] = 1
}

// ---------------------------------------------------------------- icons

export type Tint = 'red' | 'gold' | 'blue' | 'green' | 'neutral'
/** '#' body, '+' shade, '*' shine; the outline is added round it. */
const RIGHT = ['    #    ', '    ##   ', '#######  ', '######## ', '#######  ', '    ##   ', '    #    ']
const flipX = (rows: string[]) => rows.map((r) => [...r].reverse().join(''))
const transpose = (rows: string[]) => { const w = Math.max(...rows.map((r) => r.length)); return Array.from({ length: w }, (_, x) => rows.map((r) => r[x] ?? ' ').join('')) }
export const ICONS: Record<string, { rows: string[]; tint: Tint }> = {
  heart: { tint: 'red', rows: [' ### ### ', '#*#######', '#########', '#########', ' ######+ ', '  ####+  ', '   ##+   ', '    #    '] },
  star: { tint: 'gold', rows: ['    #    ', '   ###   ', '   #*#   ', '#########', ' ####### ', '  ##+##  ', '  ## ##  ', ' ##   ## '] },
  coin: { tint: 'gold', rows: ['  #####  ', ' ####### ', '##+++++##', '##+*##+##', '##+###+##', '##+###+##', '##+++++##', ' ####### ', '  #####  '] },
  gem: { tint: 'blue', rows: ['  #####  ', ' #*##### ', '#########', ' #####++ ', '  ###++  ', '   #+#   ', '    #    '] },
  key: { tint: 'gold', rows: [' ###     ', '##*##    ', '#   #####', '## ## # #', ' ###     '] },
  lock: { tint: 'gold', rows: ['  ###  ', ' #   # ', ' #   # ', '#######', '#*#+###', '###+###', '#######'] },
  check: { tint: 'green', rows: ['       ##', '      ###', '##   ### ', '### ###  ', ' #####   ', '  ###    ', '   #     '] },
  cross: { tint: 'red', rows: ['##     ##', '###   ###', ' ### ### ', '  #####  ', '   ###   ', '  #####  ', ' ### ### ', '###   ###', '##     ##'] },
  plus: { tint: 'green', rows: ['   ###   ', '   ###   ', '#########', '#########', '#########', '   ###   ', '   ###   '] },
  minus: { tint: 'red', rows: ['#########', '#########', '#########'] },
  right: { tint: 'neutral', rows: RIGHT },
  left: { tint: 'neutral', rows: flipX(RIGHT) },
  down: { tint: 'neutral', rows: transpose(RIGHT) },
  up: { tint: 'neutral', rows: transpose(RIGHT).reverse() },
  play: { tint: 'green', rows: ['#     ', '###   ', '##### ', '######', '##### ', '###   ', '#     '] },
  pause: { tint: 'neutral', rows: ['### ###', '### ###', '### ###', '### ###', '### ###', '### ###', '### ###'] },
  gear: { tint: 'neutral', rows: ['   ###   ', ' # ### # ', '  #####  ', '###   ###', '###   ###', '###   ###', '  #####  ', ' # ### # ', '   ###   '] },
  home: { tint: 'neutral', rows: ['    #    ', '   ###   ', '  #####  ', ' ####### ', '#########', ' ###+### ', ' ###+### ', ' ###+### '] },
  clock: { tint: 'neutral', rows: ['  #####  ', ' ####### ', '####+####', '####+####', '####++###', '#########', ' ####### ', '  #####  '] },
  potion: { tint: 'red', rows: ['   ##   ', '   ##   ', '  ####  ', ' #*#### ', '########', '##++++##', '##++++##', ' ###### '] },
  sword: { tint: 'neutral', rows: ['       ##', '      ###', '     ### ', '    ###  ', '#  ###   ', ' ####    ', '  ##     ', ' # ##    ', '#   #    '] },
  shield: { tint: 'blue', rows: ['#########', '#*#######', '####+####', '####+####', ' ###+### ', '  ##+##  ', '   ###   ', '    #    '] },
  mail: { tint: 'neutral', rows: ['#########', '#+#####+#', '##+###+##', '###+#+###', '####+####', '#########'] },
  info: { tint: 'blue', rows: ['  #####  ', ' ###+### ', '#########', '###++####', '####+####', '####+####', ' ##+++## ', '  #####  '] },
  bag: { tint: 'gold', rows: ['   ###   ', '  #   #  ', ' ####### ', '#########', '####+####', '#########', '#########', ' ####### '] },
  trophy: { tint: 'gold', rows: ['#########', '#*#####+#', ' ####### ', '  #####  ', '   ###   ', '    #    ', '   ###   ', '  #####  '] },
  bolt: { tint: 'gold', rows: ['    ###', '   ### ', '  ###  ', ' ######', '   ### ', '  ###  ', ' ###   ', '##     '] },
  fire: { tint: 'red', rows: ['    #    ', '   ##    ', '  ####   ', '  ##### #', ' ####### ', '###+++###', '##+++++##', ' ##+++## ', '  #####  '] },
  flag: { tint: 'red', rows: ['#####   ', '########', '#####   ', '#       ', '#       ', '#       ', '#       '] },
  pin: { tint: 'red', rows: ['  ###  ', ' ##### ', '##*####', '###+###', ' ##### ', '  ###  ', '   #   '] },
  music: { tint: 'neutral', rows: ['   #####', '   #   #', '   #   #', ' ###  ##', '####  ##', ' ##     '] },
  search: { tint: 'neutral', rows: [' ####   ', '##  ##  ', '#    #  ', '##  ##  ', ' #####  ', '    ### ', '     ###', '      ##'] },
}
export const ICON_NAMES = Object.keys(ICONS)

export function drawIcon(name: string): Drawn {
  const { rows } = ICONS[name]
  const iw = Math.max(...rows.map((r) => r.length)), ih = rows.length
  const w = iw + 2, h = ih + 2
  const px = new Uint8Array(w * h)
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== ' ') px[(y + 1) * w + x + 1] = ch === '+' ? 3 : ch === '*' ? 4 : 2 }))
  outline(px, w, h)
  return { w, h, px }
}

// ---------------------------------------------------------------- colour

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
function hueSat(h: string): [number, number] {
  const [r, g, b] = rgb(h).map((v) => v / 255)
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
  if (d === 0) return [0, 0]
  const hue = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [hue * 60, d / (1 - Math.abs(mx + mn - 1) || 1)]
}
const TARGET: Record<Exclude<Tint, 'neutral'>, number> = { red: 355, gold: 45, blue: 215, green: 110 }
/** The palette ramp that best matches a tint (the first ramp for neutral, or when nothing's colourful enough). */
export function tintRamp(ramps: string[][], tint: Tint): number {
  if (tint === 'neutral' || ramps.length < 2) return 0
  let best = -1, bestD = Infinity
  ramps.forEach((r, i) => {
    if (i === 0) return
    const [hu, sa] = hueSat(r[Math.floor(r.length / 2)])
    if (sa < 0.25) return
    // near the hue, and colourful: a washed-out ramp (32 colours has pale two-shade copies) loses to a vivid one
    const d = Math.min(Math.abs(hu - TARGET[tint]), 360 - Math.abs(hu - TARGET[tint])) + (1 - sa) * 40
    if (d < bestD) { bestD = d; best = i }
  })
  return best < 0 ? 1 : best
}

// ---------------------------------------------------------------- painting

/** The palette a kit is painted with: one-bit (ink + paper), or an outline and the mode's ramps (lightest first). */
export interface KitPalette { mode: number; outline: string; paper: string; ramps: string[][] }
/** The colour of each code: bubbles 1 outline, 2 fill, 3 mark, 4 warm mark; icons 1 outline, 2 body, 3 shade, 4 shine. */
export function kitColours(p: KitPalette, kind: 'bubble' | 'icon', icon?: string): (number[] | null)[] {
  const ink = rgb(p.outline)
  if (p.mode === 2 || p.ramps.length === 0) {
    const paper = rgb(p.paper)
    return kind === 'bubble' ? [null, ink, paper, ink, ink] : [null, ink, paper, ink, paper]
  }
  const r0 = p.ramps[0]
  const light = rgb(r0[0])
  if (kind === 'bubble') { const red = p.ramps[tintRamp(p.ramps, 'red')]; return [null, ink, light, ink, rgb(red[Math.floor(red.length / 2)])] }
  const t = ICONS[icon!].tint
  const r = p.ramps[tintRamp(p.ramps, t)]
  const body = t === 'neutral' ? r0[Math.min(r0.length - 1, Math.floor(r0.length / 2))] : r[Math.floor((r.length - 1) / 2)]
  return [null, rgb(p.outline), rgb(body), rgb(r[r.length - 1]), light]
}
/** Paint a drawn item as RGBA (w * h * 4). */
export function paintKit(d: Drawn, cols: (number[] | null)[]): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(new ArrayBuffer(d.w * d.h * 4))
  for (let i = 0; i < d.w * d.h; i++) { const c = cols[d.px[i]]; if (!c) continue; out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; out[i * 4 + 3] = 255 }
  return out
}
