import { useMemo } from 'react';
import * as THREE from 'three';
import { meshVoxelGrids } from './voxelMesher';
import { DRESSING_LAYOUT } from './layout';
import { getToonMaterial } from '../style/toonMaterial';

const noRaycast = () => null;

export function YardDressing() {
  const geometry = useMemo(() => {
    const meshed = meshVoxelGrids(DRESSING_LAYOUT);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(meshed.positions, 3));
    geom.setAttribute('normal', new THREE.BufferAttribute(meshed.normals, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(meshed.colors, 3));
    geom.setIndex(new THREE.BufferAttribute(meshed.indices, 1));
    return geom;
  }, []);

  const material = useMemo(() => {
    // Shared toon material with vertexColors enabled
    const mat = getToonMaterial('#ffffff');
    const clone = mat.clone();
    clone.vertexColors = true;
    return clone;
  }, []);

  return (
    <mesh
      name="YardDressing"
      geometry={geometry}
      material={material}
      castShadow
      receiveShadow
      raycast={noRaycast}
    />
  );
}
