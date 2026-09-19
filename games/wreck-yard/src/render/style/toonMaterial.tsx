import { useMemo } from 'react';
import * as THREE from 'three';
import { ART_STYLE } from './artStyle';

let sharedGradientMap: THREE.DataTexture | null = null;

export function getToonGradientMap(): THREE.DataTexture {
  if (!sharedGradientMap) {
    const size = 256;
    const data = new Uint8Array(size);
    const edge0 = ART_STYLE.ramp.edges[0];
    const edge1 = ART_STYLE.ramp.edges[1];
    const halfByte = Math.round(ART_STYLE.ramp.halfLevel * 255);

    for (let i = 0; i < size; i++) {
      const u = (i + 0.5) / size;
      const dotNL = (u - 0.5) * 2.0;
      if (dotNL < edge0) {
        data[i] = 0;
      } else if (dotNL < edge1) {
        data[i] = halfByte;
      } else {
        data[i] = 255;
      }
    }

    sharedGradientMap = new THREE.DataTexture(
      data,
      size,
      1,
      THREE.RedFormat,
      THREE.UnsignedByteType,
    );
    sharedGradientMap.minFilter = THREE.NearestFilter;
    sharedGradientMap.magFilter = THREE.NearestFilter;
    sharedGradientMap.generateMipmaps = false;
    sharedGradientMap.needsUpdate = true;
  }
  return sharedGradientMap;
}

const materialCache = new Map<string, THREE.MeshToonMaterial>();

export function getToonMaterial(
  color: string | THREE.Color,
  options?: Partial<THREE.MeshToonMaterialParameters>,
): THREE.MeshToonMaterial {
  const hex = typeof color === 'string' ? color.toLowerCase() : `#${color.getHexString()}`;
  const key = `${hex}:${JSON.stringify(options ?? {})}`;
  const existing = materialCache.get(key);
  if (existing) {
    return existing;
  }

  const mat = new THREE.MeshToonMaterial({
    color: hex,
    gradientMap: getToonGradientMap(),
    ...options,
  });
  materialCache.set(key, mat);
  return mat;
}

export type ToonProps = {
  color: string;
} & Partial<THREE.MeshToonMaterialParameters>;

export function Toon({ color, ...options }: ToonProps) {
  const optionsKey = JSON.stringify(options);
  const material = useMemo(() => {
    return getToonMaterial(color, options);
  }, [color, optionsKey]);

  return <primitive object={material} attach="material" />;
}
