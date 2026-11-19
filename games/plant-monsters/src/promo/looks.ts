import * as THREE from 'three'

/**
 * Render looks for the promo, applied to whatever gets added to the scene (?look=std|toon|outline):
 *  std      the kit's own MeshStandardMaterials
 *  soft     the same materials, lit softer: more fill, a warm rim light from behind (lighting only; see promo.ts)
 *  toon     the same colours and textures through a soft three-band toon ramp (MeshToonMaterial); the skin-pattern
 *           shader hooks carry over, since toon uses the same chunks
 *  outline  toon plus an inked outline (an inverted hull) on pots and limbs, not on leaves
 */
export type Look = 'std' | 'soft' | 'toon' | 'outline'

const ramp = (() => {
  const d = new Uint8Array([105, 175, 235, 255])
  const t = new THREE.DataTexture(d, d.length, 1, THREE.RedFormat)
  t.minFilter = t.magFilter = THREE.NearestFilter
  t.generateMipmaps = false
  t.needsUpdate = true
  return t
})()

const toonCache = new WeakMap<THREE.Material, THREE.Material>()
function toToon(m: THREE.Material): THREE.Material {
  const hit = toonCache.get(m)
  if (hit) return hit
  if (!(m as THREE.MeshStandardMaterial).isMeshStandardMaterial) return m
  const s = m as THREE.MeshStandardMaterial
  const t = new THREE.MeshToonMaterial({
    color: s.color, map: s.map, gradientMap: ramp, vertexColors: s.vertexColors, transparent: s.transparent, opacity: s.opacity,
    side: s.side, alphaTest: s.alphaTest, emissive: s.emissive, emissiveMap: s.emissiveMap, emissiveIntensity: s.emissiveIntensity,
    depthWrite: s.depthWrite,
  })
  if (s.defines) t.defines = { ...s.defines }
  if (s.onBeforeCompile) t.onBeforeCompile = s.onBeforeCompile
  const key = s.customProgramCacheKey?.()
  if (key) t.customProgramCacheKey = () => 'toon-' + key
  t.name = s.name
  toonCache.set(m, t)
  return t
}

const inkCache = new Map<string, THREE.Material>()
function ink(thick: number, skinned: boolean) {
  const key = `${thick}|${skinned}`
  let m = inkCache.get(key)
  if (!m) {
    const mm = new THREE.MeshBasicMaterial({ color: '#3b2a20', side: THREE.BackSide })
    mm.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed += normalize(normal) * ${thick.toFixed(4)};`)
    }
    mm.customProgramCacheKey = () => 'ink' + key
    m = mm
    inkCache.set(key, m)
  }
  return m
}

/** Is this mesh a leaf or a stem (thin, double-sided: no outline)? */
function leafy(o: THREE.Mesh) {
  const m = o.material as THREE.Material
  return (m as THREE.MeshStandardMaterial).side === THREE.DoubleSide
}

export function applyLook(root: THREE.Object3D, look: Look) {
  if (look === 'std' || look === 'soft') return
  const outlines: [THREE.Mesh, THREE.Mesh][] = []
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || mesh.userData.ink || mesh.userData.looked) return
    mesh.userData.looked = true
    const mat = mesh.material
    mesh.material = Array.isArray(mat) ? mat.map(toToon) : toToon(mat)
    if (look === 'outline' && !leafy(mesh) && !mesh.userData.noInk) {
      const skinned = (mesh as THREE.SkinnedMesh).isSkinnedMesh
      const box = (mesh.geometry.boundingSphere ?? (mesh.geometry.computeBoundingSphere(), mesh.geometry.boundingSphere))!
      const thick = Math.min(0.012, Math.max(0.004, box.radius * 0.03))
      let hull: THREE.Mesh
      if (skinned) {
        const sm = mesh as THREE.SkinnedMesh
        const h = new THREE.SkinnedMesh(sm.geometry, ink(thick, true))
        h.bind(sm.skeleton, sm.bindMatrix)
        hull = h
      } else hull = new THREE.Mesh(mesh.geometry, ink(thick, false))
      hull.userData.ink = true
      hull.userData.fx = mesh.userData.fx
      hull.castShadow = false
      outlines.push([mesh, hull])
    }
  })
  for (const [m, h] of outlines) m.add(h)
}
