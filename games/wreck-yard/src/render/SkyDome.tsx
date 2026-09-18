import { useMemo } from 'react';
import * as THREE from 'three';

export function SkyDome() {
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTopColor: { value: new THREE.Color('#2e1065') }, // Deep twilight violet zenith (Spider-Verse style)
        uMidColor: { value: new THREE.Color('#c026d3') }, // Radiant electric magenta / fuchsia midband
        uHorizonColor: { value: new THREE.Color('#fb923c') }, // Warm golden coral / amber horizon
        uSunColor: { value: new THREE.Color('#fef08a') }, // Radiant sun glare
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

          // Multi-layer Spider-Verse sunset gradient
          vec3 sky;
          if (y > 0.0) {
            float tZenith = pow(clamp(y, 0.0, 1.0), 0.65);
            float tHorizon = pow(clamp(1.0 - y, 0.0, 1.0), 1.8);
            vec3 upperSky = mix(uMidColor, uTopColor, tZenith);
            sky = mix(upperSky, uHorizonColor, tHorizon);

            // Subtle comic screentone dither on dusk boundary
            vec2 screenGrid = fract(dir.xy * 85.0);
            float dotDist = length(screenGrid - 0.5);
            float halftone = smoothstep(0.48, 0.28, dotDist);
            float duskBand = smoothstep(0.15, 0.45, y) * smoothstep(0.65, 0.35, y);
            sky += (uMidColor - sky) * (halftone * duskBand * 0.18);
          } else {
            sky = mix(uHorizonColor, vec3(0.08, 0.06, 0.10), clamp(-y * 4.0, 0.0, 1.0));
          }

          // Radiant stylized sun glow with chromatic corona
          float sunCos = dot(dir, normalize(uSunDirection));
          float sunCorona = pow(max(sunCos, 0.0), 12.0) * 0.35;
          float sunGlow = pow(max(sunCos, 0.0), 48.0) * 0.65;
          float sunCore = pow(max(sunCos, 0.0), 768.0) * 2.0;
          vec3 finalColor = sky + uMidColor * sunCorona + uSunColor * (sunGlow + sunCore);

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
