import * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { PROPS } from './props/props'

/** ?debug=props : every prop in a labelled grid, each fitted to its cell (small things like pests are shown enlarged,
 *  marked with their zoom); the colourway buttons switch all props at once (?cw=n). */
export function runPropGallery(scene: THREE.Scene, camera: THREE.PerspectiveCamera, controls: OrbitControls, params: URLSearchParams) {
  let cw = Number(params.get('cw') ?? 0)
  // ?only=pests,bag- (groups or id prefixes) to look at a few props up close
  const only = params.get('only')?.split(',')
  const list = only ? PROPS.filter((p) => only.some((o) => p.group === o || p.id.startsWith(o))) : PROPS
  const cols = Math.min(9, list.length)
  const cell = 1.3
  const holder = new THREE.Group()
  scene.add(holder)
  scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry.type === 'CircleGeometry') o.visible = false
  })
  const labels = document.createElement('div')
  labels.style.cssText = 'position:fixed;inset:0;pointer-events:none;font:12px system-ui;color:#2a2620'
  document.body.appendChild(labels)
  const tags: { el: HTMLDivElement; at: THREE.Vector3 }[] = []
  const rows = Math.ceil(list.length / cols)
  const build = () => {
    holder.clear()
    labels.innerHTML = ''
    tags.length = 0
    list.forEach((p, i) => {
      const o = p.build(cw)
      const b = new THREE.Box3().setFromObject(o)
      const size = b.getSize(new THREE.Vector3())
      const k = Math.min(8, (cell * 0.8) / Math.max(size.x, size.y, size.z * 0.7, 1e-3))
      const g = new THREE.Group()
      o.position.x -= (b.min.x + b.max.x) / 2
      o.position.z -= (b.min.z + b.max.z) / 2
      o.position.y -= b.min.y
      g.add(o)
      g.scale.setScalar(k)
      const x = ((i % cols) - (cols - 1) / 2) * cell
      const y = (rows - 1 - Math.floor(i / cols)) * cell * 1.15
      g.position.set(x, y, 0)
      g.rotation.y = Number(params.get('yaw') ?? -0.45) // ?yaw= to turn every prop (e.g. -1.9 for side-on bugs)
      holder.add(g)
      const el = document.createElement('div')
      el.style.cssText = 'position:absolute;transform:translate(-50%,0);text-align:center;white-space:nowrap'
      el.innerHTML = `${p.name}${k > 2.2 ? ` <span style="opacity:.5">×${k.toFixed(0)}</span>` : ''}`
      labels.appendChild(el)
      tags.push({ el, at: new THREE.Vector3(x, y - 0.06, 0.3) })
    })
  }
  build()
  camera.position.set(0, (rows - 1) * cell * 0.58 + 1.2, Math.max(4, 1.95 * Math.max(cols, rows * 1.4)))
  controls.target.set(0, (rows - 1) * cell * 0.58 + 0.2, 0)
  controls.update()
  const ui = document.getElementById('ui')!
  const render = () => {
    ui.innerHTML = `<span style="opacity:.7">colourway</span>` + [0, 1, 2, 3].map((i) => `<button data-cw="${i}" style="padding:4px 8px;border:0;border-radius:4px;cursor:pointer;${i === cw ? 'background:#f2ebe0;color:#1e2918' : 'background:#3a4a30;color:#f2ebe0'}">${i + 1}</button>`).join('')
    ui.querySelectorAll<HTMLElement>('[data-cw]').forEach((b) => (b.onclick = () => ((cw = Number(b.dataset.cw)), render(), build())))
  }
  render()
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
