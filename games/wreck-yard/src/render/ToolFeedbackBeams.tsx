import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { MAX_PLAYERS } from '../sim/constants';
import type { UiTool } from './keyBindings';
import type { YardRender } from './presentation';
import { glowTexture } from './style/glowTexture';
import { effectProgress, feedbackEffect, isTorchFiring, towardCamera } from './toolFeedback';
import { toolMuzzleAndAim } from './toolMuzzle';

const BEAM_RADIUS = 0.025;
const UP = new THREE.Vector3(0, 1, 0);
/** Unit torus with its axis on Y (three.js builds it around Z), turned to the push direction. */
const RING_GEOMETRY = new THREE.TorusGeometry(1, 0.06, 6, 28).rotateX(Math.PI / 2);

interface SlotMeshes {
  beam: THREE.Mesh | null;
  flash: THREE.Sprite | null;
  ring: THREE.Mesh | null;
  blast: THREE.Mesh | null;
}

/**
 * One-shot tool feedback, so every click shows a result:
 * - refusal: a straight red beam to what blocked the gun (or into the air on a miss)
 * - lock: a flash on the object the gun took hold of (the tractor beam then takes over)
 * - burst: a shock ring that pushes the object out, and a small ring leaving the muzzle (throw, punt)
 * - heat: an orange glow where the torch hits
 */
export function ToolFeedbackBeams({ renderRef, tool }: { renderRef: MutableRefObject<YardRender | null>; tool: UiTool }) {
  const { camera } = useThree();
  const slots = useRef<SlotMeshes[]>(Array.from({ length: MAX_PLAYERS }, () => ({ beam: null, flash: null, ring: null, blast: null })));
  const s = useMemo(() => ({
    muzzle: new THREE.Vector3(), aim: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3(),
    to: new THREE.Vector3(), dir: new THREE.Vector3(),
  }), []);

  useFrame(() => {
    const render = renderRef.current;
    for (let slot = 0; slot < MAX_PLAYERS; slot += 1) {
      const meshes = slots.current[slot]!;
      const { beam, flash, ring, blast } = meshes;
      if (!beam || !flash || !ring || !blast) continue;
      beam.visible = false;
      flash.visible = false;
      ring.visible = false;
      blast.visible = false;
      const player = render?.players.find((p) => p.slot === slot);
      const feedback = player?.feedback;
      if (!render || !player || !feedback || player.ridingVehicle) continue;
      const effect = feedbackEffect(feedback.result);
      // A torch shot that reaches nothing only fizzles at the nozzle (TorchJet); the red beam is the gravity gun's refusal.
      if (effect.kind === 'refusal' && player.activeTool === 'torch') continue;
      // Water put the flame out: TorchJet draws the steam, and there is no glow or beam.
      if (effect.kind === 'quench') continue;
      const progress = effect.kind === 'heat'
        ? (isTorchFiring(feedback, render.frame) ? 0 : null)
        : effectProgress(render.frame - feedback.frame);
      if (progress === null) continue;
      const fade = effect.kind === 'heat' ? 0.85 + Math.random() * 0.15 : 1 - progress;

      toolMuzzleAndAim(player, slot === render.localSlot && tool !== 'orbit', camera, s.muzzle, s.aim, s);
      s.to.set(feedback.point[0], feedback.point[1], feedback.point[2]);
      s.dir.subVectors(s.to, s.muzzle);
      const length = s.dir.length();
      if (length < 1e-3) continue;
      s.dir.divideScalar(length);
      const distance = s.to.distanceTo(camera.position);

      if (effect.kind === 'refusal') {
        beam.position.copy(s.muzzle).addScaledVector(s.dir, length * 0.5);
        beam.quaternion.setFromUnitVectors(UP, s.dir);
        beam.scale.set(1, length, 1);
        const material = beam.material as THREE.MeshBasicMaterial;
        material.color.set(effect.color).multiplyScalar(2);
        material.opacity = fade;
        beam.visible = true;
      }

      if (effect.kind === 'burst') {
        // Shock ring: faces along the push, grows and fades as it pushes the object out.
        ring.position.copy(s.to);
        ring.quaternion.setFromUnitVectors(UP, s.dir);
        const radius = 0.35 + progress * 1.6;
        ring.scale.set(radius, radius, radius);
        const ringMaterial = ring.material as THREE.MeshBasicMaterial;
        ringMaterial.color.set(effect.color).multiplyScalar(2.4);
        ringMaterial.opacity = fade;
        ring.visible = true;
        // A small, quick ring leaves the muzzle along the aim.
        if (progress < 0.5) {
          blast.position.copy(s.muzzle).addScaledVector(s.aim, 0.2 + progress * 1.2);
          blast.quaternion.setFromUnitVectors(UP, s.aim);
          const radius = 0.08 + progress * 0.5;
          blast.scale.set(radius, radius, radius);
          const blastMaterial = blast.material as THREE.MeshBasicMaterial;
          blastMaterial.color.set(effect.color).multiplyScalar(2);
          blastMaterial.opacity = 1 - progress * 2;
          blast.visible = true;
        }
      }

      const flashes = effect.kind === 'burst' || effect.kind === 'lock' || effect.kind === 'heat' || (effect.kind === 'refusal' && effect.flash);
      if (flashes) {
        // Grow with distance so a far impact still reads on screen.
        const base = effect.kind === 'burst' ? 0.9 : 0.35;
        const size = Math.max(base, distance * 0.045) * (1 + progress * 0.6);
        flash.position.fromArray(towardCamera(s.to.toArray(), camera.position.toArray(), size * 0.5));
        flash.scale.set(size, size, 1);
        const material = flash.material as THREE.SpriteMaterial;
        material.color.set(effect.color).multiplyScalar(2.5);
        material.opacity = fade;
        flash.visible = true;
      }
    }
  });

  const additive = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false } as const;
  return (
    <group name="ToolFeedback">
      {Array.from({ length: MAX_PLAYERS }, (_, slot) => (
        <group key={slot}>
          <mesh ref={(mesh) => { slots.current[slot]!.beam = mesh; }} visible={false} frustumCulled={false} renderOrder={10}>
            <cylinderGeometry args={[BEAM_RADIUS, BEAM_RADIUS, 1, 6, 1, true]} />
            <meshBasicMaterial {...additive} />
          </mesh>
          <mesh ref={(mesh) => { slots.current[slot]!.ring = mesh; }} geometry={RING_GEOMETRY} visible={false} frustumCulled={false} renderOrder={11}>
            <meshBasicMaterial {...additive} />
          </mesh>
          <mesh ref={(mesh) => { slots.current[slot]!.blast = mesh; }} geometry={RING_GEOMETRY} visible={false} frustumCulled={false} renderOrder={11}>
            <meshBasicMaterial {...additive} />
          </mesh>
          <sprite ref={(sprite) => { slots.current[slot]!.flash = sprite; }} visible={false} renderOrder={12}>
            <spriteMaterial map={glowTexture()} {...additive} />
          </sprite>
        </group>
      ))}
    </group>
  );
}
