import { meters, metersPerSecond, vec3 } from '@series-inc/rundot-syncplay/physics/3d';
import { ELEVATOR, STORAGE_BOUNDS, elevatorPanelWithinReach, restackWithinReach, type AttractionState, type ElevatorFloor } from './attractions';
import { DT, PLAYER_RADIUS, PLAYER_HEIGHT, VOXEL_SIZE } from './constants';
import type { YardInput } from './input';
import { addPhysicsBodies, makePhysicsBody, physicsBodyById, physicsBodyHandle, removePhysicsBodies, type OpenYardPhysicsWorld } from './physics';
import type { PlayerState, YardBody } from './state';
import { createCrateSpawns, elevatorMotion } from './storage';

function intersectsBay(at: readonly [number, number, number], half: readonly [number, number, number]): boolean {
  return at.every((value, axis) => value + half[axis]! > STORAGE_BOUNDS.min[axis]! && value - half[axis]! < STORAGE_BOUNDS.max[axis]!);
}
export function storageBayOccupied(physics: OpenYardPhysicsWorld, bodies: readonly YardBody[], players: readonly PlayerState[]): boolean {
  if (players.some((p) => intersectsBay([p.x, p.y + PLAYER_HEIGHT / 2 - PLAYER_RADIUS, p.z], [PLAYER_RADIUS, PLAYER_HEIGHT / 2, PLAYER_RADIUS]))) return true;
  return bodies.some((body) => {
    if (body.storageBay === 'storage' || body.motion === 'fixed') return false;
    const pose = physicsBodyById(physics, body.id);
    if (!pose) return false;
    const half = Math.hypot(body.dims.x, body.dims.y, body.dims.z) * VOXEL_SIZE / 2;
    return intersectsBay([pose.x, pose.y, pose.z], [half, half, half]);
  });
}
export function applyAttractionRequests(physics: OpenYardPhysicsWorld, attractions: AttractionState, bodies: YardBody[], players: PlayerState[], inputs: readonly YardInput[], frame: number) {
  let next = attractions;
  let nextBodies = bodies;
  for (let slot = 0; slot < players.length; slot++) {
    const player = players[slot]!;
    const input = inputs[slot]!;
    if (input.attraction === 0 || player.lastAttractionRequest === input.attractionRequest) continue;
    players[slot] = { ...player, lastAttractionRequest: input.attractionRequest };
    const at = [player.x, player.y, player.z] as const;
    if (player.ridingVehicle) continue;
    if (input.attraction <= 4) {
      if (elevatorPanelWithinReach(at, next.elevator.y)) next = { ...next, elevator: { ...next.elevator, target: (input.attraction - 1) as ElevatorFloor } };
    } else if (restackWithinReach(at)) {
      if (storageBayOccupied(physics, nextBodies, players)) { next = { ...next, resetStatus: 'blocked' }; continue; }
      const owned = new Set(nextBodies.filter((body) => body.storageBay === 'storage').map((body) => body.id));
      removePhysicsBodies(physics, [...owned]);
      const crates = createCrateSpawns('storage');
      addPhysicsBodies(physics, crates.map((entry) => makePhysicsBody(entry.body, { position: entry.position, rotation: entry.rotation, linearVelocity: [0, 0, 0], angularVelocity: [0, 0, 0] })));
      nextBodies = [...nextBodies.filter((body) => !owned.has(body.id)), ...crates.map((entry) => entry.body)];
      for (let i = 0; i < players.length; i++) {
        const p = players[i]!;
        players[i] = { ...p, grab: p.grab && owned.has(p.grab.bodyId) ? null : p.grab, torch: p.torch && owned.has(p.torch.bodyId) ? null : p.torch };
      }
      next = { ...next, resetFrame: frame, resetStatus: 'ready' };
    }
  }
  return { attractions: next, bodies: nextBodies };
}
export function standingOnElevator(p: PlayerState, top: number): boolean {
  return !p.ridingVehicle && !p.jetpackActive && p.grounded && Math.abs(p.y - PLAYER_RADIUS - top) < 0.08
    && Math.abs(p.x - ELEVATOR.x) < ELEVATOR.size[0] / 2 && Math.abs(p.z - ELEVATOR.z) < ELEVATOR.size[2] / 2;
}
/** Stop before the platform can push a rider into a ceiling or a person below it. */
export function startElevatorStep(physics: OpenYardPhysicsWorld, state: AttractionState, players: readonly PlayerState[]): AttractionState {
  let elevator = elevatorMotion(state.elevator);
  const delta = elevator.velocity * DT;
  const handle = physicsBodyHandle(physics, ELEVATOR.id);
  const blocked = players.some((p) => {
    if (delta > 0 && standingOnElevator(p, elevator.y)) {
      return physics.world.shapeCast({ shape: { type: 'capsule', radius: meters(PLAYER_RADIUS), halfHeight: meters(PLAYER_HEIGHT / 2 - PLAYER_RADIUS) },
        x: meters(p.x), y: meters(p.y + PLAYER_HEIGHT / 2 - PLAYER_RADIUS), z: meters(p.z), dx: 0, dy: 1, dz: 0,
        maxDistance: meters(delta + 0.005), excludeBody: handle, maxPortalDepth: 0 }).some((hit) => hit.distance < delta);
    }
    return delta < 0 && Math.abs(p.x - ELEVATOR.x) < ELEVATOR.size[0] / 2 + PLAYER_RADIUS && Math.abs(p.z - ELEVATOR.z) < ELEVATOR.size[2] / 2 + PLAYER_RADIUS
      && p.y + PLAYER_HEIGHT - PLAYER_RADIUS > elevator.y - ELEVATOR.size[1] + delta - 0.02 && p.y < elevator.y - ELEVATOR.size[1] - 0.1;
  });
  if (blocked) elevator = { ...elevator, velocity: 0, status: 'blocked' };
  physics.world.setLinearVelocity(handle, vec3(metersPerSecond, 0, elevator.velocity, 0));
  return { ...state, elevator };
}
export function finishElevatorStep(physics: OpenYardPhysicsWorld, state: AttractionState, players: PlayerState[]): AttractionState {
  const body = physicsBodyById(physics, ELEVATOR.id);
  if (!body) throw new Error('WRECK_YARD_ELEVATOR_MISSING');
  const y = body.y + ELEVATOR.size[1] / 2;
  const delta = y - state.elevator.y;
  for (let slot = 0; slot < players.length; slot++) {
    const p = players[slot]!;
    if (standingOnElevator(p, state.elevator.y)) players[slot] = { ...p, y: p.y + delta, vy: 0, grounded: true };
  }
  return { ...state, elevator: { ...state.elevator, y } };
}
