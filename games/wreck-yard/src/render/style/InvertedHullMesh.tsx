import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { createInvertedHullMaterial } from './invertedHullMaterial';

export interface InvertedHullMeshProps {
  geometry: THREE.BufferGeometry;
  thickness?: number;
  color?: string | THREE.Color;
  alpha?: number;
}

export function InvertedHullMesh({
  geometry,
  thickness = 0.024,
  color,
  alpha = 0.95,
}: InvertedHullMeshProps) {
  const material = useMemo(() => {
    return createInvertedHullMaterial(thickness, color, alpha);
  }, [thickness, color, alpha]);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  return <mesh geometry={geometry} material={material} />;
}
