import { useFrame } from '@react-three/fiber';
import type { RefObject } from 'react';
import type { DitherEffect } from '../dither/DitherPostProcess';

/** Advances the dither effect's uTime uniform once per frame. */
export function DitherEffectUpdater({ effectRef }: { effectRef: RefObject<DitherEffect | null> }) {
  useFrame((_, dt) => effectRef.current?.updateTime(dt));
  return null;
}
