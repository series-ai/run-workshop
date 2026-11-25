/**
 * @file ShatterMesh.ts
 * Idempotent 28-shard ruby crystal shatter burst upon lethal elimination of AI threats.
 */
import * as THREE from 'three';

export const RUBY_SHATTER_COLOR = '#ff2212';
export const SHARD_COUNT = 28;
export const SHATTER_LIFETIME = 0.65;

interface Shard {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Euler;
  rotSpeed: THREE.Vector3;
  age: number;
  maxAge: number;
  scale: number;
}

export class ShatterMesh {
  public readonly group = new THREE.Group();
  private readonly shards: Shard[] = [];
  private readonly pool: Shard[];
  private readonly geometry = new THREE.TetrahedronGeometry(0.14);
  private readonly material = new THREE.MeshBasicMaterial({
    color: RUBY_SHATTER_COLOR,
    side: THREE.DoubleSide,
  });
  private readonly instancedMesh: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private seed = 98765;

  constructor(maxShards = 256) {
    this.group.name = 'ruby-shatter-layer';
    this.instancedMesh = new THREE.InstancedMesh(this.geometry, this.material, maxShards);
    this.instancedMesh.count = 0;
    this.instancedMesh.frustumCulled = false;
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.instancedMesh);

    // Pre-allocate complete shard object pool to eliminate runtime allocations
    this.pool = Array.from({ length: maxShards }, () => ({
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      rotation: new THREE.Euler(),
      rotSpeed: new THREE.Vector3(),
      age: 0,
      maxAge: 0,
      scale: 0,
    }));
  }

  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  /**
   * Spawns exactly 28 crystalline shards at the elimination position.
   */
  public trigger(at: THREE.Vector3): void {
    const canSpawn = Math.min(SHARD_COUNT, this.instancedMesh.instanceMatrix.count - this.shards.length);
    for (let i = 0; i < canSpawn; i++) {
      const theta = this.random() * Math.PI * 2;
      const phi = (this.random() - 0.5) * Math.PI * 0.8;
      const speed = 2.4 + this.random() * 1.8; // 2.4 to 4.2 m/s

      const shard = this.pool[this.shards.length];
      shard.position.set(
        at.x + (this.random() - 0.5) * 0.2,
        at.y + 0.6 + (this.random() - 0.5) * 0.4,
        at.z + (this.random() - 0.5) * 0.2
      );
      shard.velocity.set(
        Math.cos(phi) * Math.sin(theta) * speed,
        Math.abs(Math.sin(phi)) * speed + 1.2,
        Math.cos(phi) * Math.cos(theta) * speed
      );
      shard.rotation.set(
        this.random() * Math.PI * 2,
        this.random() * Math.PI * 2,
        this.random() * Math.PI * 2
      );
      shard.rotSpeed.set(
        (this.random() - 0.5) * 24,
        (this.random() - 0.5) * 24,
        (this.random() - 0.5) * 24
      );
      shard.age = 0;
      shard.maxAge = SHATTER_LIFETIME * (0.8 + this.random() * 0.4);
      shard.scale = 0.8 + this.random() * 0.6;

      this.shards.push(shard);
    }
  }

  public update(delta: number): void {
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const s = this.shards[i];
      s.age += delta;
      if (s.age >= s.maxAge) {
        const last = this.shards.pop()!;
        if (i < this.shards.length) {
          this.shards[i] = last;
        }
        continue;
      }

      s.position.x += s.velocity.x * delta;
      s.position.y += s.velocity.y * delta;
      s.position.z += s.velocity.z * delta;

      // Gravity -9.8 m/s²
      s.velocity.y -= 9.8 * delta;

      // Bounce on floor
      if (s.position.y < 0.05) {
        s.position.y = 0.05;
        s.velocity.y = -s.velocity.y * 0.35;
        s.velocity.x *= 0.75;
        s.velocity.z *= 0.75;
      }

      s.rotation.x += s.rotSpeed.x * delta;
      s.rotation.y += s.rotSpeed.y * delta;
      s.rotation.z += s.rotSpeed.z * delta;
    }

    const count = Math.min(this.shards.length, this.instancedMesh.instanceMatrix.count);
    this.instancedMesh.count = count;

    for (let i = 0; i < count; i++) {
      const s = this.shards[i];
      const progress = s.age / s.maxAge;
      const fadeScale = s.scale * Math.max(0.001, 1 - progress ** 2);

      this.dummy.position.copy(s.position);
      this.dummy.rotation.copy(s.rotation);
      this.dummy.scale.set(fadeScale, fadeScale, fadeScale);
      this.dummy.updateMatrix();

      this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
    }

    if (count > 0) {
      this.instancedMesh.instanceMatrix.needsUpdate = true;
    }
  }

  public clear(): void {
    this.shards.length = 0;
    this.instancedMesh.count = 0;
  }

  public dispose(): void {
    this.clear();
    this.geometry.dispose();
    this.material.dispose();
    this.group.removeFromParent();
  }
}
