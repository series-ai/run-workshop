import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { MAX_PLAYERS } from '../sim/constants';
import type { UiTool } from './keyBindings';
import type { YardRender } from './presentation';
import { glowTexture, smokeTexture } from './style/glowTexture';
import { torchVisual } from './toolFeedback';
import { toolMuzzleAndAim } from './toolMuzzle';

/**
 * Stream shape: soft across the width, tight at the nozzle and a little wider
 * where it hits. V runs from the nozzle (0) to the hit point (1).
 */
function streamProfile(): THREE.CanvasTexture {
  const width = 32;
  const height = 128;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('WRECK_YARD_CANVAS_2D_UNAVAILABLE');
  const image = context.createImageData(width, height);
  for (let row = 0; row < height; row += 1) {
    // Canvas row 0 is the top of the texture (V = 1).
    const v = 1 - row / (height - 1);
    const along = Math.min(1, v / 0.04) * (1 - 0.2 * v);
    for (let column = 0; column < width; column += 1) {
      const u = (column + 0.5) / width - 0.5;
      const spread = 0.12 + 0.22 * Math.sqrt(v);
      const value = Math.round(255 * along * Math.exp(-((u / spread) ** 2) * 2.2));
      const index = (row * width + column) * 4;
      image.data.set([value, value, value, 255], index);
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/** Flame tongues that tile along the stream. Scrolling it makes the fire flow out of the nozzle. */
function flameTongues(): THREE.CanvasTexture {
  const width = 64;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('WRECK_YARD_CANVAS_2D_UNAVAILABLE');
  context.fillStyle = 'rgb(115,115,115)';
  context.fillRect(0, 0, width, height);
  // Fixed tongue layout, so every client's stream looks the same.
  for (let i = 0; i < 64; i += 1) {
    const x = ((i * 37) % width) + 0.5;
    const y = (i * 71) % height;
    const length = 26 + ((i * 13) % 40);
    for (const dy of [-height, 0, height]) {
      const gradient = context.createRadialGradient(x, y + dy, 0, x, y + dy, length * 0.5);
      gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = gradient;
      context.save();
      context.translate(x, y + dy);
      context.scale(0.35, 1);
      context.translate(-x, -(y + dy));
      context.fillRect(x - length, y + dy - length, length * 2, length * 2);
      context.restore();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/** A unit strip, X across (-0.5..0.5) and Y along the jet (0..1). */
const STRIP_GEOMETRY = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
/** Red fire outside, orange, then a hot core. */
const LAYERS = [
  { name: 'fire', width: 0.3, color: new THREE.Color('#ff2a0a').multiplyScalar(1.9), flow: 1.6 },
  { name: 'flame', width: 0.14, color: new THREE.Color('#ff7a1a').multiplyScalar(2.1), flow: 2.3 },
  { name: 'core', width: 0.05, color: new THREE.Color('#ffd27a').multiplyScalar(2.4), flow: 3.2 },
] as const;
/** Flame tongue tiles per meter of stream. */
const TONGUES_PER_METER = 1.6;
/** Fizzle bits: two sputtering sparks of flame and one puff of smoke at the nozzle. */
const FIZZLE_SPARKS = 2;
const FIZZLE_PUFF_SECONDS = 0.55;

interface JetSlot {
  strips: (THREE.Mesh | null)[];
  maps: THREE.Texture[];
  tongues: THREE.Texture[];
  tip: THREE.Sprite | null;
  sparks: (THREE.Sprite | null)[];
  puff: THREE.Sprite | null;
}

/**
 * The torch in world space, for every player. When it hits something within
 * TORCH_RANGE, a stream of red fire runs from the muzzle to the hit. When
 * nothing is in range, the torch only fizzles at the nozzle: sputtering
 * sparks and a puff of smoke, and no stream.
 */
export function TorchJet({ renderRef, tool }: { renderRef: MutableRefObject<YardRender | null>; tool: UiTool }) {
  const { camera } = useThree();
  const profile = useMemo(streamProfile, []);
  const tongue = useMemo(flameTongues, []);
  const slots = useMemo<JetSlot[]>(() => Array.from({ length: MAX_PLAYERS }, () => ({
    strips: LAYERS.map(() => null),
    maps: LAYERS.map(() => {
      const map = profile.clone();
      map.needsUpdate = true;
      return map;
    }),
    tongues: LAYERS.map(() => {
      const map = tongue.clone();
      map.needsUpdate = true;
      return map;
    }),
    tip: null,
    sparks: Array.from({ length: FIZZLE_SPARKS }, () => null),
    puff: null,
  })), [profile, tongue]);
  useEffect(() => () => {
    profile.dispose();
    tongue.dispose();
    for (const slot of slots) for (const map of [...slot.maps, ...slot.tongues]) map.dispose();
  }, [profile, slots, tongue]);
  const s = useMemo(() => ({
    muzzle: new THREE.Vector3(), aim: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3(),
    end: new THREE.Vector3(), dir: new THREE.Vector3(), mid: new THREE.Vector3(),
    across: new THREE.Vector3(), facing: new THREE.Vector3(), basis: new THREE.Matrix4(),
  }), []);
  const tipRef = useRef<(THREE.Sprite | null)[]>([]);

  useFrame((state) => {
    const render = renderRef.current;
    const time = state.clock.elapsedTime;
    for (let slot = 0; slot < MAX_PLAYERS; slot += 1) {
      const jet = slots[slot]!;
      const tip = tipRef.current[slot] ?? null;
      for (const strip of jet.strips) if (strip) strip.visible = false;
      for (const spark of jet.sparks) if (spark) spark.visible = false;
      if (jet.puff) jet.puff.visible = false;
      if (tip) tip.visible = false;
      const player = render?.players.find((p) => p.slot === slot);
      const feedback = player?.feedback ?? null;
      const visual = render && player && !player.ridingVehicle ? torchVisual(feedback, render.frame) : null;
      if (!render || !player || !feedback || !visual) continue;

      toolMuzzleAndAim(player, slot === render.localSlot && tool !== 'orbit', camera, s.muzzle, s.aim, s, 'torch');

      if (visual === 'fizzle') {
        // Nothing in range: a few sputtering sparks right at the nozzle, and a puff that drifts off.
        jet.sparks.forEach((spark, index) => {
          if (!spark || Math.random() < 0.35) return;
          const reach = 0.04 + Math.random() * 0.2;
          spark.position.copy(s.muzzle).addScaledVector(s.aim, reach)
            .addScaledVector(s.right, (Math.random() - 0.5) * 0.06).addScaledVector(s.up, (Math.random() - 0.5) * 0.06 + index * 0.01);
          const size = 0.05 + Math.random() * 0.11;
          spark.scale.set(size, size, 1);
          (spark.material as THREE.SpriteMaterial).opacity = 0.45 + Math.random() * 0.55;
          spark.visible = true;
        });
        if (jet.puff) {
          const t = ((time + slot * 0.21) % FIZZLE_PUFF_SECONDS) / FIZZLE_PUFF_SECONDS;
          jet.puff.position.copy(s.muzzle).addScaledVector(s.aim, 0.08 + t * 0.3).addScaledVector(s.up, t * 0.12);
          const size = 0.1 + t * 0.32;
          jet.puff.scale.set(size, size, 1);
          (jet.puff.material as THREE.SpriteMaterial).opacity = 0.75 * (1 - t);
          jet.puff.visible = true;
        }
        continue;
      }

      // In range: a stream of fire from the muzzle to the hit point.
      s.end.set(feedback.point[0], feedback.point[1], feedback.point[2]);
      s.dir.subVectors(s.end, s.muzzle);
      const length = s.dir.length();
      if (length < 0.05) continue;
      s.dir.divideScalar(length);

      // Face the camera around the jet axis.
      s.mid.copy(s.muzzle).addScaledVector(s.dir, length * 0.5);
      s.facing.subVectors(camera.position, s.mid);
      s.across.crossVectors(s.dir, s.facing);
      if (s.across.lengthSq() < 1e-8) s.across.set(1, 0, 0).cross(s.dir);
      s.across.normalize();
      s.facing.crossVectors(s.across, s.dir).normalize();
      s.basis.makeBasis(s.across, s.dir, s.facing);
      const flicker = 0.88 + Math.random() * 0.24;
      jet.strips.forEach((strip, index) => {
        if (!strip) return;
        const layer = LAYERS[index]!;
        strip.position.copy(s.muzzle);
        strip.quaternion.setFromRotationMatrix(s.basis);
        strip.scale.set(layer.width * flicker, length, 1);
        const tongues = jet.tongues[index]!;
        tongues.repeat.set(1, length * TONGUES_PER_METER);
        // Scroll toward the hit: the fire flows out of the nozzle.
        tongues.offset.set(index * 0.31, -time * layer.flow);
        strip.visible = true;
      });

      if (tip) {
        tip.position.copy(s.end);
        const size = 0.6 * flicker;
        tip.scale.set(size, size, 1);
        tip.visible = true;
      }
    }
  });

  const additive = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false } as const;
  return (
    <group name="TorchJet">
      {slots.map((jet, slot) => (
        <group key={slot}>
          {LAYERS.map((layer, index) => (
            <mesh
              key={layer.name}
              ref={(mesh) => { jet.strips[index] = mesh; }}
              geometry={STRIP_GEOMETRY}
              visible={false}
              frustumCulled={false}
              renderOrder={10 + index}
            >
              <meshBasicMaterial map={jet.maps[index]} alphaMap={jet.tongues[index]} color={layer.color} side={THREE.DoubleSide} {...additive} />
            </mesh>
          ))}
          <sprite ref={(sprite) => { tipRef.current[slot] = sprite; }} visible={false} renderOrder={13}>
            <spriteMaterial map={glowTexture()} color={new THREE.Color('#ff5a1f').multiplyScalar(2.6)} {...additive} />
          </sprite>
          {jet.sparks.map((_, index) => (
            <sprite key={index} ref={(sprite) => { jet.sparks[index] = sprite; }} visible={false} renderOrder={13}>
              <spriteMaterial map={glowTexture()} color={new THREE.Color('#ff7a2a').multiplyScalar(1.8)} {...additive} />
            </sprite>
          ))}
          <sprite ref={(sprite) => { jet.puff = sprite; }} visible={false} renderOrder={9}>
            <spriteMaterial map={smokeTexture()} color="#a39a92" transparent depthWrite={false} />
          </sprite>
        </group>
      ))}
    </group>
  );
}
