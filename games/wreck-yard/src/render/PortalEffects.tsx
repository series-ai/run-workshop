import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { RETURNS_PAIR } from '../sim/returns';
import type { YardRender } from './presentation';
import { useReducedMotionRef } from './reducedMotion';

const ENDS = [RETURNS_PAIR.portalA, RETURNS_PAIR.portalB] as const;

function surfaceMaterial(): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPulse: { value: 0 },
      uContact: { value: 0 },
      uCenter: { value: new THREE.Vector2(0.5, 0.5) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vSurfaceUv;
      #include <clipping_planes_pars_vertex>
      void main() {
        vSurfaceUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <clipping_planes_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uPulse;
      uniform float uContact;
      uniform vec2 uCenter;
      varying vec2 vSurfaceUv;
      #include <clipping_planes_pars_fragment>
      void main() {
        #include <clipping_planes_fragment>
        vec2 uv = vSurfaceUv;
        float border = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
        float edge = 1.0 - smoothstep(0.0, 0.09, border);
        float wave = sin(uv.y * 42.0 + sin(uv.x * 16.0 + uTime * 0.45) - uTime * 0.9);
        float film = pow(0.5 + 0.5 * wave, 14.0);
        float radius = length((uv - uCenter) * vec2(1.14, 1.0));
        float ripple = pow(0.5 + 0.5 * sin(radius * 48.0 - uTime * 8.0), 10.0);
        float activity = max(uContact * 0.5, uPulse);
        float alpha = 0.008 + edge * 0.065 + film * 0.017 + activity * (ripple * 0.14 + edge * 0.07);
        vec3 tint = mix(vec3(0.16, 0.38, 0.36), vec3(0.48, 0.70, 0.62), edge + activity * 0.25);
        gl_FragColor = vec4(tint, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    toneMapped: false,
    clipping: true,
  });
  material.name = 'returns-portal-film';
  return material;
}

/** Portal film and crossing ripples use presentation state only. */
export function PortalEffects({ renderRef }: { renderRef: MutableRefObject<YardRender | null> }) {
  const reducedMotion = useReducedMotionRef();
  const assets = useMemo(() => ({
    geometry: new THREE.PlaneGeometry(RETURNS_PAIR.portalA.opening.width, RETURNS_PAIR.portalA.opening.height),
    materials: [surfaceMaterial(), surfaceMaterial()],
  }), []);
  const previous = useRef({ frame: -1, counters: new Map<string, number>(), pulseAt: -Infinity });
  useEffect(() => () => {
    assets.geometry.dispose();
    assets.materials.forEach((material) => material.dispose());
  }, [assets]);

  useFrame(({ clock }) => {
    const render = renderRef.current;
    const state = previous.current;
    if (!render || render.frame < state.frame) {
      state.counters.clear();
      state.pulseAt = -Infinity;
    }
    const counters = new Map<string, number>();
    if (render) {
      for (const player of render.players) counters.set(`player:${player.slot}`, player.portalTeleports ?? 0);
      for (const [id, pose] of render.poses) counters.set(`body:${id}`, pose.teleportCounter ?? 0);
      for (const [id, counter] of counters) {
        const before = state.counters.get(id);
        if (before !== undefined && counter > before) state.pulseAt = clock.elapsedTime;
      }
    }
    state.counters = counters;
    state.frame = render?.frame ?? -1;
    const pulse = Math.max(0, 1 - (clock.elapsedTime - state.pulseAt) / 0.7);
    assets.materials.forEach((material, index) => {
      const name = index === 0 ? 'A' : 'B';
      const contact = render?.portalStraddlers?.find((entry) => entry.pairId === RETURNS_PAIR.id && entry.end === name);
      const pose = contact ? render?.poses.get(contact.bodyId) : null;
      if (pose) {
        const end = ENDS[index]!;
        const localX = (pose.position[0] - end.position.x) * (index === 0 ? -1 : 1);
        (material.uniforms.uCenter!.value as THREE.Vector2).set(
          THREE.MathUtils.clamp(0.5 + localX / end.opening.width, 0, 1),
          THREE.MathUtils.clamp(0.5 + (pose.position[1] - end.position.y) / end.opening.height, 0, 1),
        );
      }
      material.uniforms.uTime!.value = reducedMotion.current ? 0 : clock.elapsedTime;
      material.uniforms.uContact!.value = pose ? 1 : 0;
      material.uniforms.uPulse!.value = pulse * pulse * (reducedMotion.current ? 0.35 : 1);
    });
  });

  return (
    <group name="returns-portal-effects">
      {ENDS.map((end, index) => (
        <mesh key={index} name={`returns-film-${index === 0 ? 'a' : 'b'}`}
          geometry={assets.geometry} material={assets.materials[index]}
          position={[end.position.x, end.position.y, end.position.z + (index === 0 ? -0.018 : 0.018)]}
          quaternion={[end.rotation.x, end.rotation.y, end.rotation.z, end.rotation.w]}
          renderOrder={2} />
      ))}
    </group>
  );
}
