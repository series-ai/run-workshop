import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { RETURNS_FRAME, RETURNS_PAIR } from '../sim/returns';
import { ART_STYLE } from './style/artStyle';

function signTexture(label: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 650;
  canvas.height = 104;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('WRECK_YARD_RETURNS_SIGN_CANVAS_FAILED');
  context.fillStyle = '#18212b';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = ART_STYLE.palette.signalOrange;
  context.lineWidth = 8;
  context.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
  context.fillStyle = '#ece3cb';
  context.font = '900 58px monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(label, canvas.width / 2, canvas.height / 2 + 2, canvas.width - 44);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

const END_CONFIG = [
  { id: 'A', label: 'DELIVERY', end: RETURNS_PAIR.portalA },
  { id: 'B', label: 'RETURNS', end: RETURNS_PAIR.portalB },
] as const;

export function ReturnsDepartment() {
  const assets = useMemo(() => {
    const geometries = RETURNS_FRAME.parts.map((part) => new THREE.BoxGeometry(...part.size));
    const frame = new THREE.MeshStandardMaterial({
      color: ART_STYLE.palette.signalOrange,
      emissive: '#351807',
      metalness: 0.58,
      roughness: 0.42,
    });
    const trim = new THREE.MeshStandardMaterial({
      color: ART_STYLE.palette.metal,
      metalness: 0.76,
      roughness: 0.31,
    });
    const signs = [signTexture('DELIVERY'), signTexture('RETURNS')];
    const signMaterials = signs.map((map) => new THREE.MeshBasicMaterial({ map, toneMapped: false }));
    return { geometries, frame, trim, signs, signMaterials };
  }, []);

  useEffect(() => () => {
    assets.geometries.forEach((geometry) => geometry.dispose());
    assets.frame.dispose();
    assets.trim.dispose();
    assets.signs.forEach((texture) => texture.dispose());
    assets.signMaterials.forEach((material) => material.dispose());
  }, [assets]);

  return (
    <group name="returns-department">
      {END_CONFIG.map(({ id, label, end }, doorIndex) => (
        <group
          key={id}
          name={`returns-door-${label.toLowerCase()}`}
          position={[end.position.x, end.position.y, end.position.z]}
          quaternion={[end.rotation.x, end.rotation.y, end.rotation.z, end.rotation.w]}
        >
          {RETURNS_FRAME.parts.map((part, index) => (
            <mesh
              key={part.id}
              name={`returns-${label.toLowerCase()}-${part.id}`}
              geometry={assets.geometries[index]}
              material={part.id === 'header' ? assets.trim : assets.frame}
              position={part.center}
              castShadow
              receiveShadow
            />
          ))}
          <mesh
            name={`returns-sign-${label.toLowerCase()}`}
            position={[0, 2.76, 0.24]}
            material={assets.signMaterials[doorIndex]}
          >
            <planeGeometry args={[3.25, 0.52]} />
          </mesh>
          <mesh name={`returns-${label.toLowerCase()}-warning-light`} position={[0, 2.18, 0.25]}>
            <boxGeometry args={[0.28, 0.08, 0.04]} />
            <meshBasicMaterial color={ART_STYLE.palette.signalOrange} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
