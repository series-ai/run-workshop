import type { PfxPreset } from '../types/01'

export function getPfxGeometryResourceKey(preset: Pick<PfxPreset, 'controls' | 'implementationProfile'>): string {
  const controls = preset.controls
  return [
    preset.implementationProfile,
    controls.seed,
    controls.density,
    controls.lod.join('/'),
    controls.velocity,
    controls.lifetime,
    controls.scale,
    controls.trailLength,
    controls.spawnShape,
    controls.gravity,
  ].join(':')
}
