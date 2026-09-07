import { describe, expect, it } from 'vitest';
import { Bone, Group, Vector3 } from 'three';
import { ArmReach } from './arm';

function rig() {
  const root = new Group();
  root.position.set(-0.6, -0.3, 0.4);
  root.rotation.set(0.2, 2.4, -0.1);
  root.scale.setScalar(0.01);
  const upper = new Bone();
  const lower = new Bone();
  const hand = new Bone();
  lower.position.set(0, 32, 0);
  hand.position.set(0, 30, 0);
  root.add(upper);
  upper.add(lower);
  lower.add(hand);
  root.updateMatrixWorld(true);
  return { root, upper, lower, hand };
}

describe('arm reach', () => {
  it('puts the actual hand at a reachable world target under rotated and scaled parents', () => {
    const { upper, lower, hand } = rig();
    const target = new Vector3(-0.25, -0.12, 0.28);
    const error = new ArmReach().solve(
      upper,
      lower,
      hand,
      target,
      new Vector3(-0.8, 0, -0.4),
    );
    expect(error).toBeLessThan(0.00001);
    expect(
      hand.getWorldPosition(new Vector3()).distanceTo(target),
    ).toBeLessThan(0.00001);
    expect(
      lower
        .getWorldPosition(new Vector3())
        .distanceTo(upper.getWorldPosition(new Vector3())),
    ).toBeCloseTo(0.32, 5);
  });
  it('does not stretch the skeleton to claim an unreachable contact', () => {
    const { upper, lower, hand } = rig();
    const target = new Vector3(10, 0, 0);
    const error = new ArmReach().solve(
      upper,
      lower,
      hand,
      target,
      new Vector3(0, 1, 0),
    );
    expect(error).toBeGreaterThan(9);
    expect(
      hand
        .getWorldPosition(new Vector3())
        .distanceTo(upper.getWorldPosition(new Vector3())),
    ).toBeLessThanOrEqual(0.62);
  });
});
