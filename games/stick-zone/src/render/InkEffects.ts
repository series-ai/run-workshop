/**
 * @file InkEffects.ts
 * Procedural 2D instanced particle engine with 64 presets and zero texture dependencies.
 */
import * as THREE from 'three';
import {
  type ShapeKind,
  EFFECT_BY_ID,
  resolveEffectColor,
  effectEnvelope,
  PAPER_CORE_SCALE,
} from './inkEffectsPresets.js';

const PREVIEW_SEED = 1234567;

interface ParticleInternal {
  shape: ShapeKind;
  time: number;
  life: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  size: number;
  rotation: number;
  gravity: number;
  color: THREE.Color;
  floor: boolean;
  spiral: number;
  orbitRadius: number;
  pairId: number;
  pairRole: 'none' | 'outer' | 'core';
}

interface StarAnchorInternal {
  pairId: number;
  time: number;
  life: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  size: number;
  rotation: number;
  gravity: number;
  floor: boolean;
  spiral: number;
  orbitRadius: number;
}

export function shapeGeometry(kind: ShapeKind): THREE.BufferGeometry {
  if (kind === 'ring') return new THREE.RingGeometry(0.94, 1, 40);
  if (kind === 'dust') {
    const segments = 24;
    const positions: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= segments; i++) {
      const progress = i / segments;
      const angle = 0.12 + progress * 5.64;
      const radius = 0.9 + Math.sin(angle * 3) * 0.055 + Math.cos(angle * 7) * 0.035;
      const width = 0.2 * (0.25 + 0.75 * Math.sin(progress * Math.PI));
      for (const r of [radius, radius - width]) {
        positions.push(Math.cos(angle) * r, Math.sin(angle) * r, 0);
      }
      if (i < segments) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    return geometry;
  }
  const shape = new THREE.Shape();
  if (kind === 'arc') {
    const segments = 24;
    for (let i = 0; i <= segments; i++) {
      const progress = i / segments;
      const t = -0.86 + progress * 2.36;
      const width = 0.008 + 0.065 * Math.sin(progress * Math.PI) ** 0.7;
      const radius = 1 + width;
      const x = Math.cos(t) * radius;
      const y = Math.sin(t) * radius;
      if (i) shape.lineTo(x, y);
      else shape.moveTo(x, y);
    }
    for (let i = segments; i >= 0; i--) {
      const progress = i / segments;
      const t = -0.86 + progress * 2.36;
      const width = 0.008 + 0.065 * Math.sin(progress * Math.PI) ** 0.7;
      const radius = 1 - width;
      shape.lineTo(Math.cos(t) * radius, Math.sin(t) * radius);
    }
  } else if (kind === 'star') {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = i % 2 ? 0.22 : i % 4 ? 0.68 : 1;
      if (i) shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      else shape.moveTo(r, 0);
    }
  } else if (kind === 'chip') {
    shape.moveTo(-0.5, -0.2);
    shape.lineTo(0.2, -0.45);
    shape.lineTo(0.6, 0.2);
    shape.lineTo(-0.3, 0.5);
  } else {
    shape.moveTo(0, -1);
    shape.lineTo(kind === 'stroke' ? 0.055 : 0.17, 0.1);
    shape.lineTo(0, 1);
    shape.lineTo(kind === 'stroke' ? -0.035 : -0.12, 0.25);
  }
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

/**
 * Procedural 2D particle engine managing 7 instanced geometric primitives.
 */
export class InkEffects {
  private readonly particles: ParticleInternal[] = [];
  private readonly bursts: number[] = [];
  private readonly meshes = new Map<ShapeKind, THREE.InstancedMesh>();
  private readonly dummy = new THREE.Object3D();
  private readonly billboard = new THREE.Quaternion();
  private readonly localTurn = new THREE.Quaternion();
  private readonly axis = new THREE.Vector3(0, 0, 1);
  private readonly floorTurn = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  private seed = PREVIEW_SEED;
  private nextPairId = 1;
  public readonly group = new THREE.Group();

  constructor(private readonly capacity = 2048) {
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 8192) {
      throw new Error('Particle capacity must be between 1 and 8192.');
    }
    this.group.name = 'ink-effects-layer';

    for (const kind of ['stroke', 'spark', 'ring', 'arc', 'dust', 'chip', 'star'] as ShapeKind[]) {
      const mesh = new THREE.InstancedMesh(
        shapeGeometry(kind),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          side: THREE.DoubleSide,
          depthWrite: false,
          transparent: false,
        }),
        capacity
      );
      if (kind === 'dust') {
        mesh.geometry.setAttribute(
          'instanceOpacity',
          new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1).setUsage(
            THREE.DynamicDrawUsage
          )
        );
        const material = mesh.material as THREE.MeshBasicMaterial;
        material.transparent = true;
        material.forceSinglePass = true;
        material.customProgramCacheKey = () => 'inkline-dust-fade-v1';
        material.onBeforeCompile = (shader) => {
          shader.vertexShader = shader.vertexShader
            .replace(
              '#include <common>',
              '#include <common>\nattribute float instanceOpacity;\nvarying float vInkOpacity;'
            )
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvInkOpacity = instanceOpacity;');
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nvarying float vInkOpacity;')
            .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vInkOpacity;');
        };
      }
      mesh.count = 0;
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = 2;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.meshes.set(kind, mesh);
      this.group.add(mesh);
    }
  }

  get activeCount(): number {
    return this.particles.length;
  }

  get activeBursts(): number {
    return this.bursts.length;
  }

  public setParticlesVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  /**
   * Returns enclosing 3D bounding box for all currently active particles.
   */
  public getActiveParticleBounds(): THREE.Box3 {
    const box = new THREE.Box3();
    if (this.particles.length === 0) {
      box.min.set(0, 0, 0);
      box.max.set(0, 0, 0);
      return box;
    }
    for (const p of this.particles) {
      const t = Math.max(0, p.time);
      const px = p.position.x + p.velocity.x * t;
      const py = p.position.y + p.velocity.y * t - 0.5 * p.gravity * t * t;
      const pz = p.position.z + p.velocity.z * t;
      const r = Math.max(0.01, p.size);
      box.expandByPoint(new THREE.Vector3(px - r, py - r, pz - r));
      box.expandByPoint(new THREE.Vector3(px + r, py + r, pz + r));
    }
    return box;
  }

  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  /**
   * Trigger an effect preset at a world position.
   */
  trigger(
    id: string,
    at: THREE.Vector3,
    color: string | undefined = undefined,
    scale = 1,
    direction = 0,
    lifetime = 1
  ): number {
    const recipe = EFFECT_BY_ID.get(id);
    if (!recipe) throw new Error(`Unknown effect: ${id}`);
    if (
      ![at.x, at.y, at.z, direction, scale, lifetime].every(Number.isFinite) ||
      scale <= 0 ||
      lifetime <= 0
    ) {
      throw new Error(
        'Effect position, scale, and lifetime must be finite. Scale and lifetime must be positive.'
      );
    }
    let duration = 0;
    const parts = [recipe, ...(recipe.layers ?? []).map((layer) => ({ ...recipe, ...layer }))];
    let sharedStar: StarAnchorInternal | undefined;

    for (const effect of parts) {
      for (let i = 0; i < effect.count && this.particles.length < this.capacity; i++) {
        const colorRole = effect.colorRole ?? (effect.accent ? 'accent' : 'ink');
        const isPaperCore = effect.shape === 'star' && colorRole === 'paper' && sharedStar !== undefined;
        const isStarOuter = effect.shape === 'star' && colorRole !== 'paper';
        let pairId = 0;
        let pairRole: ParticleInternal['pairRole'] = 'none';
        let position: THREE.Vector3;
        let velocity: THREE.Vector3;
        let size: number;
        let rotation: number;
        let gravity: number;
        let floor: boolean;
        let spiral: number;
        let orbitRadius: number;
        let time: number;
        let life: number;

        if (isPaperCore) {
          const anchor = sharedStar!;
          pairId = anchor.pairId;
          pairRole = 'core';
          position = anchor.position.clone();
          velocity = anchor.velocity.clone();
          size = anchor.size * PAPER_CORE_SCALE;
          rotation = anchor.rotation;
          gravity = anchor.gravity;
          floor = anchor.floor;
          spiral = anchor.spiral;
          orbitRadius = anchor.orbitRadius;
          time = anchor.time;
          life = anchor.life;
        } else {
          const angle = direction + (effect.angle ?? 0) + (this.random() - 0.5) * Math.PI * 2 * effect.spread;
          const speed = effect.speed * (0.45 + this.random() * 0.7);
          floor = effect.floor ?? false;
          time = -this.random() * effect.duration * 0.1 * lifetime;
          life = effect.duration * (0.8 + this.random() * 0.35) * lifetime;
          position = at
            .clone()
            .add(new THREE.Vector3((this.random() - 0.5) * 0.08 * scale, 0, (this.random() - 0.5) * 0.08 * scale));
          velocity = new THREE.Vector3(
            Math.cos(angle) * speed,
            floor ? 0.1 + this.random() * 0.15 : Math.sin(angle) * speed + 0.3,
            floor ? Math.sin(angle) * speed : (this.random() - 0.5) * speed * 0.4
          ).multiplyScalar(scale);
          size = effect.size * (0.65 + this.random() * 0.6) * scale;
          rotation = angle - (effect.shape === 'arc' ? 0 : Math.PI / 2);
          gravity = effect.gravity * scale;
          spiral = effect.spiral ?? 0;
          orbitRadius = (effect.orbitRadius ?? 0.5) * scale;

          if (isStarOuter && sharedStar === undefined) {
            pairId = this.nextPairId++;
            pairRole = 'outer';
            sharedStar = {
              pairId,
              time,
              life,
              position: position.clone(),
              velocity: velocity.clone(),
              size,
              rotation,
              gravity,
              floor,
              spiral,
              orbitRadius,
            };
          }
        }
        duration = Math.max(duration, life - time);
        this.particles.push({
          shape: effect.shape,
          time,
          life,
          position,
          velocity,
          size,
          rotation,
          gravity,
          color: new THREE.Color(resolveEffectColor(colorRole, color, effect.shape === 'dust')),
          floor: floor && effect.shape !== 'dust',
          spiral,
          orbitRadius,
          pairId,
          pairRole,
        });
      }
    }
    if (duration) this.bursts.push(duration);
    return duration;
  }

  clear(): void {
    this.particles.length = 0;
    this.bursts.length = 0;
    this.seed = PREVIEW_SEED;
    this.nextPairId = 1;
    for (const mesh of this.meshes.values()) {
      mesh.count = 0;
      mesh.visible = false;
    }
  }

  update(delta: number, camera: THREE.Camera): void {
    if (!Number.isFinite(delta) || delta < 0) {
      throw new Error('Effect delta must be finite and nonnegative.');
    }
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      this.bursts[i] -= delta;
      if (this.bursts[i] <= 0) this.bursts.splice(i, 1);
    }
    camera.getWorldQuaternion(this.billboard);
    for (const mesh of this.meshes.values()) mesh.count = 0;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.time += delta;
      if (p.time >= p.life) {
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
        continue;
      }
      if (p.time < 0) continue;
    }
    const upload = (p: ParticleInternal): void => {
      if (p.time < 0) return;
      const t = p.time / p.life;
      const envelope = effectEnvelope(t);
      this.dummy.position.copy(p.position).addScaledVector(p.velocity, p.time);
      this.dummy.position.y -= 0.5 * p.gravity * p.time * p.time;
      if (p.spiral) {
        this.dummy.position.x += Math.cos(p.time * p.spiral + p.rotation) * p.orbitRadius;
        this.dummy.position.z += Math.sin(p.time * p.spiral + p.rotation) * p.orbitRadius;
      }
      this.localTurn.setFromAxisAngle(this.axis, p.rotation + (p.shape === 'chip' ? p.time * 3 : 0));
      this.dummy.quaternion.copy(p.floor ? this.floorTurn : this.billboard).multiply(this.localTurn);
      const size = p.size * (p.shape === 'dust' ? 0.4 + 0.7 * Math.min(1, t / 0.6) : Math.max(0.001, envelope));
      this.dummy.scale.set(size, size * (p.shape === 'dust' ? 0.72 : 1), size);
      this.dummy.updateMatrix();
      const mesh = this.meshes.get(p.shape)!;
      mesh.setMatrixAt(mesh.count, this.dummy.matrix);
      mesh.setColorAt(mesh.count, p.color);
      const opacity = mesh.geometry.getAttribute('instanceOpacity');
      if (opacity) opacity.setX(mesh.count, Math.min(1, t / 0.08) * (1 - t) ** 1.5);
      mesh.count++;
    };

    // Keep paired star cores after their outer stars in the shared star pool
    for (const p of this.particles) if (p.pairRole !== 'core') upload(p);
    for (const p of this.particles) if (p.pairRole === 'core') upload(p);

    for (const mesh of this.meshes.values()) {
      mesh.visible = mesh.count > 0;
      if (!mesh.visible) continue;
      const opacity = mesh.geometry.getAttribute('instanceOpacity');
      if (opacity) opacity.needsUpdate = true;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  dispose(): void {
    this.clear();
    for (const mesh of this.meshes.values()) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
    }
    this.group.removeFromParent();
  }
}
