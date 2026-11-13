import * as THREE from 'three'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { EFFECTS, InkEffects, effectMaxDuration, effectAtlasDuration } from '../src/runtime/effects'
const before = JSON.parse(await readFile('docs/verification/polish/effects-before.json', 'utf8')) as { effects: typeof EFFECTS }
const camera = new THREE.PerspectiveCamera(32, 1, .01, 100)
camera.position.set(0, 1, 6); camera.lookAt(0, 1, 0); camera.updateMatrixWorld(true)
const checks = []
for (const effect of EFFECTS) {
  const burst = new InkEffects()
  const duration = burst.trigger(effect.id, new THREE.Vector3())
  const particleCount = burst.activeCount
  let maximumPools = 0, finite = true
  for (let time = 0; time <= effectMaxDuration(effect) + .1; time += 1 / 120) {
    burst.update(1 / 120, camera)
    const pools = burst.group.children as THREE.InstancedMesh[]
    maximumPools = Math.max(maximumPools, pools.filter(pool => pool.count > 0).length)
    for (const pool of pools) finite &&= Array.from(pool.instanceMatrix.array.slice(0, pool.count * 16)).every(Number.isFinite)
  }
  const previous = before.effects.find(item => item.id === effect.id)!
  const previousCount = previous.count + (previous.layers ?? []).reduce((count, layer) => count + (layer.count ?? previous.count), 0)
  const comparable = (value: typeof effect) => JSON.stringify({ shape: value.shape, count: value.count, duration: value.duration, size: value.size, speed: value.speed, spread: value.spread, gravity: value.gravity, floor: value.floor, spiral: value.spiral, orbitRadius: value.orbitRadius, angle: value.angle, layers: value.layers })
  checks.push({ id: effect.id, category: effect.category, pass: finite && burst.activeCount === 0 && duration <= effectMaxDuration(effect) + 1e-8 && maximumPools <= 7,
    recipeChanged: comparable(effect) !== comparable(previous), beforeParticles: previousCount, particles: particleCount,
    beforeSize: previous.size, size: effect.size, beforeDuration: previous.duration, mainDuration: effect.duration, fullDuration: duration, atlasDuration: effectAtlasDuration(effect), maximumPools, finite, expired: burst.activeCount === 0 })
  burst.dispose()
}
const atlas = JSON.parse(await readFile('public/assets/effects/atlas.json', 'utf8')) as { effects: { id: string; duration: number }[] }
for (const row of checks) row.pass &&= Math.abs(atlas.effects.find(effect => effect.id === row.id)!.duration - row.atlasDuration) < .0001
const pass = checks.length === 64 && checks.every(check => check.pass)
const report = { checkedAt: new Date().toISOString(), pass, effects: checks.length, changedRecipes: checks.filter(check => check.recipeChanged).length,
  beforeParticles: checks.reduce((total, row) => total + row.beforeParticles, 0), particles: checks.reduce((total, row) => total + row.particles, 0),
  sourceSHA256: createHash('sha256').update(await readFile('src/runtime/effects.ts')).digest('hex'), checks }
await writeFile('docs/verification/polish/effect-quality.json', JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ pass, effects: report.effects, changedRecipes: report.changedRecipes, beforeParticles: report.beforeParticles, particles: report.particles, failures: checks.filter(check => !check.pass) }))
if (!pass) process.exitCode = 1
