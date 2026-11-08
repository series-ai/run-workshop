import * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { paddedLeaf, profiles, type PaddedLeafOptions } from './plant/leafShapes'
import { withPattern, type PatternName } from './plant/leafPatterns'
import { PROFILES as SHAPES } from './plant/species'

/**
 * ?debug=lab : leaf lab. One leaf shape shown along its growth path (rolled-up youngster -> full-size open leaf), with
 * any pattern on top and free colours, so colourways can be tried per leaf:
 *   - leaf colour + pattern colour pickers, a Flip button that swaps them, and per-leaf preset colourways
 *   - the pattern layer is the same overlay the game uses, recoloured here (the game paints it in a fixed colour)
 */

interface LeafDef {
  label: string
  opts: Omit<PaddedLeafOptions, 'uv' | 'length'>
  /** How rolled the youngest leaf is (0..1). */
  roll: number
  patterns: PatternName[]
  /** [name, leaf colour, pattern colour, pattern] */
  colourways: [string, string, string, PatternName | 'none'][]
}

const SANS_PATTERNS: PatternName[] = ['trifasciata', 'laurentii', 'masoniana', 'var:whaleFin:0', 'var:whaleFin:3']

const LEAVES: Record<string, LeafDef> = {
  sword: {
    label: 'Snake plant (sword)',
    opts: { halfWidth: profiles.sword, cup: 0.03, bend: 0.015, thickness: 0.07, samples: 16 },
    roll: 0.85,
    patterns: SANS_PATTERNS,
    colourways: [
      ['Trifasciata', '#2f5a3a', '#9cbf8f', 'trifasciata'],
      ['Classic (pale)', '#7fa572', '#2f5a3a', 'trifasciata'],
      ['Laurentii', '#3c6a45', '#e4d35e', 'laurentii'],
      ['Black Coral', '#1f3328', '#a9b8a8', 'trifasciata'],
      ['Moonshine', '#c3d4bf', '#9fb79d', 'none'],
    ],
  },
  whale: {
    label: 'Whale fin',
    opts: { halfWidth: profiles.whaleFin, cup: -0.04, bend: 0.06 },
    roll: 0.9,
    patterns: SANS_PATTERNS,
    colourways: [
      ['Masoniana', '#3c6e4c', '#7ab07a', 'var:whaleFin:0'],
      ['Dark', '#24452f', '#5f8f63', 'var:whaleFin:3'],
      ['Silver', '#a8bfa6', '#6e9671', 'var:whaleFin:0'],
      ['Variegated edge', '#3c6e4c', '#e4d35e', 'laurentii'],
    ],
  },
  hahnii: {
    label: "Snake plant 'Hahnii' (bird's nest)",
    opts: { halfWidth: profiles.hahnii, cup: 0.05, bend: 0.05, thickness: 0.09 },
    roll: 0.8,
    patterns: SANS_PATTERNS,
    colourways: [
      ['Hahnii', '#355f3e', '#8fb886', 'trifasciata'],
      ['Golden Hahnii', '#4a7a46', '#e4d35e', 'laurentii'],
      ['Silver Hahnii', '#b9cbb3', '#6f9672', 'trifasciata'],
    ],
  },
  peacelily: {
    label: 'Peace lily',
    opts: { halfWidth: SHAPES.peaceLily, cup: -0.045, bend: 0.2 },
    roll: 0.75,
    patterns: ['var:peaceLilyDomino:0', 'var:peaceLilyDomino:4', 'flecks'],
    colourways: [
      ['Plain', '#2e6b42', '#f6f6ee', 'none'],
      ['Domino', '#2e6b42', '#f6f6ee', 'var:peaceLilyDomino:0'],
    ],
  },
  alocasia: {
    label: 'Alocasia',
    opts: { halfWidth: SHAPES.alocasia, cup: -0.03, bend: 0.06, notch: 0.3 },
    roll: 0.7,
    patterns: ['polly', 'var:alocasiaFrydekVar:1', 'var:alocasiaFrydekVar:5'],
    colourways: [
      ['Polly', '#1f3f2e', '#e6efd9', 'polly'],
      ['Frydek variegata', '#1f3f2e', '#fbfbf4', 'var:alocasiaFrydekVar:1'],
    ],
  },
  calathea: {
    label: 'Calathea',
    opts: { halfWidth: SHAPES.calathea, cup: -0.04, bend: 0.08 },
    roll: 0.75,
    patterns: ['orbifolia', 'var:calatheaWhiteFusion:0', 'var:calatheaWhiteFusion:2'],
    colourways: [
      ['Orbifolia', '#4f8a4f', '#cfe2b2', 'orbifolia'],
      ['White Fusion', '#4f8a4f', '#faf8ff', 'var:calatheaWhiteFusion:0'],
    ],
  },
  bop: {
    label: 'Bird of paradise',
    opts: { halfWidth: SHAPES.paddle, cup: -0.025, bend: 0.03 },
    roll: 0.85,
    patterns: ['flecks'],
    colourways: [['Plain', '#5b7a52', '#e6efe2', 'none']],
  },
}

const STAGES = 6

export function runLab(scene: THREE.Scene, camera: THREE.PerspectiveCamera, controls: OrbitControls, params: URLSearchParams) {
  let leafKey = params.get('leaf') && LEAVES[params.get('leaf')!] ? params.get('leaf')! : 'sword'
  let [, leafColour, patColour, pattern] = LEAVES[leafKey].colourways[0] as [string, string, string, PatternName | 'none']
  const holder = new THREE.Group()
  scene.add(holder)
  camera.position.set(0, 1.6, 6.5)
  controls.target.set(0, 0.8, 0)
  controls.update()

  /** Pattern textures recoloured: the overlay's painted colour replaced by white so material.color can tint it. */
  const whiteTex = new Map<THREE.Texture, THREE.Texture>()
  const whiteOf = (t: THREE.Texture) => {
    let w = whiteTex.get(t)
    if (!w) {
      const src = t.image as HTMLCanvasElement
      const c = document.createElement('canvas')
      c.width = src.width
      c.height = src.height
      const ctx = c.getContext('2d')!
      ctx.drawImage(src, 0, 0)
      ctx.globalCompositeOperation = 'source-in'
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, c.width, c.height)
      w = new THREE.CanvasTexture(c)
      w.colorSpace = THREE.SRGBColorSpace
      w.channel = 1
      whiteTex.set(t, w)
    }
    return w
  }

  const build = () => {
    holder.clear()
    const def = LEAVES[leafKey]
    const base = new THREE.Color(leafColour)
    const patMat = new Map<THREE.Texture, THREE.Material>()
    let x = 0
    const items: THREE.Object3D[] = []
    for (let i = 0; i < STAGES; i++) {
      const m = i / (STAGES - 1)
      const len = 0.35 + 0.95 * m
      const roll = def.roll * Math.pow(1 - m, 1.4)
      const geo = paddedLeaf({ ...def.opts, length: len, roll, uv: { u0: 0, u1: 0, vBase: 0, vTip: 0 } })
      // plain base colour, a little darker at the base and lighter toward the tip (vertex colours)
      const pos = geo.getAttribute('position')
      const col = new Float32Array(pos.count * 3)
      const c = new THREE.Color()
      for (let k = 0; k < pos.count; k++) {
        const t = THREE.MathUtils.clamp(pos.getY(k) / len, 0, 1)
        c.copy(base).multiplyScalar(0.82 + 0.33 * t)
        col.set([c.r, c.g, c.b], k * 3)
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
      const leaf = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }))
      let obj: THREE.Object3D = leaf
      if (pattern !== 'none') {
        obj = withPattern(leaf, pattern, undefined, 'contour', true)
        obj.traverse((o) => {
          const mesh = o as THREE.Mesh
          if (!mesh.isMesh || mesh.renderOrder !== 1) return
          const src = (mesh.material as THREE.MeshStandardMaterial).map!
          let mat = patMat.get(src)
          if (!mat) {
            const w = whiteOf(src)
            const pc = new THREE.Color(patColour)
            mat = new THREE.MeshStandardMaterial({
              color: pc, map: w, alphaTest: 0.5, emissive: pc, emissiveMap: w, emissiveIntensity: 0.18,
              polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, roughness: 0.9, side: THREE.DoubleSide,
            })
            patMat.set(src, mat)
          }
          mesh.material = mat
        })
      }
      const box = new THREE.Box3().setFromObject(obj)
      const w = box.max.x - box.min.x
      obj.position.x = x - box.min.x
      obj.rotation.y = -0.25
      x += w + 0.25
      items.push(obj)
    }
    items.forEach((o) => {
      o.position.x -= x / 2
      holder.add(o)
    })
    const span = new THREE.Box3().setFromObject(holder).getSize(new THREE.Vector3())
    const k = Math.max(span.x / 5.2, span.y / 2.2, 0.6)
    camera.position.set(0, 0.6 + 1.0 * k, 6.5 * k)
    controls.target.set(0, span.y * 0.45, 0)
    controls.update()
  }

  // --- UI ---
  const ui = document.getElementById('ui')!
  ui.style.flexDirection = 'column'
  ui.style.gap = '8px'
  const pill = (on: boolean) => `padding:4px 8px;border:0;border-radius:4px;cursor:pointer;font:inherit;${on ? 'background:#f2ebe0;color:#1e2918' : 'background:#3a4a30;color:#f2ebe0'}`
  const render = () => {
    const def = LEAVES[leafKey]
    ui.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center"><span style="width:80px;opacity:.7">leaf</span>
        ${Object.entries(LEAVES).map(([k, d]) => `<button data-leaf="${k}" style="${pill(k === leafKey)}">${d.label}</button>`).join('')}</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center"><span style="width:80px;opacity:.7">pattern</span>
        ${(['none', ...def.patterns, ...SANS_PATTERNS.filter((p) => !def.patterns.includes(p))] as string[])
          .map((p) => `<button data-pat="${p}" style="${pill(p === pattern)}">${p.replace(/^var:/, '')}</button>`).join('')}</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center"><span style="width:80px;opacity:.7">colourway</span>
        ${def.colourways.map(([n], i) => `<button data-cw="${i}" style="${pill(false)}">${n}</button>`).join('')}</div>
      <div style="display:flex;gap:10px;align-items:center"><span style="width:80px;opacity:.7">colours</span>
        <label>leaf <input id="lc" type="color" value="${leafColour}"></label>
        <label>pattern <input id="pc" type="color" value="${patColour}"></label>
        <button id="flip" style="${pill(false)}">⇄ Flip</button></div>`
    ui.querySelectorAll<HTMLElement>('[data-leaf]').forEach((b) => (b.onclick = () => {
      leafKey = b.dataset.leaf!
      ;[, leafColour, patColour, pattern] = LEAVES[leafKey].colourways[0] as typeof LEAVES[string]['colourways'][number]
      render()
      build()
    }))
    ui.querySelectorAll<HTMLElement>('[data-pat]').forEach((b) => (b.onclick = () => {
      pattern = b.dataset.pat as PatternName | 'none'
      render()
      build()
    }))
    ui.querySelectorAll<HTMLElement>('[data-cw]').forEach((b) => (b.onclick = () => {
      ;[, leafColour, patColour, pattern] = LEAVES[leafKey].colourways[Number(b.dataset.cw)]
      render()
      build()
    }))
    ;(document.getElementById('lc') as HTMLInputElement).oninput = (e) => {
      leafColour = (e.target as HTMLInputElement).value
      build()
    }
    ;(document.getElementById('pc') as HTMLInputElement).oninput = (e) => {
      patColour = (e.target as HTMLInputElement).value
      build()
    }
    document.getElementById('flip')!.onclick = () => {
      ;[leafColour, patColour] = [patColour, leafColour]
      render()
      build()
    }
  }
  render()
  build()
}
