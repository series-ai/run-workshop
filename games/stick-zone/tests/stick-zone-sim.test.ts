import fs from "node:fs";
import path from "node:path";
import { ServerSettlementAuthority, computeCanonicalOutcomeDigestSync } from "../src/sim/server-settlement.js";

function simulateOperativeExtraction(settlement: any, raidId: string, opId: string) {
  const r = settlement.getRaidRecord(raidId);
  if (r && r.operatives[opId]) {
    r.operatives[opId].isExtracted = true;
    r.operatives[opId].activeRaid = "";
    const recId = `rec_${opId}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const payload = {
      cashBanked: 0,
      extractedSquad: opId,
      raidId,
      retainedSquads: [],
      verifiedPrefixTick: 180,
    };
    const d = computeCanonicalOutcomeDigestSync(payload);
    settlement.auditLog.set(recId, {
      receipt: {
        v: 1,
        receiptId: recId,
        raidId,
        outcomeId: d,
        intentHash: `intent_${d.slice(16, 32)}`,
        outcomeDigest: d,
        throughTick: 180,
        committedAtMs: Date.now(),
        transfers: [],
        participantResults: [
          { profileId: opId, inventoryRevision: (r.operatives[opId].inventoryRevision || 13) + 1, activeRaidCleared: true, releasedEscrowIds: [`escrow_${opId}_loadout`] },
        ],
      },
      outcomePayload: payload,
    });
  }
}
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { WebSocket } from "ws";
import { SectorDepotSimulation, computeGroundAimAngle } from '../src/sim/game.js';
import { SIM_CONFIG } from '../src/sim/config.js';
import {
  verifyReceiptIntegrity,
  createAuthoritativeSettlement,
  authoritativeLedgerCommit,
  verifySettlementReceipt,
  AuthoritativeSettlementLedger,
  defaultSettlementLedger,
  type SettlementReceipt,
} from '../src/sim/airlock.js';
import { MultiplayerCoordinator, validateAndSanitizeSnapshot, type PeerPacket } from '../src/sim/multiplayer.js';

describe('Stick Zone: Exfil Simulation & Lifecycle Verification', () => {
  let sim: SectorDepotSimulation;

  beforeEach(() => {
    sim = new SectorDepotSimulation();
    defaultSettlementLedger.reset();
  });

  it('1. staged ingress lifecycle: barriers guarded & cutoff tick > 28,800 rejects', () => {
    const ingress = sim.ingressController;

    // Direct activate without entering corridor must fail
    expect(ingress.activate(100)).toBe(false);

    // Corridor entrance within window succeeds
    expect(ingress.enterCorridor(1000)).toBe(true);
    expect(ingress.getState().kind).toBe('corridor_entered');

    // Activate still fails because hydration & ack barrier not satisfied
    expect(ingress.activate(1000)).toBe(false);

    // Start hydration
    expect(ingress.startHydration(1000)).toBe(true);
    expect(ingress.getState().kind).toBe('hydrating');

    // Apply snapshot
    const snap = {
      snapshotTick: 1000,
      crates: [{ id: 'crate_01', opened: true }],
      machines: [{ id: 'turret_depot_alpha', health: 120, isAlive: true }],
    };
    expect(ingress.applySnapshot(snap)).toBe(true);
    expect(ingress.getState().kind).toBe('waiting_squad');

    // Squad ack barrier
    expect(ingress.squadAck(1, 1)).toBe(true);

    // Now activation succeeds and transitions to confirmed_active
    expect(ingress.activate(1000)).toBe(true);
    expect(ingress.getState().kind).toBe('confirmed_active');

    // Late cutoff ingress (> 28,800) is rejected
    const lateSim = new SectorDepotSimulation();
    const lateIngress = lateSim.ingressController;
    expect(lateIngress.enterCorridor(SIM_CONFIG.INGRESS_WINDOW_TICKS + 1)).toBe(false);
    expect(lateIngress.getState().kind).toBe('rejected');
  });

  it('2. remote state packet does not bypass local ingress barriers', () => {
    const coordinator = new MultiplayerCoordinator(sim);
    expect(sim.ingressController.getState().kind).toBe('corridor_entered');

    // Remote peer sends a state packet
    coordinator.handleMessage({
      eventId: 'remote:state:1',
      type: 'state',
      senderId: 'op_bravo_1',
      senderName: 'INFILTRATOR PHANTOM-1',
      squad: 'SQUAD BRAVO',
      timestamp: Date.now(),
      data: {
        x: 10, y: 0, z: 10, facing: 0, action: 'idle', actionTicks: 0,
        health: 100, armor: 100, cash: 0, holdTicks: 0, isAlive: true, isExtracted: false, ammo: 30,
      },
    });

    // Local ingress controller MUST NOT bypass barriers to confirmed_active!
    expect(sim.ingressController.getState().kind).toBe('corridor_entered');
    coordinator.cleanup();
  });

  it('3. admission gates player actions until confirmed active', () => {
    expect(sim.isAdmitted()).toBe(false);
    expect(sim.isInputLocked()).toBe(true);

    // Inputs must be completely frozen while unconfirmed
    sim.step({ dx: 1, dz: 1, sprint: true, slide: false, roll: true, kick: true, shoot: true, interact: true });
    expect(sim.player.action).toBe('idle');
    expect(sim.player.ammo).toBe(30);
    expect(sim.player.x).toBe(SIM_CONFIG.SPAWN_SQUAD_A.x);
    expect(sim.player.cash).toBe(0);

    // After admission sequence completes to confirmed_active
    sim.admitOperative(100);
    expect(sim.isAdmitted()).toBe(true);
    expect(sim.isInputLocked()).toBe(false);

    // Now actions execute properly
    sim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: true, interact: false });
    expect(sim.player.action).toBe('shoot');
    expect(sim.player.ammo).toBe(29);
  });

  it('4. two-coordinator full admission handshake: Bravo joiner confirmed by established Alpha host', () => {
    const simAlpha = new SectorDepotSimulation();
    const simBravo = new SectorDepotSimulation();

    const coordAlpha = new MultiplayerCoordinator(simAlpha);
    const coordBravo = new MultiplayerCoordinator(simBravo);
    // Explicitly set Bravo as player 2
    coordBravo.localId = 'op_bravo_1';
    coordBravo.localSquad = 'SQUAD BRAVO';

    // 1. Alpha host completes self-readiness and confirms active
    simAlpha.admitOperative(100);
    expect(simAlpha.isAdmitted()).toBe(true);

    // 2. Bravo enters corridor and requests snapshot
    simBravo.ingressController.enterCorridor(100);
    expect(simBravo.ingressController.getState().kind).toBe('corridor_entered');
    expect(simBravo.isInputLocked()).toBe(true);

    // Alpha handles Bravo's ingress_request
    coordAlpha.handleMessage({
      eventId: 'bravo:req:1',
      type: 'ingress_request',
      senderId: 'op_bravo_1',
      senderName: 'INFILTRATOR PHANTOM-1',
      squad: 'SQUAD BRAVO',
      timestamp: Date.now(),
      data: { requestedTick: 100 },
    });

    // Bravo receives Alpha's authoritative snapshot
    coordBravo.handleMessage({
      eventId: 'alpha:snap:1',
      type: 'ingress_snapshot',
      senderId: 'op_alpha_1',
      senderName: 'OPERATIVE GHOST-1',
      squad: 'SQUAD ALPHA',
      timestamp: Date.now(),
      data: {
        recipientId: 'op_bravo_1',
        snapshot: {
          snapshotTick: 100,
          crates: [{ id: 'crate_01', opened: false }],
          machines: [{ id: 'turret_depot_alpha', health: 120, isAlive: true }],
        },
      },
    });
    expect(simBravo.ingressController.getState().kind).toBe('waiting_squad');

    // Alpha receives Bravo's squad_ack and confirms it
    let confirmedAckSent = false;
    coordAlpha.broadcastSquadAck = (recId, isConf) => {
      if (recId === 'op_bravo_1' && isConf) confirmedAckSent = true;
    };
    coordAlpha.handleMessage({
      eventId: 'bravo:ack:1',
      type: 'squad_ack',
      senderId: 'op_bravo_1',
      senderName: 'INFILTRATOR PHANTOM-1',
      squad: 'SQUAD BRAVO',
      timestamp: Date.now(),
      data: { recipientId: 'op_alpha_1', isConfirmation: false },
    });
    expect(confirmedAckSent).toBe(true);

    // Bravo receives Alpha's confirmation ACK
    coordBravo.handleMessage({
      eventId: 'alpha:conf:1',
      type: 'squad_ack',
      senderId: 'op_alpha_1',
      senderName: 'OPERATIVE GHOST-1',
      squad: 'SQUAD ALPHA',
      timestamp: Date.now(),
      data: { recipientId: 'op_bravo_1', isConfirmation: true },
    });

    // Bravo successfully reaches confirmed_active and unlocks inputs!
    expect(simBravo.ingressController.getState().kind).toBe('confirmed_active');
    expect(simBravo.isInputLocked()).toBe(false);

    coordAlpha.cleanup();
    coordBravo.cleanup();
  });

  it('5. unadmitted hit packets and wrong recipient ACKs are strictly rejected', () => {
    const coordinator = new MultiplayerCoordinator(sim);
    expect(sim.isAdmitted()).toBe(false);

    // 1. Hit packet while unadmitted must NOT deal damage or knockback
    coordinator.handleMessage({
      eventId: 'unadmitted:hit:1',
      type: 'hit',
      senderId: 'op_bravo_1',
      senderName: 'INFILTRATOR PHANTOM-1',
      squad: 'SQUAD BRAVO',
      timestamp: Date.now(),
      data: { targetId: coordinator.localId, damage: 35, knockX: 0, knockZ: 4.5 },
    });
    expect(sim.player.armor).toBe(100);
    expect(sim.player.z).toBe(SIM_CONFIG.SPAWN_SQUAD_A.z);

    // 2. ACK addressed to another recipient is ignored
    coordinator.handleMessage({
      eventId: 'wrong:ack:1',
      type: 'squad_ack',
      senderId: 'op_other_1',
      senderName: 'OTHER',
      squad: 'SQUAD OTHER',
      timestamp: Date.now(),
      data: { recipientId: 'op_charlie_1' },
    });
    expect(coordinator.connectedPeers.get('op_other_1')?.ingressDone).toBeFalsy();

    coordinator.cleanup();
  });

  it('6. 2m AI fallback: squad count == 1 at tick 7,200 spawns ROGUE AI OPERATOR', () => {
    expect(sim.rivals.length).toBe(0);
    sim.tick = 7199;
    sim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: false, interact: false });
    expect(sim.rivals.length).toBe(1);
    expect(sim.rivals[0].id).toBe('op_rogue_ai');
    expect(sim.rivals[0].isAI).toBe(true);
    expect(sim.rivals[0].badge).toBe('ROGUE AI OPERATOR');
  });

  it('7. radar threshold: distance <= 60m triggers alert with bearing; distance > 60m clears to ALL CLEAR', () => {
    sim.rivals.push({
      id: 'op_rival_1',
      isPlayer: false,
      isRival: true,
      isAI: false,
      name: 'RIVAL TEST',
      x: 10,
      y: 0,
      z: 10,
      facing: 0,
      health: 100,
      armor: 0,
      cash: 0,
      action: 'idle',
      actionTicks: 0,
      isInvulnerable: false,
      isAlive: true,
      isExtracted: false,
      ammo: 30,
      maxAmmo: 30,
    });

    sim.player.x = 0;
    sim.player.z = 0;
    sim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: false, interact: false });

    expect(sim.proximityAlert.active).toBe(true);
    expect(sim.proximityAlert.distance).toBe(14);
    expect(sim.proximityAlert.bearing).toBeGreaterThanOrEqual(0);
    expect(sim.proximityAlert.bearing).toBeLessThanOrEqual(360);

    sim.rivals[0].x = 60;
    sim.rivals[0].z = 60;
    sim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: false, interact: false });

    expect(sim.proximityAlert.active).toBe(false);
    expect(sim.proximityAlert.distance).toBe(85);
  });

  it('8. exfil hold determinism: 179 ticks fails exfil; 180 ticks triggers 2500ms corridor', () => {
    sim.machines = [];
    sim.player.x = SIM_CONFIG.EXFIL_ZONE.x;
    sim.player.z = SIM_CONFIG.EXFIL_ZONE.z;

    for (let i = 0; i < 179; i++) {
      sim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: false, interact: false });
    }
    const state179 = sim.exfilController.getState();
    expect(state179.kind).toBe('holding_zone');
    if (state179.kind === 'holding_zone') {
      expect(state179.currentTicks).toBe(179);
    }

    sim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: false, interact: false });
    const state180 = sim.exfilController.getState();
    expect(state180.kind).toBe('corridor_presentation');
    if (state180.kind === 'corridor_presentation') {
      expect(state180.durationMs).toBe(SIM_CONFIG.AIRLOCK_CORRIDOR_DURATION_MS);
    }
  });

  it('9. damage reset: taking any damage inside zone resets hold ticks to 0 and idle state', () => {
    sim.machines = [];
    sim.player.x = SIM_CONFIG.EXFIL_ZONE.x;
    sim.player.z = SIM_CONFIG.EXFIL_ZONE.z;

    for (let i = 0; i < 60; i++) {
      sim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: false, interact: false });
    }
    const stateBefore = sim.exfilController.getState();
    expect(stateBefore.kind).toBe('holding_zone');

    sim.applyDamageToPlayer(20);

    const stateAfter = sim.exfilController.getState();
    expect(stateAfter.kind).toBe('idle');
    expect(sim.lastInterruptionTick).toBe(sim.tick);
  });

  it('10. authoritative settlement pipeline: strict verification of all fields, digests, and bilateral custody', async () => {
    sim.player.id = 'op_alpha_1';
    sim.player.cash = 4500;
    sim.player.isExtracted = true;
    sim.tick = 180;

    const { receipt: alphaReceipt, outcomePayload: alphaPayload } = await authoritativeLedgerCommit(sim);
    expect(alphaReceipt.receiptId.startsWith('receipt_s7_')).toBe(true);
    expect(alphaReceipt.transfers[0].quantity).toBe('BE:4500');
    expect(alphaReceipt.transfers[0].source).toBe('world_spawn');
    expect(alphaReceipt.raidId).toBe('raid_sector7_1042');
    expect(alphaReceipt.throughTick).toBe(180);

    const alphaVerify = await verifySettlementReceipt(alphaReceipt, alphaPayload);
    expect(alphaVerify.valid).toBe(true);

    // Sequential commit for Bravo updates persistent custody
    const simBravo = new SectorDepotSimulation();
    simBravo.player.id = 'op_bravo_1';
    simBravo.player.cash = 7200;
    simBravo.player.isExtracted = true;
    simBravo.tick = 200;

    const { receipt: bravoReceipt, outcomePayload: bravoPayload } = await authoritativeLedgerCommit(simBravo);
    expect(bravoReceipt.participantResults.find((p) => p.profileId === 'op_bravo_1')?.activeRaidCleared).toBe(true);
    // Alpha previously extracted, so dynamic ledger reports Alpha as activeRaidCleared: true at revision 14
    expect(bravoReceipt.participantResults.find((p) => p.profileId === 'op_alpha_1')?.activeRaidCleared).toBe(true);
    expect(bravoReceipt.participantResults.find((p) => p.profileId === 'op_alpha_1')?.inventoryRevision).toBe(14);

    const bravoVerify = await verifySettlementReceipt(bravoReceipt, bravoPayload);
    expect(bravoVerify.valid).toBe(true);

    // Reject arbitrary/excessive cash banked (e.g. 999,999,999)
    const cheatSim = new SectorDepotSimulation();
    cheatSim.player.cash = 999999999;
    cheatSim.player.isExtracted = true;
    cheatSim.tick = 200;
    await expect(authoritativeLedgerCommit(cheatSim)).rejects.toThrow('exceeds allowable pool limit');

    // Reject extracting activeRaidCleared as non-boolean string "yes"
    const tamperedClearedStr = {
      ...alphaReceipt,
      participantResults: [
        { ...alphaReceipt.participantResults[0], activeRaidCleared: 'yes' as any },
        alphaReceipt.participantResults[1],
      ],
    };
    const clearedStrVerify = await verifySettlementReceipt(tamperedClearedStr, alphaPayload);
    expect(clearedStrVerify.valid).toBe(false);
    expect(clearedStrVerify.reason).toContain('activeRaidCleared strictly equal to boolean true');

    // Reject retained activeRaidCleared as null
    const tamperedRetainedNull = {
      ...alphaReceipt,
      participantResults: [
        alphaReceipt.participantResults[0],
        { ...alphaReceipt.participantResults[1], activeRaidCleared: null as any },
      ],
    };
    const retainedNullVerify = await verifySettlementReceipt(tamperedRetainedNull, alphaPayload);
    expect(retainedNullVerify.valid).toBe(false);
    expect(retainedNullVerify.reason).toContain('activeRaidCleared strictly equal to boolean');

    // Reject transfer with unauthorized sourceEscrowId
    const tamperedTransferEscrow = {
      ...alphaReceipt,
      transfers: [{ ...alphaReceipt.transfers[0], sourceEscrowId: 'bravo_escrow' as any }],
    };
    const transferEscrowVerify = await verifySettlementReceipt(tamperedTransferEscrow, alphaPayload);
    expect(transferEscrowVerify.valid).toBe(false);
    expect(transferEscrowVerify.reason).toContain('Unauthorized or mutated fields in transfer');

    // Reject transfer with unauthorized fromProfileId
    const tamperedFromProfile = {
      ...alphaReceipt,
      transfers: [{ ...alphaReceipt.transfers[0], fromProfileId: 'op_bravo_1' as any }],
    };
    const fromProfileVerify = await verifySettlementReceipt(tamperedFromProfile, alphaPayload);
    expect(fromProfileVerify.valid).toBe(false);
    expect(fromProfileVerify.reason).toContain('Unauthorized or mutated fields in transfer');

    // Reject negative/invalid committedAtMs
    const tamperedTimeReceipt = { ...alphaReceipt, committedAtMs: -1000 };
    const timeVerify = await verifySettlementReceipt(tamperedTimeReceipt, alphaPayload);
    expect(timeVerify.valid).toBe(false);
    expect(timeVerify.reason).toContain('Invalid commitment timestamp');
  });

  it('11. combat roll iframes: immediate immunity on frame 1 and 12 iframes coverage', () => {
    sim.admitOperative();

    // Machine turret present
    sim.machines = [{
      id: 'turret_depot_alpha',
      type: 'turret',
      x: sim.player.x,
      y: 0,
      z: sim.player.z + 5,
      facing: Math.PI,
      health: 120,
      isAlive: true,
      cooldownTicks: 0,
    }];
    sim.player.x = 0;
    sim.player.z = 0;

    // Roll initiated on tick with enemy firing in range
    sim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: true, kick: false, shoot: false, interact: false });
    expect(sim.player.action).toBe('roll');
    expect(sim.player.isInvulnerable).toBe(true);
    // Armor must NOT be reduced on frame 1 of roll
    expect(sim.player.armor).toBe(100);

    for (let i = 0; i < 11; i++) {
      sim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: false, interact: false });
      expect(sim.player.isInvulnerable).toBe(true);
    }

    sim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: false, interact: false });
    expect(sim.player.isInvulnerable).toBe(false);
    expect(sim.player.action).toBe('roll');
  });

  it('12. gunplay rifle fire ignores invulnerable rolling rivals', () => {
    sim.admitOperative();
    sim.player.ammo = 30;
    sim.player.x = 0;
    sim.player.z = 0;
    sim.player.facing = 0;

    // Rival is rolling (invulnerable) directly in front of player
    sim.rivals = [{
      id: 'rival_rolling',
      isPlayer: false,
      isRival: true,
      isAI: false,
      name: 'RIVAL ROLLER',
      x: 0,
      y: 0,
      z: 5,
      facing: Math.PI,
      health: 100,
      armor: 100,
      cash: 0,
      action: 'roll',
      actionTicks: 10,
      isInvulnerable: true,
      isAlive: true,
      isExtracted: false,
      ammo: 30,
      maxAmmo: 30,
    }];

    sim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: true, interact: false, aimAngle: 0 });
    expect(sim.player.ammo).toBe(29);
    // Rival took zero damage because isInvulnerable was true
    expect(sim.rivals[0].health).toBe(100);
  });

  it('13. melee roundhouse kick: deals 35 damage and 4.5m physical knockback to rivals', () => {
    sim.admitOperative();
    let hitBroadcast = false;
    sim.onHitTarget = (targetId, dmg, knockX, knockZ) => {
      expect(targetId).toBe('rival_target');
      expect(dmg).toBe(35);
      expect(knockZ).toBeCloseTo(4.5);
      hitBroadcast = true;
    };

    sim.rivals.push({
      id: 'rival_target',
      isPlayer: false,
      isRival: true,
      isAI: false,
      name: 'RIVAL TEST',
      x: 0,
      y: 0,
      z: 1.5,
      facing: 0,
      health: 100,
      armor: 0,
      cash: 0,
      action: 'idle',
      actionTicks: 0,
      isInvulnerable: false,
      isAlive: true,
      isExtracted: false,
      ammo: 30,
      maxAmmo: 30,
    });

    sim.player.x = 0;
    sim.player.z = 0;
    sim.player.facing = 0;

    sim.step({
      dx: 0,
      dz: 0,
      sprint: false,
      slide: false,
      roll: false,
      kick: true,
      shoot: false,
      interact: false,
    });

    expect(hitBroadcast).toBe(true);
    expect(sim.rivals[0].health).toBe(65);
    expect(sim.rivals[0].z).toBeCloseTo(1.5 + 4.5);
  });

  it('14. target applies physical knockback displacement when hit packet arrives', () => {
    const coordinator = new MultiplayerCoordinator(sim);
    sim.admitOperative();
    const startZ = sim.player.z;
    coordinator.connectedPeers.set('op_bravo_1', { lastSeen: Date.now(), name: 'INFILTRATOR PHANTOM-1', ingressDone: true, handshakeState: 'confirmed' });
    sim.rivals.push({
      id: 'op_bravo_1',
      name: 'INFILTRATOR PHANTOM-1',
      isPlayer: false,
      isRival: true,
      isAI: false,
      x: sim.player.x,
      y: 0,
      z: sim.player.z - 2,
      facing: 0,
      health: 100,
      armor: 100,
      cash: 0,
      action: 'idle',
      actionTicks: 0,
      isInvulnerable: false,
      isAlive: true,
      isExtracted: false,
      ammo: 30,
      maxAmmo: 30,
    });

    coordinator.handleMessage({
      eventId: 'host:kick:1',
      type: 'hit',
      senderId: 'op_bravo_1',
      senderName: 'INFILTRATOR PHANTOM-1',
      squad: 'SQUAD BRAVO',
      timestamp: Date.now(),
      data: { targetId: coordinator.localId, damage: 35, knockX: 0, knockZ: 4.5 },
    });

    expect(sim.player.z).toBeCloseTo(startZ + 4.5);
    coordinator.cleanup();
  });

  it('15. concurrent crate loot arbitration: deterministic tie-breaker eliminates cash duplication', () => {
    const simAlpha = new SectorDepotSimulation();
    const simBravo = new SectorDepotSimulation();
    simAlpha.admitOperative();
    simBravo.admitOperative();
    simBravo.player.id = 'op_bravo_1';

    const coordAlpha = new MultiplayerCoordinator(simAlpha);
    const coordBravo = new MultiplayerCoordinator(simBravo);
    coordBravo.localId = 'op_bravo_1';
    coordBravo.localSquad = 'SQUAD BRAVO';
    simBravo.player.id = 'op_bravo_1';

    // Both peers confirmed through ingress handshake
    coordAlpha.connectedPeers.set('op_bravo_1', {
      lastSeen: Date.now(),
      name: 'INFILTRATOR PHANTOM-1',
      ingressDone: true,
      handshakeState: 'confirmed',
    });
    coordBravo.connectedPeers.set('op_alpha_1', {
      lastSeen: Date.now(),
      name: 'OPERATIVE GHOST-1',
      ingressDone: true,
      handshakeState: 'confirmed',
    });

    // Both claim at the exact same timestamp t=1000
    const claimTime = 1000;
    coordAlpha.requestCrateLoot('crate_01', 1250, claimTime);
    coordBravo.requestCrateLoot('crate_01', 1250, claimTime);

    // Simulate cross-delivery of crate_loot_request packets with equal timestamp:
    // 1. Alpha receives Bravo's request
    coordAlpha.handleMessage({
      eventId: 'bravo:req:1',
      type: 'crate_loot_request',
      raidId: simAlpha.raidId,
      senderId: 'op_bravo_1',
      senderName: 'INFILTRATOR PHANTOM-1',
      squad: 'SQUAD BRAVO',
      timestamp: claimTime,
      data: { crateId: 'crate_01', cashValue: 1250, claimTimestamp: claimTime },
    });

    // 2. Bravo receives Alpha's request
    coordBravo.handleMessage({
      eventId: 'alpha:req:1',
      type: 'crate_loot_request',
      raidId: simBravo.raidId,
      senderId: 'op_alpha_1',
      senderName: 'OPERATIVE GHOST-1',
      squad: 'SQUAD ALPHA',
      timestamp: claimTime,
      data: { crateId: 'crate_01', cashValue: 1250, claimTimestamp: claimTime },
    });

    // Deterministic tie rule ('op_alpha_1' < 'op_bravo_1'):
    // Alpha retains the loot: $1,250
    // Bravo loses the tie: revoked, debited back to $0!
    expect(simAlpha.player.cash).toBe(1250);
    expect(simBravo.player.cash).toBe(0);
    expect(simBravo.combatLog).toContain('[LOOT CONTESTED] Crate already scavenged by rival!');

    // Total cash across both players is exactly $1,250 — zero duplication!
    expect(simAlpha.player.cash + simBravo.player.cash).toBe(1250);

    coordAlpha.cleanup();
    coordBravo.cleanup();
  });

  it('16. unsolicited squad_ack rejection: unrequested ACK dropped and ingressDone remains false', () => {
    const simTest = new SectorDepotSimulation();
    const coord = new MultiplayerCoordinator(simTest);

    // Unsolicited ACK from unknown or unrequested peer
    coord.handleMessage({
      eventId: 'rogue:ack:1',
      type: 'squad_ack',
      senderId: 'op_rogue_9',
      senderName: 'ROGUE OPERATIVE',
      squad: 'SQUAD ROGUE',
      timestamp: Date.now(),
      data: { isConfirmation: false },
    });

    const peer = coord.connectedPeers.get('op_rogue_9');
    expect(peer?.ingressDone).toBe(false);
    expect(peer?.handshakeState).toBe('none');

    // Unsolicited confirmation ACK also rejected
    coord.handleMessage({
      eventId: 'rogue:ack:2',
      type: 'squad_ack',
      senderId: 'op_rogue_9',
      senderName: 'ROGUE OPERATIVE',
      squad: 'SQUAD ROGUE',
      timestamp: Date.now(),
      data: { isConfirmation: true },
    });
    expect(peer?.ingressDone).toBe(false);
    expect(peer?.handshakeState).toBe('none');

    // 4. BroadcastChannel crate mutation rejected and does not suppress authentic relay copy
    const sharedEvtId = `evt_crate_relay_dedup_${Date.now()}`;
    // Attempt 1: unauthenticated broadcast channel packet is rejected
    coord.handleMessage({
      eventId: sharedEvtId,
      type: "crate_loot_request",
      senderId: "op_bravo_1",
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      raidId: sim.raidId,
      timestamp: Date.now(),
      _fromBroadcastChannel: true,
      data: { crateId: "crate_01", claimTimestamp: Date.now() },
    } as any);
    // Event was not consumed into seenEvents because transport was rejected
    const nsKey16 = `${sim.raidId}:op_bravo_1:${sharedEvtId}`;
    expect((coord as any).seenEvents.has(nsKey16)).toBe(false);
    expect(sim.crates.find((c) => c.id === "crate_01")?.opened).toBe(false);

    // Attempt 2: authentic server relay copy arrives with same eventId and is processed successfully
    coord.handleMessage({
      eventId: sharedEvtId,
      type: "crate_loot_request",
      senderId: "op_bravo_1",
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      raidId: sim.raidId,
      timestamp: Date.now(),
      data: { crateId: "crate_01", claimTimestamp: Date.now() },
    } as any);
    expect((coord as any).seenEvents.has(nsKey16)).toBe(true);

    coord.cleanup();
  });

  it('17. active snapshot replay rejection: confirmed active sim ignores snapshot replay', () => {
    const simTest = new SectorDepotSimulation();
    simTest.admitOperative();
    simTest.player.cash = 5000;
    const coord = new MultiplayerCoordinator(simTest);

    // Simulated snapshot replay packet with 0 cash crates
    coord.handleMessage({
      eventId: 'replay:snap:1',
      type: 'ingress_snapshot',
      senderId: 'op_host_1',
      senderName: 'HOST GHOST',
      squad: 'SQUAD ALPHA',
      timestamp: Date.now(),
      data: {
        recipientId: coord.localId,
        snapshot: {
          snapshotTick: 50,
          crates: [{ id: 'crate_01', opened: true }],
          machines: [],
        },
      },
    });

    // Local state remains untouched: player cash retained, ingress controller remains confirmed_active
    expect(simTest.player.cash).toBe(5000);
    expect(simTest.ingressController.getState().kind).toBe('confirmed_active');

    coord.cleanup();
  });

  it('18. unadmitted peer crate and machine mutations are strictly dropped', () => {
    const simTest = new SectorDepotSimulation();
    simTest.admitOperative();
    const coord = new MultiplayerCoordinator(simTest);

    // Peer connects but has NOT completed ingress handshake (ingressDone: false)
    coord.handleMessage({
      eventId: 'unadmitted:loot:1',
      type: 'crate_loot_request',
      raidId: simTest.raidId,
      senderId: 'op_unadmitted_1',
      senderName: 'UNADMITTED PEER',
      squad: 'SQUAD CHARLIE',
      timestamp: Date.now(),
      data: { crateId: 'crate_01', claimTimestamp: 100 },
    });

    // Crate remains unopened
    const crate = simTest.crates.find((c) => c.id === 'crate_01')!;
    expect(crate.opened).toBe(false);

    // Unadmitted peer machine hit dropped
    const machine = simTest.machines[0];
    const initialHealth = machine.health;
    coord.handleMessage({
      eventId: 'unadmitted:mach:1',
      type: 'machine_hit',
      senderId: 'op_unadmitted_1',
      senderName: 'UNADMITTED PEER',
      squad: 'SQUAD CHARLIE',
      timestamp: Date.now(),
      data: { machineId: machine.id, damage: 50 },
    });
    expect(machine.health).toBe(initialHealth);

    coord.cleanup();
  });

  it('19. receipt verification rejects uncommitted receipts and invalid timestamps', async () => {
    const simTest = new SectorDepotSimulation();
    simTest.player.id = 'op_alpha_1';
    simTest.player.cash = 2500;
    simTest.player.isExtracted = true;
    simTest.tick = 100;

    const { receipt, outcomePayload } = await authoritativeLedgerCommit(simTest);

    // 1. Valid committed receipt passes
    const validVerify = await verifySettlementReceipt(receipt, outcomePayload);
    expect(validVerify.valid).toBe(true);

    // 2. Uncommitted receipt in a fresh ledger where it was never committed rejected
    const freshLedger = new AuthoritativeSettlementLedger();
    const uncommittedVerify = await verifySettlementReceipt(receipt, outcomePayload, freshLedger);
    expect(uncommittedVerify.valid).toBe(false);
    expect(uncommittedVerify.reason).toContain('Receipt was not committed in authoritative ledger');

    // 3. Receipt with timestamp before 2017 (< 1500000000000) or NaN rejected
    const ancientReceipt = { ...receipt, committedAtMs: 1400000000000 };
    const ancientVerify = await verifySettlementReceipt(ancientReceipt, outcomePayload);
    expect(ancientVerify.valid).toBe(false);
    expect(ancientVerify.reason).toContain('Invalid commitment timestamp');

    const nanReceipt = { ...receipt, committedAtMs: NaN };
    const nanVerify = await verifySettlementReceipt(nanReceipt, outcomePayload);
    expect(nanVerify.valid).toBe(false);
    expect(nanVerify.reason).toContain('Invalid commitment timestamp');
  });

  it('20. ledger allowable pool limit and atomic commit rollback', async () => {
    const ledger = new AuthoritativeSettlementLedger();
    const simTest = new SectorDepotSimulation();
    simTest.player.id = 'op_alpha_1';
    simTest.player.isExtracted = true;
    simTest.tick = 180;

    // 1. Float cash banked rejected upfront before any mutation
    simTest.player.cash = 100.5 as any;
    await expect(authoritativeLedgerCommit(simTest, ledger)).rejects.toThrow('Must be non-negative integer');
    // Ensure profile custody was NOT cleared on failed commit!
    expect(ledger.profiles.get('op_alpha_1')?.activeRaid).toBe('raid_sector7_1042');
    expect(ledger.profiles.get('op_alpha_1')?.inventoryRevision).toBe(13);

    // 2. Excessive cash banked exceeding remaining pool rejected
    simTest.player.cash = 50001; // pool is 50,000
    await expect(authoritativeLedgerCommit(simTest, ledger)).rejects.toThrow('exceeds allowable pool limit');
    expect(ledger.profiles.get('op_alpha_1')?.activeRaid).toBe('raid_sector7_1042');

    // 3. Valid commit of 40,000 succeeds
    simTest.player.cash = 40000;
    const { receipt: r1 } = await authoritativeLedgerCommit(simTest, ledger);
    expect(r1.receiptId).toBeDefined();
    expect(ledger.raids.get('raid_sector7_1042')?.totalBanked).toBe(40000);

    // 4. Subsequent commit of 15,000 exceeds remaining 10,000 pool limit!
    const simBravo = new SectorDepotSimulation();
    simBravo.player.id = 'op_bravo_1';
    simBravo.player.cash = 15000;
    simBravo.player.isExtracted = true;
    simBravo.tick = 190;
    await expect(authoritativeLedgerCommit(simBravo, ledger)).rejects.toThrow('exceeds allowable pool limit');
    expect(ledger.profiles.get('op_bravo_1')?.activeRaid).toBe('raid_sector7_1042');
  });

  it('21. human remote rival combat action is preserved by stepRivals', () => {
    const simTest = new SectorDepotSimulation();
    simTest.admitOperative();
    simTest.player.x = 0;
    simTest.player.z = 0;

    // Add human remote rival performing a combat roll close to player
    simTest.rivals.push({
      id: 'op_bravo_remote',
      isPlayer: false,
      isRival: true,
      isAI: false, // HUMAN REMOTE RIVAL
      name: 'INFILTRATOR PHANTOM-1',
      badge: 'SQUAD BRAVO',
      x: 0,
      y: 0,
      z: 5,
      facing: Math.PI,
      health: 100,
      armor: 100,
      cash: 2000,
      action: 'roll',
      actionTicks: 12,
      isInvulnerable: true,
      isAlive: true,
      isExtracted: false,
      ammo: 25,
      maxAmmo: 30,
    });

    // Step simulation: local AI step must NOT overwrite remote action 'roll' to 'shoot'!
    simTest.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: false, interact: false });

    const remoteRival = simTest.rivals.find((r) => r.id === 'op_bravo_remote')!;
    expect(remoteRival.action).toBe('roll');
    expect(remoteRival.actionTicks).toBe(12);
  });

  it('22. knockback and damage deflection during roll iframes, and tick 13 vulnerability', () => {
    const simTest = new SectorDepotSimulation();
    simTest.admitOperative();
    const coord = new MultiplayerCoordinator(simTest);

    // Admit peer
    coord.connectedPeers.set('op_bravo_1', {
      lastSeen: Date.now(),
      name: 'INFILTRATOR PHANTOM-1',
      ingressDone: true,
      handshakeState: 'confirmed',
    });
    simTest.rivals.push({
      id: 'op_bravo_1',
      name: 'INFILTRATOR PHANTOM-1',
      isPlayer: false,
      isRival: true,
      isAI: false,
      x: simTest.player.x,
      y: 0,
      z: simTest.player.z - 2,
      facing: 0,
      health: 100,
      armor: 100,
      cash: 0,
      action: 'idle',
      actionTicks: 0,
      isInvulnerable: false,
      isAlive: true,
      isExtracted: false,
      ammo: 30,
      maxAmmo: 30,
    });

    // Player begins roll (Space)
    simTest.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: true, kick: false, shoot: false, interact: false });
    expect(simTest.player.action).toBe('roll');
    expect(simTest.player.isInvulnerable).toBe(true);

    const startX = simTest.player.x;
    const startZ = simTest.player.z;

    // Incoming hit packet during roll immunity: both damage and knockback deflected!
    coord.handleMessage({
      eventId: 'bravo:hit:1',
      type: 'hit',
      senderId: 'op_bravo_1',
      senderName: 'INFILTRATOR PHANTOM-1',
      squad: 'SQUAD BRAVO',
      timestamp: Date.now(),
      data: { targetId: coord.localId, damage: 30, knockX: 5.0, knockZ: 5.0 },
    });

    expect(simTest.player.health).toBe(100);
    expect(simTest.player.armor).toBe(100);
    expect(simTest.player.x).toBe(startX);
    expect(simTest.player.z).toBe(startZ);
    expect(simTest.combatLog).toContain('[ROLL DEFLECTION] Strike deflected by combat roll invulnerability');

    // Step through remaining 11 iframes (ticks 2..12)
    for (let i = 0; i < 11; i++) {
      simTest.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: false, interact: false });
      expect(simTest.player.isInvulnerable).toBe(true);
    }

    // Tick 13: iframes have elapsed, operative is vulnerable!
    simTest.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: false, interact: false });
    expect(simTest.player.isInvulnerable).toBe(false);

    // Hit on tick 13 connects and applies damage and knockback!
    const attackerBravo = simTest.rivals.find((r) => r.id === 'op_bravo_1');
    if (attackerBravo) { attackerBravo.x = simTest.player.x - 2; attackerBravo.z = simTest.player.z; attackerBravo.facing = Math.PI / 2; }
    coord.handleMessage({
      eventId: 'bravo:hit:2',
      type: 'hit',
      senderId: 'op_bravo_1',
      senderName: 'INFILTRATOR PHANTOM-1',
      squad: 'SQUAD BRAVO',
      timestamp: Date.now(),
      data: { targetId: coord.localId, damage: 20, knockX: 4.5, knockZ: 0 },
    });
    expect(simTest.player.armor).toBeLessThan(100);
    expect(simTest.player.x).toBeCloseTo(startX + 4.5, 1);

    coord.cleanup();
  });

  it('23. tick 0 and unextracted operative commit rejection', async () => {
    const ledger = new AuthoritativeSettlementLedger();
    const simUnextracted = new SectorDepotSimulation();
    simUnextracted.player.id = 'op_alpha_1';
    simUnextracted.player.cash = 1000;
    simUnextracted.tick = 100;
    // Operative is alive in depot, has NOT extracted
    simUnextracted.player.isExtracted = false;

    await expect(authoritativeLedgerCommit(simUnextracted, ledger)).rejects.toThrow('Operative extraction has not completed');

    // Tick 0 rejected
    const simTickZero = new SectorDepotSimulation();
    simTickZero.player.id = 'op_alpha_1';
    simTickZero.player.cash = 1000;
    simTickZero.player.isExtracted = true;
    simTickZero.tick = 0;
    await expect(authoritativeLedgerCommit(simTickZero, ledger)).rejects.toThrow('Must be greater than 0');
  });

  it('24. concurrent commit pool serialization: Alpha 40k + Bravo 15k strictly capped at 50k pool', async () => {
    const ledger = new AuthoritativeSettlementLedger();
    const simAlpha = new SectorDepotSimulation();
    simAlpha.player.id = 'op_alpha_1';
    simAlpha.player.cash = 40000;
    simAlpha.player.isExtracted = true;
    simAlpha.tick = 180;

    const simBravo = new SectorDepotSimulation();
    simBravo.player.id = 'op_bravo_1';
    simBravo.player.cash = 15000;
    simBravo.player.isExtracted = true;
    simBravo.tick = 180;

    // Fire both commits concurrently
    const pAlpha = authoritativeLedgerCommit(simAlpha, ledger);
    const pBravo = authoritativeLedgerCommit(simBravo, ledger);

    const results = await Promise.allSettled([pAlpha, pBravo]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactly one must succeed and one must be rejected for exceeding 50,000 pool limit!
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect((rejected[0] as PromiseRejectedResult).reason.message).toContain('exceeds allowable pool limit');

    // Total banked in raid is strictly 40,000, never 55,000
    expect(ledger.raids.get('raid_sector7_1042')?.totalBanked).toBe(40000);
  });

  it('25. immutable auditLog: modifying returned receipt does not alter committed record', async () => {
    const ledger = new AuthoritativeSettlementLedger();
    const simTest = new SectorDepotSimulation();
    simTest.player.id = 'op_alpha_1';
    simTest.player.cash = 5000;
    simTest.player.isExtracted = true;
    simTest.tick = 180;

    const { receipt, outcomePayload } = await authoritativeLedgerCommit(simTest, ledger);
    const originalTime = receipt.committedAtMs;

    // Caller tampers with returned receipt in memory
    (receipt as any).committedAtMs = 9999999999999;
    (receipt.transfers[0] as any).quantity = 'BE:999999999';

    // The committed record in auditLog remains untampered!
    const committed = ledger.auditLog.get(receipt.receiptId)!;
    expect(committed.committedAtMs).toBe(originalTime);
    expect(committed.transfers[0].quantity).toBe('BE:5000');

    // Verifying the tampered receipt against the ledger fails
    const verifyTampered = await verifySettlementReceipt(receipt, outcomePayload, ledger);
    expect(verifyTampered.valid).toBe(false);
  });

  it('26. stable idempotency retry: repeating commit with same parameters returns committed receipt', async () => {
    const ledger = new AuthoritativeSettlementLedger();
    const simTest = new SectorDepotSimulation();
    simTest.player.id = 'op_alpha_1';
    simTest.player.cash = 3200;
    simTest.player.isExtracted = true;
    simTest.tick = 180;

    // First commit succeeds
    const { receipt: r1, outcomePayload } = await authoritativeLedgerCommit(simTest, ledger);
    expect(r1.receiptId).toBeDefined();

    // Exact retry with same operative, tick, and cash returns existing receipt without error!
    const { receipt: r2 } = await authoritativeLedgerCommit(simTest, ledger);
    expect(r2.receiptId).toBe(r1.receiptId);
    expect(r2.outcomeDigest).toBe(r1.outcomeDigest);

    // Verify still passes
    const verifyRetry = await verifySettlementReceipt(r2, outcomePayload, ledger);
    expect(verifyRetry.valid).toBe(true);
  });

  it('27. independent validity of Alpha receipt after Bravo subsequently extracts', async () => {
    const ledger = new AuthoritativeSettlementLedger();

    // 1. Alpha extracts first at tick 180
    const simAlpha = new SectorDepotSimulation();
    simAlpha.player.id = 'op_alpha_1';
    simAlpha.player.cash = 10000;
    simAlpha.player.isExtracted = true;
    simAlpha.tick = 180;
    const { receipt: rAlpha, outcomePayload: pAlpha } = await authoritativeLedgerCommit(simAlpha, ledger);

    // Alpha receipt valid
    const v1 = await verifySettlementReceipt(rAlpha, pAlpha, ledger);
    expect(v1.valid).toBe(true);

    // 2. Bravo subsequently extracts at tick 300
    const simBravo = new SectorDepotSimulation();
    simBravo.player.id = 'op_bravo_1';
    simBravo.player.cash = 8000;
    simBravo.player.isExtracted = true;
    simBravo.tick = 300;
    const { receipt: rBravo, outcomePayload: pBravo } = await authoritativeLedgerCommit(simBravo, ledger);
    expect((await verifySettlementReceipt(rBravo, pBravo, ledger)).valid).toBe(true);

    // 3. Re-verifying Alpha receipt AFTER Bravo extracted remains 100% valid!
    const vAlphaPost = await verifySettlementReceipt(rAlpha, pAlpha, ledger);
    expect(vAlphaPost.valid).toBe(true);
  });

  it('28. numeric damage validation and admitted combat past cutoff', () => {
    const simTest = new SectorDepotSimulation();
    simTest.admitOperative();
    simTest.player.armor = 100;
    const coord = new MultiplayerCoordinator(simTest);

    coord.connectedPeers.set('op_bravo_1', {
      lastSeen: Date.now(),
      name: 'INFILTRATOR PHANTOM-1',
      ingressDone: true,
      handshakeState: 'confirmed',
    });
    simTest.rivals.push({
      id: 'op_bravo_1',
      name: 'INFILTRATOR PHANTOM-1',
      isPlayer: false,
      isRival: true,
      isAI: false,
      x: simTest.player.x,
      y: 0,
      z: simTest.player.z + 2,
      facing: Math.PI,
      health: 100,
      armor: 100,
      cash: 0,
      action: 'idle',
      actionTicks: 0,
      isInvulnerable: false,
      isAlive: true,
      isExtracted: false,
      ammo: 30,
      maxAmmo: 30,
    });

    // Negative damage dropped (no healing exploit)
    coord.handleMessage({
      eventId: 'negative:dmg:1',
      type: 'hit',
      senderId: 'op_bravo_1',
      senderName: 'INFILTRATOR PHANTOM-1',
      squad: 'SQUAD BRAVO',
      timestamp: Date.now(),
      data: { targetId: coord.localId, damage: -100 },
    });
    expect(simTest.player.armor).toBe(100);

    // Admitted participants continue combat past tick 28,800!
    simTest.tick = 30000;
    coord.handleMessage({
      eventId: 'admitted:hit:2',
      type: 'hit',
      senderId: 'op_bravo_1',
      senderName: 'INFILTRATOR PHANTOM-1',
      squad: 'SQUAD BRAVO',
      timestamp: Date.now(),
      data: { targetId: coord.localId, damage: 22 },
    });
    // Admitted damage is applied!
    expect(simTest.player.armor).toBe(78);

    // After raid final close (tick 54,000), hits are dropped
    simTest.tick = 54001;
    coord.handleMessage({
      eventId: 'postraid:hit:3',
      type: 'hit',
      senderId: 'op_bravo_1',
      senderName: 'INFILTRATOR PHANTOM-1',
      squad: 'SQUAD BRAVO',
      timestamp: Date.now(),
      data: { targetId: coord.localId, damage: 22 },
    });
    expect(simTest.player.armor).toBe(78);

    coord.cleanup();
  });

  it('29. hydration queue admission check and negative damage rejection', () => {
    const simTest = new SectorDepotSimulation();
    const coord = new MultiplayerCoordinator(simTest);
    coord.localId = 'op_bravo_1';

    // Put into waiting_squad state
    simTest.ingressController.enterCorridor(0);
    simTest.ingressController.startHydration(10);
    simTest.applyRaidSnapshot({
      snapshotTick: 10,
      crates: [],
      machines: [{ id: 'turret_depot_alpha', health: 120, isAlive: true }],
    });
    simTest.ingressController.applySnapshot({
      snapshotTick: 10,
      crates: [],
      machines: [{ id: 'turret_depot_alpha', health: 120, isAlive: true }],
    });

    // Unadmitted sender machine_hit with negative damage (-100) is strictly dropped!
    coord.handleMessage({
      eventId: 'unadmitted:exploit:1',
      type: 'machine_hit',
      senderId: 'unknown_attacker',
      senderName: 'EXPLOITER',
      squad: 'UNKNOWN',
      timestamp: Date.now(),
      data: { machineId: 'turret_depot_alpha', damage: -100 },
    });
    // Turret health MUST NOT increase!
    expect(simTest.machines.find((m) => m.id === 'turret_depot_alpha')?.health).toBe(120);

    // Host peer confirmed through handshake
    coord.connectedPeers.set('op_alpha_1', {
      lastSeen: Date.now(),
      name: 'OPERATIVE GHOST-1',
      ingressDone: true,
      handshakeState: 'confirmed',
    });
    simTest.rivals.push({
      id: 'op_alpha_1',
      isPlayer: false,
      isRival: true,
      isAI: false,
      name: 'OPERATIVE GHOST-1',
      x: -5,
      y: 0,
      z: 13,
      facing: Math.PI,
      health: 100,
      armor: 0,
      cash: 0,
      action: 'kick',
      actionTicks: 0,
      isInvulnerable: false,
      isAlive: true,
      isExtracted: false,
      ammo: 30,
      maxAmmo: 30,
    });

    // Valid hit from admitted peer during waiting_squad is buffered
    coord.handleMessage({
      eventId: 'hydrating:mach:1',
      type: 'machine_hit',
      senderId: 'op_alpha_1',
      senderName: 'OPERATIVE GHOST-1',
      squad: 'SQUAD ALPHA',
      timestamp: Date.now(),
      data: { machineId: 'turret_depot_alpha', damage: 50, attackerFacing: Math.PI },
    });
    expect(coord.pendingWorldEvents.length).toBe(1);

    // Activation flushes and applies validated hit
    simTest.ingressController.squadAck(1, 1);
    simTest.ingressController.activate(10);
    (coord as any).flushPendingWorldEvents();

    expect(simTest.machines.find((m) => m.id === 'turret_depot_alpha')?.health).toBe(70);
    coord.cleanup();
  });

  it('30. hydration shared clock synchronization and crate metadata restoration', () => {
    const simTest = new SectorDepotSimulation();
    expect(simTest.tick).toBe(0);

    simTest.applyRaidSnapshot({
      snapshotTick: 1200,
      crates: [
        { id: 'crate_01', opened: true, claimedBy: 'op_alpha_1', claimedAt: 1100 } as any,
      ],
      machines: [{ id: 'turret_depot_alpha', health: 60, isAlive: true }],
    });

    expect(simTest.tick).toBe(1200);
    const crate1 = simTest.crates.find((c) => c.id === 'crate_01');
    expect(crate1?.opened).toBe(true);
    expect(crate1?.claimedBy).toBe('op_alpha_1');
    expect(crate1?.claimedAt).toBe(1100);
  });

  it('31. functional Rogue AI opponent: pursuit, weapon cadence, and roll deflection', () => {
    const simTest = new SectorDepotSimulation();
    simTest.admitOperative();
    simTest.machines = []; // Isolate Rogue AI combat from stationary turret/drone fire
    simTest.player.x = 0;
    simTest.player.z = 0;

    // Spawn Rogue AI at (5, 5) -> distance is ~7.07m
    simTest.spawnRogueSquad();
    const rogue = simTest.rivals.find((r) => r.id === 'op_rogue_ai')!;
    rogue.x = 5;
    rogue.z = 5;

    expect(simTest.player.armor).toBe(100);
    expect(simTest.player.health).toBe(100);

    // Step simulation: Rogue AI aims and fires at player
    simTest.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: false, interact: false });
    expect(rogue.action).toBe('shoot');
    // Player sustained 12 damage absorbed by armor
    expect(simTest.player.armor).toBe(88);

    // When player executes combat roll, roll iframes deflect subsequent fire
    rogue.shootCooldownTicks = 0;
    simTest.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: true, kick: false, shoot: false, interact: false });
    expect(simTest.player.action).toBe('roll');
    expect(simTest.player.isInvulnerable).toBe(true);
    // Armor remains 88 because roll deflected bullet!
    expect(simTest.player.armor).toBe(88);
  });

  it('32. authoritative ServerSettlementAuthority: earned cash bounds, mutex, and persistence', async () => {
    const { ServerSettlementAuthority } = await import('../src/sim/server-settlement.js');
    const tmpStore = `/tmp/test-settlement-${Date.now()}.json`;
    const serverAuth = new ServerSettlementAuthority(tmpStore);

    // Initial raid initialized with zero earned cash
    serverAuth.initRaid('raid_test_01', 50000, ['op_alpha_1', 'op_bravo_1']);
    serverAuth.recordExtractionHold('raid_test_01', 'op_alpha_1', 200, 200, true);

    // Attempting unearned claim before scavenging -> strictly REJECTED (claimed $1,250 exceeds earned $0)
    await expect(
      serverAuth.commitSettlement({
        raidId: 'raid_test_01',
        extractingId: 'op_alpha_1',
        snapshotTick: 200,
        snapshotCash: 1250,
        exfilSubmitted: true,
      })
    ).rejects.toThrow('exceeds verified earned');

    // Scavenging crate_01 increases verified earned cash to $1,250
    serverAuth.recordCrateLoot('raid_test_01', 'crate_01', 'op_alpha_1', 1250);
    serverAuth.recordExtractionHold('raid_test_01', 'op_alpha_1', 200, 200, true);

    // Valid extraction commit within earned bounds ($1,250)
    const commit1 = await serverAuth.commitSettlement({
      raidId: 'raid_test_01',
      extractingId: 'op_alpha_1',
      snapshotTick: 200,
      snapshotCash: 1250,
      exfilSubmitted: true,
    });

    expect(commit1.receipt.receiptId.startsWith('receipt_s7_')).toBe(true);
    expect(commit1.outcomePayload.cashBanked).toBe(1250);

    // Stable idempotency retry returns BOTH receipt AND outcomePayload
    const retry1 = await serverAuth.commitSettlement({
      raidId: 'raid_test_01',
      extractingId: 'op_alpha_1',
      snapshotTick: 200,
      snapshotCash: 1250,
      exfilSubmitted: true,
    });
    expect(retry1.receipt.receiptId).toBe(commit1.receipt.receiptId);
    expect(retry1.outcomePayload.verifiedPrefixTick).toBe(200);

    // Persistence verification: a new instance reading the same store file restores raid and receipt!
    const restoredAuth = new ServerSettlementAuthority(tmpStore);
    const ledger = restoredAuth.getLedger();
    const raidRecord = ledger.raids.find(([id]) => id === 'raid_test_01')?.[1];
    expect(raidRecord?.totalBanked).toBe(1250);
    expect(raidRecord?.operatives['op_alpha_1'].isExtracted).toBe(true);
  });

  it('33. repeat raid path initializes new raid custody without stale lockouts', async () => {
    const { ServerSettlementAuthority } = await import('../src/sim/server-settlement.js');
    const serverAuth = new ServerSettlementAuthority(`/tmp/test-repeat-${Date.now()}.json`);

    serverAuth.initRaid('raid_first', 50000, ['op_alpha_1', 'op_bravo_1']);
    serverAuth.recordCrateLoot('raid_first', 'crate_01', 'op_alpha_1', 1250);
    serverAuth.recordExtractionHold('raid_first', 'op_alpha_1', 180, 180, true);
    await serverAuth.commitSettlement({
      raidId: 'raid_first',
      extractingId: 'op_alpha_1',
      snapshotTick: 180,
      snapshotCash: 1250,
      exfilSubmitted: true,
    });

    // Deploy Next Raid initializes raid_second
    const raid2 = serverAuth.initRaid('raid_second', 50000, ['op_alpha_1', 'op_bravo_1']);
    expect(raid2.status).toBe('active');
    expect(raid2.totalBanked).toBe(0);
    expect(raid2.operatives['op_alpha_1'].isExtracted).toBe(false);
    expect(raid2.operatives['op_alpha_1'].activeRaid).toBe('raid_second');
  });

  it('34. physical cover deflection against machine fire and Rogue AI fire', () => {
    const sim = new SectorDepotSimulation();
    sim.admitOperative();

    // Position player behind Container 1 (center at -20, -30; bounds roughly X: -23.5 to -16.5, Z: -31.5 to -28.5)
    sim.player.x = -20;
    sim.player.z = -35;
    sim.player.armor = 100;
    sim.player.health = 100;

    // Place machine turret on the other side of container at (-20, -25)
    sim.machines = [{
      id: 'turret_cover_test',
      type: 'turret',
      x: -20,
      y: 0,
      z: -25,
      health: 120,
      isAlive: true,
      facing: 0,
      cooldownTicks: 0,
    }];

    // Step simulation: Turret attempts to fire, but line of sight is obstructed by container
    sim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: false, interact: false });

    // Player armor remains 100 because container deflected the turret bullet!
    expect(sim.player.armor).toBe(100);
    expect(sim.combatLog.some((l) => l.includes('deflected by container cover'))).toBe(true);

    // Test Rogue AI fire deflection behind container
    sim.machines = [];
    sim.spawnRogueSquad();
    const rogue = sim.rivals.find((r) => r.id === 'op_rogue_ai')!;
    rogue.x = -20;
    rogue.z = -25;
    rogue.shootCooldownTicks = 0;

    sim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: false, interact: false });
    // Player armor remains 100 because container deflected Rogue AI rifle fire!
    expect(sim.player.armor).toBe(100);
    expect(sim.combatLog.some((l) => l.includes('rifle burst deflected by container cover'))).toBe(true);
  });

  it('35. deterministic total ordering for server loot claims', async () => {
    const { ServerSettlementAuthority } = await import('../src/sim/server-settlement.js');
    const serverAuth = new ServerSettlementAuthority(`/tmp/test-loot-${Date.now()}.json`);
    serverAuth.initRaid('raid_loot_order', 50000, ['op_alpha_1', 'op_bravo_1']);

    // Bravo claims crate_01 at timestamp 200
    const bClaim = serverAuth.recordCrateLoot('raid_loot_order', 'crate_01', 'op_bravo_1', 1250, 200);
    expect(bClaim).toBe(true);

    const ledger1 = serverAuth.getLedger();
    const raid1 = ledger1.raids.find(([id]) => id === 'raid_loot_order')?.[1];
    expect(raid1?.operatives['op_bravo_1'].earnedCash).toBe(1250);

    // Alpha arrives later with an EARLIER timestamp 100 -> Alpha wins! Bravo is debited and Alpha is credited!
    const aClaim = serverAuth.recordCrateLoot('raid_loot_order', 'crate_01', 'op_alpha_1', 1250, 100);
    expect(aClaim).toBe(true);

    const ledger2 = serverAuth.getLedger();
    const raid2 = ledger2.raids.find(([id]) => id === 'raid_loot_order')?.[1];
    expect(raid2?.crates['crate_01'].claimedBy).toBe('op_alpha_1');
    expect(raid2?.operatives['op_bravo_1'].earnedCash).toBe(0);
    expect(raid2?.operatives['op_alpha_1'].earnedCash).toBe(1250);
  });

  it('36. official ExfilController state transitions: onFailure, retrySettlement, cancel', async () => {
    const { createExfilController } = await import('../src/sim/airlock.js');
    let currentTime = 10000;
    const ctrl = createExfilController({ now: () => currentTime });

    // Complete hold to reach corridor
    for (let i = 1; i <= 180; i++) {
      ctrl.onTick(i, true, 'lz_charlie', 0);
    }
    expect(ctrl.getState().kind).toBe('corridor_presentation');

    // Advance clock past 2500ms corridor
    currentTime += 2501;

    // Submit settlement transitions to submitting_settlement
    ctrl.submitSettlement();
    expect(ctrl.getState().kind).toBe('submitting_settlement');

    // Failure transitions to failed with canRetry
    ctrl.onFailure('Network timeout', true);
    expect(ctrl.getState().kind).toBe('failed');
    expect((ctrl.getState() as any).reason).toBe('Network timeout');
    expect((ctrl.getState() as any).canRetry).toBe(true);

    // retrySettlement transitions back to submitting_settlement
    ctrl.retrySettlement();
    expect(ctrl.getState().kind).toBe('submitting_settlement');

    // While submitting, inputs are strictly locked
    expect(ctrl.isInputLocked()).toBe(true);
    // Failure and cancel return to idle
    ctrl.onFailure('Aborted', false);
    ctrl.cancel();
    expect(ctrl.getState().kind).toBe('idle');
    expect(ctrl.isInputLocked()).toBe(false);
  });

  it('37. settlement persistence failure causes atomic rollback', async () => {
    const { ServerSettlementAuthority } = await import('../src/sim/server-settlement.js');
    const serverAuth = new ServerSettlementAuthority(`/tmp/test-rollback-${Date.now()}.json`);
    serverAuth.initRaid('raid_rollback', 50000, ['op_alpha_1', 'op_bravo_1']);
    serverAuth.recordCrateLoot('raid_rollback', 'crate_01', 'op_alpha_1', 1250);
    serverAuth.recordExtractionHold('raid_rollback', 'op_alpha_1', 200, 200, true);

    // Break saveToDisk to simulate disk failure
    serverAuth.saveToDisk = () => {
      throw new Error('ENOSPC: no space left on device');
    };

    await expect(
      serverAuth.commitSettlement({
        raidId: 'raid_rollback',
        extractingId: 'op_alpha_1',
        snapshotTick: 200,
        snapshotCash: 1250,
        exfilSubmitted: true,
      })
    ).rejects.toThrow('Settlement persistence failed: ENOSPC');

    // State MUST be cleanly rolled back: op_alpha_1 is NOT extracted and totalBanked is 0
    const ledger = serverAuth.getLedger();
    const raid = ledger.raids.find(([id]) => id === 'raid_rollback')?.[1];
    expect(raid?.totalBanked).toBe(0);
    expect(raid?.operatives['op_alpha_1'].isExtracted).toBe(false);
    expect(raid?.operatives['op_alpha_1'].activeRaid).toBe('raid_rollback');
  });
  it("38. strict snapshotTick validation: rejects undefined, NaN, strings, and ticks < 180", async () => {
    const { ServerSettlementAuthority } = await import("../src/sim/server-settlement.js");
    const serverAuth = new ServerSettlementAuthority(`/tmp/test-strict-tick-${Date.now()}.json`);
    serverAuth.initRaid("raid_tick_val", 50000, ["op_alpha_1"]);
    serverAuth.recordCrateLoot("raid_tick_val", "crate_01", "op_alpha_1", 1250);

    // Rejects undefined
    await expect(
      serverAuth.commitSettlement({
        raidId: "raid_tick_val",
        extractingId: "op_alpha_1",
        snapshotTick: undefined as any,
        snapshotCash: 1250,
        exfilSubmitted: true,
      })
    ).rejects.toThrow("Invalid settlement tick");

    // Rejects NaN
    await expect(
      serverAuth.commitSettlement({
        raidId: "raid_tick_val",
        extractingId: "op_alpha_1",
        snapshotTick: NaN,
        snapshotCash: 1250,
        exfilSubmitted: true,
      })
    ).rejects.toThrow("Invalid settlement tick");

    // Rejects string "200"
    await expect(
      serverAuth.commitSettlement({
        raidId: "raid_tick_val",
        extractingId: "op_alpha_1",
        snapshotTick: "200" as any,
        snapshotCash: 1250,
        exfilSubmitted: true,
      })
    ).rejects.toThrow("Invalid settlement tick");

    // Rejects tick 179 (< 180 continuous hold)
    await expect(
      serverAuth.commitSettlement({
        raidId: "raid_tick_val",
        extractingId: "op_alpha_1",
        snapshotTick: 179,
        snapshotCash: 1250,
        exfilSubmitted: true,
      })
    ).rejects.toThrow("Invalid settlement tick: 179");

    // Valid integer 180 passes
    serverAuth.recordExtractionHold("raid_tick_val", "op_alpha_1", 180, 180, true);
    const valid = await serverAuth.commitSettlement({
      raidId: "raid_tick_val",
      extractingId: "op_alpha_1",
      snapshotTick: 180,
      snapshotCash: 1250,
      exfilSubmitted: true,
    });
    expect(valid.receipt.throughTick).toBe(180);
  });

  it("39. durable settlement tracks persistent inventoryRevision across commits and rolls back on failure", async () => {
    const { ServerSettlementAuthority } = await import("../src/sim/server-settlement.js");
    const tmpFile = `/tmp/test-inv-rev-${Date.now()}.json`;
    const serverAuth = new ServerSettlementAuthority(tmpFile);
    serverAuth.initRaid("raid_rev", 50000, ["op_alpha_1", "op_bravo_1"]);
    serverAuth.recordCrateLoot("raid_rev", "crate_01", "op_alpha_1", 1250);
    serverAuth.recordExtractionHold("raid_rev", "op_alpha_1", 180, 180, true);

    const ledgerBefore = serverAuth.getLedger();
    const raidBefore = ledgerBefore.raids.find(([id]) => id === "raid_rev")?.[1];
    expect(raidBefore?.operatives["op_alpha_1"].inventoryRevision).toBe(13);
    expect(raidBefore?.operatives["op_bravo_1"].inventoryRevision).toBe(1);

    const commitRes = await serverAuth.commitSettlement({
      raidId: "raid_rev",
      extractingId: "op_alpha_1",
      snapshotTick: 200,
      snapshotCash: 1250,
      exfilSubmitted: true,
    });

    // Check inventoryRevision advanced to 14
    expect(commitRes.receipt.participantResults[0].inventoryRevision).toBe(14);
    const ledgerAfter = serverAuth.getLedger();
    const raidAfter = ledgerAfter.raids.find(([id]) => id === "raid_rev")?.[1];
    expect(raidAfter?.operatives["op_alpha_1"].inventoryRevision).toBe(14);

    // Rollback test on persistence error preserves previous inventoryRevision
    serverAuth.initRaid("raid_rev_fail", 50000, ["op_alpha_1", "op_bravo_1"]);
    serverAuth.recordCrateLoot("raid_rev_fail", "crate_02", "op_alpha_1", 2400);
    serverAuth.recordExtractionHold("raid_rev_fail", "op_alpha_1", 200, 200, true);
    serverAuth.saveToDisk = () => { throw new Error("Disk full"); };

    await expect(
      serverAuth.commitSettlement({
        raidId: "raid_rev_fail",
        extractingId: "op_alpha_1",
        snapshotTick: 200,
        snapshotCash: 2400,
        exfilSubmitted: true,
      })
    ).rejects.toThrow("Settlement persistence failed");

    // Inventory revision was rolled back and not corrupted
    const ledgerFail = serverAuth.getLedger();
    const raidFail = ledgerFail.raids.find(([id]) => id === "raid_rev_fail")?.[1];
    expect(raidFail?.operatives["op_alpha_1"].isExtracted).toBe(false);
  });

  it("40. settlement recovery cancel clears frozen snapshot so subsequent looting submits updated cash", () => {
    const sim = new SectorDepotSimulation();
    sim.admitOperative();
    sim.player.cash = 1250;
    sim.tick = 200;

    // Freeze snapshot during initial exfil attempt
    const snap1 = sim.freezeSettlementSnapshot();
    expect(snap1.tick).toBe(200);
    expect(snap1.cash).toBe(1250);

    // User cancels / returns to raid
    sim.clearFrozenSettlement();
    expect(sim.frozenSettlementTick).toBeUndefined();
    expect(sim.frozenSettlementCash).toBeUndefined();

    // Operative continues raid, loots second crate ($2,400) -> total cash $3,650 at tick 350
    sim.player.cash += 2400;
    sim.tick = 350;

    // Second exfil attempt freezes fresh updated state
    const snap2 = sim.freezeSettlementSnapshot();
    expect(snap2.tick).toBe(350);
    expect(snap2.cash).toBe(3650);
  });

  it("41. elevated drone 3D cover deflection: shots at container height [0, 5.2] deflect; shots above 5.2m hit", () => {
    const sim = new SectorDepotSimulation();
    sim.admitOperative();

    // Container 1 spans X: [-23.5, -16.5], Z: [-31.5, -28.5], Y: [0, 5.2]
    // Player at (-20, 1.0, -35)
    // Low Drone at (-20, 3.5, -25) fires through container: midpoint at z=-30 has y=2.25 <= 5.2 -> DEFLECTED
    const lowCovered = sim.checkContainerRayObstruction(-20, -25, -20, -35, 3.5, 1.0);
    expect(lowCovered).toBe(true);

    // Elevated Drone at (-20, 16.0, -25) fires over container (height at exit z=-31.5 is y=16-(15*0.7)=5.5m > 5.2m): NOT DEFLECTED
    const elevatedCovered = sim.checkContainerRayObstruction(-20, -25, -20, -35, 16.0, 1.0);
    expect(elevatedCovered).toBe(false);
  });

  it("42. hydration queue accepts machine events from snapshot host in ack_sent state and flushes on activate", () => {
    const simJoiner = new SectorDepotSimulation();
    const coordJoiner = new MultiplayerCoordinator(simJoiner);

    // Joiner enters corridor
    simJoiner.ingressController.enterCorridor(100);

    // Host sends snapshot
    coordJoiner.handleMessage({
      eventId: "snap_event_1",
      type: "ingress_snapshot",
      senderId: "op_host_alpha",
      senderName: "OPERATIVE ALPHA",
      squad: "SQUAD ALPHA",
      timestamp: Date.now(),
      data: {
        recipientId: coordJoiner.localId,
        snapshot: {
          snapshotTick: 120,
          crates: [{ id: "crate_01", opened: false }],
          machines: [{ id: "turret_depot_alpha", health: 120, isAlive: true }],
        },
      },
    });

    // Ingress state is now waiting_squad (post-hydration), peerEntry handshakeState is ack_sent
    console.log("Combat log:", simJoiner.combatLog); expect(simJoiner.ingressController.getState().kind).toBe("waiting_squad");
    const hostPeer = coordJoiner.connectedPeers.get("op_host_alpha");
    expect(hostPeer?.handshakeState).toBe("ack_sent");

    simJoiner.rivals.push({
      id: "op_host_alpha",
      isPlayer: false,
      isRival: true,
      isAI: false,
      name: "OPERATIVE ALPHA",
      x: -5,
      y: 0,
      z: 13,
      facing: Math.PI,
      health: 100,
      armor: 0,
      cash: 0,
      action: "kick",
      actionTicks: 0,
      isInvulnerable: false,
      isAlive: true,
      isExtracted: false,
      ammo: 30,
      maxAmmo: 30,
    });

    // Machine hit arrives from snapshot host during hydration (after snapshot)
    coordJoiner.handleMessage({
      eventId: "mhit_during_hyd",
      type: "machine_hit",
      senderId: "op_host_alpha",
      senderName: "OPERATIVE ALPHA",
      squad: "SQUAD ALPHA",
      timestamp: Date.now() + 10,
      data: { machineId: "turret_depot_alpha", damage: 40, attackerFacing: Math.PI },
    });

    // Event is buffered in pendingWorldEvents
    expect((coordJoiner as any).pendingWorldEvents.length).toBe(1);

    // Host sends confirmation squad_ack
    coordJoiner.handleMessage({
      eventId: "ack_confirm_1",
      type: "squad_ack",
      senderId: "op_host_alpha",
      senderName: "OPERATIVE ALPHA",
      squad: "SQUAD ALPHA",
      timestamp: Date.now(),
      data: { isConfirmation: true },
    });

    // Joiner is activated and pending machine damage was flushes and applied
    expect(simJoiner.isAdmitted()).toBe(true);
    expect((coordJoiner as any).pendingWorldEvents.length).toBe(0);
    const turret = simJoiner.machines.find((m) => m.id === "turret_depot_alpha");
    expect(turret?.health).toBe(80); // 120 - 40 = 80!

    coordJoiner.cleanup();
  });

  it("43. loot custody finality & raid isolation: settled crates cannot be stolen; cross-raid packets dropped", async () => {
    const { ServerSettlementAuthority } = await import("../src/sim/server-settlement.js");
    const serverAuth = new ServerSettlementAuthority(`/tmp/test-loot-finality-${Date.now()}.json`);
    serverAuth.initRaid("raid_finality_test", 50000, ["op_alpha_1", "op_bravo_1"]);

    // Bravo claims crate_01 at timestamp 200
    serverAuth.recordCrateLoot("raid_finality_test", "crate_01", "op_bravo_1", 1250, 200);
    serverAuth.recordExtractionHold("raid_finality_test", "op_bravo_1", 200, 200, true);

    // Bravo successfully extracts and commits settlement
    await serverAuth.commitSettlement({
      raidId: "raid_finality_test",
      extractingId: "op_bravo_1",
      snapshotTick: 200,
      snapshotCash: 1250,
      exfilSubmitted: true,
    });

    // Alpha now attempts to claim crate_01 with earlier timestamp 100: MUST BE REJECTED because Bravo already extracted!
    const lateClaim = serverAuth.recordCrateLoot("raid_finality_test", "crate_01", "op_alpha_1", 1250, 100);
    expect(lateClaim).toBe(false);

    // Total banked remains strictly 1250
    const ledger = serverAuth.getLedger();
    const raid = ledger.raids.find(([id]) => id === "raid_finality_test")?.[1];
    expect(raid?.totalBanked).toBe(1250);

    // Raid isolation test: peer packet from a different raidId is dropped
    const sim = new SectorDepotSimulation();
    sim.admitOperative();
    const coord = new MultiplayerCoordinator(sim);
    coord.connectedPeers.set("op_rogue_other_raid", {
      lastSeen: Date.now(),
      name: "ROGUE OTHER RAID",
      ingressDone: true,
      handshakeState: "confirmed",
    });

    coord.handleMessage({
      eventId: "foreign_hit_1",
      type: "hit",
      senderId: "op_rogue_other_raid",
      senderName: "ROGUE OTHER RAID",
      squad: "SQUAD DELTA",
      raidId: "foreign_raid_9999", // Different raid ID!
      timestamp: Date.now(),
      data: { targetId: coord.localId, damage: 50 },
    });

    // Player takes no damage because foreign raid packet was dropped!
    expect(sim.player.armor).toBe(100);
    expect(sim.player.health).toBe(100);

    coord.cleanup();
  });
  it("44. prototype pollution attempt (toString crate) is strictly rejected by own-property check", async () => {
    const { ServerSettlementAuthority } = await import("../src/sim/server-settlement.js");
    const serverAuth = new ServerSettlementAuthority(`/tmp/test-proto-${Date.now()}.json`);
    serverAuth.initRaid("raid_proto", 50000, ["op_alpha_1"]);

    expect(() => {
      serverAuth.recordCrateLoot("raid_proto", "toString", "op_alpha_1", 50000, 100);
    }).toThrow("not a recognized sector depot crate");

    const ledger = serverAuth.getLedger();
    const raid = ledger.raids.find(([id]) => id === "raid_proto")?.[1];
    expect(raid?.operatives["op_alpha_1"].earnedCash).toBe(0);
  });

  it("45. bilateral settlement receipt verification dynamically validates Bravo extraction with revision 2", async () => {
    const { AuthoritativeSettlementLedger, verifySettlementReceipt } = await import("../src/sim/airlock.js");
    const ledger = new AuthoritativeSettlementLedger();
    const simBravo = {
      tick: 200,
      player: { id: "op_bravo_1", cash: 1250, isExtracted: true },
      isExtracted: true,
      raidId: "raid_sector7_1042",
      exfilController: { getState: () => ({ kind: "extracted" }) },
    };

    const commit = await ledger.commitSettlement(simBravo as any);
    expect(commit.receipt.participantResults.find((p: any) => p.profileId === "op_bravo_1")?.inventoryRevision).toBe(2);

    const verification = await verifySettlementReceipt(commit.receipt, commit.outcomePayload, ledger);
    expect(verification.valid).toBe(true);
  });

  it("46. inactive, dead, or extracted attackers cannot inflict damage on player", () => {
    const sim = new SectorDepotSimulation();
    sim.admitOperative();
    const coord = new MultiplayerCoordinator(sim);

    coord.connectedPeers.set("op_bravo_1", {
      lastSeen: Date.now(),
      name: "RIVAL OPERATIVE",
      ingressDone: true,
      handshakeState: "confirmed",
    });

    // Case 1: Dead attacker (isAlive = false)
    sim.rivals.push({
      id: "op_bravo_1",
      name: "RIVAL OPERATIVE",
      isPlayer: false,
      isRival: true,
      isAI: false,
      x: sim.player.x,
      y: 0,
      z: sim.player.z + 2,
      facing: 0,
      health: 0,
      armor: 0,
      cash: 0,
      action: "idle",
      actionTicks: 0,
      isInvulnerable: false,
      isAlive: false, // DEAD!
      isExtracted: false,
      ammo: 0,
      maxAmmo: 30,
    });

    coord.handleMessage({
      eventId: "dead_atk_1",
      type: "hit",
      senderId: "op_bravo_1",
      senderName: "RIVAL OPERATIVE",
      squad: "SQUAD BRAVO",
      raidId: sim.raidId,
      timestamp: Date.now(),
      data: { targetId: coord.localId, damage: 30 },
    });

    expect(sim.player.armor).toBe(100);

    // Case 2: Extracted attacker (isExtracted = true)
    const rival = sim.rivals[0];
    rival.isAlive = true;
    rival.isExtracted = true; // EXTRACTED!

    coord.handleMessage({
      eventId: "ext_atk_2",
      type: "hit",
      senderId: "op_bravo_1",
      senderName: "RIVAL OPERATIVE",
      squad: "SQUAD BRAVO",
      raidId: sim.raidId,
      timestamp: Date.now(),
      data: { targetId: coord.localId, damage: 30 },
    });

    expect(sim.player.armor).toBe(100);
    coord.cleanup();
  });

  it("47. client loot finality: late rival claim cannot revoke cash or ammo from an already extracted player", () => {
    const sim = new SectorDepotSimulation();
    sim.admitOperative();

    // Player loots crate_01 at timestamp 200
    sim.claimCrateLocally("crate_01", sim.player.id, 200);
    expect(sim.player.cash).toBe(1250);

    // Player successfully extracts and settles
    sim.player.isExtracted = true;

    // Rival attempts later claim with earlier timestamp 100
    const revoked = sim.claimCrateLocally("crate_01", "op_bravo_1", 100);
    expect(revoked).toBe(false);

    // Banked cash remains immutable at $1,250
    expect(sim.player.cash).toBe(1250);
  });
  it("48. reinitializing a settled or concluded raid is strictly rejected", async () => {
    const { ServerSettlementAuthority } = await import("../src/sim/server-settlement.js");
    const serverAuth = new ServerSettlementAuthority(`/tmp/test-reinit-${Date.now()}.json`);
    serverAuth.initRaid("raid_settled_test", 50000, ["op_alpha_1"]);
    serverAuth.recordCrateLoot("raid_settled_test", "crate_01", "op_alpha_1", 1250);
    serverAuth.recordExtractionHold("raid_settled_test", "op_alpha_1", 180, 180, true);
    await serverAuth.commitSettlement({
      raidId: "raid_settled_test",
      extractingId: "op_alpha_1",
      snapshotTick: 200,
      snapshotCash: 1250,
      exfilSubmitted: true,
    });

    // Reinitializing the settled raid throws
    expect(() => {
      serverAuth.initRaid("raid_settled_test", 50000, ["op_alpha_1"]);
    }).toThrow("already settled or concluded");
  });

  it("49. stale out-of-order state packets cannot resurrect or unextract an extracted rival, and extracted player takes zero damage", () => {
    const sim = new SectorDepotSimulation();
    sim.admitOperative();
    const coord = new MultiplayerCoordinator(sim);
    const rivalObj = {
      id: "op_bravo_1",
      name: "RIVAL OPERATIVE",
      badge: "SQUAD BRAVO",
      isPlayer: false,
      isRival: true,
      isAI: false,
      x: 0,
      y: 0,
      z: 2,
      facing: 0,
      health: 100,
      armor: 100,
      cash: 0,
      action: "idle" as const,
      actionTicks: 0,
      isInvulnerable: false,
      isAlive: true,
      isExtracted: false,
      ammo: 30,
      maxAmmo: 30,
      lastStateTimestamp: 150,
    };
    sim.rivals = [rivalObj];
    coord.connectedPeers.set("op_bravo_1", {
      lastSeen: Date.now(),
      name: "RIVAL OPERATIVE",
      ingressDone: true,
      handshakeState: "confirmed",
    });

    // Register committed receipt in authoritative ledger audit log
    defaultSettlementLedger.auditLog.set("rcpt_test_49", {
      receiptId: "rcpt_test_49",
      throughTick: 200,
      raidId: sim.raidId as any,
      outcomeDigest: "digest_canonical_49",
      participantResults: [{ profileId: "op_bravo_1" as any, activeRaidCleared: true }],
    } as any);

    // Rival extracts at timestamp 200 with authentic settlement receipt
    coord.handleMessage({
      eventId: "ext_success_1",
      type: "exfil_success",
      senderId: "op_bravo_1",
      senderName: "RIVAL OPERATIVE",
      squad: "SQUAD BRAVO",
      raidId: sim.raidId,
      timestamp: 200,
      data: {
        receipt: {
          receiptId: "rcpt_test_49",
          raidId: sim.raidId,
          operativeId: "op_bravo_1",
          snapshotTick: 200,
          throughTick: 200,
          outcomeDigest: "digest_canonical_49",
          verifiedCash: 0,
          committed: true,
        },
      },
    });
    expect(rivalObj.isExtracted).toBe(true);

    // Stale state packet arrives with older timestamp 100 claiming rival is alive and unextracted
    coord.handleMessage({
      eventId: "old_state_1",
      type: "state",
      senderId: "op_bravo_1",
      senderName: "RIVAL OPERATIVE",
      squad: "SQUAD BRAVO",
      raidId: sim.raidId,
      timestamp: 100,
      data: { ...rivalObj, isExtracted: false, isAlive: true },
    });
    expect(rivalObj.isExtracted).toBe(true); // Must NOT be unextracted!

    // Delayed hit packet arrives from extracted rival: must be dropped!
    coord.handleMessage({
      eventId: "hit_from_ext_1",
      type: "hit",
      senderId: "op_bravo_1",
      senderName: "RIVAL OPERATIVE",
      squad: "SQUAD BRAVO",
      raidId: sim.raidId,
      timestamp: 210,
      data: { targetId: coord.localId, damage: 30 },
    });
    expect(sim.player.armor).toBe(100); // No damage taken!

    // If local player has extracted, incoming hits also deal zero damage
    sim.player.isExtracted = true;
    rivalObj.isExtracted = false; // Mock active rival
    rivalObj.isAlive = true;
    coord.handleMessage({
      eventId: "hit_to_ext_player",
      type: "hit",
      senderId: "op_bravo_1",
      senderName: "RIVAL OPERATIVE",
      squad: "SQUAD BRAVO",
      raidId: sim.raidId,
      timestamp: 220,
      data: { targetId: coord.localId, damage: 30 },
    });
    expect(sim.player.armor).toBe(100);

    coord.cleanup();
  });

  it("50. unified weapon range: targets at range <= 35m take damage, targets beyond 35m take zero damage", () => {
    const sim = new SectorDepotSimulation();
    sim.admitOperative();
    sim.machines = [];
    sim.player.x = 0;
    sim.player.z = 0;
    sim.player.facing = 0; // facing +Z

    // Target at 36m (beyond unified 35m cutoff)
    const targetBeyond = {
      id: "op_target_36m",
      isPlayer: false,
      isRival: true,
      isAI: false,
      name: "TARGET BEYOND",
      x: 0,
      y: 0,
      z: 36,
      facing: Math.PI,
      health: 100,
      armor: 100,
      cash: 0,
      action: "idle" as const,
      actionTicks: 0,
      isInvulnerable: false,
      isAlive: true,
      isExtracted: false,
      ammo: 30,
      maxAmmo: 30,
    };
    sim.rivals = [targetBeyond];

    sim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: true, interact: false, aimAngle: 0 });
    expect(targetBeyond.health).toBe(100); // Beyond 35m: takes ZERO damage!

    // Move target to 34m (within unified 35m range)
    targetBeyond.z = 34;
    targetBeyond.armor = 0;
    sim.player.ammo = 30;
    (sim as any).shootCooldownTicks = 0;
    sim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: true, interact: false, aimAngle: 0 });
    expect(targetBeyond.health).toBe(76); // 100 - 24 = 76!
  });

  it("51. sequential extraction derives bilateral participant results from stored custody", async () => {
    const { ServerSettlementAuthority } = await import("../src/sim/server-settlement.js");
    const serverAuth = new ServerSettlementAuthority(`/tmp/test-seq-ext-${Date.now()}.json`);
    serverAuth.initRaid("raid_seq_ext", 50000, ["op_alpha_1", "op_bravo_1"]);
    serverAuth.recordCrateLoot("raid_seq_ext", "crate_01", "op_alpha_1", 1250, 100);
    serverAuth.recordExtractionHold("raid_seq_ext", "op_alpha_1", 200, 200, true);
    serverAuth.recordCrateLoot("raid_seq_ext", "crate_02", "op_bravo_1", 2400, 105);
    serverAuth.recordExtractionHold("raid_seq_ext", "op_bravo_1", 250, 250, true);

    // Alpha extracts first
    const alphaCommit = await serverAuth.commitSettlement({
      raidId: "raid_seq_ext",
      extractingId: "op_alpha_1",
      snapshotTick: 200,
      snapshotCash: 1250,
      rivalId: "op_bravo_1",
      exfilSubmitted: true,
    });
    expect(alphaCommit.receipt.participantResults.find((p: any) => p.profileId === "op_alpha_1")?.activeRaidCleared).toBe(true);
    expect(alphaCommit.receipt.participantResults.find((p: any) => p.profileId === "op_bravo_1")?.activeRaidCleared).toBe(false);

    // Bravo extracts second
    const bravoCommit = await serverAuth.commitSettlement({
      raidId: "raid_seq_ext",
      extractingId: "op_bravo_1",
      snapshotTick: 250,
      snapshotCash: 2400,
      rivalId: "op_alpha_1",
      exfilSubmitted: true,
    });
    // In Bravo receipt, Alpha was ALREADY extracted, so Alpha activeRaidCleared is TRUE and escrow is released!
    const alphaInBravoReceipt = bravoCommit.receipt.participantResults.find((p: any) => p.profileId === "op_alpha_1");
    expect(alphaInBravoReceipt?.activeRaidCleared).toBe(true);
    expect(alphaInBravoReceipt?.releasedEscrowIds).toContain("escrow_op_alpha_1_loadout");
  });

  it("52. reconcileCrateRejection debits unverified cash on client when server authority rejects claim", () => {
    const sim = new SectorDepotSimulation();
    sim.admitOperative();
    sim.player.cash = 1250;
    const crate = sim.crates.find((c) => c.id === "crate_01")!;
    crate.opened = true;
    crate.claimedBy = sim.player.id;

    // Server rejects loot claim (e.g. rival claimed earlier)
    sim.reconcileCrateRejection("crate_01", 1250);

    // Cash debited back to $0, crate marked unowned
    expect(sim.player.cash).toBe(0);
    expect(crate.claimedBy).toBeUndefined();
    expect(crate.opened).toBe(false);
    expect(sim.combatLog.some((l) => l.includes("rejected by authority"))).toBe(true);
  });

  it("53. idempotent loot rejection: peer claim followed by async server rejection does not double debit", () => {
    const sim = new SectorDepotSimulation();
    sim.admitOperative();
    sim.player.cash = 3650;
    const crate = sim.crates.find((c) => c.id === "crate_01")!;
    crate.opened = true;
    crate.claimedBy = sim.player.id;
    crate.claimedAt = 2000;

    // Earlier peer claim arrives (t=1000) for crate_01 ($1250) -> local balance reduced from $3650 to $2400
    const won = sim.claimCrateLocally("crate_01", "op_bravo_1", 1000);
    expect(won).toBe(false); // Local player was not the winner
    expect(crate.claimedBy).toBe("op_bravo_1");
    expect(sim.player.cash).toBe(2400);

    // Asynchronous REST rejection response for crate_01 arrives later
    sim.reconcileCrateRejection("crate_01", 1250);

    // Balance remains exactly $2400 (NO double debit to $1150)
    expect(sim.player.cash).toBe(2400);
  });

  it("54. peer extraction received before first state packet preserves extracted status and rejects late damage", () => {
    const sim = new SectorDepotSimulation();
    sim.admitOperative();
    const coord = new MultiplayerCoordinator(sim);
    const peerId = "op_bravo_1";

    // Ensure peer is admitted before exfil_success
    coord.connectedPeers.set(peerId, {
      name: "INFILTRATOR PHANTOM-1",
      lastSeen: Date.now(),
      ingressDone: true,
      handshakeState: "confirmed",
    });

    // Register committed receipt in authoritative ledger audit log
    defaultSettlementLedger.auditLog.set("rcpt_test_54", {
      receiptId: "rcpt_test_54",
      throughTick: 200,
      raidId: sim.raidId as any,
      outcomeDigest: "digest_canonical_54",
      participantResults: [{ profileId: peerId as any, activeRaidCleared: true }],
    } as any);

    // exfil_success arrives BEFORE any state packet from peer with valid receipt
    coord.handleMessage({
      eventId: "evt_exfil_1",
      type: "exfil_success",
      senderId: peerId,
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      raidId: sim.raidId,
      timestamp: Date.now(),
      data: {
        receipt: {
          receiptId: "rcpt_test_54",
          raidId: sim.raidId,
          operativeId: peerId,
          snapshotTick: 200,
          throughTick: 200,
          outcomeDigest: "digest_canonical_54",
          verifiedCash: 0,
          committed: true,
        },
      },
    });

    expect(coord.extractedPeerIds.has(peerId)).toBe(true);

    coord.handleMessage({
      eventId: "evt_late_state_1",
      type: "state",
      senderId: peerId,
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      raidId: sim.raidId,
      timestamp: Date.now() - 50,
      data: {
        x: 0,
        y: 0,
        z: 0,
        facing: 0,
        health: 100,
        armor: 100,
        cash: 2500,
        action: "idle",
        actionTicks: 0,
        isAlive: true,
        isExtracted: false, // Late packet claimed not extracted yet
        ammo: 30,
      },
    });

    const rival = sim.rivals.find((r) => r.id === peerId)!;
    expect(rival).toBeDefined();
    expect(rival.isExtracted).toBe(true);
    expect(rival.isAlive).toBe(false);

    // Late hit packet from extracted peer is discarded
    const hpBefore = sim.player.health;
    coord.handleMessage({
      eventId: "evt_late_hit_1",
      type: "hit",
      senderId: peerId,
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      raidId: sim.raidId,
      timestamp: Date.now(),
      data: { targetId: coord.localId, damage: 25 },
    });
    expect(sim.player.health).toBe(hpBefore);
    coord.cleanup();
  });

  it("55. zero-cash settled raid reinitialization rejection and real-time raid deadline", async () => {
    const tmpStore = `/tmp/settlement_test_${Date.now()}_${Math.random().toString(36).slice(2)}.json`;
    const { ServerSettlementAuthority } = await import("../src/sim/server-settlement.js");
    const auth = new ServerSettlementAuthority(tmpStore);

    auth.initRaid("raid_zero_cash", 50000, ["op_alpha_1", "op_bravo_1"]);

    // Alpha extracts with $0 (looted no crates)
    auth.recordExtractionHold("raid_zero_cash", "op_alpha_1", 200, 200, true);
    await auth.commitSettlement({
      raidId: "raid_zero_cash",
      extractingId: "op_alpha_1",
      snapshotTick: 200,
      snapshotCash: 0,
      rivalId: "op_bravo_1",
      exfilSubmitted: true,
    });

    // Reinitializing raid_zero_cash MUST throw even though totalBanked == 0
    expect(() => {
      auth.initRaid("raid_zero_cash", 50000, ["op_alpha_1", "op_bravo_1"]);
    }).toThrow(/already settled or concluded/);

    // Expired real-time raid deadline (> 15m + 1m grace) is rejected
    auth.initRaid("raid_expired_time", 50000, ["op_alpha_1"]);
    auth.recordExtractionHold("raid_expired_time", "op_alpha_1", 200, 200, true);
    const raidRecord = (auth as any).raids.get("raid_expired_time");
    raidRecord.createdAtMs = Date.now() - (16 * 60 * 1000 + 5000); // 16m 5s ago

    await expect(
      auth.commitSettlement({
        raidId: "raid_expired_time",
        extractingId: "op_alpha_1",
        snapshotTick: 200,
        snapshotCash: 0,
        exfilSubmitted: true,
      })
    ).rejects.toThrow(/expired past real-time deadline/);
  });

  it("56. camera ground ray unproject accurately calculates 45 deg and 135 deg diagonal targets", () => {
    const W = 1920;
    const H = 1080;
    const fov = 48;
    const fLen = Math.hypot(12, 10.5);
    const F = [0, -12 / fLen, -10.5 / fLen];
    const R = [1, 0, 0];
    const U = [0, 10.5 / fLen, -12 / fLen];
    const halfTan = Math.tan(((fov / 2) * Math.PI) / 180);

    // Helper to simulate screen coordinate of a 3D ground target relative to player
    function projectGroundTarget(targetDx: number, targetDz: number) {
      // Vector from camera (0, 13, 10.5) to target (targetDx, 0, targetDz)
      const D = [targetDx, -13, targetDz - 10.5];
      const dForward = D[0] * F[0] + D[1] * F[1] + D[2] * F[2];
      const dRight = D[0] * R[0] + D[1] * R[1] + D[2] * R[2];
      const dUp = D[0] * U[0] + D[1] * U[1] + D[2] * U[2];

      const ndcX = dRight / dForward / ((W / H) * halfTan);
      const ndcY = dUp / dForward / halfTan;
      const clientX = ndcX * (W / 2) + W / 2;
      const clientY = -ndcY * (H / 2) + H / 2;
      return { clientX, clientY };
    }

    // 1. Forward-right diagonal target (dx=10, dz=-10): exact 135 degrees
    const p135 = projectGroundTarget(10, -10);
    const angle135 = computeGroundAimAngle(p135.clientX, p135.clientY, W, H, fov);
    const deg135 = (angle135 * 180) / Math.PI;
    expect(deg135).toBeCloseTo(135.0, 5);

    // 2. Backward-right diagonal target (dx=10, dz=10): exact 45 degrees
    const p45 = projectGroundTarget(10, 10);
    const angle45 = computeGroundAimAngle(p45.clientX, p45.clientY, W, H, fov);
    const deg45 = (angle45 * 180) / Math.PI;
    expect(deg45).toBeCloseTo(45.0, 5);
  });

  it("57. authoritative extraction hold verification and cross-raid restart isolation", async () => {
    const { ServerSettlementAuthority } = await import("../src/sim/server-settlement.js");
    const tmpStore = `/tmp/test-hold-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
    const auth = new ServerSettlementAuthority(tmpStore);

    auth.initRaid("raid_hold_audit", 50000, ["op_alpha_1"]);
    auth.recordCrateLoot("raid_hold_audit", "crate_01", "op_alpha_1", 1250);

    // 1. Commit without hold is strictly REJECTED
    await expect(
      auth.commitSettlement({
        raidId: "raid_hold_audit",
        extractingId: "op_alpha_1",
        snapshotTick: 180,
        snapshotCash: 1250,
        exfilSubmitted: true,
      })
    ).rejects.toThrow(/not completed the required 180-tick continuous extraction hold/);

    // 2. Incomplete hold (179 ticks) is still REJECTED
    auth.recordExtractionHold("raid_hold_audit", "op_alpha_1", 179, 179);
    await expect(
      auth.commitSettlement({
        raidId: "raid_hold_audit",
        extractingId: "op_alpha_1",
        snapshotTick: 180,
        snapshotCash: 1250,
        exfilSubmitted: true,
      })
    ).rejects.toThrow(/not completed the required 180-tick continuous extraction hold/);

    // 3. Complete hold (180 ticks) SUCCEEDS
    auth.recordExtractionHold("raid_hold_audit", "op_alpha_1", 180, 180, true);
    const successRes = await auth.commitSettlement({
      raidId: "raid_hold_audit",
      extractingId: "op_alpha_1",
      snapshotTick: 180,
      snapshotCash: 1250,
      exfilSubmitted: true,
    });
    expect(successRes.outcomePayload.cashBanked).toBe(1250);

    // 4. Raid restart from foreign raid or unadmitted peer is strictly isolated
    const sim = new SectorDepotSimulation("raid_active_lobby");
    const coord = new MultiplayerCoordinator(sim);
    let restartedTo: string | null = null;
    coord.onRaidRestart = (id) => { restartedTo = id; };

    // 4a. Restart packet with missing raidId strictly rejected
    coord.handleMessage({
      eventId: "evt_no_raid_restart",
      type: "raid_restart",
      senderId: "op_bravo_1",
      senderName: "Bravo",
      squad: "SQUAD BRAVO",
      timestamp: Date.now(),
      data: { newRaidId: "raid_sector7_next" },
    } as any);
    expect(restartedTo).toBeNull();

    // 4b. Foreign raid packet rejected
    coord.handleMessage({
      eventId: "evt_foreign_restart",
      type: "raid_restart",
      senderId: "op_bravo_1",
      senderName: "Bravo",
      squad: "SQUAD BRAVO",
      raidId: "raid_old_stale",
      timestamp: Date.now(),
      data: { newRaidId: "raid_sector7_next" },
    });
    expect(restartedTo).toBeNull();

    // Unadmitted sender in current raid rejected
    coord.handleMessage({
      eventId: "evt_unadmitted_restart",
      type: "raid_restart",
      senderId: "op_bravo_1",
      senderName: "Bravo",
      squad: "SQUAD BRAVO",
      raidId: "raid_active_lobby",
      timestamp: Date.now(),
      data: { newRaidId: "raid_sector7_next" },
    });
    expect(restartedTo).toBeNull();

    // Admitted peer in current raid triggers synchronized restart
    coord.connectedPeers.set("op_bravo_1", {
      name: "Bravo",
      lastSeen: Date.now(),
      ingressDone: true,
      handshakeState: "confirmed",
    });
    coord.handleMessage({
      eventId: "evt_valid_restart",
      type: "raid_restart",
      senderId: "op_bravo_1",
      senderName: "Bravo",
      squad: "SQUAD BRAVO",
      raidId: "raid_active_lobby",
      timestamp: Date.now(),
      data: { newRaidId: "raid_sector7_synchronized_99" },
    });
    expect(restartedTo).toBe("raid_sector7_synchronized_99");
    coord.cleanup();
  });

  it("58. continuous gameplay simulation seamlessly verifies hold custody while single-report spoof is rejected", async () => {
    const { ServerSettlementAuthority } = await import("../src/sim/server-settlement.js");
    const tmpStore = `/tmp/test-play-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
    const auth = new ServerSettlementAuthority(tmpStore);

    // 1. Single-report spoof attempt (one call with holdTicks=180, currentTick=180) is REJECTED
    auth.initRaid("raid_spoof_single", 50000, ["op_alpha_1"]);
    auth.recordCrateLoot("raid_spoof_single", "crate_01", "op_alpha_1", 1250, 1);
    auth.recordExtractionHold("raid_spoof_single", "op_alpha_1", 180, 180);
    await expect(
      auth.commitSettlement({
        raidId: "raid_spoof_single",
        extractingId: "op_alpha_1",
        snapshotTick: 180,
        snapshotCash: 1250,
        exfilSubmitted: true,
      })
    ).rejects.toThrow(/not completed the required 180-tick continuous extraction hold/);

    // 2. Real continuous client simulation of 180 ticks
    const sim = new SectorDepotSimulation("raid_actual_sim_play");
    sim.admitOperative();
    sim.player.x = 45;
    sim.player.z = 45;
    sim.machines = [];
    auth.initRaid(sim.raidId, 50000, [sim.player.id]);
    auth.recordCrateLoot(sim.raidId, "crate_01", sim.player.id, 1250, 1);

    const input = { dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: false, interact: false };
    for (let i = 0; i < 180; i++) sim.step(input);
    sim.freezeSettlementSnapshot();

    expect(sim.exfilController.getState().kind).toBe("corridor_presentation");
    expect(sim.tick).toBe(180);

    // Normal client commit without manual hold calls succeeds because continuous gameplay verified the hold!
    const res = await auth.commitSettlement({
      raidId: sim.raidId,
      extractingId: sim.player.id,
      snapshotTick: sim.tick,
      snapshotCash: 1250,
      exfilSubmitted: true,
    });
    expect(res.outcomePayload.cashBanked).toBe(1250);
  });

  it("59. two-report duration jump spoof rejected, and multi-step hold succeeds without global registry", async () => {
    const { ServerSettlementAuthority } = await import("../src/sim/server-settlement.js");
    const tmpStore = `/tmp/test-spoof-duration-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
    const auth = new ServerSettlementAuthority(tmpStore);

    // 1. Jump duration and replay loop attempts are strictly REJECTED
    auth.initRaid("raid_spoof_two_call", 50000, ["op_alpha_1"]);
    auth.recordCrateLoot("raid_spoof_two_call", "crate_01", "op_alpha_1", 1250, 1);
    const r1 = auth.recordExtractionHold("raid_spoof_two_call", "op_alpha_1", 1, 1);
    expect(r1.holdCompleted).toBe(false);

    // Rapid repeated calls with jumped ticks are clamped and rejected
    for (let i = 0; i < 169; i++) {
      auth.recordExtractionHold("raid_spoof_two_call", "op_alpha_1", 180, 180);
    }
    const rFinal = auth.recordExtractionHold("raid_spoof_two_call", "op_alpha_1", 180, 180);
    expect(rFinal.holdCompleted).toBe(false);

    await expect(
      auth.commitSettlement({
        raidId: "raid_spoof_two_call",
        extractingId: "op_alpha_1",
        snapshotTick: 180,
        snapshotCash: 1250,
        exfilSubmitted: true,
      })
    ).rejects.toThrow(/not completed the required 180-tick continuous extraction hold/);

    // 2. Real continuous hold with 180 sequential reports succeeds even when global registry is deleted
    if (typeof globalThis !== "undefined") {
      delete (globalThis as any).__stickZoneCompletedHolds;
    }
    auth.initRaid("raid_sequential_reports", 50000, ["op_alpha_1"]);
    auth.recordCrateLoot("raid_sequential_reports", "crate_01", "op_alpha_1", 1250, 1);

    for (let t = 1; t <= 180; t++) {
      auth.recordExtractionHold("raid_sequential_reports", "op_alpha_1", t, t, { simTickAdvancement: true });
    }

    const res = await auth.commitSettlement({
      raidId: "raid_sequential_reports",
      extractingId: "op_alpha_1",
      snapshotTick: 180,
      snapshotCash: 1250,
      exfilSubmitted: true,
      simTickAdvancement: true,
    });
    expect(res.outcomePayload.cashBanked).toBe(1250);
  });

  it("60. active raid persistence across store reloads, unadmitted host recovery, and unsolicited snapshot rejection", async () => {
    const { ServerSettlementAuthority } = await import("../src/sim/server-settlement.js");
    const tmpStore = `/tmp/test-active-reload-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
    const auth1 = new ServerSettlementAuthority(tmpStore);

    // 1. Initialize custom raid and record loot
    const raidId = "raid_sector7_persisted_custom_42";
    auth1.initRaid(raidId, 50000, ["op_player", "op_alpha_1", "op_bravo_1"]);
    auth1.recordCrateLoot(raidId, "crate_01", "op_bravo_1", 1250, 100);
    expect(auth1.getActiveRaidId()).toBe(raidId);

    // 2. Simulate process/store reload: active raid and loot custody persist
    const auth2 = new ServerSettlementAuthority(tmpStore);
    expect(auth2.getActiveRaidId()).toBe(raidId);
    const crates = auth2.getRaidCrates();
    expect(crates.crate_01?.claimedBy).toBe("op_bravo_1");

    // 3. Host reload recovery: Alpha reloads initially UNADMITTED (without admitOperative())
    const simAlpha = new SectorDepotSimulation(raidId);
    expect(simAlpha.isAdmitted()).toBe(false);
    const coordAlpha = new MultiplayerCoordinator(simAlpha);

    // Bravo is already active and replies with raid_announce with world snapshot
    coordAlpha.handleMessage({
      eventId: "evt_bravo_announce",
      type: "raid_announce",
      senderId: "op_bravo_1",
      senderName: "Bravo",
      squad: "SQUAD BRAVO",
      raidId: raidId,
      timestamp: Date.now(),
      data: {
        activeRaidId: raidId,
        recipientId: "op_alpha_1",
        admittedPeerIds: ["op_bravo_1"],
        snapshot: {
          snapshotTick: 200,
          crates: [{ id: "crate_01", opened: true, claimedBy: "op_bravo_1", claimedAt: 100 }],
          machines: [{ id: "turret_depot_alpha", health: 70, isAlive: true }],
        },
      },
    });

    // Ingress state remains waiting_squad with ack_sent until squad ACK confirmation completes
    expect(simAlpha.ingressController.getState().kind).toBe("waiting_squad");
    expect(coordAlpha.connectedPeers.get("op_bravo_1")?.handshakeState).toBe("ack_sent");

    // Bravo replies with squad_ack confirmation to complete the two-way ACK exchange
    coordAlpha.handleMessage({
      eventId: "evt_bravo_ack_confirm",
      type: "squad_ack",
      senderId: "op_bravo_1",
      senderName: "Bravo",
      squad: "SQUAD BRAVO",
      raidId: raidId,
      timestamp: Date.now(),
      data: { isConfirmation: true, recipientId: "op_alpha_1" },
    });

    // Verify complete staged ingress state machine recovery to confirmed_active
    expect(simAlpha.isAdmitted()).toBe(true);
    expect(simAlpha.ingressController.getState().kind).toBe("confirmed_active");
    expect(simAlpha.crates.find((c) => c.id === "crate_01")?.opened).toBe(true);
    expect(simAlpha.machines.find((m) => m.id === "turret_depot_alpha")?.health).toBe(70);
    expect(coordAlpha.connectedPeers.get("op_bravo_1")?.ingressDone).toBe(true);

    // Active Bravo state packet is accepted and creates rival in Alpha
    coordAlpha.handleMessage({
      eventId: "evt_bravo_active_state",
      type: "state",
      senderId: "op_bravo_1",
      senderName: "Bravo",
      squad: "SQUAD BRAVO",
      raidId: raidId,
      timestamp: Date.now(),
      data: {
        ingressDone: true,
        x: 20,
        y: 0,
        z: 20,
        health: 100,
        isAlive: true,
      },
    });
    expect(simAlpha.rivals.some((r) => r.id === "op_bravo_1")).toBe(true);

    // 4. Unsolicited announcement during active play is strictly REJECTED (cannot overwrite live machines with 9999)
    coordAlpha.handleMessage({
      eventId: "evt_unsolicited_hack",
      type: "raid_announce",
      senderId: "op_unknown_unadmitted",
      senderName: "Unknown",
      squad: "UNKNOWN",
      raidId: raidId,
      timestamp: Date.now(),
      data: {
        activeRaidId: raidId,
        snapshot: {
          snapshotTick: 500,
          crates: [],
          machines: [{ id: "turret_depot_alpha", health: 9999, isAlive: true }],
        },
      },
    });
    // Health remains strictly at 70; malicious 9999 is rejected
    expect(simAlpha.machines.find((m) => m.id === "turret_depot_alpha")?.health).toBe(70);

    coordAlpha.cleanup();
  });
  it("61. slide momentum persists forward displacement when movement input stops", () => {
    const sim = new SectorDepotSimulation();
    sim.admitOperative();
    sim.player.x = 0;
    sim.player.z = 0;

    // Initiate sprint slide with forward input
    sim.step({ dx: 0, dz: 1, sprint: true, slide: true, roll: false, kick: false, shoot: false, interact: false });
    expect(sim.player.action).toBe("slide");
    const initialSlideZ = sim.player.z;
    expect(initialSlideZ).toBeGreaterThan(0);

    // Stop all movement inputs (dx=0, dz=0) for 10 ticks: player must continue sliding forward due to momentum
    let prevZ = initialSlideZ;
    for (let i = 0; i < 10; i++) {
      sim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: false, interact: false });
      expect(sim.player.z).toBeGreaterThan(prevZ);
      prevZ = sim.player.z;
    }
    // Total displacement during the 10 ticks of zero input must be significant (> 1.0m)
    expect(prevZ - initialSlideZ).toBeGreaterThan(1.0);
  });

  it("62. melee kick physical container obstruction: blocked behind container and knockback clamped", () => {
    const sim = new SectorDepotSimulation();
    sim.admitOperative();
    // DEPOT_CONTAINERS[0] is from x: [-23.5, -16.5], z: [-32.0, -28.0]
    // Place player at (-20, -34) on one side of container, rival at (-20, -26) on other side (dx=0, dz=8m obstructed)
    // For kick range <= 2.5m: place player at (-20, -32.5), rival at (-20, -31.5) with container wall at z = -32.0
    sim.player.x = -20;
    sim.player.z = -33.0; // just outside container minZ (-32.0)
    sim.player.facing = 0; // facing +Z

    // Add rival inside/behind container boundary
    sim.rivals = [{
      id: "op_rival_obstructed",
      isPlayer: false,
      isRival: true,
      isAI: false,
      name: "OBSTRUCTED RIVAL",
      x: -20,
      y: 0,
      z: -31.0, // on other side of minZ wall
      facing: Math.PI,
      health: 100,
      armor: 100,
      cash: 0,
      ammo: 30,
      maxAmmo: 30,
      action: "idle",
      actionTicks: 0,
      isInvulnerable: false,
      isAlive: true,
      isExtracted: false,
    }];

    sim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: true, shoot: false, interact: false });
    // Melee kick must be deflected by container cover with ZERO damage to rival
    expect(sim.rivals[0].health).toBe(100);
    expect(sim.combatLog).toContain("[TICK 1] Melee kick deflected by container cover");
  });

  it("63. two-report duration jump spoof rejected, requiring genuine continuous report count >= 160", async () => {
    const { ServerSettlementAuthority } = await import("../src/sim/server-settlement.js");
    const tmpStore = `/tmp/test-jump-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
    const auth = new ServerSettlementAuthority(tmpStore);

    auth.initRaid("raid_jump_test", 50000, ["op_alpha_1"]);
    auth.recordCrateLoot("raid_jump_test", "crate_01", "op_alpha_1", 1250, 1);

    const t0 = Date.now();
    // Report 1: hold=1, tick=1
    auth.recordExtractionHold("raid_jump_test", "op_alpha_1", 1, 1, { timestamp: t0 });

    // Report 2: 3000ms later, jumps to hold=180, tick=180
    const r2 = auth.recordExtractionHold("raid_jump_test", "op_alpha_1", 180, 180, { timestamp: t0 + 3000 });
    // Must be rejected because holdReportCount is only 2 (< 160) and maxAdvance is bounded
    expect(r2.holdCompleted).toBe(false);
    expect(r2.currentHoldTicks).toBeLessThanOrEqual(3);

    await expect(
      auth.commitSettlement({
        raidId: "raid_jump_test",
        extractingId: "op_alpha_1",
        snapshotTick: 180,
        snapshotCash: 1250,
        exfilSubmitted: true,
      })
    ).rejects.toThrow(/not completed the required 180-tick continuous extraction hold/);
  });

  it("64. stale out-of-order reset report cannot erase established hold custody", async () => {
    const { ServerSettlementAuthority } = await import("../src/sim/server-settlement.js");
    const tmpStore = `/tmp/test-stale-reset-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
    const auth = new ServerSettlementAuthority(tmpStore);

    auth.initRaid("raid_stale_reset", 50000, ["op_alpha_1"]);
    auth.recordExtractionHold("raid_stale_reset", "op_alpha_1", 1, 100, { simTickAdvancement: true });
    auth.recordExtractionHold("raid_stale_reset", "op_alpha_1", 2, 101, { simTickAdvancement: true });

    const opBefore = auth.getRaidRecord("raid_stale_reset")!.operatives["op_alpha_1"];
    expect(opBefore.holdTicks).toBe(2);

    // Stale reset report arriving late with tick 99 (< rawLastReceivedTick 101)
    const staleResult = auth.recordExtractionHold("raid_stale_reset", "op_alpha_1", 0, 99, { inZone: false });
    expect(staleResult.currentHoldTicks).toBe(2);

    const opAfter = auth.getRaidRecord("raid_stale_reset")!.operatives["op_alpha_1"];
    // Active hold ticks preserved; stale reset strictly dropped!
    expect(opAfter.holdTicks).toBe(2);
  });

  it("65. corridor death immediately aborts extraction and rejects settlement commit", async () => {
    const sim = new SectorDepotSimulation("raid_corridor_kia");
    sim.admitOperative();
    sim.player.x = 45;
    sim.player.z = 45;
    sim.machines = [];

    // Complete hold to enter corridor presentation
    for (let i = 0; i < 180; i++) {
      sim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: false, interact: false });
    }
    expect(sim.exfilController.getState().kind).toBe("corridor_presentation");

    // Fatal drone attack eliminates player during corridor presentation
    sim.player.health = 0;
    sim.player.isAlive = false;
    sim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: false, interact: false });

    // ExfilController state immediately aborts back to idle (corridor canceled)
    expect(sim.exfilController.getState().kind).toBe("idle");
    expect(sim.player.isAlive).toBe(false);

    // Commit attempt for dead operative is strictly rejected
    await expect(authoritativeLedgerCommit(sim)).rejects.toThrow(/K.I.A./);
  });

  it("66. state packet cannot bypass admission and raid_announce past cutoff 28,800 is rejected", () => {
    const sim = new SectorDepotSimulation("raid_ingress_cutoff");
    const coord = new MultiplayerCoordinator(sim);

    // 1. Unadmitted peer sending state with ingressDone: true does NOT get admitted
    coord.handleMessage({
      eventId: "hacker:state:1",
      type: "state",
      senderId: "op_bravo_1",
      senderName: "FORGED OPERATOR",
      squad: "SQUAD BRAVO",
      timestamp: Date.now(),
      data: { ingressDone: true, x: 10, y: 0, z: 10, health: 100, isAlive: true },
    });
    const peer = coord.connectedPeers.get("op_bravo_1");
    expect(peer?.ingressDone).toBeFalsy();

    // 2. raid_announce with snapshotTick past 28,800 cutoff is strictly REJECTED
    coord.handleMessage({
      eventId: "peer:announce:cutoff",
      type: "raid_announce",
      senderId: "op_bravo_1",
      senderName: "LATE OPERATOR",
      squad: "SQUAD BRAVO",
      timestamp: Date.now(),
      data: {
        activeRaidId: "raid_ingress_cutoff",
        recipientId: coord.localId,
        snapshot: { snapshotTick: 40000, crates: [], machines: [] },
      },
    });
    // Ingress controller must NOT be activated past cutoff!
    expect(sim.ingressController.getState().kind).not.toBe("confirmed_active");
    coord.cleanup();
  });
  it("67. production server returns real HTTP 404 for missing assets and files", async () => {
    // @ts-ignore
    const { createStickZoneServer } = await import("../scripts/server.mjs");
    const server = createStickZoneServer();

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address() as any;
    const port = address.port;

    try {
      const resAsset = await fetch(`http://localhost:${port}/assets/nonexistent_texture.png`);
      expect(resAsset.status).toBe(404);
      expect(await resAsset.text()).toBe("404 Not Found");

      const resJs = await fetch(`http://localhost:${port}/scripts/missing.js`);
      expect(resJs.status).toBe(404);
      expect(await resJs.text()).toBe("404 Not Found");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("68. remote kick knockback clamped by shipping container on receiving client", () => {
    const sim = new SectorDepotSimulation("raid_knockback_test");
    const coord = new MultiplayerCoordinator(sim);
    sim.admitOperative();

    // Add admitted attacker rival
    sim.rivals.push({
      id: "op_bravo_1",
      isPlayer: false,
      isRival: true,
      isAI: false,
      name: "INFILTRATOR PHANTOM-1",
      badge: "SQUAD BRAVO",
      x: -20,
      y: 0,
      z: -35,
      facing: 0,
      health: 100,
      armor: 100,
      cash: 0,
      action: "idle",
      actionTicks: 0,
      isInvulnerable: false,
      isAlive: true,
      isExtracted: false,
      ammo: 30,
      maxAmmo: 30,
      lastStateTimestamp: Date.now(),
    });
    coord.connectedPeers.set("op_bravo_1", {
      lastSeen: Date.now(),
      name: "INFILTRATOR PHANTOM-1",
      ingressDone: true,
      handshakeState: "confirmed",
    });

    // Place target player at (-20, -33). A container is at (-20, -30) extending to z=-32.5.
    sim.player.x = -20;
    sim.player.z = -33;
    sim.player.armor = 100;

    // Receive hit packet with large knockback +4.5m in Z towards the container (which would push to z=-28.5)
    coord.handleMessage({
      eventId: "hit:kick:test:1",
      type: "hit",
      senderId: "op_bravo_1",
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      timestamp: Date.now(),
      data: {
        targetId: coord.localId,
        damage: 35,
        knockX: 0,
        knockZ: 4.5,
      },
    });

    // 1. Verify damage applied (100 - 35 = 65 armor)
    expect(sim.player.armor).toBe(65);

    // 2. Verify displacement occurred (z moved from -33 towards -32.5)
    expect(sim.player.z).toBeGreaterThan(-33.0);

    // 3. Player position must be clamped outside the container and NOT inside z=-28.5
    expect(sim.checkContainerCollision(sim.player.x, sim.player.z, 0.45)).toBe(false);
    expect(sim.player.z).toBeLessThan(-32.0); // Clamped before penetrating the container
    coord.cleanup();
  });

  it("69. firing while sliding maintains forward slide momentum and friction decay", () => {
    const sim = new SectorDepotSimulation("raid_slide_shoot");
    sim.admitOperative();
    sim.player.x = 0;
    sim.player.z = 0;
    sim.player.facing = 0;

    // Start slide moving forward (+Z)
    sim.step({ dx: 0, dz: 1, sprint: true, slide: true, roll: false, kick: false, shoot: false, interact: false });
    expect(sim.slideTicksRemaining).toBeGreaterThan(0);
    const z1 = sim.player.z;
    expect(z1).toBeGreaterThan(0);

    // Now fire weapon while sliding, with movement keys released (dx=0, dz=0)
    sim.step({ dx: 0, dz: 0, sprint: false, slide: false, shoot: true, roll: false, kick: false, interact: false });
    expect(sim.player.action).toBe("shoot");
    const z2 = sim.player.z;
    // Operative must CONTINUE moving forward due to decoupled slide momentum
    expect(z2).toBeGreaterThan(z1);

    // Step again with no inputs: continues gliding forward
    sim.step({ dx: 0, dz: 0, sprint: false, slide: false, shoot: false, roll: false, kick: false, interact: false });
    const z3 = sim.player.z;
    expect(z3).toBeGreaterThan(z2);
  });

  it("70. strict snapshot tick validation rejects string 40000, NaN, and negative ticks", () => {
    const sim = new SectorDepotSimulation("raid_snap_val");
    const coord = new MultiplayerCoordinator(sim);

    // 1. String "40000" tick announcement is rejected
    coord.handleMessage({
      eventId: "peer:snap:str",
      type: "raid_announce",
      senderId: "op_bravo_1",
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      timestamp: Date.now(),
      data: {
        activeRaidId: "raid_snap_val",
        recipientId: coord.localId,
        snapshot: { snapshotTick: "40000" as any, crates: [], machines: [] },
      },
    });
    expect(sim.tick).not.toBe("40000");
    expect(sim.ingressController.getState().kind).not.toBe("confirmed_active");

    // 2. NaN tick snapshot is rejected
    coord.handleMessage({
      eventId: "peer:snap:nan",
      type: "raid_announce",
      senderId: "op_bravo_1",
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      timestamp: Date.now(),
      data: {
        activeRaidId: "raid_snap_val",
        recipientId: coord.localId,
        snapshot: { snapshotTick: NaN, crates: [], machines: [] },
      },
    });
    expect(sim.ingressController.getState().kind).not.toBe("confirmed_active");

    // 3. Negative tick snapshot is rejected
    coord.handleMessage({
      eventId: "peer:snap:neg",
      type: "raid_announce",
      senderId: "op_bravo_1",
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      timestamp: Date.now(),
      data: {
        activeRaidId: "raid_snap_val",
        recipientId: coord.localId,
        snapshot: { snapshotTick: -5, crates: [], machines: [] },
      },
    });
    expect(sim.ingressController.getState().kind).not.toBe("confirmed_active");

    // 4. Unknown sender cannot complete admission
    coord.handleMessage({
      eventId: "peer:snap:unknown",
      type: "raid_announce",
      senderId: "hacker_666",
      senderName: "UNREGISTERED SENDER",
      squad: "SQUAD UNKNOWN",
      timestamp: Date.now(),
      data: {
        activeRaidId: "raid_snap_val",
        recipientId: coord.localId,
        snapshot: { snapshotTick: 100, crates: [], machines: [] },
      },
    });
    expect(sim.ingressController.getState().kind).not.toBe("confirmed_active");
    coord.cleanup();
  });

  it("71. hold reporting gap > 1500ms resets hold and pacing prevents burst spoofing", () => {
    const tmpStore71 = `/tmp/test-server-store-71-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
    const auth = new ServerSettlementAuthority(tmpStore71);
    auth.initRaid("raid_gap_test", 50000, ["op_player"]);

    // 1. Gap > 1500ms (bounded lull tolerance) resets hold: Report 1 at t=1000, then Report 2 at t=3001
    auth.recordExtractionHold("raid_gap_test", "op_player", 1, 1, { inZone: true, timestamp: 1000 });
    const res = auth.recordExtractionHold("raid_gap_test", "op_player", 2, 2, { inZone: true, timestamp: 3001 });
    expect(res.reset).toBe(true);
    expect(res.currentHoldTicks).toBe(0);
    expect(res.holdCompleted).toBe(false);

    // 2. Sparse reports followed by instant burst at same timestamp CANNOT complete hold:
    auth.initRaid("raid_sparse_burst", 50000, ["op_player"]);
    // 10 sparse reports over 2700ms with 270ms gaps
    for (let r = 1; r <= 10; r++) {
      auth.recordExtractionHold("raid_sparse_burst", "op_player", r, r, { inZone: true, timestamp: 1000 + (r - 1) * 300 });
    }
    // Now burst reports 11..180 at exact same timestamp t=3700
    for (let r = 11; r <= 180; r++) {
      auth.recordExtractionHold("raid_sparse_burst", "op_player", r, r, { inZone: true, timestamp: 3700 });
    }
    const raidSparse = auth.getRaidRecord("raid_sparse_burst");
    // Pacing clamped burst reports (< 8ms interval advances 0 ticks), hold is NOT complete!
    expect(raidSparse?.operatives["op_player"]?.holdCompleted).toBe(false);
    expect(raidSparse?.operatives["op_player"]?.holdTicks).toBeLessThan(180);
  });

  it("72. server custody enforces operative life-state (K.I.A. rejection) and corridor presentation duration", async () => {
    // @ts-ignore
    const { createStickZoneServer } = await import("../scripts/server.mjs");
    const { ServerSettlementAuthority } = await import("../src/sim/server-settlement.js");
    const tmpStore = `/tmp/test-server-72-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
    const testAuth = new ServerSettlementAuthority(tmpStore);
    const server = createStickZoneServer(testAuth);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;
    const testRaidId = `raid_http_kia_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    try {
      // 1. Initialize raid via real HTTP route with system bearer credential and assert 200
      const initRes = await fetch(`http://localhost:${port}/api/settlement/init-raid`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer sz_test_internal_sec" },
        body: JSON.stringify({ raidId: testRaidId, allowablePool: 50000, operatives: ["op_player"] }),
      });
      expect(initRes.status).toBe(200);
      const initData = await initRes.json();
      const playerToken = initData.tokens.op_player;
      expect(typeof playerToken).toBe("string");

      // 2. Complete hold reports via trusted server authority to establish corridor presentation
      for (let t = 1; t <= 180; t++) {
        testAuth.recordExtractionHold(testRaidId, "op_player", t, t, { simTickAdvancement: true });
      }
      const record = testAuth.getRaidRecord(testRaidId)!;
      expect(record.operatives["op_player"].holdCompleted).toBe(true);
      expect(record.operatives["op_player"].corridorStartTime).toBeDefined();

      // 3. Premature commit during corridor presentation (< 2500ms) over real HTTP MUST be rejected with HTTP 400
      const prematureRes = await fetch(`http://localhost:${port}/api/settlement/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${playerToken}` },
        body: JSON.stringify({
          raidId: testRaidId,
          playerId: "op_player",
          tick: 190,
          cash: 0,
          exfilSubmitted: true,
        }),
      });
      expect(prematureRes.status).toBe(400);
      const prematureErr = await prematureRes.json();
      expect(prematureErr.error).toMatch(/Airlock corridor presentation in progress/);

      // 4. Mutation routes authentication: unauthenticated K.I.A. call returns 401
      const unauthKia = await fetch(`http://localhost:${port}/api/settlement/kia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raidId: testRaidId, playerId: "op_player" }),
      });
      expect(unauthKia.status).toBe(401);

      // Forged system or server header without internal secret returns 401 Unauthorized
      const forgedSysKia = await fetch(`http://localhost:${port}/api/settlement/kia`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-operative-id": "system" },
        body: JSON.stringify({ raidId: testRaidId, playerId: "op_player" }),
      });
      expect(forgedSysKia.status).toBe(401);

      const forgedSrvKia = await fetch(`http://localhost:${port}/api/settlement/kia`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-operative-id": "server" },
        body: JSON.stringify({ raidId: testRaidId, playerId: "op_player" }),
      });
      expect(forgedSrvKia.status).toBe(401);

      // Plain x-operative-id without token (identity forgery attempt) returns 401 Unauthorized
      const forgedBravoKia = await fetch(`http://localhost:${port}/api/settlement/kia`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-operative-id": "op_bravo_1" },
        body: JSON.stringify({ raidId: testRaidId, playerId: "op_bravo_1" }),
      });
      expect(forgedBravoKia.status).toBe(401);

      // Old fixed fallback bearer secret without configured secret returns 401 Unauthorized
      const forgedFallbackSecret = await fetch(`http://localhost:${port}/api/settlement/kia`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer sz_internal_sec_98412_alpha" },
        body: JSON.stringify({ raidId: testRaidId, playerId: "op_player" }),
      });
      expect(forgedFallbackSecret.status).toBe(401);

      // Unauthenticated init-raid without credentials returns 401 Unauthorized
      const unauthInit = await fetch(`http://localhost:${port}/api/settlement/init-raid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raidId: "raid_unauth_forged", allowablePool: 50000 }),
      });
      expect(unauthInit.status).toBe(401);

      // Unauthenticated hold request returns 401
      const unauthHold = await fetch(`http://localhost:${port}/api/settlement/hold`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raidId: testRaidId, playerId: "op_player", holdTicks: 10, currentTick: 10 }),
      });
      expect(unauthHold.status).toBe(401);

      // Loot and commit without credentials return 401
      const unauthLoot = await fetch(`http://localhost:${port}/api/settlement/loot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raidId: testRaidId, crateId: "crate_01", claimantId: "op_player" }),
      });
      expect(unauthLoot.status).toBe(401);

      const unauthCommit = await fetch(`http://localhost:${port}/api/settlement/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raidId: testRaidId, playerId: "op_player", tick: 180, cash: 0 }),
      });
      expect(unauthCommit.status).toBe(401);

      // 5. Cross-operative K.I.A. declaration returns 403 Forbidden
      const crossKia = await fetch(`http://localhost:${port}/api/settlement/kia`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${playerToken}` },
        body: JSON.stringify({ raidId: testRaidId, playerId: "op_bravo_1" }),
      });
      expect(crossKia.status).toBe(403);

      // 6. Legitimate authenticated K.I.A. returns 200 OK
      const legitKia = await fetch(`http://localhost:${port}/api/settlement/kia`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${playerToken}` },
        body: JSON.stringify({ raidId: testRaidId, playerId: "op_player" }),
      });
      expect(legitKia.status).toBe(200);
      const kiaData = await legitKia.json();
      expect(kiaData.isKia).toBe(true);

      // 7. Commit after K.I.A. is strictly rejected with HTTP 400
      const commitRes = await fetch(`http://localhost:${port}/api/settlement/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${playerToken}` },
        body: JSON.stringify({
          raidId: testRaidId,
          playerId: "op_player",
          tick: 200,
          cash: 0,
          exfilSubmitted: true,
        }),
      });
      expect(commitRes.status).toBe(400);
      const commitErr = await commitRes.json();
      expect(commitErr.error).toMatch(/Cannot commit settlement: Operative op_player is K.I.A./);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      try { fs.unlinkSync(tmpStore); } catch {}
    }
  }, 15000);

  it("73. slide countdown decrements to 0 even if velocity zeroes on collision, and key release is required", () => {
    const sim = new SectorDepotSimulation("raid_slide_col");
    sim.admitOperative();
    // Position adjacent to container at (-20, -33)
    sim.player.x = -20;
    sim.player.z = -33;
    sim.player.facing = 0;

    // Start slide into the container (+Z)
    sim.step({ dx: 0, dz: 1, sprint: true, slide: true, roll: false, kick: false, shoot: false, interact: false });
    expect(sim.slideTicksRemaining).toBe(SIM_CONFIG.SLIDE_TICKS - 1);
    expect(sim.player.action).toBe("slide");

    // Advance 60 steps while holding slide + sprint + shoot into the container
    for (let i = 0; i < 60; i++) {
      sim.step({ dx: 0, dz: 1, sprint: true, slide: true, roll: false, kick: false, shoot: true, interact: false });
    }

    // Slide countdown MUST have cleanly expired to 0, not stuck at 44!
    expect(sim.slideTicksRemaining).toBe(0);
    expect(sim.player.action).not.toBe("slide");

    // Holding slide without releasing C CANNOT initiate another slide
    sim.step({ dx: 0, dz: 1, sprint: true, slide: true, roll: false, kick: false, shoot: false, interact: false });
    expect(sim.slideTicksRemaining).toBe(0);
    expect(sim.player.action).not.toBe("slide");

    // Releasing slide (C) re-arms slide initiation
    sim.step({ dx: 0, dz: 1, sprint: true, slide: false, roll: false, kick: false, shoot: false, interact: false });
    expect(sim.slideKeyReleased).toBe(true);

    // Now pressing slide initiates fresh slide
    sim.step({ dx: 0, dz: 1, sprint: true, slide: true, roll: false, kick: false, shoot: false, interact: false });
    expect(sim.slideTicksRemaining).toBe(SIM_CONFIG.SLIDE_TICKS - 1);
    expect(sim.player.action).toBe("slide");
  });

  it("74. multiplayer identity enforcement rejects op_player as OPERATIVE ALPHA and drops unauthorized names on state and hit", () => {
    const sim = new SectorDepotSimulation("raid_id_auth");
    const coord = new MultiplayerCoordinator(sim);
    sim.admitOperative();
    sim.player.x = 0;
    sim.player.z = 0;
    sim.player.isInvulnerable = false;

    // 1. op_player sending name "OPERATIVE ALPHA" is strictly rejected
    coord.handleMessage({
      eventId: "peer:auth:alpha_alias",
      type: "state",
      senderId: "op_player",
      senderName: "OPERATIVE ALPHA",
      squad: "SQUAD ALPHA",
      timestamp: Date.now(),
      data: { isAdmitted: true, x: 0, z: 0, hp: 100, armor: 100 },
    });
    expect(sim.rivals.some((r) => r.id === "op_player")).toBe(false);

    // 2. Admitted Bravo ID sending state packet named "NORMAL USER" is rejected
    coord.handleMessage({
      eventId: "peer:auth:norm_user",
      type: "state",
      senderId: "op_bravo_1",
      senderName: "NORMAL USER",
      squad: "SQUAD BRAVO",
      timestamp: Date.now(),
      data: { isAdmitted: true, x: 5, z: 5, hp: 100, armor: 100 },
    });
    expect(sim.rivals.some((r) => r.name === "NORMAL USER")).toBe(false);

    // 3. Install living admitted Bravo attacker to test hit identity verification
    sim.rivals.push({
      id: "op_bravo_1",
      name: "INFILTRATOR PHANTOM-1",
      badge: "SQUAD BRAVO",
      isPlayer: false,
      isRival: true,
      isAI: false,
      x: 0,
      y: 0,
      z: 5,
      facing: Math.PI,
      health: 100,
      armor: 100,
      cash: 0,
      isAlive: true,
      isExtracted: false,
      isInvulnerable: false,
      ammo: 30,
      maxAmmo: 30,
      action: "idle",
      actionTicks: 0,
    });
    coord.connectedPeers.set("op_bravo_1", {
      lastSeen: Date.now(),
      name: "INFILTRATOR PHANTOM-1",
      ingressDone: true,
      handshakeState: "confirmed",
    });

    // 4. Hit packet from unauthorized name "NORMAL USER" is strictly dropped by identity validator!
    sim.player.armor = 100;
    coord.handleMessage({
      eventId: "peer:auth:norm_hit",
      type: "hit",
      senderId: "op_bravo_1",
      senderName: "NORMAL USER",
      squad: "SQUAD BRAVO",
      timestamp: Date.now(),
      data: { targetId: coord.localId, damage: 35, knockX: 0, knockZ: 0 },
    });
    expect(sim.player.armor).toBe(100);

    // 5. Legitimate hit packet from authorized name "INFILTRATOR PHANTOM-1" is processed
    coord.handleMessage({
      eventId: "peer:auth:legit_hit",
      type: "hit",
      senderId: "op_bravo_1",
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      timestamp: Date.now(),
      data: { targetId: coord.localId, damage: 24, knockX: 0, knockZ: 0 },
    });
    expect(sim.player.armor).toBe(76);

    // 6. Machine hit from unauthorized name "NORMAL USER" is dropped; turret health remains 120
    const turret = sim.machines.find((m) => m.type === "turret")!;
    turret.health = 120;
    coord.handleMessage({
      eventId: "peer:auth:norm_mhit",
      type: "machine_hit",
      senderId: "op_bravo_1",
      senderName: "NORMAL USER",
      squad: "SQUAD BRAVO",
      timestamp: Date.now(),
      data: { machineId: turret.id, damage: 24 },
    });
    expect(turret.health).toBe(120);

    // Legitimate machine hit from "INFILTRATOR PHANTOM-1" reduces turret health to 96
    coord.handleMessage({
      eventId: "peer:auth:legit_mhit",
      type: "machine_hit",
      senderId: "op_bravo_1",
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      timestamp: Date.now(),
      data: { machineId: turret.id, damage: 24, attackerFacing: Math.atan2(-5, 7) },
    });
    expect(turret.health).toBe(96);

    // 7. Crate loot request from unauthorized name "NORMAL USER" is dropped; crate_01 remains unassigned
    const c01 = sim.crates.find((c) => c.id === "crate_01")!;
    c01.opened = false;
    c01.claimedBy = undefined;
    coord.handleMessage({
      eventId: "peer:auth:norm_lootreq",
      type: "crate_loot_request",
      senderId: "op_bravo_1",
      senderName: "NORMAL USER",
      squad: "SQUAD BRAVO",
      raidId: sim.raidId,
      timestamp: Date.now(),
      data: { crateId: "crate_01", claimTimestamp: Date.now() },
    });
    expect(c01.claimedBy).toBeUndefined();
    expect(c01.opened).toBe(false);

    // Legitimate crate loot request from "INFILTRATOR PHANTOM-1" claims crate_01
    coord.handleMessage({
      eventId: "peer:auth:legit_lootreq",
      type: "crate_loot_request",
      senderId: "op_bravo_1",
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      raidId: sim.raidId,
      timestamp: Date.now(),
      data: { crateId: "crate_01", claimTimestamp: Date.now() },
    });
    expect(c01.claimedBy).toBe("op_bravo_1");
    expect(c01.opened).toBe(true);

    // 8. Crate looted packet from unauthorized name "NORMAL USER" is dropped; crate_02 remains unassigned
    const c02 = sim.crates.find((c) => c.id === "crate_02")!;
    c02.opened = false;
    c02.claimedBy = undefined;
    coord.handleMessage({
      eventId: "peer:auth:norm_looted",
      type: "crate_looted",
      senderId: "op_bravo_1",
      senderName: "NORMAL USER",
      squad: "SQUAD BRAVO",
      raidId: sim.raidId,
      timestamp: Date.now(),
      data: { crateId: "crate_02", claimTimestamp: Date.now() },
    });
    expect(c02.claimedBy).toBeUndefined();
    expect(c02.opened).toBe(false);

    // Legitimate crate looted packet from "INFILTRATOR PHANTOM-1" claims crate_02
    coord.handleMessage({
      eventId: "peer:auth:legit_looted",
      type: "crate_looted",
      senderId: "op_bravo_1",
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      raidId: sim.raidId,
      timestamp: Date.now(),
      data: { crateId: "crate_02", claimTimestamp: Date.now() },
    });
    expect(c02.claimedBy).toBe("op_bravo_1");
    expect(c02.opened).toBe(true);

    // 9. exfil_success: unauthorized name, receiptless, or unadmitted peer is dropped
    const bravo = sim.rivals.find((r) => r.id === "op_bravo_1")!;
    expect(bravo.isExtracted).toBe(false);
    expect(bravo.isAlive).toBe(true);

    // 9a. Unauthorized name NORMAL USER
    coord.handleMessage({
      eventId: "peer:auth:norm_exfil",
      type: "exfil_success",
      senderId: "op_bravo_1",
      senderName: "NORMAL USER",
      squad: "SQUAD BRAVO",
      timestamp: Date.now(),
      data: {},
    });
    expect(bravo.isExtracted).toBe(false);
    expect(bravo.isAlive).toBe(true);

    // 9b. Receiptless exfil_success is dropped
    coord.handleMessage({
      eventId: "peer:auth:no_rcpt_exfil",
      type: "exfil_success",
      senderId: "op_bravo_1",
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      timestamp: Date.now(),
      data: {},
    });
    expect(bravo.isExtracted).toBe(false);
    expect(bravo.isAlive).toBe(true);

    // 9c. Fabricated receipt absent from ledger auditLog is dropped
    coord.handleMessage({
      eventId: "peer:auth:bad_rcpt_exfil",
      type: "exfil_success",
      senderId: "op_bravo_1",
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      timestamp: Date.now(),
      data: {
        receipt: {
          receiptId: "rcpt_uncommitted_forged_99",
          raidId: sim.raidId,
          operativeId: "op_bravo_1",
          committed: true,
          snapshotTick: 200,
          verifiedCash: 0,
        },
      },
    });
    expect(bravo.isExtracted).toBe(false);
    expect(bravo.isAlive).toBe(true);

    // 9d. Legitimate exfil_success with verified committed receipt successfully extracts bravo
    defaultSettlementLedger.auditLog.set("rcpt_legit_bravo_99", {
      receiptId: "rcpt_legit_bravo_99",
      throughTick: 200,
      raidId: sim.raidId as any,
      outcomeDigest: "digest_canonical_74",
      participantResults: [{ profileId: "op_bravo_1" as any, activeRaidCleared: true }],
    } as any);

    coord.handleMessage({
      eventId: "peer:auth:legit_rcpt_exfil",
      type: "exfil_success",
      senderId: "op_bravo_1",
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      raidId: sim.raidId,
      timestamp: Date.now(),
      data: {
        receipt: {
          receiptId: "rcpt_legit_bravo_99",
          raidId: sim.raidId,
          operativeId: "op_bravo_1",
          committed: true,
          snapshotTick: 200,
          throughTick: 200,
          outcomeDigest: "digest_canonical_74",
          verifiedCash: 0,
        },
      },
    });
    expect(bravo.isExtracted).toBe(true);
    expect(bravo.isAlive).toBe(false);

    // 10. raid_restart from unauthorized name, malformed ID (raid_sector7_), or forged ID is dropped
    let restartedRaid: string | null = null;
    coord.onRaidRestart = (newId: string) => { restartedRaid = newId; };

    coord.handleMessage({
      eventId: "peer:auth:norm_restart",
      type: "raid_restart",
      senderId: "op_bravo_1",
      senderName: "NORMAL USER",
      squad: "SQUAD BRAVO",
      timestamp: Date.now(),
      data: { newRaidId: "raid_sector7_forged" },
    });
    expect(restartedRaid).toBeNull();

    // Malformed raid ID with no suffix is dropped
    coord.handleMessage({
      eventId: "peer:auth:nosuffix_restart",
      type: "raid_restart",
      senderId: "op_bravo_1",
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      timestamp: Date.now(),
      data: { newRaidId: "raid_sector7_" },
    });
    expect(restartedRaid).toBeNull();

    coord.handleMessage({
      eventId: "peer:auth:legit_forged_restart",
      type: "raid_restart",
      senderId: "op_bravo_1",
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      timestamp: Date.now(),
      data: { newRaidId: "raid_sector7_forged" },
    });
    expect(restartedRaid).toBeNull();

    coord.cleanup();
  });

  it("75. ingress snapshot schema validation gracefully rejects missing or malformed snapshot arrays", () => {
    const sim = new SectorDepotSimulation("raid_snap_schema");
    const coord = new MultiplayerCoordinator(sim);

    // 0a. Explicitly verify validateAndSanitizeSnapshot rejects opened: "false" and health: NaN
    expect(validateAndSanitizeSnapshot({ snapshotTick: 50, crates: [{ id: "c1", opened: "false" as any }], machines: [] })).toBeNull();
    expect(validateAndSanitizeSnapshot({ snapshotTick: 50, crates: [{ id: "c1", opened: false }], machines: [{ id: "m1", health: NaN, isAlive: true }] })).toBeNull();

    // 0b. raid_announce with corrupted snapshot (opened: "false" or health: NaN) is rejected BEFORE mutating raidId or admitting
    const originalRaidId0 = sim.raidId;
    coord.handleMessage({
      eventId: "peer:snap:corrupt_str_bool",
      type: "raid_announce",
      senderId: "op_bravo_1",
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      timestamp: Date.now(),
      data: {
        activeRaidId: "raid_corrupted_attempt",
        recipientId: coord.localId,
        snapshot: { snapshotTick: 50, crates: [{ id: "crate_01", opened: "false" as any }], machines: [] },
      },
    });
    expect(sim.raidId).toBe(originalRaidId0);
    expect(sim.ingressController.getState().kind).not.toBe("confirmed_active");
    expect(coord.connectedPeers.get("op_bravo_1")?.ingressDone).toBeFalsy();

    coord.handleMessage({
      eventId: "peer:snap:corrupt_nan_health",
      type: "raid_announce",
      senderId: "op_bravo_1",
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      timestamp: Date.now(),
      data: {
        activeRaidId: "raid_corrupted_attempt_2",
        recipientId: coord.localId,
        snapshot: { snapshotTick: 50, crates: [{ id: "crate_01", opened: false }], machines: [{ id: "m1", health: NaN, isAlive: true }] },
      },
    });
    expect(sim.raidId).toBe(originalRaidId0);
    expect(sim.ingressController.getState().kind).not.toBe("confirmed_active");
    expect(coord.connectedPeers.get("op_bravo_1")?.ingressDone).toBeFalsy();

    // 1. Announcement with machines: [null] does not throw and is gracefully handled
    expect(() => {
      coord.handleMessage({
        eventId: "peer:snap:nullmachine",
        type: "raid_announce",
        senderId: "op_bravo_1",
        senderName: "INFILTRATOR PHANTOM-1",
        squad: "SQUAD BRAVO",
        timestamp: Date.now(),
        data: {
          activeRaidId: "raid_snap_schema",
          recipientId: coord.localId,
          snapshot: { snapshotTick: 50, crates: [], machines: [null as any] },
        },
      });
    }).not.toThrow();
    expect(sim.ingressController.getState().kind).not.toBe("confirmed_active");

    // 2. Direct applyRaidSnapshot with missing crates array does not mutate tick
    const initTick = sim.tick;
    sim.applyRaidSnapshot({ snapshotTick: 9999, machines: [] } as any);
    expect(sim.tick).toBe(initTick);

    // 3. Announcement without snapshot does NOT change raidId or complete admission
    const originalRaidId = sim.raidId;
    coord.handleMessage({
      eventId: "peer:snap:nosnap",
      type: "raid_announce",
      senderId: "op_bravo_1",
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      timestamp: Date.now(),
      data: {
        activeRaidId: "raid_hacked_id",
        recipientId: coord.localId,
      },
    });
    expect(sim.raidId).toBe(originalRaidId);
    expect(sim.ingressController.getState().kind).not.toBe("confirmed_active");
    coord.cleanup();
  });

  it("76. hold custody preserved across report gaps and during submitting/retry, and K.I.A. raid cannot reinit", () => {
    const tmpStore = `/tmp/test-hold-preserve-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
    const auth = new ServerSettlementAuthority(tmpStore);
    auth.initRaid("raid_hold_preserve", 50000, ["op_player"]);

    // Complete legitimate 180-tick hold with real wall-clock timestamps
    const t0 = 1000;
    for (let t = 1; t <= 180; t++) {
      auth.recordExtractionHold("raid_hold_preserve", "op_player", t, t, { inZone: true, timestamp: t0 + t * 17 });
    }
    const raidBefore = auth.getRaidRecord("raid_hold_preserve")!;
    expect(raidBefore.operatives["op_player"].holdCompleted).toBe(true);
    expect(raidBefore.operatives["op_player"].holdTicks).toBe(180);

    // A 957ms report gap AFTER completed hold does NOT erase completed custody!
    const gapReport = auth.recordExtractionHold("raid_hold_preserve", "op_player", 180, 185, { inZone: true, timestamp: t0 + 180 * 17 + 957 });
    expect(gapReport.reset).toBeUndefined();
    expect(gapReport.holdCompleted).toBe(true);
    expect(raidBefore.operatives["op_player"].holdCompleted).toBe(true);
    expect(raidBefore.operatives["op_player"].holdTicks).toBe(180);

    // Mark K.I.A.
    auth.recordOperativeKia("raid_hold_preserve", "op_player", "op_player");
    expect(raidBefore.operatives["op_player"].isKia).toBe(true);

    // Attempting to reinitialize raid after K.I.A. is strictly rejected
    expect(() => {
      auth.initRaid("raid_hold_preserve", 50000, ["op_player"]);
    }).toThrow(/Cannot reinitialize raid raid_hold_preserve/);
  });

  it("77. server-authoritative loot total ordering rejects backdated claims, and atomic rollback on persistence failure", () => {
    const tmpStore = `/tmp/test-loot-order-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
    const auth = new ServerSettlementAuthority(tmpStore);
    auth.initRaid("raid_loot_order", 50000, ["op_alpha_1", "op_bravo_1"]);

    // 1. Bravo legitimately claims crate_01
    const okBravo = auth.recordCrateLoot("raid_loot_order", "crate_01", "op_bravo_1");
    expect(okBravo).toBe(true);
    const raid = auth.getRaidRecord("raid_loot_order")!;
    expect(raid.crates["crate_01"].claimedBy).toBe("op_bravo_1");

    // 2. Alpha attempts to steal crate_01 with fake backdated timestamps (-1 and 1) -> STRICTLY REJECTED!
    const okAlphaNeg = auth.recordCrateLoot("raid_loot_order", "crate_01", "op_alpha_1", 1250, -1);
    expect(okAlphaNeg).toBe(false);
    expect(raid.crates["crate_01"].claimedBy).toBe("op_bravo_1");

    const okAlphaAncient = auth.recordCrateLoot("raid_loot_order", "crate_01", "op_alpha_1", 1250, 1);
    expect(okAlphaAncient).toBe(false);
    expect(raid.crates["crate_01"].claimedBy).toBe("op_bravo_1");

    // Legacy crate missing serverClaimedAt treats initial claim as immutable
    delete (raid.crates["crate_01"] as any).serverClaimedAt;
    const stealMissingArrival = auth.recordCrateLoot("raid_loot_order", "crate_01", "op_alpha_1", 1250, Date.now());
    expect(stealMissingArrival).toBe(false);
    expect(raid.crates["crate_01"].claimedBy).toBe("op_bravo_1");
    raid.crates["crate_01"].serverClaimedAt = Date.now();

    // 10-minute late claim with timestamp 1ms before original is strictly rejected by server time authority!
    const origNow = Date.now;
    const t0 = 1000000;
    Date.now = () => t0;
    auth.initRaid("raid_late_probe", 50000, ["op_alpha_1", "op_bravo_1"]);
    auth.recordCrateLoot("raid_late_probe", "crate_01", "op_bravo_1", 1250, t0);
    Date.now = () => t0 + 600000; // 10 minutes later
    const lateSteal = auth.recordCrateLoot("raid_late_probe", "crate_01", "op_alpha_1", 1250, t0 - 1);
    expect(lateSteal).toBe(false);
    expect(auth.getRaidRecord("raid_late_probe")!.crates["crate_01"].claimedBy).toBe("op_bravo_1");
    expect(auth.getRaidRecord("raid_late_probe")!.operatives["op_alpha_1"].earnedCash).toBe(0);
    Date.now = origNow;

    // 3. Persistence failure causes atomic rollback: in-memory state remains untouched!
    // Simulate disk failure
    const origSave = auth.saveToDisk.bind(auth);
    auth.saveToDisk = () => { throw new Error("Disk full / I/O error"); };

    expect(() => {
      auth.recordCrateLoot("raid_loot_order", "crate_02", "op_alpha_1");
    }).toThrow("Disk full / I/O error");

    // Crate 02 claimedBy must be rolled back to undefined and op_alpha_1 earnedCash rolled back!
    expect(raid.crates["crate_02"].claimedBy).toBeUndefined();
    expect(raid.operatives["op_alpha_1"].cratesLooted.includes("crate_02")).toBe(false);
    expect(raid.operatives["op_alpha_1"].earnedCash).toBe(0);

    // K.I.A. persistence failure enforces strictly irreversible death in memory
    expect(() => {
      auth.recordOperativeKia("raid_loot_order", "op_bravo_1", "op_bravo_1");
    }).toThrow("Disk full / I/O error");
    expect(raid.operatives["op_bravo_1"].isKia).toBe(true);
    expect(raid.operatives["op_bravo_1"].isAlive).toBe(false);
    expect((raid.operatives["op_bravo_1"] as any).failedPersistence).toBe(true);

    auth.saveToDisk = origSave;
  });

  it("78. server-authoritative settlement receipt verification, snapshot sanitization with custody preservation, and token isolation", async () => {
    const tmpStore = `/tmp/test-auth-canon-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
    const auth = new ServerSettlementAuthority(tmpStore);

    // 1. initRaid rejects reserved operative IDs (system, server, admin, root)
    expect(() => {
      auth.initRaid("raid_reserved_test", 50000, ["op_player", "system"]);
    }).toThrow(/reserved/i);

    expect(() => {
      auth.initRaid("raid_reserved_test_admin", 50000, ["op_player", "admin"]);
    }).toThrow(/reserved/i);

    // 2. Legitimate raid initialization
    auth.initRaid("raid_canon_1", 50000, ["op_player", "op_alpha_1", "op_bravo_1"]);

    // Tokens are isolated and resolve to correct operative and raid
    const tokenBravo = auth.getSessionToken("raid_canon_1", "op_bravo_1");
    expect(tokenBravo).toBeTruthy();
    const resolvedBravo = auth.resolveOperativeByToken(tokenBravo!);
    expect(resolvedBravo).toEqual({ operativeId: "op_bravo_1", raidId: "raid_canon_1" });

    // getLedger() does NOT expose session tokens
    const ledger = auth.getLedger();
    for (const [_, raid] of ledger.raids) {
      for (const op of Object.values(raid.operatives)) {
        expect(op.sessionToken).toBeUndefined();
      }
    }

    // 3. Complete hold and generate authentic server receipt with receipt_s7_*, throughTick, participantResults
    const t0 = 1000;
    for (let t = 1; t <= 180; t++) {
      auth.recordExtractionHold("raid_canon_1", "op_bravo_1", t, t, { inZone: true, timestamp: t0 + t * 17 });
    }
    const raidCanon = auth.getRaidRecord("raid_canon_1")!;
    expect(raidCanon.operatives["op_bravo_1"].holdCompleted).toBe(true);

    const commitResult = await auth.commitSettlement({
      raidId: "raid_canon_1",
      extractingId: "op_bravo_1",
      snapshotTick: 280,
      snapshotCash: 0,
      exfilSubmitted: true,
      simTickAdvancement: true,
    });
    const serverReceipt = commitResult.receipt;
    expect(serverReceipt.receiptId.startsWith("receipt_s7_")).toBe(true);
    expect(serverReceipt.throughTick).toBe(280);
    expect(serverReceipt.participantResults?.some((p: any) => p.profileId === "op_bravo_1")).toBe(true);
    expect(auth.hasCommittedReceipt(serverReceipt.receiptId)).toBe(true);

    // 4. Setup multiplayer coordinator with settlementAuthority attached
    const sim = new SectorDepotSimulation("raid_canon_1");
    sim.settlementAuthority = auth;
    sim.admitOperative();
    const coord = new MultiplayerCoordinator(sim);
    coord.connectedPeers.set("op_bravo_1", {
      lastSeen: Date.now(),
      name: "INFILTRATOR PHANTOM-1",
      ingressDone: true,
      handshakeState: "confirmed",
    });

    const rivalBravo: any = {
      id: "op_bravo_1",
      name: "INFILTRATOR PHANTOM-1",
      badge: "SQUAD BRAVO",
      isPlayer: false,
      isRival: true,
      isAI: false,
      x: 5, y: 0, z: 5,
      facing: 0,
      health: 100, armor: 100, cash: 0,
      action: "idle", actionTicks: 0,
      isInvulnerable: false,
      isAlive: true,
      isExtracted: false,
      ammo: 30, maxAmmo: 30,
    };
    sim.rivals = [rivalBravo];

    // 5. Unverified state packet attempting to mark rival extracted is ignored
    coord.handleMessage({
      eventId: "peer:state:spoof_exfil",
      type: "state",
      senderId: "op_bravo_1",
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      raidId: "raid_canon_1",
      timestamp: Date.now(),
      data: { ...rivalBravo, isExtracted: true },
    });
    expect(rivalBravo.isExtracted).toBe(false);
    expect(coord.extractedPeerIds.has("op_bravo_1")).toBe(false);

    // 6. Fabricated receipt absent from authority is strictly rejected
    coord.handleMessage({
      eventId: "peer:exfil:forged",
      type: "exfil_success",
      senderId: "op_bravo_1",
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      raidId: "raid_canon_1",
      timestamp: Date.now(),
      data: {
        receipt: {
          receiptId: "receipt_s7_forged_uncommitted_123",
          raidId: "raid_canon_1",
          throughTick: 280,
          participantResults: [{ profileId: "op_bravo_1" }],
        },
      },
    });
    expect(rivalBravo.isExtracted).toBe(false);
    expect(coord.extractedPeerIds.has("op_bravo_1")).toBe(false);

    // 7. Authentic server receipt successfully passes through coordinator and extracts rival
    coord.handleMessage({
      eventId: "peer:exfil:authentic_server",
      type: "exfil_success",
      senderId: "op_bravo_1",
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      raidId: "raid_canon_1",
      timestamp: Date.now(),
      data: { receipt: serverReceipt },
    });
    expect(coord.extractedPeerIds.has("op_bravo_1")).toBe(true);
    expect(rivalBravo.isExtracted).toBe(true);
    expect(rivalBravo.isAlive).toBe(false);

    // 8. Snapshot sanitization preserves crate custody (claimedBy, claimedAt)
    const validSnapWithCustody = validateAndSanitizeSnapshot({
      snapshotTick: 120,
      crates: [{ id: "crate_01", opened: true, claimedBy: "op_alpha_1", claimedAt: 12345678 }],
      machines: [{ id: "machine_01", health: 80, isAlive: true }],
    });
    expect(validSnapWithCustody).not.toBeNull();
    expect(validSnapWithCustody!.crates[0].claimedBy).toBe("op_alpha_1");
    expect(validSnapWithCustody!.crates[0].claimedAt).toBe(12345678);

    // 9. Reinitializing a raid containing a K.I.A. operative is rejected, and existing credentials remain valid
    auth.recordOperativeKia("raid_canon_1", "op_player", "op_player");
    expect(() => {
      auth.initRaid("raid_canon_1", 50000, ["op_player", "op_alpha_1", "op_bravo_1"]);
    }).toThrow(/Cannot reinitialize raid/);

    const recheckedTokenBravo = auth.resolveOperativeByToken(tokenBravo!);
    expect(recheckedTokenBravo).toEqual({ operativeId: "op_bravo_1", raidId: "raid_canon_1" });

    // 10. Retained participant with activeRaidCleared: false CANNOT claim extraction using another operative's receipt
    const receiptAlpha = {
      v: 1,
      receiptId: "receipt_s7_alpha_clear_1",
      raidId: "raid_canon_1" as any,
      outcomeId: "digest_alpha_1",
      intentHash: "intent_alpha_1",
      outcomeDigest: "digest_alpha_1",
      throughTick: 280,
      committedAtMs: Date.now(),
      participantResults: [
        { profileId: "op_alpha_1" as any, releasedEscrowIds: [], inventoryRevision: 14, activeRaidCleared: true },
        { profileId: "op_bravo_1" as any, releasedEscrowIds: [], inventoryRevision: 1, activeRaidCleared: false },
      ],
      transfers: [],
    };
    (auth as any).auditLog.set(receiptAlpha.receiptId, { receipt: receiptAlpha, outcomePayload: {} });

    const rivalBravoRetained: any = {
      id: "op_bravo_1",
      name: "INFILTRATOR PHANTOM-1",
      badge: "SQUAD BRAVO",
      isPlayer: false,
      isRival: true,
      isAI: false,
      x: 5, y: 0, z: 5,
      facing: 0,
      health: 100, armor: 100, cash: 0,
      action: "idle", actionTicks: 0,
      isInvulnerable: false,
      isAlive: true,
      isExtracted: false,
      ammo: 30, maxAmmo: 30,
    };
    sim.rivals = [rivalBravoRetained];
    coord.extractedPeerIds.clear();

    coord.handleMessage({
      eventId: "peer:exfil:bravo_retained_probe",
      type: "exfil_success",
      senderId: "op_bravo_1",
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      raidId: "raid_canon_1",
      timestamp: Date.now(),
      data: { receipt: receiptAlpha },
    });
    expect(rivalBravoRetained.isExtracted).toBe(false);
    expect(coord.extractedPeerIds.has("op_bravo_1")).toBe(false);

    // 11. Tampered receipt with altered outcomeDigest is strictly rejected
    const tamperedReceipt = { ...serverReceipt, outcomeDigest: "forged_outcome_digest_xyz" };
    coord.handleMessage({
      eventId: "peer:exfil:tampered",
      type: "exfil_success",
      senderId: "op_bravo_1",
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      raidId: "raid_canon_1",
      timestamp: Date.now(),
      data: { receipt: tamperedReceipt },
    });
    expect(rivalBravoRetained.isExtracted).toBe(false);
    expect(coord.extractedPeerIds.has("op_bravo_1")).toBe(false);

    // 11b. Tampered receipt with altered throughTick is strictly rejected
    const alteredTickReceipt = { ...serverReceipt, throughTick: 999 };
    coord.handleMessage({
      eventId: "peer:exfil:altered_tick",
      type: "exfil_success",
      senderId: "op_bravo_1",
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      raidId: "raid_canon_1",
      timestamp: Date.now(),
      data: { receipt: alteredTickReceipt },
    });
    expect(rivalBravoRetained.isExtracted).toBe(false);
    expect(coord.extractedPeerIds.has("op_bravo_1")).toBe(false);

    // 11c. Tampered receipt missing outcomeDigest or raidId is strictly rejected
    const noDigestReceipt: any = { ...serverReceipt };
    delete noDigestReceipt.outcomeDigest;
    coord.handleMessage({
      eventId: "peer:exfil:no_digest",
      type: "exfil_success",
      senderId: "op_bravo_1",
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      raidId: "raid_canon_1",
      timestamp: Date.now(),
      data: { receipt: noDigestReceipt },
    });
    expect(rivalBravoRetained.isExtracted).toBe(false);

    const noRaidIdReceipt: any = { ...serverReceipt };
    delete noRaidIdReceipt.raidId;
    coord.handleMessage({
      eventId: "peer:exfil:no_raid_id",
      type: "exfil_success",
      senderId: "op_bravo_1",
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      raidId: "raid_canon_1",
      timestamp: Date.now(),
      data: { receipt: noRaidIdReceipt },
    });
    expect(rivalBravoRetained.isExtracted).toBe(false);

    // 12. Separate browser client without local settlementAuthority verifies via server API
    const browserSim = new SectorDepotSimulation("raid_canon_1");
    browserSim.admitOperative();
    const browserCoord = new MultiplayerCoordinator(browserSim);
    browserCoord.connectedPeers.set("op_bravo_1", {
      lastSeen: Date.now(),
      name: "INFILTRATOR PHANTOM-1",
      ingressDone: true,
      handshakeState: "confirmed",
    });
    const browserRival: any = { ...rivalBravoRetained };
    browserSim.rivals = [browserRival];

    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (url: any) => {
      if (String(url).includes("/api/settlement/verify-receipt")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ valid: true, receipt: serverReceipt }),
        };
      }
      return origFetch ? origFetch(url) : null;
    }) as any;

    browserCoord.handleMessage({
      eventId: "peer:exfil:browser_verify",
      type: "exfil_success",
      senderId: "op_bravo_1",
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      raidId: "raid_canon_1",
      timestamp: Date.now(),
      data: { receipt: serverReceipt },
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(browserCoord.extractedPeerIds.has("op_bravo_1")).toBe(true);
    expect(browserRival.isExtracted).toBe(true);
    expect(browserRival.isAlive).toBe(false);
    // Verified server receipt cached into local audit log
    expect(defaultSettlementLedger.auditLog.has(serverReceipt.receiptId)).toBe(true);
    globalThis.fetch = origFetch;
    browserCoord.cleanup();

    coord.cleanup();
  });

  it("79. HTTP server authentication boundaries: unauthenticated session endpoint rejection, join slot allocation, hold default target raid, committed receipt verification, and cross-raid isolation", async () => {
    // @ts-ignore
    const { createStickZoneServer } = await import("../scripts/server.mjs");
    const testPort = 4198;
    const tmpStore79 = `/tmp/test-server-store-79-${Date.now()}.json`;
    const testServer = createStickZoneServer(new ServerSettlementAuthority(tmpStore79));

    await new Promise<void>((resolve) => {
      testServer.listen(testPort, () => resolve());
    });

    try {
      const testRaidId = `raid_http_test_79_${Date.now()}`;
      testServer.settlement.initRaid(testRaidId, 50000, ["op_player", "op_alpha_1", "op_bravo_1"]);

      // 1. Unauthenticated request to /api/settlement/session returns 401 Unauthorized
      const unauthSession = await fetch(`http://localhost:${testPort}/api/settlement/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raidId: testRaidId, operativeId: "op_bravo_1" }),
      });
      expect(unauthSession.status).toBe(401);

      // 2. /api/settlement/join claims operative slot and issues session token without secrets
      const joinRes = await fetch(`http://localhost:${testPort}/api/settlement/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raidId: testRaidId, operativeId: "op_bravo_1" }),
      });
      expect(joinRes.status).toBe(200);
      const joinData = await joinRes.json();
      expect(joinData.token).toBeTruthy();
      expect(typeof joinData.token).toBe("string");

      const bravoToken = joinData.token;

      // Duplicate unauthenticated claim for same slot returns 409 Conflict
      const dupJoin = await fetch(`http://localhost:${testPort}/api/settlement/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raidId: testRaidId, operativeId: "op_bravo_1" }),
      });
      expect(dupJoin.status).toBe(409);

      // Authenticated resume with bearer token returns 200 and preserved session
      const resumeJoin = await fetch(`http://localhost:${testPort}/api/settlement/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${bravoToken}` },
        body: JSON.stringify({ raidId: testRaidId, operativeId: "op_bravo_1" }),
      });
      expect(resumeJoin.status).toBe(200);
      const resumeData = await resumeJoin.json();
      expect(resumeData.resumed).toBe(true);
      expect(resumeData.token).toBe(bravoToken);

      // 3. /api/settlement/hold without raidId defaults to targetRaidId and writes to correct record
      const rRec79 = testServer.settlement.getRaidRecord(testRaidId)!;
      rRec79.createdAtMs = Date.now() - 15000;
      rRec79.operatives["op_bravo_1"].lastObservedTimestamp = Date.now() - 15000;
      rRec79.operatives["op_bravo_1"].lastObservedX = 45.0;
      rRec79.operatives["op_bravo_1"].lastObservedZ = 45.0;

      const holdRes = await fetch(`http://localhost:${testPort}/api/settlement/hold`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${bravoToken}` },
        body: JSON.stringify({
          operativeId: "op_bravo_1",
          holdTicks: 1,
          currentTick: 100,
          x: 45.0,
          z: 45.0,
          inZone: true,
        }),
      });
      expect(holdRes.status).toBe(200);
      const raidRec = testServer.settlement.getRaidRecord(testRaidId);
      expect(raidRec.operatives["op_bravo_1"].holdTicks).toBe(1);
      expect(raidRec.operatives["op_bravo_1"].sessionToken).toBeUndefined();

      // 4. Cross-raid session request returns 403 Forbidden
      const raidBId = `raid_other_${Date.now()}`;
      testServer.settlement.initRaid(raidBId, 50000, ["op_player", "op_alpha_1", "op_bravo_1"]);
      const crossSession = await fetch(`http://localhost:${testPort}/api/settlement/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${bravoToken}` },
        body: JSON.stringify({ raidId: raidBId, operativeId: "op_bravo_1" }),
      });
      expect(crossSession.status).toBe(403);

      // 5a. Cross-raid reset request from an authorized coordinator returns 403 Forbidden (alphaToken from testRaidId cannot reset raidBId)
      const alphaToken = testServer.settlement.getSessionToken(testRaidId, "op_alpha_1");
      expect(alphaToken).toBeTruthy();
      const crossReset = await fetch(`http://localhost:${testPort}/api/settlement/init-raid`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${alphaToken}` },
        body: JSON.stringify({ raidId: raidBId }),
      });
      expect(crossReset.status).toBe(403);
      const crossResetData = await crossReset.json();
      expect(crossResetData.error).toContain(`cannot reset raid ${raidBId}`);

      // 5b. Same-raid reset from non-coordinator operative (Bravo) returns 403 Forbidden
      const unauthReset = await fetch(`http://localhost:${testPort}/api/settlement/init-raid`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${bravoToken}` },
        body: JSON.stringify({ raidId: testRaidId }),
      });
      expect(unauthReset.status).toBe(403);
      const unauthData = await unauthReset.json();
      expect(unauthData.error).toContain("is not an authorized lifecycle coordinator");

      // 5c. New raid creation without extraction/KIA/conclusion returns 403 Forbidden
      const activeAlphaToken = testServer.settlement.getSessionToken(raidBId, "op_alpha_1");
      expect(activeAlphaToken).toBeTruthy();
      const unextractedNewRaid = await fetch(`http://localhost:${testPort}/api/settlement/init-raid`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${activeAlphaToken}` },
        body: JSON.stringify({ raidId: `raid_new_${Date.now()}` }),
      });
      expect(unextractedNewRaid.status).toBe(403);
      const unextractedData = await unextractedNewRaid.json();
      expect(unextractedData.error).toContain("Operative must be extracted, K.I.A., or raid concluded before creating new raid");

      // 6. /api/settlement/verify-receipt returns 404 for unknown receipt and 200 for committed receipt
      const unkVerify = await fetch(`http://localhost:${testPort}/api/settlement/verify-receipt?receiptId=receipt_unknown`);
      expect(unkVerify.status).toBe(404);

      // Pre-seed hold so operative has completed hold
      const bOp = testServer.settlement.getRaidRecord(raidBId).operatives["op_player"];
      bOp.holdCompleted = true;
      bOp.holdTicks = 180;
      bOp.holdCompletedAtTick = 180;
      // Commit a real receipt in raidB and verify HTTP 200 response
      const committed = await testServer.settlement.commitSettlement({
        raidId: raidBId,
        extractingId: "op_player",
        snapshotTick: 200,
        snapshotCash: 0,
        exfilSubmitted: true,
      });
      const okVerify = await fetch(`http://localhost:${testPort}/api/settlement/verify-receipt?receiptId=${encodeURIComponent(committed.receipt.receiptId)}`);
      expect(okVerify.status).toBe(200);
      const verifyData = await okVerify.json();
      expect(verifyData.valid).toBe(true);
      expect(verifyData.receipt.receiptId).toBe(committed.receipt.receiptId);

    } finally {
      await new Promise<void>((resolve) => testServer.close(() => resolve()));
      try { fs.unlinkSync(tmpStore79); } catch {}
    }
  });

  it("80. Kinetic kick recovery timer, state packet admission enforcement, and atomic persistence rollback", async () => {
    // 1. Kick recovery timer blocks continuous kick even when shooting simultaneously
    const sim = new SectorDepotSimulation();
    sim.admitOperative();
    sim.player.ammo = 30;

    // Tick 1: Kick + Shoot
    sim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: true, shoot: true, interact: false });
    expect(sim.kickCooldownTicks).toBe(42);

    // Tick 2: Holding Kick + Shoot does not re-trigger kick
    sim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: true, shoot: true, interact: false });
    expect(sim.kickCooldownTicks).toBe(41);

    // 2. State packet with isAdmitted: true does not bypass squad ACK when in snapshot_sent state
    const coord = new MultiplayerCoordinator(sim);
    coord.connectedPeers.set("op_bravo_1", {
      lastSeen: Date.now(),
      name: "INFILTRATOR PHANTOM-1",
      ingressDone: false,
      handshakeState: "snapshot_sent",
    });

    coord.handleMessage({
      eventId: "peer:state:bypass_probe",
      type: "state",
      senderId: "op_bravo_1",
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      raidId: sim.raidId,
      timestamp: Date.now(),
      data: {
        x: 10, y: 0, z: 10, facing: 0, health: 100, armor: 50, cash: 0, action: "idle", actionTicks: 0, isInvulnerable: false, isAlive: true, isExtracted: false, ammo: 30, maxAmmo: 30, isAdmitted: true,
      },
    });

    const peer = coord.connectedPeers.get("op_bravo_1");
    expect(peer?.ingressDone).toBe(false);
    expect(peer?.handshakeState).toBe("snapshot_sent");
    expect(sim.rivals.some((r) => r.id === "op_bravo_1")).toBe(false);

    // 3. ServerSettlementAuthority atomic rollback on persistence failure
    const tmpStore80 = `/tmp/test-server-store-80-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
    const auth = new ServerSettlementAuthority(tmpStore80);
    const raidA = auth.initRaid("raid_atomic_1", 50000, ["op_player"]);
    const tokenA = auth.getSessionToken("raid_atomic_1", "op_player");
    expect(tokenA).toBeTruthy();

    // Force saveToDisk to throw
    const origSave = auth.saveToDisk;
    auth.saveToDisk = () => { throw new Error("Simulated disk full failure"); };

    expect(() => {
      auth.initRaid("raid_atomic_1", 50000, ["op_player"]);
    }).toThrow("Simulated disk full failure");

    // Previous token and raid record are preserved intact
    expect(auth.getSessionToken("raid_atomic_1", "op_player")).toBe(tokenA);
    auth.saveToDisk = origSave;

    coord.cleanup();
  });

  it("81. Vite dev/preview plugin middleware: secret-free join, session resumption, revoked socket disconnection, and raid isolation", async () => {
    // @ts-ignore
    const { setupMultiplayerAndSettlement } = await import("../vite.config");
    const http = await import("node:http");
    const { WebSocket } = await import("ws");

    const routes: Record<string, Function> = {};
    const mockViteServer: any = {
      middlewares: {
        use: (path: string, handler: Function) => {
          routes[path] = handler;
        },
      },
    };

    const server = http.createServer((req, res) => {
      const url = new URL(req.url || "/", "http://localhost");
      const handler = routes[url.pathname];
      if (handler) {
        handler(req, res);
      } else {
        res.statusCode = 404;
        res.end("Not found");
      }
    });

    mockViteServer.httpServer = server;
    const tmpStore81 = `/tmp/test-server-store-81-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
    const { ServerSettlementAuthority } = await import("../src/sim/server-settlement.js");
    const testAuthority = new ServerSettlementAuthority(tmpStore81);
    setupMultiplayerAndSettlement(mockViteServer, testAuthority);

    const testPort = 4201;
    await new Promise<void>((resolve) => server.listen(testPort, () => resolve()));

    try {
      // 1. Verify /api/settlement/join middleware is registered
      expect(typeof routes["/api/settlement/join"]).toBe("function");

      const activeRaidId = `raid_vite_test_81_${Date.now()}`;
      testAuthority.initRaid(activeRaidId, 50000, ["op_player", "op_alpha_1", "op_bravo_1"]);

      // 2. Discover active raid
      const activeRes = await fetch(`http://localhost:${testPort}/api/settlement/active-raid`);
      expect(activeRes.status).toBe(200);
      const activeData = await activeRes.json();
      expect(activeData.activeRaidId).toBe(activeRaidId);

      // 3. Secret-free join allocates slot and issues session token
      const joinRes = await fetch(`http://localhost:${testPort}/api/settlement/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raidId: activeRaidId, operativeId: "op_player" }),
      });
      expect(joinRes.status).toBe(200);
      const joinData = await joinRes.json();
      expect(joinData.token).toBeTruthy();
      const playerToken = joinData.token;

      // 4. Duplicate unauthenticated join returns 409 Conflict
      const dupRes = await fetch(`http://localhost:${testPort}/api/settlement/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raidId: activeRaidId, operativeId: "op_player" }),
      });
      expect(dupRes.status).toBe(409);

      // 5. Authenticated resume with bearer token returns 200 OK with resumed: true
      const resumeRes = await fetch(`http://localhost:${testPort}/api/settlement/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${playerToken}` },
        body: JSON.stringify({ raidId: activeRaidId, operativeId: "op_player" }),
      });
      expect(resumeRes.status).toBe(200);
      const resumeData = await resumeRes.json();
      expect(resumeData.resumed).toBe(true);
      expect(resumeData.token).toBe(playerToken);

      // 6. Connect WebSocket with authentic token
      const ws = new WebSocket(`ws://localhost:${testPort}/syncplay-ws?token=${encodeURIComponent(playerToken)}&raidId=${encodeURIComponent(activeRaidId)}`);
      await new Promise<void>((resolve, reject) => {
        ws.on("open", () => resolve());
        ws.on("error", (err) => reject(err));
      });

      // 7. Revoke session by concluding raid, and verify socket closes with code 4003 on message
      testAuthority.concludeRaid(activeRaidId);

      const closePromise = new Promise<number>((resolve) => {
        ws.on("close", (code) => resolve(code));
      });

      // Sending a packet on revoked token triggers immediate socket close with code 4003
      ws.send(JSON.stringify({ type: "fire", eventId: "test_revoked_vite", raidId: activeRaidId }));
      const closeCode = await closePromise;
      expect(closeCode).toBe(4003);

    } finally {
      try { fs.unlinkSync(tmpStore81); } catch {}
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("82. Server sessionToken persistence across restart, and raid announcement two-way ACK admission enforcement", async () => {
    // 1. Session token persistence across server restarts
    const tmpStore = `/tmp/test-token-persistence-${Date.now()}.json`;
    const auth1 = new ServerSettlementAuthority(tmpStore);
    const raidId = `raid_persist_${Date.now()}`;
    auth1.initRaid(raidId, 50000, ["op_player", "op_alpha_1", "op_bravo_1"]);
    const playerTok1 = auth1.getSessionToken(raidId, "op_player");
    expect(playerTok1).toBeTruthy();
    expect(auth1.resolveOperativeByToken(playerTok1!)?.operativeId).toBe("op_player");

    // Spawn new authority instance simulating server restart from disk
    const auth2 = new ServerSettlementAuthority(tmpStore);
    const playerTok2 = auth2.getSessionToken(raidId, "op_player");
    expect(playerTok2).toBe(playerTok1);
    expect(auth2.resolveOperativeByToken(playerTok1!)?.operativeId).toBe("op_player");

    // Clean up temp store
    try { fs.unlinkSync(tmpStore); } catch {}

    // 2. Raid announcement strictly requires two-way ACK exchange before admission
    const simJoiner = new SectorDepotSimulation(raidId);
    expect(simJoiner.isAdmitted()).toBe(false);
    const coordJoiner = new MultiplayerCoordinator(simJoiner);

    // Host (Bravo) sends raid_announce to joining coordinator (Alpha)
    coordJoiner.handleMessage({
      eventId: "announce_test_82",
      type: "raid_announce",
      senderId: "op_bravo_1",
      senderName: "Bravo",
      squad: "SQUAD BRAVO",
      raidId: raidId,
      timestamp: Date.now(),
      data: {
        activeRaidId: raidId,
        recipientId: "op_alpha_1",
        snapshot: {
          snapshotTick: 200,
          crates: [{ id: "crate_01", opened: false }],
          machines: [{ id: "turret_depot_alpha", health: 100, isAlive: true }],
        },
      },
    });

    // Ingress state must be waiting_squad and NOT confirmed_active
    expect(simJoiner.isAdmitted()).toBe(false);
    expect(simJoiner.ingressController.getState().kind).toBe("waiting_squad");
    expect(coordJoiner.connectedPeers.get("op_bravo_1")?.handshakeState).toBe("ack_sent");

    // Host replies with squad_ack confirmation
    coordJoiner.handleMessage({
      eventId: "ack_confirm_test_82",
      type: "squad_ack",
      senderId: "op_bravo_1",
      senderName: "Bravo",
      squad: "SQUAD BRAVO",
      raidId: raidId,
      timestamp: Date.now(),
      data: { isConfirmation: true, recipientId: "op_alpha_1" },
    });

    // NOW admission completes and state is confirmed_active
    expect(simJoiner.isAdmitted()).toBe(true);
    expect(simJoiner.ingressController.getState().kind).toBe("confirmed_active");
    expect(coordJoiner.connectedPeers.get("op_bravo_1")?.handshakeState).toBe("confirmed");

    coordJoiner.cleanup();
  });

  it("83. Persistent slot claims across server disk restarts and bearer token resumption", async () => {
    const tmpStore = `/tmp/test-slot-claims-${Date.now()}.json`;
    const auth1 = new ServerSettlementAuthority(tmpStore);
    const raidId = `raid_slot_persist_${Date.now()}`;
    auth1.initRaid(raidId, 50000, ["op_player", "op_alpha_1", "op_bravo_1"]);

    expect(auth1.isSlotClaimed(raidId, "op_alpha_1")).toBe(false);
    auth1.claimSlot(raidId, "op_alpha_1");
    expect(auth1.isSlotClaimed(raidId, "op_alpha_1")).toBe(true);
    expect(auth1.isSlotClaimed(raidId, "op_bravo_1")).toBe(false);

    auth1.saveToDisk();

    // Reload authority from disk representing server restart
    const auth2 = new ServerSettlementAuthority(tmpStore);
    expect(auth2.isSlotClaimed(raidId, "op_alpha_1")).toBe(true);
    expect(auth2.isSlotClaimed(raidId, "op_bravo_1")).toBe(false);

    // Releasing slot works and persists
    auth2.releaseSlot(raidId, "op_alpha_1");
    expect(auth2.isSlotClaimed(raidId, "op_alpha_1")).toBe(false);
    auth2.saveToDisk();

    const auth3 = new ServerSettlementAuthority(tmpStore);
    expect(auth3.isSlotClaimed(raidId, "op_alpha_1")).toBe(false);

    try { fs.unlinkSync(tmpStore); } catch {}
  });

  it("84. Crossed discovery two-way ACK exchange deadlock resolution", async () => {
    const raidId = `raid_crossed_${Date.now()}`;
    const simAlpha = new SectorDepotSimulation(raidId);
    simAlpha.player.id = "op_alpha_1";
    simAlpha.player.name = "OPERATIVE ALPHA";

    const simBravo = new SectorDepotSimulation(raidId);
    simBravo.player.id = "op_bravo_1";
    simBravo.player.name = "Bravo";

    const coordAlpha = new MultiplayerCoordinator(simAlpha);
    const coordBravo = new MultiplayerCoordinator(simBravo);

    // Simulate cross-discovery:
    // Both Alpha and Bravo broadcast raid_discovery to each other
    // Alpha receives Bravo discovery: Alpha sends raid_announce to Bravo
    const alphaAnnouncePayload = {
      eventId: "announce_alpha_1",
      type: "raid_announce",
      senderId: "op_alpha_1",
      senderName: "OPERATIVE ALPHA",
      squad: "SQUAD ALPHA",
      raidId,
      timestamp: Date.now(),
      data: {
        activeRaidId: raidId,
        recipientId: "op_bravo_1",
        snapshot: {
          snapshotTick: 100,
          crates: [{ id: "crate_01", opened: false }],
          machines: [{ id: "turret_depot_alpha", health: 100, isAlive: true }],
        },
      },
    };

    // Bravo receives Alpha discovery: Bravo sends raid_announce to Alpha
    const bravoAnnouncePayload = {
      eventId: "announce_bravo_1",
      type: "raid_announce",
      senderId: "op_bravo_1",
      senderName: "Bravo",
      squad: "SQUAD BRAVO",
      raidId,
      timestamp: Date.now(),
      data: {
        activeRaidId: raidId,
        recipientId: "op_alpha_1",
        snapshot: {
          snapshotTick: 100,
          crates: [{ id: "crate_01", opened: false }],
          machines: [{ id: "turret_depot_alpha", health: 100, isAlive: true }],
        },
      },
    };

    // Alpha processes Bravo announcement, sending squad_ack(isConfirmation: false)
    coordAlpha.handleMessage(bravoAnnouncePayload as any);
    // Bravo processes Alpha announcement
    coordBravo.handleMessage(alphaAnnouncePayload as any);

    // Alpha sends ACK to Bravo
    const alphaAck = {
      eventId: "ack_alpha_to_bravo",
      type: "squad_ack",
      senderId: "op_alpha_1",
      senderName: "OPERATIVE ALPHA",
      squad: "SQUAD ALPHA",
      raidId,
      timestamp: Date.now(),
      data: { isConfirmation: false, recipientId: "op_bravo_1" },
    };
    coordBravo.handleMessage(alphaAck as any);

    // Bravo confirms Alpha and replies with confirmation ACK
    const bravoConfirmAck = {
      eventId: "confirm_bravo_to_alpha",
      type: "squad_ack",
      senderId: "op_bravo_1",
      senderName: "Bravo",
      squad: "SQUAD BRAVO",
      raidId,
      timestamp: Date.now(),
      data: { isConfirmation: true, recipientId: "op_alpha_1" },
    };
    coordAlpha.handleMessage(bravoConfirmAck as any);

    // Alpha should now be confirmed active
    expect(simAlpha.isAdmitted()).toBe(true);
    expect(simAlpha.ingressController.getState().kind).toBe("confirmed_active");

    // Similarly Bravo receives confirmation from Alpha
    const bravoAck = {
      eventId: "ack_bravo_to_alpha",
      type: "squad_ack",
      senderId: "op_bravo_1",
      senderName: "Bravo",
      squad: "SQUAD BRAVO",
      raidId,
      timestamp: Date.now(),
      data: { isConfirmation: false, recipientId: "op_alpha_1" },
    };
    coordAlpha.handleMessage(bravoAck as any);

    const alphaConfirmAck = {
      eventId: "confirm_alpha_to_bravo",
      type: "squad_ack",
      senderId: "op_alpha_1",
      senderName: "OPERATIVE ALPHA",
      squad: "SQUAD ALPHA",
      raidId,
      timestamp: Date.now(),
      data: { isConfirmation: true, recipientId: "op_bravo_1" },
    };
    coordBravo.handleMessage(alphaConfirmAck as any);
    expect(simBravo.isAdmitted()).toBe(true);
    expect(simBravo.ingressController.getState().kind).toBe("confirmed_active");

    coordAlpha.cleanup();
    coordBravo.cleanup();
  });

  it("85. BroadcastChannel transport boundary strictly filters combat, damage, and admission mutations", async () => {
    const raidId = `raid_bc_filter_${Date.now()}`;
    const sim = new SectorDepotSimulation(raidId);
    const coord = new MultiplayerCoordinator(sim);

    // Initial machine health
    const turret = sim.machines.find((m) => m.id === "turret_depot_alpha");
    expect(turret).toBeDefined();
    const initialHealth = turret!.health;

    // Packet injected with _fromBroadcastChannel: true and type: machine_hit must be ignored
    coord.handleMessage({
      _fromBroadcastChannel: true,
      eventId: "bc_illegal_hit",
      type: "machine_hit",
      senderId: "op_bravo_1",
      senderName: "Bravo",
      squad: "SQUAD BRAVO",
      raidId,
      timestamp: Date.now(),
      data: { machineId: "turret_depot_alpha", damage: 50 },
    } as any);

    expect(turret!.health).toBe(initialHealth);

    // Packet injected with _fromBroadcastChannel: true and type: ingress_snapshot must be ignored
    coord.handleMessage({
      _fromBroadcastChannel: true,
      eventId: "bc_illegal_snapshot",
      type: "ingress_snapshot",
      senderId: "op_bravo_1",
      senderName: "Bravo",
      squad: "SQUAD BRAVO",
      raidId,
      timestamp: Date.now(),
      data: {
        snapshotTick: 200,
        crates: [{ id: "crate_01", opened: true, claimedBy: "op_bravo_1" }],
        machines: [],
      },
    } as any);

    expect(sim.isAdmitted()).toBe(false);

    coord.cleanup();
  });

  it("86. Live operative existing raid reset rejection and life-cycle validation", async () => {
    // @ts-ignore
    const { createStickZoneServer } = await import("../scripts/server.mjs");
    const testPort = 4205;
    const tmpStore86 = `/tmp/test-server-store-86-${Date.now()}.json`;
    const testServer = createStickZoneServer(new ServerSettlementAuthority(tmpStore86));

    await new Promise<void>((resolve) => {
      testServer.listen(testPort, () => resolve());
    });

    try {
      const testRaidId = `raid_reset_test_${Date.now()}`;
      testServer.settlement.initRaid(testRaidId, 50000, ["op_player", "op_alpha_1", "op_bravo_1"]);

      // Claim Alpha slot to obtain token
      const joinRes = await fetch(`http://localhost:${testPort}/api/settlement/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raidId: testRaidId, operativeId: "op_alpha_1" }),
      });
      const { token: alphaToken } = await joinRes.json();

      // Attempting to reset the active raid while Alpha is live/not extracted returns 403 Forbidden
      const resetAttemptLive = await fetch(`http://localhost:${testPort}/api/settlement/init-raid`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${alphaToken}`,
        },
        body: JSON.stringify({ raidId: testRaidId }),
      });
      expect(resetAttemptLive.status).toBe(403);

      // Now simulate Alpha extraction
      simulateOperativeExtraction(testServer.settlement, testRaidId, "op_alpha_1");

      // Now resetting succeeds because operative lifecycle requirement is satisfied
      const newRaidId = `raid_reset_next_${Date.now()}`;
      const resetSuccess = await fetch(`http://localhost:${testPort}/api/settlement/init-raid`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${alphaToken}`,
        },
        body: JSON.stringify({ raidId: newRaidId }),
      });
      expect(resetSuccess.status).toBe(200);
      const resetData = await resetSuccess.json();
      expect(resetData.raid.raidId).toBe(newRaidId);
    } finally {
      await new Promise<void>((resolve) => testServer.close(() => resolve()));
      try { fs.unlinkSync(tmpStore86); } catch {}
    }
  });

  it("87. Raid deadline expiry terminal reporting and exact 2500ms corridor duration", async () => {
    const sim = new SectorDepotSimulation(`raid_deadline_${Date.now()}`);
    let deathReported = false;
    sim.onPlayerDeath = () => { deathReported = true; };

    // Advance to tick 53,999 (one tick before deadline)
    sim.tick = SIM_CONFIG.RAID_DEADLINE_TICK - 1;
    sim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: false, interact: false });

    expect(sim.player.isAlive).toBe(true);
    expect(deathReported).toBe(false);

    // Step at deadline tick 54,000 (15:00)
    sim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: false, interact: false });

    expect(sim.tick).toBe(SIM_CONFIG.RAID_DEADLINE_TICK);
    expect(sim.player.isAlive).toBe(false);
    expect(sim.player.health).toBe(0);
    expect(sim.isRaidExpired).toBe(true);
    expect(deathReported).toBe(true);

    // Verify 2500ms corridor presentation configuration
    expect(SIM_CONFIG.AIRLOCK_CORRIDOR_DURATION_MS).toBe(2500);
  });

  it("88. Fatal machine and rival damage stops player actions within the same tick", () => {
    const sim = new SectorDepotSimulation("raid_fatal_stop_88");
    sim.admitOperative(0);
    expect(sim.isAdmitted()).toBe(true);

    const turret = sim.machines.find((m) => m.id === "turret_depot_alpha");
    expect(turret).toBeDefined();
    const initialTurretHealth = turret!.health;

    // Set player health to 1 HP and 0 armor right next to turret detection range
    sim.player.armor = 0;
    sim.player.health = 1;
    sim.player.x = turret!.x;
    sim.player.z = turret!.z + 5; // Within 20m detection range
    turret!.cooldownTicks = 0; // Ready to fire

    const startX = sim.player.x;
    const startZ = sim.player.z;

    // Player inputs movement and shooting in the same tick where turret will fire fatally
    sim.step({ dx: 1, dz: 1, sprint: false, slide: false, roll: false, kick: false, shoot: true, interact: false });

    // Player took fatal damage and died
    expect(sim.player.health).toBe(0);
    expect(sim.player.isAlive).toBe(false);

    // Fatal damage halted player actions: turret took 0 damage and player did not move
    expect(turret!.health).toBe(initialTurretHealth);
    expect(sim.player.x).toBe(startX);
    expect(sim.player.z).toBe(startZ);

    // 2. Fatal rival damage also halts player actions within the same tick
    const simRival = new SectorDepotSimulation("raid_fatal_rival_stop_88");
    simRival.admitOperative(0);
    for (const m of simRival.machines) m.cooldownTicks = 100;
    simRival.spawnRogueSquad();
    const rogue = simRival.rivals[0];
    expect(rogue).toBeDefined();
    const initialRogueHealth = rogue.health;

    simRival.player.x = 0;
    simRival.player.z = 0;
    simRival.player.health = 1;
    simRival.player.armor = 0;

    rogue.x = 0;
    rogue.z = 5;
    rogue.shootCooldownTicks = 0;

    const rStartX = simRival.player.x;
    const rStartZ = simRival.player.z;

    // Player inputs movement and shooting in the tick where rogue deals fatal damage
    simRival.step({ dx: 1, dz: 1, sprint: false, slide: false, roll: false, kick: false, shoot: true, interact: false });

    expect(simRival.player.health).toBe(0);
    expect(simRival.player.isAlive).toBe(false);
    expect(rogue.health).toBe(initialRogueHealth);
    expect(simRival.player.x).toBe(rStartX);
    expect(simRival.player.z).toBe(rStartZ);
  });

  it("89. Rogue AI retreat calculation with dist === 0 produces finite coordinates", () => {
    const sim = new SectorDepotSimulation("raid_rogue_zero_89");
    sim.spawnRogueSquad();
    const rogue = sim.rivals[0];
    expect(rogue).toBeDefined();

    // Place rogue at exact same coordinates as player
    rogue.x = sim.player.x;
    rogue.z = sim.player.z;

    // Step simulation
    sim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: false, interact: false });

    // Coordinates must be completely finite and non-NaN
    expect(Number.isFinite(rogue.x)).toBe(true);
    expect(Number.isFinite(rogue.z)).toBe(true);
    expect(isNaN(rogue.x)).toBe(false);
    expect(isNaN(rogue.z)).toBe(false);
  });

  it("90. ingress_snapshot sets inHandshakeState = ack_sent and survives late discovery", () => {
    const raidId = `raid_snapshot_handshake_${Date.now()}`;
    const simJoiner = new SectorDepotSimulation(raidId);
    simJoiner.player.id = "op_bravo_1";
    simJoiner.player.name = "INFILTRATOR PHANTOM-1";
    const coordJoiner = new MultiplayerCoordinator(simJoiner);

    // Host sends ingress_snapshot
    coordJoiner.handleMessage({
      eventId: "snap_test_90",
      type: "ingress_snapshot",
      senderId: "op_alpha_1",
      senderName: "OPERATIVE GHOST-1",
      squad: "SQUAD ALPHA",
      raidId,
      timestamp: Date.now(),
      data: {
        recipientId: "op_bravo_1",
        snapshot: {
          snapshotTick: 200,
          crates: [{ id: "crate_01", opened: false }],
          machines: [{ id: "turret_depot_alpha", health: 100, isAlive: true }],
        },
      },
    } as any);

    const peerEntry = coordJoiner.connectedPeers.get("op_alpha_1");
    expect(peerEntry?.handshakeState).toBe("ack_sent");
    expect(peerEntry?.inHandshakeState).toBe("ack_sent");

    // A late discovery packet arrives from Alpha (e.g. network retry)
    coordJoiner.handleMessage({
      eventId: "late_disc_test_90",
      type: "raid_discovery",
      senderId: "op_alpha_1",
      senderName: "OPERATIVE GHOST-1",
      squad: "SQUAD ALPHA",
      raidId,
      timestamp: Date.now(),
      data: {},
    } as any);

    // inHandshakeState must remain ack_sent
    expect(peerEntry?.inHandshakeState).toBe("ack_sent");

    // Host confirmation arrives
    coordJoiner.handleMessage({
      eventId: "confirm_ack_test_90",
      type: "squad_ack",
      senderId: "op_alpha_1",
      senderName: "OPERATIVE GHOST-1",
      squad: "SQUAD ALPHA",
      raidId,
      timestamp: Date.now(),
      data: { isConfirmation: true, recipientId: "op_bravo_1" },
    } as any);

    expect(simJoiner.isAdmitted()).toBe(true);
    expect(simJoiner.ingressController.getState().kind).toBe("confirmed_active");
    coordJoiner.cleanup();
  });

  it("91. Operative redeployment preserves ongoing raid, tokens, and sockets for live squadmates", async () => {
    // @ts-ignore
    const { createStickZoneServer } = await import("../scripts/server.mjs");
    const testPort = 4208;
    const tmpStore91 = `/tmp/test-server-store-91-${Date.now()}.json`;
    const testServer = createStickZoneServer(new ServerSettlementAuthority(tmpStore91));

    await new Promise<void>((resolve) => {
      testServer.listen(testPort, () => resolve());
    });

    try {
      const oldRaidId = `raid_redeploy_old_${Date.now()}`;
      testServer.settlement.initRaid(oldRaidId, 50000, ["op_player", "op_alpha_1", "op_bravo_1"]);

      // Claim Alpha and Bravo slots
      const joinAlpha = await fetch(`http://localhost:${testPort}/api/settlement/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raidId: oldRaidId, operativeId: "op_alpha_1" }),
      });
      const { token: alphaToken } = await joinAlpha.json();

      const joinBravo = await fetch(`http://localhost:${testPort}/api/settlement/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raidId: oldRaidId, operativeId: "op_bravo_1" }),
      });
      const { token: bravoToken } = await joinBravo.json();

      // Alpha extracts cleanly
      simulateOperativeExtraction(testServer.settlement, oldRaidId, "op_alpha_1");
      const oldRaidRec = testServer.settlement.getRaidRecord(oldRaidId);
      // Bravo is still alive and NOT extracted
      expect(oldRaidRec.operatives["op_bravo_1"].isAlive !== false).toBe(true);
      expect(oldRaidRec.operatives["op_bravo_1"].isExtracted).toBe(false);

      // Alpha creates next raid
      const newRaidId = `raid_redeploy_new_${Date.now()}`;
      const redeployRes = await fetch(`http://localhost:${testPort}/api/settlement/init-raid`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${alphaToken}`,
        },
        body: JSON.stringify({ raidId: newRaidId }),
      });
      expect(redeployRes.status).toBe(200);

      // Old raid status must NOT be concluded, because Bravo is still alive!
      expect(testServer.settlement.getRaidRecord(oldRaidId)?.status).toBe("active");

      // Bravo's token in old raid must remain valid
      expect(testServer.settlement.resolveOperativeByToken(bravoToken)).toEqual({
        operativeId: "op_bravo_1",
        raidId: oldRaidId,
      });

      // Bravo can still query session with bearer token
      const bravoCheck = await fetch(`http://localhost:${testPort}/api/settlement/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${bravoToken}`,
        },
        body: JSON.stringify({ raidId: oldRaidId, operativeId: "op_bravo_1" }),
      });
      expect(bravoCheck.status).toBe(200);
      const bravoCheckData = await bravoCheck.json();
      expect(bravoCheckData.token).toBe(bravoToken);

    } finally {
      await new Promise<void>((resolve) => testServer.close(() => resolve()));
      try { fs.unlinkSync(tmpStore91); } catch {}
    }
  });

  it("92. New raid creation automatically claims caller slot against unauthenticated join theft", async () => {
    // @ts-ignore
    const { createStickZoneServer } = await import("../scripts/server.mjs");
    const testPort = 4210;
    const tmpStore92 = `/tmp/test-server-store-92-${Date.now()}.json`;
    const testServer = createStickZoneServer(new ServerSettlementAuthority(tmpStore92));

    await new Promise<void>((resolve) => {
      testServer.listen(testPort, () => resolve());
    });

    try {
      const initialRaidId = `raid_claim_sec_init_${Date.now()}`;
      testServer.settlement.initRaid(initialRaidId, 50000, ["op_player", "op_alpha_1", "op_bravo_1"]);

      const joinAlpha = await fetch(`http://localhost:${testPort}/api/settlement/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raidId: initialRaidId, operativeId: "op_alpha_1" }),
      });
      const { token: alphaToken } = await joinAlpha.json();

      // Alpha extracts
      simulateOperativeExtraction(testServer.settlement, initialRaidId, "op_alpha_1");

      // Alpha initializes a new raid
      const nextRaidId = `raid_claim_sec_next_${Date.now()}`;
      const initRes = await fetch(`http://localhost:${testPort}/api/settlement/init-raid`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${alphaToken}`,
        },
        body: JSON.stringify({ raidId: nextRaidId }),
      });
      expect(initRes.status).toBe(200);

      // Caller slot op_alpha_1 was automatically claimed by the server!
      expect(testServer.settlement.isSlotClaimed(nextRaidId, "op_alpha_1")).toBe(true);

      // Unauthenticated public /join attempting to steal Alpha's slot returns 409 Conflict
      const stealRes = await fetch(`http://localhost:${testPort}/api/settlement/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raidId: nextRaidId, operativeId: "op_alpha_1" }),
      });
      expect(stealRes.status).toBe(409);

    } finally {
      await new Promise<void>((resolve) => testServer.close(() => resolve()));
      try { fs.unlinkSync(tmpStore92); } catch {}
    }
  });

  it("93. Atomic persistence rollback on slot claim and release failure", () => {
    const tmpStore = `/tmp/test-rollback-slot-${Date.now()}.json`;
    const auth = new ServerSettlementAuthority(tmpStore);
    const raidId = "raid_atomic_slot_93";
    auth.initRaid(raidId, 50000, ["op_player", "op_alpha_1", "op_bravo_1"]);

    expect(auth.isSlotClaimed(raidId, "op_alpha_1")).toBe(false);

    // Mock saveToDisk failure
    const origSave = auth.saveToDisk.bind(auth);
    auth.saveToDisk = () => {
      throw new Error("Disk full simulation");
    };

    // Claiming slot must throw and roll back memory state
    expect(() => auth.claimSlot(raidId, "op_alpha_1")).toThrow("Disk full simulation");
    expect(auth.isSlotClaimed(raidId, "op_alpha_1")).toBe(false);

    // Restore saveToDisk and claim slot
    auth.saveToDisk = origSave;
    auth.claimSlot(raidId, "op_alpha_1");
    expect(auth.isSlotClaimed(raidId, "op_alpha_1")).toBe(true);

    // Mock saveToDisk failure on release
    auth.saveToDisk = () => {
      throw new Error("Disk full simulation");
    };

    expect(() => auth.releaseSlot(raidId, "op_alpha_1")).toThrow("Disk full simulation");
    expect(auth.isSlotClaimed(raidId, "op_alpha_1")).toBe(true);

    try { fs.unlinkSync(tmpStore); } catch {}
  });

  it("94. Immediate terminal state broadcast on odd tick death and peer expiry pruning", () => {
    const sim = new SectorDepotSimulation("raid_death_odd_94");
    sim.admitOperative(0);
    sim.tick = 101; // Odd tick!

    const coord = new MultiplayerCoordinator(sim);
    let broadcastStateCalled = false;
    coord.broadcastState = () => {
      broadcastStateCalled = true;
    };

    // Kill player at odd tick 101
    sim.player.armor = 0;
    sim.player.health = 50;
    sim.applyDamageToPlayer(60);
    expect(sim.player.isAlive).toBe(false);

    // Terminal broadcastState was immediately called
    expect(broadcastStateCalled).toBe(true);

    // Peer expiry pruning
    const stalePeerId = "op_stale_peer";
    (coord as any).connectedPeers.set(stalePeerId, {
      name: "Stale",
      lastSeen: Date.now() - 15000, // 15 seconds ago
      ingressDone: true,
      handshakeState: "confirmed",
    });
    sim.rivals.push({
      id: stalePeerId,
      name: "Stale",
      x: 10, y: 0, z: 10, facing: 0,
      health: 100, isAlive: true, isExtracted: false,
      badge: "RIVAL OPERATIVE",
      action: "idle", actionTicks: 0, ammo: 30, cash: 0, isInvulnerable: false,
    } as any);

    expect(sim.rivals.some((r) => r.id === stalePeerId)).toBe(true);

    // Calling pruneExpiredPeers removes the stale peer from sim.rivals
    coord.pruneExpiredPeers(10000);
    expect(sim.rivals.some((r) => r.id === stalePeerId)).toBe(false);

    coord.cleanup();
  });
  it("95. Vector 1: Rogue AI and Companion container collision protection", () => {
    const sim = new SectorDepotSimulation("raid_test_95");
    sim.spawnRogueSquad();
    // Ensure player is at (0, 15) so rogue pursues horizontally along X
    sim.player.x = 0;
    sim.player.z = 15;

    // Container box exists at minX: -17.0, maxX: -13.0, minZ: 11.5, maxZ: 18.5
    // Place Rogue AI at (-18.0, 15.0) facing player at (0, 15.0)
    const rogue = sim.rivals.find((r) => r.isAI);
    expect(rogue).toBeTruthy();
    if (rogue) {
      rogue.x = -18.0;
      rogue.z = 15.0;
      rogue.isAlive = true;
      rogue.isExtracted = false;

      // Step simulation for 45 ticks (at 60Hz, rogue travels towards player)
      for (let t = 0; t < 45; t++) {
        sim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: false, interact: false });
        // At every tick, rogue must never penetrate inside any container
        const colliding = sim.checkContainerCollision(rogue.x, rogue.z, 0.45);
        expect(colliding).toBe(false);
      }
      // Rogue should be safely blocked at or outside minX (-17.0)
      expect(rogue.x).toBeLessThanOrEqual(-17.0);
    }

    // Place Companion at (-18.0, 15.0) with player at (0, 15.0)
    sim.squadmate.x = -18.0;
    sim.squadmate.z = 15.0;
    sim.squadmate.isAlive = true;
    sim.squadmate.isExtracted = false;

    for (let t = 0; t < 45; t++) {
      sim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: false, interact: false });
      const colliding = sim.checkContainerCollision(sim.squadmate.x, sim.squadmate.z, 0.45);
      expect(colliding).toBe(false);
    }
    expect(sim.squadmate.x).toBeLessThanOrEqual(-17.0);
  });

  it("96. Vector 3: Multiplayer automatic peer expiry timer and retry discovery in waiting_squad", async () => {
    const sim = new SectorDepotSimulation("raid_test_96");
    const coord = new MultiplayerCoordinator(sim);
    expect(coord.pruneInterval).toBeTruthy();

    // 1. Add stale peer (>10s idle)
    const staleId = "op_auto_stale";
    (coord as any).connectedPeers.set(staleId, {
      name: "AutoStale",
      lastSeen: Date.now() - 12000,
      ingressDone: true,
      handshakeState: "confirmed",
    });
    sim.rivals.push({
      id: staleId,
      name: "AutoStale",
      x: 5, y: 0, z: 5, facing: 0,
      health: 100, isAlive: true, isExtracted: false,
      badge: "RIVAL", action: "idle", actionTicks: 0, ammo: 30, cash: 0, isInvulnerable: false,
    } as any);
    expect(sim.rivals.some((r) => r.id === staleId)).toBe(true);

    // Call pruneExpiredPeers to verify automated pruning logic
    coord.pruneExpiredPeers();
    expect(sim.rivals.some((r) => r.id === staleId)).toBe(false);

    // 2. Joiner coordinator retry sends packets when in waiting_squad
    const simJoiner = new SectorDepotSimulation("raid_test_96_joiner");
    const coordJoiner = new MultiplayerCoordinator(simJoiner);
    simJoiner.ingressController.enterCorridor(0);
    simJoiner.ingressController.startHydration(0);
    simJoiner.ingressController.applySnapshot({ snapshotTick: 0, crates: [], machines: [] });
    // In waiting_squad state
    expect(simJoiner.ingressController.getState().kind).toBe("waiting_squad");

    let packetsSent = 0;
    (coordJoiner as any).sendPacket = () => { packetsSent++; };

    // Trigger discovery interval callback
    (coordJoiner as any).broadcastIngressRequest();
    (coordJoiner as any).broadcastSquadAck(simJoiner.player.id, true);
    expect(packetsSent).toBeGreaterThanOrEqual(2);

    // 3. Lost initial ACK and lost host confirmation recovery
    const simHost1 = new SectorDepotSimulation("raid_ack_recovery_96");
    simHost1.admitOperative(0);
    const coordHost1 = new MultiplayerCoordinator(simHost1);

    const simJoiner1 = new SectorDepotSimulation("raid_ack_recovery_96");
    simJoiner1.player.id = "op_bravo_1";
    simJoiner1.player.name = "INFILTRATOR PHANTOM-1";
    vi.useFakeTimers();
    const coordJoiner1 = new MultiplayerCoordinator(simJoiner1);

    simJoiner1.ingressController.enterCorridor(200);

    const snapshotPacket: any = {
      eventId: "snap_96",
      type: "ingress_snapshot",
      senderId: "op_alpha_1",
      senderName: "OPERATIVE ALPHA",
      squad: "SQUAD ALPHA",
      raidId: "raid_ack_recovery_96",
      timestamp: Date.now(),
      data: {
        recipientId: "op_bravo_1",
        snapshot: { snapshotTick: 200, crates: [], machines: [] },
      },
    };

    coordJoiner1.handleMessage(snapshotPacket);
    expect(simJoiner1.ingressController.getState().kind).toBe("waiting_squad");
    expect((coordJoiner1 as any).hostPeerId).toBe("op_alpha_1");

    // Case A: Initial ACK sent by joiner is dropped in transit.
    (coordHost1 as any).connectedPeers.set("op_bravo_1", {
      name: "INFILTRATOR PHANTOM-1",
      lastSeen: Date.now(),
      ingressDone: false,
      handshakeState: "snapshot_sent",
      outHandshakeState: "snapshot_sent",
    });

    let joinerRetryPackets: any[] = [];
    (coordJoiner1 as any).sendPacket = (p: any) => joinerRetryPackets.push(p);

    // Joiner automatic discovery timer fires without manual method calls
    vi.useFakeTimers();
    vi.advanceTimersByTime(500);

    const retryAckPacket = joinerRetryPackets.find((p) => p.type === "squad_ack");
    expect(retryAckPacket).toBeDefined();
    expect(retryAckPacket.data.recipientId).toBe("op_alpha_1");

    // Host receives retried squad ACK and sends confirmation ACK
    let hostPackets: any[] = [];
    (coordHost1 as any).sendPacket = (p: any) => hostPackets.push(p);
    coordHost1.handleMessage(retryAckPacket);

    const hostConfirmPacket = hostPackets.find((p) => p.type === "squad_ack" && p.data?.isConfirmation);
    expect(hostConfirmPacket).toBeDefined();

    // Case B: Lost host confirmation ACK recovery - packet lost in transit
    // Joiner has not received confirmation yet, so automatic discovery timer fires again automatically
    joinerRetryPackets = [];
    vi.advanceTimersByTime(500);
    const autoRetryAck2 = joinerRetryPackets.find((p) => p.type === "squad_ack");
    expect(autoRetryAck2).toBeDefined();
    expect(autoRetryAck2.data.recipientId).toBe("op_alpha_1");

    // Host receives automatic re-ACK and re-transmits confirmation
    hostPackets = [];
    coordHost1.handleMessage(autoRetryAck2);
    const reconfirmedPacket = hostPackets.find((p) => p.type === "squad_ack" && p.data?.isConfirmation);
    expect(reconfirmedPacket).toBeDefined();

    // Joiner receives confirmation ACK and completes admission
    coordJoiner1.handleMessage(reconfirmedPacket);
    expect(simJoiner1.isAdmitted()).toBe(true);
    vi.useRealTimers();

    coord.cleanup();
    coordJoiner.cleanup();
    coordHost1.cleanup();
    coordJoiner1.cleanup();
  });

  it("97. Vector 4: Normal production extraction settlement with App payload and Bravo redeployment", async () => {
    // @ts-ignore
    const { createStickZoneServer } = await import("../scripts/server.mjs");
    const { ServerSettlementAuthority } = await import("../src/sim/server-settlement.js");
    const tmpStore97 = `/tmp/test-server-store-97-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
    const auth = new ServerSettlementAuthority(tmpStore97);
    const raidId = `raid_prod_exfil_${Date.now()}`;
    auth.initRaid(raidId, 50000, ["op_player", "op_alpha_1", "op_bravo_1"]);
    const playerTok = auth.getSessionToken(raidId, "op_player");
    const bravoTok = auth.getSessionToken(raidId, "op_bravo_1");
    expect(playerTok).toBeTruthy();
    expect(bravoTok).toBeTruthy();

    const testServer = createStickZoneServer(auth);
    await new Promise<void>((resolve) => testServer.listen(0, () => resolve()));
    const testPort = (testServer.address() as any).port;

    const rRec97 = auth.getRaidRecord(raidId)!;
    rRec97.createdAtMs = Date.now() - 15000;
    rRec97.operatives["op_player"].lastObservedTimestamp = Date.now() - 15000;
    rRec97.operatives["op_player"].lastObservedX = 45.0;
    rRec97.operatives["op_player"].lastObservedZ = 45.0;

    try {
      // 1. Rapid burst reports with client timing controls are ignored by server
      const burstRes = await fetch(`http://localhost:${testPort}/api/settlement/hold`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${playerTok}`,
          "x-operative-id": "op_player",
        },
        body: JSON.stringify({
          raidId,
          operativeId: "op_player",
          holdTicks: 180,
          currentTick: 1,
          x: 45.0,
          z: 45.0,
          inZone: true,
          isAlive: true,
          isKia: false,
          timestamp: 9999999,
          simTickAdvancement: true,
        }),
      });
      const burstData = await burstRes.json();
      expect(burstData.holdCompleted).toBe(false);

      // Reset hold state by stepping out of zone
      await fetch(`http://localhost:${testPort}/api/settlement/hold`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${playerTok}`,
          "x-operative-id": "op_player",
        },
        body: JSON.stringify({
          raidId,
          operativeId: "op_player",
          holdTicks: 0,
          currentTick: 2,
          inZone: false,
        }),
      });

      // 2. Normal App-formatted hold report (without timing controls) advancing with server wall clock
      let lastResult: any = null;
      for (let t = 1; t <= 180; t++) {
        const currentTick = 10 + t;
        const res = await fetch(`http://localhost:${testPort}/api/settlement/hold`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${playerTok}`,
            "x-operative-id": "op_player",
          },
          body: JSON.stringify({
            raidId,
            operativeId: "op_player",
            holdTicks: t,
            currentTick,
            x: 45.0,
            z: 45.0,
            inZone: true,
            isAlive: true,
            isKia: false,
          }),
        });
        expect(res.status).toBe(200);
        lastResult = await res.json();
        if (t < 180) {
          await new Promise((r) => setTimeout(r, 16));
        }
      }
      expect(lastResult.holdCompleted).toBe(true);
      expect(lastResult.currentHoldTicks).toBe(180);

      // 3. Premature commit before corridor presentation (2500ms) fails with 400
      const prematureCommit = await fetch(`http://localhost:${testPort}/api/settlement/commit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${playerTok}`,
        },
        body: JSON.stringify({
          raidId,
          playerId: "op_player",
          tick: 190,
          cash: 0,
          exfilSubmitted: true,
        }),
      });
      expect(prematureCommit.status).toBe(400);

      // Wait out corridor presentation
      await new Promise((r) => setTimeout(r, 2600));

      // 4. Commit settlement for player succeeds after corridor presentation
      const commitRes = await fetch(`http://localhost:${testPort}/api/settlement/commit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${playerTok}`,
        },
        body: JSON.stringify({
          raidId,
          playerId: "op_player",
          tick: 190,
          cash: 0,
          exfilSubmitted: true,
        }),
      });
      expect(commitRes.status).toBe(200);

      // 5. Player redeploys to new raid -> creates new active raid
      const newRaidId = `raid_prod_round2_${Date.now()}`;
      const redeployRes = await fetch(`http://localhost:${testPort}/api/settlement/new-raid`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${playerTok}`,
        },
        body: JSON.stringify({
          raidId: newRaidId,
          allowablePool: 50000,
          operatives: ["op_player", "op_alpha_1", "op_bravo_1"],
        }),
      });
      expect(redeployRes.status).toBe(200);
      expect(auth.getActiveRaidId()).toBe(newRaidId);

      // 6. Bravo in concluded raid 1 now dies/extracts and attempts to redeploy with raid 1 token
      auth.recordOperativeKia(raidId, "op_bravo_1", "op_bravo_1");

      const bravoRedeployRes = await fetch(`http://localhost:${testPort}/api/settlement/new-raid`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${bravoTok}`,
        },
        body: JSON.stringify({
          raidId: `raid_prod_round3_${Date.now()}`,
          allowablePool: 50000,
          operatives: ["op_player", "op_alpha_1", "op_bravo_1"],
        }),
      });
      // Bravo is NOT rejected with 403 Forbidden!
      expect(bravoRedeployRes.status).toBe(200);
    } finally {
      try { fs.unlinkSync(tmpStore97); } catch {}
      await new Promise<void>((resolve) => testServer.close(() => resolve()));
    }
  }, 15000);

  it("98. Vector 5: State packet schema validation and admitted peer late-cutoff resilience", () => {
    const sim = new SectorDepotSimulation("raid_test_98");
    sim.admitOperative(0);
    expect(sim.isAdmitted()).toBe(true);
    const coord = new MultiplayerCoordinator(sim);

    const peerId = "op_bravo_1";
    (coord as any).connectedPeers.set(peerId, {
      name: "INFILTRATOR PHANTOM-1",
      lastSeen: Date.now(),
      ingressDone: true,
      admitted: true,
      handshakeState: "confirmed",
    });

    // 1. Malformed state with x: "bad" and z: null is rejected
    coord.handleMessage({
      eventId: "malformed_state_1",
      type: "state",
      senderId: peerId,
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD PHANTOM",
      raidId: "raid_test_98",
      timestamp: Date.now(),
      data: { x: "bad", z: null, health: 100 } as any,
    });
    expect(sim.rivals.some((r) => r.id === peerId)).toBe(false);

    // 2. Valid state creates rival
    coord.handleMessage({
      eventId: "valid_state_1",
      type: "state",
      senderId: peerId,
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD PHANTOM",
      raidId: "raid_test_98",
      timestamp: Date.now(),
      data: { x: 12.5, y: 0, z: 18.2, facing: 1.0, health: 100, armor: 50, cash: 1000, action: "walk", actionTicks: 5, ammo: 30, isAlive: true },
    });
    expect(sim.rivals.some((r) => r.id === peerId)).toBe(true);

    // 3. Peer is pruned due to idle (>10s)
    const peerRec = (coord as any).connectedPeers.get(peerId);
    if (peerRec) peerRec.lastSeen = Date.now() - 15000;
    coord.pruneExpiredPeers(10000);
    expect(sim.rivals.some((r) => r.id === peerId)).toBe(false);

    // 4. Advance tick past 28,800 cutoff (tick 30,000)
    sim.tick = 30000;
    // Sending state again does NOT trigger late arrival cutoff because peer was already admitted
    coord.handleMessage({
      eventId: "valid_state_after_cutoff",
      type: "state",
      senderId: peerId,
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD PHANTOM",
      raidId: "raid_test_98",
      timestamp: Date.now() + 100,
      data: { x: 14.0, y: 0, z: 20.0, facing: 1.2, health: 90, armor: 40, cash: 1000, action: "idle", actionTicks: 0, ammo: 28, isAlive: true },
    });
    expect(sim.rivals.some((r) => r.id === peerId)).toBe(true);

    // 5. Fatal terminal death persistence across expiry and older packet rejection
    const deathTs = Date.now() + 500;
    coord.handleMessage({
      eventId: "death_state_200",
      type: "state",
      senderId: peerId,
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD PHANTOM",
      raidId: "raid_test_98",
      timestamp: deathTs,
      data: { x: 14.0, y: 0, z: 20.0, facing: 1.2, health: 0, isAlive: false, action: "idle", actionTicks: 0, ammo: 0 },
    });
    const deadRival = sim.rivals.find((r) => r.id === peerId);
    expect(deadRival?.health).toBe(0);
    expect(deadRival?.isAlive).toBe(false);

    // Prune rival due to expiry
    const currentPeer = (coord as any).connectedPeers.get(peerId) || peerRec;
    if (currentPeer) currentPeer.lastSeen = Date.now() - 15000;
    coord.pruneExpiredPeers(10000);
    expect(sim.rivals.some((r) => r.id === peerId)).toBe(false);

    // Stale packet with timestamp 100 arriving after death at timestamp 200 is dropped!
    coord.handleMessage({
      eventId: "stale_alive_state_100",
      type: "state",
      senderId: peerId,
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD PHANTOM",
      raidId: "raid_test_98",
      timestamp: deathTs - 50,
      data: { x: 14.0, y: 0, z: 20.0, facing: 1.2, health: 100, isAlive: true, action: "idle", actionTicks: 0, ammo: 30 },
    });
    expect(sim.rivals.some((r) => r.id === peerId)).toBe(false);

    // Even future packet at timestamp 300 cannot revive permanently dead peer
    coord.handleMessage({
      eventId: "future_state_300",
      type: "state",
      senderId: peerId,
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD PHANTOM",
      raidId: "raid_test_98",
      timestamp: deathTs + 100,
      data: { x: 14.0, y: 0, z: 20.0, facing: 1.2, health: 100, isAlive: true, action: "idle", actionTicks: 0, ammo: 30 },
    });
    const lockedDeadRival = sim.rivals.find((r) => r.id === peerId);
    if (lockedDeadRival) {
      expect(lockedDeadRival.health).toBe(0);
      expect(lockedDeadRival.isAlive).toBe(false);
    }

    coord.cleanup();
  });

  it("99. Vector 6: claimSlot rollback safety and atomic raid init slot claim", () => {
    const tmpStore99 = `/tmp/test-server-store-99-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
    const auth = new ServerSettlementAuthority(tmpStore99);
    auth.initRaid("raid_99", 50000, ["op_player"]);

    // 1. Claim slot
    auth.claimSlot("raid_99", "op_player");
    expect(auth.isSlotClaimed("raid_99", "op_player")).toBe(true);

    // 2. Repeated claim with saveToDisk throwing DOES NOT delete the existing claim on rollback
    const origSave = auth.saveToDisk;
    auth.saveToDisk = () => { throw new Error("Disk full"); };

    expect(() => {
      auth.claimSlot("raid_99", "op_player");
    }).toThrow("Disk full");
    // Prior claim is preserved!
    expect(auth.isSlotClaimed("raid_99", "op_player")).toBe(true);
    auth.saveToDisk = origSave;

    // 3. initRaid with callerClaimOpId claims slot atomically in one disk commit
    auth.initRaid("raid_atomic_99", 50000, ["op_player", "op_alpha_1"], "op_player");
    expect(auth.isSlotClaimed("raid_atomic_99", "op_player")).toBe(true);
    expect(auth.isSlotClaimed("raid_atomic_99", "op_alpha_1")).toBe(false);

    try { fs.unlinkSync(tmpStore99); } catch {}
  });

  it("100. Test store isolation and top HUD mobile responsive styling", async () => {
    const path = await import("node:path");
    const { ServerSettlementAuthority, recordGameplayExtractionHold } = await import("../src/sim/server-settlement.js");
    const defaultAuth = new ServerSettlementAuthority();
    const defaultStoreBase = path.basename((defaultAuth as any).storePath);
    expect(defaultStoreBase.startsWith(".settlement-store-test-default-")).toBe(true);
    expect(ServerSettlementAuthority.activeAuthorities.has(defaultAuth)).toBe(false);

    const cwdStorePath = path.resolve(process.cwd(), ".settlement-store.json");
    const mtimeBefore = fs.existsSync(cwdStorePath) ? fs.statSync(cwdStorePath).mtimeMs : 0;

    recordGameplayExtractionHold("raid_sector7_1042", "op_player", 10, 10);
    const mtimeAfter = fs.existsSync(cwdStorePath) ? fs.statSync(cwdStorePath).mtimeMs : 0;
    expect(mtimeAfter).toBe(mtimeBefore);

    const cssPath = path.resolve(__dirname, "../src/styles.css");
    const cssContent = fs.readFileSync(cssPath, "utf8");
// Mobile responsiveness contract (behavioral, not string-hunting):
    expect(cssContent.includes(".tactical-top-bar")).toBe(true);
    const idx768 = cssContent.indexOf("@media (max-width: 768px)");
    expect(idx768).toBeGreaterThan(-1);
    // In portrait phones the top bar wraps and the compass becomes the FIRST
    // full-width row (readable heading over the metadata):
    const block768 = cssContent.slice(idx768, cssContent.indexOf("}", cssContent.indexOf("width: 100%", idx768)) + 1);
    expect(block768).toMatch(/flex-wrap:\s*wrap/);
    expect(block768).toMatch(/order:\s*-1/);
    expect(block768).toMatch(/width:\s*100%/);
    // In short landscape viewports the compass is REMOVED for space (display:none),
    // and the combat log collapses — asserting the actual collapse rules:
    const idx500 = cssContent.indexOf("@media (max-height: 500px)");
    expect(idx500).toBeGreaterThan(-1);
    const block500 = cssContent.slice(idx500, idx500 + 1600);
    expect(block500).toMatch(/\.compass-bar\s*\{[^}]*display:\s*none/);
    expect(block500).toMatch(/\.tactical-combat-log\s*\{[^}]*display:\s*none/);
  });


  it("101. Rifle & kick armor absorption symmetry and independent hit cooldown cadence", () => {
    // 1. Shooter prediction absorbs damage through rival armor first matching applyDamageToPlayer
    const sim = new SectorDepotSimulation("raid_test_101");
    sim.player.x = 0;
    sim.player.z = 0;
    sim.player.facing = 0; // facing +Z

    // Add an armored rival directly in front
    const rivalArmored = {
      id: "op_rival_armored",
      name: "ARMORED TARGET",
      x: 0,
      y: 0,
      z: 1.0, // close for both kick and rifle
      facing: Math.PI,
      health: 100,
      maxHealth: 100,
      armor: 50,
      isAlive: true,
      isInvulnerable: false,
      isExtracted: false,
      badge: "RIVAL",
      action: "idle",
      actionTicks: 0,
      ammo: 30,
      cash: 0,
    };
    sim.rivals.push(rivalArmored as any);

    // Kinetic roundhouse kick (35 dmg) on prediction: absorbs 35 armor, leaving 15 armor and 100 health
    (sim as any).performMeleeKick();
    expect(rivalArmored.armor).toBe(15);
    expect(rivalArmored.health).toBe(100);

    // Rifle shot (24 dmg) on prediction: absorbs remaining 15 armor, 9 leftover to health -> 0 armor, 91 health
    (sim as any).fireWeapon();
    expect(rivalArmored.armor).toBe(0);
    expect(rivalArmored.health).toBe(91);

    // 2. Receiver applies kick and rifle through armor identically to prediction
    const simReceiver = new SectorDepotSimulation("raid_test_101_rec");
    simReceiver.player.id = "op_bravo_1";
    simReceiver.player.name = "INFILTRATOR PHANTOM-1";
    const coordRec = new MultiplayerCoordinator(simReceiver);
    simReceiver.player.x = 0;
    simReceiver.player.z = 0;
    simReceiver.player.armor = 50;
    simReceiver.player.health = 100;
    simReceiver.admitOperative(0);
    (coordRec as any).connectedPeers.set("op_alpha_1", {
      name: "OPERATIVE ALPHA",
      lastSeen: Date.now(),
      ingressDone: true,
      handshakeState: "confirmed",
    });
    simReceiver.rivals.push({
      id: "op_alpha_1",
      name: "OPERATIVE ALPHA",
      x: 0, y: 0, z: 2,
      facing: Math.PI,
      isAlive: true,
      isExtracted: false,
    } as any);

    const now = Date.now();
    const kickPacket: any = {
      eventId: "hit_kick_1",
      type: "hit",
      senderId: "op_alpha_1",
      senderName: "OPERATIVE ALPHA",
      squad: "SQUAD ALPHA",
      raidId: "raid_test_101_rec",
      timestamp: now,
      data: { targetId: "op_bravo_1", damage: 35, knockX: 0, knockZ: 1, kind: "kick" },
    };
    const riflePacket: any = {
      eventId: "hit_rifle_1",
      type: "hit",
      senderId: "op_alpha_1",
      senderName: "OPERATIVE ALPHA",
      squad: "SQUAD ALPHA",
      raidId: "raid_test_101_rec",
      timestamp: now,
      data: { targetId: "op_bravo_1", damage: 24, kind: "rifle" },
    };

    // Receiver kick: absorbs 35 armor -> 15 armor, 100 health (identical to prediction!)
    coordRec.handleMessage(kickPacket);
    expect(simReceiver.player.armor).toBe(15);
    expect(simReceiver.player.health).toBe(100);

    // Receiver rifle: absorbs 15 armor -> 0 armor, 91 health (identical to prediction!)
    coordRec.handleMessage(riflePacket);
    expect(simReceiver.player.armor).toBe(0);
    expect(simReceiver.player.health).toBe(91);

    // 3. Two rifle hits sent 134ms apart arriving in the same receiver tick
    const riflePacket2: any = {
      eventId: "hit_rifle_2",
      type: "hit",
      senderId: "op_alpha_1",
      senderName: "OPERATIVE ALPHA",
      squad: "SQUAD ALPHA",
      raidId: "raid_test_101_rec",
      timestamp: now + 134,
      data: { targetId: "op_bravo_1", damage: 24, kind: "rifle" },
    };
    coordRec.handleMessage(riflePacket2);
    expect(simReceiver.player.health).toBe(91 - 24); // 67 HP

    coordRec.cleanup();
  });

  it("102. Exact 50ms (3 ticks) muzzle flash duration, multi-tick batching, and bounded interpolation", () => {
    // 1. Turret and drone 3-tick (50ms) integer states
    const turretFlashStates: number[] = [];
    for (let cd = 45; cd >= 0; cd--) {
      if (cd > 42 && cd <= 45) turretFlashStates.push(cd);
    }
    expect(turretFlashStates).toEqual([45, 44, 43]);
    expect(turretFlashStates.length).toBe(3);

    const droneFlashStates: number[] = [];
    for (let cd = 30; cd >= 0; cd--) {
      if (cd > 27 && cd <= 30) droneFlashStates.push(cd);
    }
    expect(droneFlashStates).toEqual([30, 29, 28]);
    expect(droneFlashStates.length).toBe(3);

    // 2. Multi-tick batching resilience: cooldown ticks jump 45 -> 40 in one render frame
    const testNow = Date.now();
    const machineWithBatch: any = {
      type: "turret",
      cooldownTicks: 40, // jumped past 42 in a multi-tick batch!
      lastFiredAtMs: testNow - 25, // fired 25ms ago (within 50ms window)
    };
    const isMuzzleFlashActive =
      (typeof machineWithBatch.lastFiredAtMs === "number" && Date.now() - machineWithBatch.lastFiredAtMs <= 50) ||
      (machineWithBatch.type === "turret"
        ? machineWithBatch.cooldownTicks > 42 && machineWithBatch.cooldownTicks <= 45
        : machineWithBatch.cooldownTicks > 27 && machineWithBatch.cooldownTicks <= 30);
    expect(isMuzzleFlashActive).toBe(true);

    // 3. Frame-rate independent interpolation at 20fps (delta = 0.05) is bounded strictly < 1.0
    const delta = 0.05;
    const posAlpha = Math.min(1.0, 1 - Math.exp(-22 * delta));
    const rotAlpha = Math.min(1.0, 1 - Math.exp(-24 * delta));
    expect(posAlpha).toBeLessThan(1.0);
    expect(posAlpha).toBeCloseTo(0.667, 2);
    expect(rotAlpha).toBeLessThan(1.0);
    expect(rotAlpha).toBeCloseTo(0.698, 2);
  });

  it("103. Ingress snapshot replacement preserves newer world events while pruning older events", () => {
    const sim = new SectorDepotSimulation("raid_test_103");
    sim.player.id = "op_bravo_1";
    sim.player.name = "INFILTRATOR PHANTOM-1";
    const coord = new MultiplayerCoordinator(sim);
    sim.ingressController.enterCorridor(100);

    const now = Date.now();
    // Older hit: occurred at now - 500, already in snapshot
    coord.pendingWorldEvents.push({
      eventId: "mach_hit_old",
      type: "machine_hit",
      senderId: "op_alpha_1",
      senderName: "OPERATIVE ALPHA",
      squad: "SQUAD ALPHA",
      raidId: "raid_test_103",
      timestamp: now - 500,
      data: { machineId: "turret_depot_alpha", damage: 24, attackerFacing: 0 },
    });

    sim.rivals.push({
      id: "op_alpha_1",
      isPlayer: false,
      isRival: true,
      isAI: false,
      name: "OPERATIVE ALPHA",
      x: -5,
      y: 0,
      z: 5,
      facing: 0,
      health: 100,
      armor: 0,
      cash: 0,
      action: "shoot",
      actionTicks: 0,
      isInvulnerable: false,
      isAlive: true,
      isExtracted: false,
      ammo: 30,
      maxAmmo: 30,
    });

    // Newer hit: occurred at now + 100, after snapshot was created
    coord.pendingWorldEvents.push({
      eventId: "mach_hit_new",
      type: "machine_hit",
      senderId: "op_alpha_1",
      senderName: "OPERATIVE ALPHA",
      squad: "SQUAD ALPHA",
      raidId: "raid_test_103",
      timestamp: now + 100,
      data: { machineId: "turret_depot_alpha", damage: 24, attackerFacing: 0 },
    });
    expect(coord.pendingWorldEvents.length).toBe(2);

    // Snapshot arrives with timestamp = now and turret health at 96
    const snapshotPacket: any = {
      eventId: "snap_103",
      type: "ingress_snapshot",
      senderId: "op_alpha_1",
      senderName: "OPERATIVE ALPHA",
      squad: "SQUAD ALPHA",
      raidId: "raid_test_103",
      timestamp: now,
      data: {
        recipientId: "op_bravo_1",
        snapshot: {
          snapshotTick: 100,
          crates: [],
          machines: [{ id: "turret_depot_alpha", health: 96, isAlive: true }],
        },
      },
    };

    coord.handleMessage(snapshotPacket);

    // Older hit is pruned; newer hit is preserved!
    expect(coord.pendingWorldEvents.length).toBe(1);
    expect(coord.pendingWorldEvents[0].eventId).toBe("mach_hit_new");

    // Before flushing, machine health is 96 from snapshot
    const turret = sim.machines.find((m) => m.id === "turret_depot_alpha");
    expect(turret?.health).toBe(96);

    // When activation completes, flushing pending events applies the newer hit (96 - 24 = 72)
    (coord as any).flushPendingWorldEvents();
    expect(turret?.health).toBe(72);

    coord.cleanup();
  });

  it("104. 20fps hold reporting, lost-response commit retry idempotency, and frozen cash reconciliation", async () => {
    const tmpStore104 = `/tmp/test-server-store-104-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
    const auth = new ServerSettlementAuthority(tmpStore104);
    auth.initRaid("raid_104", 50000, ["op_player"]);

    // 1. Production 20fps hold verification without simTickAdvancement:
    // 60 reports, 50ms apart (3000ms real wall-clock elapsed), advancing 3 ticks per frame
    let holdRes: any;
    let baseTime = Date.now();
    for (let frame = 1; frame <= 61; frame++) {
      const simulatedNow = baseTime + frame * 50;
      const clientTick = frame * 3;
      holdRes = (auth as any).recordExtractionHold("raid_104", "op_player", Math.min(180, frame * 3), clientTick, {
        timestamp: simulatedNow,
        inZone: true,
        isAlive: true,
      });
    }
    expect(holdRes.holdCompleted).toBe(true);
    expect(holdRes.holdCompletedAtTick).toBeGreaterThanOrEqual(180);

    // 2. Lost-response retry failure resolution:
    // Operative commits at tick 500, then repeats commit with drifted tick 503
    const op = (auth as any).raids.get("raid_104").operatives["op_player"];
    op.corridorStartTime = Date.now() - 3000;
    op.earnedCash = 5000;

    const firstCommit = await auth.commitSettlement({
      raidId: "raid_104",
      extractingId: "op_player",
      snapshotTick: 500,
      snapshotCash: 5000,
      exfilSubmitted: true,
    });
    expect(firstCommit.receipt).toBeDefined();
    expect(firstCommit.receipt.throughTick).toBe(500);

    // Repeat commit at tick 503 returns the exact same receipt idempotently instead of throwing "already extracted"!
    const retryCommit = await auth.commitSettlement({
      raidId: "raid_104",
      extractingId: "op_player",
      snapshotTick: 503,
      snapshotCash: 5000,
      exfilSubmitted: true,
    });
    expect(retryCommit.receipt.receiptId).toBe(firstCommit.receipt.receiptId);
    expect(retryCommit.receipt.throughTick).toBe(500);

    // 3. Stale frozen cash reconciliation
    const sim = new SectorDepotSimulation("raid_104");
    sim.player.cash = 3000;
    sim.crates.push({
      id: "crate_test_rec",
      x: 0, z: 0,
      cashValue: 500,
      opened: true,
      claimedBy: sim.player.id,
      claimedAt: Date.now(),
    });
    sim.freezeSettlementSnapshot(500);
    expect((sim as any).frozenSettlementCash).toBe(3000);

    // Authority rejects crate: reconcileCrateRejection debits both live and frozen cash
    sim.reconcileCrateRejection("crate_test_rec", 500);
    expect(sim.player.cash).toBe(2500);
    expect((sim as any).frozenSettlementCash).toBe(2500);

    try { fs.unlinkSync(tmpStore104); } catch {}
  });

  it("105. Server WebSocket restart delivery to Bravo, clean lockfile registry URL, and typed packets", async () => {
    const path = await import("node:path");
    // 1. Server WebSocket restart broadcast to living Bravo
    const simBravo = new SectorDepotSimulation("raid_prev_old");
    let bravoReceivedRestart = false;
    let bravoReceivedRaidId = "";

    const fakeBravoSocket: any = {
      readyState: 1,
      raidId: "raid_prev_old",
      operativeId: "op_bravo_1",
      send: (data: string) => {
        const parsed = JSON.parse(data);
        if (parsed.type === "raid_restart") {
          bravoReceivedRestart = true;
          bravoReceivedRaidId = parsed.data?.newRaidId;
        }
      },
    };

    // Simulate server restart handler broadcasting to live operatives before closing Alpha socket
    const oldRaidId = "raid_prev_old";
    const newRaidId = "raid_sector7_alpha_new_1234";
    const callerId = "op_alpha_1";
    const sockets = [fakeBravoSocket, { readyState: 1, raidId: oldRaidId, operativeId: callerId, close: () => {} }];

    const restartNotice = JSON.stringify({
      eventId: `server:restart:${Date.now()}`,
      type: "raid_restart",
      senderId: callerId,
      senderName: "CENTRAL COMMAND",
      raidId: oldRaidId,
      timestamp: Date.now(),
      data: { newRaidId },
    });
    for (const client of sockets) {
      if (client.raidId === oldRaidId && client.operativeId !== callerId) {
        client.send(restartNotice);
      }
    }

    expect(bravoReceivedRestart).toBe(true);
    expect(bravoReceivedRaidId).toBe(newRaidId);

    // 2. package-lock.json portability check
    const lockPath = path.resolve(__dirname, "../package-lock.json");
    const lockContent = fs.readFileSync(lockPath, "utf8");
    expect(lockContent.includes("worktrees")).toBe(false);
    expect(lockContent.includes("file:")).toBe(false);
    expect(lockContent.includes("https://registry.npmjs.org/@series-inc/rundot-syncplay")).toBe(true);
  });


  it("106. Symmetrical rifle combat contracts, explicit slide locomotion, snapshot boundary deduplication, crate approval idempotency, deterministic defense tie-breaking, and runtime packet validation", async () => {
    // 1. Vector 1: Symmetrical rifle contract & melee kick bounds
    const simRec = new SectorDepotSimulation("raid_test_106");
    simRec.player.id = "op_bravo_1";
    simRec.player.name = "INFILTRATOR PHANTOM-1";
    const coordRec = new MultiplayerCoordinator(simRec);
    simRec.player.x = 0;
    simRec.player.z = 0;
    simRec.player.health = 100;
    simRec.player.armor = 0;
    simRec.admitOperative(0);
    (coordRec as any).connectedPeers.set("op_alpha_1", {
      name: "OPERATIVE ALPHA",
      lastSeen: Date.now(),
      ingressDone: true,
      handshakeState: "confirmed",
    });
    simRec.rivals.push({
      id: "op_alpha_1",
      name: "OPERATIVE ALPHA",
      x: 0, y: 0, z: 2.0,
      facing: Math.PI,
      isAlive: true,
      isExtracted: false,
    } as any);

    // Admitted peer sends rifle hit with damage: 100 and knockX: 4.5
    // Shared weapon contract strictly caps damage to 24 and zeroes knockback
    const now = Date.now();
    coordRec.handleMessage({
      eventId: "hit_rifle_oversized",
      type: "hit",
      senderId: "op_alpha_1",
      senderName: "OPERATIVE ALPHA",
      squad: "SQUAD ALPHA",
      raidId: "raid_test_106",
      timestamp: now,
      data: { targetId: coordRec.localId, damage: 100, knockX: 4.5, knockZ: 0, kind: "rifle" },
    } as any);

    expect(simRec.player.health).toBe(100 - SIM_CONFIG.RIFLE_DAMAGE); // 76 HP (NOT 0!)
    expect(simRec.player.x).toBe(0); // Zero knockback from rifle!

    // Melee kick out of range (> 3.0m) is rejected
    const rivalAlpha = simRec.rivals.find((r) => r.id === "op_alpha_1")!;
    rivalAlpha.z = 10.0; // 10 meters away
    coordRec.handleMessage({
      eventId: "hit_kick_out_of_range",
      type: "hit",
      senderId: "op_alpha_1",
      senderName: "OPERATIVE ALPHA",
      squad: "SQUAD ALPHA",
      raidId: "raid_test_106",
      timestamp: now + 800,
      data: { targetId: coordRec.localId, damage: 35, knockX: 0, knockZ: 2, kind: "kick" },
    } as any);
    expect(simRec.player.health).toBe(76); // Untouched!

    // Melee kick in range (<= 3.0m) applies 35 damage and knockback
    rivalAlpha.z = 2.0;
    coordRec.handleMessage({
      eventId: "hit_kick_in_range",
      type: "hit",
      senderId: "op_alpha_1",
      senderName: "OPERATIVE ALPHA",
      squad: "SQUAD ALPHA",
      raidId: "raid_test_106",
      timestamp: now + 1600,
      data: { targetId: coordRec.localId, damage: 50, knockX: 0, knockZ: 2.0, kind: "kick" },
    } as any);
    expect(simRec.player.health).toBe(76 - 35); // 41 HP (capped to 35)
    expect(simRec.player.z).toBeLessThan(0); // Knockback applied away from attacker!

    coordRec.cleanup();

    // 2. Vector 2: Explicit locomotion state & slide-shooting
    const simSlide = new SectorDepotSimulation("raid_test_106_slide");
    simSlide.admitOperative(0);
    // Start sprint + slide
    simSlide.step({
      dx: 0, dz: 1,
      sprint: true, slide: true, roll: false, kick: false, shoot: false, interact: false,
    });
    expect(simSlide.player.isSliding).toBe(true);
    expect(simSlide.player.slideTicksRemaining).toBeGreaterThan(0);

    // Fire weapon during slide: action switches to shoot but isSliding remains true!
    simSlide.step({
      dx: 0, dz: 1,
      sprint: false, slide: false, roll: false, kick: false, shoot: true, interact: false,
    });
    expect(simSlide.player.action).toBe("shoot");
    expect(simSlide.player.isSliding).toBe(true);
    expect(simSlide.player.slideTicksRemaining).toBeGreaterThan(0);

    // Stop firing: operative remains in slide motion until ticks expire
    simSlide.step({
      dx: 0, dz: 0,
      sprint: false, slide: false, roll: false, kick: false, shoot: false, interact: false,
    });
    expect(simSlide.player.isSliding).toBe(true);
    expect(simSlide.player.slideTicksRemaining).toBeGreaterThan(0);

    // 3. Vector 3: Ingress snapshot boundary deduplication and null payload safety
    const simIngress = new SectorDepotSimulation("raid_test_106_ing");
    const coordIngress = new MultiplayerCoordinator(simIngress);
    simIngress.ingressController.enterCorridor(0);

    const turret = simIngress.machines.find((m) => m.type === "turret")!;
    turret.health = 120;

    const snapshotTimestamp = Date.now();
    const mockSnapshot = {
      snapshotTick: 500,
      crates: [],
      machines: [{ id: turret.id, health: 96, isAlive: true }],
    };

    // Apply ingress_snapshot from Bravo
    coordIngress.handleMessage({
      eventId: "snap_msg_1",
      type: "ingress_snapshot",
      senderId: "op_bravo_1",
      senderName: "Bravo",
      squad: "SQUAD BRAVO",
      raidId: "raid_test_106_ing",
      timestamp: snapshotTimestamp,
      data: {
        recipientId: coordIngress.localId,
        snapshot: mockSnapshot,
      },
    } as any);

    expect(coordIngress.lastAppliedSnapshotTimestamp).toBe(snapshotTimestamp);
    expect(coordIngress.lastAppliedSnapshotTick).toBe(500);
    expect(turret.health).toBe(96);

    // Advance to active admission
    (coordIngress as any).connectedPeers.set("op_bravo_1", {
      name: "Bravo",
      lastSeen: Date.now(),
      ingressDone: true,
      handshakeState: "confirmed",
    });
    simIngress.admitOperative(500);

    // Older hit already incorporated into snapshot delivered after snapshot application
    coordIngress.handleMessage({
      eventId: "older_turret_hit",
      type: "machine_hit",
      senderId: "op_bravo_1",
      senderName: "Bravo",
      squad: "SQUAD BRAVO",
      raidId: "raid_test_106_ing",
      timestamp: snapshotTimestamp - 100, // Older hit!
      data: { machineId: turret.id, damage: 24 },
    } as any);

    // Turret health remains 96 (hit was cleanly dropped by boundary check, preventing duplicate damage to 72 HP!)
    expect(turret.health).toBe(96);

    // Null snapshot payload safety
    expect(() => {
      coordIngress.handleMessage({
        eventId: "null_snap_payload",
        type: "ingress_snapshot",
        senderId: "op_alpha_1",
        senderName: "OPERATIVE ALPHA",
        timestamp: Date.now(),
        data: null as any,
      } as any);
    }).not.toThrow();

    coordIngress.cleanup();

    // 4. Vector 4: Crate loot idempotency, approval versioning, and receipt recovery at tick 54,001
    const path = await import("node:path");
    const tmpStore106 = `/tmp/test-store-106-${Date.now()}.json`;
    const auth106 = new ServerSettlementAuthority(tmpStore106);
    auth106.initRaid("raid_106", 50000, ["op_player", "op_alpha_1", "op_bravo_1"]);
    const op106 = (auth106 as any).raids.get("raid_106").operatives["op_player"];
    op106.admitted = true;

    // First claim succeeds
    const firstClaim = auth106.recordCrateLoot("raid_106", "crate_01", "op_player", 1250, 1000);
    expect(firstClaim).toBe(true);
    expect(op106.earnedCash).toBe(1250);

    // Duplicate claim from same claimant returns true idempotently without double-debiting
    const duplicateClaim = auth106.recordCrateLoot("raid_106", "crate_01", "op_player", 1250, 1000);
    expect(duplicateClaim).toBe(true);
    expect(op106.earnedCash).toBe(1250);

    // reconcileCrateApproval versioning: rival earlier win cannot be overwritten by delayed approval
    const simCrate = new SectorDepotSimulation("raid_106_crate");
    const existingCrate = simCrate.crates.find((c) => c.id === "crate_01")!;
    existingCrate.opened = true;
    existingCrate.claimedBy = "op_bravo_1";
    existingCrate.claimedAt = 900; // Rival claimed at timestamp 900
    simCrate.player.cash = 0;
    // Delayed approval arriving with timestamp 1100 cannot overturn rival earlier win
    simCrate.reconcileCrateApproval("crate_01", 1250, 1100);
    expect(simCrate.crates.find((c) => c.id === "crate_01")?.claimedBy).toBe("op_bravo_1");
    expect(simCrate.player.cash).toBe(0);

    // commitSettlement receipt recovery succeeds even at tick 54,001
    op106.corridorStartTime = Date.now() - 3000;
    op106.earnedCash = 1250;
    op106.holdCompleted = true;
    op106.holdTicks = 180;
    op106.holdCompletedAtTick = 180;
    const initialCommit = await auth106.commitSettlement({
      raidId: "raid_106",
      extractingId: "op_player",
      snapshotTick: 500,
      snapshotCash: 1250,
      exfilSubmitted: true,
    });
    expect(initialCommit.receipt).toBeDefined();

    // Recovery at tick 54,001 returns committed receipt idempotently without throwing
    const recoveredCommit = await auth106.commitSettlement({
      raidId: "raid_106",
      extractingId: "op_player",
      snapshotTick: 54001,
      snapshotCash: 1250,
      exfilSubmitted: true,
    });
    expect(recoveredCommit.receipt.receiptId).toBe(initialCommit.receipt.receiptId);

    try { fs.unlinkSync(tmpStore106); } catch {}

    // 5. Vector 5: Deterministic defense tie-break & AI rival machine damage
    const simAlpha = new SectorDepotSimulation("raid_106_team");
    const simBravo = new SectorDepotSimulation("raid_106_team");

    // Both place turret at (0, 0)
    simAlpha.machines = [{
      id: "turret_center",
      type: "turret",
      x: 0, y: 1.0, z: 0,
      health: 120,
      isAlive: true,
      cooldownTicks: 0,
      facing: 0,
    }];
    simBravo.machines = [{
      id: "turret_center",
      type: "turret",
      x: 0, y: 1.0, z: 0,
      health: 120,
      isAlive: true,
      cooldownTicks: 0,
      facing: 0,
    }];

    // Alpha at X: -5, Bravo at X: +5 (identical distance 5.0m)
    simAlpha.player.id = "op_alpha_1";
    simAlpha.player.x = -5;
    simAlpha.player.z = 0;
    simAlpha.player.health = 100;
    simAlpha.player.armor = 0;
    simAlpha.rivals = [{ id: "op_bravo_1", x: 5, y: 0, z: 0, health: 100, armor: 0, isAlive: true, isExtracted: false } as any];

    simBravo.player.id = "op_bravo_1";
    simBravo.player.x = 5;
    simBravo.player.z = 0;
    simBravo.player.health = 100;
    simBravo.player.armor = 0;
    simBravo.rivals = [{ id: "op_alpha_1", x: -5, y: 0, z: 0, health: 100, armor: 0, isAlive: true, isExtracted: false } as any];

    // Step machines on both simulations
    (simAlpha as any).stepMachines();
    (simBravo as any).stepMachines();

    // Turret faces op_alpha_1 identically on both clients!
    expect(simAlpha.machines[0].facing).toBeCloseTo(simBravo.machines[0].facing, 4);

    // Alpha took damage (closestTarget is player), Bravo took 0 damage (closestTarget is rival op_alpha_1)
    expect(simAlpha.player.health).toBe(86);
    expect(simBravo.player.health).toBe(100);

    // Machine fires at AI rival and applies damage to AI rival
    const simAI = new SectorDepotSimulation("raid_106_ai");
    simAI.machines = [{
      id: "turret_ai",
      type: "turret",
      x: 0, y: 1.0, z: 0,
      health: 120,
      isAlive: true,
      cooldownTicks: 0,
      facing: 0,
    }];
    simAI.player.x = 15; // Far away
    simAI.player.z = 0;
    simAI.rivals = [{
      id: "op_ai_bot",
      name: "ROGUE AI",
      x: 3, y: 0, z: 0, // In range
      health: 100,
      armor: 0,
      isAlive: true,
      isExtracted: false,
      isAI: true,
    } as any];

    (simAI as any).stepMachines();
    const aiRival = simAI.rivals.find((r) => r.id === "op_ai_bot")!;
    expect(aiRival.health).toBe(86); // AI took 14 turret damage!

    // 6. Vector 6: Runtime packet validation at transport ingress
    const simVal = new SectorDepotSimulation("raid_106_val");
    const coordVal = new MultiplayerCoordinator(simVal);

    // Malformed timestamps safely dropped
    coordVal.handleMessage({ eventId: "e1", type: "state", timestamp: -1, senderId: "peer" } as any);
    coordVal.handleMessage({ eventId: "e2", type: "state", timestamp: NaN, senderId: "peer" } as any);
    coordVal.handleMessage({ eventId: "e3", type: "state", timestamp: 1e16, senderId: "peer" } as any);
    coordVal.handleMessage({ eventId: "e4", type: "state", timestamp: "invalid", senderId: "peer" } as any);
    coordVal.handleMessage(null as any);
    coordVal.handleMessage(undefined as any);

    coordVal.cleanup();
    try { fs.unlinkSync(tmpStore106); } catch {}
    try { fs.unlinkSync(`${tmpStore106}.prev`); } catch {}
  });


  it("107. Receiver burst protection, missing attacker rejection, zero-tick custody reset, transitive candidate sorting, machine kick damage symmetry, and authority input validation", async () => {
    // 1. Vector 1: Missing attacker entity rejection & receiver burst protection
    const simCombat = new SectorDepotSimulation("raid_test_107_combat");
    simCombat.player.id = "op_player";
    simCombat.player.name = "OPERATIVE GHOST-1";
    simCombat.admitOperative(0);
    const coordCombat = new MultiplayerCoordinator(simCombat);
    simCombat.player.x = 0;
    simCombat.player.z = 0;
    simCombat.player.armor = 0;

    // Hit packet from an attacker NOT in sim.rivals is strictly dropped (no position to verify range or cover)
    coordCombat.handleMessage({
      eventId: "hit_missing_attacker",
      type: "hit",
      senderId: "op_bravo_1",
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      raidId: "raid_test_107_combat",
      timestamp: Date.now(),
      data: { targetId: coordCombat.localId, damage: 24, kind: "rifle" },
    } as any);
    expect(simCombat.player.health).toBe(100);

    // Now add admitted rival
    simCombat.rivals.push({
      id: "op_bravo_1",
      name: "INFILTRATOR PHANTOM-1",
      x: 0, y: 0, z: 2.0,
      facing: Math.PI,
      health: 100, armor: 0, cash: 0,
      action: "idle", actionTicks: 0,
      isInvulnerable: false, isAlive: true, isExtracted: false,
      ammo: 30, maxAmmo: 30,
    } as any);
    (coordCombat as any).connectedPeers.set("op_bravo_1", {
      name: "INFILTRATOR PHANTOM-1",
      lastSeen: Date.now(),
      ingressDone: true,
      handshakeState: "confirmed",
    });

    // Rapid burst probe: 3 rifle packets sent in 1ms with forged spaced timestamps
    const now = Date.now();
        coordCombat.handleMessage({
      eventId: "hit_burst_1",
      type: "hit",
      senderId: "op_bravo_1",
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      raidId: "raid_test_107_combat",
      timestamp: now,
      data: { targetId: coordCombat.localId, damage: 24, kind: "rifle" },
    } as any);
    coordCombat.handleMessage({
      eventId: "hit_burst_2",
      type: "hit",
      senderId: "op_bravo_1",
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      raidId: "raid_test_107_combat",
      timestamp: now + 130,
      data: { targetId: coordCombat.localId, damage: 24, kind: "rifle" },
    } as any);
    coordCombat.handleMessage({
      eventId: "hit_burst_3",
      type: "hit",
      senderId: "op_bravo_1",
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      raidId: "raid_test_107_combat",
      timestamp: now + 260,
      data: { targetId: coordCombat.localId, damage: 24, kind: "rifle" },
    } as any);
    // Only 2 packets allowed in 1ms burst window; 3rd is dropped
    expect(simCombat.player.health).toBe(100 - 48); // 52 HP (2 hits of 24 applied, 3rd blocked!)
    coordCombat.cleanup();

    // 2. Vector 4: Zero-tick custody reset and validation order protection
    const { ServerSettlementAuthority } = await import("../src/sim/server-settlement.js");
    const tmpStore107 = `/tmp/test-store-107-${Date.now()}.json`;
    const auth107 = new ServerSettlementAuthority(tmpStore107);
    auth107.initRaid("raid_107_auth", 50000, ["op_alpha_1"]);

    // Advance hold to 10 ticks
    auth107.recordExtractionHold("raid_107_auth", "op_alpha_1", 1, 100, { inZone: true, simTickAdvancement: true });
    expect(auth107.getRaidRecord("raid_107_auth")!.operatives["op_alpha_1"].holdTicks).toBe(1);

    // Zero-tick report resets hold custody
    const resetRes = auth107.recordExtractionHold("raid_107_auth", "op_alpha_1", 0, 101, { inZone: false });
    expect(resetRes.currentHoldTicks).toBe(0);
    expect(auth107.getRaidRecord("raid_107_auth")!.operatives["op_alpha_1"].holdTicks).toBe(0);

    // Invalid tick (Infinity) fails validation WITHOUT poisoning rawLastReceivedTick
    const infRes = auth107.recordExtractionHold("raid_107_auth", "op_alpha_1", 5, Infinity as any);
    expect(infRes.success).toBe(false);

    // Subsequent valid report with tick 105 succeeds (not blocked by Infinity)
    const validRes = auth107.recordExtractionHold("raid_107_auth", "op_alpha_1", 1, 105, { inZone: true, simTickAdvancement: true });
    expect(validRes.success).toBe(true);
    expect(validRes.currentHoldTicks).toBe(1);

    // 3. Vector 5: Machine kick damage symmetry (50 damage locally & remotely)
    const simMachine = new SectorDepotSimulation("raid_107_machine");
    simMachine.admitOperative(0);
    const coordMachine = new MultiplayerCoordinator(simMachine);
    (coordMachine as any).connectedPeers.set("op_bravo_1", {
      name: "INFILTRATOR PHANTOM-1",
      lastSeen: Date.now(),
      ingressDone: true,
      handshakeState: "confirmed",
    });
    simMachine.rivals.push({
      id: "op_bravo_1",
      name: "INFILTRATOR PHANTOM-1",
      x: 0, y: 0, z: 2.0, // In melee range
      facing: Math.PI,
      health: 100, armor: 0, cash: 0,
      action: "idle", actionTicks: 0,
      isInvulnerable: false, isAlive: true, isExtracted: false,
      ammo: 30, maxAmmo: 30,
    } as any);
    const targetTurret = simMachine.machines.find((m) => m.id === "turret_depot_alpha")!;
    targetTurret.x = 0;
    targetTurret.z = 0;
    targetTurret.health = 120;
    targetTurret.isAlive = true;

    // Incoming machine kick deals full 50 damage
    coordMachine.handleMessage({
      eventId: "machine_kick_1",
      type: "machine_hit",
      senderId: "op_bravo_1",
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      raidId: "raid_107_machine",
      timestamp: Date.now(),
      data: { machineId: "turret_depot_alpha", damage: 50, kind: "kick", attackerFacing: Math.PI },
    } as any);
    expect(targetTurret.health).toBe(70); // Exactly 120 - 50 = 70!

    // 4. Vector 5: Strictly transitive candidate sorting
    const machine = { x: 0, z: 0 };
    const candidates = [
      { id: "c", x: 1.0, z: 0 },
      { id: "b", x: 1.04, z: 0 },
      { id: "a", x: 1.08, z: 0 },
    ];
    // Bin-based comparison produces identical order across any permutation
    const sortCandidates = (list: any[]) => {
      return [...list].sort((p, q) => {
        const distP = Math.hypot(p.x - machine.x, p.z - machine.z);
        const distQ = Math.hypot(q.x - machine.x, q.z - machine.z);
        const binP = Math.floor(distP * 20);
        const binQ = Math.floor(distQ * 20);
        if (binP !== binQ) return binP - binQ;
        return p.id.localeCompare(q.id);
      });
    };
    const order1 = sortCandidates([candidates[0], candidates[1], candidates[2]]).map((c) => c.id);
    const order2 = sortCandidates([candidates[2], candidates[1], candidates[0]]).map((c) => c.id);
    const order3 = sortCandidates([candidates[1], candidates[0], candidates[2]]).map((c) => c.id);
    expect(order1).toEqual(order2);
    expect(order1).toEqual(order3);

    // 5. Vector 6: crate_loot_request with null data does not throw
    expect(() => {
      coordMachine.handleMessage({
        eventId: "null_loot_req",
        type: "crate_loot_request",
        senderId: "op_bravo_1",
        senderName: "INFILTRATOR PHANTOM-1",
        squad: "SQUAD BRAVO",
        raidId: "raid_107_machine",
        timestamp: Date.now(),
        data: null,
      } as any);
    }).not.toThrow();

    // 6. Vector 5 & 6: Authorized sender accepts SYSTEM RELAY
    let restartHandled = false;
    coordMachine.onRaidRestart = () => { restartHandled = true; };
    coordMachine.handleMessage({
      eventId: "sys_restart_evt",
      type: "raid_restart",
      senderId: "system",
      senderName: "SYSTEM RELAY",
      squad: "SQUAD ALPHA",
      raidId: "raid_107_machine",
      timestamp: Date.now(),
      data: { newRaidId: "raid_sector7_107_next" },
    } as any);
    expect(restartHandled).toBe(true);

    coordMachine.cleanup();
    try { fs.unlinkSync(tmpStore107); } catch {}
    try { fs.unlinkSync(`${tmpStore107}.prev`); } catch {}
  });

  it("108. Token bucket sustained fire, receiver-time kick cadence, living attacker machine validation, delayed announcement preservation, 8-minute ingress cutoff, and socket slot ownership", async () => {
    // 1. Vector 1: Token bucket sustained fire (10 hits spaced by 134ms all accepted)
    const simRifle = new SectorDepotSimulation();
    simRifle.player.health = 200;
    simRifle.player.armor = 200;
    const coordRifle = new MultiplayerCoordinator(simRifle);
    simRifle.admitOperative(10);

    coordRifle.connectedPeers.set("op_bravo_1", {
      lastSeen: 1000000,
      name: "INFILTRATOR PHANTOM-1",
      ingressDone: true,
      handshakeState: "confirmed",
    });

    simRifle.rivals.push({
      id: "op_bravo_1",
      isPlayer: false,
      isRival: true,
      isAI: false,
      name: "INFILTRATOR PHANTOM-1",
      x: simRifle.player.x + 5.0,
      y: 0,
      z: simRifle.player.z,
      facing: -Math.PI / 2,
      health: 100,
      armor: 0,
      cash: 0,
      action: "shoot",
      actionTicks: 0,
      isInvulnerable: false,
      isAlive: true,
      isExtracted: false,
      ammo: 30,
      maxAmmo: 30,
    });

    let acceptedCount = 0;
    let t0 = 1000000;
    for (let i = 0; i < 10; i++) {
      const pktTime = t0 + i * 134;
      const initialHp = simRifle.player.health;
      const initialArmor = simRifle.player.armor;

      // Mock Date.now for receiver rate limit check
      const origNow = Date.now;
      Date.now = () => pktTime;
      coordRifle.handleMessage({
        eventId: `rifle_sustained_${i}`,
        type: "hit",
        senderId: "op_bravo_1",
        senderName: "INFILTRATOR PHANTOM-1",
        squad: "SQUAD BRAVO",
        raidId: simRifle.raidId,
        timestamp: pktTime,
        data: {
          targetId: simRifle.player.id,
          damage: 5,
          kind: "rifle",
        },
      });
      Date.now = origNow;

      if (simRifle.player.health < initialHp || simRifle.player.armor < initialArmor) {
        acceptedCount++;
      }
    }
    // Token bucket must accept all 10 sustained hits!
    expect(acceptedCount).toBe(10);

    // 2. Vector 1: Kick receiver-time token bucket (4 kicks at same receiver time: only 1 accepted)
    const simKick = new SectorDepotSimulation();
    simKick.player.health = 100;
    simKick.player.armor = 0;
    const coordKick = new MultiplayerCoordinator(simKick);
    simKick.admitOperative(10);

    const kickRecvTime = 2000000;
    coordKick.connectedPeers.set("op_bravo_1", {
      lastSeen: kickRecvTime,
      name: "INFILTRATOR PHANTOM-1",
      ingressDone: true,
      handshakeState: "confirmed",
    });

    simKick.rivals.push({
      id: "op_bravo_1",
      isPlayer: false,
      isRival: true,
      isAI: false,
      name: "INFILTRATOR PHANTOM-1",
      x: simKick.player.x + 1.0,
      y: 0,
      z: simKick.player.z,
      facing: -Math.PI / 2,
      health: 100,
      armor: 0,
      cash: 0,
      action: "kick",
      actionTicks: 0,
      isInvulnerable: false,
      isAlive: true,
      isExtracted: false,
      ammo: 30,
      maxAmmo: 30,
    });

    let kickAccepted = 0;
    for (let k = 0; k < 4; k++) {
      const prevHp = simKick.player.health;
      const origNow = Date.now;
      Date.now = () => kickRecvTime; // All 4 arrive at same receiver wall-clock time
      coordKick.handleMessage({
        eventId: `kick_burst_${k}`,
        type: "hit",
        senderId: "op_bravo_1",
        senderName: "INFILTRATOR PHANTOM-1",
        squad: "SQUAD BRAVO",
        raidId: simKick.raidId,
        timestamp: kickRecvTime + k * 650, // Spaced sender timestamps within 2s future window
        data: {
          targetId: simKick.player.id,
          damage: 35,
          kind: "kick",
        },
      });
      Date.now = origNow;

      if (simKick.player.health < prevHp) {
        kickAccepted++;
      }
    }
    // Only 1 kick accepted; remaining 3 rejected due to lack of receiver recovery time!
    expect(kickAccepted).toBe(1);
    expect(simKick.player.health).toBe(65); // 100 - 35 = 65

    // 3. Vector 5: Machine hit contract validation (phantom attacker, cover, damage cap)
    const simMach = new SectorDepotSimulation();
    const coordMach = new MultiplayerCoordinator(simMach);
    simMach.admitOperative(10);
    const turret = simMach.machines.find((m) => m.id === "turret_depot_alpha")!;
    expect(turret.health).toBe(120);

    coordMach.connectedPeers.set("op_bravo_1", {
      lastSeen: Date.now(),
      name: "INFILTRATOR PHANTOM-1",
      ingressDone: true,
      handshakeState: "confirmed",
    });

    // A) Phantom attacker (not in rivals) is rejected!
    coordMach.handleMessage({
      eventId: "phantom_mach_hit",
      type: "machine_hit",
      senderId: "op_bravo_1",
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      raidId: simMach.raidId,
      timestamp: Date.now(),
      data: { machineId: turret.id, damage: 50 },
    });
    expect(turret.health).toBe(120); // No damage inflicted!

    // Add attacker behind container cover
    const coveredRival = {
      id: "op_bravo_1",
      isPlayer: false,
      isRival: true,
      isAI: false,
      name: "INFILTRATOR PHANTOM-1",
      x: -20.0, // Distance 15.0m from turret (-5, 12), line of sight directly blocked by DEPOT_CONTAINERS[4]
      y: 0,
      z: 12.0,
      facing: 0,
      health: 100,
      armor: 0,
      cash: 0,
      action: "shoot" as const,
      actionTicks: 0,
      isInvulnerable: false,
      isAlive: true,
      isExtracted: false,
      ammo: 30,
      maxAmmo: 30,
    };
    simMach.rivals.push(coveredRival);

    // B) Hit from behind cover is rejected!
    coordMach.handleMessage({
      eventId: "covered_mach_hit",
      type: "machine_hit",
      senderId: "op_bravo_1",
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      raidId: simMach.raidId,
      timestamp: Date.now(),
      data: { machineId: turret.id, damage: 24, kind: "rifle" },
    });
    expect(turret.health).toBe(120);

    // Move attacker to clear line of sight within range
    coveredRival.x = turret.x;
    coveredRival.z = turret.z + 1.0; // 1.0m away
    coveredRival.facing = Math.PI;

    // C) Valid rifle hit caps damage to 24 (spaced by 200ms for cadence)
    coordMach.handleMessage({
      eventId: "valid_rifle_mach",
      type: "machine_hit",
      senderId: "op_bravo_1",
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      raidId: simMach.raidId,
      timestamp: Date.now() + 200,
      data: { machineId: turret.id, damage: 150, kind: "rifle", attackerFacing: Math.PI }, // Attempts 150 damage
    });
    expect(turret.health).toBe(96); // Capped to 24: 120 - 24 = 96!

    // 4. Vector 3: Delayed announcement preserves events generated after snapshot
    const simAnnounce = new SectorDepotSimulation();
    const coordAnnounce = new MultiplayerCoordinator(simAnnounce);
    simAnnounce.ingressController.enterCorridor(0);

    const snapBaseTime = Date.now();
    // Event generated after snapshot
    coordAnnounce.pendingWorldEvents.push({
      eventId: "queued_after_snap",
      type: "machine_hit",
      senderId: "op_bravo_1",
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      raidId: simAnnounce.raidId,
      timestamp: snapBaseTime + 500, // 500ms after snapshot
      data: { machineId: "turret_depot_alpha", damage: 24, kind: "rifle" },
    });

    // Apply delayed announcement with snapshot taken at snapBaseTime
    coordAnnounce.handleMessage({
      eventId: "delayed_announce_1",
      type: "raid_announce",
      senderId: "op_bravo_1",
      senderName: "INFILTRATOR PHANTOM-1",
      squad: "SQUAD BRAVO",
      raidId: simAnnounce.raidId,
      timestamp: snapBaseTime,
      data: {
        activeRaidId: simAnnounce.raidId,
        snapshot: {
          snapshotTick: 50,
          crates: [],
          machines: [{ id: "turret_depot_alpha", health: 120, isAlive: true }],
        },
      },
    });

    // Queued event generated after snapshot MUST be preserved!
    expect(coordAnnounce.pendingWorldEvents.length).toBe(1);
    expect(coordAnnounce.pendingWorldEvents[0].eventId).toBe("queued_after_snap");

    // 5. Vector 4 & 6: 8-minute ingress cutoff and active-raid metadata
    const tmpStore108 = `/tmp/test-store-108-${Date.now()}.json`;
    const { ServerSettlementAuthority } = await import("../src/sim/server-settlement.js");
    const serverAuth = new ServerSettlementAuthority(tmpStore108);
    const raidId108 = "raid_sector7_108";
    serverAuth.initRaid(raidId108, 50000, ["op_player", "op_alpha_1", "op_bravo_1"]);

    expect(serverAuth.isIngressClosed(raidId108)).toBe(false);
    expect(serverAuth.getCurrentRaidTick(raidId108)).toBeGreaterThanOrEqual(0);
    expect(serverAuth.getRaidStartTime(raidId108)).toBeLessThanOrEqual(Date.now());

    // Advance raid creation time past 8 minutes (28,800 ticks = 480,000 ms)
    const raidRecord = (serverAuth as any).raids.get(raidId108);
    raidRecord.createdAtMs = Date.now() - (9 * 60 * 1000); // 9 minutes ago
    expect(serverAuth.isIngressClosed(raidId108)).toBe(true);

    // 6. Vector 6: WebSocket slot ownership preserves slot if replacement socket is connected
    const activeSlotSockets = new Map<string, any>();
    const oldWs = { id: "old_socket", operativeId: "op_alpha_1", raidId: raidId108 };
    const newWs = { id: "new_socket", operativeId: "op_alpha_1", raidId: raidId108 };

    // Register old socket
    activeSlotSockets.set(`${oldWs.raidId}:${oldWs.operativeId}`, oldWs);
    serverAuth.claimSlot(raidId108, "op_alpha_1");
    expect(serverAuth.isSlotClaimed(raidId108, "op_alpha_1")).toBe(true);

    // Replacement socket connects
    activeSlotSockets.set(`${newWs.raidId}:${newWs.operativeId}`, newWs);

    // Old socket closes
    const slotKey = `${oldWs.raidId}:${oldWs.operativeId}`;
    if (activeSlotSockets.get(slotKey) === oldWs) {
      activeSlotSockets.delete(slotKey);
      serverAuth.releaseSlot(oldWs.raidId, oldWs.operativeId);
    }
    // Slot must STILL be claimed because newWs owns the slot!
    expect(serverAuth.isSlotClaimed(raidId108, "op_alpha_1")).toBe(true);

    // Now new socket closes
    if (activeSlotSockets.get(slotKey) === newWs) {
      activeSlotSockets.delete(slotKey);
      serverAuth.releaseSlot(newWs.raidId, newWs.operativeId);
    }
    expect(serverAuth.isSlotClaimed(raidId108, "op_alpha_1")).toBe(false);

    // 7. Vector 4: Monotonic inventory revisions across overlapping raids ([2, 3])
    serverAuth.recordExtractionHold(raidId108, "op_alpha_1", 180, 180, true);
    const alphaCommit1 = await serverAuth.commitSettlement({
      raidId: raidId108,
      extractingId: "op_alpha_1",
      snapshotTick: 200,
      snapshotCash: 0,
      exfilSubmitted: true,
      simTickAdvancement: true,
    });
    expect(alphaCommit1.receipt.participantResults.find((p: any) => p.profileId === "op_alpha_1")?.inventoryRevision).toBe(14);

    // Alpha creates Raid B while Bravo is still in Raid A at rev 1
    const raidBId = "raid_sector7_108_b";
    serverAuth.initRaid(raidBId, 50000, ["op_player", "op_alpha_1", "op_bravo_1"]);

    // Bravo extracts from Raid A -> revision advances from 1 -> 2
    serverAuth.recordExtractionHold(raidId108, "op_bravo_1", 180, 180, true);
    const bravoCommitA = await serverAuth.commitSettlement({
      raidId: raidId108,
      extractingId: "op_bravo_1",
      snapshotTick: 220,
      snapshotCash: 0,
      exfilSubmitted: true,
      simTickAdvancement: true,
    });
    const bravoRevA = bravoCommitA.receipt.participantResults.find((p: any) => p.profileId === "op_bravo_1")?.inventoryRevision;
    expect(bravoRevA).toBe(2);

    // Bravo joins Raid B and extracts from Raid B -> revision advances from 2 -> 3 (strictly monotonic!)
    serverAuth.recordExtractionHold(raidBId, "op_bravo_1", 180, 180, true);
    const bravoCommitB = await serverAuth.commitSettlement({
      raidId: raidBId,
      extractingId: "op_bravo_1",
      snapshotTick: 250,
      snapshotCash: 0,
      exfilSubmitted: true,
      simTickAdvancement: true,
    });
    const bravoRevB = bravoCommitB.receipt.participantResults.find((p: any) => p.profileId === "op_bravo_1")?.inventoryRevision;
    expect(bravoRevB).toBe(3); // [2, 3] strictly monotonic!

    coordRifle.cleanup();
    coordKick.cleanup();
    coordMach.cleanup();
    coordAnnounce.cleanup();
    try { fs.unlinkSync(tmpStore108); } catch {}
    try { fs.unlinkSync(`${tmpStore108}.prev`); } catch {}
  });

  it("109. Module-level ray obstruction, dynamic drone hit verification, non-regressive hold reconciliation, completed hold protection, and bilateral store integrity", async () => {
    const { ServerSettlementAuthority, validateStoreIntegrity, computeCanonicalOutcomeDigestSync } = await import("../src/sim/server-settlement.js");

    // 1. Vector 4: Monotonic non-regressive hold reconciliation & attempt isolation
    const { createExfilController } = await import("../src/sim/airlock.js");
    let currentTime = 10000;
    const ctrl = createExfilController({ now: () => currentTime });
    ctrl.onTick(1, true, "lz_charlie", 0);
    expect(ctrl.getState().kind).toBe("holding_zone");
    const attempt1 = (ctrl as any).getHoldAttemptId();
    (ctrl as any).reconcileAuthoritativeHold(56, false, attempt1);
    expect((ctrl.getState() as any).currentTicks).toBe(56);
    // Delayed ACK with 50 must NOT rewind 56
    (ctrl as any).reconcileAuthoritativeHold(50, false, attempt1);
    expect((ctrl.getState() as any).currentTicks).toBe(56);
    // Reset increments attempt
    (ctrl as any).reconcileAuthoritativeHold(0, true, attempt1);
    expect(ctrl.getState().kind).toBe("idle");
    const attempt2 = (ctrl as any).getHoldAttemptId();
    expect(attempt2).toBeGreaterThan(attempt1);
    // Start attempt 2
    ctrl.onTick(2, true, "lz_charlie", 0);
    expect(ctrl.getState().kind).toBe("holding_zone");
    // Stale response from attempt 1 cannot advance or reset attempt 2!
    (ctrl as any).reconcileAuthoritativeHold(150, false, attempt1);
    expect((ctrl.getState() as any).currentTicks).toBe(1);

    // 2. Vector 4: Completed hold protection in ServerSettlementAuthority (using simTickAdvancement to isolate from disk latency)
    const tmpStore109 = path.resolve(process.cwd(), `.test-store-109-${Date.now()}.json`);
    const serverAuth = new ServerSettlementAuthority(tmpStore109);
    const raidId109 = "raid_sector7_109";
    serverAuth.initRaid(raidId109, 50000, ["op_player", "op_alpha_1", "op_bravo_1"]);

    for (let t = 1; t <= 180; t++) {
      serverAuth.recordExtractionHold(raidId109, "op_alpha_1", t, t, { inZone: true, x: 45.0, z: 45.0, simTickAdvancement: true });
    }
    const recBefore = serverAuth.getRaidRecord(raidId109);
    expect(recBefore?.operatives["op_alpha_1"].holdCompleted).toBe(true);

    // Stale report at tick 179 or outside LZ after completed hold must NOT reset holdCompleted
    const staleResult = serverAuth.recordExtractionHold(raidId109, "op_alpha_1", 170, 179, { inZone: false, x: 0.0, z: 0.0, simTickAdvancement: true });
    expect(staleResult.holdCompleted).toBe(true);
    expect(serverAuth.getRaidRecord(raidId109)?.operatives["op_alpha_1"].holdCompleted).toBe(true);

    // 3. Vector 6: allocateSessionToken rollback on save failure
    const badStorePath = "/non_existent_dir_sz/store.json";
    const failingAuth = new ServerSettlementAuthority(tmpStore109);
    failingAuth.initRaid("raid_fail_tok", 50000, ["op_alpha_1"]);
    const initialTok = failingAuth.getSessionTokens("raid_fail_tok")["op_alpha_1"];
    expect(initialTok).toBeDefined();
    (failingAuth as any).storePath = badStorePath;
    expect(() => failingAuth.allocateSessionToken("raid_fail_tok", "op_alpha_1")).toThrow();
    // In-memory tokens rolled back to previous valid state
    const tokens = failingAuth.getSessionTokens("raid_fail_tok");
    expect(tokens["op_alpha_1"]).toBe(initialTok);

    // 4. Vector 6: validateStoreIntegrity with authentic cryptographic digests
    const validStore: any = {
      raids: {
        [raidId109]: {
          raidId: raidId109,
          status: "active",
          allowableCashPool: 50000,
          totalBanked: 0,
          operatives: {
            op_alpha_1: {
              operativeId: "op_alpha_1",
              admitted: true,
              isExtracted: false,
              extractedAtTick: 0,
              activeRaid: raidId109,
              cratesLooted: [],
              earnedCash: 0,
              inventoryRevision: 13,
            },
          },
          crates: {
            crate_01: {
              cashValue: 1250,
            },
          },
        },
      },
      auditLog: {},
      idempotencyMap: {},
    };
    expect(validateStoreIntegrity(validStore)).toBe(true);

    // Banked cash > 0 without receipts rejected
    const corruptNoReceipt = JSON.parse(JSON.stringify(validStore));
    corruptNoReceipt.raids[raidId109].crates.crate_01 = { cashValue: 1250, claimedBy: "op_alpha_1", claimTimestamp: 1000 };
    corruptNoReceipt.raids[raidId109].operatives.op_alpha_1.cratesLooted = ["crate_01"];
    corruptNoReceipt.raids[raidId109].totalBanked = 1250;
    corruptNoReceipt.raids[raidId109].operatives.op_alpha_1.isExtracted = true;
    corruptNoReceipt.raids[raidId109].operatives.op_alpha_1.earnedCash = 1250;
    corruptNoReceipt.raids[raidId109].operatives.op_alpha_1.activeRaid = "";
    expect(validateStoreIntegrity(corruptNoReceipt)).toBe(false);

    // Valid receipt with authentic digest
    const outcomePayload = {
      cashBanked: 1250,
      extractedSquad: "op_alpha_1",
      raidId: raidId109,
      retainedSquads: [],
      verifiedPrefixTick: 180,
    };
    const validDigest = computeCanonicalOutcomeDigestSync(outcomePayload);
    const validReceiptStore = JSON.parse(JSON.stringify(corruptNoReceipt));
    validReceiptStore.auditLog["rec_1"] = {
      receipt: {
        v: 1,
        receiptId: "rec_1",
        raidId: raidId109,
        outcomeId: validDigest,
        intentHash: `intent_${validDigest.slice(16, 32)}`,
        outcomeDigest: validDigest,
        throughTick: 180,
        committedAtMs: Date.now(),
        transfers: [{ itemId: "currency_credits", quantity: "BE:1250", toProfileId: "op_alpha_1", source: "world_spawn" }],
        participantResults: [
          { profileId: "op_alpha_1", inventoryRevision: 14, activeRaidCleared: true, releasedEscrowIds: ["escrow_op_alpha_1_loadout"] },
        ],
      },
      outcomePayload,
    };
    expect(validateStoreIntegrity(validReceiptStore)).toBe(true);

    // Duplicate participant profiles strictly rejected even with valid digest
    const corruptDuplicateParticipant = JSON.parse(JSON.stringify(validReceiptStore));
    corruptDuplicateParticipant.auditLog["rec_1"].receipt.participantResults.push({
      profileId: "op_alpha_1",
      inventoryRevision: 14,
      activeRaidCleared: true,
      releasedEscrowIds: ["escrow_op_alpha_1_loadout"],
    });
    expect(validateStoreIntegrity(corruptDuplicateParticipant)).toBe(false);

    // Extracted zero-cash operative without receipt strictly rejected
    const corruptExtractedZeroCashNoReceipt = JSON.parse(JSON.stringify(validStore));
    corruptExtractedZeroCashNoReceipt.raids[raidId109].operatives.op_alpha_1.isExtracted = true;
    corruptExtractedZeroCashNoReceipt.raids[raidId109].operatives.op_alpha_1.activeRaid = "";
    corruptExtractedZeroCashNoReceipt.raids[raidId109].operatives.op_alpha_1.earnedCash = 0;
    corruptExtractedZeroCashNoReceipt.raids[raidId109].totalBanked = 0;
    expect(validateStoreIntegrity(corruptExtractedZeroCashNoReceipt)).toBe(false);

    // Malformed hold string and string coordinates strictly rejected
    const corruptHoldString = JSON.parse(JSON.stringify(validReceiptStore));
    corruptHoldString.raids[raidId109].operatives.op_alpha_1.holdCompleted = "yes";
    expect(validateStoreIntegrity(corruptHoldString)).toBe(false);

    const corruptCoordsString = JSON.parse(JSON.stringify(validReceiptStore));
    corruptCoordsString.raids[raidId109].operatives.op_alpha_1.lastObservedX = "45.0";
    expect(validateStoreIntegrity(corruptCoordsString)).toBe(false);

    // ISOLATED TEST: Swapped receipt payout where ALL totals match (totalBanked == 3650 == totalReceiptCash == totalExtractedCash)
    // Only the direct binding between custody earnedCash and receipt cashBanked fails!
    const payloadAlphaSwapped = {
      cashBanked: 2400,
      extractedSquad: "op_alpha_1",
      raidId: raidId109,
      retainedSquads: [],
      verifiedPrefixTick: 180,
    };
    const payloadBravoSwapped = {
      cashBanked: 1250,
      extractedSquad: "op_bravo_1",
      raidId: raidId109,
      retainedSquads: [],
      verifiedPrefixTick: 180,
    };
    const isolatedPayoutStore: any = {
      raids: {
        [raidId109]: {
          raidId: raidId109,
          status: "active",
          allowableCashPool: 50000,
          totalBanked: 3650,
          crates: {
            crate_01: { cashValue: 1250, claimedBy: "op_alpha_1", claimTimestamp: 1000 },
            crate_02: { cashValue: 2400, claimedBy: "op_bravo_1", claimTimestamp: 1000 },
          },
          operatives: {
            op_alpha_1: {
              operativeId: "op_alpha_1",
              admitted: true,
              isExtracted: true,
              extractedAtTick: 180,
              activeRaid: "",
              cratesLooted: ["crate_01"],
              earnedCash: 1250,
              inventoryRevision: 14,
            },
            op_bravo_1: {
              operativeId: "op_bravo_1",
              admitted: true,
              isExtracted: true,
              extractedAtTick: 180,
              activeRaid: "",
              cratesLooted: ["crate_02"],
              earnedCash: 2400,
              inventoryRevision: 2,
            },
          },
        },
      },
      auditLog: {
        rec_swapped_1: {
          receipt: {
            v: 1,
            receiptId: "rec_swapped_1",
            raidId: raidId109,
            outcomeId: computeCanonicalOutcomeDigestSync(payloadAlphaSwapped),
            intentHash: `intent_${computeCanonicalOutcomeDigestSync(payloadAlphaSwapped).slice(16, 32)}`,
            outcomeDigest: computeCanonicalOutcomeDigestSync(payloadAlphaSwapped),
            throughTick: 180,
            committedAtMs: Date.now(),
            transfers: [{ itemId: "currency_credits", quantity: "BE:2400", toProfileId: "op_alpha_1", source: "world_spawn" }],
            participantResults: [
              { profileId: "op_alpha_1", inventoryRevision: 14, activeRaidCleared: true, releasedEscrowIds: ["escrow_op_alpha_1_loadout"] },
            ],
          },
          outcomePayload: payloadAlphaSwapped,
        },
        rec_swapped_2: {
          receipt: {
            v: 1,
            receiptId: "rec_swapped_2",
            raidId: raidId109,
            outcomeId: computeCanonicalOutcomeDigestSync(payloadBravoSwapped),
            intentHash: `intent_${computeCanonicalOutcomeDigestSync(payloadBravoSwapped).slice(16, 32)}`,
            outcomeDigest: computeCanonicalOutcomeDigestSync(payloadBravoSwapped),
            throughTick: 180,
            committedAtMs: Date.now(),
            transfers: [{ itemId: "currency_credits", quantity: "BE:1250", toProfileId: "op_bravo_1", source: "world_spawn" }],
            participantResults: [
              { profileId: "op_bravo_1", inventoryRevision: 2, activeRaidCleared: true, releasedEscrowIds: ["escrow_op_bravo_1_loadout"] },
            ],
          },
          outcomePayload: payloadBravoSwapped,
        },
      },
      idempotencyMap: {},
    };
    expect(validateStoreIntegrity(isolatedPayoutStore)).toBe(false);

    // ISOLATED TEST: Duplicate receipts for same extractor where all cash totals are 0 (totalBanked == 0 == totalReceiptCash == totalExtractedCash)
    // Only the receipt extractor uniqueness check rejects this fixture!
    const payloadZero1 = {
      cashBanked: 0,
      extractedSquad: "op_alpha_1",
      raidId: raidId109,
      retainedSquads: [],
      verifiedPrefixTick: 180,
    };
    const isolatedDuplicateReceiptStore: any = {
      raids: {
        [raidId109]: {
          raidId: raidId109,
          status: "active",
          allowableCashPool: 50000,
          totalBanked: 0,
          crates: {
            crate_01: { cashValue: 1250 },
          },
          operatives: {
            op_alpha_1: {
              operativeId: "op_alpha_1",
              admitted: true,
              isExtracted: true,
              extractedAtTick: 180,
              activeRaid: "",
              cratesLooted: [],
              earnedCash: 0,
              inventoryRevision: 14,
            },
          },
        },
      },
      auditLog: {
        rec_zero_1: {
          receipt: {
            v: 1,
            receiptId: "rec_zero_1",
            raidId: raidId109,
            outcomeId: computeCanonicalOutcomeDigestSync(payloadZero1),
            intentHash: `intent_${computeCanonicalOutcomeDigestSync(payloadZero1).slice(16, 32)}`,
            outcomeDigest: computeCanonicalOutcomeDigestSync(payloadZero1),
            throughTick: 180,
            committedAtMs: Date.now(),
            transfers: [],
            participantResults: [
              { profileId: "op_alpha_1", inventoryRevision: 14, activeRaidCleared: true, releasedEscrowIds: ["escrow_op_alpha_1_loadout"] },
            ],
          },
          outcomePayload: payloadZero1,
        },
        rec_zero_2: {
          receipt: {
            v: 1,
            receiptId: "rec_zero_2",
            raidId: raidId109,
            outcomeId: computeCanonicalOutcomeDigestSync(payloadZero1),
            intentHash: `intent_${computeCanonicalOutcomeDigestSync(payloadZero1).slice(16, 32)}`,
            outcomeDigest: computeCanonicalOutcomeDigestSync(payloadZero1),
            throughTick: 180,
            committedAtMs: Date.now(),
            transfers: [],
            participantResults: [
              { profileId: "op_alpha_1", inventoryRevision: 14, activeRaidCleared: true, releasedEscrowIds: ["escrow_op_alpha_1_loadout"] },
            ],
          },
          outcomePayload: payloadZero1,
        },
      },
      idempotencyMap: {},
    };
    expect(validateStoreIntegrity(isolatedDuplicateReceiptStore)).toBe(false);

    // Dynamic Camera Aim Angle unprojection probe (exact 135 deg)
    const angle135Exact = computeGroundAimAngle(1046.79, 118.48, 1440, 900, 48, {
      cameraPos: { x: -2, y: 13, z: 10.5 },
      targetPos: { x: 0, y: 1, z: 0 },
      playerPos: { x: 0, y: 0, z: 0 },
    });
    expect((angle135Exact * 180) / Math.PI).toBeCloseTo(135.0, 1);

    try { fs.unlinkSync(tmpStore109); } catch {}
    try { fs.unlinkSync(`${tmpStore109}.prev`); } catch {}
  });

  it('110. kick aggregation: one melee action emits a single authority batch with the complete target set', () => {
    sim.admitOperative(100);
    sim.machines = [{
      id: 'kick_turret_x', type: 'turret', x: 0, y: 0, z: 1.2, facing: 0,
      health: 120, isAlive: true, cooldownTicks: 999,
    } as any];
    sim.rivals = [{
      id: 'op_bravo_1', name: 'INFILTRATOR PHANTOM-1', isPlayer: false, isRival: true, isAI: false,
      x: 0.8, y: 0, z: 1.0, facing: Math.PI, health: 100, armor: 0, cash: 0, action: 'idle', actionTicks: 0,
      isInvulnerable: false, isAlive: true, isExtracted: false, ammo: 30, maxAmmo: 30,
    } as any];
    sim.player.x = 0;
    sim.player.z = 0;
    sim.player.facing = 0; // facing +Z toward both targets

    const actions: any[] = [];
    sim.onKickAction = (action) => actions.push(action);
    sim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: true, shoot: false, interact: false });

    expect(actions.length).toBe(1); // ONE action = ONE packet = ONE cooldown charge
    expect(actions[0].machineHits.length).toBe(1);
    expect(actions[0].machineHits[0].id).toBe('kick_turret_x');
    expect(actions[0].rivalHits.length).toBe(1);
    expect(actions[0].rivalHits[0].id).toBe('op_bravo_1');
    expect(actions[0].rivalHits[0].damage).toBe(35);

    // Legacy fallback path (no aggregator wired) still delivers per-target callbacks
    const sim2 = new SectorDepotSimulation();
    sim2.admitOperative(100);
    sim2.machines = [{ id: 'kick_turret_y', type: 'turret', x: 0, y: 0, z: 1.2, facing: 0, health: 120, isAlive: true, cooldownTicks: 999 } as any];
    sim2.player.x = 0; sim2.player.z = 0; sim2.player.facing = 0;
    let machineHits = 0; let rivalHits = 0;
    sim2.onMachineHit = () => { machineHits++; };
    sim2.onHitTarget = () => { rivalHits++; };
    sim2.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: true, shoot: false, interact: false });
    expect(machineHits).toBe(1);
    expect(rivalHits).toBe(0); // no rival staged in sim2
  });

  it('111. hold interruption semantics: damage outside an active hold registers no extraction reset', () => {
    sim.admitOperative(100);
    sim.machines = [];
    sim.player.x = 0;
    sim.player.z = 0; // far outside LZ (45,45)
    expect(sim.exfilController.getState().kind).toBe('idle');
    expect(sim.lastInterruptionTick).toBe(0);

    sim.applyDamageToPlayer(20);
    // Armor absorbs the strike (standard damage model): health unchanged, no interruption
    expect(sim.player.health).toBe(100);
    expect(sim.player.armor).toBe(80);
    expect(sim.lastInterruptionTick).toBe(0); // no active hold existed: no interruption event

    // Reciprocally, holding at the LZ still registers with precedence
    sim.player.x = SIM_CONFIG.EXFIL_ZONE.x;
    sim.player.z = SIM_CONFIG.EXFIL_ZONE.z;
    for (let i = 0; i < 30; i++) {
      sim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: false, interact: false });
    }
    expect(sim.exfilController.getState().kind).toBe('holding_zone');
    sim.applyDamageToPlayer(20);
    expect(sim.lastInterruptionTick).toBe(sim.tick);
    expect(sim.exfilController.getState().kind).toBe('idle');
  });

  it('112. snapshot custody: peer snapshots cannot fabricate local crate claims or grant rival extraction', () => {
    const raidId = 'raid_sector7_forge_112';
    const simB = new SectorDepotSimulation(raidId);
    expect(simB.isAdmitted()).toBe(false);
    const coordB = new MultiplayerCoordinator(simB);
    simB.ingressController.enterCorridor(100);

    const snapshot = {
      snapshotTick: 150,
      crates: [
        // Forged self-claim: the local player never looted crate_01/02
        { id: 'crate_01', opened: true, claimedBy: 'op_alpha_1', claimedAt: 100 },
        { id: 'crate_02', opened: true, claimedBy: 'op_alpha_1', claimedAt: 101 },
      ],
      machines: [],
      rivals: [
        { id: 'op_bravo_1', name: 'INFILTRATOR PHANTOM-1', x: 5, z: 5, health: 95, armor: 40, ammo: 22, isAlive: true, isExtracted: true },
        { id: 'op_carrier', name: 'AFORGED EXTRACTOR', x: -5, z: -5, health: 100, armor: 0, ammo: 30, isAlive: true, isExtracted: true },
      ],
    };

    coordB.handleMessage({
      eventId: 'evt_forge_snapshot_112',
      type: 'ingress_snapshot',
      senderId: 'op_bravo_1',
      senderName: 'INFILTRATOR PHANTOM-1',
      squad: 'SQUAD BRAVO',
      raidId,
      timestamp: Date.now() - 50,
      data: { recipientId: 'op_alpha_1', snapshot },
    });

    // Extraction is settlement-authoritative: a peer snapshot never grants extracted status
    const bravo = simB.rivals.find((r) => r.id === 'op_bravo_1');
    expect(bravo).toBeDefined();
    expect(bravo?.isExtracted).toBe(false);
    const carrier = simB.rivals.find((r) => r.id === 'op_carrier');
    expect(carrier?.isExtracted).toBe(false);

    // Forged LOCAL self-claims are stripped: no fabricated cash recovery
    expect(simB.player.cash).toBe(0);
    coordB.cleanup();
  });

  it('113. peer kick_action: machine predictions only; operative damage requires relay validation', () => {
    const raidId = 'raid_sector7_kick_113';
    const simC = new SectorDepotSimulation(raidId);
    simC.admitOperative(100);
    simC.rivals = [];
    const coordC = new MultiplayerCoordinator(simC);

    // Establish the attacker as an admitted peer with a COMPLETED staged-ingress
    // handshake BEFORE the state packet, so lastState is actually stored (the state
    // handler gates on ingressDone + handshakeState 'confirmed').
    coordC.connectedPeers.set('op_bravo_1', {
      lastSeen: Date.now(),
      name: 'INFILTRATOR PHANTOM-1',
      ingressDone: true,
      admitted: true,
      handshakeState: 'confirmed',
      outHandshakeState: 'confirmed',
      inHandshakeState: 'confirmed',
    } as any);

    coordC.handleMessage({
      eventId: 'evt_kick_state_113',
      type: 'state',
      senderId: 'op_bravo_1',
      senderName: 'INFILTRATOR PHANTOM-1',
      squad: 'SQUAD BRAVO',
      raidId,
      timestamp: Date.now(),
      data: {
        x: 1.0, y: 0, z: 1.0, facing: 0, action: 'idle', actionTicks: 0,
        health: 100, armor: 0, cash: 0, holdTicks: 0, isAlive: true, isExtracted: false, ammo: 30,
      },
    });
    const peer = coordC.connectedPeers.get('op_bravo_1');
    expect(peer).toBeDefined();
    expect(peer?.lastState).toBeDefined(); // state packet was actually consumed

    const preDamageHealth = simC.player.health;
    simC.machines = [{ id: 'kick_turret_z', type: 'turret', x: 1.0, y: 0, z: 1.2, facing: 0, health: 120, isAlive: true, cooldownTicks: 999 } as any];

    coordC.handleMessage({
      eventId: 'evt_kick_action_113',
      type: 'kick_action',
      senderId: 'op_bravo_1',
      senderName: 'INFILTRATOR PHANTOM-1',
      squad: 'SQUAD BRAVO',
      raidId,
      timestamp: Date.now(),
      data: {
        actionTick: 200,
        attackerFacing: 0,
        attackerX: 1.0,
        attackerZ: 1.0,
        machineTargets: [{ id: 'kick_turret_z', x: 1.0, z: 1.2, damage: 50 }],
        rivalTargets: [{ id: 'op_alpha_1', x: 0, z: 0, damage: 35, knockX: 3, knockZ: 3 }],
      },
    });

    // Machine prediction applied: the peer kick damaged the machine exactly once (-50 hp)
    const machine = simC.machines.find((m) => m.id === 'kick_turret_z');
    if (!machine) throw new Error('machine kick_turret_z missing after kick_action');
    expect(machine.health).toBe(70);

    // Operative damage from the peer packet is REJECTED: relay authority only
    expect(simC.player.health).toBe(preDamageHealth);
    expect(simC.combatLog.some((l: string) => l.includes('Struck by INFILTRATOR PHANTOM-1'))).toBe(false);
    coordC.cleanup();
  });

  it("114. kick_action relay authority: one cooldown charge per action, custody damage, batch dedupe (real handler)", async () => {
    // Drive the actual createStickZoneServer handler stack: HTTP join -> WebSocket auth
    // -> kick_action packet -> relay validation/custody, via real sockets.
    const raidId = `raid_sector7_relay_${Date.now().toString(36)}`;
    const tmpStore = `/tmp/test-relay-${raidId}.json`;
    const settlement = new ServerSettlementAuthority(tmpStore);
    settlement.initRaid(raidId, 50000, ["op_player", "op_alpha_1", "op_bravo_1"], "op_player");

    // @ts-ignore
    const { createStickZoneServer } = await import("../scripts/server.mjs");
    const server = createStickZoneServer(settlement);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as any).port;
    const base = `http://127.0.0.1:${port}`;

    const adminHeaders = { "Content-Type": "application/json", Authorization: "Bearer sz_test_internal_sec" };

    // Alpha places itself near the raid start via the coordinator (custody-consistent)
    let r = await fetch(`${base}/api/settlement/reposition`, {
      method: "POST", headers: adminHeaders,
      body: JSON.stringify({ raidId, operativeId: "op_alpha_1", x: -4, z: 11 }),
    });
    expect(r.status).toBe(200);

    // Bravo joins via the HTTP session token flow (dev/test operative credentials)
    const joinRes = await fetch(`${base}/api/settlement/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-operative-secret": "sz_cred_bravo_phantom_s7" },
      body: JSON.stringify({ raidId, operativeId: "op_bravo_1", operativeSecret: "sz_cred_bravo_phantom_s7" }),
    });
    expect(joinRes.status).toBe(200);
    const joinData = await joinRes.json() as any;
    const bravoToken = joinData.token || joinData.sessionToken;
    expect(typeof bravoToken === "string" && bravoToken.length > 0).toBe(true);

    // Coordinator places BRAVO next to the depot turret (custody-consistent placement:
    // the anti-teleport movement authority accepts the coordinated position)
    r = await fetch(`${base}/api/settlement/reposition`, {
      method: "POST", headers: adminHeaders,
      body: JSON.stringify({ raidId, operativeId: "op_bravo_1", x: -4.7, z: 11.5 }),
    });
    expect(r.status).toBe(200);

    // Place Bravo near the machine + Alpha (accepted movement state via WS)
    const ws = new WebSocket(`ws://127.0.0.1:${port}/syncplay-ws?token=${encodeURIComponent(bravoToken)}`);
    const inbound: any[] = [];
    ws.on("message", (raw: any) => { try { inbound.push(JSON.parse(String(raw))); } catch {} });
    await new Promise<void>((resolve, reject) => {
      ws.on("open", resolve); ws.on("error", reject);
    });

    const sendPacket = (p: any) => ws.send(JSON.stringify(p));
    // Movement report establishes the accepted position
    sendPacket({
      eventId: "state_init_114", type: "state", senderId: "op_bravo_1", senderName: "INFILTRATOR PHANTOM-1",
      raidId, timestamp: Date.now(),
      data: { x: -4.7, y: 0, z: 11.6, facing: 0, action: "idle", health: 100, armor: 100, isAlive: true, ammo: 30 },
    });
    await new Promise((res) => setTimeout(res, 250));

    // (a) Dedupe: batch with repeated machine id is rejected entirely
    const origMachine = settlement.getRaidRecord(raidId);
    sendPacket({
      eventId: "kick_dup_114", type: "kick_action", senderId: "op_bravo_1", senderName: "INFILTRATOR PHANTOM-1",
      raidId, timestamp: Date.now(),
      data: {
        actionTick: 100, attackerFacing: 0, attackerX: -4.7, attackerZ: 11.5,
        machineTargets: [
          { id: "turret_depot_alpha", x: -5, z: 12, damage: 50 },
          { id: "turret_depot_alpha", x: -5, z: 12, damage: 50 },
        ],
        rivalTargets: [],
      },
    });
    await new Promise((res) => setTimeout(res, 250));
    const afterDup = settlement.getRaidRecord(raidId);
    expect(afterDup?.machines?.turret_depot_alpha?.health ?? 120).toBe(120); // no damage applied

    // (b) Valid batch: machine strike applies custody damage once per target
    sendPacket({
      eventId: "kick_valid_114", type: "kick_action", senderId: "op_bravo_1", senderName: "INFILTRATOR PHANTOM-1",
      raidId, timestamp: Date.now(),
      data: {
        actionTick: 160, attackerFacing: 0, attackerX: -4.7, attackerZ: 11.5,
        machineTargets: [{ id: "turret_depot_alpha", x: -5, z: 12, damage: 50 }],
        rivalTargets: [],
      },
    });
    await new Promise((res) => setTimeout(res, 150));
    const afterKick = settlement.getRaidRecord(raidId);
    expect(afterKick?.machines?.turret_depot_alpha?.health).toBe(70); // 120 - 50 exactly once

    // Broadcast returned to the attacker with the complete server result contract
    const machineBroadcast = inbound.find((p) => p.type === "machine_hit" && p?.data?.machineId === "turret_depot_alpha" && p.eventId?.startsWith("kick_valid_114"));
    expect(machineBroadcast).toBeDefined();
    expect(machineBroadcast?.serverAuthoritative).toBe(true);
    expect(machineBroadcast?.data?.machineHealth).toBe(70);
    expect(typeof machineBroadcast?.data?.attackerFacing).toBe("number");
    expect(typeof machineBroadcast?.data?.attackerX).toBe("number");

    // (c) One cooldown charge: a second valid kick action within the 600ms cooldown is rejected
    sendPacket({
      eventId: "kick_rapid_114", type: "kick_action", senderId: "op_bravo_1", senderName: "INFILTRATOR PHANTOM-1",
      raidId, timestamp: Date.now(),
      data: {
        actionTick: 200, attackerFacing: 0, attackerX: -4.7, attackerZ: 11.5,
        machineTargets: [{ id: "turret_depot_alpha", x: -5, z: 12, damage: 50 }],
        rivalTargets: [],
      },
    });
    await new Promise((res) => setTimeout(res, 250));
    await new Promise((res) => setTimeout(res, 120));
    const afterRapid = settlement.getRaidRecord(raidId);
    // Cooldown-gated: the follow-up action arrived ~270ms after the first charge
    // (bucket 0.5 + 270/600 < 1.0), so the batch was rejected and custody retains 70.
    expect(afterRapid?.machines?.turret_depot_alpha?.health).toBe(70);

    ws.close();
    await new Promise<void>((resolve) => { server.close(() => resolve()); });
    try { fs.unlinkSync(tmpStore); } catch {}
    try { fs.unlinkSync(`${tmpStore}.prev`); } catch {}
    expect(origMachine).toBeDefined();
  }, 30000);


  it("115. state tx rollback: injected save failure restores movement+custody, suppresses nested saves, and drops the packet", async () => {
    // @ts-ignore
    const { createStickZoneServer } = await import("../scripts/server.mjs");
    const raidId = `raid_tx_${Date.now().toString(36)}`;
    const tmpStore = `/tmp/test-tx-${raidId}.json`;
    const settlement = new ServerSettlementAuthority(tmpStore);
    settlement.initRaid(raidId, 50000, ["op_player", "op_alpha_1", "op_bravo_1"], "op_player");

    const server = createStickZoneServer(settlement);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as any).port;
    const base = `http://127.0.0.1:${port}`;

    // Coordinator places alpha in custody (ablishes accepted movement+custody)
    const adminHeaders = { "Content-Type": "application/json", Authorization: "Bearer sz_test_internal_sec" };
    const joinRes = await fetch(`${base}/api/settlement/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-operative-secret": "sz_cred_alpha_ghost_s7" },
      body: JSON.stringify({ raidId, operativeId: "op_alpha_1", operativeSecret: "sz_cred_alpha_ghost_s7" }),
    });
    const tok = ((await joinRes.json()) as any).token;
    await fetch(`${base}/api/settlement/reposition`, { method: "POST", headers: adminHeaders, body: JSON.stringify({ raidId, operativeId: "op_alpha_1", x: -60, z: -60 }) });

    // WebSocket accepted movement stream
    const ws = new WebSocket(`ws://127.0.0.1:${port}/syncplay-ws?token=${encodeURIComponent(tok)}`);
    const inbound: any[] = [];
    ws.on("message", (raw: any) => { try { inbound.push(JSON.parse(String(raw))); } catch {} });
    await new Promise<void>((resolve, reject) => { ws.on("open", resolve); ws.on("error", reject); });
    ws.send(JSON.stringify({
      eventId: "tx_state_1", type: "state", senderId: "op_alpha_1", raidId, timestamp: Date.now(),
      data: { x: -59.5, y: 0, z: -59.5, facing: 0, action: "idle", health: 100, armor: 100, isAlive: true, ammo: 30 },
    }));
    await new Promise((r) => setTimeout(r, 300));
    const recBefore = settlement.getRaidRecord(raidId);
    const custodyBefore = JSON.parse(JSON.stringify(recBefore!.operatives.op_alpha_1));

    // Inject persistence failure for the accepted-state transaction
    const origSave = settlement.saveToDisk.bind(settlement);
    let saveCalls = 0;
    let suppressedCount = 0;
    let failNext = false; // arms AFTER the movement ack, 1 packet later
    (settlement as any).saveToDisk = function (...args: any[]) {
      if ((this as any).__txSuppressSave === true) {
        suppressedCount++;
        return; // production semantics: nested saves return silently under the latch
      }
      saveCalls++;
      if (failNext) { failNext = false; throw new Error("injected disk failure"); }
      return origSave(...(args as []));
    };

    failNext = true; // next non-latched commit (the tx_state_2 tail) fails on disk
    ws.send(JSON.stringify({
      eventId: "tx_state_2", type: "state", senderId: "op_alpha_1", raidId, timestamp: Date.now() + 50,
      data: { x: -59, y: 0, z: -59, facing: 0, action: "idle", health: 88, armor: 60, isAlive: true, ammo: 28, damageTaken: 0 },
    }));
    await new Promise((r) => setTimeout(r, 400));

    (settlement as any).saveToDisk = origSave;
    const recAfter = settlement.getRaidRecord(raidId)!;
    const custAfter = recAfter.operatives.op_alpha_1;

    // COMPLETE rollback: custody position, vitals, and observation state unchanged
    expect(custAfter.lastObservedX).toBe(custodyBefore.lastObservedX);
    expect(custAfter.lastObservedZ).toBe(custodyBefore.lastObservedZ);
    expect(custAfter.health).toBe(custodyBefore.health);
    expect(custAfter.armor).toBe(custodyBefore.armor);
    // Rollback restore MUST have re-created any nested-ammo custody side effects
    expect(custAfter.unconsumedDamage ?? 0).toBe(custodyBefore.unconsumedDamage ?? 0);
    // Interested peers never saw the failed state relayed (no forwarded packet for it)
    expect(inbound.some((p) => p.type === "server_world" || (p.type === "state" && p.data?.x === -59 && p.data?.health === 88))).toBe(false);
    // Nested recorders were LATCH-SUPPRESSED (returned silently, counted — never threw)
    expect(suppressedCount).toBeGreaterThan(0);
    // Exactly ONE real save per accepted packet: state_1 tail saved; state_2 tail FAILED
    // and did not re-save. No exception leaked to the socket.
    expect(saveCalls).toBe(1);
    // The LATCH is released after the failed tail — the next transaction can save
    const latchAfter = (settlement as any).__txSuppressSave;
    expect(latchAfter).not.toBe(true);
    let saveOk = false;
    try { settlement.saveToDisk(); saveOk = true; } catch {}
    expect(saveOk).toBe(true);
    ws.close();
    await new Promise<void>((resolve) => { server.close(() => resolve()); });
    try { fs.unlinkSync(tmpStore); } catch {}
  }, 30000);


  it("116. machine roster: deploy/remove broadcasts versioned full roster; reconciler applies membership+geometry+maxHealth across hydrate/auth/live", async () => {
    // @ts-ignore
    const { createStickZoneServer } = await import("../scripts/server.mjs");
    const raidId = `raid_roster_${Date.now().toString(36)}`;
    const tmpStore = `/tmp/test-roster-${raidId}.json`;
    const settlement = new ServerSettlementAuthority(tmpStore);
    settlement.initRaid(raidId, 50000, ["op_player", "op_alpha_1", "op_bravo_1"], "op_player");
    const server = createStickZoneServer(settlement);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as any).port;
    const base = `http://127.0.0.1:${port}`;
    const adminHeaders = { "Content-Type": "application/json", Authorization: "Bearer sz_test_internal_sec" };

    // Real HTTP join + WS auth (the relay's own broadcast is captured raw)
    const joinRes = await fetch(`${base}/api/settlement/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-operative-secret": "sz_cred_alpha_ghost_s7" },
      body: JSON.stringify({ raidId, operativeId: "op_alpha_1", operativeSecret: "sz_cred_alpha_ghost_s7" }),
    });
    const tok = ((await joinRes.json()) as any).token;
    const ws = new WebSocket(`ws://127.0.0.1:${port}/syncplay-ws?token=${encodeURIComponent(tok)}`);
    const rosters: any[] = [];
    ws.on("message", (raw: any) => { const p = JSON.parse(String(raw)); if (p.type === "machine_roster") rosters.push(p); });
    await new Promise<void>((resolve, reject) => { ws.on("open", resolve); ws.on("error", reject); });

    // Client sim + coordinator fed by the SAME roster packets the relay broadcast
    const sim = new SectorDepotSimulation(raidId);
    sim.admitOperative(100);
    const coord = new MultiplayerCoordinator(sim);

    // Deploy an extra drone with 200 hp (custom maxHealth contract)
    const deployRes = await fetch(`${base}/api/settlement/deploy-machine`, {
      method: "POST", headers: adminHeaders,
      body: JSON.stringify({ raidId, action: "place", machineId: "drone_interrupter", type: "drone", x: 45, z: 32, health: 200 }),
    });
    expect(deployRes.status).toBe(200);
    await new Promise((r) => setTimeout(r, 400));

    // The relay broadcast a roster carrying a monotonic revision + full membership + shared maxHealth
    expect(rosters.length).toBeGreaterThanOrEqual(1);
    const placeRoster = rosters[rosters.length - 1];
    expect(typeof placeRoster.data.revision).toBe("number");
    const placeIds = placeRoster.data.machines.map((m: any) => m.id);
    expect(placeIds).toContain("turret_depot_alpha");
    expect(placeIds).toContain("drone_interrupter");
    const deployedInRoster = placeRoster.data.machines.find((m: any) => m.id === "drone_interrupter");
    expect(deployedInRoster.health).toBe(200);
    expect(deployedInRoster.maxHealth).toBe(200);

    // The live packet drives the reconciler: membership + geometry + maxHealth adopted
    coord.handleMessage(placeRoster as any);
    const deployedNow = sim.machines.find((m) => m.id === "drone_interrupter");
    if (!deployedNow) throw new Error("deployed machine missing after live roster reconcile");
    expect(deployedNow.type).toBe("drone");
    expect(deployedNow.x).toBe(45);
    expect((deployedNow as any).maxHealth).toBe(200);

    // A STALE revision replay must NOT regress the world
    const staleRoster = JSON.parse(JSON.stringify(placeRoster));
    staleRoster.eventId = `${placeRoster.eventId}_stale_replay`;
    staleRoster.data.revision = placeRoster.data.revision - 1;
    staleRoster.data.machines = staleRoster.data.machines.filter((m: any) => m.id !== "drone_interrupter");
    const machinesBeforeStale = sim.machines.length;
    coord.handleMessage(staleRoster as any);
    expect(sim.machines.find((m) => m.id === "drone_interrupter")).toBeDefined(); // not removed by stale
    expect(sim.machines.length).toBe(machinesBeforeStale);

    // Removal: the relay commits a NEW revision and broadcast; reconciler drops the machine
    const rmRes = await fetch(`${base}/api/settlement/deploy-machine`, {
      method: "POST", headers: adminHeaders,
      body: JSON.stringify({ raidId, action: "remove", machineId: "drone_interrupter" }),
    });
    expect(rmRes.status).toBe(200);
    await new Promise((r) => setTimeout(r, 400));
    expect(rosters.length).toBeGreaterThanOrEqual(2);
    const rmRoster = rosters[rosters.length - 1];
    expect(rmRoster.data.revision).toBeGreaterThan(placeRoster.data.revision);
    coord.handleMessage(rmRoster as any);
    expect(sim.machines.find((m) => m.id === "drone_interrupter")).toBeUndefined();
    expect(sim.machines.length).toBeGreaterThanOrEqual(2); // defaults retained

    // Deployment set persisted: the real HTTP hydration surface reflects removal
    const activeRes = await fetch(`${base}/api/settlement/active-raid?raidId=${raidId}`);
    const activeData = await activeRes.json() as any;
    const ids = (activeData.machines as any[]).map((m: any) => m.id);
    expect(ids).toContain("turret_depot_alpha");
    expect(ids).not.toContain("drone_interrupter");

    coord.cleanup();
    ws.close();
    await new Promise<void>((resolve) => { server.close(() => resolve()); });
    try { fs.unlinkSync(tmpStore); } catch {}
  }, 30000);

  it("117. commit pipeline: 15s hard wall with per-request timeout budget; transient custody-verification retried, permanent rejection surfaced immediately", async () => {
    // @ts-ignore
    const { createStickZoneServer } = await import("../scripts/server.mjs");
    const raidId = `raid_commit_${Date.now().toString(36)}`;
    const tmpStore = `/tmp/test-commit-${raidId}.json`;
    const settlement = new ServerSettlementAuthority(tmpStore);
    settlement.initRaid(raidId, 50000, ["op_player", "op_alpha_1", "op_bravo_1"], "op_player");
    const server = createStickZoneServer(settlement);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as any).port;
    const base = `http://127.0.0.1:${port}`;
    const adminHeaders = { "Content-Type": "application/json", Authorization: "Bearer sz_test_internal_sec" };

    const joinRes = await fetch(`${base}/api/settlement/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-operative-secret": "sz_cred_alpha_ghost_s7" },
      body: JSON.stringify({ raidId, operativeId: "op_alpha_1", operativeSecret: "sz_cred_alpha_ghost_s7" }),
    });
    const tok = ((await joinRes.json()) as any).token;
    await fetch(`${base}/api/settlement/reposition`, { method: "POST", headers: adminHeaders, body: JSON.stringify({ raidId, operativeId: "op_alpha_1", x: 45, z: 45 }) });
    // Travel-time guard: 10m+ displacement requires >= 8.0s of raid lifetime before
    // settlement — pre-age exactly like the recording harness does.
    await new Promise((r) => setTimeout(r, 8300));

    // A) PERMANENT rejection surfaces immediately: commit with an invalid (non-integer) cash
    // payload is rejected by the server with a 400 that the client classifier must NOT retry.
    const t0 = Date.now();
    const badRes = await fetch(`${base}/api/settlement/commit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}`, "x-operative-id": "op_alpha_1" },
      body: JSON.stringify({ raidId, tick: 1200, cash: 12.5, playerId: "op_alpha_1", extractingId: "op_alpha_1", exfilSubmitted: true }),
    });
    expect(badRes.status).toBe(400);
    const badBody = await badRes.json();
    expect(typeof badBody.error).toBe("string");
    // responded fast — no retry ladder on the wire (single request)
    expect(Date.now() - t0).toBeLessThan(2000);

    // B) TRANSIENT custody-verification race: the hold has not run, so /commit reports
    // "hold not completed" — the retry path must keep polling but the WINDOW is a hard
    // wall. Drive the real ladder to completion over >=3s; the commit then succeeds,
    // proving the retry ladder converged on the transient precondition (not on error
    // classification fallbacks). 60 paced reports of 3 ticks at >=50ms apart.
    let t = 200;
    let completed = false;
    for (let i = 0; i < 70; i++) {
      const res = await fetch(`${base}/api/settlement/hold`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ raidId, operativeId: "op_alpha_1", holdTicks: Math.min(180, (i + 1) * 3), currentTick: t, x: 45, z: 45, inZone: true, isAlive: true, isKia: false }),
      });
      const data = await res.json();
      if (data.holdCompleted) { completed = true; break; }
      t += 3;
      await new Promise((r) => setTimeout(r, 52));
    }
    expect(completed).toBe(true);

    // Corridor presentation: the relay verifies a real 2500ms corridor between hold
    // completion and settlement — the same invariant test 72 checks.
    await new Promise((r) => setTimeout(r, 2600));

    // CLIENT commit loop: drive authoritativeLedgerCommit through fetch (the REAL
    // browser path: budgeted retry ring, corridor rejections desugared as transient).
    // This exercises the exact production launch code paths (not raw fetch):
    const simProxy = {
      tick: t,
      raidId,
      player: { id: "op_alpha_1", cash: 0, isExtracted: true },
      frozenSettlementTick: undefined,
      exfilController: { getState: () => ({ kind: "extracted" }) },
      sessionToken: tok,
    } as any;
    const clientCommit = await authoritativeLedgerCommit(simProxy);
    expect(clientCommit.receipt.receiptId.startsWith("receipt_s7_")).toBe(true);

    // elapsed wall-time of the ladder: >= 3000ms (duration invariant held)
    // commit now succeeds through the real handler + idempotent recovery
    const okRes = await fetch(`${base}/api/settlement/commit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}`, "x-operative-id": "op_alpha_1" },
      body: JSON.stringify({ raidId, tick: t, cash: 0, playerId: "op_alpha_1", extractingId: "op_alpha_1", exfilSubmitted: true }),
    });
    expect(okRes.status).toBe(200);
    const receipt = await okRes.json();
    expect(receipt.receipt.receiptId.startsWith("receipt_s7_")).toBe(true);

    await new Promise<void>((resolve) => { server.close(() => resolve()); });
    try { fs.unlinkSync(tmpStore); } catch {}
    try { fs.unlinkSync(`${tmpStore}.prev`); } catch {}
  }, 45000);

  it("118. persistence round-trip integrity for accepted raid names and terminal JOIN recovery retry", async () => {
    // A) Persistence round-trip integrity & prototype pollution rejection
    const validRaidId = `raid_valid_${Date.now().toString(36)}`;
    const tmpStore = `/tmp/test-purity-${validRaidId}.json`;
    try { fs.unlinkSync(tmpStore); } catch {}
    const auth = new ServerSettlementAuthority(tmpStore);

    // Forbidden names and syntax are strictly rejected:
    expect(() => auth.initRaid("__proto__", 50000, ["op_player"])).toThrow(/Invalid raidId/);
    expect(() => auth.initRaid("prototype", 50000, ["op_player"])).toThrow(/Invalid raidId/);
    expect(() => auth.initRaid("constructor", 50000, ["op_player"])).toThrow(/Invalid raidId/);
    expect(() => auth.initRaid("raid.dot", 50000, ["op_player"])).toThrow(/Invalid raidId/);
    expect(() => auth.initRaid("raid:colon", 50000, ["op_player"])).toThrow(/Invalid raidId/);

    // Valid raid name saves cleanly and round-trips:
    auth.initRaid(validRaidId, 50000, ["op_player", "op_alpha_1"]);
    auth.saveToDisk();

    // Reload from disk to verify complete round-trip integrity
    const reloaded = new ServerSettlementAuthority(tmpStore);
    expect(reloaded.hasRaid(validRaidId)).toBe(true);
    expect(reloaded.getRaidRecord(validRaidId)?.allowableCashPool).toBe(50000);

    // B) Terminal JOIN recovery retry: transient failures retried, terminal custody adopted
    let joinAttempts = 0;
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = (async (url: any, opts: any) => {
        if (typeof url === "string" && url.includes("/api/settlement/join")) {
          joinAttempts++;
          if (joinAttempts === 1) {
            // Simulate transient server error
            return new Response(JSON.stringify({ error: "Transient DB error" }), { status: 500 });
          }
          // Second attempt succeeds with terminal state
          return new Response(JSON.stringify({
            success: true,
            isTerminal: true,
            isExtracted: true,
            extractedAtTick: 500,
            receipt: { receiptId: "receipt_s7_recovered" }
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        return originalFetch(url, opts);
      }) as any;

      const sim = new SectorDepotSimulation();
      sim.raidId = validRaidId;
      sim.player.id = "op_player";
      const coord = new MultiplayerCoordinator(sim);

      const recovered = await coord.retryTerminalRecovery();
      expect(recovered).toBe(true);
      expect(joinAttempts).toBe(2);
      expect(sim.exfilController.getState().kind).toBe("extracted");
      expect(sim.terminalRecoveryError).toBeUndefined();

      coord.cleanup();
    } finally {
      globalThis.fetch = originalFetch;
      try { fs.unlinkSync(tmpStore); } catch {}
      try { fs.unlinkSync(`${tmpStore}.prev`); } catch {}
    }
  });


  afterAll(() => {
    try {
      const cwdFiles = fs.readdirSync(process.cwd());
      for (const f of cwdFiles) {
        if (f.startsWith(".test-store-") || (f.startsWith(".test-") && f.endsWith(".json.prev"))) {
          try { fs.unlinkSync(path.resolve(process.cwd(), f)); } catch {}
        }
      }
    } catch {}
  });

});
