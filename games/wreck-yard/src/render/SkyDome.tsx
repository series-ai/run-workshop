import { useMemo } from 'react';
import * as THREE from 'three';
import { ART_STYLE } from './style/artStyle';

export function SkyDome() {
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uSkyZenith: { value: new THREE.Color(ART_STYLE.palette.skyZenith) },
        uSkyBand: { value: new THREE.Color(ART_STYLE.palette.skyBand) },
        uSkyLow: { value: new THREE.Color(ART_STYLE.palette.skyLow) },
        uSteps: { value: ART_STYLE.sky.steps },
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
        uniform vec3 uSkyZenith;
        uniform vec3 uSkyBand;
        uniform vec3 uSkyLow;
        uniform float uSteps;
        varying vec3 vWorldPosition;

        void main() {
          vec3 dir = normalize(vWorldPosition);
          float y = dir.y;

          vec3 sky;
          if (y > 0.0) {
            // Quantize elevation parameter into discrete steps
            float t = clamp(y / 0.45, 0.0, 1.0);
            float steppedT = floor(t * uSteps) / (uSteps - 1.0);

            // Interpolate between horizon red-orange, warm transition band, and dark zenith
            if (steppedT < 0.35) {
              float localT = steppedT / 0.35;
              sky = mix(uSkyLow, uSkyBand, localT);
            } else {
              float localT = (steppedT - 0.35) / 0.65;
              sky = mix(uSkyBand, uSkyZenith, localT);
            }
          } else {
            sky = uSkyLow;
          }

          gl_FragColor = vec4(sky, 1.0);
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
