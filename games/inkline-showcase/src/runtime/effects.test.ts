import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { EFFECTS, effectEnvelope, effectPreviewBounds, effectPreviewRadius, InkEffects, resolveEffectColor } from './effects'
import { INK, PAPER } from './palette'

describe('effect pool', () => {
  it('has 64 unique authored recipes across five groups', () => {
    expect(EFFECTS).toHaveLength(64)
    expect(new Set(EFFECTS.map(effect => effect.id)).size).toBe(64)
    expect(new Set(EFFECTS.map(effect => effect.category)).size).toBe(5)
  })
  it('samples compact finite preview bounds from the particle motion', () => {
    const compact = EFFECTS.find(effect => effect.id === 'punch-impact')!
    const compactBounds = effectPreviewBounds(compact)
    expect(compactBounds.center.toArray().every(Number.isFinite)).toBe(true)
    expect(Number.isFinite(compactBounds.radius)).toBe(true)
    expect(Number.isFinite(compactBounds.frameRadius)).toBe(true)
    expect(compactBounds.radius).toBeGreaterThan(0)
    expect(compactBounds.frameRadius).toBeLessThan(2.8)
    expect(effectPreviewRadius(compact)).toBe(compactBounds.frameRadius)

    const larger = effectPreviewBounds(compact, 2, 2)
    expect(larger.radius).toBeGreaterThan(compactBounds.radius)
    expect(larger.frameRadius).toBeGreaterThan(compactBounds.frameRadius)

    const orbit = EFFECTS.find(effect => effect.id === 'stun-stars')!
    const withoutOrbit = effectPreviewBounds({ ...orbit, spiral: 0 })
    expect(effectPreviewBounds(orbit).radius).toBeGreaterThan(withoutOrbit.radius)
    expect(() => effectPreviewBounds(compact, NaN)).toThrow()
  })
  it('scales each complete burst about its anchor, including travel and orbit', () => {
    const camera = new THREE.PerspectiveCamera(), anchor = new THREE.Vector3(3, 2, -1)
    for (const id of ['heavy-impact', 'landing-dust', 'stun-stars', 'crate-break']) {
      const full = new InkEffects(), half = new InkEffects()
      full.trigger(id, anchor); half.trigger(id, anchor, undefined, .5)
      full.update(.2, camera); half.update(.2, camera)
      for (let pool = 0; pool < full.group.children.length; pool++) {
        const a = full.group.children[pool] as THREE.InstancedMesh
        const b = half.group.children[pool] as THREE.InstancedMesh
        expect(b.count).toBe(a.count)
        for (let index = 0; index < a.count; index++) {
          const ma = new THREE.Matrix4(), mb = new THREE.Matrix4()
          a.getMatrixAt(index, ma); b.getMatrixAt(index, mb)
          const pa = new THREE.Vector3().setFromMatrixPosition(ma).sub(anchor).multiplyScalar(.5)
          const pb = new THREE.Vector3().setFromMatrixPosition(mb).sub(anchor)
          expect(pa.distanceTo(pb), id).toBeLessThan(.00001)
          expect(new THREE.Vector3().setFromMatrixScale(mb).x).toBeCloseTo(new THREE.Vector3().setFromMatrixScale(ma).x * .5, 5)
        }
      }
      full.dispose(); half.dispose()
    }
  })
  it('uses elapsed time so particle paths match at 30 and 120 Hz', () => {
    const camera = new THREE.PerspectiveCamera(), slow = new InkEffects(), fast = new InkEffects()
    slow.trigger('crate-break', new THREE.Vector3()); fast.trigger('crate-break', new THREE.Vector3())
    for (let i = 0; i < 6; i++) slow.update(1 / 30, camera)
    for (let i = 0; i < 24; i++) fast.update(1 / 120, camera)
    for (let pool = 0; pool < slow.group.children.length; pool++) {
      const a = slow.group.children[pool] as THREE.InstancedMesh, b = fast.group.children[pool] as THREE.InstancedMesh
      expect(a.count).toBe(b.count)
      for (let index = 0; index < a.count * 16; index++) expect(a.instanceMatrix.array[index]).toBeCloseTo(b.instanceMatrix.array[index], 5)
    }
    slow.dispose(); fast.dispose()
  })
  it('uses a fixed capacity under repeated triggers and clears all instances', () => {
    const effects = new InkEffects(50), camera = new THREE.PerspectiveCamera()
    expect(effects.group.children).toHaveLength(7)
    for (let i = 0; i < 300; i++) effects.trigger('explosion', new THREE.Vector3())
    expect(effects.activeCount).toBe(50)
    effects.update(.1, camera)
    const count = effects.group.children.reduce((sum, mesh) => sum + (mesh as THREE.InstancedMesh).count, 0)
    expect(count).toBeLessThanOrEqual(50)
    effects.clear(); expect(effects.activeBursts).toBe(0); expect(effects.activeCount).toBe(0)
    effects.dispose()
  })
  it('expands open dust strokes while their instance alpha fades', () => {
    const effects = new InkEffects(), camera = new THREE.PerspectiveCamera()
    effects.trigger('landing-dust', new THREE.Vector3())
    effects.update(.1, camera)
    const dust = effects.group.children.find(child => Boolean((child as THREE.InstancedMesh).geometry.getAttribute('instanceOpacity'))) as THREE.InstancedMesh
    const alpha = dust.geometry.getAttribute('instanceOpacity')
    const matrix = new THREE.Matrix4(), scale = new THREE.Vector3()
    dust.getMatrixAt(0, matrix); scale.setFromMatrixScale(matrix)
    const firstScale = scale.x, firstAlpha = alpha.getX(0)
    expect(firstAlpha).toBeGreaterThan(0)
    expect(firstAlpha).toBeLessThan(1)
    expect((dust.material as THREE.MeshBasicMaterial).forceSinglePass).toBe(true)
    effects.update(.12, camera)
    dust.getMatrixAt(0, matrix); scale.setFromMatrixScale(matrix)
    expect(scale.x).toBeGreaterThan(firstScale)
    expect(alpha.getX(0)).toBeLessThan(firstAlpha)
    effects.clear(); expect(dust.visible).toBe(false)
    effects.dispose()
  })
  it('keeps the default pool at 2048 particles', () => {
    const effects = new InkEffects()
    for (let i = 0; i < 300; i++) effects.trigger('explosion', new THREE.Vector3())
    expect(effects.activeCount).toBe(2048)
    effects.dispose()
  })
  it('replays the same transforms after clearing an intervening effect sequence', () => {
    const camera = new THREE.PerspectiveCamera(32, 1, .01, 200)
    camera.position.set(0, 1, 4); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true)
    const origin = new THREE.Vector3(0, 1, 0)
    const fresh = new InkEffects()
    fresh.trigger('heavy-impact', origin, '#337755', 1, .2, 1)
    fresh.update(.12, camera)

    const reused = new InkEffects()
    reused.trigger('explosion', new THREE.Vector3(2, 0, 1), '#d45538', .8, -.4, 1.3)
    reused.trigger('stun-stars', new THREE.Vector3(-2, 1, -1), '#337755', .7, .6, .9)
    reused.update(.08, camera)
    reused.clear()
    reused.trigger('heavy-impact', origin, '#337755', 1, .2, 1)
    reused.update(.12, camera)

    const snapshot = (effects: InkEffects): Array<{ count: number; matrices: number[] }> => effects.group.children.map(child => {
      const mesh = child as THREE.InstancedMesh
      return { count: mesh.count, matrices: Array.from(mesh.instanceMatrix.array.slice(0, mesh.count * 16)) }
    })
    expect(snapshot(reused)).toEqual(snapshot(fresh))
    reused.dispose(); fresh.dispose()
  })
  it('contains every transformed vertex inside sampled bounds for all effects', () => {
    const camera = new THREE.PerspectiveCamera(32, 1, .01, 200)
    camera.position.set(0, 1, 4); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true)
    const instanceMatrix = new THREE.Matrix4()
    const localVertex = new THREE.Vector3()
    const worldVertex = new THREE.Vector3()
    const origin = new THREE.Vector3()
    const tolerance = .06
    for (const preset of EFFECTS) {
      const effects = new InkEffects()
      const bounds = effectPreviewBounds(preset)
      effects.trigger(preset.id, origin)
      let frames = 0
      while (effects.activeCount > 0 && frames < 240) {
        effects.update(1 / 60, camera)
        const center = origin.clone().add(bounds.center)
        for (const child of effects.group.children) {
          const mesh = child as THREE.InstancedMesh
          const positions = mesh.geometry.getAttribute('position')
          for (let instance = 0; instance < mesh.count; instance++) {
            mesh.getMatrixAt(instance, instanceMatrix)
            for (let vertex = 0; vertex < positions.count; vertex++) {
              localVertex.fromBufferAttribute(positions, vertex)
              worldVertex.copy(localVertex).applyMatrix4(instanceMatrix)
              expect(worldVertex.distanceTo(center), preset.id).toBeLessThanOrEqual(bounds.radius + tolerance)
            }
          }
        }
        frames++
      }
      expect(effects.activeCount, preset.id).toBe(0)
      expect(frames, preset.id).toBeLessThan(240)
      effects.dispose()
    }
  })
  it('runs every effect to completion without non-finite transforms', () => {
    const effects = new InkEffects(), camera = new THREE.PerspectiveCamera()
    for (const preset of EFFECTS) {
      effects.trigger(preset.id, new THREE.Vector3(0, 1, 0))
      for (let i = 0; i < 120; i++) effects.update(1 / 60, camera)
      expect(effects.activeCount, preset.id).toBe(0)
      expect(effects.activeBursts, preset.id).toBe(0)
      for (const mesh of effects.group.children) expect([...((mesh as THREE.InstancedMesh).instanceMatrix.array)].every(Number.isFinite)).toBe(true)
    }
    effects.dispose()
  })
  it('copies spawn positions so effects remain independent of moving actors', () => {
    const effects = new InkEffects(), camera = new THREE.PerspectiveCamera(), point = new THREE.Vector3(0, 1, 0)
    effects.trigger('punch-impact', point); point.set(1000, 1000, 1000); effects.update(.1, camera)
    const matrix = new THREE.Matrix4(), position = new THREE.Vector3()
    for (const child of effects.group.children) {
      const mesh = child as THREE.InstancedMesh
      for (let i = 0; i < mesh.count; i++) { mesh.getMatrixAt(i, matrix); position.setFromMatrixPosition(matrix); expect(position.length()).toBeLessThan(5) }
    }
    effects.dispose()
  })
  it('keeps ink and paper layers while applying the requested accent color', () => {
    const effects = new InkEffects(), camera = new THREE.PerspectiveCamera(), expected = new THREE.Color('#337755')
    effects.trigger('heavy-impact', new THREE.Vector3(), '#337755'); effects.update(.12, camera)
    const color = new THREE.Color(), star = effects.group.children[6] as THREE.InstancedMesh, spark = effects.group.children[1] as THREE.InstancedMesh
    expect(star.count).toBe(2)
    star.getColorAt(0, color); expect(color.getHexString()).toBe(new THREE.Color(INK).getHexString())
    star.getColorAt(1, color); expect(color.getHexString()).toBe(new THREE.Color(PAPER).getHexString())
    const outerMatrix = new THREE.Matrix4(), coreMatrix = new THREE.Matrix4()
    const outerPosition = new THREE.Vector3(), corePosition = new THREE.Vector3()
    const outerRotation = new THREE.Quaternion(), coreRotation = new THREE.Quaternion()
    const outerScale = new THREE.Vector3(), coreScale = new THREE.Vector3()
    star.getMatrixAt(0, outerMatrix); star.getMatrixAt(1, coreMatrix)
    outerMatrix.decompose(outerPosition, outerRotation, outerScale); coreMatrix.decompose(corePosition, coreRotation, coreScale)
    expect(corePosition.distanceTo(outerPosition)).toBeCloseTo(0)
    expect(coreRotation.angleTo(outerRotation)).toBeCloseTo(0)
    expect(coreScale.x / outerScale.x).toBeCloseTo(.5)
    const starColors = new Set<string>(), sparkColors = new Set<string>()
    for (let i = 0; i < star.count; i++) { star.getColorAt(i, color); starColors.add(color.getHexString()) }
    for (let i = 0; i < spark.count; i++) { spark.getColorAt(i, color); sparkColors.add(color.getHexString()) }
    expect(starColors).toEqual(new Set([new THREE.Color(INK).getHexString(), new THREE.Color(PAPER).getHexString()]))
    expect(sparkColors).toEqual(new Set([expected.getHexString()]))
    expect(resolveEffectColor('paper', '#337755')).toBe(PAPER)
    expect(resolveEffectColor('ink', '#337755')).toBe(INK)
    expect(resolveEffectColor('accent', '#337755')).toBe('#337755')
    expect(() => effects.trigger('heavy-impact', new THREE.Vector3(NaN, 0, 0))).toThrow()
    expect(() => effects.update(NaN, camera)).toThrow()
    effects.dispose()
  })

  it('uses a fast attack and clear release while reporting the full burst duration', () => {
    expect(effectEnvelope(0)).toBe(0)
    expect(effectEnvelope(.05)).toBeGreaterThan(.5)
    expect(effectEnvelope(.54)).toBeCloseTo(1)
    expect(effectEnvelope(.96)).toBeLessThan(.1)
    expect(effectEnvelope(1)).toBe(0)

    const effects = new InkEffects(), camera = new THREE.PerspectiveCamera()
    const duration = effects.trigger('checkpoint', new THREE.Vector3(), '#337755')
    expect(duration).toBeGreaterThan(0)
    expect(effects.activeCount).toBe(5)
    expect(effects.activeBursts).toBe(1)
    effects.update(duration + 1 / 60, camera)
    expect(effects.activeCount).toBe(0)
    expect(effects.activeBursts).toBe(0)
    effects.dispose()
  })

})
