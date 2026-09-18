import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

type Vec3Tuple = [number, number, number];
const noRaycast = () => null;

export function WaterSurface({
  position,
  size,
}: {
  position: Vec3Tuple;
  size: [number, number];
}) {
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        time: { value: 0 },
      },
      vertexShader: /* glsl */ `
        uniform float time;
        varying vec3 vWorldPos;
        varying vec2 vUv;

        void main() {
          vUv = uv;
          vec3 pos = position;
          pos.z += sin(pos.x * 2.2 + time * 1.15) * 0.042;
          pos.z += sin(pos.y * 2.8 + time * 0.92) * 0.024;
          pos.z += sin((pos.x + pos.y) * 4.6 - time * 1.45) * 0.012;

          vec4 worldPos = modelMatrix * vec4(pos, 1.0);
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float time;
        varying vec3 vWorldPos;
        varying vec2 vUv;

        void main() {
          vec3 shallow = vec3(0.08, 0.78, 0.56); // Vibrant emerald turquoise
          vec3 deep = vec3(0.02, 0.26, 0.22); // Deep mineral green
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          float rippleA = sin(vWorldPos.x * 7.4 + time * 1.8);
          float rippleB = sin(vWorldPos.z * 6.1 - time * 1.35);
          float rippleC = sin((vWorldPos.x + vWorldPos.z) * 4.8 + time * 1.15);
          float ripple = rippleA * rippleB * 0.45 + rippleC * 0.55;
          float border = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
          float foam = 1.0 - smoothstep(0.02, 0.15, border + ripple * 0.015);
          float fresnel = pow(1.0 - max(dot(viewDir, vec3(0.0, 1.0, 0.0)), 0.0), 2.2);
          vec3 color = mix(deep, shallow, clamp(0.55 + ripple * 0.18, 0.0, 1.0));
          color += vec3(0.22, 0.19, 0.13) * foam * 0.35;
          color += vec3(0.08, 0.1, 0.11) * fresnel;
          float alpha = clamp(0.5 + fresnel * 0.24 + foam * 0.12, 0.42, 0.88);
          gl_FragColor = vec4(color, alpha);
        }
      `,
    });
  }, []);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  useFrame((state) => {
    material.uniforms['time']!.value = state.clock.elapsedTime;
  });

  return (
    <mesh position={position} rotation={[-Math.PI * 0.5, 0, 0]} material={material} raycast={noRaycast}>
      <planeGeometry args={[size[0], size[1], 96, 72]} />
    </mesh>
  );
}

export function WaterCaustics({
  position,
  size,
}: {
  position: Vec3Tuple;
  size: [number, number];
}) {
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        time: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;

        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float time;
        varying vec2 vUv;

        void main() {
          float waveA = sin((vUv.x + time * 0.14) * 34.0);
          float waveB = sin((vUv.y - time * 0.11) * 29.0);
          float waveC = sin((vUv.x + vUv.y + time * 0.08) * 21.0);
          float caustic = max(0.0, waveA * waveB + waveC * 0.65);
          float edgeFade = smoothstep(0.0, 0.1, vUv.x) * smoothstep(0.0, 0.1, vUv.y) * smoothstep(0.0, 0.1, 1.0 - vUv.x) * smoothstep(0.0, 0.1, 1.0 - vUv.y);
          vec3 color = vec3(0.16, 0.28, 0.24) * caustic * edgeFade;
          gl_FragColor = vec4(color, caustic * 0.22 * edgeFade);
        }
      `,
    });
  }, []);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  useFrame((state) => {
    material.uniforms['time']!.value = state.clock.elapsedTime;
  });

  return (
    <mesh position={position} rotation={[-Math.PI * 0.5, 0, 0]} material={material} raycast={noRaycast}>
      <planeGeometry args={[size[0], size[1], 1, 1]} />
    </mesh>
  );
}
