import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxHologramAuraLifecycle(cycle: number): {
  energy: number
  scale: number
  stage: 'boot' | 'scan' | 'glitch' | 'recover'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.14) {
    const boot = smooth(phase / 0.14)
    return {
      energy: roundMetric(0.16 + boot * 0.58),
      scale: roundMetric(0.7 + boot * 0.3),
      stage: 'boot',
    }
  }
  if (phase < 0.68) {
    const scan = (phase - 0.14) / 0.54
    return {
      energy: roundMetric(0.82 + Math.sin(scan * Math.PI) * 0.18),
      scale: roundMetric(1 + Math.sin(scan * Math.PI * 2) * 0.025),
      stage: 'scan',
    }
  }
  if (phase < 0.84) {
    const glitch = smooth((phase - 0.68) / 0.16)
    return {
      energy: roundMetric(0.7 - Math.sin(glitch * Math.PI) * 0.38),
      scale: roundMetric(0.98 + Math.sin(glitch * Math.PI * 3) * 0.045),
      stage: 'glitch',
    }
  }
  const recover = smooth((phase - 0.84) / 0.16)
  return {
    energy: roundMetric(0.58 + recover * 0.2),
    scale: roundMetric(0.97 + recover * 0.03),
    stage: 'recover',
  }
}
