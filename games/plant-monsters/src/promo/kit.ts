import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { buildPot, potById } from '../body/pots'
import { buildMonster, loadBodyParts, type BodyParts, type Monster } from '../body/limbs'
import { poseMonster, type MonsterAnim } from '../body/anims'
import type { SkinPattern } from '../body/skinPattern'
import { withPattern, type PatternName } from '../plant/leafPatterns'
import { alocasia, birdOfParadise, calathea, growClump, peaceLily, type ClumpSpec } from '../plant/species'
import { growMonstera, growPothos, growPothosCrown, growSansevieria, growZZ, type ClumpAssets, type PlantAssets } from '../plant/plant'

/**
 * Everything the promo needs to put a tot on screen: the plant assets, a plant builder by species, and `makeTot` (pot +
 * body + plant in its socket, posed by the animation library). Same building blocks as the viewer (src/main.ts).
 */

export type Species =
  | 'monstera' | 'albo' | 'thai' | 'pothos' | 'snake' | 'whale' | 'cylindrical' | 'peacelily' | 'domino'
  | 'zz' | 'zzvar' | 'raven' | 'laurentii' | 'cebu' | 'neon' | 'satin' | 'blackvelvet' | 'dottie' | 'alocasia' | 'frydek' | 'calathea' | 'whitefusion' | 'bop'

const MONSTERA_FILES = [
  'monstera_rolled', 'monstera_baby_A', 'monstera_baby_B', 'monstera_baby_C',
  ...['fenestrated', 'heavy', 'heavybig', 'skeleton'].flatMap((t) => [1, 2, 3, 4, 5].map((k) => `monstera_${t}_stage${k}`)),
]
const POTHOS_FILES = ['pothos_small_C_1', 'pothos_medium_B_1', 'pothos_large_A_1']

export interface Kit {
  assets: PlantAssets
  clump: ClumpAssets
  parts: BodyParts
  stalk: THREE.Material
}

export async function loadKit(): Promise<Kit> {
  const loader = new GLTFLoader()
  const loadDouble = async (url: string) => {
    const obj = (await loader.loadAsync(url)).scene
    obj.traverse((o) => {
      const mm = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
      if (mm) mm.side = THREE.DoubleSide
    })
    return obj
  }
  const monstera = new Map(await Promise.all(MONSTERA_FILES.map(async (f) => [f, await loadDouble(`/assets/monstera/${f}.glb`)] as const)))
  let map: THREE.Texture | null = null
  monstera.get('monstera_fenestrated_stage5')!.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
    if (m?.map) map = m.map
  })
  const stalk = new THREE.MeshStandardMaterial({ map, roughness: 0.9, metalness: 0 })
  const pothos = await Promise.all(POTHOS_FILES.map((f) => loadDouble(`/assets/pothos/${f}.glb`)))
  const assets: PlantAssets = { monstera, pothos, stalkMaterial: stalk, rootMaterial: new THREE.MeshStandardMaterial({ color: '#7a5a3c', roughness: 1 }) }
  assets.pothosVariants = pothos.map((leaf, si) => Array.from({ length: 12 }, (_, k) => withPattern(leaf, `var:pothos:${si * 12 + k}:${[1.6, 1.25, 1][si]}`, `pv${si}`, 'planar')))
  const loadSet = (prefix: string) =>
    Promise.all(['small', 'medium', 'large'].map((s) => Promise.all(['A', 'B', 'C'].map((v) => loadDouble(`/assets/kit/${prefix}_${s}_${v}.gltf`)))))
  const clump: ClumpAssets = { sansevieria: await loadSet('sansevieria_leaf'), zz: await loadSet('zzplant_leaf'), leafMaterial: stalk }
  return { assets, clump, parts: await loadBodyParts(), stalk }
}

/**
 * Recolour a grown plant's leaves: the base leaves take `tint`, keeping their own light-to-dark gradient (so a green kit
 * leaf can be silvery blue, neon chartreuse or near black); pattern overlays (renderOrder 1) can take `overlay`.
 */
const tintCache = new Map<string, THREE.Material>()
function recolor(root: THREE.Object3D, tint: string, overlay?: string, lift = 0.35) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const m = mesh.material as THREE.MeshStandardMaterial
    if (!m?.isMeshStandardMaterial) return
    const isOverlay = mesh.renderOrder === 1
    if (isOverlay && !overlay) return
    const key = `${m.uuid}|${isOverlay ? 'o' + overlay : 't' + tint}`
    let t = tintCache.get(key)
    if (!t) {
      const c = m.clone()
      if (isOverlay) c.color = new THREE.Color(overlay!)
      else {
        const col = new THREE.Color(tint)
        c.onBeforeCompile = (sh) => {
          sh.uniforms.uTint = { value: col }
          sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform vec3 uTint;')
            .replace('#include <map_fragment>', `#include <map_fragment>\n  diffuseColor.rgb = uTint * (${lift.toFixed(2)} + 1.9 * dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)));`)
        }
        c.customProgramCacheKey = () => 'tint' + tint
      }
      tintCache.set(key, c)
      t = c
    }
    mesh.material = t
  })
  return root
}
/** Fancy cultivars made from the kit's plants: a base-colour tint and/or a pattern. */
const TINTED: Partial<Record<Species, { tint?: string; overlay?: string; lift?: number }>> = {
  alocasia: { tint: '#2d6f68', lift: 0.36, overlay: '#e4f1ea' },
  monstera: { tint: '#2b5b41', lift: 0.28 }, // a plain monstera: deep, dark glossy green (Blanche)
  thai: { tint: '#6aa868', lift: 0.42 }, // Thai Constellation: a fresher, lighter green under the cream daubs (Stella) // alocasias: deep blue-green velvet, pale veins
  cebu: { tint: '#9fc4c0', lift: 0.45 }, // Cebu Blue pothos: silvery blue-green
  neon: { tint: '#c8f04a', lift: 0.55 }, // Neon pothos: glowing chartreuse
  satin: { tint: '#6f9478', lift: 0.4, overlay: '#d9e6e2' }, // Satin pothos: dusty green with silver flecks
  blackvelvet: { tint: '#2a3330', lift: 0.25, overlay: '#cfd8d4' }, // Alocasia 'Black Velvet': near-black, silvery veins
  dottie: { tint: '#3a2a3a', lift: 0.25, overlay: '#f2a3c0' }, // Calathea 'Dottie': dark plum, hot-pink markings
}
/** Which Albo pattern Blanche's new leaf gets (?sportix= to try others). */
const SPORT_IX = Number(new URLSearchParams(location.search).get('sportix') ?? 1)
let plainPothos: PlantAssets | null = null
let fleckPothos: PlantAssets | null = null
let laurentiiClump: ClumpAssets | null = null

/** A plant of `species` at `age` (0..1) for a pot whose soil radius (scene units) is `r`. */
export function growPlant(kit: Kit, species: Species, age: number, r: number, drop = r * 2, sport = false): THREE.Group {
  const g = new THREE.Group()
  const { stalk } = kit
  let { assets, clump } = kit
  if (species === 'cebu' || species === 'neon') assets = plainPothos ??= { ...kit.assets, pothosVariants: undefined }
  if (species === 'satin') assets = fleckPothos ??= { ...kit.assets, pothosVariants: kit.assets.pothos.map((leaf, si) => [withPattern(leaf, 'flecks' as PatternName, `satin${si}`, 'planar')]) }
  if (species === 'laurentii')
    clump = laurentiiClump ??= { ...kit.clump, sansevieria: kit.clump.sansevieria.map((size, i) => size.map((l, j) => withPattern(l, 'laurentii', `laur${i}${j}`, 'planar'))) }
  const base = ({ cebu: 'pothos', neon: 'pothos', satin: 'pothos', blackvelvet: 'alocasia', dottie: 'calathea', laurentii: 'sansevieria' } as Record<string, string>)[species] ?? species
  const tinted = TINTED[species]
  const out = growPlantBase(base as Species | 'sansevieria', age, r, drop, assets, clump, stalk, g, sport)
  if (tinted?.tint) recolor(out, tinted.tint, tinted.overlay, tinted.lift)
  return out
}
function growPlantBase(species: Species | 'sansevieria', age: number, r: number, drop: number, assets: PlantAssets, clump: ClumpAssets, stalk: THREE.Material, g: THREE.Group, sport = false): THREE.Group {
  const clumpSpecies: Partial<Record<string, [(m: THREE.Material) => ClumpSpec, number]>> = {
    peacelily: [(m) => peaceLily(m), 22], domino: [(m) => peaceLily(m, 'peaceLilyDomino'), 22],
    alocasia: [(m) => alocasia(m), 7], frydek: [(m) => alocasia(m, 'alocasiaFrydekVar'), 7],
    calathea: [(m) => calathea(m), 20], whitefusion: [(m) => calathea(m, 'calatheaWhiteFusion'), 20],
    bop: [(m) => birdOfParadise(m), 16],
  }
  const c = clumpSpecies[species]
  if (c) g.add(growClump(c[0](stalk), age * c[1], r, stalk))
  else if (species === 'zz' || species === 'zzvar' || species === 'raven') g.add(growZZ(clump, age * 12, r, species === 'raven' ? 'raven' : species === 'zzvar'))
  else if (species === 'monstera' || species === 'albo' || species === 'thai')
    g.add(growMonstera(assets, 'fenestrated', age * 14, { potRadius: r, variegation: species === 'albo' ? 'monsteraAlbo' : species === 'thai' ? 'monsteraThai' : undefined, sport: sport ? 'monsteraAlbo' : undefined, sportIx: SPORT_IX }))
  else if (species === 'pothos') {
    g.add(growPothosCrown(assets, age * 19, r * 1.45)) // a full crown out to the rim (no bald spot)
    ;[1.35, -1.35, 2.2, -2.3, 3.1].forEach((h, i) => g.add(growPothos(assets, age * 15 - [0, 1, 3, 4, 6][i], r * 1.3, drop * 0.6, h, 0.3))) // vines trail down the sides and back (the face of the pot stays clear), leaves spaced out
  } else {
    const kind = species === 'snake' ? 'classic' : species === 'sansevieria' ? 'common' : (species as 'whale' | 'cylindrical')
    g.add(growSansevieria(clump, kind, age * (kind === 'whale' ? 5 : kind === 'cylindrical' ? 12 : 18), r))
  }
  return g
}

export interface TotOptions {
  species?: Species
  age?: number
  pot?: string
  cw?: number
  skin?: string
  pattern?: SkinPattern
  patternColor?: string
  legs?: number
  arms?: number
  seed?: number
  /** Overall size (1 = normal): big mature plants get a bigger pot and body, little ones a smaller one. */
  size?: number
}

const SCALE = 1.6 // body units -> scene units (as in the viewer)

export class Tot {
  root = new THREE.Group()
  monster: Monster
  holder = new THREE.Group()
  anim: MonsterAnim = 'idle'
  /** Animation clock offset (so a crowd isn't in sync). */
  t0 = 0
  r: number
  constructor(public kit: Kit, public o: TotOptions = {}) {
    const pot = buildPot(potById(o.pot ?? 'classic'), o.cw ?? 0)
    this.monster = buildMonster(pot, kit.parts, {
      skin: o.skin ?? '#8fae8c', pattern: o.pattern, patternColor: o.patternColor, legLength: o.legs, armLength: o.arms, seed: o.seed,
    })
    this.root.add(this.monster.group)
    this.root.scale.setScalar(SCALE * (o.size ?? 1))
    this.holder.scale.setScalar(1 / SCALE)
    this.monster.socket.add(this.holder)
    this.r = pot.soilRadius * SCALE * 0.85
    if (o.species) this.setPlant(o.species, o.age ?? 0.6)
    this.root.traverse((x) => {
      x.castShadow = true
    })
  }
  setPlant(species: Species, age: number, sport = false) {
    this.holder.clear()
    this.holder.add(growPlant(this.kit, species, age, this.r, this.monster.pot.height * SCALE * 0.95, sport))
    this.holder.traverse((x) => (x.castShadow = true))
  }
  /** Pose at time t; returns travel speed in scene units / s. */
  pose(t: number, anim = this.anim) {
    return poseMonster(this.monster, t + this.t0, anim) * SCALE * (this.o.size ?? 1)
  }
  /** All four limb meshes (for swapping skin materials live). */
  limbMeshes() {
    const out: THREE.Mesh[] = []
    for (const l of [...this.monster.legs, ...this.monster.arms]) l.root.traverse((x) => ((x as THREE.Mesh).isMesh ? out.push(x as THREE.Mesh) : null))
    return out
  }
}

export { SCALE }
