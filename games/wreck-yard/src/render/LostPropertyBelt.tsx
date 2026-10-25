import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LOST_PROPERTY_BELT } from '../sim/lostProperty';
import { TICK_RATE } from '../sim/constants';
import type { YardRender } from './presentation';
import { ART_STYLE } from './style/artStyle';

const noRaycast = () => null;
/** Both the 0.23 m ribs and 1.1 m arrows repeat after this distance. */
const PATTERN_REPEAT_METERS = 25.3;

function colorGeometry(geometry: THREE.BufferGeometry, value: string) {
  const color = new THREE.Color(value);
  const colors = new Float32Array(geometry.getAttribute('position').count * 3);
  for (let index = 0; index < colors.length; index += 3) {
    colors[index] = color.r;
    colors[index + 1] = color.g;
    colors[index + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function createBeltAssets() {
  const [length, height, width] = LOST_PROPERTY_BELT.size;
  const shell = new THREE.BoxGeometry(length, height, width);
  const shellMaterial = new THREE.MeshStandardMaterial({ color: '#263138', metalness: 0.52, roughness: 0.76 });
  const parts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const rail = colorGeometry(new THREE.BoxGeometry(length - 0.04, 0.1, 0.055), ART_STYLE.palette.teal);
    rail.translate(0, height / 2 - 0.06, side * (width / 2 - 0.04));
    parts.push(rail);
    const sill = colorGeometry(new THREE.BoxGeometry(length - 0.12, 0.035, 0.025), ART_STYLE.palette.metal);
    sill.translate(0, -height / 2 + 0.07, side * (width / 2 - 0.015));
    parts.push(sill);
    for (let x = -length / 2 + 0.3; x < length / 2 - 0.1; x += 0.48) {
      const vent = colorGeometry(new THREE.BoxGeometry(0.16, 0.075, 0.012), ART_STYLE.palette.ink);
      vent.translate(x, -0.025, side * (width / 2 - 0.008));
      parts.push(vent);
    }
  }
  for (const side of [-1, 1]) {
    const roller = colorGeometry(new THREE.CylinderGeometry(0.14, 0.14, width - 0.14, 12), ART_STYLE.palette.metal);
    roller.rotateX(Math.PI / 2);
    roller.translate(side * (length / 2 - 0.17), height / 2 - 0.145, 0);
    parts.push(roller);
    for (const zSide of [-1, 1]) {
      const cap = colorGeometry(new THREE.BoxGeometry(0.13, 0.15, 0.04), ART_STYLE.palette.signalOrange);
      cap.translate(side * (length / 2 - 0.17), height / 2 - 0.12, zSide * (width / 2 - 0.03));
      parts.push(cap);
    }
  }
  const trim = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  if (!trim) throw new Error('WRECK_YARD_LOST_PROPERTY_GEOMETRY');
  trim.name = 'lost-property-contained-rails-rollers-and-vents';
  const trimMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.56, roughness: 0.66 });
  const top = new THREE.PlaneGeometry(length - 0.28, width - 0.12);
  top.rotateX(-Math.PI / 2);
  top.translate(0, height / 2, 0);
  const topMaterial = new THREE.ShaderMaterial({
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    uniforms: {
      travel: { value: 0 },
      beltLength: { value: length - 0.28 },
      rubber: { value: new THREE.Color('#182729') },
      rib: { value: new THREE.Color('#42605c') },
      signal: { value: new THREE.Color(ART_STYLE.palette.teal) },
    },
    vertexShader: `
      varying vec2 beltUv;
      void main() {
        beltUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float travel;
      uniform float beltLength;
      uniform vec3 rubber;
      uniform vec3 rib;
      uniform vec3 signal;
      varying vec2 beltUv;
      void main() {
        float along = beltUv.x * beltLength - travel;
        float seam = 1.0 - smoothstep(0.018, 0.032, abs(fract(along / 0.23) - 0.5) * 0.23);
        float edges = step(beltUv.y, 0.025) + step(0.975, beltUv.y);
        float chevron = abs(fract(along / 1.1 + abs(beltUv.y - 0.5) * 0.6) - 0.5);
        float arrow = (1.0 - smoothstep(0.025, 0.055, chevron)) * step(0.24, beltUv.y) * step(beltUv.y, 0.76);
        vec3 color = mix(rubber, rib, seam * 0.48);
        color = mix(color, signal, max(edges * 0.65, arrow * 0.82));
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  return { shell, shellMaterial, trim, trimMaterial, top, topMaterial };
}

export function LostPropertyBelt({ renderRef }: { renderRef: MutableRefObject<YardRender | null> }) {
  const assets = useMemo(createBeltAssets, []);
  useFrame(() => {
    const frame = renderRef.current?.frame ?? 0;
    const distance = frame / TICK_RATE * LOST_PROPERTY_BELT.surfaceVelocity[0];
    const phase = distance % PATTERN_REPEAT_METERS;
    assets.topMaterial.uniforms.travel!.value = phase;
  });
  useEffect(() => () => {
    assets.shell.dispose();
    assets.shellMaterial.dispose();
    assets.trim.dispose();
    assets.trimMaterial.dispose();
    assets.top.dispose();
    assets.topMaterial.dispose();
  }, [assets]);

  return (
    <group
      name="lost-property-belt"
      position={[...LOST_PROPERTY_BELT.center]}
      userData={{ departmentId: 'lost-property', center: LOST_PROPERTY_BELT.center, size: LOST_PROPERTY_BELT.size, topY: LOST_PROPERTY_BELT.center[1] + LOST_PROPERTY_BELT.size[1] / 2, surfaceVelocity: LOST_PROPERTY_BELT.surfaceVelocity }}
    >
      <mesh name="lost-property-belt-shell" geometry={assets.shell} material={assets.shellMaterial} raycast={noRaycast} />
      <mesh name="lost-property-belt-trim" geometry={assets.trim} material={assets.trimMaterial} raycast={noRaycast} userData={{ containedDecoration: true }} />
      <mesh name="lost-property-belt-surface" geometry={assets.top} material={assets.topMaterial} raycast={noRaycast} userData={{ text: 'LOST PROPERTY / COLLECTION IS NOT GUARANTEED', direction: '+X', simulationClock: true }} />
    </group>
  );
}
