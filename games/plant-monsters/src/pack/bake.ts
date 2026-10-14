import * as THREE from 'three'
import { IDS, NOISE, type SkinOptions, type SkinPattern } from '../body/skinPattern'

/**
 * Turn the things a plain glTF loader can't show into plain materials, so a Terra Tot exports as a normal GLB:
 *  - limb markings (a shader pattern over the rest-pose position) are baked into a texture on a generated
 *    cylindrical UV unwrap of each limb;
 *  - tinted leaves (a shader recolour of the shared leaf atlas) are baked into a recoloured copy of the atlas.
 */

const TEX = 512

/** Cylindrical UVs round the limb's own axis (+Y in its rest space); vertices on the seam are duplicated. */
function unwrap(src: THREE.BufferGeometry) {
  const g = src.index ? src.toNonIndexed() : src.clone()
  const pos = g.getAttribute('position') as THREE.BufferAttribute
  let y0 = Infinity
  let y1 = -Infinity
  for (let i = 0; i < pos.count; i++) (y0 = Math.min(y0, pos.getY(i))), (y1 = Math.max(y1, pos.getY(i)))
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = Math.atan2(pos.getZ(i), pos.getX(i)) / (Math.PI * 2) + 0.5
    uv[i * 2 + 1] = (pos.getY(i) - y0) / Math.max(1e-6, y1 - y0)
  }
  // a triangle straddling the seam gets its low-u corners moved up by one (the texture repeats in u)
  for (let t = 0; t < pos.count; t += 3) {
    const us = [uv[t * 2], uv[t * 2 + 2], uv[t * 2 + 4]]
    if (Math.max(...us) - Math.min(...us) > 0.5) for (let k = 0; k < 3; k++) if (us[k] < 0.5) uv[(t + k) * 2] += 1
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return g
}

let bakeRenderer: THREE.WebGLRenderer | null = null
function renderer() {
  bakeRenderer ??= new THREE.WebGLRenderer({ antialias: false, alpha: false, preserveDrawingBuffer: true })
  return bakeRenderer
}

/** Render the skin pattern of `opts` over the limb geometry's UV unwrap into a texture (colours as stored, sRGB). */
function bakePattern(geo: THREE.BufferGeometry, opts: SkinOptions & { pattern: SkinPattern }) {
  const r = renderer()
  const rt = new THREE.WebGLRenderTarget(TEX, TEX, { type: THREE.UnsignedByteType })
  const lin = (hex: string) => new THREE.Color(hex)
  const seed = opts.seed ?? 0
  const mat = new THREE.ShaderMaterial({
    defines: { SKIN_PATTERN: IDS[opts.pattern] },
    uniforms: {
      uSkin: { value: lin(opts.skin) },
      uPatternColor: { value: lin(opts.patternColor ?? '#f1ead4') },
      uAmount: { value: opts.amount ?? 0.5 },
      uSeed: { value: new THREE.Vector3(seed * 3.17, seed * 1.31, seed * 2.53) },
      uOff: { value: 0 },
    },
    vertexShader: /* glsl */ `
      uniform float uOff;
      varying vec3 vRest;
      void main() {
        vRest = position;
        gl_Position = vec4((uv.x + uOff) * 2.0 - 1.0, uv.y * 2.0 - 1.0, 0.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSkin;
      uniform vec3 uPatternColor;
      uniform float uAmount;
      uniform vec3 uSeed;
      varying vec3 vRest;
      ${NOISE}
      vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
      void main() {
        float f = skinField(vRest + uSeed, vRest);
        float w = fwidth(f) * 0.75 + 1e-4;
        float k = smoothstep(-w, w, f);
        gl_FragColor = vec4(toSRGB(mix(uSkin, uPatternColor, k)), 1.0);
      }`,
    side: THREE.DoubleSide,
  })
  const scene = new THREE.Scene()
  const mesh = new THREE.Mesh(geo, mat)
  mesh.frustumCulled = false
  scene.add(mesh)
  const cam = new THREE.OrthographicCamera()
  r.setRenderTarget(rt)
  r.setClearColor(new THREE.Color(opts.skin), 1)
  r.clear()
  r.autoClear = false
  for (const off of [0, -1]) {
    mat.uniforms.uOff.value = off
    r.render(scene, cam)
  }
  r.autoClear = true
  const px = new Uint8Array(TEX * TEX * 4)
  r.readRenderTargetPixels(rt, 0, 0, TEX, TEX, px)
  r.setRenderTarget(null)
  rt.dispose()
  mat.dispose()
  // render targets read bottom-up; canvases are top-down
  const c = document.createElement('canvas')
  c.width = c.height = TEX
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(TEX, TEX)
  for (let y = 0; y < TEX; y++) img.data.set(px.subarray((TEX - 1 - y) * TEX * 4, (TEX - y) * TEX * 4), y * TEX * 4)
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  return tex
}

/** Bake every limb's pattern into a texture; limbs keep their vertex-colour shading. */
export function bakeLimbs(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.SkinnedMesh
    if (!m.isSkinnedMesh) return
    const mat = m.material as THREE.MeshStandardMaterial
    const opts = mat.userData.skinOpts as (SkinOptions & { pattern: SkinPattern }) | undefined
    if (!opts) return
    const plain = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: mat.roughness, vertexColors: true })
    plain.name = 'limb'
    if (opts.pattern === 'none') {
      plain.color.set(opts.skin)
    } else {
      const geo = unwrap(m.geometry)
      m.geometry = geo
      plain.map = bakePattern(geo, opts)
    }
    m.material = plain
  })
}

/** Bake each tinted material's recolour into its own copy of the texture. */
export function bakeTints(root: THREE.Object3D) {
  const done = new Map<THREE.Material, THREE.Material>()
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const m = mesh.material as THREE.MeshStandardMaterial
    const tint = m?.userData?.tint as { tint: string; lift: number } | undefined
    if (!tint) return
    let out = done.get(m)
    if (!out) {
      const plain = new THREE.MeshStandardMaterial({ roughness: m.roughness, metalness: m.metalness, side: m.side, transparent: m.transparent, alphaTest: m.alphaTest })
      plain.name = m.name || 'leaf'
      const img = m.map?.image as CanvasImageSource & { width: number; height: number } | undefined
      const col = new THREE.Color(tint.tint)
      if (img) {
        const c = document.createElement('canvas')
        c.width = img.width
        c.height = img.height
        const ctx = c.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        const d = ctx.getImageData(0, 0, c.width, c.height)
        const toLin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
        const toS = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055)
        for (let i = 0; i < d.data.length; i += 4) {
          const r = toLin(d.data[i] / 255)
          const g = toLin(d.data[i + 1] / 255)
          const b = toLin(d.data[i + 2] / 255)
          const k = tint.lift + 1.9 * (0.299 * r + 0.587 * g + 0.114 * b)
          d.data[i] = Math.round(255 * Math.min(1, toS(Math.min(1, col.r * k))))
          d.data[i + 1] = Math.round(255 * Math.min(1, toS(Math.min(1, col.g * k))))
          d.data[i + 2] = Math.round(255 * Math.min(1, toS(Math.min(1, col.b * k))))
        }
        ctx.putImageData(d, 0, 0)
        const t = new THREE.CanvasTexture(c)
        t.colorSpace = THREE.SRGBColorSpace
        t.flipY = m.map!.flipY
        t.wrapS = m.map!.wrapS
        t.wrapT = m.map!.wrapT
        plain.map = t
      } else plain.color.copy(col)
      out = plain
      done.set(m, out)
    }
    mesh.material = out
  })
}
