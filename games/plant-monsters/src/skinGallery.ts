import * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { buildPot, potById } from './body/pots'
import { buildMonster, loadBodyParts, type Monster } from './body/limbs'
import { poseMonster } from './body/anims'
import { SKIN_PATTERNS, type SkinPattern } from './body/skinPattern'

/**
 * ?debug=skins : one monster per skin pattern, labelled (?patcol=, ?skin=, ?patamt= to try colourways). Shared pot.
 */
export async function runSkinGallery(scene: THREE.Scene, camera: THREE.PerspectiveCamera, controls: OrbitControls, params: URLSearchParams, monsters: Monster[]) {
  const parts = await loadBodyParts()
  const skin = params.get('skin') ?? '#8fae8c'
  const patternColor = params.get('patcol') ?? '#e9e4c8'
  const amount = Number(params.get('patamt') ?? 0.5)
  const ids = Object.keys(SKIN_PATTERNS) as SkinPattern[]
  const labels = document.createElement('div')
  labels.style.cssText = 'position:fixed;inset:0;pointer-events:none;font:12px system-ui;color:#2a2620'
  document.body.appendChild(labels)
  const tags: { el: HTMLDivElement; at: THREE.Vector3 }[] = []
  ids.forEach((id, i) => {
    const pot = buildPot(potById(params.get('pot') ?? 'classic'), Number(params.get('cw') ?? 0))
    const m = buildMonster(pot, parts, { skin, pattern: id, patternColor, patternAmount: amount, seed: i })
    const root = new THREE.Group()
    root.add(m.group)
    // two rows, spaced so the flared arms don't touch
    const row = i < 5 ? 0 : 1
    const col = row === 0 ? i : i - 5
    const n = row === 0 ? 5 : ids.length - 5
    const x = (col - (n - 1) / 2) * 1.7
    const z = row * -2.2
    root.position.set(x, 0, z)
    scene.add(root)
    monsters.push(m)
    const el = document.createElement('div')
    el.style.cssText = 'position:absolute;transform:translate(-50%,0);text-align:center;white-space:nowrap'
    el.innerHTML = `<b>${id}</b><br><span style="opacity:.65">${SKIN_PATTERNS[id]}</span>`
    labels.appendChild(el)
    tags.push({ el, at: new THREE.Vector3(x, -0.08, z + 0.45) })
    poseMonster(m, 0, 'idle')
  })
  camera.position.set(0, 3.6, 10.5)
  controls.target.set(0, 0.3, -1.1)
  controls.update()
  const loop = () => {
    for (const t of tags) {
      const p = t.at.clone().project(camera)
      t.el.style.left = `${(p.x * 0.5 + 0.5) * innerWidth}px`
      t.el.style.top = `${(-p.y * 0.5 + 0.5) * innerHeight}px`
    }
    requestAnimationFrame(loop)
  }
  loop()
}
