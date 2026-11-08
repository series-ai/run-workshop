import * as THREE from 'three'
import { loadKit, Tot, type Kit } from '../promo/kit'
import type { MonsterAnim } from '../body/anims'
import { MEMBERS, age } from './cast'

/**
 * Leaf sway test (pack/sway.html): the same tot with the whole plant swaying as one (`sway: 'plant'`) and with every
 * leaf on its own spring too (`sway: 'leaves'`). "merge" turns on Tot.mergeMeshes, to compare draw calls.
 */

type Mode = 'plant' | 'leaves'
const MODES: Mode[] = ['plant', 'leaves']
const ANIMS: MonsterAnim[] = ['walk', 'idle', 'hop', 'shake', 'spin', 'strut', 'run', 'wiggle', 'scruff']

// ------------------------------------------------------------------ scene
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(2, devicePixelRatio))
renderer.setScissorTest(true)
renderer.info.autoReset = false
document.body.appendChild(renderer.domElement)

const scenes = MODES.map(() => {
  const s = new THREE.Scene()
  s.background = new THREE.Color('#efe6d6')
  s.add(new THREE.HemisphereLight('#fff6e6', '#b9a68a', 2.2))
  const d = new THREE.DirectionalLight('#ffffff', 2.2)
  d.position.set(3, 6, 5)
  s.add(d)
  return s
})
const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100)

const Q = new URLSearchParams(location.search)
const whoSel = document.getElementById('who') as HTMLSelectElement
const animSel = document.getElementById('anim') as HTMLSelectElement
const mergeBox = document.getElementById('merge') as HTMLInputElement
for (const m of MEMBERS) whoSel.add(new Option(m.name, m.name))
for (const a of ANIMS) animSel.add(new Option(a, a))
whoSel.value = Q.get('who') ?? 'Blanche'
animSel.value = Q.get('anim') ?? 'walk'
mergeBox.checked = Q.has('merge')

const kit: Kit = await loadKit()
let tots: Tot[] = []
let height = 5

function build() {
  for (const [i, t] of tots.entries()) scenes[i].remove(t.root)
  const m = MEMBERS.find((x) => x.name === whoSel.value)!
  tots = MODES.map((mode, i) => {
    const tot = new Tot(kit, { species: m.sp, age: age(m.sp), ...m.o, seed: MEMBERS.indexOf(m) + 11, sway: mode })
    if (mergeBox.checked) tot.mergeMeshes()
    scenes[i].add(tot.root)
    return tot
  })
  tots[0].pose(0, 'idle')
  tots[0].root.updateMatrixWorld(true)
  height = new THREE.Box3().setFromObject(tots[0].root).getSize(new THREE.Vector3()).y
}
whoSel.onchange = animSel.onchange = mergeBox.onchange = () => {
  history.replaceState(null, '', `?who=${whoSel.value}&anim=${animSel.value}${mergeBox.checked ? '&merge' : ''}`)
  build()
}
build()

const t0 = performance.now()
function frame() {
  const t = (performance.now() - t0) / 1000
  const W = innerWidth
  const H = innerHeight
  renderer.setSize(W, H, false)
  renderer.domElement.style.width = `${W}px`
  renderer.domElement.style.height = `${H}px`
  const w = W / 2
  cam.aspect = w / (H - 90)
  cam.position.set(height * 1.2, height * 0.75, height * 3.0)
  cam.lookAt(0, height * 0.45, 0)
  cam.updateProjectionMatrix()
  tots.forEach((tot, i) => {
    tot.pose(t, animSel.value as MonsterAnim)
    renderer.info.reset()
    renderer.setViewport(i * w, 0, w, H - 90)
    renderer.setScissor(i * w, 0, w, H - 90)
    renderer.render(scenes[i], cam)
    document.getElementById(`c${i}`)!.textContent = `${renderer.info.render.calls} draw calls`
  })
  requestAnimationFrame(frame)
}
frame()
