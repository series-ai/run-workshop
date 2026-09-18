import { useMemo } from 'react';
import * as THREE from 'three';

export function SkyDome() {
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTopColor: { value: new THREE.Color('#0f172a') }, // Deep slate night/twilight
        uMidColor: { value: new THREE.Color('#334155') }, // Mid sky
        uHorizonColor: { value: new THREE.Color('#ea580c') }, // Warm sunset amber/orange
        uSunColor: { value: new THREE.Color('#fef08a') }, // Golden sun glare
        uSunDirection: { value: new THREE.Vector3(14, 18, 10).normalize() },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTopColor;
        uniform vec3 uMidColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunColor;
        uniform vec3 uSunDirection;
        varying vec3 vWorldPosition;

        void main() {
          vec3 dir = normalize(vWorldPosition);
          float y = dir.y;

          // Sky gradient from horizon to zenith
          vec3 sky;
          if (y > 0.0) {
            float h = pow(1.0 - y, 2.5);
            sky = mix(uTopColor, uMidColor, pow(1.0 - y, 0.8));
            sky = mix(sky, uHorizonColor, h);
          } else {
            sky = mix(uHorizonColor, vec3(0.08, 0.09, 0.10), clamp(-y * 4.0, 0.0, 1.0));
          }

          // Subtle sun glow
          float sunCos = dot(dir, normalize(uSunDirection));
          float sunGlow = pow(max(sunCos, 0.0), 32.0) * 0.45;
          float sunCore = pow(max(sunCos, 0.0), 512.0) * 1.5;
          vec3 finalColor = sky + uSunColor * (sunGlow + sunCore);

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });
  }, []);

  return (
    <mesh renderOrder={-1000}>
      <sphereGeometry args={[180, 32, 16]} />
      <primitive object={shaderMaterial} attach="material" />
    </mesh>
  );
}
