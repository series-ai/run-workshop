import * as THREE from 'three'
import { infest, PEST_KINDS, rollPestCount } from './props/infest'
import type { PestKind } from './props/props'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { createLeaf } from './plant/stalk'
import { buildPot, potById, POTS } from './body/pots'
import { buildMonster, loadBodyParts, type Monster } from './body/limbs'
import { ANIMS, frameFor, poseMonster, type MonsterAnim } from './body/anims'
import { SKIN_PATTERNS, type SkinPattern } from './body/skinPattern'
import { withPattern } from './plant/leafPatterns'
import { alocasia, birdOfParadise, calathea, growClump, peaceLily } from './plant/species'
import { growMonstera, growPothos, growPothosCrown, growSansevieria, growZZ, type ClumpAssets, type MonsteraType, type PlantAssets } from './plant/plant'

// Growth test scene: a monstera and a pothos that grow node by node with the "plant age" slider.
// ?debug=kit shows the kit leaf next to our blade-on-stalk for an orientation check.

const params = new URLSearchParams(location.search)
/** Monsters in the scene (posed every frame) and whether they walk in place (?walk=1 / the walk checkbox). */
const monsters: Monster[] = []
;(window as any).__monsters = monsters // debug handle (poses, bone checks)
;(window as any).__anim = { poseMonster, frameFor, ANIMS }
;(window as any).__view = () => ({ camera, controls }) // review / promo scripts set exact cameras
let anim: MonsterAnim = (params.get('anim') as MonsterAnim) ?? (params.get('walk') === '1' ? 'walk' : 'idle')
let leafType = (params.get('type') as MonsteraType) || 'fenestrated'
let age = Number(params.get('age') ?? 1)

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
document.body.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color('#d9d2c5')
scene.add(new THREE.HemisphereLight('#fff6e8', '#8a7a66', 1.6))
const sun = new THREE.DirectionalLight('#fff1dc', 2.2)
sun.position.set(3, 6, 4)
scene.add(sun)

const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 100)
camera.position.set(0, 3.6, 8.5)
const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, 1.0, 0)
controls.update()

const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 48), new THREE.MeshStandardMaterial({ color: '#cbbfa9', roughness: 1 }))
floor.rotation.x = -Math.PI / 2
scene.add(floor)

const loader = new GLTFLoader()
const load = (url: string) => loader.loadAsync(url).then((g) => g.scene)
const blades = new Map<string, THREE.Object3D>()

const loadDouble = async (url: string) => {
  const obj = await load(url)
  obj.traverse((o) => {
    const mm = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
    if (mm) mm.side = THREE.DoubleSide
  })
  return obj
}

let stalkMaterial: THREE.Material
const MONSTERA_FILES = [
  'monstera_rolled', 'monstera_baby_A', 'monstera_baby_B', 'monstera_baby_C',
  ...['fenestrated', 'heavy', 'heavybig', 'skeleton'].flatMap((t) => [1, 2, 3, 4, 5].map((k) => `monstera_${t}_stage${k}`)),
]
const POTHOS_FILES = ['pothos_small_C_1', 'pothos_medium_B_1', 'pothos_large_A_1']

/** ?debug=kit : untouched kit leaf (left) next to its exported blade on a procedural stalk (right), seen from the side. */
async function debugKit() {
  const which = params.get('leaf') ?? 'large_A'
  const kit = await load(`/assets/debug/monstera_leaf_${which}.gltf`)
  kit.position.set(0, 0, 1.6)
  const blade = await load(which === 'large_A' ? '/assets/debug/kit_large_A_blade.glb' : `/assets/monstera/monstera_baby_${which.slice(-1)}.glb`)
  blade.traverse((o) => {
    const mm = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
    if (mm) mm.side = THREE.DoubleSide
  })
  const lean = Number(params.get('lean') ?? 0.38)
  const arch = Number(params.get('arch') ?? 0.5)
  const len = Number(params.get('len') ?? (which === 'large_A' ? 1.65 : 0.6))
  const ours = createLeaf(blade, { length: len, lean, arch, heading: 0, baseRadius: 0.04, tipRadius: 0.03 }, stalkMaterial)
  ours.position.set(0, 0, -1.6)
  scene.add(kit, ours)
  if (params.get('view') === 'front') {
    kit.position.set(-0.8, 0, 0)
    ours.position.set(0.8, 0, 0)
    camera.position.set(0, 1.2, 6)
    controls.target.set(0, 0.4, 0)
  } else {
    camera.position.set(10, 1.6, 0)
    controls.target.set(0, 0.9, 0)
  }
}

async function main() {
  if (params.get('debug') === 'parts') {
    // the rigged arm and leg, big, in their rest pose (for checking the meshes)
    const { loadBodyParts } = await import('./body/limbs')
    const parts = await loadBodyParts(params.get('set') ? `/assets/body/${params.get('set')}` : undefined)
    const { clone } = await import('three/examples/jsm/utils/SkeletonUtils.js')
    const mat = new THREE.MeshStandardMaterial({ color: '#8fae8c', roughness: 0.7, vertexColors: true })
    // ?wire=1: show the triangles on top of the shaded mesh
    const wire = new THREE.MeshBasicMaterial({ color: '#203020', wireframe: true, transparent: true, opacity: 0.35 })
    for (const [src, x, y] of [[parts.arm, -0.8, 0.6 * 4 + 0.1], [parts.leg, 0.8, parts.legDrop * 4]] as const) {
      const o = clone(src)
      o.traverse((c) => {
        const mesh = c as THREE.SkinnedMesh
        if (!mesh.isMesh) return
        mesh.material = mat
        if (params.get('wire') === '1') {
          const w = new THREE.SkinnedMesh(mesh.geometry, wire)
          w.bind(mesh.skeleton, mesh.bindMatrix)
          mesh.parent!.add(w)
          w.position.copy(mesh.position)
          w.quaternion.copy(mesh.quaternion)
          w.scale.copy(mesh.scale)
        }
      })
      o.scale.setScalar(4)
      o.position.set(x, y, 0)
      o.rotation.y = -0.35
      scene.add(o)
    }
    camera.position.set(0.3, 1.3, 5)
    controls.target.set(0, 0.6, 0)
    controls.update()
    document.body.dataset.ready = '1'
    return
  }
  if (params.get('debug') === 'skins') {
    const { runSkinGallery } = await import('./skinGallery')
    await runSkinGallery(scene, camera, controls, params, monsters)
    document.body.dataset.ready = '1'
    return
  }
  if (params.get('debug') === 'limbs') {
    const { runLimbLineup } = await import('./limbLineup')
    await runLimbLineup(scene, camera, controls, params)
    document.body.dataset.ready = '1'
    return
  }
  if (params.get('debug') === 'props') {
    const { runPropGallery } = await import('./propGallery')
    runPropGallery(scene, camera, controls, params)
    document.body.dataset.ready = '1'
    return
  }
  if (params.get('debug') === 'pots') {
    const { runPotGallery } = await import('./potGallery')
    runPotGallery(scene, camera, controls, params)
    document.body.dataset.ready = '1'
    return
  }
  if (params.get('debug') === 'lab') {
    const { runLab } = await import('./lab')
    runLab(scene, camera, controls, params)
    document.body.dataset.ready = '1'
    return
  }
  const sample = await loadDouble('/assets/monstera/monstera_fenestrated_stage5.glb')
  let map: THREE.Texture | null = null
  sample.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
    if (m?.map) map = m.map
  })
  stalkMaterial = new THREE.MeshStandardMaterial({ map, roughness: 0.9, metalness: 0 })
  if (params.get('debug') === 'var') {
    // 24 assembled leaves of one variegation profile on the real 3D leaf, face-on, numbered
    const prof = (params.get('profile') ?? 'pothos') as any
    const sp = await import('./plant/species')
    const { withPattern } = await import('./plant/leafPatterns')
    const { orientBlade } = await import('./plant/stalk')
    const { paddedLeaf, profiles } = await import('./plant/leafShapes')
    ;['peaceLily', 'calathea', 'alocasia'].forEach((n) => (sp as any)[n](stalkMaterial).blade(1, 0))
    const blades: Record<string, [() => Promise<THREE.Object3D>, 'planar' | 'contour']> = {
      pothos: [() => loadDouble('/assets/pothos/pothos_large_A_1.glb'), 'planar'],
      monsteraAlbo: [() => loadDouble('/assets/monstera/monstera_fenestrated_stage5.glb'), 'planar'],
      monsteraThai: [() => loadDouble('/assets/monstera/monstera_fenestrated_stage5.glb'), 'planar'],
      peaceLilyDomino: [async () => sp.plainBlades.get('pl0')!, 'contour'],
      zzVariegata: [() => loadDouble('/assets/kit/zzplant_leaf_medium_A.gltf'), 'planar'],
      whaleFin: [async () => new THREE.Mesh(paddedLeaf({ length: 1.3, halfWidth: profiles.whaleFin, uv: { u0: 0.17, u1: 0.21, vBase: 0.43, vTip: 0.37 }, cup: -0.04, bend: 0.06 }), stalkMaterial), 'contour'],
      alocasiaFrydekVar: [async () => sp.plainBlades.get('al0')!, 'contour'],
      calatheaWhiteFusion: [async () => sp.plainBlades.get('ca0')!, 'contour'],
    }
    const [get, mapping] = blades[prof]
    const leaf = await get()
    const size = new THREE.Box3().setFromObject(leaf).getSize(new THREE.Vector3()).length()
    for (let i = 0; i < 24; i++) {
      const name = prof === 'pothos' && params.get('old') ? `pothos:${100 + i}` : `var:${prof}:${i}`
      const o = orientBlade(withPattern(leaf, name as any, `${prof}`, mapping), { heading: 0, drop: -1.45, face: new THREE.Vector3(0, 0.12, 1) })
      o.scale.setScalar(1.55 / size)
      o.position.set(-5.25 + (i % 8) * 1.5, 4.2 - Math.floor(i / 8) * 2.0, 0)
      scene.add(o)
    }
    camera.position.set(0, 2.2, 14.5)
    controls.target.set(0, 2.2, 0)
    document.body.dataset.ready = '1'
    return
  }
  if (params.get('debug') === 'pothos2d') {
    // fast 2D preview grid of variegation variants on heart silhouettes, next to photos
    const { paintVariegation, randomSpec } = await import('./plant/pothosVariegation')
    renderer.domElement.style.display = 'none'
    const wrap = document.createElement('div')
    wrap.style.cssText = 'position:fixed;inset:0;background:#e9e3d6;display:grid;grid-template-columns:repeat(8,1fr);gap:6px;padding:10px'
    document.body.appendChild(wrap)
    const base = Number(params.get('seed') ?? 1)
    const { CURATED_POTHOS } = await import('./plant/pothosVariegation')
    const ids = params.get('curated') ? CURATED_POTHOS : params.get('creamfreckle') ? Array.from({ length: 32 }, (_, i) => 100000 + base * 100 + i) : Array.from({ length: 32 }, (_, i) => base * 100 + i)
    for (const id of ids) {
      const W = 128
      const H = 160
      const c = document.createElement('canvas')
      c.width = W
      c.height = H
      const ctx = c.getContext('2d')!
      // heart silhouette (tip up)
      const heart = new Path2D()
      heart.moveTo(W / 2, 6)
      heart.bezierCurveTo(W * 0.95, H * 0.3, W * 1.02, H * 0.78, W * 0.62, H * 0.95)
      heart.quadraticCurveTo(W * 0.53, H * 0.97, W / 2, H * 0.86)
      heart.quadraticCurveTo(W * 0.47, H * 0.97, W * 0.38, H * 0.95)
      heart.bezierCurveTo(-W * 0.02, H * 0.78, W * 0.05, H * 0.3, W / 2, 6)
      ctx.save()
      ctx.clip(heart)
      const g = ctx.createLinearGradient(0, H, 0, 0)
      g.addColorStop(0, '#3f8f3a')
      g.addColorStop(1, '#6cbf4e')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H)
      const tmp = document.createElement('canvas')
      tmp.width = W
      tmp.height = H
      paintVariegation(tmp.getContext('2d')!, W, H, randomSpec(id), [243, 239, 214])
      ctx.drawImage(tmp, 0, 0)
      ctx.restore()
      c.style.width = '100%'
      wrap.appendChild(c)
    }
    document.body.dataset.ready = '1'
    return
  }
  if (params.get('debug') === 'patterns') {
    // every leaf type (rows) x every pattern (columns; first column = plain base)
    const sp = await import('./plant/species')
    const { withPattern } = await import('./plant/leafPatterns')
    const { orientBlade } = await import('./plant/stalk')
    ;['peaceLily', 'calathea', 'alocasia', 'birdOfParadise'].forEach((n) => (sp as any)[n](stalkMaterial).blade(1, 0))
    const kitSans = await loadDouble('/assets/kit/sansevieria_leaf_medium_A.gltf')
    const { paddedLeaf, profiles } = await import('./plant/leafShapes')
    const whale = new THREE.Mesh(paddedLeaf({ length: 1.3, halfWidth: profiles.whaleFin, uv: { u0: 0.17, u1: 0.21, vBase: 0.43, vTip: 0.37 }, cup: -0.04, bend: 0.06 }), stalkMaterial)
    const strap = new THREE.Mesh(paddedLeaf({ length: 1.2, halfWidth: (t: number) => 0.012 + 0.035 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.6)), 0.6), uv: { u0: 0.04, u1: 0.08, vBase: 0.4, vTip: 0.3 }, cup: -0.02, bend: 0.1 }), stalkMaterial)
    const rows: [string, THREE.Object3D, any][] = [
      ['pothos (golden)', await loadDouble('/assets/pothos/pothos_large_A_1.glb'), (params.get('pp') ?? 'pothos:101') as any],
      ['calathea (orbifolia)', sp.plainBlades.get('ca0')!, 'orbifolia'],
      ['alocasia (polly)', sp.plainBlades.get('al0')!, 'polly'],
      ['sansevieria (trifasciata)', kitSans, 'trifasciata'],
      ['whale fin (masoniana)', whale, 'masoniana'],
      ['spider plant (vittatum)', strap, 'vittatum'],
    ]
    rows.forEach(([name, leaf, pat], r) => {
      const size = new THREE.Box3().setFromObject(leaf).getSize(new THREE.Vector3()).length()
      ;[null, pat].forEach((pp, c) => {
        const o = orientBlade(withPattern(leaf, pp, name, name.startsWith('pothos') || name.startsWith('sansevieria') ? 'planar' : 'contour'), { heading: 0, drop: -1.45, face: new THREE.Vector3(0, 0.15, 1) })
        o.scale.setScalar(1.5 / size)
        o.position.set(-5.2 + r * 2.1, 3.9 - c * 2.6, 0)
        scene.add(o)
      })
    })
    camera.position.set(0.05, 2.6, 12.2)
    controls.target.set(0.05, 2.6, 0)
    document.body.dataset.ready = '1'
    return
  }
  if (params.get('debug') === 'leaves') {
    // close-up of the drawn leaves next to a kit leaf, for style comparison
    const sp = await import('./plant/species')
    const kit = await loadDouble('/assets/monstera/monstera_baby_A.glb')
    const items = [kit, ...['peaceLily', 'calathea', 'alocasia', 'birdOfParadise'].map((n) => (sp as any)[n](stalkMaterial).blade(1, 0).obj)]
    const { orientBlade } = await import('./plant/stalk')
    if (params.get('raw')) {
      // raw: blade +Z (designed upper face) straight up toward the camera, no mounting logic
      items.forEach((o: THREE.Object3D, i: number) => {
        const c = o.clone()
        c.rotation.x = -Math.PI / 2
        c.position.set(-2.0 + i * 1.0, 0.3, 0.6)
        if (i === 0) c.scale.setScalar(1.4)
        scene.add(c)
      })
      items.length = 0
    }
    items.forEach((o: THREE.Object3D, i: number) => {
      const c = orientBlade(o, { heading: Math.PI + 0.35, drop: 0.15 })
      c.position.set(-2.4 + i * 1.2, 0.3, 0.6)
      if (i === 0) c.scale.setScalar(1.4)
      scene.add(c)
    })
    camera.position.set(0, 3.4, 2.9)
    controls.target.set(0, 0.2, 0.1)
    document.body.dataset.ready = '1'
    return
  }
  if (params.get('debug') === 'pitch') {
    const blade = await loadDouble('/assets/monstera/monstera_fenestrated_stage5.glb')
    ;[-0.7, -0.35, 0, 0.35, 0.7].forEach((pitch, i) => {
      const leaf = createLeaf(blade, { length: 1.5, lean: 0.3, arch: 0.55, heading: 0 }, stalkMaterial, 1, pitch)
      leaf.position.set(-3.2 + i * 1.6, 0, 0)
      scene.add(leaf)
    })
    camera.position.set(0, 3.4, 7.5)
    controls.target.set(0, 1.1, 0)
    document.body.dataset.ready = '1'
    return
  }
  if (params.get('debug') === 'kit') {
    await debugKit()
    document.body.dataset.ready = '1'
    return
  }

  const assets: PlantAssets = {
    monstera: new Map(await Promise.all(MONSTERA_FILES.map(async (f) => [f, await loadDouble(`/assets/monstera/${f}.glb`)] as const))),
    pothos: await Promise.all(POTHOS_FILES.map((f) => loadDouble(`/assets/pothos/${f}.glb`))),
    stalkMaterial,
    rootMaterial: new THREE.MeshStandardMaterial({ color: '#7a5a3c', roughness: 1 }),
  }
  // procedural variegation: 8 variants per leaf size, each leaf picks one (seed via ?vseed=)
  const vseed = Number(params.get('vseed') ?? 1)
  // curated by default; ?vseed=N swaps in a fresh random set for exploring
  const solo = params.get('plant')
  // patterns are painted on demand: only build the pothos set when a pothos is on screen
  if (!solo || solo === 'pothos') assets.pothosVariants = assets.pothos.map((leaf, si) =>
    params.get('vseed')
      ? Array.from({ length: 8 }, (_, k) => withPattern(leaf, `pothos:${vseed * 100 + si * 8 + k}`, `pv${si}`, 'planar'))
      : Array.from({ length: 12 }, (_, k) => withPattern(leaf, `var:pothos:${si * 12 + k}:${[1.6, 1.25, 1][si]}`, `pv${si}`, 'planar')), // assembled from the picked halves; small leaves get bigger freckles
  )

  // Two pots: monstera (left) and pothos (right).
  const potA = await load('/assets/kit/pot_A_medium.gltf')
  potA.scale.setScalar(1.6)
  potA.position.set(-1.6, 0, 0)
  const potB = await load('/assets/kit/pot_C_medium.gltf')
  potB.scale.setScalar(1.6)
  potB.position.set(1.8, 0, 0)
  scene.add(potA, potB)
  const boxA = new THREE.Box3().setFromObject(potA)
  const boxB = new THREE.Box3().setFromObject(potB)
  const rimB = (boxB.max.x - boxB.min.x) / 2

  // Soil surface: cast a ray straight down into each pot (the rim is higher than the soil).
  const soilY = (pot: THREE.Object3D, x: number, z: number, fallback: number) => {
    pot.updateMatrixWorld(true)
    const hit = new THREE.Raycaster(new THREE.Vector3(x + 0.02, 10, z + 0.02), new THREE.Vector3(0, -1, 0)).intersectObject(pot, true)[0]
    return hit ? hit.point.y : fallback
  }
  const rimA = (boxA.max.x - boxA.min.x) / 2
  const monsteraHolder = new THREE.Group()
  monsteraHolder.position.set(-1.6, soilY(potA, -1.6, 0, boxA.max.y - 0.07), 0)
  const pothosHolder = new THREE.Group()
  pothosHolder.position.set(1.8, soilY(potB, 1.8, 0, boxB.max.y - 0.07), 0)
  scene.add(monsteraHolder, pothosHolder)

  const MONSTERA_NODES = 14
  const cams: Record<string, [number[], number[]]> = {
    monstera: [[-1.6, 2.6, 3.6], [-1.6, 1.1, 0]],
    pothos: [[1.8, 2.2, 3.4], [1.8, 0.7, 0]],
    iso: [[5.5, 6.0, 7.5], [0.1, 0.8, 0]],
    top: [[0.1, 7.5, 1.2], [0.1, 0.6, 0]],
  }
  const cam = cams[params.get('cam') ?? '']
  if (cam) {
    camera.position.set(cam[0][0], cam[0][1], cam[0][2])
    controls.target.set(cam[1][0], cam[1][1], cam[1][2])
  }
  const POTHOS_NODES = 13
  const rebuild = () => {
    monsteraHolder.clear()
    monsteraHolder.add(growMonstera(assets, leafType, age * MONSTERA_NODES, { potRadius: rimA * 0.7 }))
    pothosHolder.clear()
    pothosHolder.add(growPothosCrown(assets, age * POTHOS_NODES, rimB * 0.8))
    // A potted pothos usually has a few vines started at different times, spilling over different sides.
    ;[
      { heading: 0.35, lag: 0 },
      { heading: 1.6, lag: 2 },
      { heading: -1.0, lag: 4 },
      { heading: 2.9, lag: 5 },
      { heading: -2.2, lag: 7 },
    ].forEach((v) => pothosHolder.add(growPothos(assets, age * POTHOS_NODES - v.lag, rimB * 0.92, pothosHolder.position.y, v.heading)))
  }
  // ?plant=sansevieria|cylindrical|whale|zz : one pot of that plant in the middle (monstera/pothos pots hidden).
  const loadSet = (prefix: string) =>
    Promise.all(['small', 'medium', 'large'].map((s) => Promise.all(['A', 'B', 'C'].map((v) => loadDouble(`/assets/kit/${prefix}_${s}_${v}.gltf`)))))
  if (solo) {
    const sans = await loadSet('sansevieria_leaf')
    const clump: ClumpAssets = { sansevieria: solo === 'sansevieria' ? sans.map((size, i) => size.map((l, j) => withPattern(l, 'trifasciata', `sans${i}${j}`, 'planar'))) : sans, zz: await loadSet('zzplant_leaf'), leafMaterial: stalkMaterial }
    potA.visible = potB.visible = false
    monsteraHolder.visible = pothosHolder.visible = false
    // ?pot=<id>&cw=<n> : a pot from the catalogue (src/body/pots.ts), ?pot=kit for the kit pot; ?body=1 adds legs and arms
    const potId = params.get('pot') ?? 'classic'
    const potCw = Number(params.get('cw') ?? 0)
    const withBody = params.get('body') === '1'
    const skin = params.get('skin') ?? '#8fae8c'
    // limb length multipliers (?legs=1.3&arms=0.8)
    const legLen = Number(params.get('legs') ?? 1)
    // skin pattern on the limbs (?skinpat=vitiligo&patcol=%23f1ead4&patamt=0.5)
    const skinPat = (params.get('skinpat') ?? 'none') as SkinPattern
    const patCol = params.get('patcol') ?? '#e9e4c8'
    const patAmt = Number(params.get('patamt') ?? 0.5)
    // mix and match per limb (?pat_armL=spots&pat_legR=brindle ...); 'same' = use the main pattern
    const LIMBS = [['armL', 'left arm'], ['armR', 'right arm'], ['legL', 'left leg'], ['legR', 'right leg']] as const
    const limbPats = Object.fromEntries(
      LIMBS.filter(([k]) => params.get(`pat_${k}`) && params.get(`pat_${k}`) !== 'same').map(([k]) => [k, { pattern: params.get(`pat_${k}`) as SkinPattern }]),
    )
    const armLen = Number(params.get('arms') ?? 1)
    let pot: THREE.Object3D
    let soilAt: number
    let r: number
    let socket: THREE.Group | null = null
    if (potId === 'kit') {
      pot = await load('/assets/kit/pot_A_medium.gltf')
      pot.scale.setScalar(1.6)
      scene.add(pot)
      const kb = new THREE.Box3().setFromObject(pot)
      soilAt = soilY(pot, 0, 0, kb.max.y - 0.07)
      r = ((kb.max.x - kb.min.x) / 2) * 0.7
    } else {
      const built = buildPot(potById(potId), potCw)
      const root = new THREE.Group()
      let base = 0
      if (withBody) {
        const monster = buildMonster(built, await loadBodyParts(params.get('set') ? `/assets/body/${params.get('set')}` : undefined), { skin, legLength: legLen, armLength: armLen, pattern: skinPat, patternColor: patCol, patternAmount: patAmt, limbs: limbPats })
        root.add(monster.group)
        monster.group.userData.hang = { kind: params.get('hang') ?? 'macrame', rope: Number(params.get('rope') ?? 0.45) }
        monsters.push(monster)
        socket = monster.socket
        base = monster.potOffset
      } else root.add(built.group)
      root.scale.setScalar(1.6)
      scene.add(root)
      pot = root
      soilAt = (base + built.soilY) * 1.6
      r = built.soilRadius * 1.6 * 0.85
    }
    const box = new THREE.Box3().setFromObject(pot)
    const holder = new THREE.Group()
    if (socket) {
      // the plant rides on the monster: in the pot's socket (undo the 1.6 body scale; plants are built in scene units)
      holder.scale.setScalar(1 / 1.6)
      socket.add(holder)
    } else {
      holder.position.set(0, soilAt, 0)
      scene.add(holder)
    }
    // pests on the leaves: one kind per plant; ?pest=<kind>&pests=auto|0..5&pseed=<n>
    const pestState = { kind: (params.get('pest') as PestKind | null) || null, count: params.get('pests') ?? 'auto', seed: Number(params.get('pseed') ?? 1) }
    const applyPests = () => {
      const n = pestState.count === 'auto' ? rollPestCount(pestState.seed) : Number(pestState.count)
      const bugs = infest(holder, pestState.kind, n, pestState.seed, 0.11)
      const note = document.getElementById('pestnote')
      if (note) note.textContent = pestState.kind ? `${bugs.length} on this plant` : ''
    }
    const soloRebuild = () => {
      soloGrow()
      applyPests()
    }
    const soloGrow = () => {
      holder.clear()
      const species = {
        peacelily: [peaceLily, 22], alocasia: [alocasia, 7], calathea: [calathea, 20], bop: [birdOfParadise, 16],
        // variegated cultivars
        domino: [(m: THREE.Material) => peaceLily(m, 'peaceLilyDomino'), 22],
        frydek: [(m: THREE.Material) => alocasia(m, 'alocasiaFrydekVar'), 7],
        whitefusion: [(m: THREE.Material) => calathea(m, 'calatheaWhiteFusion'), 20],
      } as const
      const sp = species[solo as keyof typeof species]
      if (sp) holder.add(growClump(sp[0](stalkMaterial), age * sp[1], r, stalkMaterial))
      else if (solo === 'zz' || solo === 'zzvar') holder.add(growZZ(clump, age * 12, r, solo === 'zzvar'))
      else if (solo === 'monstera' || solo === 'albo' || solo === 'thai')
        holder.add(growMonstera(assets, 'fenestrated', age * MONSTERA_NODES, { potRadius: r, variegation: solo === 'albo' ? 'monsteraAlbo' : solo === 'thai' ? 'monsteraThai' : undefined }))
      else if (solo === 'pothos') {
        holder.add(growPothosCrown(assets, age * POTHOS_NODES, r * 1.15))
        ;[0.35, 1.6, -1.0, 2.9, -2.2].forEach((h, i) => holder.add(growPothos(assets, age * POTHOS_NODES - [0, 2, 4, 5, 7][i], r * 1.3, holder.position.y, h)))
      }
      else holder.add(growSansevieria(clump, solo === 'sansevieria' ? 'common' : solo === 'snake' ? 'classic' : (solo as 'cylindrical' | 'whale'), age * (solo === 'whale' ? 5 : solo === 'cylindrical' ? 12 : solo === 'snake' ? 18 : 24), r))
    }
    const soloCams: Record<string, [number[], number[]]> = { '': [[0, 3.0, 8.2], [0, 1.35, 0]], eye: [[1.2, 1.5, 8.2], [0, 1.35, 0]], close: [[0, 2.2, 4.4], [0, 1.1, 0]], top: [[0, 7.5, 0.8], [0, 0.6, 0]] }
    const slider = () => soloRebuild()
    soloRebuild()
    // Frame the camera on the fully grown plant so every species fits.
    const fullAge = age
    age = 1
    soloRebuild()
    const fit = new THREE.Box3().setFromObject(holder).union(box)
    age = fullAge
    soloRebuild()
    const size = fit.getSize(new THREE.Vector3())
    const centre = fit.getCenter(new THREE.Vector3())
    const camKey = params.get('cam') ?? ''
    const span = Math.max(size.y, size.x * 0.6, 1)
    const sc = soloCams[camKey] ?? soloCams['']
    const k = span / 2.6
    camera.position.set(centre.x + sc[0][0] * k, (sc[0][1] - sc[1][1]) * k + centre.y, centre.z + sc[0][2] * k)
    controls.target.copy(centre)
    // ?all=1: every animation at once, one monster each (same pot, skin and plant), labelled, playing in place
    if (params.get('all') === '1' && socket) {
      const parts = await loadBodyParts(params.get('set') ? `/assets/body/${params.get('set')}` : undefined)
      pot.visible = false
      monsters.length = 0
      const items = ANIMS.flatMap((g) => g.items)
      const cols = 7
      const gap = 3.6
      const rows = Math.ceil(items.length / cols)
      const tags = document.createElement('div')
      tags.style.cssText = 'position:fixed;inset:0;pointer-events:none;font:13px system-ui;color:#2a2620'
      document.body.appendChild(tags)
      const anchors: [HTMLDivElement, THREE.Vector3][] = []
      items.forEach(([id, label], i) => {
        const built = buildPot(potById(potId), potCw)
        const mm = buildMonster(built, parts, { skin, legLength: legLen, armLength: armLen, pattern: skinPat, patternColor: patCol, patternAmount: patAmt, limbs: limbPats, seed: i })
        const rt = new THREE.Group()
        rt.add(mm.group)
        rt.scale.setScalar(1.6)
        const h = holder.clone(true)
        h.traverse((o) => delete o.userData.q0) // fresh leaf rest poses (userData is copied as plain JSON)
        mm.socket.add(h)
        const x = ((i % cols) - (cols - 1) / 2) * gap
        const z = (Math.floor(i / cols) - (rows - 1) / 2) * gap * 1.9
        rt.position.set(x, 0, z)
        rt.userData.inPlace = true
        mm.group.userData.anim = id
        scene.add(rt)
        monsters.push(mm)
        const el = document.createElement('div')
        el.style.cssText = 'position:absolute;transform:translate(-50%,0);white-space:nowrap;background:#f2ebe0cc;padding:1px 6px;border-radius:4px'
        el.textContent = label
        tags.appendChild(el)
        anchors.push([el, new THREE.Vector3(x, 0, z + 0.55)]) // at its feet
      })
      // fit the whole grid: 7 across at this field of view, seen from the front and above
      const across = cols * gap
      const dist = across / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / camera.aspect + 6
      camera.position.set(0, dist * 0.5, dist * 0.95)
      controls.target.set(0, 0.9, 0.3)
      controls.update()
      const place = () => {
        for (const [el, at] of anchors) {
          const p = at.clone().project(camera)
          el.style.left = `${(p.x * 0.5 + 0.5) * innerWidth}px`
          el.style.top = `${(-p.y * 0.5 + 0.5) * innerHeight}px`
          el.style.display = p.z < 1 ? '' : 'none'
        }
        requestAnimationFrame(place)
      }
      place()
    }
    const ui = document.getElementById('ui')!
    // plant switcher: reloads the page with another ?plant= (keeps the age)
    const PLANTS: [string, string][][] = [
      [['pothos', 'Pothos'], ['albo', 'Monstera Albo'], ['thai', 'Monstera Thai'], ['domino', 'Peace lily Domino'], ['frydek', 'Alocasia Frydek'], ['whitefusion', 'Calathea White Fusion'], ['zzvar', 'ZZ Variegata'], ['whale', 'Whale fin']],
      [['monstera', 'Monstera'], ['peacelily', 'Peace lily'], ['alocasia', 'Alocasia'], ['calathea', 'Calathea'], ['zz', 'ZZ'], ['snake', 'Snake plant'], ['sansevieria', 'Snake plant (kit)'], ['cylindrical', 'Cylindrical'], ['bop', 'Bird of paradise']],
    ]
    const btn = ([k, l]: [string, string]) =>
      `<button data-p="${k}" style="padding:4px 8px;border:0;border-radius:4px;cursor:pointer;font:inherit;${k === solo ? 'background:#f2ebe0;color:#1e2918' : 'background:#3a4a30;color:#f2ebe0'}">${l}</button>`
    ui.style.flexDirection = 'column'
    ui.style.gap = '8px'
    const cwCount = potId === 'kit' ? 1 : potById(potId).colourways.length
    ui.innerHTML = `<label>age <input id="age" type="range" min="0" max="1" step="0.005" value="${age}"></label>
      <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center"><span style="width:70px;opacity:.7">pot</span>
        <select id="pot" style="font:inherit">${['kit', ...POTS.map((p) => p.id)].map((id) => `<option value="${id}" ${id === potId ? 'selected' : ''}>${id === 'kit' ? 'Kit pot' : potById(id).name}</option>`).join('')}</select>
        ${Array.from({ length: cwCount }, (_, i) => `<button data-cw="${i}" style="padding:4px 8px;border:0;border-radius:4px;cursor:pointer;${i === potCw % cwCount ? 'background:#f2ebe0;color:#1e2918' : 'background:#3a4a30;color:#f2ebe0'}">${potId === 'kit' ? 'Kit' : potById(potId).colourways[i].name}</button>`).join('')}
        <label style="margin-left:10px"><input id="body" type="checkbox" ${withBody ? 'checked' : ''}> monster body</label>
        <select id="anim" style="font:inherit">${ANIMS.map((g) => `<optgroup label="${g.group}">${g.items.map(([k, l]) => `<option value="${k}" ${k === anim ? 'selected' : ''}>${l}</option>`).join('')}</optgroup>`).join('')}</select>
        <button id="seqbtn" style="padding:4px 8px;border:0;border-radius:4px;cursor:pointer;background:#3a4a30;color:#f2ebe0">▶ play all in a row</button>
        <button id="prevbtn" style="padding:4px 8px;border:0;border-radius:4px;cursor:pointer;background:#3a4a30;color:#f2ebe0">◀</button>
        <button id="nextbtn" style="padding:4px 8px;border:0;border-radius:4px;cursor:pointer;background:#3a4a30;color:#f2ebe0">▶</button>
        <button id="allbtn" style="padding:4px 8px;border:0;border-radius:4px;cursor:pointer;${params.get('all') === '1' ? 'background:#f2ebe0;color:#1e2918' : 'background:#3a4a30;color:#f2ebe0'}">all at once</button>
        <label>skin <input id="skin" type="color" value="${skin}"></label>
        <label>legs <input id="legs" type="range" min="0.6" max="1.8" step="0.05" value="${legLen}"></label>
        <label>arms <input id="arms" type="range" min="0.6" max="1.8" step="0.05" value="${armLen}"></label></div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center"><span style="width:70px;opacity:.7">skin</span>
        <select id="skinpat" style="font:inherit">${Object.entries(SKIN_PATTERNS).map(([k, d]) => `<option value="${k}" ${k === skinPat ? 'selected' : ''}>${k} – ${d}</option>`).join('')}</select>
        <label>pattern colour <input id="patcol" type="color" value="${patCol}"></label>
        <button id="skinflip" style="padding:4px 8px;border:0;border-radius:4px;cursor:pointer;background:#3a4a30;color:#f2ebe0">⇄ flip</button>
        <label>amount <input id="patamt" type="range" min="0" max="1" step="0.05" value="${patAmt}"></label></div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center"><span style="width:70px;opacity:.7">pests</span>
        ${[['', 'none'], ...PEST_KINDS].map(([k, l]) => `<button data-pest="${k}" style="padding:4px 8px;border:0;border-radius:4px;cursor:pointer;${k === (params.get('pest') ?? '') ? 'background:#f2ebe0;color:#1e2918' : 'background:#3a4a30;color:#f2ebe0'}">${l}</button>`).join('')}
        <select id="pestcount" style="font:inherit">${['auto', '0', '1', '2', '3', '4', '5'].map((c) => `<option value="${c}" ${c === (params.get('pests') ?? 'auto') ? 'selected' : ''}>${c === 'auto' ? 'how many: like the game (mostly 1–3)' : c}</option>`).join('')}</select>
        <button id="pestroll" style="padding:4px 8px;border:0;border-radius:4px;cursor:pointer;background:#3a4a30;color:#f2ebe0">🎲 re-roll</button>
        <span id="pestnote" style="opacity:.7"></span></div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center"><span style="width:70px;opacity:.7">hanging</span>
        <select id="hang" style="font:inherit">${[['macrame', 'macramé cradle'], ['clips', 'rim clips']].map(([k, l]) => `<option value="${k}" ${k === (params.get('hang') ?? 'macrame') ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <label>rope <input id="rope" type="range" min="0.1" max="1.4" step="0.05" value="${params.get('rope') ?? 0.45}"></label>
        <span style="opacity:.6">(plays the swing)</span></div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center"><span style="width:70px;opacity:.7">per limb</span>
        ${LIMBS.map(([k, label]) => `<label>${label} <select data-limb="${k}" style="font:inherit">${['same', ...Object.keys(SKIN_PATTERNS)].map((p) => `<option ${p === (params.get(`pat_${k}`) ?? 'same') ? 'selected' : ''}>${p}</option>`).join('')}</select></label>`).join('')}</div>
      ${PLANTS.map((row, i) => `<div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center"><span style="width:70px;opacity:.7">${i ? 'plain' : 'variegated'}</span>${row.map(btn).join('')}</div>`).join('')}`
    const go = (k: string, v: string) => {
      const q = new URLSearchParams(location.search)
      q.set(k, v)
      q.set('age', String(age))
      if (k === 'pot') q.delete('cw')
      location.search = q.toString()
    }
    ;(document.getElementById('pot') as HTMLSelectElement).onchange = (e) => go('pot', (e.target as HTMLSelectElement).value)
    const animSel = document.getElementById('anim') as HTMLSelectElement | null
    if (animSel) animSel.onchange = () => ((anim = animSel.value as MonsterAnim), (seq.on = false), seqLabel())
    const step = (d: number) => {
      const i = ANIM_IDS.indexOf(anim)
      anim = ANIM_IDS[(i + d + ANIM_IDS.length) % ANIM_IDS.length]
      if (animSel) animSel.value = anim
      seq.on = false
      seqLabel()
    }
    document.getElementById('prevbtn')!.onclick = () => step(-1)
    document.getElementById('nextbtn')!.onclick = () => step(1)
    document.getElementById('seqbtn')!.onclick = () => {
      seq.on = !seq.on
      seq.t0 = clock.elapsedTime - Math.max(0, ANIM_IDS.indexOf(anim)) * SEQ_SECONDS // continue from the current one
      seqLabel()
    }
    document.getElementById('allbtn')!.onclick = () => go('all', params.get('all') === '1' ? '0' : '1')
    seqSelect = animSel
    seqLabel()
    // try any hanger / rope length on this pot, live (and kept in the URL for reloads)
    const hangSel = document.getElementById('hang') as HTMLSelectElement
    const ropeIn = document.getElementById('rope') as HTMLInputElement
    const setHang = () => {
      for (const mm of monsters) mm.group.userData.hang = { kind: hangSel.value, rope: Number(ropeIn.value) }
      anim = 'swing'
      if (animSel) animSel.value = anim
      seq.on = false
      seqLabel()
      const q = new URLSearchParams(location.search)
      q.set('hang', hangSel.value)
      q.set('rope', ropeIn.value)
      q.set('anim', 'swing')
      history.replaceState(null, '', `?${q}`)
    }
    hangSel.onchange = setHang
    // pests: pick a kind (or none), how many, re-roll where they sit (and how many, on auto)
    const savePests = () => {
      const q = new URLSearchParams(location.search)
      for (const [k, v] of [['pest', pestState.kind ?? ''], ['pests', pestState.count], ['pseed', String(pestState.seed)]]) q.set(k, v)
      history.replaceState(null, '', `?${q}`)
      applyPests()
    }
    ui.querySelectorAll<HTMLElement>('[data-pest]').forEach((b) => (b.onclick = () => {
      pestState.kind = (b.dataset.pest as PestKind) || null
      ui.querySelectorAll<HTMLElement>('[data-pest]').forEach((o) => (o.style.cssText = `padding:4px 8px;border:0;border-radius:4px;cursor:pointer;${o === b ? 'background:#f2ebe0;color:#1e2918' : 'background:#3a4a30;color:#f2ebe0'}`))
      savePests()
    }))
    ;(document.getElementById('pestcount') as HTMLSelectElement).onchange = (e) => ((pestState.count = (e.target as HTMLSelectElement).value), savePests())
    document.getElementById('pestroll')!.onclick = () => ((pestState.seed += 1), savePests())
    applyPests()
    ropeIn.oninput = setHang
    ;(document.getElementById('body') as HTMLInputElement).onchange = (e) => go('body', (e.target as HTMLInputElement).checked ? '1' : '0')
    ;(document.getElementById('skin') as HTMLInputElement).onchange = (e) => go('skin', (e.target as HTMLInputElement).value)
    for (const id of ['legs', 'arms', 'skinpat', 'patcol', 'patamt']) (document.getElementById(id) as HTMLInputElement).onchange = (e) => go(id, (e.target as HTMLInputElement).value)
    ui.querySelectorAll<HTMLSelectElement>('select[data-limb]').forEach((sel) => (sel.onchange = () => go(`pat_${sel.dataset.limb}`, sel.value)))
    document.getElementById('skinflip')!.onclick = () => {
      // swap the skin and pattern colours
      const q = new URLSearchParams(location.search)
      q.set('skin', patCol)
      q.set('patcol', skin)
      q.set('age', String(age))
      location.search = q.toString()
    }
    ui.querySelectorAll<HTMLElement>('[data-cw]').forEach((b) => (b.onclick = () => go('cw', b.dataset.cw!)))
    ui.querySelectorAll<HTMLElement>('button[data-p]').forEach((b) =>
      b.addEventListener('click', () => {
        const q = new URLSearchParams(location.search)
        q.set('plant', (b as HTMLElement).dataset.p!)
        q.set('age', String(age))
        location.search = q.toString()
      }),
    )
    ;(document.getElementById('age') as HTMLInputElement).oninput = (e) => {
      age = Number((e.target as HTMLInputElement).value)
      slider()
    }
    document.body.dataset.ready = '1'
    return
  }
  rebuild()

  const ui = document.getElementById('ui')!
  ui.innerHTML = `
    <label>monstera <select id="type">${['fenestrated', 'heavy', 'heavybig', 'skeleton']
      .map((t) => `<option ${t === leafType ? 'selected' : ''}>${t}</option>`)
      .join('')}</select></label>
    <label>plant age <input id="age" type="range" min="0" max="1" step="0.005" value="${age}"></label>`
  ;(document.getElementById('type') as HTMLSelectElement).onchange = (e) => {
    leafType = (e.target as HTMLSelectElement).value as MonsteraType
    rebuild()
  }
  ;(document.getElementById('age') as HTMLInputElement).oninput = (e) => {
    age = Number((e.target as HTMLInputElement).value)
    rebuild()
  }
  document.body.dataset.ready = '1'
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
})
const clock = new THREE.Clock()
/** Play-all-in-a-row: each animation for SEQ_SECONDS, from its start, with its name shown big. */
const ANIM_IDS = ANIMS.flatMap((g) => g.items.map((i) => i[0])) as MonsterAnim[]
const ANIM_LABEL = Object.fromEntries(ANIMS.flatMap((g) => g.items)) as Record<string, string>
const SEQ_SECONDS = 5
const seq = { on: params.get('seq') === '1', t0: 0 }
let seqSelect: HTMLSelectElement | null = null
const seqBanner = document.createElement('div')
seqBanner.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);font:600 22px system-ui;color:#1e2918;background:#f2ebe0e6;padding:6px 16px;border-radius:8px;display:none'
document.body.appendChild(seqBanner)
function seqLabel() {
  const b = document.getElementById('seqbtn')
  if (b) b.textContent = seq.on ? '\u23f8 stop' : '\u25b6 play all in a row'
  seqBanner.style.display = seq.on ? '' : 'none'
}
/** Walking monsters travel round a circle (radius in scene units) so you can see the feet stay planted. */
const PATH_R = 1.3
renderer.setAnimationLoop(() => {
  const dt = Math.min(0.05, clock.getDelta())
  // ?freeze=<seconds>: hold the animation at that time (for checking single poses)
  const fz = (window as any).__freeze as number | undefined // set from the console / review scripts
  let t = fz !== undefined ? fz : params.has('freeze') ? Number(params.get('freeze')) : clock.elapsedTime
  if (seq.on) {
    const k = (clock.elapsedTime - seq.t0) / SEQ_SECONDS
    const next = ANIM_IDS[Math.floor(k) % ANIM_IDS.length]
    if (next !== anim) {
      anim = next
      if (seqSelect) seqSelect.value = anim
    }
    t = (k - Math.floor(k)) * SEQ_SECONDS // each one plays from its start
    seqBanner.textContent = `${ANIM_IDS.indexOf(anim) + 1}/${ANIM_IDS.length}  ${ANIM_LABEL[anim]}`
  }
  for (const m of monsters) {
    const root = m.group.parent
    const own = m.group.userData.anim as MonsterAnim | undefined
    const inPlace = !!root?.userData.inPlace
    // path curvature in pot units (the body is scaled by root.scale): the circle turns toward the monster's +X side
    const speed = poseMonster(m, t, own ?? anim, root && !inPlace ? root.scale.x / PATH_R : 0) // pot units / s
    if (!root || inPlace) continue
    const st = (root.userData.path ??= { a: 0 })
    if (speed === 0 || params.has('freeze')) continue // idle (or a frozen still): stays where it stopped
    st.a += (speed * root.scale.x * dt) / PATH_R
    // round a circle that starts at the origin; forward is +Z, so face along the tangent
    root.position.set(PATH_R * Math.sin(st.a), root.position.y, PATH_R * Math.cos(st.a) - PATH_R)
    root.rotation.y = st.a + Math.PI / 2
  }
  controls.update()
  renderer.render(scene, camera)
})
main()
