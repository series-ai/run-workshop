import type { OrientationMode } from './config'

export type LayoutMode = 'portrait' | 'landscape'

export function resolveLayoutMode(
  width: number,
  height: number,
  orientation: OrientationMode,
): LayoutMode {
  if (orientation === 'portrait') return 'portrait'
  if (orientation === 'landscape') return 'landscape'
  return width > height ? 'landscape' : 'portrait'
}
