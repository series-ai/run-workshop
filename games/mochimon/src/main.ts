// Mochimon: build a character (body, ears, coat, hats, clothes, ...), watch it move, pick a palette, and bake it out
// as a sprite sheet for any game. The character is a small 3D model, ray-marched to pixel art in the browser
// (src/model/cat-model.ts). Geometry is the slow part and is cached;
// colour is painted on top, so palette changes are instant.
//
// Export: one zip with <name>.png (the sheet in the chosen colours: a row per animation and direction, frames left to
// right, every cell the same size, the feet on the same spot), <name>.roles.png (the same sheet as role codes, to
// recolour at runtime) and <name>.json (frame size, anchor, rows, timing, palette).

import { CLEAR, INK } from './model/bitmap.ts'
import { GAME_SPLITS, modePalette } from './model/palette.ts'
import { ACCESSORIES, ANIMS, BODIES, CLOTHES, COATS, EARS, EYEWEAR, FEET, ROLE_NAMES, ROLES, TAILS, MOODS, THEMES, type ColorMode, type Role } from './model/cat-model.ts'
import type { Done, Job, Sel } from './render-worker.ts'
import { BUBBLE_SHAPES, drawBubble, drawIcon, ICON_NAMES, kitColours as paletteKitColours, MARK_NAMES, type Drawn } from './model/ui-kit.ts'
import { zip } from './zip.ts'

// thumbnails: a frame with room for tall hats; the big preview: room all round for the attack effects
const FW = 50
const FH = 58
const FEET_ROW = 47
const PW = 88
const PH = 72
const P_FEET = 57
const SPIN = 32
const WALK = 8

type Mode = 'spin' | 'walk' | 'walk side' | 'faces' | keyof typeof ANIMS
const state = { coat: 0, gear: 0, clothes: 0, ears: EARS.indexOf('cat'), feet: 0, body: 0, eyes: 0, tail: TAILS.indexOf('swoop'), mode: 'walk' as Mode, t: 0, paused: false, manual: null as number | null, view: 0 }

const $ = (id: string) => document.getElementById(id)!
/** The preview frame last put on the canvases (repainted only when it changes). */
let lastShown: ImageData | null = null
const big = $('big') as HTMLCanvasElement
const small = $('small') as HTMLCanvasElement

/** The look on show, as list indices (what the render workers build it from). */
const sel = (): Sel => ({ coat: state.coat, gear: state.gear, clothes: state.clothes, ears: state.ears, feet: state.feet, body: state.body, eyes: state.eyes, tail: state.tail })

// ---- colour: 2 = one-bit; 4..16 paint with an editable palette (outline (+ eye) and a few ramps; each part of the
// cat picks a ramp)
const colors = {
  mode: 16 as ColorMode, theme: 'TOKYO', ver: 0,
  outline: '#1a1917', eye: '#1a1917', ramps: [] as string[][],
  paper: '#eceae2',
  assign: { fur: 0, mark: 1, accent: 2, gear: 2, gearLight: 3, clothes: 4 } as Record<Role, number>,
}
// 1x is the smallest cat; 1.25x and 1.5x draw the same cat with more pixels and a rounder head
let catK = 1
const even = (n: number) => Math.round(n / 2) * 2
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
function setTheme(name: string): void {
  colors.theme = name
  const t = THEMES[name]
  colors.outline = t.outline
  colors.paper = t.ramps[0][0]
  if (colors.mode !== 2) {
    // the same palette Sushi Cat draws with for this mode (32 goes wide: ten ramps of three shades)
    const mp = modePalette(t, colors.mode, { ink: t.outline, paper: t.ramps[0][0] })
    colors.eye = mp.eye
    colors.ramps = mp.ramps.map((r) => [...r])
    colors.assign = { ...mp.cat }
  }
  colors.ver++
}

// ---- geometry: the ray-march is slow, so it runs in a pool of workers off the page's thread (src/render-worker.ts),
// the frame on show first. The page keeps the results and only paints them, which is cheap.
interface Geo { w: number; h: number; px: Uint8Array; codes: Record<number, Uint8Array>; bottom: number; k: number; wide: boolean; img?: ImageData; imgKey?: string }
const at = (g: Geo, x: number, y: number) => (x < 0 || y < 0 || x >= g.w || y >= g.h ? CLEAR : g.px[y * g.w + x])
type Pending = { key: string; job: Job; prio: number; tag: 'preview' | 'thumb' | 'export'; resolve: (g: Geo) => void }
const pool = (() => {
  const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1))
  const workers = Array.from({ length: n }, () => new Worker(new URL('./render-worker.ts', import.meta.url), { type: 'module' }))
  const idle = [...workers]
  const queue: Pending[] = []
  const inflight = new Map<number, Pending>()
  const waiting = new Map<string, Promise<Geo>>()
  let nextId = 1
  const pump = () => {
    while (idle.length > 0 && queue.length > 0) {
      let best = 0
      for (let i = 1; i < queue.length; i++) if (queue[i].prio < queue[best].prio) best = i
      const p = queue.splice(best, 1)[0]
      const w = idle.pop()!, id = nextId++
      inflight.set(id, p)
      w.onmessage = (e: MessageEvent<{ id: number; done: Done }>) => {
        const q = inflight.get(e.data.id)!
        inflight.delete(e.data.id)
        waiting.delete(q.key)
        const d = e.data.done
        const wide = q.job.kind === 'motion' ? true : q.job.wide
        q.resolve({ w: d.w, h: d.h, px: d.px, codes: d.codes, bottom: d.bottom, k: q.job.k, wide })
        idle.push(w)
        pump()
      }
      w.postMessage({ id, job: p.job })
    }
  }
  return {
    /** Render a frame (once per key): the lower `prio`, the sooner. */
    get(key: string, job: Job, prio: number, tag: Pending['tag']): Promise<Geo> {
      const hit = waiting.get(key)
      if (hit) { const q = queue.find((x) => x.key === key); if (q && prio < q.prio) q.prio = prio; return hit }
      const pr = new Promise<Geo>((resolve) => { queue.push({ key, job, prio, tag, resolve }); pump() })
      waiting.set(key, pr)
      return pr
    },
    /** Forget queued (not yet started) work of a kind: the look changed, so those frames aren't wanted now. */
    drop(tag: Pending['tag']): void {
      for (let i = queue.length - 1; i >= 0; i--) if (queue[i].tag === tag) { waiting.delete(queue[i].key); queue.splice(i, 1) }
    },
    busy: () => queue.length + inflight.size,
  }
})()
/** The colour of every role code (0 outline, 1 eye, 2 + role * 8 + shade) in the current palette. */
function codeColours(): number[][] {
  const sp = colors.mode === 2 ? null : GAME_SPLITS[colors.mode]
  const pal: number[][] = sp === null ? [hex(colors.outline), hex(colors.paper)] : [hex(colors.outline), hex(sp.eye ? colors.eye : colors.outline)]
  if (sp !== null) ROLES.forEach((r, ri) => colors.ramps[colors.assign[r]].forEach((c, k) => { pal[2 + ri * 8 + k] = hex(c) }))
  return pal
}
/** Where a frame's bitmap sits in its cell: centred, the feet on the feet row (`bottom` pins them for hops). */
function placement(g: Geo, bottom: number): { fw: number; fh: number; ox: number; oy: number } {
  const fw = even((g.wide ? PW : FW) * g.k), fh = even((g.wide ? PH : FH) * g.k)
  return { fw, fh, ox: Math.floor((fw - g.w) / 2), oy: Math.round((g.wide ? P_FEET : FEET_ROW) * g.k) - bottom }
}
/** Paint cached geometry into its frame in the current colours (with the drop shadow in the outline colour). */
function image(g: Geo, bottom = g.bottom): ImageData {
  const key = `${colors.mode}|${colors.ver}|${bottom}`
  if (g.img !== undefined && g.imgKey === key) return g.img
  const { fw, fh, ox, oy } = placement(g, bottom)
  const img = new ImageData(fw, fh)
  const sp = colors.mode === 2 ? null : GAME_SPLITS[colors.mode]
  const idx = sp === null ? null : g.codes[sp.shades]
  const pal = codeColours()
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
    const bx = x - ox, by = y - oy
    const v = at(g, bx, by)
    let c: number[] | null = null
    if (v !== CLEAR) c = idx === null ? (v === INK ? pal[0] : pal[1]) : pal[idx[by * g.w + bx]] ?? pal[0]
    else if (at(g, bx - 1, by - 1) !== CLEAR) c = pal[0]
    if (c === null) continue
    const i = (y * fw + x) * 4
    img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255
  }
  g.img = img
  g.imgKey = key
  return img
}

// ---- the motions
const VIEW_STEP = (Math.PI * 2) / 16
// the motions in three groups: what most games need, fighting, and everything else
const BASICS: Mode[] = ['idle', 'walk', 'walk side', 'run', 'jump', 'sit', 'lie down', 'pick up', 'eat', 'celebrate', 'hurt', 'death', 'spin', 'faces']
const ATTACKS: Mode[] = ['slash', 'swipe', 'punch', 'one-two', 'spear', 'fireball', 'beam', 'sweep', 'shoot', 'knockback', 'faceplant', 'slashed', 'shot']
const ALL_MODES: Mode[] = ['spin', 'walk', 'walk side', 'faces', ...(Object.keys(ANIMS) as Mode[])]
const GROUPS: [string, Mode[]][] = [
  ['BASICS', BASICS.filter((m) => ALL_MODES.includes(m))],
  ['ATTACKS', ATTACKS.filter((m) => ALL_MODES.includes(m))],
  ['MORE', ALL_MODES.filter((m) => !BASICS.includes(m) && !ATTACKS.includes(m))],
]
const MODES: Mode[] = GROUPS.flatMap(([, ms]) => ms)
const frameCount = (m: Mode) => (m === 'spin' ? SPIN : m === 'faces' ? MOODS.length : m in ANIMS ? ANIMS[m].frames : WALK)
/** Frame i of a motion for a look, turned `v` radians from the motion's own angle. */
const motionJob = (l: Sel, m: Mode, i: number, v: number, k: number): Job => ({ kind: 'motion', sel: l, mode: m, i, v, k })
const selKey = (l: Sel) => `${l.coat}|${l.gear}|${l.clothes}|${l.ears}|${l.feet}|${l.body}|${l.eyes}|${l.tail}`

const cache = new Map<string, (Geo | null)[]>()
const combo = () => `${catK}|${state.coat}|${state.gear}|${state.clothes}|${state.ears}|${state.feet}|${state.body}|${state.eyes}|${state.tail}`
function frames(): (Geo | null)[] {
  const k = `${combo()}|${state.mode}|${state.mode === 'spin' ? 0 : state.view}`
  if (!cache.has(k)) cache.set(k, Array(frameCount(state.mode)).fill(null))
  return cache.get(k)!
}
/** The character standing still: where its feet are fixes the feet row for every frame, so hops show. */
const rests = new Map<string, Geo>()
function rest(): Geo | null {
  const k = `${combo()}|rest`
  const hit = rests.get(k)
  if (hit) return hit
  void pool.get(k, { kind: 'still', sel: sel(), angle: 0, k: catK, wide: true }, 0, 'preview').then((g) => rests.set(k, g))
  return null
}
function current(n: number): number {
  if (state.manual !== null && state.mode === 'spin') return ((state.manual % n) + n) % n
  return Math.floor(state.t) % n
}
let lastCombo = ''
function work(): void {
  // a new look or motion: drop the queued frames for the old one
  const key = `${combo()}|${state.mode}|${state.view}`
  if (key !== lastCombo) { pool.drop('preview'); lastCombo = key }
  rest()
  const f = frames()
  const want = current(f.length)
  const v = state.mode === 'spin' ? 0 : state.view * VIEW_STEP, l = sel(), base = `${combo()}|${state.mode}|${state.mode === 'spin' ? 0 : state.view}`
  // the frame on show first, then the ones after it in play order
  for (let d = 0; d < f.length; d++) {
    const i = (want + d) % f.length
    if (f[i] !== null) continue
    void pool.get(`${base}|${i}`, motionJob(l, state.mode, i, v, catK), d === 0 ? 1 : 2 + d * 0.01, 'preview').then((g) => { f[i] = g })
  }
  thumbWork()
}

// ---- the picker thumbnails, cached forever by what's in them; the ones on screen draw first
const thumbGeo = new Map<string, Geo>()
const thumbQueue: [string, Job, HTMLCanvasElement][] = []
function thumbGrid(id: string, names: string[], keyOf: (i: number) => string, job: (i: number) => Job, on: (i: number) => boolean, set: (i: number) => void): void {
  const el = $(id)
  el.innerHTML = ''
  names.forEach((name, i) => {
    const fig = document.createElement('figure')
    if (on(i)) fig.className = 'on'
    const c = document.createElement('canvas')
    c.width = FW; c.height = FH
    c.style.width = FW * 2 + 'px'; c.style.height = FH * 2 + 'px'
    c.className = 'sk'
    fig.append(c, Object.assign(document.createElement('figcaption'), { textContent: name }))
    fig.onclick = () => { set(i); refresh() }
    el.append(fig)
    const k = keyOf(i)
    const hit = thumbGeo.get(k)
    if (hit !== undefined) { c.getContext('2d')!.putImageData(image(hit), 0, 0); c.className = '' }
    else thumbQueue.push([k, job(i), c])
  })
}
/** Hand the thumbnails to the pool behind the preview, the ones on screen first. */
function thumbWork(): void {
  const vh = window.innerHeight
  for (let n = thumbQueue.length - 1; n >= 0; n--) {
    const [k, job, c] = thumbQueue[n]
    const r = c.getBoundingClientRect()
    const onScreen = r.height > 0 && r.bottom > 0 && r.top < vh
    thumbQueue.splice(n, 1)
    void pool.get(`thumb|${k}`, job, onScreen ? 10 : 20 + n * 0.001, 'thumb').then((g) => { thumbGeo.set(k, g); c.getContext('2d')!.putImageData(image(g), 0, 0); c.className = '' })
  }
}
const IDX = (list: readonly string[] | [string, unknown][], name: string) => list.findIndex((x) => (Array.isArray(x) ? x[0] : x) === name)
const BLANK: Sel = { coat: 0, gear: 0, clothes: 0, ears: EARS.indexOf('cat'), feet: 0, body: 0, eyes: 0, tail: TAILS.indexOf('swoop') }
const snap = (over: Partial<Sel>, angle = 0): Job => ({ kind: 'still', sel: { ...BLANK, ...over }, angle, k: 1, wide: false })

// ---- chips and the palette panel
function chips(id: string | HTMLElement, names: string[], on: (i: number) => boolean | 'part', set: (i: number) => void): void {
  const el = typeof id === 'string' ? $(id) : id
  el.innerHTML = ''
  names.forEach((n, i) => {
    const b = document.createElement('button')
    const o = on(i)
    b.className = 'chip' + (o === 'part' ? ' part' : o ? ' on' : '')
    b.textContent = n
    b.onclick = () => { set(i); refresh() }
    el.append(b)
  })
}
const COLOR_MODES: ColorMode[] = [2, 4, 8, 16, 32]
function paletteUI(): void {
  chips('colorModes', COLOR_MODES.map((m) => (m === 2 ? '2 (ONE-BIT)' : `${m} COLOURS`)), (i) => COLOR_MODES[i] === colors.mode, (i) => { colors.mode = COLOR_MODES[i]; setTheme(colors.theme) })
  const themes = Object.keys(THEMES)
  chips('themes', themes, (i) => themes[i] === colors.theme, (i) => setTheme(themes[i]))
  const sw = $('swatches')
  const asg = $('assign')
  sw.innerHTML = ''
  asg.innerHTML = ''
  const picker = (value: string, onChange: (v: string) => void) => {
    const inp = document.createElement('input')
    inp.type = 'color'
    inp.value = value
    inp.onchange = () => { onChange(inp.value); colors.ver++; refresh() }
    return inp
  }
  const b = (text: string) => Object.assign(document.createElement('b'), { textContent: text })
  $('assignHead').style.display = colors.mode === 2 ? 'none' : ''
  if (colors.mode === 2) {
    const row = document.createElement('div')
    row.className = 'rampRow'
    row.append(b('INK'), picker(colors.outline, (v) => { colors.outline = v }), b('PAPER'), picker(colors.paper, (v) => { colors.paper = v }))
    sw.append(row)
    return
  }
  const sp = GAME_SPLITS[colors.mode]
  const fixed = document.createElement('div')
  fixed.className = 'rampRow'
  fixed.append(b('OUTLINE'), picker(colors.outline, (v) => { colors.outline = v }))
  if (sp.eye) fixed.append(b('EYES'), picker(colors.eye, (v) => { colors.eye = v }))
  sw.append(fixed)
  colors.ramps.forEach((r, ri) => {
    const row = document.createElement('div')
    row.className = 'rampRow'
    row.append(b('RAMP ' + 'ABCDEF'[ri]))
    r.forEach((c, k) => row.append(picker(c, (v) => { colors.ramps[ri][k] = v })))
    sw.append(row)
  })
  for (const role of ['fur', 'mark', 'accent', 'gear', 'gearLight', 'clothes'] as Role[]) {
    const row = document.createElement('div')
    row.className = 'assignRow'
    row.append(b(ROLE_NAMES[role]))
    colors.ramps.forEach((r, ri) => {
      const btn = document.createElement('button')
      btn.className = 'rampBtn' + (colors.assign[role] === ri ? ' on' : '')
      btn.title = 'RAMP ' + 'ABCDEF'[ri]
      for (const c of r) btn.append(Object.assign(document.createElement('i'), { style: `background:${c}` }))
      btn.onclick = () => { colors.assign[role] = ri; colors.ver++; refresh() }
      row.append(btn)
    })
    asg.append(row)
  }
}

// ---- export settings
const DIRS = [1, 4, 8]
const exp = { anims: new Set<Mode>(['idle', 'walk', 'run', 'celebrate'].filter((m) => MODES.includes(m as Mode)) as Mode[]), dirs: 1 }
/** Grouped chips, a row per group (the export's PICK EACH drawer and the preview's PLAYING list share it). */
function groupedChips(id: string, cls: string, on: (m: Mode) => boolean, set: (m: Mode) => void): void {
  const el = $(id)
  el.innerHTML = ''
  for (const [name, ms] of GROUPS) {
    const row = document.createElement('div')
    row.className = cls
    const list = document.createElement('div')
    list.className = 'chips'
    row.append(Object.assign(document.createElement(cls === 'grp' ? 'h2' : 'span'), { textContent: name, className: cls === 'grp' ? '' : 'note' }), list)
    el.append(row)
    chips(list, ms.map((m) => m.toUpperCase()), (i) => on(ms[i]), (i) => set(ms[i]))
  }
}
function exportUI(): void {
  // the presets: a group is on when all of it is picked, half-filled when some is; clicking adds it all (or takes it off)
  const presets: [string, Mode[]][] = [...GROUPS, ['ALL', MODES]]
  chips('exGroups', presets.map(([n]) => n), (i) => {
    const ms = presets[i][1], k = ms.filter((m) => exp.anims.has(m)).length
    return k === ms.length ? true : k > 0 ? 'part' : false
  }, (i) => {
    const ms = presets[i][1]
    if (ms.every((m) => exp.anims.has(m))) ms.forEach((m) => exp.anims.delete(m))
    else ms.forEach((m) => exp.anims.add(m))
  })
  groupedChips('exAnims', 'grp', (m) => exp.anims.has(m), (m) => { if (exp.anims.has(m)) exp.anims.delete(m); else exp.anims.add(m) })
  chips('exDirs', DIRS.map((d) => (d === 1 ? 'AS SHOWN' : `${d} WAYS`)), (i) => DIRS[i] === exp.dirs, (i) => { exp.dirs = DIRS[i] })
  const picked = MODES.filter((m) => exp.anims.has(m))
  const n = picked.reduce((s, m) => s + frameCount(m) * (m === 'spin' ? 1 : exp.dirs), 0)
  if (!exporting && !justSaved) $('exStatus').textContent = n === 0 ? 'pick some animations' : `${picked.length} animation${picked.length === 1 ? '' : 's'}, ${n} frames`
  ;($('exGo') as HTMLButtonElement).disabled = exporting || n === 0
}
/** The status line keeps a "saved" message up until the next change. */
let justSaved = false
$('exPick').onclick = () => {
  const open = $('exDrawer').classList.toggle('open')
  $('exPick').classList.toggle('on', open)
  $('exPick').setAttribute('aria-expanded', String(open))
  $('exPick').textContent = open ? 'PICK EACH ▴' : 'PICK EACH ▾'
}
$('exView').onclick = () => ($('sheetDlg') as HTMLDialogElement).showModal()
$('sheetClose').onclick = () => ($('sheetDlg') as HTMLDialogElement).close()
$('sheetDlg').onclick = (e) => { if (e.target === $('sheetDlg')) ($('sheetDlg') as HTMLDialogElement).close() }
$('exAll').onclick = () => { MODES.forEach((m) => exp.anims.add(m)); refresh() }
$('exNone').onclick = () => { exp.anims.clear(); refresh() }

const CAT_SIZES = [1, 1.25, 1.5]
function refresh(): void {
  justSaved = false
  chips('catSizes', CAT_SIZES.map((k) => `${k}X`), (i) => CAT_SIZES[i] === catK, (i) => { catK = CAT_SIZES[i]; size() })
  paletteUI()
  exportUI()
  groupedChips('modes', 'modeGrp', (m) => m === state.mode, (m) => { state.mode = m; state.manual = null })
  thumbQueue.length = 0
  pool.drop('thumb')
  const on = (n: number) => (i: number) => i === n
  const NONE_TAIL = TAILS.indexOf('none')
  thumbGrid('bodies', BODIES.map((b) => b.toUpperCase()), (i) => `body|${i}`, (i) => snap({ clothes: IDX(CLOTHES, 'STRIPED TOP'), body: i }, -0.5), on(state.body), (i) => { state.body = i })
  thumbGrid('ears', EARS.map((e) => e.toUpperCase()), (i) => `ears|${i}`, (i) => snap({ tail: NONE_TAIL, ears: i }, -0.4), on(state.ears), (i) => { state.ears = i })
  thumbGrid('coats', COATS.map(([n]) => n), (i) => `coat|${i}`, (i) => snap({ coat: i }), on(state.coat), (i) => { state.coat = i })
  thumbGrid('gear', ACCESSORIES.map(([n]) => n), (i) => `gear|${i}`, (i) => snap({ gear: i }), on(state.gear), (i) => { state.gear = i })
  thumbGrid('eyewear', EYEWEAR.map(([n]) => n), (i) => `eyes|${i}`, (i) => snap({ eyes: i }, -0.3), on(state.eyes), (i) => { state.eyes = i })
  thumbGrid('clothes', CLOTHES.map(([n]) => n), (i) => `clothes|${i}`, (i) => snap({ clothes: i }, -0.6), on(state.clothes), (i) => { state.clothes = i })
  thumbGrid('feet', FEET.map((f) => f.toUpperCase()), (i) => `feet|${i}`, (i) => snap({ tail: NONE_TAIL, feet: i }, -0.6), on(state.feet), (i) => { state.feet = i })
  thumbGrid('tails', TAILS.map((t) => t.toUpperCase()), (i) => `tail|${i}`, (i) => snap({ tail: i }, 2.4), on(state.tail), (i) => { state.tail = i })
}

// ---- the export: render every frame, crop them all to one shared cell, pack, zip
let exporting = false
const pause = () => new Promise<void>((r) => setTimeout(r, 0))
const pngOf = (c: HTMLCanvasElement) => new Promise<Uint8Array>((res) => c.toBlob(async (b) => res(new Uint8Array(await b!.arrayBuffer())), 'image/png'))
async function exportSheet(): Promise<void> {
  exporting = true
  justSaved = false
  const go = $('exGo')
  go.textContent = 'EXPORTING...'
  exportUI()
  const status = $('exStatus')
  const bar = $('exBar')
  bar.style.width = '0'
  status.textContent = 'starting...'
  const l = sel(), k = catK
  let restG = rest()
  while (restG === null) { await new Promise((res) => setTimeout(res, 50)); restG = rest() }
  // the rows: each animation in each direction (a turnaround already shows every side, so it gets one row)
  const rows: { mode: Mode; dir: number; dirs: number; v: number }[] = []
  for (const m of MODES) {
    if (!exp.anims.has(m)) continue
    const n = m === 'spin' ? 1 : exp.dirs
    for (let d = 0; d < n; d++) rows.push({ mode: m, dir: d, dirs: n, v: (m === 'spin' ? 0 : state.view * VIEW_STEP) + (d / n) * Math.PI * 2 })
  }
  const total = rows.reduce((s, r) => s + frameCount(r.mode), 0)
  // every frame through the worker pool, all at once (in parallel), behind the live preview
  let done = 0
  const geos: Geo[][] = await Promise.all(rows.map((r, ri) => Promise.all(Array.from({ length: frameCount(r.mode) }, (_, i) =>
    pool.get(`export|${selKey(l)}|${k}|${r.mode}|${r.v.toFixed(4)}|${i}`, motionJob(l, r.mode, i, r.v, k), 5 + ri * 0.01, 'export').then((g) => { done++; status.textContent = `rendering ${done}/${total} frames...`; bar.style.width = `${(done / total) * 95}%`; return g })))))
  status.textContent = 'packing...'
  await pause()
  // one cell for every frame: the union of what every frame covers, so nothing jumps between them
  const bottom = restG.bottom
  const imgs = geos.map((row) => row.map((g) => image(g, bottom)))
  const fw = imgs[0][0].width, fh = imgs[0][0].height
  let x0 = fw, y0 = fh, x1 = -1, y1 = -1
  for (const row of imgs) for (const im of row) for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (im.data[(y * fw + x) * 4 + 3] !== 0) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
  x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1); x1 = Math.min(fw - 1, x1 + 1); y1 = Math.min(fh - 1, y1 + 1)
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1
  const cols = Math.max(...geos.map((r) => r.length))
  const sheet = document.createElement('canvas')
  sheet.width = cw * cols; sheet.height = ch * rows.length
  const roles = document.createElement('canvas')
  roles.width = sheet.width; roles.height = sheet.height
  const sg = sheet.getContext('2d')!, rg = roles.getContext('2d')!
  const roleData = rg.createImageData(roles.width, roles.height)
  geos.forEach((row, ri) => row.forEach((g, fi) => {
    sg.putImageData(imgs[ri][fi], fi * cw - x0, ri * ch - y0, x0, y0, cw, ch)
    // the role map: the same pixels as codes (0 outline, 1 eye, 2 + role * 8 + shade at five shades, 0 lightest)
    const codes = g.codes[5]
    const { ox, oy } = placement(g, bottom)
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const fx = x + x0, fy = y + y0
      if (imgs[ri][fi].data[(fy * fw + fx) * 4 + 3] === 0) continue
      const bx = fx - ox, by = fy - oy
      const inside = at(g, bx, by) !== CLEAR
      const code = inside ? codes[by * g.w + bx] : 0 // the drop shadow is outline
      const o = ((ri * ch + y) * roles.width + fi * cw + x) * 4
      roleData.data[o] = code === 255 ? 0 : code
      roleData.data[o + 3] = 255
    }
  }))
  rg.putImageData(roleData, 0, 0)
  const name = (($('exName') as HTMLInputElement).value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-') || 'cat')
  const fps = Math.max(1, Math.min(60, Number(($('exFps') as HTMLInputElement).value) || 12))
  const pick = <T,>(list: [string, T][], i: number) => list[i][0]
  const meta = {
    generator: 'Mochimon',
    image: `${name}.png`,
    roles: `${name}.roles.png`,
    frameWidth: cw,
    frameHeight: ch,
    columns: cols,
    rows: rows.length,
    // where the cat stands in every cell: the middle of its feet
    anchor: { x: Math.floor(fw / 2) - x0, y: Math.round(P_FEET * k) - y0 },
    fps,
    animations: rows.map((r, ri) => ({
      name: r.dirs > 1 ? `${r.mode}-${r.dir}` : r.mode,
      motion: r.mode,
      direction: r.dir,
      directions: r.dirs,
      row: ri,
      frames: geos[ri].length,
      loop: true,
    })),
    look: {
      size: `${k}x`, body: BODIES[state.body], ears: EARS[state.ears], coat: pick(COATS, state.coat), hat: pick(ACCESSORIES, state.gear),
      eyewear: pick(EYEWEAR, state.eyes), clothes: pick(CLOTHES, state.clothes), feet: FEET[state.feet], tail: TAILS[state.tail],
    },
    palette: colors.mode === 2
      ? { colours: 2, ink: colors.outline, paper: colors.paper }
      : { colours: colors.mode, theme: colors.theme, outline: colors.outline, eye: GAME_SPLITS[colors.mode].eye ? colors.eye : colors.outline, ramps: colors.ramps, assign: colors.assign },
    roleMap: {
      format: 'red channel = code, alpha 0 = empty',
      codes: '0 outline, 1 eye, 2 + role * 8 + shade (shade 0 lightest .. 4 darkest)',
      roles: ROLES,
    },
  }
  const readme = `${name}: made with Mochimon

${name}.png        the sprite sheet, ${cols} x ${rows.length} cells of ${cw} x ${ch} px. One row per animation (and
                   direction), frames left to right. Every cell is the same size and the cat's feet are at the
                   same spot in all of them: anchor (${meta.anchor.x}, ${meta.anchor.y}) from a cell's top-left.
${name}.roles.png  the same sheet with each pixel's part as a code in the red channel (0 outline, 1 eye,
                   2 + role * 8 + shade; roles: ${ROLES.join(', ')}; shades 0 lightest to 4 darkest).
                   Paint it through any palette to recolour the cat at runtime.
${name}.json       frame size, anchor, rows (animation, direction, frame count), fps, the palette and the look.

Draw frame f of row r from (f * ${cw}, r * ${ch}), ${cw} x ${ch}. Scale by whole numbers with smoothing off.
`
  const enc = new TextEncoder()
  const blob = zip([
    { name: `${name}.png`, data: await pngOf(sheet) },
    { name: `${name}.roles.png`, data: await pngOf(roles) },
    { name: `${name}.json`, data: enc.encode(JSON.stringify(meta, null, 2) + '\n') },
    { name: 'README.txt', data: enc.encode(readme) },
  ])
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${name}-sprites.zip`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10000)
  // show what was made
  const show = $('exSheet') as HTMLCanvasElement
  show.width = sheet.width; show.height = sheet.height
  show.getContext('2d')!.drawImage(sheet, 0, 0)
  show.style.width = Math.min(860, sheet.width * Math.max(1, Math.floor(860 / sheet.width))) + 'px'
  $('sheetTitle').textContent = `${name}-sprites.zip: ${cols} x ${rows.length} cells of ${cw}x${ch}`
  ;($('exView') as HTMLButtonElement).disabled = false
  bar.style.width = '100%'
  exporting = false
  justSaved = true
  go.textContent = 'EXPORT SPRITE SHEET'
  exportUI()
  status.textContent = `saved ${name}-sprites.zip: ${total} frames`
}
$('exGo').onclick = () => { if (!exporting) void exportSheet() }

// ---- the UI kit: bubbles (a row per shape, a column per mark) and icons, painted in the current palette
/** The colour of each kit code: bubbles 1 outline, 2 fill, 3 mark, 4 warm mark; icons 1 outline, 2 body, 3 shade, 4 shine. */
function kitColours(kind: 'bubble' | 'icon', icon?: string): (number[] | null)[] {
  return paletteKitColours({ mode: colors.mode, outline: colors.outline, paper: colors.paper, ramps: colors.ramps }, kind, icon)
}
interface KitCell { d: Drawn; cols: (number[] | null)[] }
/** Pack drawn items into a grid of equal cells, centred, returning the canvas and each item's rect. */
function packKit(items: KitCell[], perRow: number): { canvas: HTMLCanvasElement; rects: { x: number; y: number; w: number; h: number; ox: number; oy: number }[] } {
  const cw = Math.max(...items.map((i) => i.d.w)), ch = Math.max(...items.map((i) => i.d.h))
  const canvas = document.createElement('canvas')
  canvas.width = cw * perRow; canvas.height = ch * Math.ceil(items.length / perRow)
  const g = canvas.getContext('2d')!
  const img = g.createImageData(canvas.width, canvas.height)
  const rects = items.map(({ d, cols }, i) => {
    const x = (i % perRow) * cw + Math.floor((cw - d.w) / 2), y = Math.floor(i / perRow) * ch + (ch - d.h)
    for (let yy = 0; yy < d.h; yy++) for (let xx = 0; xx < d.w; xx++) {
      const c = cols[d.px[yy * d.w + xx]]
      if (!c) continue
      const o = ((y + yy) * canvas.width + x + xx) * 4
      img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255
    }
    return { x, y, w: d.w, h: d.h, ox: (i % perRow) * cw, oy: Math.floor(i / perRow) * ch }
  })
  g.putImageData(img, 0, 0)
  return { canvas, rects }
}
const bubbleItems = () => BUBBLE_SHAPES.flatMap((shape) => MARK_NAMES.map((mark) => ({ shape, mark, d: drawBubble(shape, mark) })))
const iconItems = () => ICON_NAMES.map((name) => ({ name, d: drawIcon(name) }))
let kitVer = ''
function kitUI(): void {
  const key = `${colors.mode}|${colors.ver}|${colors.theme}`
  if (key === kitVer) return
  kitVer = key
  const show = (id: string, c: HTMLCanvasElement) => {
    const el = $(id) as HTMLCanvasElement
    el.width = c.width; el.height = c.height
    el.getContext('2d')!.drawImage(c, 0, 0)
    el.style.width = Math.min(340, c.width * 2) + 'px'
  }
  show('kitBubbles', packKit(bubbleItems().map(({ d }) => ({ d, cols: kitColours('bubble') })), MARK_NAMES.length).canvas)
  show('kitIcons', packKit(iconItems().map(({ name, d }) => ({ d, cols: kitColours('icon', name) })), 8).canvas)
}
$('kitGo').onclick = async () => {
  const bubbles = bubbleItems(), icons = iconItems()
  const b = packKit(bubbles.map(({ d }) => ({ d, cols: kitColours('bubble') })), MARK_NAMES.length)
  const ic = packKit(icons.map(({ name, d }) => ({ d, cols: kitColours('icon', name) })), 8)
  const meta = {
    generator: 'Mochimon: UI kit',
    palette: colors.mode === 2 ? { colours: 2, ink: colors.outline, paper: colors.paper } : { colours: colors.mode, theme: colors.theme },
    bubbles: { image: 'bubbles.png', items: bubbles.map(({ shape, mark, d }, i) => ({ shape, mark, x: b.rects[i].x, y: b.rects[i].y, w: d.w, h: d.h, anchor: d.anchor ? [b.rects[i].x + d.anchor[0], b.rects[i].y + d.anchor[1]] : undefined })) },
    icons: { image: 'icons.png', items: icons.map(({ name, d }, i) => ({ name, x: ic.rects[i].x, y: ic.rects[i].y, w: d.w, h: d.h })) },
  }
  const readme = `UI kit: made with Mochimon

bubbles.png  speech, thought and shout bubbles (a row each) with a mark in each (${MARK_NAMES.join(', ')}).
             Each bubble's "anchor" in kit.json is the tip of its tail, in sheet pixels: put it on the speaker's head.
icons.png    little UI icons (${ICON_NAMES.join(', ')}).
kit.json     every item's rect (x, y, w, h) in its sheet.

Scale by whole numbers with smoothing off.
`
  const blob = zip([
    { name: 'bubbles.png', data: await pngOf(b.canvas) },
    { name: 'icons.png', data: await pngOf(ic.canvas) },
    { name: 'kit.json', data: new TextEncoder().encode(JSON.stringify(meta, null, 2) + '\n') },
    { name: 'README.txt', data: new TextEncoder().encode(readme) },
  ])
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'ui-kit.zip'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10000)
  justSaved = true
  $('exStatus').textContent = `saved ui-kit.zip: ${bubbles.length} bubbles, ${icons.length} icons`
}

// ---- sizing, input, loop
const zoom = $('zoom') as HTMLInputElement
const speed = $('speed') as HTMLInputElement
function size(): void {
  const fw = even(PW * catK), fh = even(PH * catK)
  for (const c of [big, small]) { c.width = fw; c.height = fh }
  lastShown = null
  big.style.aspectRatio = `${fw} / ${fh}`
  big.style.width = fw * Number(zoom.value) + 'px'; big.style.height = fh * Number(zoom.value) + 'px'
  small.style.width = fw * 2 + 'px'; small.style.height = fh * 2 + 'px'
}
zoom.oninput = size; size()
$('pause').onclick = (e) => { state.paused = !state.paused; (e.target as HTMLElement).textContent = state.paused ? 'play' : 'pause' }
let dragX: number | null = null
let dragStart = 0
big.addEventListener('pointerdown', (e) => { dragX = e.clientX; dragStart = state.mode === 'spin' ? state.manual ?? current(SPIN) : state.view; big.setPointerCapture(e.pointerId) })
big.addEventListener('pointermove', (e) => {
  if (dragX === null) return
  const step = Math.round((e.clientX - dragX) / (state.mode === 'spin' ? 8 : 14))
  if (state.mode === 'spin') state.manual = dragStart + step
  else state.view = (((dragStart - step) % 16) + 16) % 16
})
big.addEventListener('pointerup', () => { dragX = null })
big.addEventListener('dblclick', () => { state.manual = null; state.view = 0 })

let last = performance.now()
function loop(now: number): void {
  const dt = (now - last) / 1000
  last = now
  if (!state.paused) state.t += dt * Number(speed.value) * (state.mode === 'spin' ? 1 : state.mode === 'faces' ? 0.12 : 0.9)
  if (!exporting) work()
  kitUI()
  const f = frames()
  const geo = f[current(f.length)]
  // a frame still on its way keeps the last one up, rather than blinking empty
  const img = geo ? image(geo, rest()?.bottom ?? geo.bottom) : null
  if (img && img !== lastShown) {
    for (const c of [big, small]) {
      const g = c.getContext('2d')!
      g.clearRect(0, 0, c.width, c.height)
      if (img.width === c.width) g.putImageData(img, 0, 0)
    }
    lastShown = img
    big.classList.remove('sk'); small.classList.remove('sk')
  }
  requestAnimationFrame(loop)
}

// the RUN SDK, when there is one (the app works without it)
async function boot(): Promise<void> {
  try {
    const m = await import('@series-inc/rundot-game-sdk/api')
    await Promise.race([m.default.initializeAsync(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))])
  } catch (err) {
    console.warn('[mochimon] RUN SDK unavailable', err)
  }
}
setTheme(colors.theme)
refresh()
requestAnimationFrame(loop)
void boot()

