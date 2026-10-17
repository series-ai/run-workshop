import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { FLOOR_Y } from '../sim/constants';
import type { YardMaterial } from '../sim/materials';
import type { Impact } from '../sim/state';
import type { YardRender } from './presentation';
import { useReducedMotionRef } from './reducedMotion';
import { smokeTexture } from './style/glowTexture';

const noRaycast = () => null;

/** What a hit throws: hot sparks, wood splinters, glass chips, or a dust puff. Rubber throws nothing. */
export interface HitEffect {
  readonly chips: 'spark' | 'splinter' | 'glass' | null;
  /** Chips at a 6 m/s hit. A harder hit throws more, up to twice as many. */
  readonly chipCount: number;
  readonly dust: boolean;
}

const has = (impact: Pick<Impact, 'materials'>, material: YardMaterial) => impact.materials.includes(material);

/**
 * The effect of one hit, from its two materials and its speed. Glass wins, then
 * steel sparks (only on a hard surface and a fast hit), then wood. Concrete
 * raises dust under any hit except rubber on concrete.
 */
export function hitEffect(impact: Pick<Impact, 'materials' | 'speed'>): HitEffect {
  const scaleBySpeed = (count: number) => Math.round(count * Math.min(2, impact.speed / 6));
  const other = (material: YardMaterial) => impact.materials[0] === material ? impact.materials[1] : impact.materials[0];
  const dust = has(impact, 'concrete') && !has(impact, 'rubber');
  if (has(impact, 'glass')) return { chips: 'glass', chipCount: scaleBySpeed(6), dust: false };
  if (has(impact, 'steel') && (other('steel') === 'steel' || other('steel') === 'concrete') && impact.speed >= 3) {
    return { chips: 'spark', chipCount: scaleBySpeed(8), dust };
  }
  if (has(impact, 'wood')) return { chips: 'splinter', chipCount: scaleBySpeed(5), dust };
  return { chips: null, chipCount: 0, dust };
}

const CHIPS = 192;
const PUFFS = 16;
const CHIP_STYLE = {
  spark: { color: new THREE.Color(2.2, 1.4, 0.55), life: 0.32, speed: 3.2, gravity: 6, size: 0.035, stretch: 4 },
  splinter: { color: new THREE.Color('#9a6b33'), life: 0.7, speed: 2.2, gravity: 9.8, size: 0.05, stretch: 2.2 },
  glass: { color: new THREE.Color('#dff4ff'), life: 0.6, speed: 1.8, gravity: 9.8, size: 0.04, stretch: 1 },
} as const;
const DUST = new THREE.Color('#b5aa9b');

interface Chip { position: THREE.Vector3; velocity: THREE.Vector3; life: number; maxLife: number; kind: keyof typeof CHIP_STYLE }
interface Puff { sprite: THREE.Sprite | null; at: THREE.Vector3; age: number; life: number; size: number }

/** A fixed sequence per hit, so every client throws the same chips. */
function seeded(seed: number): () => number {
  let state = (Math.imul(seed + 1, 2654435761) >>> 0) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

/** Chips and dust where bodies hit each other (sim/impacts.ts). Reduced motion shows none. */
export function ImpactEffects({ renderRef }: { renderRef: MutableRefObject<YardRender | null> }) {
  const reducedMotion = useReducedMotionRef();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const seen = useRef(new Set<string>());
  const chips = useMemo<Chip[]>(() => Array.from({ length: CHIPS }, () => ({
    position: new THREE.Vector3(), velocity: new THREE.Vector3(), life: 0, maxLife: 1, kind: 'spark' as const,
  })), []);
  const puffs = useMemo<Puff[]>(() => Array.from({ length: PUFFS }, () => ({ sprite: null, at: new THREE.Vector3(), age: 0, life: 0, size: 0 })), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  // Scratch values, so the chip loop allocates nothing per frame.
  const heading = useMemo(() => new THREE.Vector3(), []);
  const tint = useMemo(() => new THREE.Color(), []);
  // A shared texture (style/glowTexture.ts): other effects use it too, so this component does not dispose it.
  const texture = useMemo(() => smokeTexture(), []);

  /** Starts `count` chips of one kind at `at`, from the free pool. A harder hit throws them faster. */
  const launch = (kind: keyof typeof CHIP_STYLE, count: number, at: readonly number[], speed: number, random: () => number) => {
    const style = CHIP_STYLE[kind];
    let launched = 0;
    for (const chip of chips) {
      if (launched >= count) break;
      if (chip.life > 0) continue;
      launched += 1;
      chip.kind = kind;
      chip.maxLife = style.life * (0.6 + random() * 0.6);
      chip.life = chip.maxLife;
      chip.position.set(at[0]!, at[1]!, at[2]!);
      chip.velocity.set(random() * 2 - 1, random() * 1.2 + 0.3, random() * 2 - 1).normalize()
        .multiplyScalar(style.speed * (0.5 + random() * 0.8) * Math.min(1.6, speed / 6 + 0.4));
    }
  };
  /** Starts a dust puff at `at`. The oldest puff gives way when all are in use. */
  const puff = (at: readonly number[], speed: number) => {
    const free = puffs.find((entry) => entry.life <= 0) ?? puffs.reduce((oldest, entry) => (entry.age > oldest.age ? entry : oldest));
    free.at.set(at[0]!, Math.max(FLOOR_Y + 0.05, at[1]!), at[2]!);
    free.age = 0;
    free.life = 0.9;
    free.size = Math.min(1.4, 0.35 + speed * 0.09);
  };

  useFrame((_, delta) => {
    const render = renderRef.current;
    const impacts = render?.impacts ?? [];
    const frame = render?.frame ?? 0;
    impacts.forEach((impact, index) => {
      // The key names the hit itself, as the hit sound does (audio/cues.ts impactKey). It leaves out the list
      // place, which shifts as old hits leave, and the point, which a rollback can move.
      const key = `${impact.frame}:${impact.bodyId}:${impact.materials.join('-')}`;
      // A hit more than a moment old (a late join, a tab coming back) is not replayed.
      if (seen.current.has(key) || frame - impact.frame > 3) return;
      seen.current.add(key);
      if (reducedMotion.current) return;
      const effect = hitEffect(impact);
      const random = seeded(impact.frame * 7919 + index * 104729 + Math.round(impact.at[0] * 100));
      if (effect.chips) launch(effect.chips, effect.chipCount, impact.at, impact.speed, random);
      if (effect.dust) puff(impact.at, impact.speed);
    });
    // A FRAGILE crate break throws a large burst of splinters and a dust puff.
    for (const entry of render?.contraptions.crateBreaks ?? []) {
      const key = `${entry.frame}:crate:${entry.crateId}`;
      if (seen.current.has(key) || frame - entry.frame > 3) continue;
      seen.current.add(key);
      if (reducedMotion.current) continue;
      launch('splinter', 18, entry.at, 9, seeded(entry.frame * 6151 + entry.crateId.length));
      puff(entry.at, 9);
    }
    // Old keys go, and so do keys from a later frame than now: those come from a session that has ended.
    for (const key of seen.current) {
      const age = frame - Number(key.split(':')[0]);
      if (age > 30 || age < 0) seen.current.delete(key);
    }

    for (const puff of puffs) {
      if (!puff.sprite) continue;
      if (puff.life <= 0) {
        puff.sprite.visible = false;
        continue;
      }
      puff.age += delta;
      if (puff.age >= puff.life) {
        puff.life = 0;
        puff.sprite.visible = false;
        continue;
      }
      const t = puff.age / puff.life;
      puff.sprite.visible = true;
      puff.sprite.position.set(puff.at.x, puff.at.y + t * 0.35, puff.at.z);
      puff.sprite.scale.setScalar(puff.size * (0.5 + t));
      puff.sprite.material.opacity = 0.55 * (1 - t) * Math.min(1, puff.age / 0.06);
    }

    const target = mesh.current;
    if (!target) return;
    chips.forEach((chip, index) => {
      if (chip.life > 0) {
        const style = CHIP_STYLE[chip.kind];
        chip.life -= delta;
        chip.velocity.y -= style.gravity * delta;
        chip.position.addScaledVector(chip.velocity, delta);
        if (chip.position.y < FLOOR_Y + 0.01) {
          chip.position.y = FLOOR_Y + 0.01;
          chip.velocity.set(chip.velocity.x * 0.4, Math.abs(chip.velocity.y) * 0.25, chip.velocity.z * 0.4);
        }
        const t = Math.max(0, chip.life / chip.maxLife);
        const size = style.size * (0.4 + 0.6 * t);
        dummy.position.copy(chip.position);
        dummy.quaternion.setFromUnitVectors(up, chip.velocity.lengthSq() > 1e-6 ? heading.copy(chip.velocity).normalize() : up);
        dummy.scale.set(size, size * (1 + style.stretch * Math.min(1, chip.velocity.length() / 4)), size);
        // Sparks cool to dark red. Splinters and glass keep their color.
        target.setColorAt(index, chip.kind === 'spark' ? tint.copy(CHIP_STYLE.spark.color).multiplyScalar(0.35 + 0.65 * t) : style.color);
      } else {
        dummy.position.set(0, -100, 0);
        dummy.scale.setScalar(0);
      }
      dummy.updateMatrix();
      target.setMatrixAt(index, dummy.matrix);
    });
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
  });

  return (
    <group name="ImpactEffects">
      <instancedMesh ref={mesh} args={[undefined, undefined, CHIPS]} frustumCulled={false} raycast={noRaycast}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {puffs.map((puff, index) => (
        <sprite key={index} ref={(sprite) => { puff.sprite = sprite; }} visible={false} raycast={noRaycast}>
          <spriteMaterial map={texture} color={DUST} transparent depthWrite={false} opacity={0} />
        </sprite>
      ))}
    </group>
  );
}
