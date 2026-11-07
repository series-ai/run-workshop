import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { FLOOR_Y } from '../sim/constants';
import type { Explosion } from '../sim/state';
import { EXPLOSION_FX_SECONDS, explosionFrame, sparkSpeed } from './explosionFx';
import type { YardRender } from './presentation';
import { glowTexture, smokeTexture } from './style/glowTexture';

/** Explosions drawn at once; a newer blast takes the oldest slot. */
const SLOTS = 4;
const FIREBALL_PUFFS = 14;
const SMOKE_PUFFS = 10;
const SPARKS = 480;
const SPARKS_PER_BLAST = 120;

/** Blasts this far above the floor leave no scorch mark or floor ring. */
const GROUND_REACH = 2.6;

const shellVertex = /* glsl */ `
  varying vec3 vNormalView;
  varying vec3 vViewDir;
  void main() {
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vViewDir = normalize(-view.xyz);
    gl_Position = projectionMatrix * view;
  }
`;
const shellFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec3 vNormalView;
  varying vec3 vViewDir;
  void main() {
    // Bright at the rim with a warm core glow so the full blast sphere reads clearly.
    float ndotv = abs(dot(vNormalView, vViewDir));
    float rim = pow(1.0 - ndotv, 2.0) + 0.22 * (1.0 - ndotv);
    gl_FragColor = vec4(uColor * rim * uOpacity, 1.0);
  }
`;

/** Seeded per explosion, so its puffs keep their places from frame to frame. */
function seeded(seed: number): () => number {
  let state = (Math.imul(seed + 1, 2654435761) >>> 0) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

interface Slot {
  key: string | null;
  startedAt: number;
  at: THREE.Vector3;
  radius: number;
  offsets: THREE.Vector3[];
  smokeOffsets: THREE.Vector3[];
  group: THREE.Group;
  shell: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  scorch: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  fireball: THREE.Sprite[];
  smoke: THREE.Sprite[];
}

interface Spark {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

const HOT = new THREE.Color(2.6, 2.0, 1.2);
const FIRE = new THREE.Color(2.0, 0.78, 0.18);
const EMBER = new THREE.Color(1.1, 0.22, 0.05);
/** Light grey, so the smoke reads against the dark yard; warm while the fire lights it. */
const SMOKE = new THREE.Color('#948b83');
const SMOKE_LIT = new THREE.Color('#d9935e');

/**
 * Fuel drum explosions (sim/fuelDrum.ts): a flash, a fireball, a shock shell
 * and a floor ring that stop at the blast radius, sparks that fly to it, a
 * scorch mark, and smoke. Sizes come from the sim's radius (explosionFx.ts).
 */
export function Explosions({ renderRef }: { renderRef: MutableRefObject<YardRender | null> }) {
  const root = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  const sparkMesh = useRef<THREE.InstancedMesh>(null);
  const clock = useRef(0);

  const slots = useMemo<Slot[]>(() => {
    const shellGeometry = new THREE.SphereGeometry(1, 40, 20);
    const ringGeometry = new THREE.RingGeometry(0.82, 1, 96);
    const scorchGeometry = new THREE.CircleGeometry(1, 48);
    return Array.from({ length: SLOTS }, () => {
      const group = new THREE.Group();
      group.visible = false;
      const shell = new THREE.Mesh(shellGeometry, new THREE.ShaderMaterial({
        vertexShader: shellVertex,
        fragmentShader: shellFragment,
        uniforms: { uColor: { value: new THREE.Color(2.2, 1.35, 0.55) }, uOpacity: { value: 0 } },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }));
      shell.renderOrder = 11;
      const ring = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({
        color: new THREE.Color(2.8, 1.5, 0.55), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
      }));
      ring.rotation.x = -Math.PI / 2;
      ring.renderOrder = 11;
      const scorch = new THREE.Mesh(scorchGeometry, new THREE.MeshBasicMaterial({
        color: '#0b0908', transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
      }));
      scorch.rotation.x = -Math.PI / 2;
      const fireball = Array.from({ length: FIREBALL_PUFFS }, () => new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      })));
      const smoke = Array.from({ length: SMOKE_PUFFS }, () => new THREE.Sprite(new THREE.SpriteMaterial({
        map: smokeTexture(), color: SMOKE, transparent: true, depthWrite: false,
      })));
      for (const sprite of fireball) sprite.renderOrder = 12;
      group.add(scorch, ring, shell, ...smoke, ...fireball);
      return {
        key: null, startedAt: 0, at: new THREE.Vector3(), radius: 0, offsets: [], smokeOffsets: [],
        group, shell, ring, scorch, fireball, smoke,
      };
    });
  }, []);

  const sparks = useMemo<Spark[]>(() => Array.from({ length: SPARKS }, () => ({
    position: new THREE.Vector3(0, -100, 0), velocity: new THREE.Vector3(), life: 0, maxLife: 1,
  })), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useEffect(() => {
    const group = root.current;
    if (!group) return undefined;
    for (const slot of slots) group.add(slot.group);
    return () => {
      for (const slot of slots) {
        group.remove(slot.group);
        slot.shell.material.dispose();
        slot.ring.material.dispose();
        slot.scorch.material.dispose();
        for (const sprite of [...slot.fireball, ...slot.smoke]) sprite.material.dispose();
      }
      slots[0]?.shell.geometry.dispose();
      slots[0]?.ring.geometry.dispose();
      slots[0]?.scorch.geometry.dispose();
    };
  }, [slots]);

  function start(slot: Slot, explosion: Explosion, key: string, now: number): void {
    const random = seeded(explosion.frame * 7919 + Math.round(explosion.at[0] * 100));
    slot.key = key;
    slot.startedAt = now;
    slot.radius = explosion.radius;
    slot.at.set(explosion.at[0], explosion.at[1], explosion.at[2]);
    slot.offsets = Array.from({ length: FIREBALL_PUFFS }, () => new THREE.Vector3(random() - 0.5, random() * 0.8 - 0.25, random() - 0.5).multiplyScalar(0.65));
    slot.smokeOffsets = Array.from({ length: SMOKE_PUFFS }, () => new THREE.Vector3(random() - 0.5, random() * 0.5, random() - 0.5).multiplyScalar(0.85));
    slot.group.position.copy(slot.at);
    slot.group.visible = true;
    // Sparks out of the free pool, in every direction, biased up.
    let launched = 0;
    for (const spark of sparks) {
      if (launched >= SPARKS_PER_BLAST) break;
      if (spark.life > 0) continue;
      launched += 1;
      spark.maxLife = 0.55 + random() * 0.5;
      spark.life = spark.maxLife;
      spark.position.copy(slot.at);
      const direction = new THREE.Vector3(random() * 2 - 1, random() * 1.4 - 0.15, random() * 2 - 1).normalize();
      spark.velocity.copy(direction).multiplyScalar(sparkSpeed(explosion.radius, spark.maxLife) * (0.75 + random() * 0.35));
    }
  }

  useFrame((_, delta) => {
    clock.current += delta;
    const now = clock.current;
    const render = renderRef.current;
    const explosions = render?.contraptions.explosions ?? [];

    for (const explosion of explosions) {
      const key = `${explosion.frame}:${explosion.at.map((v) => v.toFixed(2)).join(',')}`;
      if (slots.some((slot) => slot.key === key)) continue;
      // A blast more than a moment old (a late join, a tab coming back) is not replayed.
      if (render && render.frame - explosion.frame > 6) continue;
      const free = slots.find((slot) => slot.key === null) ?? [...slots].sort((a, b) => a.startedAt - b.startedAt)[0]!;
      start(free, explosion, key, now);
    }

    let flash = 0;
    const flashAt = new THREE.Vector3();
    for (const slot of slots) {
      if (slot.key === null) continue;
      const seconds = now - slot.startedAt;
      if (seconds > EXPLOSION_FX_SECONDS) {
        slot.key = null;
        slot.group.visible = false;
        continue;
      }
      const frame = explosionFrame(seconds, slot.radius);
      if (frame.flash > flash) {
        flash = frame.flash;
        flashAt.copy(slot.at);
      }
      slot.shell.scale.setScalar(Math.max(0.001, frame.shockRadius));
      slot.shell.material.uniforms.uOpacity!.value = frame.shockOpacity * 0.85;
      slot.shell.visible = frame.shockOpacity > 0;

      const groundY = FLOOR_Y + 0.03 - slot.at.y;
      const onGround = slot.at.y - FLOOR_Y < GROUND_REACH;
      slot.ring.visible = onGround && frame.ringOpacity > 0;
      slot.ring.position.y = groundY;
      slot.ring.scale.setScalar(Math.max(0.001, frame.ringRadius));
      slot.ring.material.opacity = frame.ringOpacity;
      slot.scorch.visible = onGround && frame.scorchOpacity > 0;
      slot.scorch.position.y = groundY - 0.005;
      slot.scorch.scale.setScalar(slot.radius * 0.72);
      slot.scorch.material.opacity = frame.scorchOpacity * Math.min(1, seconds / 0.15);

      // White hot for a moment at the core; the outer puffs burn red.
      const hot = Math.max(0, 1 - seconds / 0.18);
      slot.fireball.forEach((sprite, index) => {
        const offset = slot.offsets[index]!;
        const outer = index >= 6;
        const size = frame.fireballRadius * (outer ? 0.95 : 0.8 + (index % 3) * 0.16);
        sprite.visible = frame.fireballOpacity > 0;
        sprite.position.copy(offset).multiplyScalar(frame.fireballRadius * (outer ? 1.45 : 0.95)).add(new THREE.Vector3(0, seconds * 1.8, 0));
        sprite.scale.setScalar(size * 2.2);
        sprite.material.color.copy(outer ? EMBER : FIRE).lerp(HOT, outer ? 0.25 * hot : hot).lerp(EMBER, Math.min(1, Math.max(0, seconds - 0.3) * 1.8));
        sprite.material.opacity = frame.fireballOpacity * (outer ? 0.72 : 0.95);
      });

      slot.smoke.forEach((sprite, index) => {
        const life = frame.smoke;
        sprite.visible = life !== null && seconds > 0.06;
        if (life === null) return;
        const offset = slot.smokeOffsets[index]!;
        const rise = 2.6 + (index % 4) * 0.6;
        sprite.position.set(offset.x * slot.radius * 0.65, 0.35 + life * rise + offset.y * slot.radius * 0.35, offset.z * slot.radius * 0.65);
        sprite.scale.setScalar(slot.radius * (0.45 + life * 0.75));
        sprite.material.color.copy(SMOKE_LIT).lerp(SMOKE, Math.min(1, seconds / 0.9));
        sprite.material.opacity = 0.88 * Math.min(1, (seconds - 0.06) / 0.3) * (1 - life) ** 1.1;
      });
    }

    if (light.current) {
      light.current.intensity = 110 * flash;
      light.current.position.copy(flashAt);
    }

    const mesh = sparkMesh.current;
    if (!mesh) return;
    for (let index = 0; index < SPARKS; index += 1) {
      const spark = sparks[index]!;
      if (spark.life > 0) {
        spark.life -= delta;
        spark.position.addScaledVector(spark.velocity, delta);
        spark.velocity.y -= 6 * delta;
        spark.velocity.multiplyScalar(Math.max(0, 1 - 1.4 * delta));
        if (spark.position.y < FLOOR_Y + 0.02) {
          spark.position.y = FLOOR_Y + 0.02;
          spark.velocity.y *= -0.35;
        }
        const t = Math.max(0, spark.life / spark.maxLife);
        const size = 0.12 * (0.45 + t * 0.65);
        dummy.position.copy(spark.position);
        dummy.quaternion.setFromUnitVectors(up, spark.velocity.lengthSq() > 1e-6 ? spark.velocity.clone().normalize() : up);
        dummy.scale.set(size, size * (1 + spark.velocity.length() * 0.16), size);
        mesh.setColorAt(index, t > 0.65 ? HOT : t > 0.3 ? FIRE : EMBER);
      } else {
        dummy.position.set(0, -100, 0);
        dummy.scale.setScalar(0);
      }
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <group ref={root}>
      <pointLight ref={light} intensity={0} distance={24} decay={1.4} color="#ffad5c" />
      <instancedMesh ref={sparkMesh} args={[undefined, undefined, SPARKS]} frustumCulled={false}>
        <coneGeometry args={[0.3, 1.2, 4]} />
        <meshBasicMaterial toneMapped={false} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}
