import * as THREE from 'three';
import { ART_STYLE } from './artStyle';

export interface InvertedHullUniforms {
  [uniform: string]: THREE.IUniform;
  uThickness: { value: number };
  uColor: { value: THREE.Color };
  uAlpha: { value: number };
}

const INVERTED_HULL_VERTEX = /* glsl */ `
uniform float uThickness;

void main() {
  // View-space extrusion along surface normal
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vec3 mvNormal = normalize(normalMatrix * normal);

  // Extrude in view space with slight distance compensation
  float dist = max(1.0, -mvPosition.z);
  float scale = clamp(dist * 0.08, 0.6, 2.5);
  mvPosition.xyz += mvNormal * (uThickness * scale);

  gl_Position = projectionMatrix * mvPosition;
}
`;

const INVERTED_HULL_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;

void main() {
  gl_FragColor = vec4(uColor, uAlpha);
}
`;

export function createInvertedHullMaterial(
  thickness = 0.024,
  color: string | THREE.Color = ART_STYLE.palette.ink,
  alpha = 0.95,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uThickness: { value: thickness },
      uColor: { value: new THREE.Color(color) },
      uAlpha: { value: alpha },
    },
    vertexShader: INVERTED_HULL_VERTEX,
    fragmentShader: INVERTED_HULL_FRAGMENT,
    side: THREE.BackSide,
    depthTest: true,
    depthWrite: true,
    transparent: alpha < 1.0,
    polygonOffset: true,
    polygonOffsetFactor: 1.0,
    polygonOffsetUnits: 1.0,
  });
}
