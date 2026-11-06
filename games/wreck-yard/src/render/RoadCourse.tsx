import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FLOOR_Y, TICK_RATE } from '../sim/constants';
import { ROAD, ROAD_SOLIDS, roadMagnetPosition, roadResetActive } from '../sim/roadCourse';
import type { YardRender } from './presentation';
import { useReducedMotionRef } from './reducedMotion';
import { ART_STYLE } from './style/artStyle';
import { getToonGradientMap } from './style/toonMaterial';

type V3 = readonly [number, number, number];
const noRaycast = () => null;
const palette = ART_STYLE.palette;
const BELT_REPEAT = 0.45;

function colored(geometry: THREE.BufferGeometry, color: string): THREE.BufferGeometry {
  const value = new THREE.Color(color);
  const colors = new Float32Array(geometry.getAttribute('position').count * 3);
  for (let index = 0; index < colors.length; index += 3) {
    colors[index] = value.r;
    colors[index + 1] = value.g;
    colors[index + 2] = value.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function box(center: V3, size: V3, color: string): THREE.BufferGeometry {
  return colored(new THREE.BoxGeometry(...size).translate(...center), color);
}

function merged(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const geometry = mergeGeometries(parts)!;
  parts.forEach((part) => part.dispose());
  return geometry;
}

function beltTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('WRECK_YARD_ROAD_BELT_CANVAS');
  context.fillStyle = '#1b272b';
  context.fillRect(0, 0, 64, 64);
  context.fillStyle = '#4a5a60';
  context.fillRect(0, 0, 5, 64);
  context.fillStyle = palette.mustard;
  context.beginPath();
  context.moveTo(18, 32); context.lineTo(39, 14); context.lineTo(47, 14);
  context.lineTo(26, 32); context.lineTo(47, 50); context.lineTo(39, 50);
  context.closePath(); context.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.x = ROAD.belt.size[0] / BELT_REPEAT;
  return texture;
}

function createRoadAssets() {
  const staticParts = ROAD_SOLIDS.map((solid) => box(solid.center, solid.size, solid.id === 'road-supply-belt' ? palette.ink : palette.mustard));
  const [cx, cy, cz] = ROAD.belt.center;
  const [length, height, width] = ROAD.belt.size;
  const top = cy + height / 2;
  for (const x of [cx - 1.3, cx + 1.3]) for (const side of [-1, 1]) {
    staticParts.push(box([x, FLOOR_Y + 0.2, cz + side * 0.48], [0.16, 0.4, 0.16], palette.metal));
    staticParts.push(box([x, FLOOR_Y + 0.025, cz + side * 0.48], [0.34, 0.05, 0.3], palette.ink));
  }
  for (const side of [-1, 1]) {
    const roller = colored(new THREE.CylinderGeometry(0.13, 0.13, width + 0.05, 12), palette.metal);
    roller.rotateX(Math.PI / 2).translate(cx + side * (length / 2 - 0.14), top - 0.11, cz);
    staticParts.push(roller);
  }
  const housingX = ROAD.supply[0] + 0.15;
  staticParts.push(box([housingX, top + 1.3, cz], [1.15, 0.16, 1.7], palette.signalOrange));
  for (const side of [-1, 1]) {
    staticParts.push(box([housingX, top + 0.65, cz + side * 0.81], [1.15, 1.3, 0.12], palette.signalOrange));
    staticParts.push(box([housingX - 0.58, top + 0.65, cz + side * 0.81], [0.08, 1.3, 0.14], palette.ink));
  }
  staticParts.push(box([housingX + 0.55, top + 0.65, cz], [0.12, 1.3, 1.55], palette.orangeShade));
  staticParts.push(box([housingX, top + 1.44, cz], [0.42, 0.12, 0.55], palette.ink));

  const marks: THREE.BufferGeometry[] = [];
  for (const [x, z] of ROAD.slots) {
    const ring = colored(new THREE.RingGeometry(0.52, 0.58, 24), palette.mustard);
    ring.rotateX(-Math.PI / 2).translate(x, FLOOR_Y + 0.012, z);
    marks.push(ring);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = ROAD.carStart[0] + sx * 1.55;
    const z = ROAD.carStart[2] + sz * 2.15;
    marks.push(box([x - sx * 0.35, FLOOR_Y + 0.012, z], [0.8, 0.012, 0.1], palette.teal));
    marks.push(box([x, FLOOR_Y + 0.012, z - sz * 0.35], [0.1, 0.012, 0.8], palette.teal));
  }
  for (const z of [-0.6, 0.6]) marks.push(box([ROAD.workerHome[0], FLOOR_Y + 0.012, ROAD.workerHome[2] + z], [1.2, 0.012, 0.06], palette.mustard));

  const magnetParts = [box([0, 0, 0], ROAD.magnetSize, palette.ink)];
  for (const side of [-1, 1]) {
    magnetParts.push(box([side * 1.2, 0.02, 0], [0.28, 0.33, 2.5], palette.signalOrange));
    magnetParts.push(box([0, -0.13, side * 1.08], [2.65, 0.09, 0.26], palette.metal));
    magnetParts.push(box([side * 0.75, 0.35, 0], [0.35, 0.4, 1.45], palette.orangeShade));
    magnetParts.push(box([side * 0.48, 0.95, 0], [0.06, 1.1, 0.06], palette.metal));
    const fan = colored(new THREE.CylinderGeometry(0.38, 0.38, 0.23, 12), palette.ink);
    fan.translate(side * 0.97, 1.55, 0);
    magnetParts.push(fan);
    magnetParts.push(box([side * 0.97, 1.68, 0], [0.56, 0.04, 0.08], palette.metal));
  }
  magnetParts.push(box([0, 0.5, 0], [1.9, 0.2, 0.35], palette.metal));
  magnetParts.push(box([0, 1.45, 0], [1.45, 0.35, 0.8], palette.mustard));
  magnetParts.push(box([0, 1.68, 0], [0.7, 0.12, 0.55], palette.ink));
  const coils = merged([-1, 1].map((side) => box([side * 0.75, 0.36, 0], [0.37, 0.12, 1.49], '#ffffff')));
  const texture = beltTexture();
  const belt = new THREE.PlaneGeometry(length - 0.24, width - 0.1);
  belt.rotateX(-Math.PI / 2).translate(cx, top + 0.005, cz);
  return {
    frame: merged(staticParts),
    marks: merged(marks),
    magnet: merged(magnetParts),
    coils,
    belt,
    texture,
    solidMaterial: new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: getToonGradientMap() }),
    markMaterial: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    beltMaterial: new THREE.MeshToonMaterial({ map: texture, gradientMap: getToonGradientMap() }),
    coilMaterial: new THREE.MeshBasicMaterial({ color: palette.glow, toneMapped: false }),
  };
}

export function RoadCourse({ renderRef }: { renderRef: MutableRefObject<YardRender | null> }) {
  const assets = useMemo(createRoadAssets, []);
  const magnet = useRef<THREE.Group>(null);
  const sample = useRef({ frame: -1, receivedAt: 0 });
  const reducedMotion = useReducedMotionRef();
  useFrame(({ clock }) => {
    const render = renderRef.current;
    if (!render || !magnet.current) return;
    if (sample.current.frame !== render.frame) sample.current = { frame: render.frame, receivedAt: clock.elapsedTime };
    const alpha = Math.min(1, (clock.elapsedTime - sample.current.receivedAt) * TICK_RATE);
    const frame = render.frame - 1 + alpha;
    const resetFrame = render.contraptions.roadCourse.resetFrame;
    magnet.current.position.set(...roadMagnetPosition(frame, resetFrame));
    assets.coilMaterial.color.set(roadResetActive(frame, resetFrame) ? palette.spark : palette.glow);
    if (!reducedMotion.current) assets.texture.offset.x = (render.frame / TICK_RATE * ROAD.belt.speed / BELT_REPEAT) % 1;
  });
  useEffect(() => () => {
    assets.frame.dispose(); assets.marks.dispose(); assets.magnet.dispose(); assets.coils.dispose(); assets.belt.dispose();
    assets.texture.dispose(); assets.solidMaterial.dispose(); assets.markMaterial.dispose(); assets.beltMaterial.dispose(); assets.coilMaterial.dispose();
  }, [assets]);
  return (
    <group name="road-course" userData={{ departmentId: 'roadworthy' }}>
      <mesh name="road-supply-conveyor" geometry={assets.frame} material={assets.solidMaterial} castShadow receiveShadow raycast={noRaycast} />
      <mesh name="road-supply-belt-surface" geometry={assets.belt} material={assets.beltMaterial} receiveShadow raycast={noRaycast} />
      <mesh name="road-course-markings" geometry={assets.marks} material={assets.markMaterial} raycast={noRaycast} />
      <group ref={magnet} name="road-magnetic-claw" position={[...ROAD.magnetPark]}>
        <mesh geometry={assets.magnet} material={assets.solidMaterial} castShadow receiveShadow raycast={noRaycast} />
        <mesh name="road-magnet-coils" geometry={assets.coils} material={assets.coilMaterial} raycast={noRaycast} />
      </group>
    </group>
  );
}
