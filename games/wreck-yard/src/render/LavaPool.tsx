import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { LAVA, LAVA_BOUNDS, LAVA_SOLIDS } from '../sim/liquidAssets';
import { useReducedMotionRef } from './reducedMotion';
import { ART_STYLE } from './style/artStyle';
import { Toon } from './style/toonMaterial';

const noRaycast = () => null;
const SURFACE_SIZE = [
  LAVA_BOUNDS.max[0] - LAVA_BOUNDS.min[0],
  LAVA_BOUNDS.max[2] - LAVA_BOUNDS.min[2],
] as const;

function createLavaMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: 'lava-molten-crust',
    toneMapped: false,
    clipping: true,
    uniforms: {
      time: { value: 0 },
      size: { value: new THREE.Vector2(...SURFACE_SIZE) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vLavaUv;
      #include <clipping_planes_pars_vertex>

      void main() {
        vLavaUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <clipping_planes_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float time;
      uniform vec2 size;
      varying vec2 vLavaUv;
      #include <clipping_planes_pars_fragment>

      vec2 cellSeed(vec2 cell) {
        return fract(sin(vec2(dot(cell, vec2(127.1, 311.7)), dot(cell, vec2(269.5, 183.3)))) * 43758.5453);
      }

      void main() {
        #include <clipping_planes_fragment>
        vec2 p = vLavaUv * size * 3.6;
        p += vec2(sin(p.y * 0.7 + time * 0.12), cos(p.x * 0.6 - time * 0.1)) * 0.18;
        vec2 cell = floor(p);
        vec2 local = fract(p);
        float nearest = 8.0;
        float nextNearest = 8.0;
        for (int y = -1; y <= 1; y++) {
          for (int x = -1; x <= 1; x++) {
            vec2 offset = vec2(float(x), float(y));
            vec2 seed = cellSeed(cell + offset);
            vec2 center = 0.5 + 0.3 * sin(seed * 6.283185 + time * 0.1);
            float distanceToCell = length(offset + center - local);
            nextNearest = min(nextNearest, max(nearest, distanceToCell));
            nearest = min(nearest, distanceToCell);
          }
        }
        float gap = nextNearest - nearest;
        float molten = 1.0 - smoothstep(0.035, 0.2, gap);
        float flow = 0.5 + 0.5 * sin(p.x * 2.1 + sin(p.y * 1.8) - time * 0.35);
        vec3 crust = mix(vec3(0.028, 0.018, 0.014), vec3(0.12, 0.038, 0.012), flow);
        vec3 lava = mix(vec3(0.95, 0.095, 0.004), vec3(1.0, 0.48, 0.035), flow);
        vec3 color = mix(crust, lava, molten);
        color += vec3(0.3, 0.08, 0.005) * (1.0 - smoothstep(0.0, 0.035, gap));
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

export function LavaPool() {
  const material = useMemo(createLavaMaterial, []);
  const reducedMotion = useReducedMotionRef();
  useEffect(() => () => material.dispose(), [material]);

  useFrame((_, delta) => {
    if (!reducedMotion.current) material.uniforms.time!.value += Math.min(delta, 0.1);
  });

  return (
    <group name="liquid-assets-lava" userData={{ departmentId: 'float', bounds: LAVA_BOUNDS }}>
      {LAVA_SOLIDS.map((box) => (
        <mesh key={box.id} name={box.id} position={[...box.center]} raycast={noRaycast}>
          <boxGeometry args={[...box.size]} />
          <Toon color={ART_STYLE.palette.concreteShade} />
        </mesh>
      ))}
      <mesh
        name="lava-surface"
        position={[LAVA.center[0], LAVA.surfaceY, LAVA.center[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={material}
        raycast={noRaycast}
      >
        <planeGeometry args={[...SURFACE_SIZE]} />
      </mesh>
    </group>
  );
}
