import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { MAX_PLAYERS, PLAYER_EYE_OFFSET, TORCH_RANGE } from '../sim/constants';
import type { UiTool } from './keyBindings';
import type { YardRender } from './presentation';
import { glowTexture } from './style/glowTexture';
import { isTorchFiring } from './toolFeedback';
import { toolMuzzleAndAim } from './toolMuzzle';

/**
 * Flame brightness over the full reach: soft across the width, full at the
 * nozzle, burned out at TORCH_RANGE. V runs from the nozzle (0) to the end of the reach (1).
 */
function flameProfile(): THREE.CanvasTexture {
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
    const along = Math.min(1, v / 0.05) * (1 - v) ** 0.8;
    for (let column = 0; column < width; column += 1) {
      const u = (column + 0.5) / width - 0.5;
      // Tight at the nozzle, then the jet opens up as it burns out.
      const spread = 0.07 + 0.3 * Math.sqrt(v) * (1 - v * 0.6);
      const value = Math.round(255 * along * Math.exp(-((u / spread) ** 2) * 2.2));
      const index = (row * width + column) * 4;
      image.data[index] = value;
      image.data[index + 1] = value;
      image.data[index + 2] = value;
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/** A unit strip, X across (-0.5..0.5) and Y along the jet (0..1). */
const STRIP_GEOMETRY = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
const LAYERS = [
  { name: 'plume', width: 0.24, color: new THREE.Color('#ff9a40').multiplyScalar(1.5) },
  { name: 'core', width: 0.07, color: new THREE.Color('#fff1ca').multiplyScalar(2.6) },
] as const;

interface JetSlot {
  strips: (THREE.Mesh | null)[];
  maps: THREE.Texture[];
  tip: THREE.Sprite | null;
}

/**
 * The torch flame in world space, for every player. It runs from the muzzle
 * along the aim for exactly TORCH_RANGE from the eye (the sim's reach) and
 * burns out there; when the torch hits a surface first, the flame stops on it.
 */
export function TorchJet({ renderRef, tool }: { renderRef: MutableRefObject<YardRender | null>; tool: UiTool }) {
  const { camera } = useThree();
  const profile = useMemo(flameProfile, []);
  const slots = useMemo<JetSlot[]>(() => Array.from({ length: MAX_PLAYERS }, () => ({
    strips: LAYERS.map(() => null),
    maps: LAYERS.map(() => {
      const map = profile.clone();
      map.needsUpdate = true;
      return map;
    }),
    tip: null,
  })), [profile]);
  useEffect(() => () => {
    profile.dispose();
    for (const slot of slots) for (const map of slot.maps) map.dispose();
  }, [profile, slots]);
  const s = useMemo(() => ({
    muzzle: new THREE.Vector3(), aim: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3(),
    end: new THREE.Vector3(), reachEnd: new THREE.Vector3(), dir: new THREE.Vector3(), mid: new THREE.Vector3(),
    across: new THREE.Vector3(), facing: new THREE.Vector3(), basis: new THREE.Matrix4(),
  }), []);
  const tipRef = useRef<(THREE.Sprite | null)[]>([]);

  useFrame(() => {
    const render = renderRef.current;
    for (let slot = 0; slot < MAX_PLAYERS; slot += 1) {
      const jet = slots[slot]!;
      const tip = tipRef.current[slot] ?? null;
      for (const strip of jet.strips) if (strip) strip.visible = false;
      if (tip) tip.visible = false;
      const player = render?.players.find((p) => p.slot === slot);
      const feedback = player?.feedback ?? null;
      if (!render || !player || !feedback || player.ridingVehicle || !isTorchFiring(feedback, render.frame)) continue;

      toolMuzzleAndAim(player, slot === render.localSlot && tool !== 'orbit', camera, s.muzzle, s.aim, s, 'torch');
      s.end.set(feedback.point[0], feedback.point[1], feedback.point[2]);
      s.dir.subVectors(s.end, s.muzzle);
      const length = s.dir.length();
      if (length < 0.05) continue;
      s.dir.divideScalar(length);
      // The full reach ends TORCH_RANGE from the eye along the aim, as in the sim.
      const cosPitch = Math.cos(player.pitch);
      s.reachEnd.set(
        player.position[0] - Math.sin(player.yaw) * cosPitch * TORCH_RANGE,
        player.position[1] + PLAYER_EYE_OFFSET + Math.sin(player.pitch) * TORCH_RANGE,
        player.position[2] - Math.cos(player.yaw) * cosPitch * TORCH_RANGE,
      );
      const reach = Math.max(length, s.reachEnd.distanceTo(s.muzzle));
      const shown = length / reach;

      // Face the camera around the jet axis.
      s.mid.copy(s.muzzle).addScaledVector(s.dir, length * 0.5);
      s.facing.subVectors(camera.position, s.mid);
      s.across.crossVectors(s.dir, s.facing);
      if (s.across.lengthSq() < 1e-8) s.across.set(1, 0, 0).cross(s.dir);
      s.across.normalize();
      s.facing.crossVectors(s.across, s.dir).normalize();
      s.basis.makeBasis(s.across, s.dir, s.facing);
      const flicker = 0.85 + Math.random() * 0.3;
      jet.strips.forEach((strip, index) => {
        if (!strip) return;
        strip.position.copy(s.muzzle);
        strip.quaternion.setFromRotationMatrix(s.basis);
        strip.scale.set(LAYERS[index]!.width * flicker, length, 1);
        jet.maps[index]!.repeat.set(1, shown);
        strip.visible = true;
      });

      // A hit glows where the flame meets the surface; in open air the flame just burns out.
      if (tip && feedback.result !== 'miss') {
        tip.position.copy(s.end);
        const size = 0.55 * flicker;
        tip.scale.set(size, size, 1);
        tip.visible = true;
      }
    }
  });

  const additive = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide } as const;
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
              <meshBasicMaterial map={jet.maps[index]} color={layer.color} {...additive} />
            </mesh>
          ))}
          <sprite ref={(sprite) => { tipRef.current[slot] = sprite; }} visible={false} renderOrder={12}>
            <spriteMaterial map={glowTexture()} color={new THREE.Color('#ffb347').multiplyScalar(2.5)} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </sprite>
        </group>
      ))}
    </group>
  );
}
