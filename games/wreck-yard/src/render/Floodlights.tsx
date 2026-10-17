import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FLOOR_Y } from '../sim/constants';
import { brokenLampIds, FLICKER_TICKS } from '../sim/floodlights';
import { FLOODLIGHT_MASTS, floodlightLensId, MAST_LAMP_HEIGHT, mastYaw } from '../sim/setPieces';
import type { LampSmash } from '../sim/state';
import type { YardRender } from './presentation';
import { useReducedMotionRef } from './reducedMotion';
import { ART_STYLE } from './style/artStyle';
import { glowTexture } from './style/glowTexture';
import { Toon } from './style/toonMaterial';

const noRaycast = () => null;
const FLOODLIGHT_COLOR = '#ffe5a3';
/** Lens color above 1.0 in the HDR target, so the bloom picks it up. */
const FLOODLIGHT_LENS = new THREE.Color(FLOODLIGHT_COLOR).multiplyScalar(3);
/** The dark glass that stays in a broken lamp. */
const BROKEN_LENS = '#1b1f22';

function createMastSteelGeometry(): THREE.BufferGeometry {
  const geoms: THREE.BufferGeometry[] = [];
  const mast = new THREE.CylinderGeometry(0.2, 0.35, 11, 8);
  mast.translate(0, 5.5, 0);
  geoms.push(mast);

  const head = new THREE.BoxGeometry(2.4, 0.4, 0.6);
  head.translate(0, MAST_LAMP_HEIGHT, 0);
  geoms.push(head);

  for (const lx of [-0.8, 0, 0.8]) {
    const b1 = new THREE.BoxGeometry(0.55, 0.3, 0.2);
    b1.rotateX(0.45);
    b1.translate(lx, MAST_LAMP_HEIGHT + 0.15, 0.32);
    geoms.push(b1);

    const b2 = new THREE.BoxGeometry(0.55, 0.3, 0.2);
    b2.rotateX(0.45);
    b2.translate(lx, MAST_LAMP_HEIGHT - 0.15, 0.32);
    geoms.push(b2);
  }
  const merged = BufferGeometryUtils.mergeGeometries(geoms);
  geoms.forEach((g) => g.dispose());
  return merged;
}

function createMastLensesGeometry(): THREE.BufferGeometry {
  const geoms: THREE.BufferGeometry[] = [];
  for (const lx of [-0.8, 0, 0.8]) {
    const l1 = new THREE.PlaneGeometry(0.5, 0.24);
    l1.rotateX(0.45);
    l1.translate(lx, MAST_LAMP_HEIGHT + 0.15, 0.32 + 0.11);
    geoms.push(l1);

    const l2 = new THREE.PlaneGeometry(0.5, 0.24);
    l2.rotateX(0.45);
    l2.translate(lx, MAST_LAMP_HEIGHT - 0.15, 0.32 + 0.11);
    geoms.push(l2);
  }
  const merged = BufferGeometryUtils.mergeGeometries(geoms);
  geoms.forEach((g) => g.dispose());
  return merged;
}

const MAST_STEEL_GEOM = createMastSteelGeometry();
const MAST_LENSES_GEOM = createMastLensesGeometry();

interface LampParts {
  lens: THREE.Mesh | null;
  broken: THREE.Mesh | null;
  glow: THREE.Sprite | null;
}

/**
 * On or off for a flickering lamp, `age` ticks into its flicker. The pattern is
 * fixed, so every client and every frame rate shows the same flicker. It ends on.
 */
export function flickerLit(age: number, seed: number): boolean {
  if (age >= FLICKER_TICKS) return true;
  // Short dark gaps that get rarer as the flicker settles.
  const step = Math.floor(age / 2);
  const noise = Math.abs(Math.sin((step + 1) * 12.9898 + seed * 78.233)) % 1;
  return noise > 0.55 * (1 - age / FLICKER_TICKS);
}

/**
 * Light levels for the yard (1 is the normal rig) when `lit` of the four lamps
 * burn. Each lamp out takes a little light. With all four out the yard goes dark,
 * so the torch, fires, sparks, and the skyline stand out.
 */
export function yardLightLevel(lit: number): { readonly key: number; readonly sky: number } {
  if (lit <= 0) return { key: 0.28, sky: 0.45 };
  return { key: 0.7 + 0.075 * lit, sky: 0.8 + 0.05 * lit };
}

/** High-mast floodlights at the four corners, turned to face the yard. A broken lens goes dark and its glow goes out. */
export function FloodlightMasts({ renderRef }: { renderRef?: MutableRefObject<YardRender | null> }) {
  const reducedMotion = useReducedMotionRef();
  const parts = useRef(new Map<string, LampParts>());
  const partsOf = (id: string): LampParts => {
    const existing = parts.current.get(id);
    if (existing) return existing;
    const created: LampParts = { lens: null, broken: null, glow: null };
    parts.current.set(id, created);
    return created;
  };

  useFrame(() => {
    const render = renderRef?.current;
    const contraptions = render?.contraptions;
    let index = 0;
    for (const [id, lamp] of parts.current) {
      const state = contraptions?.lamps.find((entry) => entry.lampId === id);
      const frame = render?.frame ?? 0;
      // A hit that did not break the lens makes it flicker. A lamp that comes back on flickers on (sim sets flickerFrame).
      const sinceHit = state ? frame - state.flickerFrame : Infinity;
      const broken = state?.brokenAt !== null && state?.brokenAt !== undefined;
      // With reduced motion a lamp does not flicker: it is lit until its lens breaks.
      const lit = !broken && (reducedMotion.current || flickerLit(sinceHit, index));
      if (lamp.lens) lamp.lens.visible = lit;
      if (lamp.glow) lamp.glow.visible = lit;
      if (lamp.broken) lamp.broken.visible = !lit;
      index += 1;
    }
  });

  return (
    <group name="FloodlightMasts">
      {FLOODLIGHT_MASTS.map(([x, z]) => {
        const lamp = partsOf(floodlightLensId(x, z));
        return (
          <group key={`mast-${x}-${z}`} position={[x, FLOOR_Y, z]} rotation={[0, mastYaw(x, z), 0]}>
            <mesh position={[0, 0.6, 0]} castShadow receiveShadow raycast={noRaycast}>
              <boxGeometry args={[2.0, 1.2, 2.0]} />
              <Toon color={ART_STYLE.palette.concreteShade} />
            </mesh>
            <mesh geometry={MAST_STEEL_GEOM} castShadow raycast={noRaycast}>
              <Toon color={ART_STYLE.palette.ink} />
            </mesh>
            <mesh ref={(mesh) => { lamp.lens = mesh; }} geometry={MAST_LENSES_GEOM} raycast={noRaycast}>
              <meshBasicMaterial color={FLOODLIGHT_LENS} toneMapped={false} />
            </mesh>
            <mesh ref={(mesh) => { lamp.broken = mesh; }} geometry={MAST_LENSES_GEOM} visible={false} raycast={noRaycast}>
              <Toon color={BROKEN_LENS} />
            </mesh>
            <sprite ref={(sprite) => { lamp.glow = sprite; }} position={[0, MAST_LAMP_HEIGHT, 0.9]} scale={[6, 6, 1]} raycast={noRaycast}>
              <spriteMaterial
                color={FLOODLIGHT_COLOR}
                map={glowTexture()}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                fog={false}
                toneMapped={false}
              />
            </sprite>
          </group>
        );
      })}
      {renderRef && <GlassShards renderRef={renderRef} />}
    </group>
  );
}

/** Shards per smash, and smashes shown at once. A newer smash takes the oldest slot. */
const SHARDS_PER_SMASH = 48;
const SLOTS = 4;
const SHARD_SECONDS = 1.8;
const GRAVITY = 9.8;
/** The pop of the lamp as it breaks: a short white flash at the lens. */
const FLASH_SECONDS = 0.14;
const SHARD_COLOR = new THREE.Color('#dff4ff');

interface Shard { position: THREE.Vector3; velocity: THREE.Vector3; spin: THREE.Vector3; turn: THREE.Euler; size: number }
interface ShardSlot { key: string | null; lampId: string | null; startedAt: number; shards: Shard[]; flash: THREE.Sprite | null }

/** A fixed sequence per smash, so the same smash throws the same shards on every client. */
function seeded(seed: number): () => number {
  let state = (Math.imul(seed + 1, 2654435761) >>> 0) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function smashKey(smash: LampSmash): string {
  return `${smash.lampId}@${smash.frame}`;
}

/** Glass from a broken lens: it bursts out toward the yard, falls, skids on the floor, and shrinks away. */
function GlassShards({ renderRef }: { renderRef: MutableRefObject<YardRender | null> }) {
  const reducedMotion = useReducedMotionRef();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const clock = useRef(0);
  const slots = useMemo<ShardSlot[]>(() => Array.from({ length: SLOTS }, () => ({
    key: null,
    lampId: null,
    startedAt: 0,
    flash: null,
    shards: Array.from({ length: SHARDS_PER_SMASH }, () => ({
      position: new THREE.Vector3(), velocity: new THREE.Vector3(), spin: new THREE.Vector3(), turn: new THREE.Euler(), size: 0,
    })),
  })), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  function start(slot: ShardSlot, smash: LampSmash, now: number): void {
    const random = seeded(smash.frame * 7919 + smash.lampId.length * 131 + Math.round(smash.at[0] * 100));
    // The lens faces the yard: the mast yaw points from the mast toward the yard center.
    const mast = FLOODLIGHT_MASTS.find(([x, z]) => floodlightLensId(x, z) === smash.lampId);
    if (!mast) throw new Error(`WRECK_YARD_LAMP_UNKNOWN: ${smash.lampId}`);
    const [mastX, mastZ] = mast;
    const yaw = mastYaw(mastX, mastZ);
    const out = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const side = new THREE.Vector3(out.z, 0, -out.x);
    slot.key = smashKey(smash);
    slot.lampId = smash.lampId;
    slot.startedAt = now;
    slot.flash?.position.set(smash.at[0], smash.at[1], smash.at[2]);
    for (const shard of slot.shards) {
      // Spread over the width of the lamp head, then out and a little up.
      shard.position.set(smash.at[0], smash.at[1], smash.at[2]).addScaledVector(side, (random() - 0.5) * 2.2);
      shard.velocity.copy(out).multiplyScalar(1.5 + random() * 3)
        .addScaledVector(side, (random() - 0.5) * 3)
        .add(new THREE.Vector3(0, random() * 2.5 - 0.5, 0));
      shard.spin.set(random() * 14 - 7, random() * 14 - 7, random() * 14 - 7);
      shard.turn.set(random() * 6, random() * 6, random() * 6);
      shard.size = 0.05 + random() * 0.09;
    }
  }

  useFrame((_, delta) => {
    clock.current += delta;
    const now = clock.current;
    const smashes = renderRef.current?.contraptions.lampSmashes ?? [];
    const smashed = renderRef.current ? brokenLampIds(renderRef.current.contraptions) : [];
    const frame = renderRef.current?.frame ?? 0;
    for (const smash of smashes) {
      const key = smashKey(smash);
      if (slots.some((slot) => slot.key === key)) continue;
      // A smash more than a moment old (a late join, a tab coming back) is not replayed. Reduced motion shows no shards.
      if (frame - smash.frame > 6 || reducedMotion.current) continue;
      const free = slots.find((slot) => slot.key === null) ?? [...slots].sort((a, b) => a.startedAt - b.startedAt)[0]!;
      start(free, smash, now);
    }

    const target = mesh.current;
    if (!target) return;
    let index = 0;
    for (const slot of slots) {
      const seconds = now - slot.startedAt;
      // A rollback can undo a smash. Its glass then stops at once, with the lens whole again.
      if (slot.key !== null && (seconds > SHARD_SECONDS || !smashed.includes(slot.lampId ?? ''))) slot.key = null;
      if (slot.flash) {
        slot.flash.visible = slot.key !== null && seconds < FLASH_SECONDS;
        slot.flash.material.opacity = Math.max(0, 1 - seconds / FLASH_SECONDS);
      }
      for (const shard of slot.shards) {
        if (slot.key === null) {
          dummy.position.set(0, -100, 0);
          dummy.scale.setScalar(0);
        } else {
          shard.velocity.y -= GRAVITY * delta;
          shard.position.addScaledVector(shard.velocity, delta);
          if (shard.position.y < FLOOR_Y + 0.01) {
            // Glass skids and stops on the floor.
            shard.position.y = FLOOR_Y + 0.01;
            shard.velocity.set(shard.velocity.x * 0.4, Math.abs(shard.velocity.y) * 0.15, shard.velocity.z * 0.4);
            shard.spin.multiplyScalar(0.3);
          }
          shard.turn.set(shard.turn.x + shard.spin.x * delta, shard.turn.y + shard.spin.y * delta, shard.turn.z + shard.spin.z * delta);
          const fade = Math.min(1, (SHARD_SECONDS - seconds) / 0.5);
          dummy.position.copy(shard.position);
          dummy.rotation.copy(shard.turn);
          dummy.scale.set(shard.size * fade, shard.size * 0.6 * fade, 0.012);
        }
        dummy.updateMatrix();
        target.setMatrixAt(index, dummy.matrix);
        index += 1;
      }
    }
    target.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={mesh} args={[undefined, undefined, SLOTS * SHARDS_PER_SMASH]} frustumCulled={false} raycast={noRaycast}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={SHARD_COLOR} transparent opacity={0.85} toneMapped={false} />
      </instancedMesh>
      {slots.map((slot, index) => (
        <sprite key={index} ref={(sprite) => { slot.flash = sprite; }} visible={false} scale={[3.5, 3.5, 1]} raycast={noRaycast}>
          <spriteMaterial color="#ffffff" map={glowTexture()} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} toneMapped={false} transparent />
        </sprite>
      ))}
    </group>
  );
}
