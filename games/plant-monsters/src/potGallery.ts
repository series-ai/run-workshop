import * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { buildPot, POTS } from './body/pots'

/** ?debug=pots : every pot in a grid, labelled; colourway buttons switch all pots at once (?cw=n). */
export function runPotGallery(scene: THREE.Scene, camera: THREE.PerspectiveCamera, controls: OrbitControls, params: URLSearchParams) {
  let cw = Number(params.get('cw') ?? 0)
  const cols = 8
  const holder = new THREE.Group()
  scene.add(holder)
  const labels = document.createElement('div')
  labels.style.cssText = 'position:fixed;inset:0;pointer-events:none;font:12px system-ui;color:#2a2620'
  document.body.appendChild(labels)
  const tags: { el: HTMLDivElement; at: THREE.Vector3 }[] = []
  const all = params.get('allcw') === '1' // ?allcw=1: every pot in every colourway, one row per pot, in three blocks
  const BLOCKS = 3
  const PER = Math.ceil(POTS.length / BLOCKS)
  const build = () => {
    holder.clear()
    if (all) {
      labels.innerHTML = ''
      tags.length = 0
      POTS.forEach((def, i) => {
        const b = Math.floor(i / PER)
        const row = i % PER
        def.colourways.forEach((c, k) => {
          const pot = buildPot(def, k)
          const x = (b - 1) * 7.6 + (k - 2) * 1.2 + 0.6
          pot.group.position.set(x, -row * 1.15, 0)
          holder.add(pot.group)
          const el = document.createElement('div')
          el.style.cssText = 'position:absolute;transform:translate(-50%,0);white-space:nowrap;text-align:center;font-size:11px;opacity:.75'
          el.textContent = c.name
          labels.appendChild(el)
          tags.push({ el, at: new THREE.Vector3(x, -row * 1.15 - 0.06, 0.5) })
        })
        const el = document.createElement('div')
        el.style.cssText = 'position:absolute;transform:translate(-100%,-50%);white-space:nowrap;font:600 14px system-ui'
        el.textContent = def.name
        labels.appendChild(el)
        tags.push({ el, at: new THREE.Vector3((b - 1) * 7.6 - 2.0, -row * 1.15 + 0.3, 0) })
      })
      return
    }
    labels.innerHTML = ''
    tags.length = 0
    POTS.forEach((def, i) => {
      const pot = buildPot(def, cw)
      const x = (i % cols) - (cols - 1) / 2
      const z = Math.floor(i / cols)
      pot.group.position.set(x * 1.45, -z * 1.25, 0)
      holder.add(pot.group)
      const el = document.createElement('div')
      el.style.cssText = 'position:absolute;transform:translate(-50%,0);white-space:nowrap;text-align:center'
      el.innerHTML = `${def.name}<br><span style="opacity:.6">${def.colourways[cw % def.colourways.length].name}</span>`
      labels.appendChild(el)
      tags.push({ el, at: new THREE.Vector3(x * 1.45, -z * 1.25 - 0.08, 0.5) })
    })
  }
  const place = () => {
    for (const t of tags) {
      const p = t.at.clone().project(camera)
      t.el.style.left = `${(p.x * 0.5 + 0.5) * innerWidth}px`
      t.el.style.top = `${(-p.y * 0.5 + 0.5) * innerHeight}px`
    }
    requestAnimationFrame(place)
  }
  build()
  place()
  const rows = all ? PER : Math.ceil(POTS.length / cols)
  const step = all ? 1.15 : 1.25
  // a wall of pots, seen from the front and a little above
  camera.position.set(all ? -0.4 : 0, -((rows - 1) * step) / 2 + (all ? 5 : 2.4), all ? 46 : 14)
  controls.target.set(all ? -0.4 : 0, -((rows - 1) * step) / 2 + 0.3, 0)
  controls.update()
  const ui = document.getElementById('ui')!
  const max = Math.max(...POTS.map((p) => p.colourways.length))
  const render = () => {
    ui.innerHTML = `<span style="opacity:.7">colourway</span>` +
      Array.from({ length: max }, (_, i) => `<button data-cw="${i}" style="padding:4px 8px;border:0;border-radius:4px;cursor:pointer;${i === cw ? 'background:#f2ebe0;color:#1e2918' : 'background:#3a4a30;color:#f2ebe0'}">${i + 1}</button>`).join('')
    ui.querySelectorAll<HTMLElement>('[data-cw]').forEach((b) => (b.onclick = () => {
      cw = Number(b.dataset.cw)
      render()
      build()
    }))
  }
  render()
}
