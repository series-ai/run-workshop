import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import {
  BUTTON_PEDESTAL,
  BUTTONS,
  CATAPULT,
  CATAPULT_ARM_REST,
  CONVEYOR,
  DUNK_SIGN,
  HOOP,
  type ButtonId,
} from '../sim/contraptions';
import { drawLedText } from './pixelFont';
import type { YardRender } from './presentation';
import { ART_STYLE } from './style/artStyle';
import { glowTexture } from './style/glowTexture';
import { Toon } from './style/toonMaterial';

type V3 = readonly [number, number, number];
const noRaycast = () => null;
const palette = ART_STYLE.palette;
const LED = { lit: '#ffb547', unlit: '#2b1b14', background: '#0b0c0f' } as const;

function Block({ center, size, color, rotation }: { center: V3; size: V3; color: string; rotation?: V3 }) {
  return (
    <mesh position={[...center]} rotation={rotation ? [...rotation] : undefined} castShadow receiveShadow raycast={noRaycast}>
      <boxGeometry args={[...size]} />
      <Toon color={color} />
    </mesh>
  );
}

/** An LED text panel: a canvas texture redrawn only when its lines change. */
function useLedPanel(width: number, height: number, cell: number) {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('WRECK_YARD_CANVAS_2D_UNAVAILABLE');
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
    let shown = '';
    const draw = (lines: readonly string[]) => {
      const key = lines.join('\n');
      if (key === shown) return;
      shown = key;
      drawLedText(context, lines, { cell, lit: LED.lit, unlit: LED.unlit, background: LED.background, lineGap: 2 });
      texture.needsUpdate = true;
    };
    return { material, texture, draw };
  }, [width, height, cell]);
}

/** Seconds since `frame` changed to a recent value; tracks sim events by the render clock so animations run smoothly. */
function useEventClock() {
  const state = useRef({ frame: Number.NaN, at: -Infinity });
  return (frame: number, nowFrame: number, clock: number): number => {
    if (frame !== state.current.frame) {
      // A late joiner sees old events as long finished.
      state.current = { frame, at: nowFrame - frame < 15 ? clock : -Infinity };
    }
    return clock - state.current.at;
  };
}

// ---------------------------------------------------------------------------

function netGeometry(): THREE.BufferGeometry {
  const top = HOOP.ringRadius - 0.04;
  const bottom = 0.8;
  const depth = 1.1;
  const count = 14;
  const points: number[] = [];
  const at = (radius: number, angle: number, y: number) => [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
  for (let index = 0; index < count; index += 1) {
    const a = (index / count) * Math.PI * 2;
    const b = ((index + 1) / count) * Math.PI * 2;
    const mid = (a + b) / 2;
    const midRadius = (top + bottom) / 2;
    // Diamond mesh: top to middle to bottom, crossing between neighbors.
    points.push(...at(top, a, 0), ...at(midRadius, mid, -depth / 2));
    points.push(...at(top, b, 0), ...at(midRadius, mid, -depth / 2));
    points.push(...at(midRadius, mid, -depth / 2), ...at(bottom, a, -depth));
    points.push(...at(midRadius, mid, -depth / 2), ...at(bottom, b, -depth));
    points.push(...at(bottom, a, -depth), ...at(bottom, b, -depth));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return geometry;
}

function DunkHoop({ renderRef }: { renderRef: MutableRefObject<YardRender | null> }) {
  const net = useMemo(netGeometry, []);
  useEffect(() => () => net.dispose(), [net]);
  const sign = useLedPanel(460, 250, 10);
  const lastDunks = useRef(0);
  const flashAt = useRef(-Infinity);
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const dunks = renderRef.current?.stats.dunks ?? 0;
    if (dunks !== lastDunks.current) {
      if (dunks > lastDunks.current) flashAt.current = clock.elapsedTime;
      lastDunks.current = dunks;
    }
    sign.draw(['DUNKS', String(dunks)]);
    const since = clock.elapsedTime - flashAt.current;
    // The board flares and blinks for a second after a dunk.
    const flare = since < 1.2 ? (Math.floor(since * 8) % 2 === 0 ? 3.2 : 1.4) : 1.6;
    sign.material.color.setScalar(flare);
    if (ring.current) ring.current.scale.setScalar(since < 0.3 ? 1 + (0.3 - since) * 0.25 : 1);
  });
  const [cx, cy, cz] = HOOP.center;
  const [bx, by, bz] = HOOP.backboard.center;
  const front = bz + HOOP.backboard.size[2] / 2 + 0.01;
  const panel = DUNK_SIGN.panel;
  return (
    <group name="DunkHoop">
      <mesh ref={ring} position={[cx, cy, cz]} rotation={[Math.PI / 2, 0, 0]} castShadow raycast={noRaycast}>
        <torusGeometry args={[HOOP.ringRadius, HOOP.tube, 10, 48]} />
        <Toon color={palette.signalOrange} />
      </mesh>
      <lineSegments geometry={net} position={[cx, cy - HOOP.tube, cz]} raycast={noRaycast}>
        <lineBasicMaterial color={palette.concreteLit} />
      </lineSegments>
      <Block center={[cx, cy, cz - HOOP.ringRadius - 0.25]} size={[0.4, 0.16, 0.5]} color={palette.signalOrange} />
      <Block center={HOOP.backboard.center} size={HOOP.backboard.size} color={palette.concreteLit} />
      {/* Shooter's square above the ring. */}
      <Block center={[bx, cy + 0.9, front]} size={[1.3, 0.08, 0.02]} color={palette.signalOrange} />
      <Block center={[bx, cy + 0.05, front]} size={[1.3, 0.08, 0.02]} color={palette.signalOrange} />
      {[-1, 1].map((side) => <Block key={side} center={[bx + side * 0.61, cy + 0.475, front]} size={[0.08, 0.93, 0.02]} color={palette.signalOrange} />)}
      <Block center={[bx, by + HOOP.backboard.size[1] / 2 - 0.06, front]} size={[HOOP.backboard.size[0], 0.12, 0.02]} color={palette.ink} />
      <Block center={HOOP.pole.center} size={HOOP.pole.size} color={palette.ink} />
      <Block center={[cx, by, -24.75]} size={[0.3, 0.3, 0.8]} color={palette.ink} />

      {/* Score board: DUNKS over the count, on two posts. */}
      <Block center={panel.center} size={panel.size} color={palette.ink} />
      <mesh position={[panel.center[0], panel.center[1], panel.center[2] + panel.size[2] / 2 + 0.01]} material={sign.material} raycast={noRaycast}>
        <planeGeometry args={[4.4, 2.4]} />
      </mesh>
      {DUNK_SIGN.posts.map((post, index) => <Block key={index} center={post.center} size={post.size} color={palette.ink} />)}
    </group>
  );
}

// ---------------------------------------------------------------------------

const BELT_TILE = 0.8;

function beltTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('WRECK_YARD_CANVAS_2D_UNAVAILABLE');
  context.fillStyle = '#1b1f24';
  context.fillRect(0, 0, 32, 32);
  context.fillStyle = '#3a4048';
  // A chevron pointing along the belt's travel.
  context.beginPath();
  context.moveTo(0, 20); context.lineTo(16, 8); context.lineTo(32, 20); context.lineTo(32, 26); context.lineTo(16, 14); context.lineTo(0, 26);
  context.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.repeat.set(1, (CONVEYOR.zEnd - CONVEYOR.zStart) / BELT_TILE);
  return texture;
}

function SkyConveyor({ renderRef }: { renderRef: MutableRefObject<YardRender | null> }) {
  const texture = useMemo(beltTexture, []);
  useEffect(() => () => texture.dispose(), [texture]);
  const beacon = useRef<THREE.Sprite>(null);
  const since = useEventClock();
  useFrame(({ clock }, delta) => {
    // The plane's +V runs toward -Z, so a belt moving +Z scrolls V down.
    texture.offset.y = (texture.offset.y + (CONVEYOR.speed * delta) / BELT_TILE) % 1;
    const render = renderRef.current;
    if (!render || !beacon.current) return;
    const age = since(render.contraptions.lastDropFrame, render.frame, clock.elapsedTime);
    const active = age < 4;
    beacon.current.visible = active && Math.floor(age * 6) % 2 === 0;
  });
  const length = CONVEYOR.zEnd - CONVEYOR.zStart;
  const midZ = (CONVEYOR.zStart + CONVEYOR.zEnd) / 2;
  const { x, topY } = CONVEYOR;
  return (
    <group name="SkyConveyor">
      <Block center={[x, topY - 0.15, midZ]} size={[CONVEYOR.width + 0.2, 0.3, length]} color={palette.ink} />
      <mesh position={[x, topY + 0.005, midZ]} rotation={[-Math.PI / 2, 0, 0]} raycast={noRaycast}>
        <planeGeometry args={[CONVEYOR.width, length]} />
        <meshLambertMaterial map={texture} />
      </mesh>
      <mesh position={[x, topY - 0.15, CONVEYOR.zEnd - 0.16]} rotation={[0, 0, Math.PI / 2]} raycast={noRaycast}>
        <cylinderGeometry args={[0.16, 0.16, CONVEYOR.width + 0.1, 12]} />
        <Toon color={palette.metal} />
      </mesh>
      {[-1, 1].map((side) => (
        <Block key={side} center={[x + side * (CONVEYOR.width / 2 + 0.12), topY + 0.2, midZ]} size={[0.12, 0.5, length]} color={palette.mustard} />
      ))}
      {CONVEYOR.legZ.flatMap((z) => [-1, 1].map((side) => (
        <Block key={`${z}${side}`} center={[x + side * 0.9, (-0.86 + topY - 0.3) / 2, z]} size={[0.28, topY - 0.3 + 0.86, 0.28]} color={palette.concreteShade} />
      )))}
      {CONVEYOR.legZ.map((z) => <Block key={z} center={[x, topY - 0.45, z]} size={[2.1, 0.2, 0.3]} color={palette.concreteShade} />)}
      {/* Feeder housing outside the wall, where crates come from. */}
      <Block center={[x, topY + 2.1, -28]} size={[2.4, 0.2, 2.2]} color={palette.signalOrange} />
      {[-1, 1].map((side) => <Block key={side} center={[x + side * 1.1, topY + 1.0, -28]} size={[0.2, 2.2, 2.2]} color={palette.signalOrange} />)}
      <Block center={[x, topY + 1.9, -26.95]} size={[2.4, 0.2, 0.1]} color={palette.ink} />
      <Block center={[x, topY + 2.35, -28]} size={[0.3, 0.3, 0.3]} color={palette.mustard} />
      <sprite ref={beacon} position={[x, topY + 2.4, -28]} scale={[2.2, 2.2, 1]} visible={false}>
        <spriteMaterial map={glowTexture()} color={new THREE.Color(palette.glow).multiplyScalar(3)} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </sprite>
    </group>
  );
}

// ---------------------------------------------------------------------------

function ContraptionButton({ id, label, base, renderRef }: { id: ButtonId; label: string; base: V3; renderRef: MutableRefObject<YardRender | null> }) {
  const tag = useLedPanel(400, 88, 8);
  useEffect(() => tag.draw([label]), [tag, label]);
  const cap = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Sprite>(null);
  const since = useEventClock();
  const [sx, sy, sz] = BUTTON_PEDESTAL.size;
  const capY = base[1] + sy + BUTTON_PEDESTAL.capHeight / 2;
  useFrame(({ clock }) => {
    const render = renderRef.current;
    if (!render || !cap.current || !glow.current) return;
    const frame = id === 'dropper' ? render.contraptions.lastDropFrame : render.contraptions.lastLaunchFrame;
    const age = since(frame, render.frame, clock.elapsedTime);
    const pressed = age < 0.25;
    cap.current.position.y = capY - (pressed ? 0.08 : 0);
    // A slow idle pulse invites a press; a press flashes bright.
    const pulse = pressed ? 1.6 : 0.55 + 0.25 * Math.sin(clock.elapsedTime * 3);
    glow.current.scale.setScalar(pulse);
  });
  return (
    <group name={`Button-${id}`}>
      <Block center={[base[0], base[1] + sy / 2, base[2]]} size={BUTTON_PEDESTAL.size} color={palette.concreteShade} />
      <Block center={[base[0], base[1] + sy - 0.03, base[2]]} size={[sx + 0.04, 0.06, sz + 0.04]} color={palette.mustard} />
      <mesh ref={cap} position={[base[0], capY, base[2]]} castShadow raycast={noRaycast}>
        <cylinderGeometry args={[BUTTON_PEDESTAL.capRadius, BUTTON_PEDESTAL.capRadius, BUTTON_PEDESTAL.capHeight, 20]} />
        <meshBasicMaterial color={new THREE.Color('#ff3b2f').multiplyScalar(1.4)} toneMapped={false} />
      </mesh>
      <sprite ref={glow} position={[base[0], capY + 0.05, base[2]]} renderOrder={12}>
        <spriteMaterial map={glowTexture()} color={new THREE.Color('#ff3b2f').multiplyScalar(2)} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </sprite>
      {[1, -1].map((side) => (
        <mesh key={side} position={[base[0], base[1] + sy * 0.62, base[2] + side * (sz / 2 + 0.01)]} rotation={[0, side > 0 ? 0 : Math.PI, 0]} material={tag.material} raycast={noRaycast}>
          <planeGeometry args={[sx * 0.9, sx * 0.9 * (88 / 400)]} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------

/** Arm angle about X relative to rest while firing: fast swing, short hold, slow return. */
function armSwing(seconds: number): number {
  const FIRED = -2.52;
  if (seconds < 0 || seconds > 2.2) return 0;
  if (seconds < 0.18) return FIRED * (1 - (1 - seconds / 0.18) ** 3);
  if (seconds < 0.6) return FIRED;
  const t = (seconds - 0.6) / 1.6;
  return FIRED * (1 - t * t * (3 - 2 * t));
}

function Catapult({ renderRef }: { renderRef: MutableRefObject<YardRender | null> }) {
  const arm = useRef<THREE.Group>(null);
  const since = useEventClock();
  useFrame(({ clock }) => {
    const render = renderRef.current;
    if (!render || !arm.current) return;
    arm.current.rotation.x = CATAPULT_ARM_REST.pitch + armSwing(since(render.contraptions.lastLaunchFrame, render.frame, clock.elapsedTime));
  });
  const [ax, ay, az] = CATAPULT.axle;
  const [, by, bz] = CATAPULT.bucket;
  const reach = CATAPULT_ARM_REST.length - 0.15;
  // The bucket in the arm's frame, level at rest.
  const bucketLocal = useMemo(
    () => new THREE.Vector3(0, by - ay, bz - az).applyAxisAngle(new THREE.Vector3(1, 0, 0), -CATAPULT_ARM_REST.pitch),
    [ay, az, by, bz],
  );
  const half = CATAPULT.bucketHalf;
  const outer = half * 2 + 0.2;
  const wall = CATAPULT.wallHeight;
  return (
    <group name="Catapult">
      {[-1, 1].map((side) => <Block key={`rail${side}`} center={[ax + side * 1.25, -0.86 + 0.15, 22.6]} size={[0.3, 0.3, 5.4]} color={palette.rust} />)}
      {[-1, 1].map((side) => <Block key={`up${side}`} center={[ax + side * 1.25, (-0.86 + ay + 0.9) / 2, az]} size={[0.3, ay + 0.9 + 0.86, 0.3]} color={palette.ink} />)}
      <Block center={[ax, ay + 0.75, az - 0.25]} size={[2.8, 0.25, 0.25]} color={palette.mustard} />
      <mesh position={[ax, ay, az]} rotation={[0, 0, Math.PI / 2]} raycast={noRaycast}>
        <cylinderGeometry args={[0.08, 0.08, 2.5, 10]} />
        <Toon color={palette.metal} />
      </mesh>
      <Block center={[ax, (-0.86 + by - 0.12) / 2, bz]} size={[0.9, by - 0.12 + 0.86, 0.9]} color={palette.concreteShade} />
      <group ref={arm} position={[ax, ay, az]} rotation={[CATAPULT_ARM_REST.pitch, 0, 0]}>
        <Block center={[0, 0, reach / 2 - 0.075]} size={[0.3, 0.3, reach + 0.15]} color={palette.orangeShade} />
        <group position={bucketLocal} rotation={[-CATAPULT_ARM_REST.pitch, 0, 0]}>
          <Block center={[0, -0.06, 0]} size={[outer, 0.12, outer]} color={palette.rust} />
          {[-1, 1].map((side) => <Block key={`x${side}`} center={[side * (half + 0.05), wall / 2, 0]} size={[0.1, wall, outer]} color={palette.signalOrange} />)}
          {[-1, 1].map((side) => <Block key={`z${side}`} center={[0, wall / 2, side * (half + 0.05)]} size={[outer, wall, 0.1]} color={palette.signalOrange} />)}
        </group>
      </group>
    </group>
  );
}

export function Contraptions({ renderRef }: { renderRef: MutableRefObject<YardRender | null> }) {
  return (
    <group name="Contraptions">
      <DunkHoop renderRef={renderRef} />
      <SkyConveyor renderRef={renderRef} />
      <Catapult renderRef={renderRef} />
      {BUTTONS.map((button) => <ContraptionButton key={button.id} id={button.id} label={button.label} base={button.base} renderRef={renderRef} />)}
    </group>
  );
}
