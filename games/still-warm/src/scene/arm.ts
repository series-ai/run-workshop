import { Bone, Quaternion, Vector3 } from 'three';

// Solve two arm bones in world space. Bone lengths stay fixed.
export class ArmReach {
  private shoulder = new Vector3();
  private elbow = new Vector3();
  private hand = new Vector3();
  private direction = new Vector3();
  private bend = new Vector3();
  private desiredElbow = new Vector3();
  private reachable = new Vector3();
  private from = new Vector3();
  private to = new Vector3();
  private delta = new Quaternion();
  private parentRotation = new Quaternion();
  private rotation = new Quaternion();

  private aim(bone: Bone, child: Bone, target: Vector3): void {
    bone.getWorldPosition(this.from);
    child.getWorldPosition(this.to);
    this.to.sub(this.from).normalize();
    this.from.subVectors(target, this.from).normalize();
    this.delta.setFromUnitVectors(this.to, this.from);
    bone.getWorldQuaternion(this.rotation);
    this.rotation.premultiply(this.delta);
    if (bone.parent) {
      bone.parent.getWorldQuaternion(this.parentRotation).invert();
      this.rotation.premultiply(this.parentRotation);
    }
    bone.quaternion.copy(this.rotation);
    bone.updateWorldMatrix(false, true);
  }

  solve(
    upper: Bone,
    lower: Bone,
    end: Bone,
    target: Vector3,
    pole: Vector3,
  ): number {
    upper.getWorldPosition(this.shoulder);
    lower.getWorldPosition(this.elbow);
    end.getWorldPosition(this.hand);
    const a = this.shoulder.distanceTo(this.elbow);
    const b = this.elbow.distanceTo(this.hand);
    const distance = Math.max(
      0.001,
      Math.min(this.shoulder.distanceTo(target), a + b - 0.0001),
    );
    this.direction.subVectors(target, this.shoulder).normalize();
    this.bend.subVectors(pole, this.shoulder);
    this.bend
      .addScaledVector(this.direction, -this.bend.dot(this.direction))
      .normalize();
    if (this.bend.lengthSq() < 0.01) this.bend.set(0, 0, -1);
    const along = (a * a - b * b + distance * distance) / (2 * distance);
    const height = Math.sqrt(Math.max(0, a * a - along * along));
    this.desiredElbow
      .copy(this.shoulder)
      .addScaledVector(this.direction, along)
      .addScaledVector(this.bend, height);
    this.reachable
      .copy(this.shoulder)
      .addScaledVector(this.direction, distance);
    this.aim(upper, lower, this.desiredElbow);
    this.aim(lower, end, this.reachable);
    end.getWorldPosition(this.hand);
    return this.hand.distanceTo(target);
  }
}
