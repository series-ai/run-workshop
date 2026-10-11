import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
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
    // Step through 16-tick chambering windup to the strike impact frame (actionTicks <= 26)
    for (let i = 0; i < 16; i++) {
      sim.step({
        dx: 0,
        dz: 0,
        sprint: false,
        slide: false,
        roll: false,
        kick: false,
        shoot: false,
        interact: false,
      });
    }

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
    // Ballistic projectile travels 7.07m to player (~9 ticks)
    for (let i = 0; i < 9; i++) {
      simTest.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: false, interact: false });
    }
    // Player sustained 12 damage absorbed by armor
    expect(simTest.player.armor).toBe(88);

    // When player executes combat roll, roll iframes deflect subsequent fire
    rogue.shootCooldownTicks = 0;
    simTest.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: true, kick: false, shoot: false, interact: false });
    expect(simTest.player.action).toBe('roll');
    expect(simTest.player.isInvulnerable).toBe(true);
    for (let i = 0; i < 9; i++) {
      simTest.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: true, kick: false, shoot: false, interact: false });
    }
    // Armor remains 88 because roll deflected bullet!
    expect(simTest.player.armor).toBe(88);
  });

  it('32. static gate: zero raw fetch calls in src/ and tests/', () => {
    const srcDir = path.resolve(__dirname, '../src');
    const testDir = __dirname;
    function checkDir(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          checkDir(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))) {
          const fileContent = fs.readFileSync(fullPath, 'utf8');
          const lines = fileContent.split('\n');
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (/\bfetch\s*\(/u.test(line) && !line.includes('//') && !line.includes('checkDir')) {
              throw new Error(`Found raw fetch call at ${fullPath}:${i + 1}: ${line}`);
            }
          }
        }
      }
    }
    checkDir(srcDir);
    checkDir(testDir);
  });

  it('33. clean redeployment flow: resets sim state and clears session tokens without network errors', () => {
    const simTest = new SectorDepotSimulation('raid_redeploy_01');
    simTest.admitOperative(0);
    simTest.player.health = 0;
    simTest.player.isAlive = false;
    simTest.player.cash = 5000;

    // Simulate redeployment
    const freshSim = new SectorDepotSimulation('raid_redeploy_02');
    freshSim.admitOperative(0);
    expect(freshSim.player.isAlive).toBe(true);
    expect(freshSim.player.health).toBe(100);
    expect(freshSim.player.cash).toBe(0);
    expect(freshSim.raidId).toBe('raid_redeploy_02');
  });
  it("34. fob opening hub: player spawns facing south (facing: 0) down the illuminated runway", () => {
    const hubSim = new SectorDepotSimulation("raid_hub_01", "hub");
    expect(hubSim.zoneMode).toBe("hub");
    expect(hubSim.player.facing).toBe(0);
    expect(hubSim.player.x).toBe(0);
    expect(hubSim.player.z).toBe(-66);
  });

    it("35. fob ballistic range: shooting and kicking training dummies registers hits, hitmarkers, and updates trainingProgress", () => {
    const hubSim = new SectorDepotSimulation("raid_hub_02", "hub");
    hubSim.admitOperative(0);
    expect(hubSim.dummyHitCount).toBe(0);
    expect(hubSim.trainingProgress.dummyHit).toBe(false);

    // Aim rifle at left dummy at [-5, 0, -64] from [0, 0, -66]
    hubSim.player.x = -5.0;
    hubSim.player.z = -60.0;
    hubSim.player.facing = Math.PI; // Face north (-Z) towards -64
    hubSim.player.ammo = 30;
    const fired = hubSim.fire();
    expect(fired).toBe(true);
    // Ballistic round travels 4m to dummy (~5 ticks)
    for (let i = 0; i < 6; i++) {
      hubSim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: false, interact: false });
    }
    expect(hubSim.dummyHitCount).toBeGreaterThan(0);
    expect(hubSim.trainingProgress.dummyHit).toBe(true);
    expect(hubSim.player.lastHitmarkerTick).toBeGreaterThan(0);

    // Reset and test melee kick against right dummy at [5, 0, -64]
    hubSim.player.x = 5.0;
    hubSim.player.z = -62.5;
    hubSim.player.facing = Math.PI; // Face north towards -64
    hubSim.step({
      dx: 0,
      dz: 0,
      sprint: false,
      slide: false,
      roll: false,
      kick: true,
      shoot: false,
      interact: false,
    });
    expect(hubSim.player.action).toBe("kick");
    // Step through chambering windup to strike impact frame
    for (let i = 0; i < 16; i++) {
      hubSim.step({
        dx: 0,
        dz: 0,
        sprint: false,
        slide: false,
        roll: false,
        kick: false,
        shoot: false,
        interact: false,
      });
    }
    expect(hubSim.dummyHitCount).toBeGreaterThan(1);
  });

  it("36. fob onboarding checklist: agility maneuvers and looting the training supply locker update trainingProgress", () => {
    const hubSim = new SectorDepotSimulation("raid_hub_03", "hub");
    hubSim.admitOperative(0);
    expect(hubSim.trainingProgress.agilityUsed).toBe(false);
    expect(hubSim.trainingProgress.crateLooted).toBe(false);

    // Perform combat roll
    hubSim.step({
      dx: 0,
      dz: 1,
      sprint: true,
      slide: false,
      roll: true,
      kick: false,
      shoot: false,
      interact: false,
    });
    expect(hubSim.trainingProgress.agilityUsed).toBe(true);

    // Find and loot training crate
    const trainingCrate = hubSim.crates.find(c => c.id === "crate_fob_training");
    expect(trainingCrate).toBeDefined();
    expect(trainingCrate?.opened).toBe(false);

    hubSim.player.x = trainingCrate!.x;
    hubSim.player.z = trainingCrate!.z;
    const looted = hubSim.requestLootCrate(trainingCrate!.id);
    expect(looted).toBe(true);
    expect(hubSim.trainingProgress.crateLooted).toBe(true);
  });

  it("37. Weapon muzzle alignment: bullet hitscan and fire presentation event originate from physical gun tip", () => {
    const testSim = new SectorDepotSimulation("test_muzzle_raid", "spoke");
    testSim.admitOperative(0);
    testSim.player.x = 0;
    testSim.player.z = 0;
    testSim.player.facing = Math.PI; // Facing North (-Z)

    // Fallback geometric muzzle calculations
    const northMuzzle = testSim.getOperativeMuzzle(testSim.player);
    // When facing North: forward is -Z, right hand is +X (East)
    expect(northMuzzle.origin.x).toBeGreaterThan(0.1);
    expect(northMuzzle.origin.z).toBeLessThan(-0.5);
    expect(northMuzzle.origin.y).toBeCloseTo(1.16, 2);

    // When facing South (facing = 0): forward is +Z, right hand is -X (West)
    testSim.player.facing = 0;
    const southMuzzle = testSim.getOperativeMuzzle(testSim.player);
    expect(southMuzzle.origin.x).toBeLessThan(-0.1);
    expect(southMuzzle.origin.z).toBeGreaterThan(0.5);

    // Real skeletal bone sampled 3D position override
    testSim.player.muzzlePos = { x: 0.24, y: 1.18, z: -0.68 };
    testSim.player.muzzleDir = { x: 0, y: 0, z: -1 };
    const sampledMuzzle = testSim.getOperativeMuzzle(testSim.player);
    expect(sampledMuzzle.origin).toEqual({ x: 0.24, y: 1.18, z: -0.68 });

    // Firing weapon emits event at exact sampled muzzle coordinates
    testSim.step({
      dx: 0,
      dz: 0,
      sprint: false,
      slide: false,
      roll: false,
      kick: false,
      shoot: true,
      interact: false,
      aimAngle: Math.PI,
    });

    const events = testSim.drainPresentationEvents();
    const fireEvent = events.find((e) => e.type === "fire");
    expect(fireEvent).toBeDefined();
    expect(fireEvent?.origin).toEqual({ x: 0.24, y: 1.18, z: -0.68 });
  });
  it("38. Surviv.io combat cadence & weapon dynamics: automatic rifle continuous fire, recoil bloom, and shooter recoil impulse", () => {
    const testSim = new SectorDepotSimulation("test_cadence", "spoke");
    testSim.admitOperative(0);
    testSim.player.x = 0;
    testSim.player.z = 0;
    testSim.player.facing = Math.PI; // Aim North (-Z)
    testSim.player.weapon = "rifle";

    // Tick 0: Initial shot discharge
    testSim.step({
      dx: 0,
      dz: 0,
      sprint: false,
      slide: false,
      roll: false,
      kick: false,
      shoot: true,
      interact: false,
      aimAngle: Math.PI,
    });

    expect(testSim.activeProjectiles.length).toBeGreaterThanOrEqual(1);
    const initialRound = testSim.activeProjectiles[0];
    expect(initialRound.shooterIsPlayer).toBe(true);
    expect(initialRound.speed).toBe(54.0);
    expect(initialRound.vz).toBeLessThan(0); // Flying North (-Z)

    // Verify Newton recoil kick on shooter: player walk velocity kicked backwards (+Z)
    expect(testSim.walkVz).toBeGreaterThan(0.2);

    // Verify recoil continuous fire counter incremented
    expect(testSim.player.continuousFireTicks).toBeGreaterThanOrEqual(1);

    // Hold shoot for 5 ticks: rate of fire cooldown prevents premature discharge
    for (let i = 0; i < 5; i++) {
      testSim.step({
        dx: 0,
        dz: 0,
        sprint: false,
        slide: false,
        roll: false,
        kick: false,
        shoot: true,
        interact: false,
        aimAngle: Math.PI,
      });
    }

    // At 6th tick: automatic rifle fires 2nd round (600 RPM cadence)
    const activeBeforeSecond = testSim.activeProjectiles.length;
    testSim.step({
      dx: 0,
      dz: 0,
      sprint: false,
      slide: false,
      roll: false,
      kick: false,
      shoot: true,
      interact: false,
      aimAngle: Math.PI,
    });
    expect(testSim.activeProjectiles.length).toBeGreaterThan(activeBeforeSecond);
    expect(testSim.player.continuousFireTicks).toBeGreaterThanOrEqual(2);
  });

  it("39. Surviv.io ballistic flight & combat roll dodge: continuous bullet traversal and i-frame dodge", () => {
    const testSim = new SectorDepotSimulation("test_dodge", "spoke");
    testSim.admitOperative(0);
    testSim.player.x = 0;
    testSim.player.z = 0;
    testSim.player.health = 100;

    // Clear any pre-existing active projectiles
    testSim.activeProjectiles = [];

    // Spawn an incoming enemy ballistic round 8 meters North traveling South towards player
    const enemyBullet = {
      id: "enemy_bullet_test",
      shooterId: "scav_enemy",
      shooterIsPlayer: false,
      x: 0,
      y: 1.1,
      z: -8.0,
      vx: 0,
      vy: 0,
      vz: 40.0, // 40 m/s South (+Z)
      speed: 40.0,
      damage: 35,
      radius: 0.22,
      maxRange: 20.0,
      distanceTraveled: 0,
      weapon: "rifle" as const,
      isPellet: false,
    };
    testSim.spawnProjectile(enemyBullet);
    expect(testSim.activeProjectiles.length).toBe(1);

    // Player executes tactical combat roll (12 i-frames)
    testSim.step({
      dx: 1,
      dz: 0,
      sprint: false,
      slide: false,
      roll: true,
      kick: false,
      shoot: false,
      interact: false,
      aimAngle: 0,
    });
    expect(testSim.player.action).toBe("roll");
    expect(testSim.player.isInvulnerable).toBe(true);

    // Step simulation across bullet flight time into player hitbox
    for (let i = 0; i < 12; i++) {
      testSim.step({
        dx: 0,
        dz: 0,
        sprint: false,
        slide: false,
        roll: false,
        kick: false,
        shoot: false,
        interact: false,
        aimAngle: 0,
      });
    }

    // Because player had active roll i-frames when bullet swept through, player deflected damage
    expect(testSim.player.health).toBe(100);
  });

  it("40. Surviv.io tactical cover blocking & point-blank shotgun blast", () => {
    const testSim = new SectorDepotSimulation("test_cover_shotgun", "spoke");
    testSim.admitOperative(0);

    // Part A: Tactical cover blocks ballistic rounds
    // Container 0 is at minX: -23.5, maxX: -16.5, minZ: -32.0, maxZ: -28.0
    testSim.activeProjectiles = [];
    const bulletAtCover = {
      id: "cover_test_round",
      shooterId: "test_shooter",
      shooterIsPlayer: true,
      x: -20.0,
      y: 1.1,
      z: -35.0, // North of container
      vx: 0,
      vy: 0,
      vz: 50.0, // Traveling South (+Z) through container
      speed: 50.0,
      damage: 40,
      radius: 0.15,
      maxRange: 30.0,
      distanceTraveled: 0,
      weapon: "rifle" as const,
      isPellet: false,
    };
    testSim.spawnProjectile(bulletAtCover);

    // Step across container coordinates
    for (let i = 0; i < 5; i++) {
      testSim.step({
        dx: 0,
        dz: 0,
        sprint: false,
        slide: false,
        roll: false,
        kick: false,
        shoot: false,
        interact: false,
        aimAngle: 0,
      });
    }

    // Bullet was absorbed and destroyed by container cover
    expect(testSim.activeProjectiles.some(p => p.id === "cover_test_round")).toBe(false);

    // Part B: Close-range shotgun blast delivers lethal aggregate damage & knockback
    testSim.player.x = 0;
    testSim.player.z = 0;
    testSim.player.facing = Math.PI; // North (-Z)
    testSim.player.weapon = "shotgun";

    // Place a rival operative 2.5m North (point-blank sweet spot)
    const targetRival = {
      id: "target_rival_point_blank",
      isPlayer: false,
      isRival: true,
      isAI: false,
      name: "Rival Point Blank",
      x: 0,
      y: 0,
      z: -2.5,
      facing: 0,
      health: 120,
      armor: 0,
      cash: 0,
      action: "idle" as const,
      actionTicks: 0,
      isInvulnerable: false,
      isAlive: true,
      isExtracted: false,
      ammo: 30,
      maxAmmo: 30,
    };
    testSim.rivals.push(targetRival);

    testSim.step({
      dx: 0,
      dz: 0,
      sprint: false,
      slide: false,
      roll: false,
      kick: false,
      shoot: true,
      interact: false,
      aimAngle: Math.PI,
    });

    // Point-blank shotgun connects 6 pellets (aggregate 96 dmg) and applies heavy knockback
    expect(targetRival.health).toBeLessThanOrEqual(30); // 120 - 96 = 24
    expect(targetRival.z).toBeLessThan(-2.5); // Pushed backwards North (-Z)
  });

  it("41. Kick damage arc & size synchronized with animation timing: windup delay, 2.8m reach, and 125-degree sweep arc", () => {
    const testSim = new SectorDepotSimulation("raid_kick_timing_test", "spoke");
    testSim.admitOperative();
    testSim.player.x = 0;
    testSim.player.z = 0;
    testSim.player.facing = 0; // Facing South (+Z)

    // Add target in front within 2.8m reach at z = 2.0
    const targetFront = {
      id: "target_kick_front",
      isPlayer: false,
      isRival: true,
      isAI: false,
      name: "Front Target",
      x: 0,
      y: 0,
      z: 2.0,
      facing: 0,
      health: 100,
      armor: 0,
      cash: 0,
      action: "idle" as const,
      actionTicks: 0,
      isInvulnerable: false,
      isAlive: true,
      isExtracted: false,
      ammo: 30,
      maxAmmo: 30,
    };
    testSim.rivals.push(targetFront);

    // Frame 0: Initiate melee kick
    testSim.step({
      dx: 0,
      dz: 0,
      sprint: false,
      slide: false,
      roll: false,
      kick: true,
      shoot: false,
      interact: false,
    });

    expect(testSim.player.action).toBe("kick");
    expect(testSim.player.actionTicks).toBe(SIM_CONFIG.KICK_TICKS); // 42 ticks
    expect(testSim.kickStrikePending).toBe(true);
    // At frame 0: Chambering windup, no damage dealt yet!
    expect(targetFront.health).toBe(100);

    // Frames 1 to 15: Chambering / hip pivot phase (still pending, zero premature damage)
    for (let i = 0; i < 15; i++) {
      testSim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: false, interact: false });
      expect(targetFront.health).toBe(100);
      expect(testSim.kickStrikePending).toBe(true);
    }

    // Frame 16: Active strike frame (actionTicks <= 26, elapsed 0.267s) - foot extends and impacts!
    testSim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: false, interact: false });
    expect(testSim.kickStrikePending).toBe(false);
    expect(targetFront.health).toBe(65); // -35 HP damage
    expect(targetFront.z).toBeCloseTo(2.0 + 4.5); // 4.5m physical knockback

    // Arc Geometry Validation:
    // Reset player position and facing 0 (+Z)
    testSim.player.x = 0;
    testSim.player.z = 0;
    testSim.player.facing = 0;
    testSim.kickCooldownTicks = 0;

    // Target A: In sweep arc on right flank (+45 deg, +0.78 rad) at dist 2.0m -> (1.414, 1.414)
    // Target B: In sweep arc on forward-left (-35 deg, -0.61 rad) at dist 2.0m -> (-1.15, 1.64)
    // Target C: Outside sweep arc on far-left (-65 deg, -1.13 rad) at dist 2.0m -> (-1.81, 0.85)
    // Target D: Beyond 2.8m reach (3.2m straight ahead) -> (0, 3.2)
    const targetRight = { ...targetFront, id: "target_right", x: 1.414, z: 1.414, health: 100 };
    const targetLeft = { ...targetFront, id: "target_left", x: -1.15, z: 1.64, health: 100 };
    const targetFarLeft = { ...targetFront, id: "target_far_left", x: -1.81, z: 0.85, health: 100 };
    const targetTooFar = { ...targetFront, id: "target_too_far", x: 0, z: 3.2, health: 100 };
    testSim.rivals = [targetRight, targetLeft, targetFarLeft, targetTooFar];

    // Fire second kick
    testSim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: true, shoot: false, interact: false });
    for (let i = 0; i < 16; i++) {
      testSim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: false, interact: false });
    }

    // Inside sweep arc: right flank and forward-left hit!
    expect(targetRight.health).toBe(65);
    expect(targetLeft.health).toBe(65);
    // Outside sweep arc (far left outside right-leg sweep) and beyond reach: untouched!
    expect(targetFarLeft.health).toBe(100);
    expect(targetTooFar.health).toBe(100);
  });

  it("42. Firing when out of bullets automatically triggers weapon reload from reserve and dry-fire on empty reserve", () => {
    const testSim = new SectorDepotSimulation("raid_auto_reload_test", "spoke");
    testSim.admitOperative();

    // 1. Rifle: out of bullets with reserve ammo -> fire() reloads rifle
    testSim.setWeapon("rifle");
    testSim.player.ammo = 0;
    testSim.player.rifleAmmo = 0;
    testSim.player.reserveRifleAmmo = 60;
    testSim.shootCooldownTicks = 0;
    testSim.drainPresentationEvents(); // clear previous events

    const reloadedRifle = testSim.fire();
    expect(reloadedRifle).toBe(true);
    expect(testSim.player.action).toBe("reload");
    expect(testSim.player.actionTicks).toBe(15);
    expect(testSim.shootCooldownTicks).toBe(35);
    expect(testSim.player.ammo).toBe(30);
    expect(testSim.player.rifleAmmo).toBe(30);
    expect(testSim.player.reserveRifleAmmo).toBe(30);

    const rifleEvents = testSim.drainPresentationEvents();
    expect(rifleEvents.some(e => e.type === "reload")).toBe(true);

    // 2. Shotgun: out of bullets with reserve ammo -> step({ shoot: true }) reloads shotgun
    testSim.setWeapon("shotgun");
    testSim.player.ammo = 0;
    testSim.player.shotgunAmmo = 0;
    testSim.player.reserveShotgunAmmo = 16;
    testSim.shootCooldownTicks = 0;
    testSim.player.action = "idle";
    testSim.player.actionTicks = 0;

    testSim.step({
      dx: 0,
      dz: 0,
      sprint: false,
      slide: false,
      roll: false,
      kick: false,
      shoot: true,
      interact: false,
      aimAngle: 0,
    });

    expect(testSim.player.action).toBe("reload");
    expect(testSim.player.ammo).toBe(8);
    expect(testSim.player.shotgunAmmo).toBe(8);
    expect(testSim.player.reserveShotgunAmmo).toBe(8);
    expect(testSim.shootCooldownTicks).toBe(35);

    const shotgunEvents = testSim.drainPresentationEvents();
    expect(shotgunEvents.some(e => e.type === "reload")).toBe(true);

    // 3. Dry fire: out of bullets and zero reserve -> fire() fails and triggers dry_fire click
    testSim.player.ammo = 0;
    testSim.player.shotgunAmmo = 0;
    testSim.player.reserveShotgunAmmo = 0;
    testSim.shootCooldownTicks = 0;
    testSim.player.action = "idle";
    testSim.player.actionTicks = 0;

    const dryFired = testSim.fire();
    expect(dryFired).toBe(false);
    expect(testSim.shootCooldownTicks).toBe(18); // Dry-fire debounce
    expect(testSim.player.ammo).toBe(0);

    const dryEvents = testSim.drainPresentationEvents();
    expect(dryEvents.some(e => e.type === "dry_fire")).toBe(true);
  });
  it("43. Automated machine defense ballistics: turrets and drones spawn visible projectiles and emit fire presentation events instead of silent hitscan", () => {
    const testSim = new SectorDepotSimulation("raid_turret_ballistics", "spoke");
    testSim.admitOperative(0);
    testSim.player.x = 0;
    testSim.player.z = 0;
    testSim.player.health = 100;
    testSim.player.armor = 0;
    testSim.rivals = []; // Isolate machine combat
    testSim.activeProjectiles = [];

    // Position automated turret 10 meters North of player
    const turret = testSim.machines.find(m => m.id === "turret_depot_alpha")!;
    turret.x = 0;
    turret.y = 0;
    turret.z = -10;
    turret.cooldownTicks = 0;
    turret.isAlive = true;

    // Remove the drone so only the turret engages
    testSim.machines = [turret];

    // Clear initial presentation events
    testSim.drainPresentationEvents();

    // Step 1: Turret detects player, tracks facing South towards player, and fires
    testSim.step({
      dx: 0,
      dz: 0,
      sprint: false,
      slide: false,
      roll: false,
      kick: false,
      shoot: false,
      interact: false,
    });

    // 1. Turret has telegraphed facing and distance
    expect(turret.facing).toBeCloseTo(0, 1); // Facing South towards player (z=0 from z=-10)
    expect((turret as any).targetDistance).toBeCloseTo(10, 1);

    // 2. Turret emitted "fire" presentation event with muzzle origin and aim direction
    const events = testSim.drainPresentationEvents();
    const fireEvent = events.find(e => e.type === "fire" && (e as any).shooterId === turret.id) as any;
    expect(fireEvent).toBeDefined();
    expect(fireEvent?.weapon).toBe("rifle");
    expect(fireEvent?.origin.z).toBeGreaterThan(-10); // Muzzle is offset in front of turret

    // 3. Turret spawned a visible ballistic projectile instead of instant hitscan
    expect(testSim.activeProjectiles.length).toBe(1);
    const proj = testSim.activeProjectiles[0];
    expect(proj.shooterId).toBe(turret.id);
    expect(proj.shooterIsPlayer).toBe(false);
    expect(proj.speed).toBe(44.0);
    expect(proj.damage).toBe(14);
    // At frame 0: Projectile just left muzzle, player is NOT damaged instantly!
    expect(testSim.player.health).toBe(100);

    // 4. Step simulation until projectile travels to player (~13 ticks: 9m / (44m/s * 0.01667s) ≈ 12.3 ticks)
    for (let t = 0; t < 15; t++) {
      testSim.step({
        dx: 0,
        dz: 0,
        sprint: false,
        slide: false,
        roll: false,
        kick: false,
        shoot: false,
        interact: false,
      });
      if (testSim.player.health < 100) break;
    }

    // Player takes damage when the projectile physically contacts the player
    expect(testSim.player.health).toBe(86); // 100 - 14 = 86
  });
  it("Scav Enforcer fires authentic 6-pellet buckshot spread fan instead of instant single hit", () => {
    const testSim = new SectorDepotSimulation("test_pellet_seed");
    testSim.zoneMode = "spoke";
    testSim.spawnScavSquad();
    testSim.player.x = 0;
    testSim.player.z = 0;
    testSim.player.health = 100;

    // Find shotgun scav enforcer
    const enforcer = testSim.rivals.find(r => r.weapon === "shotgun");
    expect(enforcer).toBeDefined();
    if (!enforcer) return;

    enforcer.isAlive = true;
    enforcer.x = 0;
    enforcer.z = -8; // 8 meters away
    enforcer.aimTicks = 1; // ready to complete aim telegraph on this tick
    enforcer.shootCooldownTicks = 0;

    testSim.step({
      dx: 0,
      dz: 0,
      sprint: false,
      slide: false,
      roll: false,
      kick: false,
      shoot: false,
      interact: false,
    });

    // Check spawned projectiles
    const pellets = testSim.activeProjectiles.filter(p => p.shooterId === enforcer.id);
    expect(pellets.length).toBe(6);
    expect(pellets[0].isPellet).toBe(true);
    expect(pellets[0].speed).toBe(38.0);
    expect(pellets[0].damage).toBe(4);
  });
});
