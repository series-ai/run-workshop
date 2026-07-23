import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxSlimeBurstLifecycle(cycle: number): {
  energy: number
  splat: number
  rebound: number
  stringing: number
  stage: 'splat' | 'rebound' | 'stringing' | 'rest'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.1) {
    const splat = smooth(phase / 0.1)
    return { energy: roundMetric(0.62 + splat * 0.28), splat: roundMetric(1 - splat * 0.12), rebound: roundMetric(0.06 + splat * 0.16), stringing: 0, stage: 'splat' }
  }
  if (phase < 0.42) {
    const rebound = smooth((phase - 0.1) / 0.32)
    const fastRebound = smooth((phase - 0.1) / 0.1)
    return { energy: roundMetric(0.9 + Math.sin(rebound * Math.PI) * 0.1), splat: roundMetric(0.88 * (1 - rebound)), rebound: roundMetric(0.22 + fastRebound * 0.78), stringing: roundMetric(rebound * 0.24), stage: 'rebound' }
  }
  if (phase < 0.86) {
    const stringing = smooth((phase - 0.42) / 0.44)
    return { energy: roundMetric(0.9 * Math.pow(1 - stringing, 0.88)), splat: 0, rebound: roundMetric(1 - stringing * 0.12), stringing: roundMetric(0.62 + Math.sin(stringing * Math.PI) * 0.38), stage: 'stringing' }
  }
  return { energy: 0, splat: 0, rebound: 0, stringing: 0, stage: 'rest' }
}
