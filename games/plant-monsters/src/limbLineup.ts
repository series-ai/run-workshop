import * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'

/**
 * ?debug=limbs : art-review lineup of the limb variants (scripts/limbs_blender.py --variants), legs on top and arms
 * below, six per row, each labelled. The "pose" buttons show them at rest or bent (knee / elbow), ?bend=1 to start bent.
 */
export async function runLimbLineup(scene: THREE.Scene, camera: THREE.PerspectiveCamera, controls: OrbitControls, params: URLSearchParams) {
  const manifest = (await (await fetch('/assets/body/variants/variants.json')).json()) as { arms: { id: string; desc: string }[]; legs: { id: string; desc: string }[] }
  const loader = new GLTFLoader()
  const mat = new THREE.MeshStandardMaterial({ color: '#8fae8c', roughness: 0.7 })
  const labels = document.createElement('div')
  labels.style.cssText = 'position:fixed;inset:0;pointer-events:none;font:12px system-ui;color:#2a2620'
  document.body.appendChild(labels)
  const tags: { el: HTMLDivElement; at: THREE.Vector3 }[] = []
  const items: { o: THREE.Object3D; kind: 'legs' | 'arms'; rest: Map<THREE.Object3D, THREE.Quaternion> }[] = []
  const COLS = 7
  // no floor here: the lineup sits below it, and it would block side and underside views when orbiting
  scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry.type === 'CircleGeometry') o.visible = false
  })
  const SX = 0.85
  let y = 0
  for (const kind of ['legs', 'arms'] as const) {
    const list = manifest[kind]
    for (let i = 0; i < list.length; i++) {
      const col = i % COLS
      if (col === 0 && i > 0) y -= kind === 'legs' ? 0.78 : 0.95
      const x = (col - (Math.min(COLS, list.length) - 1) / 2) * SX
      const src = (await loader.loadAsync(`/assets/body/variants/${kind === 'legs' ? 'leg' : 'arm'}_${list[i].id}.glb`)).scene
      const o = clone(src)
      const rest = new Map<THREE.Object3D, THREE.Quaternion>()
      o.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) (c as THREE.Mesh).material = mat
        if ((c as THREE.Bone).isBone) rest.set(c, c.quaternion.clone())
      })
      o.position.set(x, y, 0)
      // legs: front three-quarter (toes toward the camera, knee bend visible); arms: outer side and front of the hand
      o.rotation.y = kind === 'legs' ? 0.65 : -0.9
      scene.add(o)
      items.push({ o, kind, rest })
      const el = document.createElement('div')
      el.style.cssText = 'position:absolute;transform:translate(-50%,0);text-align:center;white-space:nowrap'
      el.innerHTML = `<b>${list[i].id}</b><br><span style="opacity:.65">${list[i].desc}</span>`
      labels.appendChild(el)
      tags.push({ el, at: new THREE.Vector3(x, y - (kind === 'legs' ? 0.46 : 0.62), 0) })
    }
    y -= kind === 'legs' ? 0.95 : 0
  }
  const pose = (bent: boolean) => {
    for (const it of items)
      for (const [b, q] of it.rest) {
        b.quaternion.copy(q)
        if (!bent) continue
        const a = it.kind === 'legs' ? ({ thigh: -0.55, shin: 1.0, foot: -0.45 } as Record<string, number>)[b.name] : ({ upper: -0.35, fore: -0.9 } as Record<string, number>)[b.name]
        if (a) b.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), a))
      }
  }
  pose(params.get('bend') === '1')
  const ui = document.getElementById('ui')!
  ui.innerHTML = `<span style="opacity:.7">pose</span><button id="rest">rest</button><button id="bent">bent</button>`
  document.getElementById('rest')!.onclick = () => pose(false)
  document.getElementById('bent')!.onclick = () => pose(true)
  camera.position.set(0, y / 2 + 0.1, 6.3)
  controls.target.set(0, y / 2 - 0.05, 0)
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
