import * as THREE from 'three'
import { loadKit, Tot, type Kit, type Species, type TotOptions } from './kit'
import type { SkinPattern } from '../body/skinPattern'
import type { MonsterAnim } from '../body/anims'
import { potById } from '../body/pots'
import { PROPS, type HangerKind } from '../props/props'
import { infest, clearPests } from '../props/infest'
import { applyLook, type Look } from './looks'

/**
 * The Terra Tots trailer (promo/OUTLINE.md): a day in a room full of tots, told only through the bits, with nothing on
 * screen that isn't in the kit (a plain floor and backdrop; the set is kit props). Text is kept to the title, the
 * plant names, the bug counts and the tagline. ?look=std|toon|outline picks the render look (src/promo/looks.ts).
 * Live: plays in real time and loops. ?record=1: steps exactly 1/30 s per frame and posts every frame (and the sound
 * and music cues) to promo/server.py. ?at=<s> holds a moment, ?sheet=1,2.5,... draws a contact sheet.
 */

const Q = new URLSearchParams(location.search)
const W = 1080
const H = 1920
const FPS = 30
const RECORD = Q.has('record')
const SAVE = Q.get('save') ?? 'http://127.0.0.1:8797' // promo/server.py
const LOOK = (Q.get('look') ?? 'toon') as Look
const BPM = 112
const BEAT = 60 / BPM
const BAR = 4 * BEAT
const FONT = '"Sniglet", "Arial Rounded MT Bold", sans-serif'
const INK = '#4a2c20'
const TERRA = '#e07448'
const CREAM = '#fff6e6'
const CHALK = '#f3f0e4'
const SLATE = '#2f3b35'

// ------------------------------------------------------------------ renderer, scene, plain set
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(1)
renderer.setSize(W, H, false)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.domElement.addEventListener('webglcontextlost', () => console.error('CONTEXT LOST at', T.toFixed(2), JSON.stringify(renderer.info.memory)))
const out = document.getElementById('out') as HTMLCanvasElement
const ctx = out.getContext('2d')!

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(36, W / H, 0.1, 120)
const hemi = new THREE.HemisphereLight('#fff6e8', '#9a7f62', 1.7)
const sun = new THREE.DirectionalLight('#fff0d8', 2.1)
scene.add(hemi, sun)
// the soft look: a warm rim light from behind and more fill, so pots read against the backdrop
const rim = new THREE.DirectionalLight('#fff1dc', 0)
rim.position.set(-3, 6, -8)
scene.add(rim)
const discoA = new THREE.PointLight('#ff9ec4', 0, 14)
const discoB = new THREE.PointLight('#9ee7ff', 0, 14)
discoA.position.set(-3, 3.5, 2)
discoB.position.set(3, 3.5, 2)
scene.add(discoA, discoB)
// a plain warm floor that fades into the backdrop (no room: nothing on screen that the kit doesn't have)
const floorMat = new THREE.MeshBasicMaterial({ color: '#ead6b8' }) // flat: each shot's pastel reads as the colour of the whole set
const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), floorMat)
floor.rotation.x = -Math.PI / 2
scene.add(floor)
scene.fog = new THREE.Fog('#f3e6d0', 18, 45)

type Light = 'morning' | 'midday' | 'evening' | 'slate' | 'disco'
/** Cross-lighting: a strong warm key from one side, a cool fill from the other side and a little behind, low ambient. */
function lighting(l: Light, bgOver?: string) {
  const bg = bgOver ?? { morning: '#f6e6cf', midday: '#f6ead6', evening: '#e7c1a0', slate: SLATE, disco: '#f3dcef' }[l]
  scene.background = new THREE.Color(bg)
  ;(scene.fog as THREE.Fog).color.set(bg)
  floor.visible = l !== 'slate'
  floorMat.color.set(new THREE.Color(bg).lerp(new THREE.Color('#b08a66'), 0.07))
  const set: Record<Light, [string, [number, number, number], number, string, number, string, number]> = {
    // key colour, key position, key intensity, fill colour, fill intensity, ambient colour, ambient intensity
    morning: ['#ffe0b0', [-7, 4.5, 3], 2.9, '#a8c4ff', 1.3, '#fff3e2', 0.95],
    midday: ['#fff2dc', [7, 6, 3], 3.0, '#b3c8ff', 1.2, '#fffaf0', 1.05],
    evening: ['#ffa364', [8, 2.4, 2], 3.0, '#9a9cff', 1.3, '#ffd2b0', 0.75],
    disco: ['#ffe6f4', [-6, 5, 3], 2.6, '#9fe8ff', 1.4, '#fff0fa', 1.0],
    slate: ['#fff0d8', [5, 6, 6], 2.4, '#b8c8ff', 1.1, '#fff6e8', 1.1],
  }
  const [kc, kp, ki, fc, fi, ac, ai] = set[l]
  sun.color.set(kc), sun.position.set(...kp), (sun.intensity = ki)
  rim.color.set(fc), rim.position.set(-kp[0], kp[1] * 0.8, -3), (rim.intensity = fi)
  hemi.color.set(ac), (hemi.intensity = ai)
  discoA.intensity = discoB.intensity = 0
}

function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
// soft blob shadows under every tot
const blobTex = canvasTex(128, 128, (c) => {
  const g = c.createRadialGradient(64, 64, 4, 64, 64, 62)
  g.addColorStop(0, 'rgba(70,45,25,0.42)')
  g.addColorStop(1, 'rgba(70,45,25,0)')
  c.fillStyle = g
  c.fillRect(0, 0, 128, 128)
})
const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false })

// ------------------------------------------------------------------ actors and props
let kit: Kit
interface Actor { tot: Tot; blob: THREE.Mesh; ground: number; ts: number; turn: number }
let actors: Actor[] = []
let props: THREE.Object3D[] = []
let T = 0
let events: { t: number; type: string; gain: number }[] = []
const sfx = (type: string, gain = 1) => events.push({ t: +T.toFixed(4), type, gain })
const music = (cue: string) => sfx('music:' + cue, 1)

const PSCALE = 1.6 // props are built in body units, like the pots; the tots are scaled 1.6
function kitProp(id: string, cw = 0, s = PSCALE) {
  const p = PROPS.find((x) => x.id === id)!.build(cw)
  p.scale.setScalar(s)
  p.traverse((o) => (o.castShadow = true))
  scene.add(p)
  props.push(p)
  return p
}
function tot(o: TotOptions, x = 0, z = 0, ry = 0, anim: MonsterAnim = 'idle', t0 = 0): Actor {
  const t = new Tot(kit, o)
  t.root.position.set(x, 0, z)
  t.root.rotation.y = ry
  t.anim = anim
  t.t0 = t0
  scene.add(t.root)
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), blobMat)
  blob.rotation.x = -Math.PI / 2
  scene.add(blob)
  const a = { tot: t, blob, ground: 0, ts: 1, turn: 0 }
  actors.push(a)
  return a
}
function hang(a: Actor, kind: HangerKind, rope: number) {
  a.tot.monster.group.userData.hang = { kind, rope }
  a.tot.anim = 'swing'
}
/** Free GPU buffers of something leaving the scene (three re-uploads anything that's drawn again later). */
function release(o: THREE.Object3D) {
  o.traverse((x) => {
    const m = x as THREE.Mesh
    if (!m.isMesh) return
    m.geometry?.dispose()
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) for (const v of Object.values(mat ?? {})) if ((v as THREE.Texture)?.isTexture) (v as THREE.Texture).dispose()
  })
}
function clearSet() {
  for (const a of actors) (scene.remove(a.tot.root, a.blob), release(a.tot.root))
  for (const p of props) (scene.remove(p), release(p))
  actors = []
  props = []
  fired.clear()
}
const fired = new Set<string>()
const at = (lt: number, t: number, key: string, fn: () => void) => {
  if (lt >= t && !fired.has(key)) {
    fired.add(key)
    fn()
  }
}

// ------------------------------------------------------------------ easing, camera
const clamp01 = (u: number) => Math.min(1, Math.max(0, u))
const ease = (u: number) => u * u * (3 - 2 * u)
const back = (u: number) => {
  const c = 1.7
  return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2)
}
const lerp = (a: number, b: number, u: number) => a + (b - a) * u
let kick = 0
let flash = 0
function cam(c: THREE.PerspectiveCamera, px: number, py: number, pz: number, tx: number, ty: number, tz: number, fov = 36) {
  c.position.set(px, py, pz)
  c.lookAt(tx, ty, tz)
  c.fov = fov
  c.updateProjectionMatrix()
}
function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

// ------------------------------------------------------------------ 2D: logo, captions, clock, chalk
function pill(text: string, y: number, size: number, u: number, o: { bg?: string; fg?: string; x?: number } = {}) {
  if (u <= 0) return
  const s = back(clamp01(u))
  ctx.save()
  ctx.font = `800 ${size}px ${FONT}`
  const w = ctx.measureText(text).width + size * 1.2
  const h = size * 1.55
  ctx.translate(o.x ?? W / 2, y * H)
  ctx.scale(s, s)
  ctx.fillStyle = o.bg ?? CREAM
  ctx.strokeStyle = INK
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.roundRect(-w / 2, -h / 2, w, h, h / 2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = o.fg ?? INK
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 0, size * 0.06)
  ctx.restore()
}
/**
 * Display lettering (names, the banner, the title): the card font in a colour, with a thin brushy ink outline, and the
 * holes inside letters (o, a, e...) filled solid ink so no pale dots are left in them. Rendered once per word and size
 * and cached. Returns the canvas and where the text's left baseline-middle sits in it.
 */
const inkCache = new Map<string, { c: HTMLCanvasElement; ox: number; oy: number; w: number }>()
function inkWord(text: string, size: number, fill = TERRA, wobble = 0.32, offset = 0, stroke = 1) {
  const key = `${text}|${size}|${fill}|${wobble}|${offset}|${stroke}`
  const hit = inkCache.get(key)
  if (hit) return hit
  const font = `800 ${size}px ${FONT}`
  const meas = document.createElement('canvas').getContext('2d')!
  meas.font = font
  const tw = meas.measureText(text).width
  const pad = Math.ceil(size * 0.3)
  const c = document.createElement('canvas')
  c.width = Math.ceil(tw + pad * 2)
  c.height = Math.ceil(size * 1.5 + pad * 2)
  const ox = pad
  const oy = c.height / 2
  const g = c.getContext('2d')!
  g.font = font
  g.textBaseline = 'middle'
  // the letter shapes, to find their holes: empty pixels not connected to the outside
  const mk = document.createElement('canvas')
  mk.width = c.width
  mk.height = c.height
  const mg = mk.getContext('2d')!
  mg.font = font
  mg.textBaseline = 'middle'
  mg.fillStyle = '#000'
  mg.fillText(text, ox, oy)
  const a = mg.getImageData(0, 0, c.width, c.height).data
  const W2 = c.width
  const H2 = c.height
  const out = new Uint8Array(W2 * H2)
  const stack: number[] = []
  const push = (i: number) => {
    if (!out[i] && a[i * 4 + 3] < 110) (out[i] = 1), stack.push(i)
  }
  for (let x = 0; x < W2; x++) push(x), push((H2 - 1) * W2 + x)
  for (let y = 0; y < H2; y++) push(y * W2), push(y * W2 + W2 - 1)
  while (stack.length) {
    const i = stack.pop()!
    const x = i % W2
    if (x > 0) push(i - 1)
    if (x < W2 - 1) push(i + 1)
    if (i >= W2) push(i - W2)
    if (i < W2 * (H2 - 1)) push(i + W2)
  }
  const holes = mg.createImageData(W2, H2)
  const ink = { r: parseInt(INK.slice(1, 3), 16) / 255, g: parseInt(INK.slice(3, 5), 16) / 255, b: parseInt(INK.slice(5, 7), 16) / 255 }
  for (let i = 0; i < W2 * H2; i++)
    if (!out[i] && a[i * 4 + 3] < 110) {
      holes.data[i * 4] = ink.r * 255
      holes.data[i * 4 + 1] = ink.g * 255
      holes.data[i * 4 + 2] = ink.b * 255
      holes.data[i * 4 + 3] = 255
    }
  // a hand-painted outline: a thick stroke, softened, then cut back with a noise field so its outer edge wobbles like
  // a brush stroke while staying crisp
  const lw = size * 0.13 * stroke
  const st = document.createElement('canvas')
  st.width = W2
  st.height = H2
  const sg = st.getContext('2d')!
  sg.font = font
  sg.textBaseline = 'middle'
  sg.lineJoin = 'round'
  sg.lineWidth = lw
  sg.strokeText(text, ox, oy)
  sg.fillText(text, ox, oy)
  const soft = document.createElement('canvas')
  soft.width = W2
  soft.height = H2
  const so = soft.getContext('2d')!
  so.filter = `blur(${(size * 0.035).toFixed(1)}px)`
  so.drawImage(st, 0, 0)
  const sa = so.getImageData(0, 0, W2, H2)
  const cell = Math.max(6, size * 0.28) // big, slow undulations: one confident brush pass
  const nh = (i: number, j: number) => hash(i * 157.3 + j * 311.7 + size)
  const noise = (x: number, y: number) => {
    const fx = x / cell
    const fy = y / cell
    const i = Math.floor(fx)
    const j = Math.floor(fy)
    const u = fx - i
    const v = fy - j
    const su = u * u * (3 - 2 * u)
    const sv = v * v * (3 - 2 * v)
    return lerp(lerp(nh(i, j), nh(i + 1, j), su), lerp(nh(i, j + 1), nh(i + 1, j + 1), su), sv)
  }
  const inkC = { r: parseInt(INK.slice(1, 3), 16) / 255, g: parseInt(INK.slice(3, 5), 16) / 255, b: parseInt(INK.slice(5, 7), 16) / 255 } // the hex as-is (no colour management)
  for (let y = 0; y < H2; y++)
    for (let x = 0; x < W2; x++) {
      const i = (y * W2 + x) * 4
      const n = noise(x, y)
      const al = sa.data[i + 3] / 255 + (n - 0.5) * wobble
      sa.data[i] = inkC.r * 255
      sa.data[i + 1] = inkC.g * 255
      sa.data[i + 2] = inkC.b * 255
      sa.data[i + 3] = 255 * THREE.MathUtils.smoothstep(al, 0.42, 0.52)
    }
  so.filter = 'none'
  so.clearRect(0, 0, W2, H2)
  so.putImageData(sa, 0, 0)
  g.drawImage(soft, offset * size, offset * size)
  mg.clearRect(0, 0, W2, H2)
  mg.putImageData(holes, 0, 0)
  g.drawImage(mk, 0, 0)
  g.fillStyle = fill
  g.fillText(text, ox, oy)
  const r = { c, ox, oy, w: tw }
  inkCache.set(key, r)
  return r
}
/** Draw inkWord lettering with its left edge (or centre) at x and its middle at y. */
function inkText(text: string, x: number, y: number, size: number, align: 'left' | 'center' = 'left', fill = TERRA) {
  const r = inkWord(text, size, fill)
  ctx.drawImage(r.c, x - r.ox - (align === 'center' ? r.w / 2 : 0), y - r.oy)
  return r.w
}
/** A little two-leaf sprout (for the title). */
function sprout(x: number, y: number, s: number) {
  const leafP = (rot: number, col: string, k: number) => {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rot)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.quadraticCurveTo(s * 0.55 * k, -s * 0.45 * k, 0, -s * k)
    ctx.quadraticCurveTo(-s * 0.55 * k, -s * 0.45 * k, 0, 0)
    ctx.fillStyle = col
    ctx.fill()
    ctx.lineWidth = s * 0.08
    ctx.strokeStyle = INK
    ctx.lineJoin = 'round'
    ctx.stroke()
    ctx.restore()
  }
  leafP(0.55, '#5f9a5a', 1)
  leafP(-0.6, '#8cc27a', 0.75)
}
const logo = new Image()
logo.src = '/promo/logo.png'
const runMark = new Image()
runMark.src = '/promo/run_wordmark.svg'
/**
 * The title (logo concept C): small spaced-out TERRA over chunky lowercase "tots", each letter split terracotta over
 * sage like a half-dipped glazed pot, a deeper offset shadow, and a sprout growing out of the o. Built once, cached.
 */
let logoCanvas: HTMLCanvasElement | null = null
function buildLogo() {
  const S = 420 // "tots" size
  const c = document.createElement('canvas')
  c.width = 900
  c.height = 700
  const g = c.getContext('2d')!
  const cx = c.width / 2
  const TOP = '#e08a6c'
  const BOTTOM = '#8fb898'
  const DARK = '#7a4231'
  // TERRA: light, widely spaced capitals
  g.font = `600 ${S * 0.22}px Fredoka`
  g.textBaseline = 'alphabetic'
  g.fillStyle = TOP
  const letters = [...'TERRA']
  const track = S * 0.2
  const ws = letters.map((ch) => g.measureText(ch).width)
  let x = cx - (ws.reduce((a, b) => a + b, 0) + track * (letters.length - 1)) / 2
  letters.forEach((ch, i) => (g.fillText(ch, x, 150), (x += ws[i] + track)))
  // tots: a deep offset shadow, a dark outline, then the two-tone fill (terracotta over sage, like a dipped pot)
  g.font = `700 ${S}px Fredoka`
  g.lineJoin = 'round'
  const tw = g.measureText('tots').width
  const bx = cx - tw / 2
  const by = 600
  g.fillStyle = DARK
  g.strokeStyle = DARK
  g.lineWidth = S * 0.05
  g.strokeText('tots', bx + S * 0.03, by + S * 0.035)
  g.fillText('tots', bx + S * 0.03, by + S * 0.035)
  g.strokeText('tots', bx, by)
  const top = by - S * 0.72
  const split = by - S * 0.32
  const grad = g.createLinearGradient(0, top, 0, by)
  const k = (split - top) / (by - top)
  grad.addColorStop(0, TOP)
  grad.addColorStop(k, TOP)
  grad.addColorStop(k, BOTTOM)
  grad.addColorStop(1, BOTTOM)
  g.fillStyle = grad
  g.fillText('tots', bx, by)
  // the sprout out of the o: a short stem and two big round leaves, outlined like the letters
  const ox = bx + g.measureText('t').width + g.measureText('o').width / 2
  const oy = by - S * 0.52
  g.strokeStyle = DARK
  g.lineCap = 'round'
  g.lineWidth = S * 0.05
  g.beginPath()
  g.moveTo(ox, oy)
  g.lineTo(ox, oy - S * 0.2)
  g.stroke()
  g.strokeStyle = '#5c8a4e'
  g.lineWidth = S * 0.025
  g.stroke()
  const leaf = (dir: number, col: string) => {
    g.save()
    g.translate(ox, oy - S * 0.19)
    g.scale(dir, 1)
    g.rotate(-0.45)
    g.beginPath()
    g.moveTo(0, 0)
    g.bezierCurveTo(S * 0.06, -S * 0.15, S * 0.26, -S * 0.15, S * 0.3, -S * 0.02)
    g.bezierCurveTo(S * 0.22, S * 0.06, S * 0.08, S * 0.07, 0, 0)
    g.fillStyle = col
    g.fill()
    g.lineWidth = S * 0.022
    g.strokeStyle = DARK
    g.stroke()
    g.beginPath()
    g.moveTo(S * 0.02, -S * 0.005)
    g.quadraticCurveTo(S * 0.14, -S * 0.06, S * 0.25, -S * 0.03)
    g.lineWidth = S * 0.012
    g.strokeStyle = 'rgba(255,255,255,0.35)'
    g.stroke()
    g.restore()
  }
  leaf(-1, '#79ab66')
  leaf(1, '#94c47f')
  return c
}
const logoB = new Image()
logoB.src = '/promo/logo-b.png'
function drawLogo(y: number, width: number, u: number) {
  if (u <= 0) return
  logoCanvas ??= Q.get('logo') !== 'c' && logoB.complete ? (() => {
    // the hand-script logo (concept B, cut out of its background); ?logo=c for the chunky two-tone one
    const c = document.createElement('canvas')
    c.width = logoB.width * 1.25
    c.height = logoB.height * 1.25
    c.getContext('2d')!.drawImage(logoB, (c.width - logoB.width) / 2, (c.height - logoB.height) / 2)
    return c
  })() : buildLogo()
  const s = back(clamp01(u))
  const h = (width * logoCanvas.height) / logoCanvas.width
  ctx.save()
  ctx.translate(W / 2, y * H)
  ctx.scale(s, s)
  ctx.rotate(Math.sin(T * 2.2) * 0.008)
  ctx.drawImage(logoCanvas, -width / 2, -h / 2, width, h)
  ctx.restore()
}
function drawRun(y: number, u: number) {
  if (u <= 0 || !runMark.complete) return
  const s = back(clamp01(u))
  ctx.save()
  ctx.translate(W / 2, y * H)
  ctx.scale(s, s)
  const mw = 230
  const mh = (mw * 26) / 61.5
  const bw = 330
  const bh = 130
  ctx.fillStyle = '#1f2a24'
  ctx.beginPath()
  ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 36)
  ctx.fill()
  ctx.drawImage(runMark, -mw / 2, -mh / 2, mw, mh)
  ctx.restore()
}
/** Chalk lettering: the text drawn a few times with small jitter and low alpha, revealed left to right by `u`. */
function chalkText(text: string, x: number, y: number, size: number, u: number, align: CanvasTextAlign = 'center', color = CHALK) {
  if (u <= 0) return
  ctx.save()
  ctx.font = `400 ${size}px ${FONT}`
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  const w = ctx.measureText(text).width
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x
  ctx.beginPath()
  ctx.rect(x0 - 10, y - size, (w + 20) * clamp01(u), size * 2)
  ctx.clip()
  for (let k = 0; k < 4; k++) {
    ctx.globalAlpha = color === CHALK ? 0.32 : 0.6
    ctx.fillStyle = color
    ctx.fillText(text, x + (hash(k * 3 + text.length) - 0.5) * 3, y + (hash(k * 7 + 1) - 0.5) * 3)
  }
  ctx.globalAlpha = 0.5
  ctx.strokeStyle = color
  ctx.lineWidth = 1.2
  ctx.strokeText(text, x, y)
  ctx.restore()
}
/** A chalk line along points, drawn on progressively (u 0..1). */
function chalkLine(pts: [number, number][], u: number, w = 5, color = CHALK) {
  if (u <= 0) return
  const len = pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0)
  const left = len * clamp01(u)
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (let k = 0; k < 3; k++) {
    ctx.globalAlpha = color === CHALK ? 0.45 : 0.8
    ctx.strokeStyle = color
    ctx.lineWidth = w * (1 - k * 0.25)
    ctx.beginPath()
    ctx.moveTo(pts[0][0] + k, pts[0][1] - k)
    let rem = left
    for (let i = 1; i < pts.length && rem > 0; i++) {
      const [ax, ay] = pts[i - 1]
      const [bx, by] = pts[i]
      const d = Math.hypot(bx - ax, by - ay)
      const f = Math.min(1, rem / d)
      ctx.lineTo(ax + (bx - ax) * f + k, ay + (by - ay) * f - k)
      rem -= d
    }
    ctx.stroke()
  }
  ctx.restore()
}
/** The slate: a dark green board with chalk dust and smudges (cached). */
const slate = document.createElement('canvas')
slate.width = W
slate.height = H
{
  const c = slate.getContext('2d')!
  c.fillStyle = SLATE
  c.fillRect(0, 0, W, H)
  for (let i = 0; i < 26; i++) {
    const g = c.createRadialGradient(hash(i) * W, hash(i + 40) * H, 0, hash(i) * W, hash(i + 40) * H, 120 + hash(i + 80) * 260)
    g.addColorStop(0, 'rgba(240,240,225,0.06)')
    g.addColorStop(1, 'rgba(240,240,225,0)')
    c.fillStyle = g
    c.fillRect(0, 0, W, H)
  }
  for (let i = 0; i < 9000; i++) {
    c.fillStyle = `rgba(240,240,225,${0.02 + hash(i * 3) * 0.05})`
    c.fillRect(hash(i) * W, hash(i + 9999) * H, 1.5, 1.5)
  }
  const v = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(0,0,0,0.35)')
  c.fillStyle = v
  c.fillRect(0, 0, W, H)
}
/**
 * A chalk leaf (a heart-shaped monstera-ish leaf with a stem), outline drawn on by `u`, its variegation filled in by
 * `fill`. Each pattern is its own: half-moon, speckled, marbled, splashed, sectored.
 */
type Varieg = 'halfmoon' | 'speckle' | 'mix' | 'marble' | 'splash' | 'sector' | 'none'
function chalkLeaf(cx: number, cy: number, size: number, pat: Varieg, seed: number, u: number, fill: number, tilt = 0) {
  if (u <= 0) return
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(tilt)
  const s = size
  const outline = new Path2D()
  outline.moveTo(0, s * 0.55)
  outline.bezierCurveTo(-s * 0.75, s * 0.2, -s * 0.7, -s * 0.55, -s * 0.12, -s * 0.5)
  outline.quadraticCurveTo(0, -s * 0.42, 0, -s * 0.3)
  outline.quadraticCurveTo(0, -s * 0.42, s * 0.12, -s * 0.5)
  outline.bezierCurveTo(s * 0.7, -s * 0.55, s * 0.75, s * 0.2, 0, s * 0.55)
  ctx.globalAlpha = clamp01(u * 1.3) * 0.55
  ctx.fillStyle = 'rgba(160,200,150,0.35)'
  ctx.fill(outline)
  if (fill > 0) {
    ctx.save()
    ctx.clip(outline)
    ctx.globalAlpha = 0.8 * clamp01(fill)
    ctx.fillStyle = CHALK
    const R = (k: number) => hash(seed * 31 + k)
    if (pat === 'halfmoon' || pat === 'mix') ctx.fillRect(R(1) > 0.5 ? 0 : -s, -s, s, s * 2)
    if (pat === 'mix') {
      // half white and speckled: both parents at once
      for (let k = 0; k < 30; k++) {
        ctx.beginPath()
        ctx.arc((R(k) - 0.5) * s * 1.4, (R(k + 50) - 0.5) * s * 1.1, s * (0.02 + R(k + 99) * 0.05), 0, Math.PI * 2)
        ctx.fill()
      }
    }
    else if (pat === 'sector') {
      ctx.beginPath()
      ctx.moveTo(0, s * 0.5)
      ctx.arc(0, s * 0.5, s * 1.2, -Math.PI / 2 - 0.5 - R(2) * 0.6, -Math.PI / 2 + 0.2)
      ctx.fill()
    } else if (pat === 'speckle') {
      for (let k = 0; k < 40; k++) {
        ctx.beginPath()
        ctx.arc((R(k) - 0.5) * s * 1.4, (R(k + 50) - 0.5) * s * 1.1, s * (0.02 + R(k + 99) * 0.05), 0, Math.PI * 2)
        ctx.fill()
      }
    } else if (pat === 'splash') {
      for (let k = 0; k < 7; k++) {
        ctx.beginPath()
        ctx.ellipse((R(k) - 0.5) * s, (R(k + 20) - 0.5) * s, s * (0.08 + R(k + 40) * 0.16), s * (0.05 + R(k + 60) * 0.1), R(k + 80) * 3, 0, Math.PI * 2)
        ctx.fill()
      }
    } else if (pat === 'marble') {
      ctx.lineWidth = s * 0.05
      ctx.strokeStyle = CHALK
      for (let k = 0; k < 8; k++) {
        ctx.beginPath()
        const y0 = (k / 8 - 0.5) * s * 1.1
        ctx.moveTo(-s, y0)
        for (let x = -s; x <= s; x += s / 8) ctx.lineTo(x, y0 + Math.sin(x / s * 6 + R(k) * 6) * s * 0.07)
        ctx.stroke()
      }
    }
    ctx.restore()
  }
  ctx.restore()
  // outline and midrib in chalk (in the parent's frame)
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(tilt)
  ctx.globalAlpha = 0.7
  ctx.strokeStyle = CHALK
  ctx.lineWidth = 4
  ctx.setLineDash([size * 3 * clamp01(u), size * 4])
  ctx.stroke(outline)
  ctx.setLineDash([])
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(0, -s * 0.3)
  ctx.lineTo(0, s * 0.55 + s * 0.25 * clamp01(u))
  ctx.stroke()
  ctx.restore()
}

// ------------------------------------------------------------------ shots
interface Shot {
  bars: number
  flash?: boolean
  light: Light
  /** A pastel backdrop for this shot (each intro gets a colour that suits the character). */
  bg?: string
  setup(): void
  update(lt: number, dt: number): void
  text?(lt: number): void
  /** Draw a 2D background instead of the 3D render (the chalk slide). */
  board?(lt: number): boolean
}
const shots: Shot[] = []
/** Limb colours and markings for the extras: some bright, some pastel, some dark and moody, some leafy green. */
const PERSONAS: [string, SkinPattern, string][] = [
  ['#f2826a', 'spots', '#ffd36b'], ['#bfe3c8', 'marble', '#ffffff'], ['#4fb3a9', 'pinstripe', '#e9fff6'], ['#d9c6ef', 'speckle', '#7a5aa6'],
  ['#f4c95d', 'brindle', '#e07448'], ['#8fae8c', 'vitiligo', '#efe6c8'], ['#3a3540', 'wavy', '#9b7fd1'], ['#f6cdb2', 'splash', '#e9846b'],
  ['#9b7fd1', 'spots', '#f3e8c4'], ['#c4dcf2', 'wavy', '#5b86b8'], ['#2f4a3a', 'pinstripe', '#bfe3a8'], ['#f6c6d0', 'none', '#ffffff'],
  ['#7fa38e', 'brindle', '#e9e4c8'], ['#e9846b', 'marble', '#fff0e0'],
]
const look = (k: number): TotOptions => {
  const [skin, pattern, patternColor] = PERSONAS[k % PERSONAS.length]
  return { skin, pattern, patternColor, seed: k }
}
/** How grown each species looks: mature monsteras are big, pothos small. */
const AGE: Partial<Record<Species, number>> = { laurentii: 0.6, satin: 0.4, blackvelvet: 0.65, dottie: 0.55, monstera: 0.93, albo: 0.9, thai: 0.9, pothos: 0.35, bop: 0.75, snake: 0.6, cylindrical: 0.6, whale: 0.7, peacelily: 0.6, domino: 0.6, zz: 0.5, raven: 0.55, alocasia: 0.6, frydek: 0.6, calathea: 0.55, whitefusion: 0.55 }
const age = (sp: Species) => AGE[sp] ?? 0.55
/** Body size by plant, for the extras: big plants in big pots, small ones in small. */
const SIZE: Partial<Record<Species, number>> = { monstera: 1.35, albo: 1.25, thai: 1.2, bop: 1.2, whale: 1.15, raven: 1.05, zz: 1.0, snake: 1.0, laurentii: 1.0, cylindrical: 0.95, peacelily: 0.95, domino: 0.95, alocasia: 1.0, frydek: 1.0, calathea: 0.9, whitefusion: 0.9, dottie: 0.85, pothos: 0.8, satin: 0.8 }

/** The cast: ten characters, each with a plant, a pot, limbs and proportions that suit them, and an intro card. */
interface Member { sp: Species; name: string; plant: string; title: string; joke: string; o: TotOptions }
const MEMBERS: Member[] = [
  { sp: 'monstera', name: 'Blanche', plant: 'Monstera', title: 'The Minimalist.', joke: 'Beige is a personality.', o: { size: 1.7, pot: 'egg', cw: 0, skin: '#e6b08c', pattern: 'vitiligo', patternColor: '#fbf6ee', legs: 1.35, arms: 1.1 } },
  { sp: 'thai', name: 'Stella', plant: 'Thai Constellation', title: 'The Dreamer.', joke: 'Named after the stars. Brings it up a lot.', o: { size: 1.2, pot: 'stepped', cw: 3, skin: '#2f4f6e', pattern: 'spots', patternColor: '#f6e9b8', legs: 0.9, arms: 1.1 } },
  { sp: 'domino', name: 'Domino', plant: "Peace Lily 'Domino'", title: 'The Wildcard.', joke: 'Knocks things over. On purpose.', o: { size: 0.95, pot: 'checker', cw: 0, skin: '#f4f1ea', pattern: 'spots', patternColor: '#2a2a2a' } },
  { sp: 'alocasia', name: 'Velvet', plant: "Alocasia 'Frydek'", title: 'The Drama Queen.', joke: 'Droops if you look at her wrong.', o: { size: 1.0, pot: 'scales', cw: 2, skin: '#2e5a3e', pattern: 'splash', patternColor: '#e3f0d6', legs: 0.75, arms: 1.2 } },
  { sp: 'calathea', name: 'Tutu', plant: 'Calathea', title: 'The Ballerina.', joke: 'Folds her leaves up every night. Dramatic exit.', o: { size: 0.9, pot: 'hearts', cw: 1, skin: '#f6c6d0', pattern: 'pinstripe', patternColor: '#ffffff', legs: 1.5, arms: 1.1 } },
  { sp: 'raven', name: 'Raven', plant: "ZZ 'Raven'", title: 'The Goth.', joke: 'A plant who hates the sun.', o: { size: 1.1, pot: 'cauldron', cw: 2, skin: '#433a4c', pattern: 'brindle', patternColor: '#8a3058', legs: 1.4, arms: 1.3 } },
  { sp: 'whale', name: 'Finn', plant: 'Whale Fin', title: 'The Sailor.', joke: 'Has never seen the sea. Won’t stop talking about it.', o: { size: 1.15, pot: 'barrel', cw: 0, skin: '#7f9cb5', pattern: 'wavy', patternColor: '#e8f1f6', legs: 0.8, arms: 0.9 } },
  { sp: 'laurentii', name: 'Sunny', plant: "Snake Plant 'Laurentii'", title: 'The Optimist.', joke: 'Up at 6am. Thrilled about it.', o: { size: 1.0, pot: 'drip', cw: 1, skin: '#f2cf5b', pattern: 'none', patternColor: '#4f8a52', legs: 1.1 } },
  { sp: 'satin', name: 'Pearl', plant: 'Satin Pothos', title: 'The Spy.', joke: 'Not actually a pothos. Shh.', o: { size: 0.8, pot: 'crackle', cw: 0, skin: '#c9a7b6', pattern: 'speckle', patternColor: '#f4eef0', legs: 1.0 } },
  { sp: 'dottie', name: 'Dottie', plant: "Calathea 'Dottie'", title: 'The Foodie.', joke: 'Calls fertiliser “a little treat.”', o: { size: 0.85, pot: 'fluted', cw: 2, skin: '#4a2f45', pattern: 'spots', patternColor: '#f2a3c0', legs: 0.9 } },
]
const M_ = (name: string) => MEMBERS.find((m) => m.name === name)!
const CAST: Partial<Record<Species, TotOptions>> = Object.fromEntries(MEMBERS.map((m) => [m.sp, m.o]))
/** Options for a cast member (by name), or for any species (cast look if it has one, else an extra's look). */
function who(name: string, k = 0): TotOptions {
  const m = M_(name)
  return { species: m.sp, age: age(m.sp), ...m.o, seed: k + 11 }
}
const cast = (sp: Species, k = 0): TotOptions => ({ species: sp, age: age(sp), ...look(k), ...(CAST[sp] ?? {}), seed: k })

/** A camera up high and tipped down at (x, z), `dist` back along `elev` degrees, looking at (tx, ty, tz). */
function high(tx: number, ty: number, tz: number, dist: number, elev = 38, yaw = 0, fov = 36) {
  const e = (elev * Math.PI) / 180
  cam(camera, tx + Math.sin(yaw) * Math.cos(e) * dist, ty + Math.sin(e) * dist, tz + Math.cos(yaw) * Math.cos(e) * dist, tx, ty, tz, fov)
}
/**
 * Compose on some actors: the camera at `elev`/`yaw`, far enough back that their bounds fill `fill` of the frame's
 * width (portrait: width is what runs out first), with their centre placed at height `cy` on screen (0 top, 1 bottom).
 */
const _box = new THREE.Box3()
function frame(as: Actor[], o: { fill?: number; cy?: number; feet?: number; elev?: number; yaw?: number; fov?: number; minR?: number } = {}) {
  _box.makeEmpty()
  for (const a of as) _box.expandByObject(a.tot.root)
  const c = _box.getCenter(new THREE.Vector3())
  const s = _box.getSize(new THREE.Vector3())
  const fov = o.fov ?? 38
  const vt = Math.tan(((fov / 2) * Math.PI) / 180)
  const ht = vt * (W / H)
  const halfW = Math.max(s.x, s.z * 0.6) / 2
  const halfH = s.y / 2
  const dist = Math.max(halfW / (ht * (o.fill ?? 0.8)), halfH / (vt * (o.fill ?? 0.8)), o.minR ?? 0)
  const e = ((o.elev ?? 28) * Math.PI) / 180
  const yaw = o.yaw ?? 0
  const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(e), Math.sin(e), Math.cos(yaw) * Math.cos(e))
  const pos = c.clone().addScaledVector(dir, dist)
  // put the centre at screen height cy: aim the camera above or below it
  const up = new THREE.Vector3(0, 1, 0).sub(dir.clone().multiplyScalar(dir.y)).normalize()
  // feet: where the bottom of the bounds lands on screen (0 top, 1 bottom); sets the centre from it
  const cy = o.feet !== undefined ? o.feet - halfH / (2 * vt * dist) : o.cy ?? 0.5
  const tgt = c.clone().addScaledVector(up, (cy - 0.5) * 2 * vt * dist)
  cam(camera, pos.x, pos.y, pos.z, tgt.x, tgt.y, tgt.z, fov)
  if (o.feet === undefined) return
  // put the feet exactly at that height: project where they stand and nudge the camera until they land there
  const feet = new THREE.Vector3()
  for (const a of as) feet.add(a.tot.root.position)
  feet.multiplyScalar(1 / as.length)
  for (let i = 0; i < 3; i++) {
    camera.updateMatrixWorld(true)
    const sy = (1 - feet.clone().project(camera).y) / 2 // 0 top, 1 bottom
    const shift = (o.feet - sy) * 2 * vt * dist
    tgt.addScaledVector(up, shift) // camera up = subject lower on screen
    pos.addScaledVector(up, shift)
    cam(camera, pos.x, pos.y, pos.z, tgt.x, tgt.y, tgt.z, fov)
  }
}

// ------------------------------------------------------------------ the intro card
/**
 * The intro card: a cream tag with the name in big terracotta lettering, the plant in small caps, and the card line
 * (the archetype in bold, then the joke). Pops in on `u` from 0, holds, slides away as `out` goes 0 -> 1. `y` is its
 * centre (0 top, 1 bottom).
 */
function card(m: Member, y: number, u: number, out = 0, u2 = 1, typed = Infinity) {
  if (u <= 0 || out >= 1) return
  const s = back(clamp01(u))
  const slide = ease(clamp01(out))
  ctx.save()
  ctx.translate(W / 2 + slide * W, y * H)
  ctx.rotate(-0.02)
  ctx.scale(s, s)
  const w = 920
  const h = 330
  ctx.fillStyle = CREAM
  ctx.strokeStyle = INK
  ctx.lineWidth = 7
  ctx.beginPath()
  ctx.roundRect(-w / 2, -h / 2, w, h, 40)
  ctx.fill()
  ctx.stroke()
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  const left = -w / 2 + 44
  const right = w / 2 - 40
  inkText(m.name, left, -82, 100)
  // the role pops in under the name
  if (u2 > 0) {
    const s2 = back(clamp01(u2))
    ctx.save()
    ctx.translate(left, 10)
    ctx.scale(s2, s2)
    ctx.font = `800 46px ${FONT}`
    ctx.fillStyle = TERRA
    ctx.fillText(m.title, 0, 0)
    ctx.restore()
  }
  // the joke types out on the next line(s), wrapped where the full words would wrap
  if (typed > 0) {
    ctx.font = `400 42px ${FONT}`
    ctx.fillStyle = INK
    let left2 = Math.floor(typed)
    let x = left
    let yy = 72
    for (const wd of m.joke.split(' ')) {
      if (left2 <= 0) break
      const ww = ctx.measureText(wd + ' ').width
      if (x + ww - 10 > right) (x = left), (yy += 50)
      ctx.fillText(wd.slice(0, left2), x, yy)
      left2 -= wd.length + 1
      x += ww
    }
  }
  ctx.restore()
}
/** A card shown from `t0` for `len` seconds: the name, the role 0.4 s later, then the joke typing out. */
function cardAt(m: Member, y: number, lt: number, t0: number, len: number) {
  const typeFrom = t0 + 0.75
  const typed = lt < typeFrom ? 0 : (lt - typeFrom) * 32
  card(m, y, (lt - t0) / 0.3, (lt - t0 - len) / 0.35, (lt - t0 - 0.4) / 0.3, typed)
}
/** A line of text on a card in the same style (no name): "Blanche has turned over a new leaf." */
function banner(lines: string[], y: number, u: number, out = 0) {
  if (u <= 0 || out >= 1) return
  const s = back(clamp01(u))
  ctx.save()
  ctx.translate(W / 2 + ease(clamp01(out)) * W, y * H)
  ctx.rotate(0.015)
  ctx.scale(s, s)
  const w = 920
  const h = 90 + lines.length * 84
  ctx.fillStyle = CREAM
  ctx.strokeStyle = INK
  ctx.lineWidth = 7
  ctx.beginPath()
  ctx.roundRect(-w / 2, -h / 2, w, h, 40)
  ctx.fill()
  ctx.stroke()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  lines.forEach((l, i) => inkText(l, 0, (i - (lines.length - 1) / 2) * 84, 70, 'center'))
  ctx.restore()
}
/** Intro framing: the character centred, feet just above the card, the card at the bottom. */
const CARD_Y = 0.82
const FEET = 0.68

// the look test (?looktest=1&look=...): a few cast members side by side
const lookTest: Shot = {
  bars: 1,
  light: 'midday',
  setup() {
    ;['Blanche', 'Domino', 'Raven', 'Finn'].forEach((n, k) => tot(who(n), k % 2 ? 0.95 : -0.95, k < 2 ? -1.0 : 1.0, k % 2 ? -0.25 : 0.25, 'idle', k))
  },
  update() {
    high(0, 0.8, 0, 11.5, 30, 0, 38)
  },
}


// 1. the cast: all ten in a staggered diagonal from the back right to the front left, each doing their own thing
const HIDE_T = 5.2 // the hide clip (Pearl ducks into her pot with it)
const POP = HIDE_T * 0.74
/**
 * The fake-out: a still, tasteful product shot of potted plants (legs and arms tucked away). Beat. They all pop out at
 * once and scatter off every edge of the frame. Pearl (the spy) stays put, still pretending, then pops out late and
 * scurries after them.
 */
const FAKE: [string, number, number, number][] = [
  // name, x, z, the way it runs (radians, 0 = towards the camera): a neat two-row arrangement, tallest at the back
  ['Raven', -3.1, -6.0, -2.4], ['Blanche', 0, -6.8, 2.9], ['Finn', 3.1, -5.9, 2.2],
  ['Stella', -3.3, -3.2, -1.9], ['Dottie', -1.1, -3.4, -1.2], ['Tutu', 1.15, -3.3, 1.0], ['Velvet', 3.3, -3.1, 1.8],
  ['Domino', -2.1, -0.4, -0.7], ['Pearl', 0, -0.2, 0.62], ['Sunny', 2.1, -0.4, 1.4],
]
const STILL = BEAT * 3.5 // the product shot holds
const LATE = BEAT * 6.5 // Pearl gives up the act
let fakers: { a: Actor; pop: number; anim: MonsterAnim }[] = []
shots.push({
  bars: 3.25,
  light: 'midday',
  bg: '#e1e8f2', // a cool, plain product-shot backdrop
  setup() {
    music('intro') // music from frame one; the full band comes in when they pop out
    fakers = FAKE.map(([n, x, z, out], k) => {
      const a = tot(who(n, k), x, z, out, 'hide', 0)
      a.ts = 0
      a.tot.t0 = HIDE_T * 0.62 // tucked in and still
      const late = n === 'Pearl'
      return { a, pop: late ? LATE : STILL + hash(k + 3) * 0.12, anim: late ? 'sneak' : (['run', 'run', 'scamper', 'run'] as MonsterAnim[])[k % 4] }
    })
  },
  update(lt) {
    for (const f of fakers) {
      const h = f.a.tot
      const dt = lt - f.pop
      if (dt < 0) (h.anim = 'hide'), (h.t0 = HIDE_T * 0.62) // perfectly still
      else if (dt < (f.anim === 'sneak' ? 0.6 : 1.0)) (h.anim = 'hide'), (h.t0 = POP - 0.05 + dt) // legs and arms burst out, a jump
      else if (f.anim === 'sneak') (h.anim = 'run'), (h.t0 = dt - 0.6) // and she legs it
      else (h.anim = f.anim), (h.t0 = dt - 1.0)
    }
    at(lt, STILL, 'pop', () => (sfx('pop', 1), sfx('boing', 0.8), music('full'), (kick = 0.8)))
    at(lt, STILL + 0.5, 'patter', () => sfx('patter', 0.9))
    at(lt, LATE, 'late', () => (sfx('pop', 0.7), sfx('squeak', 0.6)))
    const u = ease(clamp01(lt / (BAR * 3.25)))
    // once the others have scattered, push in on Pearl, still pretending to be a plant
    // (framed on where she stood, and held: she runs out of the bottom right of the frame)
    const pearl = new THREE.Vector3(...([0, 0, -0.2] as const))
    const pin = ease(clamp01((lt - STILL - 0.7) / 0.9))
    high(lerp(0, pearl.x, pin), lerp(1.4, 0.7, pin), lerp(-3.3, pearl.z, pin), lerp(lerp(23.0, 22.0, u), 9.5, pin), lerp(30, 22, pin), 0, 36)
  },
})

// 2. Sunny (the optimist, bouncing) -> hard cut -> Raven (the goth, dragging)
let sunny: Actor
shots.push({
  bars: 1.75,
  flash: true,
  light: 'morning',
  bg: '#fff0b8', // butter yellow
  setup() {
    sunny = tot(who('Sunny'), 0, 0, 0.3, 'hops', 0.25)
    sunny.tot.pose(0.25)
    frame([sunny], { fill: 0.78, feet: FEET, elev: 16, yaw: 0.35 })
  },
  update(lt) {
    at(lt, 0.4, 'b1', () => sfx('boing', 0.5))
    at(lt, 1.2, 'b2', () => sfx('boing', 0.6))
  },
  text(lt) {
    cardAt(M_('Sunny'), CARD_Y, lt, 0.15, BAR * 1.6)
  },
})
let raven: Actor
shots.push({
  bars: 1.75,
  light: 'morning',
  bg: '#ddd0e8', // dusky lilac
  setup() {
    raven = tot(who('Raven'), -0.9, 0, Math.PI / 2 - 0.35, 'trudge', 0.2)
    raven.tot.pose(0.2)
    frame([raven], { fill: 0.7, feet: FEET, elev: 14, yaw: 0.25 })
  },
  update() {},
  text(lt) {
    cardAt(M_('Raven'), CARD_Y, lt, 0.1, BAR * 1.6)
  },
})

// 3. the crowd: a field of tots running off every edge, everyone doing their own thing; then a cut in to Domino
const FIELD_SP: Species[] = ['monstera', 'pothos', 'snake', 'peacelily', 'calathea', 'zz', 'bop', 'whale', 'albo', 'cylindrical', 'whitefusion', 'laurentii', 'satin', 'dottie', 'thai', 'raven']
const FIELD_POTS = ['classic', 'stepped', 'cylinder', 'belly', 'tulip', 'fluted', 'ribbed', 'hex', 'gem', 'crate', 'barrel', 'basket', 'bucket', 'amphora', 'striped', 'drip', 'checker', 'wavy', 'hearts', 'crackle', 'mossy', 'scales', 'diamond', 'pinstripe', 'cauldron', 'mug', 'box', 'bowl']
/** A staggered field: `cols` across, `rows` deep, spaced so nobody overlaps; skips spots near any of `keep`. */
function field(cols: number, rows: number, dx: number, dz: number, z0: number, keep: [number, number][] = []) {
  const out: [number, number][] = []
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = (c - (cols - 1) / 2) * dx + (r % 2) * dx * 0.5 + (hash(r * 31 + c) - 0.5) * 0.4
      const z = z0 - r * dz + (hash(r * 7 + c * 3) - 0.5) * 0.3
      if (keep.some(([kx, kz]) => Math.hypot(kx - x, kz - z) < 1.7)) continue
      out.push([x, z])
    }
  return out
}
/** A field extra: a random plant and pot (never a cast member's own combination). */
function extra(k: number, x: number, z: number, anim: MonsterAnim, ry = (hash(k) - 0.5) * 0.8) {
  const sp = FIELD_SP[(k * 7) % FIELD_SP.length]
  return tot({ species: sp, age: age(sp), size: SIZE[sp] ?? 1, ...look(k), pot: FIELD_POTS[(k * 5) % FIELD_POTS.length], cw: k % 2 }, x, z, ry, anim, hash(k + 7) * 3)
}
const ACTS: MonsterAnim[] = ['hops', 'scamper', 'spin', 'wiggle', 'hop', 'idle', 'rubhands', 'waddle', 'hops', 'idle', 'pickup', 'hop']
function crowdField(keep: [number, number][], k0 = 0, z0 = 2.4, cols = 5, rows = 6, dx = 2.3, dz = 2.5) {
  field(cols, rows, dx, dz, z0, keep).forEach(([x, z], k) => {
    const anim = ACTS[(k + k0) % ACTS.length]
    const moving = anim === 'scamper' || anim === 'waddle'
    const a = extra(k + k0, x, z, anim, moving ? Math.PI / 2 : undefined)
    if (moving) (a.turn = 0.55), (a.tot.root.position.x -= a.turn)
  })
}
shots.push({
  bars: 2,
  flash: true,
  light: 'morning',
  bg: '#f6ead6',
  setup() {
    sfx('patter', 0.7)
    crowdField([], 0, 2.4, 4, 5, 3.3, 3.4) // fewer, further apart: easier to read
  },
  update(lt) {
    at(lt, 1.1, 'squeak', () => sfx('squeak', 0.5))
    const u = ease(clamp01(lt / (BAR * 2)))
    high(lerp(-0.3, 0.3, u), 0.6, -3.0, lerp(19.5, 18.5, u), 40, 0, 40)
  },
})
let domino: Actor
shots.push({
  bars: 2,
  flash: true,
  light: 'morning',
  bg: '#dbe8f6', // soft blue
  setup() {
    domino = tot(who('Domino'), 0, 0, 0.2, 'twist', 0)
    domino.ts = 0.5 / BEAT
    domino.tot.pose(0)
    frame([domino], { fill: 0.72, feet: FEET, elev: 16, yaw: 0.2 })
  },
  update() {},
  text(lt) {
    cardAt(M_('Domino'), CARD_Y, lt, 0.15, BAR * 1.8)
  },
})

// 4. the chalk lesson: an Albo (white half-moons) crossed with a Thai Constellation (cream speckles); their babies
// carry one, the other, both, or neither, and the grandbabies shuffle those again
const BOARD_BEATS = 12
shots.push({
  bars: BOARD_BEATS / 4,
  flash: true,
  light: 'slate',
  setup() {
    sfx('chalk', 0.8)
  },
  update(lt) {
    for (let i = 0; i < 6; i++) at(lt, 0.3 + i * 0.6, 'chalk' + i, () => sfx('chalk', 0.35))
  },
  board(lt) {
    drawPedigree(lt, false)
    return true
  },
})
function drawPedigree(lt: number, branch: boolean, bu = 0) {
  ctx.drawImage(slate, 0, 0)
  const u = (t: number, d = 0.5) => (branch ? 1 : clamp01((lt - t) / d))
  chalkText('Advanced plant genealogy', W / 2, 330, 72, u(0.1, 0.9))
  ctx.save()
  ctx.globalAlpha = 0.6
  chalkLine([[220, 380], [860, 380]], u(0.9, 0.5), 4)
  ctx.restore()
  chalkLeaf(320, 640, 260, 'halfmoon', 1, u(0.6, 0.6), u(1.0, 0.4), -0.12)
  chalkLeaf(760, 640, 260, 'speckle', 2, u(0.9, 0.6), u(1.3, 0.4), 0.12)
  chalkText('×', W / 2, 640, 110, u(1.2, 0.2))
  chalkText('Albo', 320, 462, 40, u(1.3, 0.3))
  chalkText('Thai', 760, 462, 40, u(1.4, 0.3))
  chalkLine([[320, 800], [320, 880], [760, 880], [760, 800]], u(1.6, 0.5))
  chalkLine([[540, 880], [540, 980]], u(2.0, 0.2))
  chalkLine([[160, 980], [920, 980]], u(2.1, 0.4))
  // the babies: one parent's look, the other's, both at once, or neither
  const kids: Varieg[] = ['halfmoon', 'mix', 'none', 'speckle', 'mix']
  kids.forEach((p, k) => {
    const x = 160 + k * 190
    chalkLine([[x, 980], [x, 1040]], u(2.4 + k * 0.12, 0.15))
    chalkLeaf(x, 1160, 150, p, 10 + k * 3, u(2.5 + k * 0.12, 0.4), u(2.8 + k * 0.12, 0.3), (k - 2) * 0.12)
  })
  for (let k = 0; k < 9; k++) {
    const x = 130 + k * 102
    chalkLeaf(x, 1410, 86, (['mix', 'halfmoon', 'speckle', 'none', 'mix', 'speckle', 'halfmoon', 'mix', 'none'] as Varieg[])[k], 40 + k, u(3.3 + k * 0.08, 0.3), u(3.5 + k * 0.08, 0.25), (hash(k) - 0.5) * 0.5)
  }
  if (!branch) {
    chalkText('no two leaves the same', W / 2, 1640, 58, u(4.3, 0.7))
    return
  }
  // Blanche's new branch: a plain leaf, an arrow, her new half-white leaf, and a starburst
  ctx.save()
  ctx.fillStyle = 'rgba(47,59,53,0.9)'
  ctx.fillRect(0, 1500, W, 420)
  ctx.restore()
  chalkLeaf(300, 1690, 170, 'none', 70, clamp01(bu / 0.25), 0, -0.1)
  chalkLine([[420, 1690], [600, 1690]], clamp01((bu - 0.2) / 0.2), 6)
  chalkLine([[575, 1670], [605, 1690], [575, 1710]], clamp01((bu - 0.35) / 0.1), 6)
  chalkLeaf(760, 1690, 190, 'halfmoon', 71, clamp01((bu - 0.4) / 0.25), clamp01((bu - 0.55) / 0.2), 0.1)
  chalkText('Blanche', 300, 1840, 46, clamp01((bu - 0.1) / 0.3))
  chalkText('new leaf!', 760, 1850, 46, clamp01((bu - 0.6) / 0.3))
  if (bu > 0.75) starburst(900, 1570, 46, (bu - 0.75) / 0.25)
}
/** A chalk starburst (the "it's new!" sparkle). */
function starburst(x: number, y: number, r: number, u: number) {
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.2
    const r0 = r * 0.35
    const r1 = r * (k % 2 ? 0.75 : 1.1) * clamp01(u * 1.5)
    chalkLine([[x + Math.cos(a) * r0, y + Math.sin(a) * r0], [x + Math.cos(a) * r1, y + Math.sin(a) * r1]], 1, 5)
  }
}

// 5. Blanche struts forward (her card); "Blanche has turned over a new leaf"; her plain monstera pops out a new,
// half-white leaf (a smooth springy grow from its node); a hand-drawn arrow points at it
const LEAF_TO = 13.97 / 14
let blancheG: Actor
let sport: THREE.Object3D | null = null
const WALK_END = 2.0
const LINE_AT = BAR * 2.35
const POP_AT = BAR * 2.75
const SHOT5 = BAR * 4
let leafCam: { p: THREE.Vector3; q: THREE.Quaternion } | null = null
shots.push({
  bars: 4,
  flash: true,
  light: 'midday',
  bg: '#cfe0ef', // soft blue: her white pot, peachy limbs and the white leaf all stand off it
  setup() {
    blancheG = tot({ ...who('Blanche'), age: LEAF_TO }, 0, -2.6, 0, 'strut', 0.3)
    blancheG.tot.setPlant('monstera', LEAF_TO, true)
    blancheG.tot.pose(0)
    blancheG.tot.root.updateMatrixWorld(true)
    // turn the plant so the new leaf faces the camera
    const lp = sportLeafLocal()
    blancheG.tot.holder.rotation.y = -Math.atan2(lp.x, lp.z) + 0.2
    sport = null
    blancheG.tot.holder.traverse((o) => (o.userData.sport ? (sport = o) : null))
    if (sport) (sport as THREE.Object3D).scale.setScalar(0.001)
    leafCam = null
  },
  update(lt) {
    const h = blancheG.tot
    const HOP_AT = POP_AT + 0.35
    if (lt < WALK_END) h.anim = 'strut'
    else if (lt >= HOP_AT && lt < HOP_AT + 1.9) (h.anim = 'hop'), (blancheG.ts = 0), (h.t0 = lt - HOP_AT) // a happy hop
    else (h.anim = 'idle'), (blancheG.ts = 0), (h.t0 = lt)
    // the new leaf grows out of its node: a smooth springy scale-up (no rebuilding, so no twitch)
    const g = clamp01((lt - POP_AT) / 0.9)
    const k = g <= 0 ? 0.001 : ease(g) + Math.exp(-g * 4) * Math.sin(g * 10) * 0.15
    if (sport) (sport as THREE.Object3D).scale.setScalar(Math.max(0.001, k))
    at(lt, POP_AT, 'pop', () => sfx('pop', 0.9))
    at(lt, POP_AT + 0.55, 'reveal', () => (sfx('chime', 1), (kick = 0.5)))
    if (!leafCam) {
      // framed once, where she stops: the camera holds still while she walks into it
      const z = h.root.position.z
      let travel = 0
      for (let t = 0; t < WALK_END; t += 1 / FPS) travel += h.pose(t, 'strut') / FPS
      h.root.position.z = -2.6 + travel
      h.pose(0)
      frame([blancheG], { fill: 0.74, feet: FEET + 0.04, elev: 26, yaw: 0.12 })
      leafCam = { p: camera.position.clone(), q: camera.quaternion.clone() }
      h.root.position.z = z
    }
    camera.position.copy(leafCam.p)
    camera.quaternion.copy(leafCam.q)
  },
  text(lt) {
    cardAt(M_('Blanche'), CARD_Y, lt, WALK_END - 0.3, LINE_AT - WALK_END + 0.1)
    banner(['Blanche has turned', 'over a new leaf.'], 0.09, (lt - LINE_AT) / 0.3, (lt - SHOT5 + 0.4) / 0.35)
  },
})
/** A hand-drawn ink line along points, drawn on progressively (u 0..1), with a slightly varying width like a marker. */
function handLine(pts: [number, number][], u: number, w: number) {
  if (u <= 0) return
  const n = Math.max(2, Math.ceil(pts.length * clamp01(u)))
  ctx.save()
  ctx.strokeStyle = INK
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (let i = 1; i < n; i++) {
    ctx.lineWidth = w * (0.85 + 0.3 * Math.sin(i * 0.9))
    ctx.beginPath()
    ctx.moveTo(pts[i - 1][0], pts[i - 1][1])
    ctx.lineTo(pts[i][0], pts[i][1])
    ctx.stroke()
  }
  ctx.restore()
}
/** The sport leaf's blade centre, in world space (as an object with a position). */
function sportLeaf() {
  let found: THREE.Object3D | null = null
  blancheG.tot.holder.traverse((o) => (o.userData.sport ? (found = o) : null))
  if (!found) return null
  const b = new THREE.Box3().setFromObject(found)
  if (b.isEmpty()) return null
  const o = new THREE.Object3D()
  o.position.copy(b.getCenter(new THREE.Vector3()))
  return o
}
function sportLeafLocal() {
  const w = sportLeaf()!.position
  return blancheG.tot.holder.worldToLocal(w.clone())
}

// 6. snack: Dottie rubs her belly; the watering can soaks Finn, who shakes it off all over her
let can: THREE.Object3D
let jar: THREE.Object3D
const pellets: THREE.Mesh[] = []
let finn: Actor
let dottie: Actor
const drops: THREE.Mesh[] = []
const dropMat = new THREE.MeshStandardMaterial({ color: '#8fd0f2', roughness: 0.1, transparent: true, opacity: 0.9 })
const SHAKE_AT = BAR * 2.85
shots.push({
  bars: 4,
  flash: true,
  light: 'midday',
  bg: '#dcecef', // sea glass
  setup() {
    dottie = tot(who('Dottie'), -0.95, -0.6, 0.35, 'bellyrub', 0)
    finn = tot(who('Finn'), 0.9, 0.7, -0.25, 'idle', 0)
    finn.ts = 0
    can = kitProp('can-kids', 1)
    jar = kitProp('food-balls', 1, PSCALE * 2.2)
    jar.visible = false
    pellets.length = 0
    for (let i = 0; i < 26; i++) {
      const pm = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshStandardMaterial({ color: '#f08a9a', roughness: 0.4 }))
      pm.visible = false
      pellets.push(pm)
      scene.add(pm)
      props.push(pm)
    }
    for (let i = 0; i < 20; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), dropMat)
      d.scale.set(0.8, 1.35, 0.8)
      drops[i] = d
      scene.add(d)
      props.push(d)
    }
  },
  update(lt) {
    // a jar of fertiliser pearls tips over Dottie and sprinkles her; she does a happy dance
    const j0 = BAR * 0.75
    const jIn = ease(clamp01((lt - j0) / 0.45))
    const jTip = ease(clamp01((lt - j0 - 0.35) / 0.3)) * (1 - ease(clamp01((lt - j0 - 1.6) / 0.3)))
    const jOut = ease(clamp01((lt - j0 - 1.8) / 0.45))
    jar.visible = lt > j0 && jOut < 1
    jar.position.set(lerp(-3.8, -1.55, jIn) - jOut * 3, 3.25 + jOut * 0.5, -0.4)
    jar.rotation.set(0, 0, -jTip * 2.0) // tips its mouth down over her
    jar.updateMatrixWorld(true)
    const mouth = new THREE.Vector3(0, 0.25, 0).applyMatrix4(jar.matrixWorld)
    pellets.forEach((pm, i) => {
      const age = lt - j0 - 0.55 - i * 0.04
      pm.visible = jTip > 0.5 && age > 0 && age < 0.7
      if (!pm.visible) return
      pm.position.set(mouth.x + (hash(i) - 0.5) * 0.35, mouth.y - 0.1 - 4.9 * age * age, mouth.z + (hash(i + 9) - 0.5) * 0.3)
    })
    at(lt, j0 + 0.6, 'sprinkle', () => sfx('rustle', 0.8))
    const dh = dottie.tot
    const danceAt = j0 + 1.1
    if (lt >= danceAt && lt < BAR * 2.4) (dh.anim = 'wiggle'), (dottie.ts = 0), (dh.t0 = (lt - danceAt) * (0.44 / BEAT))
    else (dh.anim = 'bellyrub'), (dottie.ts = 0), (dh.t0 = lt)
    at(lt, danceAt, 'yay', () => sfx('chime', 0.5))
    // the can swoops in over Finn from the right, tips its spout down, pours, and leaves
    const t0 = BAR * 1.9
    const inU = ease(clamp01((lt - t0) / 0.5))
    const tip = ease(clamp01((lt - t0 - 0.4) / 0.35)) * (1 - ease(clamp01((lt - SHAKE_AT + 0.1) / 0.35)))
    const outU = ease(clamp01((lt - SHAKE_AT) / 0.6))
    can.position.set(lerp(3.6, 1.75, inU) + outU * 3, 3.9 + outU * 0.6, 0.7)
    can.rotation.set(0, Math.PI, -0.25 - tip * 0.75)
    can.updateMatrixWorld(true)
    // water falls from the rose: each drop leaves the spout and falls under gravity
    const rose = can.getObjectByName('rose')!
    const sp = rose.getWorldPosition(new THREE.Vector3())
    drops.forEach((d, i) => {
      const life = 0.55
      const age = (lt * 1.0 + i * (life / drops.length)) % life
      d.visible = tip > 0.55
      const vx = -0.6 + (hash(i) - 0.5) * 0.5
      const vz = (hash(i + 5) - 0.5) * 0.5
      d.position.set(sp.x + vx * age, sp.y - 0.05 - 4.9 * age * age - 0.6 * age, sp.z + vz * age)
    })
    at(lt, t0 + 0.6, 'pour', () => sfx('splash', 0.6))
    const h = finn.tot
    h.anim = lt < SHAKE_AT ? 'idle' : 'shake'
    h.t0 = lt < SHAKE_AT ? lt : 0.2 + (lt - SHAKE_AT)
    at(lt, SHAKE_AT + 0.3, 'shake', () => (sfx('shake'), sfx('splash', 0.7)))
    if (lt < 0.05) frame([dottie, finn], { fill: 0.92, feet: FEET - 0.07, elev: 18, yaw: 0 })
  },
  text(lt) {
    cardAt(M_('Dottie'), CARD_Y, lt, 0.15, BAR * 1.65)
    cardAt(M_('Finn'), CARD_Y, lt, BAR * 2.0, BAR * 1.9)
  },
})

// 7. the swing: Stella alone in a macramé cradle, three-quarters to camera, filling the frame, the hook off the top
let stella: Actor
shots.push({
  bars: 2.5,
  flash: true,
  light: 'midday',
  bg: '#d9ddf5', // dreamy periwinkle
  setup() {
    stella = tot(who('Stella'), Math.cos(0.47) * 0.35, 0, -Math.sin(0.47) * 0.35, 'swing', 0.3)
    hang(stella, 'macrame', 0.55)
    sfx('whoosh', 0.5)
  },
  update(lt) {
    for (let i = 0; i < 4; i++) at(lt, 0.4 + i * 1.1, 'w' + i, () => sfx('whoosh', 0.3))
    const u = ease(clamp01(lt / (BAR * 2.5)))
    high(0, 1.6, 0, lerp(9.6, 9.2, u), 6, lerp(0.42, 0.52, u), 40) // three-quarters: the camera ~45° round from her front
  },
  text(lt) {
    cardAt(M_('Stella'), CARD_Y, lt, 0.3, BAR * 2.0)
  },
})

// 8. dance break: Tutu twirls, alone in the spotlight (her card)
let tutu: Actor
let dancers: Actor[] = []
shots.push({
  bars: 2,
  flash: true,
  light: 'disco',
  bg: '#fde0e8', // ballet pink
  setup() {
    music('drop')
    tutu = tot(who('Tutu'), 0, 0.9, 0, 'spin')
    tutu.ts = 2.2 / BAR
    dancers = [tutu]
  },
  update(lt) {
    const pulse = Math.max(0, Math.cos((Math.PI * 2 * lt) / BEAT))
    discoA.intensity = 14 * pulse
    discoB.intensity = 14 * (1 - pulse)
    if (lt < 0.05) frame(dancers, { fill: 0.72, feet: FEET, elev: 18, yaw: 0 })
  },
  text(lt) {
    cardAt(M_('Tutu'), CARD_Y, lt, 0.2, BAR * 1.7)
  },
})

// 9. the whole pack: a big grid seen from high up, like a technical sheet; every bar a wave swaps one thing for
// everyone (pots, then plants, then limbs, then proportions), then back to their own looks for a hop
const GRID_C = 6
const GRID_R = 7
const SWAP_POTS = ['tulip', 'gem', 'barrel', 'cylinder', 'stepped', 'drip', 'amphora', 'hearts', 'mossy', 'diamond', 'crackle', 'fluted', 'egg', 'scales', 'bucket', 'basket', 'crate', 'ribbed', 'hex', 'belly', 'checker', 'wavy', 'striped', 'cauldron', 'pinstripe', 'mug', 'classic', 'box', 'nursery', 'bowl']
let grid: { stages: TotOptions[]; a: Actor; on: number; x: number; z: number; k: number }[] = []
const STAGES = 5 // own look, + pot, + plant, + limbs, + proportions
shots.push({
  bars: 4.5,
  flash: true,
  light: 'midday',
  bg: '#dcecf4', // soft sky
  setup() {
    grid = []
    for (let r = 0; r < GRID_R; r++)
      for (let c = 0; c < GRID_C; c++) {
        const k = r * GRID_C + c
        // the cast are spread through it; the rest are a mix of everything in the pack
        const castIx = [2, 9, 14, 19, 22, 27, 31, 34, 39, 16].indexOf(k)
        const sp = FIELD_SP[(k * 7 + 3) % FIELD_SP.length]
        const base: TotOptions = castIx >= 0 ? who(MEMBERS[castIx].name, k) : { species: sp, age: age(sp), size: SIZE[sp] ?? 1, ...look(k), pot: FIELD_POTS[(k * 5) % FIELD_POTS.length], cw: k % 2 }
        const o1 = { ...base, pot: SWAP_POTS[(k * 7) % SWAP_POTS.length], cw: k % 3 }
        const sp2 = FIELD_SP[(k * 5 + 1) % FIELD_SP.length]
        const o2 = { ...o1, species: sp2, age: age(sp2), size: SIZE[sp2] ?? 1 }
        const o3 = { ...o2, ...look(k + 5) }
        const o4 = { ...o3, legs: [1.6, 0.7, 1.3, 0.8, 1.5, 1.0][k % 6], arms: [0.8, 1.4, 1.0, 1.5, 0.75, 1.2][k % 6] }
        const x = (c - (GRID_C - 1) / 2) * 2.25
        const z = (r - (GRID_R - 1) / 2) * 2.25
        grid.push({ stages: [base, o1, o2, o3, o4], a: tot(base, x, z, 0, 'idle', hash(k) * 3), on: 0, x, z, k })
      }
  },
  update(lt) {
    // a diagonal wave from the back left: bars 1-4 add one swap each, then everyone snaps back and hops
    grid.forEach((p) => {
      const wave = ((p.x - p.z + 14) / 28) * BEAT * 1.6
      let want = Math.min(STAGES - 1, Math.max(0, Math.floor((lt - BAR * 0.5 - wave) / BAR) + 1))
      if (lt < BAR * 0.5 + wave) want = 0
      if (lt >= BAR * 4 + wave * 0.3) want = 0
      if (want !== p.on) {
        scene.remove(p.a.tot.root, p.a.blob)
        release(p.a.tot.root)
        actors.splice(actors.indexOf(p.a), 1)
        p.on = want
        p.a = tot(p.stages[want], p.x, p.z, 0, 'idle', hash(p.k) * 3)
      }
      if (lt >= BAR * 4 + 0.1) (p.a.tot.anim = 'hop'), (p.a.ts = 0), (p.a.tot.t0 = Math.min(1.9, lt - BAR * 4))
    })
    for (let b = 1; b <= 4; b++) at(lt, BAR * (b - 0.5), 'w' + b, () => sfx('pop', 0.5))
    at(lt, BAR * 4 + 1.05, 'land', () => (sfx('tok', 0.8), (kick = 0.4)))
    const u = ease(clamp01(lt / (BAR * 4.5)))
    high(0, 0.4, 0, lerp(27, 25.5, u), 52, 0.0, 38)
  },
})

// 10. bugs: Velvet, perfectly calm (her card); one aphid (fine); five (NOT FINE); a brief panic; bug spray; calm
let velvet: Actor
let bugs: THREE.Object3D[] = []
const BUG = 0.14
shots.push({
  bars: 1.75,
  flash: true,
  light: 'midday',
  bg: '#d4efe4', // mint
  setup() {
    velvet = tot(who('Velvet'), 0, 0, 0.25, 'idle', 0.6)
    velvet.tot.pose(0.6)
    frame([velvet], { fill: 0.72, feet: FEET, elev: 18, yaw: 0.3 })
  },
  update() {},
  text(lt) {
    cardAt(M_('Velvet'), CARD_Y, lt, 0.1, BAR * 1.6)
  },
})
shots.push({
  bars: 1,
  light: 'midday',
  bg: '#d4efe4',
  setup() {
    velvet = tot(who('Velvet'), 0, 0, 0.25, 'idle', 0.6)
    velvet.tot.pose(0)
    bugs = infest(velvet.tot.holder, 'mite', 1, 6, BUG)
    sfx('pop', 0.8)
  },
  update(lt) {
    const stage = lt < 2 * BEAT ? 0 : 1
    at(lt, 2 * BEAT, 'five', () => {
      bugs = infest(velvet.tot.holder, 'mite', 5, 6, BUG)
      sfx('sting', 0.9)
      kick = 1.6
    })
    const c = new THREE.Vector3()
    for (const b of bugs) c.add(b.getWorldPosition(new THREE.Vector3()))
    c.multiplyScalar(1 / Math.max(1, bugs.length))
    const spread = bugs.reduce((m, b) => Math.max(m, b.getWorldPosition(new THREE.Vector3()).distanceTo(c)), 0)
    const d = stage === 0 ? 0.9 : 1.5 + spread * 1.4
    cam(camera, c.x + d * 0.35, c.y + d * 0.75, c.z + d * 0.9, c.x, c.y, c.z, 34)
  },
  text(lt) {
    const stage = lt < 2 * BEAT ? 0 : 1
    const local = lt - stage * 2 * BEAT
    pill(['One spider mite. Fine.', 'Five spider mites. NOT FINE.'][stage], 0.12, stage ? 76 : 60, (local - 0.1) / 0.2, stage ? { bg: TERRA, fg: CREAM } : {})
  },
})
let spray: THREE.Object3D
const mist: THREE.Mesh[] = []
const mistMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false })
const SPRAY_AT = 1.5
shots.push({
  bars: 1.5,
  flash: true,
  light: 'midday',
  bg: '#d4efe4',
  setup() {
    velvet = tot(who('Velvet'), 0, 0, 0.25, 'shake', 0)
    velvet.ts = 0
    infest(velvet.tot.holder, 'mite', 5, 6, BUG * 1.2)
    spray = kitProp('bug-spray')
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mistMat.clone())
      m.visible = false
      mist[i] = m
      scene.add(m)
      props.push(m)
    }
    sfx('panic', 1)
  },
  update(lt) {
    const h = velvet.tot
    if (lt < SPRAY_AT + 0.35) (h.anim = 'shake'), (h.t0 = 0.25 + lt * 1.4)
    else (h.anim = 'idle'), (h.t0 = lt)
    const sIn = ease(clamp01((lt - 0.7) / 0.35)) * (1 - ease(clamp01((lt - 2.4) / 0.35)))
    spray.visible = lt > 0.7 && lt < 2.8
    spray.position.set(lerp(3.0, 1.3, sIn), 2.0, 0.5)
    spray.rotation.set(0, -Math.PI / 2, 0.2 * sIn)
    at(lt, SPRAY_AT, 'spray', () => sfx('spray', 1))
    mist.forEach((m, i) => {
      const a = lt - SPRAY_AT - (i / mist.length) * 0.15
      m.visible = a > 0 && a < 0.9
      if (!m.visible) return
      const r = 0.3 + a * 1.4
      m.position.set(1.05 - a * 1.6 + (hash(i) - 0.5) * 0.3, 2.05 + (hash(i + 3) - 0.3) * r * 0.8, 0.5 + (hash(i + 6) - 0.5) * r * 0.6)
      m.scale.setScalar(0.6 + a * 2.5)
      ;(m.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - a / 0.9)
    })
    at(lt, SPRAY_AT + 0.3, 'gone', () => (clearPests(velvet.tot.holder), sfx('chime', 0.7)))
    high(0.35, 1.45, 0, 6.6, 18, 0.25, 40)
  },
})

// 11. quiet time: Pearl, on her own, ducks into her pot (her card)
let pearl: Actor
shots.push({
  bars: 2.5,
  flash: true,
  light: 'midday',
  bg: '#ecdfe9', // soft mauve, a little hush
  setup() {
    music('soft')
    pearl = tot(who('Pearl'), 0, 0.6, 0, 'hide', 0)
    pearl.ts = 0
  },
  update(lt) {
    // she looks round (idle), then ducks in at the card's punchline
    const h = pearl.tot
    const duck = BAR * 1.6
    if (lt < duck) (h.anim = 'idle'), (h.t0 = lt)
    else (h.anim = 'hide'), (h.t0 = Math.min(HIDE_T * 0.6, (lt - duck) * 1.2))
    at(lt, duck + 0.15, 'tuck', () => sfx('pop', 0.6))
    if (lt < 0.05) frame([pearl], { fill: 0.62, feet: FEET, elev: 20, yaw: 0.05 })
  },
  text(lt) {
    cardAt(M_('Pearl'), CARD_Y, lt, 0.2, BAR * 2.0)
  },
})

// 12. home time: the whole cast walks towards the camera and out at the front, Raven trudging last
const HOME: [string, MonsterAnim][] = [['Sunny', 'scamper'], ['Domino', 'walk'], ['Tutu', 'strut'], ['Finn', 'waddle'], ['Blanche', 'strut'], ['Dottie', 'carry'], ['Stella', 'walk'], ['Velvet', 'waddle'], ['Pearl', 'sneak'], ['Raven', 'trudge']]
shots.push({
  bars: 2.5,
  flash: true,
  light: 'midday',
  bg: '#fbe4d0', // peach
  setup() {
    music('full')
    // measure each one's walking speed, put the fastest at the front (so the line only ever spreads out, nobody walks
    // through anybody), and space them by their size
    const walkers = HOME.map(([n, anim], k) => {
      const a = tot(who(n, k), 0, 0, -0.42, anim, k * 0.31)
      let d = 0
      for (let t = 0; t < 3; t += 0.1) d += a.tot.pose(t) * 0.1
      return { a, speed: d / 3, size: who(n).size ?? 1 }
    })
    walkers.sort((p, q) => q.speed - p.speed)
    let along = 0
    walkers.forEach((w, k) => {
      if (k) along += 0.82 * (w.size + walkers[k - 1].size)
      const dir = new THREE.Vector3(Math.sin(-0.42), 0, Math.cos(-0.42))
      const side = new THREE.Vector3(dir.z, 0, -dir.x).multiplyScalar(k % 2 ? 0.45 : -0.45)
      w.a.tot.root.position.copy(dir.multiplyScalar(-along)).add(side)
    })
    // centre the line (it walks towards the camera through the shot)
    const mid = new THREE.Vector3()
    for (const w of walkers) mid.add(w.a.tot.root.position)
    mid.multiplyScalar(1 / walkers.length)
    for (const w of walkers) w.a.tot.root.position.sub(mid).add(new THREE.Vector3(0.8, 0, -3.2))
    sfx('patter', 0.6)
  },
  update(lt) {
    high(0.2, 0.9, -1.6, 21.5, 46, -0.05, 40) // the diagonal runs from the front left up to the back right
  },
})

// 13. end card: Sunny slides in, the cast lines up behind for a ta-da twirl, the logo on clear space above, RUN
let slider: Actor
shots.push({
  bars: 3.5,
  flash: true,
  light: 'midday',
  bg: '#f6ecd9', // warm cream: the logo reads on it
  setup() {
    music('end')
    slider = tot(who('Sunny'), -7.5, 0.4, Math.PI / 2, 'slide')
    const tiers: [string, number, number][] = [
      ['Blanche', 0, -7.4],
      ['Pearl', -3.5, -4.6], ['Stella', -1.4, -5.0], ['Velvet', 1.45, -5.0], ['Raven', 3.55, -4.6],
      ['Tutu', -3.3, -1.9], ['Domino', -1.65, -2.3], ['Finn', 1.75, -2.35], ['Dottie', 3.35, -1.9],
    ]
    tiers.forEach(([n, x, z], k) => tot(who(n, k), x, z, -x * 0.08, 'idle', k * 0.9))
  },
  update(lt) {
    const s = slider.tot
    const tw = BAR * 2.5
    if (lt < 3.0) (s.anim = 'slide'), (slider.ts = 0), (s.t0 = lt)
    actors.forEach((a, k) => {
      const go = tw + (k % 3) * 0.06 // a ripple of hops together, then they settle into their idles
      if (lt >= go && lt < go + 1.9) (a.tot.anim = 'hop'), (a.ts = 0), (a.tot.t0 = lt - go)
      else if (lt >= go + 1.9) (a.tot.anim = 'idle'), (a.ts = 0), (a.tot.t0 = lt - go - 1.9 + k)
      else if (a !== slider && lt >= 3.0) a.tot.anim = 'idle'
    })
    if (lt >= 3.0 && lt < tw) (s.anim = 'idle'), (slider.ts = 0), (s.t0 = lt - 3.0)
    s.root.rotation.y = lerp(Math.PI / 2, 0.15, ease(clamp01((lt - 3.0) / 0.45))) // turns to face us after the slide
    at(lt, 1.15, 'slide', () => (sfx('squeak'), sfx('whoosh', 0.6)))
    at(lt, tw + 0.95, 'tada', () => (sfx('tok', 0.8), sfx('chime')))
    high(0, 4.3, -3.6, 24.0, 34, 0, 40)
  },
  text(lt) {
    // a soft haze down from the top, like distance fog over the tallest leaves, so the title reads cleanly
    const hz = ease(clamp01((lt - 2.8) / 0.6))
    if (hz > 0) {
      const gr = ctx.createLinearGradient(0, 0, 0, H * 0.46)
      gr.addColorStop(0, `rgba(246,236,217,${0.95 * hz})`)
      gr.addColorStop(0.55, `rgba(246,236,217,${0.7 * hz})`)
      gr.addColorStop(1, 'rgba(246,236,217,0)')
      ctx.fillStyle = gr
      ctx.fillRect(0, 0, W, H * 0.46)
    }
    drawLogo(0.15, 760, (lt - 3.0) / 0.35)
  },
})

if (Q.has('looktest')) shots.splice(0, shots.length, lookTest)
// ?castone=<species>: one cast character on its own, for the character sheet
if (Q.has('castone'))
  shots.splice(0, shots.length, {
    bars: 1,
    light: 'midday',
    setup() {
      const sp = Q.get('castone') as Species
      const o = cast(sp, 0)
      if (Q.get('pot')) (o.pot = Q.get('pot')!), (o.cw = Number(Q.get('cw') ?? 0)) // try a different pot
      tot({ ...o, age: sp === 'pothos' ? 0.6 : 0.8 }, 0, 0, 0.35, 'idle', 0.4)
    },
    update() {
      const a = actors[0]
      const box = new THREE.Box3().setFromObject(a.tot.root)
      const c = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      high(0, c.y, 0, Math.max(size.y * 2.1, size.x * 3.0), 18, 0, 36)
    },
  })
const STARTS: number[] = []
let acc = 0
for (const s of shots) {
  STARTS.push(acc)
  acc += s.bars * BAR
}
const TOTAL = acc

// ------------------------------------------------------------------ the frame step
let shotIx = -1
function step(dt: number) {
  T += dt
  let ix = 0
  while (ix + 1 < shots.length && T >= STARTS[ix + 1]) ix++
  if (ix !== shotIx) {
    clearSet()
    shotIx = ix
    if (shots[ix].flash) flash = 1
    lighting(shots[ix].light, shots[ix].bg)
    shots[ix].setup()
  }
  const s = shots[ix]
  const lt = T - STARTS[ix]
  s.update(lt, dt)
  for (const a of actors) {
    if (!a.tot.root.visible) continue
    const t = a.ts === 0 ? 0 : lt * a.ts // ts 0: the shot drives the clock through t0
    const speed = a.tot.pose(t)
    if (speed > 0) {
      // travel along the tot's facing (forward is +Z), so planted feet stay put; turning ones walk in circles
      const r = a.tot.root
      const d = speed * dt * (a.ts || 1)
      if (a.turn) r.rotation.y += d / a.turn
      r.position.x += Math.sin(r.rotation.y) * d
      r.position.z += Math.cos(r.rotation.y) * d
    }
    a.tot.root.position.y = a.ground
    a.blob.position.set(a.tot.root.position.x, a.ground + 0.012, a.tot.root.position.z)
    const lift = Math.max(0, a.tot.monster.pot.group.position.y - a.tot.monster.potOffset) * 1.6
    a.blob.scale.setScalar((1.25 * a.tot.root.scale.x) / 1.6 / (1 + lift * 1.5))
  }
  applyLook(scene, LOOK)
  if (!s.board?.(lt)) {
    const f = camera.fov
    camera.fov = f - kick * 4
    camera.updateProjectionMatrix()
    renderer.render(scene, camera)
    camera.fov = f
    ctx.drawImage(renderer.domElement, 0, 0, W, H)
  }
  kick *= 0.82
  s.text?.(lt)
  if (flash > 0.01) {
    ctx.fillStyle = `rgba(255,248,236,${flash * 0.8})`
    ctx.fillRect(0, 0, W, H)
    flash *= 0.6
  }
}

async function main() {
  ctx.fillStyle = '#2a221c'
  ctx.fillRect(0, 0, W, H)
  await document.fonts.load(`800 100px Sniglet`)
  await document.fonts.load(`400 100px Sniglet`)
  await document.fonts.load(`700 100px Fredoka`)
  await document.fonts.load(`600 100px Fredoka`)
  kit = await loadKit()
  await Promise.all([logo, runMark, logoB].map((im) => (im.complete ? null : new Promise((r) => (im.onload = r)))))
  ;(window as any).__promo = { TOTAL, STARTS }
  if (RECORD) {
    const N = Math.round(TOTAL * FPS)
    for (let f = 0; f < N; f++) {
      step(1 / FPS)
      const blob = await new Promise<Blob>((r) => out.toBlob((b) => r(b!), 'image/jpeg', 0.93))
      await fetch(`${SAVE}/frame/${f}`, { method: 'POST', body: blob })
      document.title = `REC ${f}/${N}`
    }
    await fetch(`${SAVE}/events`, { method: 'POST', body: JSON.stringify({ fps: FPS, total: TOTAL, bpm: BPM, events }) })
    document.title = 'DONE'
    return
  }
  if (Q.has('sheet')) {
    const ts = Q.get('sheet')!.split(',').map(Number)
    const cols = Number(Q.get('cols') ?? 6)
    const cw = W / cols
    const ch = H / cols
    const sheet = document.createElement('canvas')
    sheet.width = W
    sheet.height = ch * Math.ceil(ts.length / cols)
    const sc = sheet.getContext('2d')!
    for (let i = 0; i < ts.length; i++) {
      while (T + 1 / FPS <= ts[i]) step(1 / FPS)
      sc.drawImage(out, (i % cols) * cw, Math.floor(i / cols) * ch, cw, ch)
      sc.fillStyle = '#000'
      sc.font = '20px sans-serif'
      sc.fillText(ts[i].toFixed(1) + 's', (i % cols) * cw + 6, Math.floor(i / cols) * ch + 22)
    }
    out.width = sheet.width
    out.height = sheet.height
    out.style.height = 'auto'
    out.style.width = '100vw'
    out.style.aspectRatio = 'auto'
    ctx.drawImage(sheet, 0, 0)
    document.title = 'SHEET'
    document.body.dataset.ready = '1'
    return
  }
  if (Q.has('at')) {
    const target = +Q.get('at')!
    while (T + 1 / FPS <= target) step(1 / FPS)
    document.title = 'AT ' + T.toFixed(2)
    document.body.dataset.ready = '1'
    return
  }
  document.body.dataset.ready = '1'
  let last = performance.now()
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    if (T + dt >= TOTAL) {
      T = 0
      shotIx = -1
      events = []
    }
    step(dt)
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
}
main()

