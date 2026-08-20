import { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import type * as THREE from 'three';

/** Aspect-fitted textured plane for an orthographic canvas. */
export function MediaPlane({ texture, aspect }: { texture: THREE.Texture; aspect: number }) {
  const viewport = useThree((s) => s.viewport);

  const [w, h] = useMemo(() => {
    const vpAspect = viewport.width / viewport.height;
    return aspect >= vpAspect
      ? ([viewport.width, viewport.width / aspect] as const)
      : ([viewport.height * aspect, viewport.height] as const);
  }, [viewport.width, viewport.height, aspect]);

  return (
    <mesh scale={[w, h, 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}
