// @ts-ignore
import { createStickZoneServer, resetServerModuleState, getRaidOperativeWeaponState } from "../scripts/server.mjs";
import WebSocket from "ws";
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SectorDepotSimulation, type GameInput } from '../src/sim/game.js';
import { ServerSettlementAuthority, ServerSettlementAdapter } from '../src/sim/server-settlement.js';
import { authoritativeLedgerCommit, verifySettlementReceipt, AuthoritativeSettlementLedger, registerDeployment, defaultSettlementLedger } from '../src/sim/airlock.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { MultiplayerCoordinator, validateAndSanitizeSnapshot } from '../src/sim/multiplayer.js';

function makeInput(overrides: Partial<GameInput> = {}): GameInput {
  return {
    dx: 0,
    dz: 0,
    sprint: false,
    slide: false,
    roll: false,
    jump: false,
    kick: false,
    shoot: false,
    interact: false,
    aimAngle: 0,
    ...overrides,
  };
}


describe('Tarkov Extraction Hardcore Mechanics Verification', () => {
  let sim: SectorDepotSimulation;

  beforeEach(() => {
    sim = new SectorDepotSimulation('raid_tarkov_alpha_01', 'spoke');
    sim.admitOperative(0);
    // Ensure ingress is completed for testing combat
    sim.player.x = 0;
    sim.player.z = 0;
  });

  it('1. Shotgun ballistics: 6 buckshot pellets with damage falloff and dispersion', () => {
    sim.setWeapon('shotgun');
    expect(sim.player.weapon).toBe('shotgun');
    expect(sim.player.maxAmmo).toBe(8);

    // Spawn dummy enemy directly in front at 4.0m (point-blank)
    sim.rivals = [{
      id: 'target_close',
      isPlayer: false,
      isRival: true,
      isAI: true,
      name: 'TARGET CLOSE',
      badge: 'TEST',
      x: 0,
      y: 0,
      z: 4.0,
      facing: Math.PI,
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
    }];

    sim.player.facing = 0; // facing +Z towards target
    sim.step(makeInput({ dx: 0, dz: 0, shoot: true, interact: false }));

    // Shotgun fired: consumed 1 shell, dealt point-blank damage (each pellet ~10 damage, up to 60)
    expect(sim.player.ammo).toBe(7);
    expect(sim.rivals[0].health).toBeLessThanOrEqual(50); // Sustained >= 50 buckshot damage
    expect(sim.player.lastHitmarkerCrit).toBe(true);
  });

  it('2. Finite ammunition and tactical reload from reserve', () => {
    sim.setWeapon('rifle');
    sim.player.ammo = 5;
    sim.player.reserveRifleAmmo = 15;

    // Reload draws up to 25 from reserve (needs 25, only 15 available)
    const reloaded = sim.reload();
    expect(reloaded).toBe(true);
    expect(sim.player.ammo).toBe(20);
    expect(sim.player.reserveRifleAmmo).toBe(0);

    // Empty reserve reload fails
    sim.player.ammo = 10;
    const failReload = sim.reload();
    expect(failReload).toBe(false);
    expect(sim.player.ammo).toBe(10);
  });

  it('3. Fatal arterial bleeding: 2 HP per second (30 ticks) kills untreated operative', () => {
    sim.player.health = 4;
    sim.player.isBleeding = true;

    // Step 60 ticks (1.0s at 60 Hz)
    for (let i = 0; i < 60; i++) {
      sim.step(makeInput({ dx: 0, dz: 0, shoot: false, interact: false }));
    }
    expect(sim.player.health).toBe(2);
    expect(sim.player.isAlive).toBe(true);

    // Step next 60 ticks -> health drops to 0, fatal hemorrhage
    for (let i = 0; i < 60; i++) {
      sim.step(makeInput({ dx: 0, dz: 0, shoot: false, interact: false }));
    }
    expect(sim.player.health).toBe(0);
    expect(sim.player.isAlive).toBe(false);
  });

  it('4. Propital stim treatment: 60-tick channel heals +45 HP, cures bleeding, trauma interrupts', () => {
    // Clear ambient threats for uninterrupted medical administration
    sim.machines = [];
    sim.rivals = [];
    sim.player.health = 50;
    sim.player.isBleeding = true;
    sim.player.stimsRemaining = 2;

    const started = sim.useStim();
    expect(started).toBe(true);
    expect(sim.player.isUsingStim).toBe(true);

    // Channel for 59 ticks: not yet applied
    for (let i = 0; i < 59; i++) {
      sim.step(makeInput({ dx: 0, dz: 0, shoot: false, interact: false }));
    }
    expect(sim.player.isBleeding).toBe(true);
    expect(sim.player.stimsRemaining).toBe(2);

    // 60th tick completes administration
    sim.step(makeInput({ dx: 0, dz: 0, shoot: false, interact: false }));
    expect(sim.player.isUsingStim).toBe(false);
    expect(sim.player.isBleeding).toBe(false);
    expect(sim.player.health).toBe(95); // 50 + 45
    expect(sim.player.stimsRemaining).toBe(1);

    // Trauma interrupts ongoing treatment
    sim.player.isBleeding = true;
    sim.useStim();
    expect(sim.player.isUsingStim).toBe(true);
    sim.applyDamageToPlayer(10);
    expect(sim.player.isUsingStim).toBe(false);
    expect(sim.player.stimChannelTicks).toBe(0);
    expect(sim.player.isBleeding).toBe(true);
  });

  it('5. Boss keycard drop: awarded on BOTH firearm and melee kick kills', () => {
    // A) Gunfire kill
    sim.player.hasKeycard = false;
    sim.player.x = 0;
    sim.player.z = 40;
    sim.spawnScavSquad();
    const boss = sim.rivals.find(r => r.id === 'scav_boss_warlord')!;
    boss.health = 10;
    boss.armor = 0;
    boss.x = 0;
    boss.z = 42;
    sim.player.facing = 0;

    sim.step(makeInput({ dx: 0, dz: 0, shoot: true, interact: false }));
    expect(boss.isAlive).toBe(false);
    expect(sim.player.hasKeycard).toBe(true);

    // B) Melee kick kill
    sim.player.hasKeycard = false;
    boss.isAlive = true;
    boss.health = 20;
    boss.armor = 0;
    sim.player.x = 0;
    sim.player.z = 42;
    sim.player.facing = 0;

    sim.step(makeInput({ dx: 0, dz: 0, shoot: false, interact: false, kick: true }));
    expect(boss.isAlive).toBe(false);
    expect(sim.player.hasKeycard).toBe(true);
  });

  it('6. Emergency Bunker Exfil at (-45, -45): requires keycard and ticks hold deterministically', () => {
    sim.player.x = -45;
    sim.player.z = -45;
    sim.player.hasKeycard = false;

    // Without keycard: hold does NOT initiate
    for (let i = 0; i < 30; i++) {
      sim.step(makeInput({ dx: 0, dz: 0, shoot: false, interact: false }));
    }
    expect(sim.exfilController.getState().kind).toBe('idle');

    // With keycard: hold initiates and progresses tick-by-tick
    sim.player.hasKeycard = true;
    for (let i = 0; i < 185; i++) {
      sim.step(makeInput({ dx: 0, dz: 0, shoot: false, interact: false }));
    }
    // Completed hold transitions into corridor presentation
    const exState = sim.exfilController.getState();
    expect(exState.kind === 'corridor_presentation' || exState.kind === 'submitting_settlement' || exState.kind === 'extracted').toBe(true);
  });

  it('7. Loot reconciliation: item values sum to exact crate cashValue; rollback removes items', () => {
    for (const crate of sim.crates) {
      if (crate.items) {
        const itemSum = crate.items.reduce((acc, it) => acc + it.value, 0);
        expect(crate.cashValue).toBe(itemSum);
      }
    }

    // Test crate claim and revocation
    sim.player.hasKeycard = false;
    sim.player.stimsRemaining = 0;
    const crate3 = sim.crates.find(c => c.id === 'crate_03')!;
    
    // Claim crate 3 (contains keycard)
    sim.claimCrateLocally(crate3.id, sim.player.id, 100);
    expect(sim.player.hasKeycard).toBe(true);
    expect(sim.player.cash).toBe(3800);

    // Rival with earlier timestamp wins tie -> claim revoked
    sim.claimCrateLocally(crate3.id, 'rival_ghost', 50);
    expect(sim.player.cash).toBe(0);
    expect(sim.player.hasKeycard).toBe(false); // Keycard revoked on rollback!

    // Source Tracking: Boss keycard is preserved even if a later crate is rolled back!
    sim.keycardSources.add('scav_boss_warlord');
    sim.player.hasKeycard = true;
    sim.claimCrateLocally(crate3.id, sim.player.id, 200);
    expect(sim.player.hasKeycard).toBe(true);
    // Revoke crate 3
    sim.claimCrateLocally(crate3.id, 'rival_ghost', 50);
    expect(sim.player.hasKeycard).toBe(true); // Boss keycard stays intact!

    // Snapshot rollback unifies with full item revocation
    const crate2 = sim.crates.find(c => c.id === 'crate_02')!;
    const initialStims = sim.player.stimsRemaining ?? 0;
    sim.claimCrateLocally(crate2.id, sim.player.id, 300);
    expect(sim.player.stimsRemaining).toBe(initialStims + 1);
    expect(sim.player.cash).toBe(2400);

    // Snapshot revokes claim
    sim.restoreCrateStateFromSnapshot([{ id: crate2.id, opened: true, claimedBy: 'rival_spectre', claimedAt: 100 }]);
    expect(sim.player.cash).toBe(0);
    expect(sim.player.stimsRemaining).toBe(initialStims); // Stim rolled back via snapshot!
  });

  it('8. Dynamic raid custody: repeated extractions and fresh raids settle cleanly without activeRaid mismatch', async () => {
    // Raid 1
    const raid1 = new SectorDepotSimulation('raid_sequence_alpha', 'spoke');
    raid1.tick = 500;
    raid1.player.cash = 3000;
    raid1.player.isExtracted = true;
    const commit1 = await authoritativeLedgerCommit(raid1);
    expect(commit1.receipt.raidId).toBe('raid_sequence_alpha');

    // Raid 2 for same player profile (sequential deployment)
    const raid2 = new SectorDepotSimulation('raid_sequence_beta', 'spoke');
    raid2.tick = 600;
    raid2.player.cash = 4500;
    raid2.player.isExtracted = true;
    const commit2 = await authoritativeLedgerCommit(raid2);
    expect(commit2.receipt.raidId).toBe('raid_sequence_beta');
    expect(commit2.receipt.receiptId).not.toBe(commit1.receipt.receiptId);

    const verifyResult = await verifySettlementReceipt(commit2.receipt, commit2.outcomePayload);
    expect(verifyResult.valid).toBe(true);
  });

  it('9. Extracted & locked state invariants: actions rejected when extracted', () => {
    sim.player.isExtracted = true;
    expect(sim.isInputLocked()).toBe(true);

    // Public actions reject execution
    expect(sim.reload()).toBe(false);
    expect(sim.useStim()).toBe(false);
    expect(sim.requestLootCrate('crate_01')).toBe(false);

    const prevWeapon = sim.player.weapon;
    sim.switchWeapon();
    expect(sim.player.weapon).toBe(prevWeapon); // Weapon switch rejected when extracted
  });

  it('10. Network trauma interruption: incoming authoritative damage interrupts stim treatment', () => {
    sim.player.health = 60;
    sim.player.stimsRemaining = 2;
    sim.useStim();
    expect(sim.player.isUsingStim).toBe(true);
    expect(sim.player.stimChannelTicks).toBe(60);

    // Incoming network/authoritative trauma
    sim.interruptStimTreatment();
    expect(sim.player.isUsingStim).toBe(false);
    expect(sim.player.stimChannelTicks).toBe(0);
  });

  it('11. Keycard source tracking: M4 boss kill followed by crate rollback preserves valid boss keycard', () => {
    // 1. M4 Rifle eliminates Scav Boss Warlord
    sim.machines = [];
    const boss = {
      id: 'scav_boss_warlord',
      name: 'Sector Warlord',
      isPlayer: false,
      isRival: true,
      isAI: true,
      x: 0,
      y: 0,
      z: 42,
      facing: 0,
      health: 10,
      armor: 0,
      cash: 0,
      ammo: 30,
      maxAmmo: 30,
      action: 'idle' as const,
      actionTicks: 0,
      isInvulnerable: false,
      isAlive: true,
      isExtracted: false,
    };
    sim.rivals = [boss];
    sim.setWeapon('rifle');
    sim.player.x = 0;
    sim.player.z = 40;
    sim.player.facing = 0;
    sim.step(makeInput({ shoot: true }));

    // Boss slain: keycard source registered
    expect(sim.keycardSources.has('scav_boss_warlord')).toBe(true);
    expect(sim.player.hasKeycard).toBe(true);

    // 2. Operative also secures a keycard from a crate
    const testCrate = sim.crates[0];
    testCrate.claimedBy = sim.player.id;
    testCrate.opened = true;
    sim.grantKeycard(testCrate.id);
    sim.crateHadKeycard.set(testCrate.id, true);
    expect(sim.keycardSources.size).toBe(2);

    // 3. Rollback crate claim
    sim.rollbackCrateClaim(testCrate.id);

    // Crate keycard revoked, but boss keycard remains securely held!
    expect(sim.keycardSources.has(testCrate.id)).toBe(false);
    expect(sim.keycardSources.has('scav_boss_warlord')).toBe(true);
    expect(sim.player.hasKeycard).toBe(true);

    // Only removing the boss keycard revokes keycard exfil access
    sim.revokeKeycard('scav_boss_warlord');
    expect(sim.player.hasKeycard).toBe(false);
  });

  it('12. Shotgun network validation: isolated angle, range, cadence, and distance damage bands across machines and players', () => {
    const coord = new MultiplayerCoordinator(sim);
    const now = Date.now();
    let testNow = now;
    (coord as any).getServerNow = () => testNow;

    // 1. Machine hit validation for shotgun
    const machine = sim.machines[0];
    machine.x = 0;
    machine.z = 10;
    machine.health = 500;
    machine.isAlive = true;

    sim.rivals.push({
      id: 'op_bravo_1',
      name: 'RIVAL OPERATIVE',
      isPlayer: false,
      isRival: true,
      isAI: false,
      x: 0,
      y: 0,
      z: 2,
      facing: 0,
      health: 100,
      armor: 50,
      cash: 0,
      ammo: 8,
      maxAmmo: 8,
      action: 'idle',
      actionTicks: 0,
      isInvulnerable: false,
      isAlive: true,
      isExtracted: false,
    });

    // A) Mid-range (8.0m): on-axis calculated pellet damage is exactly 14 (2 pellets * 7 dmg). Damage 15 is rejected!
    const midRangeOverCap = (coord as any).validateAndApplyMachineHit({
      eventId: 'evt_shotgun_mid_over',
      senderId: 'op_bravo_1',
      senderName: 'RIVAL OPERATIVE',
      squad: 'SQUAD BRAVO',
      timestamp: now,
      data: {
        machineId: machine.id,
        damage: 15, // Exceeds 14 calculated pellet damage at 8m
        kind: 'shotgun',
        attackerFacing: 0,
        attackerX: 0,
        attackerZ: 2,
      },
    });
    expect(midRangeOverCap).toBe(false);

    // B) Mid-range (8.0m): damage 14 <= 14 is accepted!
    testNow = now + 400;
    const midRangeValid = (coord as any).validateAndApplyMachineHit({
      eventId: 'evt_shotgun_mid_ok',
      senderId: 'op_bravo_1',
      senderName: 'RIVAL OPERATIVE',
      squad: 'SQUAD BRAVO',
      timestamp: now + 400,
      data: {
        machineId: machine.id,
        damage: 14,
        kind: 'shotgun',
        attackerFacing: 0,
        attackerX: 0,
        attackerZ: 2,
      },
    });
    expect(midRangeValid).toBe(true);

    // C) ISOLATED CADENCE VIOLATION: in range (8m) and on-axis (facing 0), but within 100ms (< 380ms) -> rejected!
    testNow = now + 500;
    const cadenceViolation = (coord as any).validateAndApplyMachineHit({
      eventId: 'evt_shotgun_fast',
      senderId: 'op_bravo_1',
      senderName: 'RIVAL OPERATIVE',
      squad: 'SQUAD BRAVO',
      timestamp: now + 500,
      data: {
        machineId: machine.id,
        damage: 14,
        kind: 'shotgun',
        attackerFacing: 0,
        attackerX: 0,
        attackerZ: 2,
      },
    });
    expect(cadenceViolation).toBe(false);

    // D) Point-blank (3.0m): all 6 pellets hit, calculated damage is 60 (6 * 10). Damage 60 is accepted at now + 900ms!
    testNow = now + 900;
    const pointBlankValid = (coord as any).validateAndApplyMachineHit({
      eventId: 'evt_shotgun_pb',
      senderId: 'op_bravo_1',
      senderName: 'RIVAL OPERATIVE',
      squad: 'SQUAD BRAVO',
      timestamp: now + 900,
      data: {
        machineId: machine.id,
        damage: 60,
        kind: 'shotgun',
        attackerFacing: 0,
        attackerX: 0,
        attackerZ: 7, // 3m from machine at z=10
      },
    });
    expect(pointBlankValid).toBe(true);

    // E) Long-range (12.0m): on-axis calculated pellet damage is exactly 8 (2 pellets * 4 dmg). Damage 10 is rejected, 8 is accepted!
    machine.z = 19;
    testNow = now + 1300;
    const longRangeOver = (coord as any).validateAndApplyMachineHit({
      eventId: 'evt_shotgun_lr_over',
      senderId: 'op_bravo_1',
      senderName: 'RIVAL OPERATIVE',
      squad: 'SQUAD BRAVO',
      timestamp: now + 1300,
      data: {
        machineId: machine.id,
        damage: 10, // Exceeds 8 calculated pellet damage at 12m
        kind: 'shotgun',
        attackerFacing: 0,
        attackerX: 0,
        attackerZ: 7,
      },
    });
    expect(longRangeOver).toBe(false);

    testNow = now + 1700;
    const longRangeValid = (coord as any).validateAndApplyMachineHit({
      eventId: 'evt_shotgun_lr_ok',
      senderId: 'op_bravo_1',
      senderName: 'RIVAL OPERATIVE',
      squad: 'SQUAD BRAVO',
      timestamp: now + 1700,
      data: {
        machineId: machine.id,
        damage: 8, // Exact 8 calculated pellet damage at 12m
        kind: 'shotgun',
        attackerFacing: 0,
        attackerX: 0,
        attackerZ: 7,
      },
    });
    expect(longRangeValid).toBe(true);

    // F) ISOLATED RANGE TEST: On-axis (facing 0), machine at z=25 (dist = 18m > 14m) is rejected solely due to range!
    machine.z = 25;
    testNow = now + 2100;
    const outOfRange = (coord as any).validateAndApplyMachineHit({
      eventId: 'evt_shotgun_oor',
      senderId: 'op_bravo_1',
      senderName: 'RIVAL OPERATIVE',
      squad: 'SQUAD BRAVO',
      timestamp: now + 2100,
      data: {
        machineId: machine.id,
        damage: 20,
        kind: 'shotgun',
        attackerFacing: 0, // Direct forward aim (on-axis)
        attackerX: 0,
        attackerZ: 7,
      },
    });
    expect(outOfRange).toBe(false);

    // G) ISOLATED ANGLE TEST: Machine at z=10, attacker at z=7 (dist = 3.0m, WELL within 14m), but facing 45° off-axis -> rejected solely due to angle!
    machine.z = 10;
    testNow = now + 2500;
    const offAxis = (coord as any).validateAndApplyMachineHit({
      eventId: 'evt_shotgun_off_axis',
      senderId: 'op_bravo_1',
      senderName: 'RIVAL OPERATIVE',
      squad: 'SQUAD BRAVO',
      timestamp: now + 2500,
      data: {
        machineId: machine.id,
        damage: 40,
        kind: 'shotgun',
        attackerFacing: Math.PI / 4, // 45 deg off-axis (outside 15 deg half-cone)
        attackerX: 0,
        attackerZ: 7, // 3m from machine!
      },
    });
    expect(offAxis).toBe(false);

    // 2. Comprehensive Player hit validation for shotgun
    const playerNow = (coord as any).getServerNow();
    (coord as any).connectedPeers.set('op_bravo_1', {
      ingressDone: true,
      admitted: true,
      handshakeState: 'confirmed',
      lastActivity: playerNow,
    });
    (coord as any).admittedPeers.add('op_bravo_1');
    sim.admitOperative();

    const rival = sim.rivals.find(r => r.id === 'op_bravo_1')!;
    rival.x = 0;
    rival.z = 2; // Mid-range (8.0m from player at z=10)
    rival.facing = 0;

    sim.player.x = 0;
    sim.player.z = 10;
    sim.player.health = 100;
    sim.player.armor = 0;

    // A) Player mid-range over calculated damage (15 > 14) is rejected
    testNow = playerNow;
    coord.handleMessage({
      eventId: 'evt_p_hit_over',
      type: 'hit',
      senderId: 'op_bravo_1',
      senderName: 'RIVAL OPERATIVE',
      squad: 'SQUAD BRAVO',
      timestamp: playerNow,
      data: {
        targetId: (coord as any).localId,
        damage: 15, // Exceeds 14 calculated pellet damage at 8m
        kind: 'shotgun',
        attackerX: 0,
        attackerZ: 2,
        attackerFacing: 0,
      },
    });
    expect(sim.player.health).toBe(100); // Rejected, no damage taken!

    // B) Player mid-range valid (14 <= 14) is accepted at playerNow + 400ms
    testNow = playerNow + 400;
    coord.handleMessage({
      eventId: 'evt_p_hit_ok',
      type: 'hit',
      senderId: 'op_bravo_1',
      senderName: 'RIVAL OPERATIVE',
      squad: 'SQUAD BRAVO',
      timestamp: playerNow + 400,
      data: {
        targetId: (coord as any).localId,
        damage: 14,
        kind: 'shotgun',
        attackerX: 0,
        attackerZ: 2,
        attackerFacing: 0,
      },
    });
    expect(sim.player.health).toBe(86); // 100 - 14 = 86!

    // C) Player point-blank (3.0m, calculated damage 60): 60 dmg accepted
    sim.player.health = 100;
    rival.z = 7; // 3m from player at z=10
    testNow = playerNow + 800;
    coord.handleMessage({
      eventId: 'evt_p_hit_pb',
      type: 'hit',
      senderId: 'op_bravo_1',
      senderName: 'RIVAL OPERATIVE',
      squad: 'SQUAD BRAVO',
      timestamp: playerNow + 800,
      data: {
        targetId: (coord as any).localId,
        damage: 60,
        kind: 'shotgun',
        attackerX: 0,
        attackerZ: 7,
        attackerFacing: 0,
      },
    });
    expect(sim.player.health).toBe(40); // 100 - 60 = 40!

    // D) Player long-range (12.0m, cap 24): 30 dmg rejected, 20 dmg accepted
    sim.player.health = 100;
    rival.z = -2; // 12m from player at z=10 (attacker moved within 6m to z=1 first)
    rival.x = 0;
    rival.z = 1;
    (coord as any).lastAttackerShotgunTime?.set('op_bravo_1', playerNow + 800);

    // Step rival back to z=-2 (dist = 3m move <= 6m)
    rival.z = -2;
    testNow = playerNow + 1200;
    coord.handleMessage({
      eventId: 'evt_p_hit_lr_over',
      type: 'hit',
      senderId: 'op_bravo_1',
      senderName: 'RIVAL OPERATIVE',
      squad: 'SQUAD BRAVO',
      timestamp: playerNow + 1200,
      data: {
        targetId: (coord as any).localId,
        damage: 30, // Exceeds 8 calculated pellet damage at 12m
        kind: 'shotgun',
        attackerX: 0,
        attackerZ: -2,
        attackerFacing: 0,
      },
    });
    expect(sim.player.health).toBe(100); // 30 dmg rejected!

    testNow = playerNow + 1600;
    coord.handleMessage({
      eventId: 'evt_p_hit_lr_ok',
      type: 'hit',
      senderId: 'op_bravo_1',
      senderName: 'RIVAL OPERATIVE',
      squad: 'SQUAD BRAVO',
      timestamp: playerNow + 1600,
      data: {
        targetId: (coord as any).localId,
        damage: 8, // Exact 8 calculated pellet damage at 12m
        kind: 'shotgun',
        attackerX: 0,
        attackerZ: -2,
        attackerFacing: 0,
      },
    });
    expect(sim.player.health).toBe(92); // 100 - 8 = 92!

    // E) Player isolated angle rejection: rival at 3m (z=7), facing 45° off-axis -> rejected!
    sim.player.health = 100;
    rival.z = 7;
    testNow = playerNow + 2000;
    coord.handleMessage({
      eventId: 'evt_p_hit_off_axis',
      type: 'hit',
      senderId: 'op_bravo_1',
      senderName: 'RIVAL OPERATIVE',
      squad: 'SQUAD BRAVO',
      timestamp: playerNow + 2000,
      data: {
        targetId: (coord as any).localId,
        damage: 40,
        kind: 'shotgun',
        attackerX: 0,
        attackerZ: 7,
        attackerFacing: Math.PI / 4, // 45 deg off-axis
      },
    });
    expect(sim.player.health).toBe(100); // Rejected due to off-axis!
  });

  it('13. Snapshot crate custody: peer snapshot cannot steal locally claimed crate, while authoritative snapshot revokes with rollback', () => {
    const crate = sim.crates[0];
    const initialCash = sim.player.cash;
    sim.requestLootCrate(crate.id);
    expect(crate.claimedBy).toBe(sim.player.id);
    const postLootCash = sim.player.cash;
    expect(postLootCash).toBeGreaterThan(initialCash);

    // 1. Unauthoritative peer snapshot attempts to claim the crate for rival
    sim.applyRaidSnapshot({
      snapshotTick: sim.tick + 10,
      crates: [{ id: crate.id, opened: true, claimedBy: 'rival_peer_bravo', claimedAt: sim.tick + 5 }],
      machines: [],
    } as any);

    // Local ownership and cash preserved!
    expect(crate.claimedBy).toBe(sim.player.id);
    expect(sim.player.cash).toBe(postLootCash);

    // 2. Authoritative snapshot resolves crate to rival: triggers inventory rollback
    sim.applyRaidSnapshot({
      snapshotTick: sim.tick + 20,
      crates: [{ id: crate.id, opened: true, claimedBy: 'rival_peer_bravo', claimedAt: sim.tick + 5 }],
      machines: [],
      isAuthoritative: true,
    } as any);

    // Ownership updated and cash completely debited back
    expect(crate.claimedBy).toBe('rival_peer_bravo');
    expect(sim.player.cash).toBe(initialCash);
  });

  it('14. Settlement finality: coordinator registers operative identity and ledger rejects duplicate settlement when tick changes', async () => {
    const ledger = new AuthoritativeSettlementLedger();
    const testRaidId = `raid_finality_${Date.now()}`;
    const testSim = new SectorDepotSimulation(testRaidId);
    const testCoord = new MultiplayerCoordinator(testSim);

    expect(testSim.player.id).toBe('op_alpha_1');
    testSim.player.cash = 4500;
    testSim.player.isExtracted = true;
    testSim.tick = 200;

    // First settlement commit succeeds
    const { receipt: r1 } = await authoritativeLedgerCommit(testSim, ledger);
    expect(r1.receiptId).toBeDefined();

    // Duplicate settlement attempt with advanced tick is rejected by the ledger
    testSim.tick = 205;
    await expect(authoritativeLedgerCommit(testSim, ledger)).rejects.toThrow(
      /has already settled for raid/
    );
  });
  it("15. Snapshot crate custody: authoritative snapshot resetting crate to unclaimed triggers local rollback", () => {
    const crate = sim.crates[0];
    const initialCash = sim.player.cash;
    sim.requestLootCrate(crate.id);
    expect(crate.claimedBy).toBe(sim.player.id);
    expect(sim.player.cash).toBeGreaterThan(initialCash);

    // Authoritative snapshot with null claimant (server resets crate)
    sim.applyRaidSnapshot({
      snapshotTick: sim.tick + 20,
      crates: [{ id: crate.id, opened: false, claimedBy: null, claimedAt: 0 }],
      machines: [],
      isAuthoritative: true,
    } as any);

    // Claim revoked and cash debited back
    expect(crate.claimedBy).toBe(null);
    expect(sim.player.cash).toBe(initialCash);
  });

  it("16. Settlement finality: registerDeployment preserves settled status for completed raids", async () => {
    const ledger = new AuthoritativeSettlementLedger();
    const testRaidId = `raid_persist_${Date.now()}`;
    const testSim = new SectorDepotSimulation(testRaidId);
    testSim.player.cash = 3000;
    testSim.player.isExtracted = true;
    testSim.tick = 100;

    await authoritativeLedgerCommit(testSim, ledger);
    const key = `${testRaidId}:${testSim.player.id}`;
    expect((ledger as any).settledRaids.has(key)).toBe(true);

    // Redeployment call must NOT wipe the settled record
    ledger.registerDeployment(testSim.player.id, testRaidId);
    expect((ledger as any).settledRaids.has(key)).toBe(true);

    // Any attempt to commit again still throws
    testSim.tick = 110;
    await expect(authoritativeLedgerCommit(testSim, ledger)).rejects.toThrow(
      /has already settled for raid/
    );
  });
  it('17. Weapon-specific ammo grant and rollback: looting crate with rifle increases rifle ammo; switching to shotgun and revoking claim leaves shotgun intact and rolls back rifle ammo', () => {
    // 1. Start with BOTH weapon pools depleted: rifle 5/30, shotgun 2/8, active weapon rifle
    sim.player.weapon = 'rifle';
    sim.player.maxAmmo = 30;
    sim.player.ammo = 5;
    sim.player.rifleAmmo = 5;
    sim.player.shotgunAmmo = 2;
    sim.player.reserveRifleAmmo = 90;
    sim.player.reserveShotgunAmmo = 24;

    // 2. Loot crate_01 while rifle equipped: fills BOTH weapon pools to capacity
    // (rifle: 5 -> 30, granting 25 rounds; shotgun: 2 -> 8, granting 6 shells)
    sim.recordCrateLootAmmo('crate_01');
    expect(sim.player.ammo).toBe(30);
    expect(sim.player.rifleAmmo).toBe(30);
    expect(sim.player.shotgunAmmo).toBe(8);

    // 3. Switch weapon to shotgun (now active ammo is shotgun: 8/8)
    sim.switchWeapon();
    expect(sim.player.weapon).toBe('shotgun');
    expect(sim.player.ammo).toBe(8);
    expect(sim.player.shotgunAmmo).toBe(8);
    expect(sim.player.rifleAmmo).toBe(30);

    // 4. Server authority revokes crate_01 claim
    sim.handleCrateRejectionAmmo('crate_01');

    // Both pools roll back by their granted amounts:
    // Shotgun rolls back by 6 (8 -> 2); Rifle rolls back by 25 (30 -> 5)
    expect(sim.player.weapon).toBe('shotgun');
    expect(sim.player.ammo).toBe(2);
    expect(sim.player.shotgunAmmo).toBe(2);
    expect(sim.player.rifleAmmo).toBe(5);

    // 5. Switch back to rifle: rifle ammo rolled back to 5!
    sim.switchWeapon();
    expect(sim.player.weapon).toBe('rifle');
    expect(sim.player.ammo).toBe(5);
    expect(sim.player.rifleAmmo).toBe(5);

    // 6. Rollback after firing during grant (Sol check):
    sim.recordCrateLootAmmo('crate_02');
    expect(sim.player.rifleAmmo).toBe(30);
    expect(sim.player.shotgunAmmo).toBe(8);
    // Fire 2 rifle rounds
    sim.player.ammo -= 2;
    sim.player.rifleAmmo = sim.player.ammo;
    expect(sim.player.rifleAmmo).toBe(28);
    // Switch to shotgun and fire 1 shell
    sim.switchWeapon();
    expect(sim.player.ammo).toBe(8);
    sim.player.ammo -= 1;
    sim.player.shotgunAmmo = sim.player.ammo;
    expect(sim.player.shotgunAmmo).toBe(7);
    // Revoke crate_02:
    sim.handleCrateRejectionAmmo('crate_02');
    // Shotgun: max(0, 7 - 6) = 1; Rifle: max(0, 28 - 25) = 3
    expect(sim.player.shotgunAmmo).toBe(1);
    expect(sim.player.ammo).toBe(1);
    sim.switchWeapon();
    expect(sim.player.rifleAmmo).toBe(3);
    expect(sim.player.ammo).toBe(3);
  });
  it('18. Hold failure handling & interactive retry state transition', () => {
    // A) Enter hold and advance to corridor
    for (let t = 1; t <= 180; t++) {
      sim.exfilController.onTick(t, true, 'lz_sector7_charlie', 0);
    }
    expect(sim.exfilController.getState().kind).toBe('corridor_presentation');

    // B) Fast forward corridor clock to finish duration
    const fakeClockNow = (sim.exfilController as any).state.startedAtMs + 2600;
    (sim.exfilController as any).clock = { now: () => fakeClockNow };

    // C) Transition to submitting_settlement
    sim.exfilController.submitSettlement();
    expect(sim.exfilController.getState().kind).toBe('submitting_settlement');

    // D) When authority verification fails, onFailure smoothly transitions to failed
    sim.exfilController.onFailure('Relay authority hold verification required but not confirmed', true);
    const failedState = sim.exfilController.getState();
    expect(failedState.kind).toBe('failed');
    expect((failedState as any).canRetry).toBe(true);

    // E) Operative can retry without error, returning to submitting_settlement
    sim.exfilController.retrySettlement();
    expect(sim.exfilController.getState().kind).toBe('submitting_settlement');
  });

  it('19. Fatal damage during extraction and elimination invariant', async () => {
    sim.player.health = 20;
    sim.player.armor = 0;
    sim.player.isInvulnerable = false;
    sim.player.isAlive = true;
    for (let t = 1; t <= 50; t++) {
      sim.exfilController.onTick(t, true, 'lz_sector7_charlie', 0);
    }

    // Operative takes fatal 50 damage
    sim.applyDamageToPlayer(50);
    expect(sim.player.health).toBe(0);
    expect(sim.player.isAlive).toBe(false);

    // Authoritative commit MUST reject eliminated operative
    await expect(authoritativeLedgerCommit(sim as any)).rejects.toThrow(/Cannot commit settlement: Operative .* is K.I.A./);
  });

  it('20. Unified bunker radius and authority hold custody restoration', () => {
    // A) Unified 6.0m bunker radius check
    sim.player.hasKeycard = true;
    sim.player.x = -45;
    sim.player.z = -45 + 5.5; // dist = 5.5m <= 6.0m
    expect(sim.isPlayerInExfilZone()).toBe(true);

    sim.player.z = -45 + 6.5; // dist = 6.5m > 6.0m
    expect(sim.isPlayerInExfilZone()).toBe(false);

    // B) Authority custody adoption: confirmed hold sets serverHoldCompletedAtTick
    sim.restoreExtractionCustody({ holdCompleted: true, holdCompletedAtTick: 240 });
    expect((sim as any).serverHoldCompletedAtTick).toBe(240);

    // C) Authority custody cancellation: holdCompleted: false clears hold and custody
    sim.restoreExtractionCustody({ holdCompleted: false });
    expect((sim as any).serverHoldCompletedAtTick).toBe(0);
    expect(sim.player.isExtracted).toBe(false);
  });
  it('21. Asynchronous digest calculation race and post-await eligibility rejection', async () => {
    const ledger = new AuthoritativeSettlementLedger();
    ledger.registerDeployment(sim.player.id, sim.raidId);
    sim.player.health = 100;
    sim.player.isAlive = true;
    sim.player.cash = 1250;
    (sim.exfilController as any).state = { kind: 'submitting_settlement' };

    // Start commit
    const commitPromise = ledger.commitSettlement({
      tick: 200,
      player: sim.player as any,
      exfilController: sim.exfilController,
      raidId: sim.raidId,
      rivals: [],
    });

    // Fatal damage occurs during async calculation
    sim.player.health = 0;
    sim.player.isAlive = false;

    // Must reject and NOT write to ledger
    await expect(commitPromise).rejects.toThrow(/Cannot commit settlement: Operative .* is K.I.A./);

    // Ledger auditLog must remain empty and raid unsettled
    expect(ledger.auditLog.size).toBe(0);
    expect(ledger.settledRaids.has(`${sim.raidId}:${sim.player.id}`)).toBe(false);
  });

  it('22. Network machine and rival trauma starts heavy arterial bleeding', () => {
    const coord = new MultiplayerCoordinator(sim);
    sim.player.armor = 0;
    sim.player.health = 100;
    sim.player.isBleeding = false;

    // Authoritative machine attack with damage >= 12 on unarmored player
    coord.handleMessage({
      eventId: 'evt_mach_attack_bleed',
      type: 'machine_attack',
      senderId: 'server',
      senderName: 'SYSTEM RELAY',
      squad: 'SYSTEM',
      timestamp: Date.now(),
      raidId: sim.raidId,
      serverAuthoritative: true,
      data: {
        machineId: 'turret_01',
        machineType: 'turret',
        targetId: sim.player.id,
        damage: 12,
        targetHealth: 88,
        targetArmor: 0,
        targetAlive: true,
      },
    } as any);

    expect(sim.player.health).toBe(88);
    expect(sim.player.isBleeding).toBe(true); // Symmetrical heavy bleed on network damage!

    coord.cleanup();
  });

  it('23. Strict custody packet validation and operative binding', () => {
    const coord = new MultiplayerCoordinator(sim);
    (sim as any).serverHoldCompletedAtTick = 0;

    // A) Missing holdCompleted is NOT treated as true
    coord.handleMessage({
      eventId: 'evt_hold_invalid_1',
      type: 'hold_result',
      senderId: 'server',
      senderName: 'SYSTEM RELAY',
      squad: 'SYSTEM',
      timestamp: Date.now(),
      serverAuthoritative: true,
      data: {
        holdCompletedAtTick: 180, // missing holdCompleted: true
      },
    } as any);
    expect((sim as any).serverHoldCompletedAtTick).toBe(0);

    // B) Packet bound to a DIFFERENT operative is ignored
    coord.handleMessage({
      eventId: 'evt_hold_diff_op',
      type: 'hold_result',
      senderId: 'server',
      senderName: 'SYSTEM RELAY',
      squad: 'SYSTEM',
      timestamp: Date.now(),
      serverAuthoritative: true,
      data: {
        operativeId: 'op_bravo_99',
        holdCompleted: true,
        holdCompletedAtTick: 180,
      },
    } as any);
    expect((sim as any).serverHoldCompletedAtTick).toBe(0);

    // C) Valid packet bound to this operative adopts custody
    coord.handleMessage({
      eventId: 'evt_hold_valid',
      type: 'hold_result',
      senderId: 'server',
      senderName: 'SYSTEM RELAY',
      squad: 'SYSTEM',
      timestamp: Date.now(),
      serverAuthoritative: true,
      data: {
        operativeId: sim.player.id,
        holdCompleted: true,
        holdCompletedAtTick: 180,
      },
    } as any);
    expect((sim as any).serverHoldCompletedAtTick).toBe(180);

    // D) Explicit holdCompleted: false clears custody
    coord.handleMessage({
      eventId: 'evt_hold_cancel',
      type: 'hold_result',
      senderId: 'server',
      senderName: 'SYSTEM RELAY',
      squad: 'SYSTEM',
      timestamp: Date.now(),
      serverAuthoritative: true,
      data: {
        operativeId: sim.player.id,
        holdCompleted: false,
      },
    } as any);
    expect((sim as any).serverHoldCompletedAtTick).toBe(0);

    coord.cleanup();
  });

  it('24. Public authoritativeLedgerCommit checks live elimination through public function', async () => {
    const ledger = new AuthoritativeSettlementLedger();
    ledger.registerDeployment(sim.player.id, sim.raidId);
    sim.tick = 270;
    sim.freezeSettlementSnapshot(270);
    sim.player.health = 100;
    sim.player.isAlive = true;
    sim.player.cash = 1250;
    (sim.exfilController as any).state = { kind: 'submitting_settlement' };

    // Invoke public authoritativeLedgerCommit function
    const commitPromise = authoritativeLedgerCommit(sim, ledger);

    // Fatal damage occurs during async calculation
    sim.player.health = 0;
    sim.player.isAlive = false;

    // Must reject through public function and NOT commit
    await expect(commitPromise).rejects.toThrow(/Cannot commit settlement: Operative .* is K.I.A./);
    expect(ledger.auditLog.size).toBe(0);
    expect(ledger.settledRaids.has(`${sim.raidId}:${sim.player.id}`)).toBe(false);
  });

  it('25. Flanking container cover: movement collision and ray obstruction', () => {
    // Flanking stack at x = -10.5, z = -25 (box minX: -12.5, maxX: -8.5, minZ: -28.5, maxZ: -21.5)
    // 1. Movement collision directly obstructs entry
    expect(sim.checkContainerCollision(-5.8, -25.0, 0.45)).toBe(true);
    expect(sim.getBlockingContainerIndex(-5.8, -25.0, 0.45)).toBeGreaterThanOrEqual(0);

    // 2. Shot ray across the flanking container is obstructed
    const isObstructed = sim.checkContainerRayObstruction(-3.0, -25.0, -8.0, -25.0, 1.0, 1.0);
    expect(isObstructed).toBe(true);

    // Open corridor at x = 0 is unobstructed
    expect(sim.checkContainerCollision(0.0, -25.0, 0.45)).toBe(false);
    expect(sim.checkContainerRayObstruction(0.0, -20.0, 0.0, -30.0, 1.0, 1.0)).toBe(false);
  });

  it('26. Stim treatment channel interrupted on abrupt sprinting or running movement', () => {
    sim.machines = [];
    sim.rivals = [];
    sim.player.health = 40;
    sim.player.isBleeding = true;
    sim.player.stimsRemaining = 2;

    // 1. Stim administration rejected during active roll state
    sim.player.action = 'roll';
    sim.player.actionTicks = 12;
    expect(sim.useStim()).toBe(false);
    expect(sim.player.isUsingStim).toBe(false);

    // 2. Return to idle -> stim administration succeeds
    sim.player.action = 'idle';
    sim.player.actionTicks = 0;
    expect(sim.useStim()).toBe(true);
    expect(sim.player.isUsingStim).toBe(true);
    expect(sim.player.stimChannelTicks).toBe(60);

    // 3. Step during an ongoing roll state (without explicit input.roll) interrupts treatment
    sim.player.action = 'roll';
    sim.player.actionTicks = 8;
    sim.step(makeInput({ dx: 0, dz: 0, sprint: false }));

    expect(sim.player.isUsingStim).toBe(false);
    expect(sim.player.stimChannelTicks).toBe(0);
    expect(sim.player.stimsRemaining).toBe(2); // Stim not consumed
    expect(sim.player.health).toBe(40); // Not healed
    expect(sim.player.isBleeding).toBe(true); // Still bleeding
    expect(sim.combatLog.some(msg => msg.includes('abrupt movement'))).toBe(true);

    // 4. Sprint movement also interrupts
    sim.player.action = 'idle';
    sim.useStim();
    expect(sim.player.isUsingStim).toBe(true);
    sim.step(makeInput({ dx: 1, dz: 0, sprint: true }));
    expect(sim.player.isUsingStim).toBe(false);
  });

  it('27. Extraction custody cancellation clears frozen settlement cash snapshot', () => {
    sim.player.cash = 3000;
    sim.freezeSettlementSnapshot(200);
    expect(sim.frozenSettlementCash).toBe(3000);

    // Server sends custody cancellation (holdCompleted: false)
    sim.restoreExtractionCustody({ holdCompleted: false });

    // Must clear frozen settlement snapshot so subsequent settlements don't use stale cash
    expect(sim.frozenSettlementCash).toBeUndefined();
    expect(sim.frozenSettlementTick).toBeUndefined();
  });

  it('28. ServerSettlementAdapter connects simulation settlement to server audit log and receipt verification', async () => {
    const tempStorePath = path.join(os.tmpdir(), `settlement_store_spec28_${Date.now()}.json`);
    const serverAuth = new ServerSettlementAuthority(tempStorePath);
    const raidId = "raid_sector7_spec28";
    serverAuth.initRaid(raidId, 50000, ["op_player", "op_alpha_1", "op_bravo_1"]);
    const adapter = new ServerSettlementAdapter(serverAuth);

    sim.raidId = raidId;
    sim.player.id = "op_player";
    sim.settlementAuthority = adapter;
    adapter.registerDeployment(sim.player.id, sim.raidId);
    sim.tick = 270;
    sim.freezeSettlementSnapshot(270);
    sim.player.health = 100;
    sim.player.isAlive = true;
    sim.player.x = 45.0;
    sim.player.z = 45.0;
    (sim.exfilController as any).state = { kind: 'corridor_presentation', currentTicks: 180 };

    // 1. Operative legitimately loots crate_01 ($1250) in server authority custody
    sim.crates[0].opened = true;
    sim.crates[0].claimedBy = "op_player";
    sim.crates[0].cashValue = 1250;
    sim.player.cash = 1250;
    const lootSuccess = serverAuth.recordCrateLoot(raidId, "crate_01", "op_player", 1250, Date.now());
    expect(lootSuccess).toBe(true);

    // 2. Operative legitimately completes 180-tick continuous extraction hold in server custody (no completion overrides)
    for (let step = 1; step <= 65; step++) {
      const t = 2000 + step * 50;
      const currentTick = 70 + step * 3;
      const holdTicks = step * 3;
      serverAuth.recordExtractionHold(raidId, "op_player", holdTicks, currentTick, {
        inZone: true,
        x: 45.0,
        z: 45.0,
        timestamp: t,
      });
    }
    const raidRec = serverAuth.getRaidRecord(raidId);
    expect(raidRec?.operatives["op_player"].holdCompleted).toBe(true);

    // 3. Commit through ServerSettlementAdapter -> executes authentic serverAuthority.commitSettlement
    const { receipt, outcomePayload } = await authoritativeLedgerCommit(sim, adapter);
    expect(receipt).toBeDefined();
    expect(receipt.receiptId).toBeDefined();

    // 4. Verified directly in authentic server authority audit log
    expect(serverAuth.hasCommittedReceipt(receipt.receiptId)).toBe(true);
    const srvRecord = serverAuth.getCommittedReceipt(receipt.receiptId);
    expect(srvRecord).toBeDefined();
    expect(srvRecord?.receipt.receiptId).toBe(receipt.receiptId);

    // 5. Receipt verification passes against server authority
    const ver = await verifySettlementReceipt(receipt, outcomePayload, adapter);
    expect(ver.valid).toBe(true);

    // 6. Persistence & Server Restart Recovery verification
    serverAuth.saveToDisk();
    expect(fs.existsSync(tempStorePath)).toBe(true);

    // Instantiate new ServerSettlementAuthority from stored disk path (clean server restart)
    const restartedServerAuth = new ServerSettlementAuthority(tempStorePath);
    expect(restartedServerAuth.hasCommittedReceipt(receipt.receiptId)).toBe(true);
    const restartedRecord = restartedServerAuth.getCommittedReceipt(receipt.receiptId);
    expect(restartedRecord).toBeDefined();
    expect(restartedRecord?.receipt.receiptId).toBe(receipt.receiptId);
    expect(restartedRecord?.receipt.outcomeDigest).toBe(receipt.outcomeDigest);

    const restartedAdapter = new ServerSettlementAdapter(restartedServerAuth);
    const restartedVer = await verifySettlementReceipt(receipt, outcomePayload, restartedAdapter);
    if (!restartedVer.valid) console.log("RESTARTED VER REASON:", restartedVer.reason);
    expect(restartedVer.valid).toBe(true);

    // 7. Idempotent receipt recovery & duplicate raid settlement rejection after restart
    const dupRes = await restartedServerAuth.commitSettlement({
      raidId,
      extractingId: "op_player",
      snapshotTick: 270,
      snapshotCash: 1250,
      exfilSubmitted: true,
    });
    expect(dupRes.receipt.receiptId).toBe(receipt.receiptId);
    expect(dupRes.receipt.outcomeDigest).toBe(receipt.outcomeDigest);

    expect(() => {
      restartedServerAuth.initRaid(raidId, 50000, ["op_player"]);
    }).toThrow(/already settled or concluded/i);

    // 8. Real WebSocket transport verification: token authentication, submission, and lost-reply recovery
    const rRec = restartedServerAuth.getRaidRecord(raidId);
    if (rRec) { rRec.createdAtMs = Date.now() - 15000; }
    restartedServerAuth.recordCrateLoot(raidId, "crate_02", "op_alpha_1", 2400, Date.now());
    for (let step = 1; step <= 65; step++) {
      restartedServerAuth.recordExtractionHold(raidId, "op_alpha_1", step * 3, 70 + step * 3, {
        inZone: true,
        x: 45.0,
        z: 45.0,
        timestamp: 4000 + step * 50,
      });
    }

    const testServer = createStickZoneServer(restartedServerAuth);
    await new Promise<void>((resolve) => testServer.listen(0, resolve));
    const port = (testServer.address() as any).port;
    const wsUrl = `ws://localhost:${port}/syncplay-ws`;

    // 8a. Connect with valid authority-issued token
    const alphaToken = restartedServerAuth.getSessionToken(raidId, "op_alpha_1");
    expect(alphaToken).toBeDefined();

    const wsAlpha = new WebSocket(`${wsUrl}?token=${alphaToken}&raidId=${raidId}`);
    const alphaMessages: any[] = [];
    wsAlpha.on("message", (raw) => {
      try { alphaMessages.push(JSON.parse(raw.toString())); } catch {}
    });

    await new Promise<void>((resolve, reject) => {
      wsAlpha.on("open", resolve);
      wsAlpha.on("error", reject);
    });

    // Verify auth_success arrives
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (alphaMessages.some((m) => m.type === "auth_success")) {
          clearInterval(check);
          resolve();
        }
      }, 20);
    });

    // 8b. Submit settlement_commit over real WebSocket transport
    const commitEventId = `evt_commit_ws_${Date.now()}`;
    wsAlpha.send(JSON.stringify({
      type: "settlement_commit",
      eventId: commitEventId,
      raidId,
      data: {
        tick: 280,
        cash: 2400,
        exfilSubmitted: true,
      },
    }));

    // Wait for settlement_committed response matching eventId
    const committedMsg = await new Promise<any>((resolve) => {
      const check = setInterval(() => {
        const found = alphaMessages.find((m) => m.type === "settlement_committed" && m.eventId === commitEventId);
        if (found) {
          clearInterval(check);
          resolve(found);
        }
      }, 20);
    });
    expect(committedMsg).toBeDefined();
    expect(committedMsg.data.receipt).toBeDefined();
    expect(restartedServerAuth.hasCommittedReceipt(committedMsg.data.receipt.receiptId)).toBe(true);

    // Close socket to simulate client disconnect / lost connection
    wsAlpha.close();

    // 8c. Lost-reply recovery: extracted operative reconnects over real WebSocket
    const wsRecovery = new WebSocket(`${wsUrl}?token=${alphaToken}&raidId=${raidId}`);
    const recoveryMessages: any[] = [];
    wsRecovery.on("message", (raw) => {
      try { recoveryMessages.push(JSON.parse(raw.toString())); } catch {}
    });

    await new Promise<void>((resolve, reject) => {
      wsRecovery.on("open", resolve);
      wsRecovery.on("error", reject);
    });

    // Server must NOT disconnect with 4003; instead delivers recovery packet!
    const recPkt = await new Promise<any>((resolve) => {
      const check = setInterval(() => {
        const found = recoveryMessages.find((m) => m.type === "settlement_committed");
        if (found) {
          clearInterval(check);
          resolve(found);
        }
      }, 20);
    });
    expect(recPkt).toBeDefined();
    expect(recPkt.data.receipt.receiptId).toBe(committedMsg.data.receipt.receiptId);
    expect(wsRecovery.readyState).toBe(1);

    wsRecovery.close();
    await new Promise<void>((resolve) => testServer.close(() => resolve()));

    // 9. Receipt missing from server authority audit log is rejected
    restartedServerAuth.deleteReceiptForTesting(receipt.receiptId);
    const serverPurgedVer = await verifySettlementReceipt(receipt, outcomePayload, restartedAdapter);
    expect(serverPurgedVer.valid).toBe(false);
    expect(serverPurgedVer.reason).toMatch(/Receipt not found in server settlement audit record/);

    try { fs.unlinkSync(tempStorePath); } catch {}
  }, 15000);

  it("29. Join endpoint session ownership prevents unauthorized token theft", async () => {
    const tempStorePath = path.join(os.tmpdir(), `settlement_store_spec29_${Date.now()}.json`);
    const serverAuth = new ServerSettlementAuthority(tempStorePath);
    const raidId = "raid_sector7_spec29";
    serverAuth.initRaid(raidId, 50000, ["op_player", "op_alpha_1", "op_bravo_1"]);
    const testServer = createStickZoneServer(serverAuth);
    await new Promise<void>((resolve) => testServer.listen(0, resolve));
    const port = (testServer.address() as any).port;

    const http = await import("http");
    function postJoin(body: any, headers: Record<string, string> = {}) {
      return new Promise<{ status: number; data: any }>((resolve, reject) => {
        const payload = JSON.stringify(body);
        const req = http.request({
          hostname: "127.0.0.1",
          port,
          path: "/api/settlement/join",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
            ...headers,
          },
        }, (res) => {
          let chunks = "";
          res.on("data", (d) => chunks += d);
          res.on("end", () => {
            try {
              resolve({ status: res.statusCode || 0, data: JSON.parse(chunks) });
            } catch {
              resolve({ status: res.statusCode || 0, data: chunks });
            }
          });
        });
        req.on("error", reject);
        req.write(payload);
        req.end();
      });
    }

    // 1. Initial join for op_player succeeds and yields token + resumeKey
    const initialJoin = await postJoin({ raidId, operativeId: "op_player" });
    expect(initialJoin.status).toBe(200);
    expect(initialJoin.data.token).toBeDefined();
    expect(initialJoin.data.resumeKey).toBeDefined();
    const legitimateToken = initialJoin.data.token;
    const legitimateResumeKey = initialJoin.data.resumeKey;

    // 2. Unauthenticated stranger attempts to claim op_player without resumeKey -> 409 Rejected!
    const unauthTheft = await postJoin({ raidId, operativeId: "op_player" });
    expect(unauthTheft.status).toBe(409);
    expect(unauthTheft.data.error).toMatch(/Operative slot already claimed/);

    // 3. Legitimate client resumes with valid resumption key -> 200 OK with same token
    const resumeWithKey = await postJoin(
      { raidId, operativeId: "op_player" },
      { "x-resumption-key": legitimateResumeKey }
    );
    expect(resumeWithKey.status).toBe(200);
    expect(resumeWithKey.data.token).toBe(legitimateToken);
    expect(resumeWithKey.data.resumed).toBe(true);

    await new Promise<void>((resolve) => testServer.close(() => resolve()));
    try { fs.unlinkSync(tempStorePath); } catch {}
  });

  it("30. Receipt recovery succeeds over WebSocket even after raid conclusion", async () => {
    const tempStorePath = path.join(os.tmpdir(), `settlement_store_spec30_${Date.now()}.json`);
    const serverAuth = new ServerSettlementAuthority(tempStorePath);
    const raidId = "raid_sector7_spec30";
    serverAuth.initRaid(raidId, 50000, ["op_player", "op_alpha_1", "op_bravo_1"]);
    const alphaToken = serverAuth.getSessionToken(raidId, "op_alpha_1")!;

    // Record verified continuous hold for op_alpha_1
    const rOp = serverAuth.getRaidRecord(raidId)!.operatives["op_alpha_1"];
    rOp.holdCompleted = true;
    rOp.holdCompletedAtTick = 200;

    // Commit extraction for op_alpha_1
    const commitRes = await serverAuth.commitSettlement({
      raidId,
      extractingId: "op_alpha_1",
      snapshotTick: 300,
      snapshotCash: 0,
      exfilSubmitted: true,
    });
    const receipt = commitRes.receipt;
    expect(receipt).toBeDefined();

    // Now conclude the raid entirely!
    serverAuth.concludeRaid(raidId);
    expect(serverAuth.getRaidRecord(raidId)?.status).toBe("concluded");

    const testServer = createStickZoneServer(serverAuth);
    await new Promise<void>((resolve) => testServer.listen(0, resolve));
    const port = (testServer.address() as any).port;
    const wsUrl = `ws://localhost:${port}/syncplay-ws?token=${alphaToken}&raidId=${raidId}`;

    const ws = new WebSocket(wsUrl);
    const receivedMessages: any[] = [];
    ws.on("message", (raw) => {
      try { receivedMessages.push(JSON.parse(raw.toString())); } catch {}
    });

    await new Promise<void>((resolve, reject) => {
      ws.on("open", resolve);
      ws.on("error", reject);
    });

    // Server must NOT disconnect with 4003; instead delivers receipt recovery packet!
    const recPkt = await new Promise<any>((resolve) => {
      const check = setInterval(() => {
        const found = receivedMessages.find((m) => m.type === "settlement_committed");
        if (found) {
          clearInterval(check);
          resolve(found);
        }
      }, 20);
    });

    expect(recPkt).toBeDefined();
    expect(recPkt.recovery).toBe(true);
    expect(recPkt.data.receipt.receiptId).toBe(receipt.receiptId);
    expect(recPkt.data.outcomePayload).toBeDefined();

    // Verify recovery receipt and outcomePayload validation against server audit ledger
    const verification = await verifySettlementReceipt(recPkt.data.receipt, recPkt.data.outcomePayload, serverAuth as any);
    expect(verification.valid).toBe(true);

    // Verify auth_success was delivered alongside recovery packet so client completes auth
    const authSuccessPkt = receivedMessages.find((m) => m.type === "auth_success");
    expect(authSuccessPkt).toBeDefined();
    expect(authSuccessPkt.data.admitted).toBe(true);
    expect(ws.readyState).toBe(1);

    // Test that the actual MultiplayerCoordinator observes the 5,000ms authentication deadline
    const { MultiplayerCoordinator } = await import("../src/sim/multiplayer.js");
    const testSim = new SectorDepotSimulation("raid_spec30_auth", "spoke");
    testSim.settlementAuthority = serverAuth as any;
    const coord = new MultiplayerCoordinator(testSim);
    coord.wsUrl = `ws://127.0.0.1:${port}/syncplay-ws`;
    coord.connectWebSocket(alphaToken);
    await new Promise((resolve) => {
      if ((coord.ws as any).readyState === 1) return resolve(undefined);
      const origOpen = (coord.ws as any).onopen;
      (coord.ws as any).onopen = (evt: any) => {
        origOpen?.(evt);
        resolve(undefined);
      };
    });

    // Feed recovery messages to coord: auth_success and settlement_committed
    await (coord.ws as any).onmessage({ data: JSON.stringify(authSuccessPkt) });
    await (coord.ws as any).onmessage({ data: JSON.stringify(recPkt) });
    expect(coord.authenticated).toBe(true);

    // Advance beyond the 5000ms authentication deadline (e.g. 6000ms) with active server traffic
    const now = Date.now();
    coord.lastServerMessageTime = now + 6000;
    coord.update(now + 6000);
    // Authenticated coordinator remains active and connected past deadline
    expect(coord.authenticated).toBe(true);
    expect(coord.isConnectionActive).toBe(true);
    expect((coord.ws as any)?.readyState).toBe(1);

    // Conversely, verify unauthenticated coordinator is force-closed when exceeding 5000ms deadline
    const unauthSim = new SectorDepotSimulation("raid_spec30_unauth", "spoke");
    const unauthCoord = new MultiplayerCoordinator(unauthSim);
    unauthCoord.ws = { readyState: 1, close: vi.fn() } as any;
    unauthCoord.isConnectionActive = true;
    (unauthCoord as any).connectionStartTime = now;
    expect(unauthCoord.authenticated).toBe(false);

    unauthCoord.update(now + 5500);
    expect(unauthCoord.isConnectionActive).toBe(false);
    expect(unauthSim.isSocketDisconnected).toBe(true);
    expect((unauthCoord.ws as any)?.close).toHaveBeenCalledWith(4008, "Authentication timeout: connection stalled before auth");
    coord.cleanup();

    ws.close();
    await new Promise<void>((resolve) => testServer.close(() => resolve()));
    try { fs.unlinkSync(tempStorePath); } catch {}
  });

  it("31. Verified receipt acceptance executes once and preserves submitting state until verified", async () => {
    const { MultiplayerCoordinator } = await import("../src/sim/multiplayer.js");
    class MockTransport {
      readyState = 1;
      send() {}
      close() { (this as any).readyState = 3; }
    }
    const origWs = (globalThis as any).WebSocket;
    (globalThis as any).WebSocket = MockTransport;

    try {
      // Subcase A: Retry followed by unsolicited recovery packet
      const simA = new SectorDepotSimulation("raid_round21_retry", "spoke");
      const ledgerA = new AuthoritativeSettlementLedger();
      simA.settlementAuthority = ledgerA;
      ledgerA.registerDeployment(simA.player.id, simA.raidId);
      ledgerA.registerDeployment("op_bravo_1", simA.raidId);
      simA.tick = 200;
      (simA.exfilController as any).state = { kind: "submitting_settlement" };
      const commitA = await ledgerA.commitSettlement(simA);

      const coordA = new MultiplayerCoordinator(simA);
      let countA = 0;
      simA.onExfilSuccess = () => { countA++; };

      // Manual retry success
      simA.exfilController.onReceipt(commitA.receipt);
      simA.player.isExtracted = true;
      simA.onExfilSuccess(commitA.receipt);
      expect(countA).toBe(1);

      // Connect coordinator to real handler
      coordA.wsUrl = "ws://local-contract";
      coordA.connectWebSocket("local-contract");
      expect(typeof (coordA.ws as any).onmessage).toBe("function");

      const dispatchA = () => (coordA.ws as any).onmessage({
        data: JSON.stringify({ type: "settlement_committed", senderId: "server", serverAuthoritative: true, recovery: true, data: commitA }),
      });

      // Deliver duplicate recovery packets
      await dispatchA();
      await new Promise((r) => setTimeout(r, 50));
      await dispatchA();
      await new Promise((r) => setTimeout(r, 50));

      expect(countA).toBe(1); // Strictly 1 callback: retry recorded receipt key, dropping duplicate recoveries
      expect(coordA.authenticated).toBe(true);
      expect(simA.exfilController.getState().kind).toBe("extracted");
      coordA.cleanup();

      // Subcase B: Duplicate recovery alone without prior retry
      const simB = new SectorDepotSimulation("raid_round21_duplicate", "spoke");
      const ledgerB = new AuthoritativeSettlementLedger();
      simB.settlementAuthority = ledgerB;
      ledgerB.registerDeployment(simB.player.id, simB.raidId);
      ledgerB.registerDeployment("op_bravo_1", simB.raidId);
      simB.tick = 200;
      (simB.exfilController as any).state = { kind: "submitting_settlement" };
      const commitB = await ledgerB.commitSettlement(simB);

      const coordB = new MultiplayerCoordinator(simB);
      let countB = 0;
      simB.onExfilSuccess = () => { countB++; };

      coordB.wsUrl = "ws://local-contract";
      coordB.connectWebSocket("local-contract");
      expect(typeof (coordB.ws as any).onmessage).toBe("function");

      const dispatchB = () => (coordB.ws as any).onmessage({
        data: JSON.stringify({ type: "settlement_committed", senderId: "server", serverAuthoritative: true, recovery: true, data: commitB }),
      });

      // Deliver first recovery packet
      await dispatchB();
      await new Promise((r) => setTimeout(r, 50));
      expect(countB).toBe(1);

      // Deliver duplicate recovery packet
      await dispatchB();
      await new Promise((r) => setTimeout(r, 50));
      expect(countB).toBe(1); // Exactly 1 callback

      expect(coordB.authenticated).toBe(true);
      expect(simB.exfilController.getState().kind).toBe("extracted");
      coordB.cleanup();
    } finally {
      (globalThis as any).WebSocket = origWs;
    }
  });

  it("32. Server relay accepts shotgun damage on both operatives and machines over real WebSocket transport", async () => {
    const tempStorePath = path.join(os.tmpdir(), `stick_store_spec32_${Date.now()}.json`);
    const serverAuth = new ServerSettlementAuthority(tempStorePath);
    const raidId = "raid_spec32_shotgun";

    serverAuth.initRaid(raidId, 50000, ["op_alpha_1", "op_bravo_1"]);
    const rRec = serverAuth.getRaidRecord(raidId)!;
    rRec.operatives["op_alpha_1"].lastObservedX = 0;
    rRec.operatives["op_alpha_1"].lastObservedZ = 0;
    rRec.operatives["op_bravo_1"].lastObservedX = 0;
    rRec.operatives["op_bravo_1"].lastObservedZ = 5;

    const alphaToken = serverAuth.getSessionToken(raidId, "op_alpha_1")!;
    const bravoToken = serverAuth.getSessionToken(raidId, "op_bravo_1")!;

    const testServer = createStickZoneServer(serverAuth);
    await new Promise<void>((resolve) => testServer.listen(0, resolve));
    const port = (testServer.address() as any).port;

    const wsAlpha = new WebSocket(`ws://localhost:${port}/syncplay-ws?token=${alphaToken}&raidId=${raidId}`);
    const wsBravo = new WebSocket(`ws://localhost:${port}/syncplay-ws?token=${bravoToken}&raidId=${raidId}`);

    const alphaMsgs: any[] = [];
    const bravoMsgs: any[] = [];
    wsAlpha.on("message", (raw) => { try { alphaMsgs.push(JSON.parse(raw.toString())); } catch {} });
    wsBravo.on("message", (raw) => { try { bravoMsgs.push(JSON.parse(raw.toString())); } catch {} });

    await Promise.all([
      new Promise<void>((resolve) => wsAlpha.on("open", resolve)),
      new Promise<void>((resolve) => wsBravo.on("open", resolve)),
    ]);

    // Send state from Bravo to establish position at (0, 5)
    wsBravo.send(JSON.stringify({
      type: "state",
      senderId: "op_bravo_1",
      raidId,
      timestamp: Date.now(),
      data: { x: 0, z: 5, facing: 0, health: 100, armor: 100, isAlive: true, ammo: 30 }
    }));
    // Send state from Alpha to establish position at (0, 0) facing 0 (towards Bravo)
    wsAlpha.send(JSON.stringify({
      type: "state",
      senderId: "op_alpha_1",
      raidId,
      timestamp: Date.now(),
      data: { x: 0, z: 0, facing: 0, health: 100, armor: 100, isAlive: true, ammo: 8 }
    }));
    await new Promise((r) => setTimeout(r, 100));

    // 1. Alpha fires shotgun at Bravo: dist = 5.0m, kind = "shotgun", dmg = 45
    wsAlpha.send(JSON.stringify({
      eventId: "evt_shotgun_operative_1",
      type: "hit",
      senderId: "op_alpha_1",
      raidId,
      timestamp: Date.now(),
      data: {
        targetId: "op_bravo_1",
        damage: 45,
        kind: "shotgun",
        attackerFacing: 0,
        attackerX: 0,
        attackerZ: 0,
      }
    }));
    await new Promise((r) => setTimeout(r, 150));

    // Bravo should receive authoritative hit with armor reduced by 45
    const bravoHit = bravoMsgs.find((m) => m.type === "hit" && m.data?.kind === "shotgun");
    expect(bravoHit).toBeDefined();
    expect(bravoHit.data.targetArmor).toBe(55); // 100 - 45 = 55
    expect(bravoHit.data.targetHealth).toBe(100);

    // Allow shotgun cadence token bucket to replenish (shotgun cadence interval = 350ms)
    await new Promise((r) => setTimeout(r, 400));

    // 2. Alpha fires shotgun at Turret Alpha (turret_depot_alpha at -5, 12)
    const facingTurret = Math.atan2(-5, 12);
    wsAlpha.send(JSON.stringify({
      eventId: "evt_shotgun_machine_1",
      type: "machine_hit",
      senderId: "op_alpha_1",
      raidId,
      timestamp: Date.now(),
      data: {
        machineId: "turret_depot_alpha",
        damage: 50,
        kind: "shotgun",
        attackerFacing: facingTurret,
      }
    }));
    await new Promise((r) => setTimeout(r, 150));

    const machHit = alphaMsgs.find((m) => m.type === "machine_hit" && m.data?.kind === "shotgun" && !m.data?.rejected);
    expect(machHit).toBeDefined();
    expect(machHit.data.rejected).toBeFalsy();
    expect(machHit.data.machineHealth).toBeLessThan(120);

    wsAlpha.close();
    wsBravo.close();
    await new Promise<void>((resolve) => testServer.close(() => resolve()));
    try { fs.unlinkSync(tempStorePath); } catch {}
  }, 15000);

  it("33. All playable depot crates verify and settle with identical values across client and server authority", async () => {
    const authority = new ServerSettlementAuthority();
    for (const crateId of ["crate_01", "crate_02", "crate_03", "crate_04", "crate_05"]) {
      const raidId = "raid_spec33_" + crateId;
      const sim = new SectorDepotSimulation(raidId, "spoke");
      sim.admitOperative(0);
      authority.initRaid(raidId, 50000, [sim.player.id, "op_alpha_1", "op_bravo_1"]);

      const crate = sim.crates.find((c) => c.id === crateId);
      expect(crate).toBeDefined();
      sim.player.x = crate!.x;
      sim.player.z = crate!.z;

      const localAccepted = sim.claimCrateLocally(crateId, sim.player.id, Date.now());
      expect(localAccepted).toBe(true);

      const serverAccepted = authority.recordCrateLoot(raidId, crateId, sim.player.id, crate!.cashValue, Date.now());
      expect(serverAccepted).toBe(true);

      const now = Date.now();
      let hold: any;
      for (let i = 0; i <= 200; i++) {
        hold = authority.recordExtractionHold(raidId, sim.player.id, i + 1, 600 + i, {
          inZone: true,
          x: 45,
          z: 45,
          simTickAdvancement: true,
          timestamp: now + i * 17,
        });
      }
      expect(hold.holdCompleted).toBe(true);

      const commit = await authority.commitSettlement({
        raidId,
        extractingId: sim.player.id,
        snapshotTick: 900,
        snapshotCash: sim.player.cash,
        exfilSubmitted: true,
        simTickAdvancement: true,
      });
      expect(commit).toBeDefined();
      expect(commit.receipt).toBeDefined();
      expect(commit.outcomePayload.cashBanked).toBe(crate!.cashValue);

      const verification = await verifySettlementReceipt(commit.receipt, commit.outcomePayload, authority as any);
      expect(verification.valid).toBe(true);
    }
  });

  it("34. Weapon selection 1/2 and Q do not trigger false shot events or broadcast fire", () => {
    const sim = new SectorDepotSimulation("raid_spec34_weapons", "spoke");
    sim.admitOperative(0);
    expect(sim.player.weapon).toBe("rifle");
    expect(sim.player.ammo).toBe(30);

    // 1. Select shotgun via selectWeapon (key 2)
    sim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: false, interact: false, selectWeapon: "shotgun" });
    expect(sim.player.weapon).toBe("shotgun");
    expect(sim.player.ammo).toBe(8);
    expect(sim.player.lastFiredAtMs).toBeUndefined();
    expect(sim.player.lastFireTick).toBeUndefined();

    // 2. Select rifle via selectWeapon (key 1)
    sim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: false, interact: false, selectWeapon: "rifle" });
    expect(sim.player.weapon).toBe("rifle");
    expect(sim.player.ammo).toBe(30);
    expect(sim.player.lastFiredAtMs).toBeUndefined();
    expect(sim.player.lastFireTick).toBeUndefined();

    // 3. Switch weapon via switchWeapon (key Q)
    sim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: false, interact: false, switchWeapon: true });
    expect(sim.player.weapon).toBe("shotgun");
    expect(sim.player.ammo).toBe(8);
    // Crucial: ammo changed from 30 to 8, but no shot was fired!
    expect(sim.player.lastFiredAtMs).toBeUndefined();
    expect(sim.player.lastFireTick).toBeUndefined();
    // App.tsx uses sim.player.lastFireTick === sim.tick to trigger audio & broadcastFire,
    // so falseShotPredicate (sim.player.ammo < prevAmmo) is eliminated
    const falseShotDetected = sim.player.lastFireTick === sim.tick;
    expect(falseShotDetected).toBe(false);

    // 4. Actual shot fired via shoot: true
    sim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: true, interact: false });
    expect(sim.player.ammo).toBe(7);
    expect(sim.player.lastFiredAtMs).toBeDefined();
    expect(sim.player.lastFireTick).toBe(sim.tick);
    const realShotDetected = sim.player.lastFireTick === sim.tick;
    expect(realShotDetected).toBe(true);
  });
  it("35. One shotgun shell hits multiple targets without dropping secondary hits or double-charging ammo", async () => {
    const tempStorePath = path.join(os.tmpdir(), `stick_store_spec35_${Date.now()}.json`);
    const serverAuth = new ServerSettlementAuthority(tempStorePath);
    const raidId = "raid_spec35_shotgun_multi";

    serverAuth.initRaid(raidId, 50000, ["op_alpha_1", "op_bravo_1"]);
    const rRec = serverAuth.getRaidRecord(raidId)!;
    rRec.operatives["op_alpha_1"].lastObservedX = 0;
    rRec.operatives["op_alpha_1"].lastObservedZ = 0;
    rRec.operatives["op_bravo_1"].lastObservedX = 0;
    rRec.operatives["op_bravo_1"].lastObservedZ = 5;
    (rRec as any).machineDeployment = [
      { id: "turret_depot_alpha", type: "turret", x: -5, y: 0, z: 12, facing: Math.PI, health: 120, isAlive: true },
      { id: "turret_depot_beta", type: "turret", x: 2, y: 0, z: 10, facing: Math.PI, health: 120, isAlive: true },
      { id: "drone_patrol_beta", type: "drone", x: 14, y: 2.2, z: -8, facing: -Math.PI / 2, health: 75, isAlive: true },
    ];

    const alphaToken = serverAuth.getSessionToken(raidId, "op_alpha_1")!;
    const bravoToken = serverAuth.getSessionToken(raidId, "op_bravo_1")!;

    const testServer = createStickZoneServer(serverAuth);
    await new Promise<void>((resolve) => testServer.listen(0, resolve));
    const port = (testServer.address() as any).port;

    const wsAlpha = new WebSocket(`ws://localhost:${port}/syncplay-ws?token=${alphaToken}&raidId=${raidId}`);
    const wsBravo = new WebSocket(`ws://localhost:${port}/syncplay-ws?token=${bravoToken}&raidId=${raidId}`);

    const alphaMsgs: any[] = [];
    const bravoMsgs: any[] = [];
    wsAlpha.on("message", (raw) => { try { alphaMsgs.push(JSON.parse(raw.toString())); } catch {} });
    wsBravo.on("message", (raw) => { try { bravoMsgs.push(JSON.parse(raw.toString())); } catch {} });

    await Promise.all([
      new Promise<void>((resolve) => wsAlpha.on("open", resolve)),
      new Promise<void>((resolve) => wsBravo.on("open", resolve)),
    ]);

    // Position Alpha at (0, 0) and Bravo at (0, 5)
    wsBravo.send(JSON.stringify({
      eventId: "evt_spec35_bravo_state",
      type: "state",
      senderId: "op_bravo_1",
      raidId,
      timestamp: Date.now(),
      data: { x: 0, z: 5, facing: 0, health: 100, armor: 100, isAlive: true, weapon: "shotgun", shotgunAmmo: 8, ammo: 8 }
    }));
    wsAlpha.send(JSON.stringify({
      eventId: "evt_spec35_alpha_state",
      type: "state",
      senderId: "op_alpha_1",
      raidId,
      timestamp: Date.now(),
      data: { x: 0, z: 0, facing: 0, health: 100, armor: 100, isAlive: true, weapon: "shotgun", shotgunAmmo: 8, ammo: 8 }
    }));
    await new Promise((r) => setTimeout(r, 100));

    // Alpha fires ONE shotgun shell that reaches BOTH op_bravo_1 (at 0, 5) and turret_depot_alpha (at -5, 12).
    // Both packets carry the identical shotId.
    const shotId = "shot_spec35_alpha_shell_1";
    const now = Date.now();
    wsAlpha.send(JSON.stringify({
      eventId: "evt_shotgun_multi_op",
      type: "hit",
      senderId: "op_alpha_1",
      raidId,
      timestamp: now,
      data: {
        targetId: "op_bravo_1",
        damage: 40,
        kind: "shotgun",
        shotId,
        attackerFacing: 0,
        attackerX: 0,
        attackerZ: 0,
      }
    }));
    wsAlpha.send(JSON.stringify({
      eventId: "evt_shotgun_multi_mach",
      type: "machine_hit",
      senderId: "op_alpha_1",
      raidId,
      timestamp: now + 5,
      data: {
        machineId: "turret_depot_alpha",
        damage: 40,
        kind: "shotgun",
        shotId,
        attackerFacing: Math.atan2(-5, 12),
      }
    }));

    // Send duplicate hit on the SAME target (op_bravo_1) using the SAME shotId within 15ms (< 150ms shot window):
    // Server must reject this duplicate target hit via target-level deduplication (targetsHit.has(targetId)), NOT expiry!
    wsAlpha.send(JSON.stringify({
      eventId: "evt_shotgun_multi_op_duplicate",
      type: "hit",
      senderId: "op_alpha_1",
      raidId,
      timestamp: now + 15,
      data: {
        targetId: "op_bravo_1",
        damage: 40,
        kind: "shotgun",
        shotId,
        attackerFacing: 0,
        attackerX: 0,
        attackerZ: 0,
      }
    }));

    // Isolated Check 1: Fixed Cone Spread check (zero origin displacement, attackerX: 0, attackerZ: 0 <= 1.5m).
    // Target drone_patrol_beta is in-range (~14.7m <= 18m).
    // The packet explicitly passes attackerFacing aiming directly at the drone, so dotWithPacketFacing = 1.0 >= 0.6.
    // If the server improperly checked packet facing, this hit would pass.
    // BUT the server strictly validates against stored shotRecord.facing = 0 (where dot < 0 < 0.6), strictly rejecting!
    const curRaidTick = serverAuth.getCurrentRaidTick(raidId);
    const droneX = 14 + Math.sin(curRaidTick * 0.012) * 5.0;
    const droneZ = -8 + Math.cos(curRaidTick * 0.012) * 3.5;
    const droneDist = Math.hypot(droneX, droneZ);
    expect(droneDist).toBeLessThanOrEqual(18.0); // Strict in-range precondition
    const packetFacingToDrone = Math.atan2(droneX, droneZ);
    const dotWithPacketFacing = (droneX * Math.sin(packetFacingToDrone) + droneZ * Math.cos(packetFacingToDrone)) / droneDist;
    expect(dotWithPacketFacing).toBeGreaterThanOrEqual(0.6); // Packet facing points straight at drone
    const dotWithStoredFacing0 = (droneX * Math.sin(0) + droneZ * Math.cos(0)) / droneDist;
    expect(dotWithStoredFacing0).toBeLessThan(0.6); // Stored shot facing (0) points outside cone!

    wsAlpha.send(JSON.stringify({
      eventId: "evt_shotgun_multi_mach_outofcone",
      type: "machine_hit",
      senderId: "op_alpha_1",
      raidId,
      timestamp: now + 25,
      data: {
        machineId: "drone_patrol_beta",
        damage: 40,
        kind: "shotgun",
        shotId,
        attackerFacing: packetFacingToDrone, // Points directly at drone
        attackerX: 0,                        // ZERO displacement: stays at original shot origin (0, 0)
        attackerZ: 0,
      }
    }));

    // Isolated Check 2: Origin Displacement check on a target that has NOT been hit by this shell yet!
    // Target turret_depot_beta at (2, 10) is in range (10.2m <= 18m) and directly inside stored shot cone (dot = 0.98 >= 0.6).
    // It has NOT been hit by shotId (targetsHit has only op_bravo_1 and turret_depot_alpha).
    // Attacker claims shifted position (5.0, 0), which is 5.0m displacement from shot origin (0, 0) > 1.5m limit.
    // Server must reject strictly via origin displacement check before duplicate or cone checks!
    const distToTurretBeta = Math.hypot(2, 10);
    expect(distToTurretBeta).toBeLessThanOrEqual(18.0);
    const dotTurretBeta = (2 * Math.sin(0) + 10 * Math.cos(0)) / distToTurretBeta;
    expect(dotTurretBeta).toBeGreaterThanOrEqual(0.6); // Strictly in cone of facing 0!

    wsAlpha.send(JSON.stringify({
      eventId: "evt_shotgun_multi_mach_displaced",
      type: "machine_hit",
      senderId: "op_alpha_1",
      raidId,
      timestamp: now + 30,
      data: {
        machineId: "turret_depot_beta",
        damage: 40,
        kind: "shotgun",
        shotId,
        attackerFacing: 0,
        attackerX: 5.0, // 5.0m displacement from shot origin (0, 0) > 1.5m limit!
        attackerZ: 0,
      }
    }));
    await new Promise((r) => setTimeout(r, 200));

    // Verify Bravo took damage from first hit
    const bravoHit = bravoMsgs.find((m) => m.type === "hit" && m.data?.kind === "shotgun");
    expect(bravoHit).toBeDefined();
    expect(bravoHit.data.targetArmor).toBe(60); // 100 - 40 = 60

    // Verify Turret Alpha took damage and was NOT rejected as rate-limited or out of ammo
    const machHit = alphaMsgs.find((m) => m.type === "machine_hit" && m.data?.kind === "shotgun" && !m.data?.rejected);
    expect(machHit).toBeDefined();
    expect(machHit.data.machineHealth).toBe(80); // 120 - 40 = 80

    // Verify drone_patrol_beta was strictly REJECTED by fixed cone spread (even with packet facing pointing directly at it)
    const outOfConeHit = alphaMsgs.find((m) => m.type === "machine_hit" && m.data?.machineId === "drone_patrol_beta" && !m.data?.rejected);
    expect(outOfConeHit).toBeUndefined();
    const rejectedOutOfCone = alphaMsgs.find((m) => m.eventId === "evt_shotgun_multi_mach_outofcone");
    expect(rejectedOutOfCone).toBeDefined();
    expect(rejectedOutOfCone.data?.rejected).toBe(true);

    // Verify turret_depot_beta was strictly REJECTED by origin displacement (even though inside cone and not hit yet)
    const displacedHit = alphaMsgs.find((m) => m.eventId === "evt_shotgun_multi_mach_displaced" && !m.data?.rejected);
    expect(displacedHit).toBeUndefined();
    const rejectedDisplaced = alphaMsgs.find((m) => m.eventId === "evt_shotgun_multi_mach_displaced");
    expect(rejectedDisplaced).toBeDefined();
    expect(rejectedDisplaced.data?.rejected).toBe(true);

    // Assert that exactly ONE shell was deducted from ammo pool (8 - 1 = 7)
    expect(serverAuth.getOperativeAmmo(raidId, "op_alpha_1")).toBe(7);

    // Bravo should NOT have received a second hit from the same shell
    const allBravoHits = bravoMsgs.filter((m) => m.type === "hit" && m.data?.kind === "shotgun");
    expect(allBravoHits.length).toBe(1);
    expect(allBravoHits[0].data.targetArmor).toBe(60); // Unchanged from first hit
    expect(serverAuth.getOperativeAmmo(raidId, "op_alpha_1")).toBe(7); // Ammo not double-deducted

    wsAlpha.close();
    wsBravo.close();
    await new Promise<void>((resolve) => testServer.close(() => resolve()));
    try { fs.unlinkSync(tempStorePath); } catch {}
  }, 15000);

  it("36. Separate authoritative weapon pools: empty shotgun pool does not prevent rifle damage", async () => {
    const tempStorePath = path.join(os.tmpdir(), `stick_store_spec36_${Date.now()}.json`);
    const serverAuth = new ServerSettlementAuthority(tempStorePath);
    const raidId = "raid_spec36_weapon_pools";

    serverAuth.initRaid(raidId, 50000, ["op_alpha_1", "op_bravo_1"]);
    const rRec = serverAuth.getRaidRecord(raidId)!;
    (rRec.operatives["op_alpha_1"] as any).spawnX = -40;
    (rRec.operatives["op_alpha_1"] as any).spawnZ = -40;
    rRec.operatives["op_alpha_1"].lastObservedX = -40;
    rRec.operatives["op_alpha_1"].lastObservedZ = -40;
    rRec.operatives["op_bravo_1"].lastObservedX = -40;
    rRec.operatives["op_bravo_1"].lastObservedZ = -35;

    const alphaToken = serverAuth.getSessionToken(raidId, "op_alpha_1")!;
    const bravoToken = serverAuth.getSessionToken(raidId, "op_bravo_1")!;

    const testServer = createStickZoneServer(serverAuth);
    await new Promise<void>((resolve) => testServer.listen(0, resolve));
    const port = (testServer.address() as any).port;

    const wsAlpha = new WebSocket(`ws://localhost:${port}/syncplay-ws?token=${alphaToken}&raidId=${raidId}`);
    const wsBravo = new WebSocket(`ws://localhost:${port}/syncplay-ws?token=${bravoToken}&raidId=${raidId}`);

    const bravoMsgs: any[] = [];
    wsBravo.on("message", (raw) => { try { bravoMsgs.push(JSON.parse(raw.toString())); } catch {} });

    await Promise.all([
      new Promise<void>((resolve) => wsAlpha.on("open", resolve)),
      new Promise<void>((resolve) => wsBravo.on("open", resolve)),
    ]);

    // Send initial state for Bravo at (-40, -35) safe from machine range
    wsBravo.send(JSON.stringify({
      eventId: "evt_spec36_bravo_state",
      type: "state",
      senderId: "op_bravo_1",
      raidId,
      timestamp: Date.now(),
      data: { x: -40, z: -35, facing: Math.PI, health: 100, armor: 100, isAlive: true }
    }));

    // Alpha switches to shotgun and completely exhausts its 8 shells down to 0 ammo
    wsAlpha.send(JSON.stringify({
      eventId: "evt_spec36_alpha_state_1",
      type: "state",
      senderId: "op_alpha_1",
      raidId,
      timestamp: Date.now(),
      data: { x: -40, z: -40, facing: 0, health: 100, armor: 100, isAlive: true, weapon: "shotgun", ammo: 0, shotgunAmmo: 0, rifleAmmo: 30 }
    }));
    await new Promise((r) => setTimeout(r, 100));

    // Alpha switches back to rifle [1]: client reports rifle equipped with 30 rifle rounds
    wsAlpha.send(JSON.stringify({
      eventId: "evt_spec36_alpha_state_2",
      type: "state",
      senderId: "op_alpha_1",
      raidId,
      timestamp: Date.now(),
      data: { x: -40, z: -40, facing: 0, health: 100, armor: 100, isAlive: true, weapon: "rifle", ammo: 30, rifleAmmo: 30, shotgunAmmo: 0 }
    }));
    await new Promise((r) => setTimeout(r, 100));

    // Alpha fires rifle at Bravo: relay must NOT reject rifle hit even though shotgun was at 0 ammo
    wsAlpha.send(JSON.stringify({
      eventId: "evt_spec36_rifle_hit_1",
      type: "hit",
      senderId: "op_alpha_1",
      raidId,
      timestamp: Date.now(),
      data: {
        targetId: "op_bravo_1",
        damage: 20,
        kind: "rifle",
        attackerFacing: 0,
        attackerX: -40,
        attackerZ: -40,
      }
    }));
    await new Promise((r) => setTimeout(r, 150));

    const bravoHit = bravoMsgs.find((m) => m.type === "hit" && m.data?.kind === "rifle");
    expect(bravoHit).toBeDefined();
    expect(bravoHit.data.targetArmor).toBe(80); // 100 - 20 = 80

    wsAlpha.close();
    wsBravo.close();
    await new Promise<void>((resolve) => testServer.close(() => resolve()));
    try { fs.unlinkSync(tempStorePath); } catch {}
  }, 15000);

  it("37. Death after firing consumes the fire event once; subsequent steps after fatal damage produce zero repeat fire events", () => {
    const sim = new SectorDepotSimulation("raid_spec37_dead_shot", "spoke");
    sim.admitOperative(0);
    sim.machines = [];
    sim.rivals = [];

    // Operative fires weapon
    sim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: true, interact: false });
    expect(sim.player.lastFireTick).toBe(1);

    // Render loop consumes the single fire event
    const firstConsumed = sim.consumeFireEvent();
    expect(firstConsumed).toBe(true);

    // Operative suffers fatal damage on the same tick
    sim.applyDamageToPlayer(250);
    expect(sim.player.isAlive).toBe(false);

    // Subsequent simulation steps (tick does not advance because operative is dead)
    for (let i = 0; i < 5; i++) {
      sim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, kick: false, shoot: false, interact: false });
      const repeatEvent = sim.consumeFireEvent();
      expect(repeatEvent).toBe(false);
    }
  });

  it("38. Tactical reload protocol restores server ammo pool and separate pools persist across server restarts", async () => {
    const tempStorePath = path.join(os.tmpdir(), `stick_store_spec38_${Date.now()}.json`);
    const serverAuth = new ServerSettlementAuthority(tempStorePath);
    const raidId = "raid_spec38_reload_persist";

    serverAuth.initRaid(raidId, 50000, ["op_alpha_1", "op_bravo_1"]);
    const rRec = serverAuth.getRaidRecord(raidId)!;
    rRec.operatives["op_alpha_1"].selectedWeapon = "shotgun";
    rRec.operatives["op_alpha_1"].shotgunAmmo = 8;
    rRec.operatives["op_alpha_1"].rifleAmmo = 25;
    rRec.operatives["op_alpha_1"].ammo = 8;
    rRec.operatives["op_alpha_1"].lastObservedX = -40;
    rRec.operatives["op_alpha_1"].lastObservedZ = -40;

    rRec.operatives["op_bravo_1"].selectedWeapon = "rifle";
    rRec.operatives["op_bravo_1"].shotgunAmmo = 8;
    rRec.operatives["op_bravo_1"].rifleAmmo = 30;
    rRec.operatives["op_bravo_1"].ammo = 30;
    rRec.operatives["op_bravo_1"].lastObservedX = -40;
    rRec.operatives["op_bravo_1"].lastObservedZ = -35;

    // Place turret_depot_alpha at (-40, -14), 26m from Alpha (-40, -40) and 21m from Bravo (-40, -35)
    // In-range for Alpha rifle (26m <= 35m), but outside AI turret attack range (> 20m for both players)
    (rRec as any).machineDeployment = [
      { id: "turret_depot_alpha", type: "turret", x: -40, y: 0, z: -14, facing: Math.PI, health: 120, isAlive: true },
      { id: "drone_patrol_beta", type: "drone", x: 14, y: 2.2, z: -8, facing: -Math.PI / 2, health: 75, isAlive: true },
    ];

    serverAuth.saveToDisk();

    const alphaToken = serverAuth.getSessionToken(raidId, "op_alpha_1")!;
    const bravoToken = serverAuth.getSessionToken(raidId, "op_bravo_1")!;

    let testServer = createStickZoneServer(serverAuth);
    await new Promise<void>((resolve) => testServer.listen(0, resolve));
    let port = (testServer.address() as any).port;

    let wsAlpha = new WebSocket(`ws://localhost:${port}/syncplay-ws?token=${alphaToken}&raidId=${raidId}`);
    let wsBravo = new WebSocket(`ws://localhost:${port}/syncplay-ws?token=${bravoToken}&raidId=${raidId}`);

    const bravoMsgs: any[] = [];
    wsBravo.on("message", (raw) => { try { bravoMsgs.push(JSON.parse(raw.toString())); } catch {} });

    await Promise.all([
      new Promise<void>((resolve) => wsAlpha.on("open", resolve)),
      new Promise<void>((resolve) => wsBravo.on("open", resolve)),
    ]);

    // Position Bravo at (-40, -35)
    wsBravo.send(JSON.stringify({
      eventId: "evt_spec38_bravo_state",
      type: "state",
      senderId: "op_bravo_1",
      raidId,
      timestamp: Date.now(),
      data: { x: -40, z: -35, facing: Math.PI, health: 100, armor: 100, isAlive: true }
    }));

    // 1. Alpha drains server shotgun pool to 0
    wsAlpha.send(JSON.stringify({
      eventId: "evt_spec38_alpha_empty_shotgun",
      type: "state",
      senderId: "op_alpha_1",
      raidId,
      timestamp: Date.now(),
      data: {
        x: -40,
        z: -40,
        facing: 0,
        health: 100,
        armor: 100,
        isAlive: true,
        weapon: "shotgun",
        ammo: 0,
        shotgunAmmo: 0,
        rifleAmmo: 25,
      }
    }));
    await new Promise((r) => setTimeout(r, 100));
    expect(serverAuth.getOperativeAmmo(raidId, "op_alpha_1")).toBe(0);

    // Alpha attempts to fire shotgun while server pool is at 0: server must REJECT hit with 0 damage!
    wsAlpha.send(JSON.stringify({
      eventId: "evt_spec38_shotgun_fail_empty",
      type: "hit",
      senderId: "op_alpha_1",
      raidId,
      timestamp: Date.now(),
      data: {
        targetId: "op_bravo_1",
        damage: 45,
        kind: "shotgun",
        shotId: "shot_spec38_fail_1",
        attackerFacing: 0,
        attackerX: -40,
        attackerZ: -40,
      }
    }));
    await new Promise((r) => setTimeout(r, 100));
    const failHit = bravoMsgs.find((m) => m.data?.shotId === "shot_spec38_fail_1");
    expect(failHit).toBeUndefined();

    // 2. Alpha runs simulation reload: restores shells to 8, sets action to 'reload'
    const sim = new SectorDepotSimulation("raid_spec38_sim", "spoke");
    sim.admitOperative(0);
    sim.setWeapon("shotgun");
    sim.player.ammo = 0;
    sim.player.shotgunAmmo = 0;
    expect(sim.player.reserveShotgunAmmo).toBeGreaterThanOrEqual(8);

    const reloaded = sim.reload();
    expect(reloaded).toBe(true);
    expect(sim.player.action).toBe("reload");
    expect(sim.player.ammo).toBe(8);
    expect(sim.player.shotgunAmmo).toBe(8);

    // 3. Alpha initiates partial shotgun reload (5 shells), reporting increased rifle ammo (which must be rejected)
    const reloadStart = Date.now();
    wsAlpha.send(JSON.stringify({
      eventId: "evt_spec38_alpha_partial_reload",
      type: "state",
      senderId: "op_alpha_1",
      raidId,
      timestamp: reloadStart,
      data: {
        x: -40,
        z: -40,
        facing: 0,
        health: 100,
        armor: 100,
        isAlive: true,
        weapon: "shotgun",
        action: "reload",
        ammo: 5,
        shotgunAmmo: 5,
        rifleAmmo: 30, // Unrelated pool increase during shotgun reload: must be clamped to 25!
      }
    }));

    // 4. Alpha attempts to fire during active reload cooldown window (< 350ms): MUST BE REJECTED
    wsAlpha.send(JSON.stringify({
      eventId: "evt_spec38_shotgun_hit_during_reload",
      type: "hit",
      senderId: "op_alpha_1",
      raidId,
      timestamp: reloadStart + 50,
      data: {
        targetId: "op_bravo_1",
        damage: 45,
        kind: "shotgun",
        shotId: "shot_spec38_during_reload",
        attackerFacing: 0,
        attackerX: -40,
        attackerZ: -40,
      }
    }));
    await new Promise((r) => setTimeout(r, 100));

    // Verify shot during reload was rejected: Bravo still at 100 armor
    const duringReloadHit = bravoMsgs.find((m) => m.data?.shotId === "shot_spec38_during_reload");
    expect(duringReloadHit).toBeUndefined();

    // Allow reload cooldown window to complete (350ms total)
    await new Promise((r) => setTimeout(r, 350));

    // 5. Alpha fires shotgun after reload window completes: MUST SUCCEED!
    wsAlpha.send(JSON.stringify({
      eventId: "evt_spec38_shotgun_hit_after_reload",
      type: "hit",
      senderId: "op_alpha_1",
      raidId,
      timestamp: Date.now(),
      data: {
        targetId: "op_bravo_1",
        damage: 45,
        kind: "shotgun",
        shotId: "shot_spec38_reload_1",
        attackerFacing: 0,
        attackerX: -40,
        attackerZ: -40,
      }
    }));
    await new Promise((r) => setTimeout(r, 150));

    const bravoHit = bravoMsgs.find((m) => m.type === "hit" && m.data?.kind === "shotgun");
    expect(bravoHit).toBeDefined();
    console.error("BRAVO_HIT_DATA:", bravoHit.data, "ALL_HITS:", bravoMsgs.filter(m => m.type === "hit"));
    expect(bravoHit.data.targetArmor).toBe(55); // 100 - 45 = 55
    expect(serverAuth.getOperativeAmmo(raidId, "op_alpha_1")).toBe(4); // 5 - 1 = 4

    // 6. Weapon switch during active reload cancels reload state immediately:
    // Start active shotgun reload...
    wsAlpha.send(JSON.stringify({
      eventId: "evt_spec38_start_shotgun_reload",
      type: "state",
      senderId: "op_alpha_1",
      raidId,
      timestamp: Date.now(),
      data: {
        x: -40,
        z: -40,
        facing: 0,
        health: 100,
        armor: 100,
        isAlive: true,
        weapon: "shotgun",
        action: "reload",
        ammo: 8,
        shotgunAmmo: 8,
        rifleAmmo: 25,
      }
    }));
    await new Promise((r) => setTimeout(r, 50));
    // Mid-reload weapon switch to rifle cancels shotgun reload!
    wsAlpha.send(JSON.stringify({
      eventId: "evt_spec38_switch_cancels_reload",
      type: "state",
      senderId: "op_alpha_1",
      raidId,
      timestamp: Date.now(),
      data: {
        x: -40,
        z: -40,
        facing: 0,
        health: 100,
        armor: 100,
        isAlive: true,
        weapon: "rifle",
        action: "idle",
        ammo: 25,
        rifleAmmo: 25,
        shotgunAmmo: 4,
      }
    }));
    await new Promise((r) => setTimeout(r, 50));
    const relayStateMidSwitch = getRaidOperativeWeaponState(raidId, "op_alpha_1");
    expect(relayStateMidSwitch.isReloading).toBe(false);
    expect(relayStateMidSwitch.reloadingWeapon).toBeNull();
    expect(relayStateMidSwitch.selectedWeapon).toBe("rifle");

    // 7. Rifle fire against machine turret during active rifle reload cooldown:
    // Alpha is at (-40, -40). Turret is at (-40, -30). Distance = 10m (<= 35m rifle range).
    // Facing = 0 (pointing straight along +Z towards turret).
    const rifleReloadStart = Date.now();
    wsAlpha.send(JSON.stringify({
      eventId: "evt_spec38_rifle_reload",
      type: "state",
      senderId: "op_alpha_1",
      raidId,
      timestamp: rifleReloadStart,
      data: {
        x: -40,
        z: -40,
        facing: 0,
        health: 100,
        armor: 100,
        isAlive: true,
        weapon: "rifle",
        action: "reload",
        ammo: 30,
        rifleAmmo: 30,
        shotgunAmmo: 4,
      }
    }));

    // Alpha attempts to fire rifle at machine turret during active reload window (< 350ms):
    const alphaMachineMsgs: any[] = [];
    wsAlpha.on("message", (raw) => {
      try {
        const m = JSON.parse(raw.toString());
        if (m.type === "machine_hit") alphaMachineMsgs.push(m);
      } catch {}
    });

    wsAlpha.send(JSON.stringify({
      eventId: "evt_spec38_rifle_hit_during_reload",
      type: "machine_hit",
      senderId: "op_alpha_1",
      raidId,
      timestamp: rifleReloadStart + 40,
      data: {
        machineId: "turret_depot_alpha",
        damage: 20,
        kind: "rifle",
        attackerFacing: 0, // Valid facing pointing straight at turret (10m away)
      }
    }));
    await new Promise((r) => setTimeout(r, 100));

    // Must be rejected by shared reload cooldown guard: turret took 0 damage
    const rejectedRifleMach = alphaMachineMsgs.find((m) => m.eventId === "evt_spec38_rifle_hit_during_reload");
    expect(rejectedRifleMach).toBeDefined();
    expect(rejectedRifleMach.data?.rejected).toBe(true);
    expect(rejectedRifleMach.data?.damage).toBe(0);

    // Wait for rifle reload cooldown to finish (> 350ms):
    await new Promise((r) => setTimeout(r, 400));

    // Alpha fires rifle at machine turret after reload completes with the identical valid geometry:
    wsAlpha.send(JSON.stringify({
      eventId: "evt_spec38_rifle_hit_after_reload",
      type: "machine_hit",
      senderId: "op_alpha_1",
      raidId,
      timestamp: Date.now(),
      data: {
        machineId: "turret_depot_alpha",
        damage: 20,
        kind: "rifle",
        attackerFacing: 0,
      }
    }));
    await new Promise((r) => setTimeout(r, 150));

    // Must be accepted after reload completes: turret takes 20 damage (120 - 20 = 100)
    let acceptedRifleMach = alphaMachineMsgs.find((m) => m.eventId === "evt_spec38_rifle_hit_after_reload");
    if (!acceptedRifleMach) {
      await new Promise((r) => setTimeout(r, 200));
      acceptedRifleMach = alphaMachineMsgs.find((m) => m.eventId === "evt_spec38_rifle_hit_after_reload");
    }
    console.log("DEBUG acceptedRifleMach:", JSON.stringify(acceptedRifleMach));
    expect(acceptedRifleMach).toBeDefined();
    expect(acceptedRifleMach.data?.rejected).toBeUndefined();
    expect(acceptedRifleMach.data?.damage).toBe(20);
    expect(acceptedRifleMach.data?.machineHealth).toBe(100);

    const opCustodyAfterRifleReload = serverAuth.getRaidRecord(raidId)!.operatives["op_alpha_1"];
    expect(opCustodyAfterRifleReload.selectedWeapon).toBe("rifle");
    expect(opCustodyAfterRifleReload.rifleAmmo).toBe(29); // 30 - 1 = 29
    expect(opCustodyAfterRifleReload.shotgunAmmo).toBe(4);
    expect(serverAuth.getOperativeAmmo(raidId, "op_alpha_1")).toBe(29);

    // 8. Persistence across server restart: close server, WIPE module memory maps, and start fresh server
    wsAlpha.close();
    wsBravo.close();
    await new Promise<void>((resolve) => testServer.close(() => resolve()));

    // Crucial: wipe in-memory module maps to prove state comes from disk custody
    resetServerModuleState();

    const restartedAuth = new ServerSettlementAuthority(tempStorePath);
    const restartedOp = restartedAuth.getRaidRecord(raidId)!.operatives["op_alpha_1"];
    expect(restartedOp.shotgunAmmo).toBe(4);
    expect(restartedOp.rifleAmmo).toBe(29);
    expect(restartedOp.selectedWeapon).toBe("rifle");

    const restartServer = createStickZoneServer(restartedAuth);
    await new Promise<void>((resolve) => restartServer.listen(0, resolve));
    port = (restartServer.address() as any).port;

    // 9. Reconnect via LIVE client coordinator socket handler: verify complete weapon state rehydration
    const reconnectToken = restartedAuth.getSessionToken(raidId, "op_alpha_1")!;
    const clientSim = new SectorDepotSimulation("raid_spec38_client_sim", "spoke");
    (clientSim as any).sessionToken = reconnectToken;
    const clientCoord = new MultiplayerCoordinator(clientSim);
    (clientCoord as any).wsUrl = `ws://localhost:${port}/syncplay-ws`;
    clientCoord.connectWebSocket(reconnectToken);

    // Await live WebSocket onmessage authentication handshake
    await new Promise<void>((resolve, reject) => {
      const deadline = Date.now() + 4000;
      const check = setInterval(() => {
        if ((clientCoord as any).authenticated) {
          clearInterval(check);
          resolve();
        } else if (Date.now() > deadline) {
          clearInterval(check);
          reject(new Error("Timeout waiting for live socket auth_success"));
        }
      }, 25);
    });

    // Verify live client simulation received authoritative weapon state:
    expect((clientCoord as any).authenticated).toBe(true);
    expect(clientSim.player.weapon).toBe("rifle");
    expect(clientSim.player.rifleAmmo).toBe(29);
    expect(clientSim.player.shotgunAmmo).toBe(4);
    expect(clientSim.player.ammo).toBe(29);

    clientCoord.disconnect();
    await new Promise<void>((resolve) => restartServer.close(() => resolve()));
    try { fs.unlinkSync(tempStorePath); } catch {}
  }, 25000);

  it("39. Complete weapon state through HTTP crate grants and disputed claim revocation", async () => {
    const tempStorePath = path.join(os.tmpdir(), `stick_store_spec39_${Date.now()}.json`);
    const serverAuth = new ServerSettlementAuthority(tempStorePath);
    const raidId = "raid_spec39_weapon_custody";

    serverAuth.initRaid(raidId, 50000, ["op_alpha_1", "op_bravo_1"]);
    const rRec = serverAuth.getRaidRecord(raidId)!;

    // Both operatives start with BOTH pools depleted and distinct weapon selections:
    // Alpha: shotgun selected, 3/8 shotgun, 20/30 rifle (ammo = 3)
    rRec.operatives["op_alpha_1"].selectedWeapon = "shotgun";
    rRec.operatives["op_alpha_1"].shotgunAmmo = 3;
    rRec.operatives["op_alpha_1"].rifleAmmo = 20;
    rRec.operatives["op_alpha_1"].ammo = 3;
    (rRec.operatives["op_alpha_1"] as any).spawnX = -8;
    (rRec.operatives["op_alpha_1"] as any).spawnZ = -5;
    rRec.operatives["op_alpha_1"].lastObservedX = -8;
    rRec.operatives["op_alpha_1"].lastObservedZ = -5;

    // Bravo: rifle selected, 8/8 shotgun, 15/30 rifle (ammo = 15)
    rRec.operatives["op_bravo_1"].selectedWeapon = "rifle";
    rRec.operatives["op_bravo_1"].shotgunAmmo = 8;
    rRec.operatives["op_bravo_1"].rifleAmmo = 15;
    rRec.operatives["op_bravo_1"].ammo = 15;
    (rRec.operatives["op_bravo_1"] as any).spawnX = -8;
    (rRec.operatives["op_bravo_1"] as any).spawnZ = -5;
    rRec.operatives["op_bravo_1"].lastObservedX = -8;
    rRec.operatives["op_bravo_1"].lastObservedZ = -5;

    serverAuth.saveToDisk();

    const alphaToken = serverAuth.getSessionToken(raidId, "op_alpha_1")!;
    const bravoToken = serverAuth.getSessionToken(raidId, "op_bravo_1")!;

    // Create client simulation for Alpha with matching depleted state:
    const simAlpha = new SectorDepotSimulation(raidId, "spoke");
    simAlpha.admitOperative(0);
    simAlpha.setWeapon("shotgun");
    simAlpha.player.rifleAmmo = 20;
    simAlpha.player.shotgunAmmo = 3;
    simAlpha.player.ammo = 3;

    // CRITICAL SOL REQUIREMENT: Clear relay state maps completely BEFORE any WebSocket client connects!
    resetServerModuleState();

    const testServer = createStickZoneServer(serverAuth);
    await new Promise<void>((resolve) => testServer.listen(0, resolve));
    const port = (testServer.address() as any).port;

    // 1. Alpha loots crate_01 via HTTP POST /api/settlement/loot BEFORE connecting any WebSocket:
    // Server must hydrate stored shotgun selection from custody without overwriting it with default rifle!
    const claimTime = Date.now();
    const httpRes = await fetch(`http://localhost:${port}/api/settlement/loot`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${alphaToken}`,
      },
      body: JSON.stringify({
        token: alphaToken,
        raidId,
        crateId: "crate_01",
        claimantId: "op_alpha_1",
        cashValue: 1250,
        claimTimestamp: claimTime,
        x: -8,
        z: -5,
      })
    });
    const lootData = await httpRes.json();
    expect(lootData.success).toBe(true);
    expect(lootData.isNewClaim).toBe(true);

    // Verify custody state: weapon selection remains shotgun, both pools replenished, scalar ammo is 8 (NOT 30!)
    const alphaAfterLoot = serverAuth.getRaidRecord(raidId)!.operatives["op_alpha_1"];
    expect(alphaAfterLoot.selectedWeapon).toBe("shotgun");
    expect(alphaAfterLoot.rifleAmmo).toBe(30);
    expect(alphaAfterLoot.shotgunAmmo).toBe(8);
    expect(alphaAfterLoot.ammo).toBe(8);

    // CRITICAL SOL REQUIREMENT: Independently inspect live relay in-memory state directly:
    const relayAlphaLoot = getRaidOperativeWeaponState(raidId, "op_alpha_1", serverAuth);
    expect(relayAlphaLoot.selectedWeapon).toBe("shotgun");
    expect(relayAlphaLoot.rifleAmmo).toBe(30);
    expect(relayAlphaLoot.shotgunAmmo).toBe(8);
    expect(relayAlphaLoot.ammo).toBe(8);

    // 2. Client simulation loots crate_01 and derives regular full-pool state update:
    simAlpha.recordCrateLootAmmo("crate_01");
    expect(simAlpha.player.rifleAmmo).toBe(30);
    expect(simAlpha.player.shotgunAmmo).toBe(8);
    expect(simAlpha.player.ammo).toBe(8);

    // Alpha connects WebSocket and sends regular state update derived DIRECTLY from simAlpha with full pools (30/8/8) BEFORE any dispute:
    const wsAlpha = new WebSocket(`ws://localhost:${port}/syncplay-ws?token=${alphaToken}&raidId=${raidId}`);
    await new Promise<void>((resolve) => wsAlpha.on("open", resolve));

    wsAlpha.send(JSON.stringify({
      eventId: "evt_spec39_alpha_claimed_full_state",
      type: "state",
      senderId: "op_alpha_1",
      raidId,
      timestamp: Date.now(),
      data: {
        x: -8,
        z: -5,
        facing: 0,
        health: simAlpha.player.health,
        armor: simAlpha.player.armor,
        isAlive: true,
        weapon: simAlpha.player.weapon,
        ammo: simAlpha.player.ammo,
        shotgunAmmo: simAlpha.player.shotgunAmmo,
        rifleAmmo: simAlpha.player.rifleAmmo,
      }
    }));
    await new Promise((r) => setTimeout(r, 50));

    // CRITICAL REGRESSION ASSERTION: Full-pool state update did NOT reduce server rifle ammo back to 20!
    const relayAlphaStateCheck = getRaidOperativeWeaponState(raidId, "op_alpha_1", serverAuth);
    expect(relayAlphaStateCheck.selectedWeapon).toBe("shotgun");
    expect(relayAlphaStateCheck.rifleAmmo).toBe(30);
    expect(relayAlphaStateCheck.shotgunAmmo).toBe(8);
    expect(relayAlphaStateCheck.ammo).toBe(8);
    expect(alphaAfterLoot.rifleAmmo).toBe(30);
    expect(alphaAfterLoot.shotgunAmmo).toBe(8);
    expect(alphaAfterLoot.ammo).toBe(8);

    // 3. Disputed claim on crate_01:
    // Refresh serverClaimedAt to now so socket connect latency does not expire the 100ms tie-break window:
    const crateRec = serverAuth.getRaidRecord(raidId)!.crates["crate_01"];
    crateRec.serverClaimedAt = Date.now();

    // Bravo submits faster winning claim for crate_01 within 10ms (< 100ms server tie-break window):
    const disputedRes = await fetch(`http://localhost:${port}/api/settlement/loot`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${bravoToken}`,
      },
      body: JSON.stringify({
        token: bravoToken,
        raidId,
        crateId: "crate_01",
        claimantId: "op_bravo_1",
        cashValue: 1250,
        claimTimestamp: claimTime - 20, // 20ms earlier: Bravo wins tie-break!
        x: -8,
        z: -5,
      })
    });
    const disputedData = await disputedRes.json();
    expect(disputedData.success).toBe(true);

    // Verify Alpha custody was debited and BOTH pools rolled back to pre-grant amounts:
    const alphaAfterDispute = serverAuth.getRaidRecord(raidId)!.operatives["op_alpha_1"];
    expect(alphaAfterDispute.selectedWeapon).toBe("shotgun");
    expect(alphaAfterDispute.rifleAmmo).toBe(20);
    expect(alphaAfterDispute.shotgunAmmo).toBe(3);
    expect(alphaAfterDispute.ammo).toBe(3);
    expect(alphaAfterDispute.cratesLooted).not.toContain("crate_01");

    // CRITICAL: Independently inspect live relay in-memory state for Alpha after dispute:
    const relayAlphaDispute = getRaidOperativeWeaponState(raidId, "op_alpha_1", serverAuth);
    expect(relayAlphaDispute.selectedWeapon).toBe("shotgun");
    expect(relayAlphaDispute.rifleAmmo).toBe(20);
    expect(relayAlphaDispute.shotgunAmmo).toBe(3);
    expect(relayAlphaDispute.ammo).toBe(3);

    // Verify Bravo custody was credited with crate_01 and full weapon pools:
    const bravoAfterDispute = serverAuth.getRaidRecord(raidId)!.operatives["op_bravo_1"];
    expect(bravoAfterDispute.selectedWeapon).toBe("rifle");
    expect(bravoAfterDispute.rifleAmmo).toBe(30);
    expect(bravoAfterDispute.shotgunAmmo).toBe(8);
    expect(bravoAfterDispute.ammo).toBe(30);
    expect(bravoAfterDispute.cratesLooted).toContain("crate_01");

    // CRITICAL: Independently inspect live relay in-memory state for Bravo after dispute:
    const relayBravoDispute = getRaidOperativeWeaponState(raidId, "op_bravo_1", serverAuth);
    expect(relayBravoDispute.selectedWeapon).toBe("rifle");
    expect(relayBravoDispute.rifleAmmo).toBe(30);
    expect(relayBravoDispute.shotgunAmmo).toBe(8);
    expect(relayBravoDispute.ammo).toBe(30);

    // 4. Alpha client simulation handles rejection and rolls back:
    simAlpha.handleCrateRejectionAmmo("crate_01");
    expect(simAlpha.player.rifleAmmo).toBe(20);
    expect(simAlpha.player.shotgunAmmo).toBe(3);
    expect(simAlpha.player.ammo).toBe(3);

    // Alpha sends regular state update derived from rolled-back client simulation:
    wsAlpha.send(JSON.stringify({
      eventId: "evt_spec39_alpha_post_dispute_state",
      type: "state",
      senderId: "op_alpha_1",
      raidId,
      timestamp: Date.now(),
      data: {
        x: -8,
        z: -5,
        facing: 0,
        health: simAlpha.player.health,
        armor: simAlpha.player.armor,
        isAlive: true,
        weapon: simAlpha.player.weapon,
        ammo: simAlpha.player.ammo,
        shotgunAmmo: simAlpha.player.shotgunAmmo,
        rifleAmmo: simAlpha.player.rifleAmmo,
      }
    }));
    await new Promise((r) => setTimeout(r, 50));

    // Relay and custody remain intact at rolled-back amounts:
    expect(relayAlphaDispute.rifleAmmo).toBe(20);
    expect(relayAlphaDispute.shotgunAmmo).toBe(3);
    expect(relayAlphaDispute.ammo).toBe(3);
    expect(alphaAfterDispute.rifleAmmo).toBe(20);
    expect(alphaAfterDispute.shotgunAmmo).toBe(3);
    expect(alphaAfterDispute.ammo).toBe(3);

    wsAlpha.close();
    await new Promise<void>((resolve) => testServer.close(() => resolve()));
    try { fs.unlinkSync(tempStorePath); } catch {}
  }, 15000);
  it("40. Recovery session preserves terminal custody and rejects peer settlement attacks", async () => {
    // -------------------------------------------------------------
    // Subcase A: Recovery session strictly preserves terminal custody
    // Extracted operative reconnecting over WebSocket and sending machine_hit, hit, and state
    // causes ZERO machine damage, ZERO rival damage, and preserves isExtracted: true
    // -------------------------------------------------------------
    const tempStorePath = path.join(os.tmpdir(), `settlement_store_spec40_${Date.now()}.json`);
    const serverAuth = new ServerSettlementAuthority(tempStorePath);
    const raidId = "raid_sector7_spec40";
    serverAuth.initRaid(raidId, 50000, ["op_player", "op_alpha_1", "op_bravo_1"]);
    const alphaToken = serverAuth.getSessionToken(raidId, "op_alpha_1")!;
    const bravoToken = serverAuth.getSessionToken(raidId, "op_bravo_1")!;

    // Alpha completes hold and commits extraction
    const alphaOp = serverAuth.getRaidRecord(raidId)!.operatives["op_alpha_1"];
    alphaOp.holdCompleted = true;
    alphaOp.holdCompletedAtTick = 150;

    const commitRes = await serverAuth.commitSettlement({
      raidId,
      extractingId: "op_alpha_1",
      snapshotTick: 200,
      snapshotCash: 0,
      exfilSubmitted: true,
    });
    expect(commitRes.receipt).toBeDefined();
    expect(alphaOp.isExtracted).toBe(true);
    expect(alphaOp.holdCompleted).toBe(true);

    // Bravo is in the raid: initialized with 100 armor, 100 health
    const bravoOp = serverAuth.getRaidRecord(raidId)!.operatives["op_bravo_1"];
    expect(bravoOp.armor).toBe(100);
    expect(bravoOp.health).toBe(100);

    resetServerModuleState();
    const testServer = createStickZoneServer(serverAuth);
    await new Promise<void>((resolve) => testServer.listen(0, resolve));
    const port = (testServer.address() as any).port;

    testServer.deployMachine(raidId, { action: "place", machineId: "turret_depot_alpha", type: "turret", x: -45, z: -40, health: 120 });

    // Connect Bravo first to maintain live raid presence
    const wsBravo = new WebSocket(`ws://localhost:${port}/syncplay-ws?token=${bravoToken}&raidId=${raidId}`);
    await new Promise<void>((resolve) => wsBravo.on("open", resolve));
    await new Promise((r) => setTimeout(r, 50));
    // Reposition Bravo at (-45, -18): 22m from turret at (-45, -40), which is within rifle range (35m)
    // but strictly outside turret attack range (20m), preserving Bravo armor and health at 100/100.
    testServer.repositionOperative(raidId, "op_bravo_1", -45, -18);

    // VALID COMBAT CONTROL: Live, unextracted operative (Bravo at -45, -18) fires rifle at turret_depot_alpha (-45, -40, dist: 22.0m)
    // with valid kind: "rifle", damage: 20, attacker position strictly within 2.0m, and within 35.0m range.
    expect(serverAuth.getRaidRecord(raidId)!.machines!["turret_depot_alpha"].health).toBe(120);

    wsBravo.send(JSON.stringify({
      eventId: "evt_spec40_control_bravo_rifle_hit",
      type: "machine_hit",
      senderId: "op_bravo_1",
      raidId,
      timestamp: Date.now(),
      data: {
        machineId: "turret_depot_alpha",
        damage: 20,
        kind: "rifle",
        shotId: "shot_spec40_control",
        attackerFacing: Math.PI,
        attackerX: -45,
        attackerZ: -18,
      }
    }));
    await new Promise((r) => setTimeout(r, 100));
    // Combat control confirms live rifle combat succeeds and damages turret from 120 down to 100!
    expect(serverAuth.getRaidRecord(raidId)!.machines!["turret_depot_alpha"].health).toBe(100);

    // Connect Alpha via WebSocket recovery session
    const wsAlpha = new WebSocket(`ws://localhost:${port}/syncplay-ws?token=${alphaToken}&raidId=${raidId}`);
    const alphaReceived: any[] = [];
    wsAlpha.on("message", (raw) => {
      try { alphaReceived.push(JSON.parse(raw.toString())); } catch {}
    });
    await new Promise<void>((resolve) => wsAlpha.on("open", resolve));
    await new Promise((r) => setTimeout(r, 50));
    testServer.repositionOperative(raidId, "op_alpha_1", -45, -45);

    // Alpha receives recovery settlement_committed packet from server
    const recPkt = await new Promise<any>((resolve) => {
      const check = setInterval(() => {
        const found = alphaReceived.find((m) => m.type === "settlement_committed");
        if (found) {
          clearInterval(check);
          resolve(found);
        }
      }, 20);
    });
    expect(recPkt).toBeDefined();
    expect(recPkt.recovery).toBe(true);
    expect(recPkt.senderId).toBe("server");
    expect(recPkt.serverAuthoritative).toBe(true);
    expect(recPkt.data.receipt.receiptId).toBe(commitRes.receipt.receiptId);

    // Alpha attempts combat exploitation while in recovery session using identical valid geometry:
    // 1) Alpha sends machine_hit targeting turret_depot_alpha (-45, -40, dist: 5.0m <= 18m shotgun range, origin at Alpha: -45, -45 <= 2.0m)
    wsAlpha.send(JSON.stringify({
      eventId: "evt_spec40_recovery_machine_hit",
      type: "machine_hit",
      senderId: "op_alpha_1",
      raidId,
      timestamp: Date.now(),
      data: {
        machineId: "turret_depot_alpha",
        damage: 40,
        kind: "shotgun",
        shotId: "shot_spec40_exploit",
        attackerFacing: 0,
        attackerX: -45,
        attackerZ: -45,
      }
    }));

    // 2) Alpha sends hit packet targeting Bravo (-45, -18, dist: 27.0m <= 35m rifle range, origin at Alpha: -45, -45 <= 2.0m)
    wsAlpha.send(JSON.stringify({
      eventId: "evt_spec40_recovery_pvp_hit",
      type: "hit",
      senderId: "op_alpha_1",
      raidId,
      timestamp: Date.now(),
      data: {
        targetId: "op_bravo_1",
        damage: 20,
        kind: "rifle",
        weapon: "rifle",
        attackerFacing: 0,
        attackerX: -45,
        attackerZ: -45,
      }
    }));

    // 3) Alpha sends state update claiming alive and unextracted
    wsAlpha.send(JSON.stringify({
      eventId: "evt_spec40_recovery_state",
      type: "state",
      senderId: "op_alpha_1",
      raidId,
      timestamp: Date.now(),
      data: {
        x: -45,
        z: -45,
        facing: 0,
        health: 100,
        armor: 100,
        isAlive: true,
        weapon: "rifle",
        ammo: 30,
      }
    }));

    await new Promise((r) => setTimeout(r, 100));

    // CRITICAL ASSERTIONS:
    // Zero machine damage: turret health remains strictly 100 (control damaged from 120->100; Alpha exploit dropped)!
    expect(serverAuth.getRaidRecord(raidId)!.machines!["turret_depot_alpha"].health).toBe(100);
    // Zero rival damage: Bravo armor remains strictly 100 and health 100!
    expect(bravoOp.armor).toBe(100);
    expect(bravoOp.health).toBe(100);
    // Terminal custody preserved: Alpha remains strictly extracted!
    expect(alphaOp.isExtracted).toBe(true);
    expect(alphaOp.holdCompleted).toBe(true);

    wsAlpha.close();

    // -------------------------------------------------------------
    // Subcase C: Valid receipt recovery succeeds with an EMPTY client ledger
    // Fresh client simulation reconnects with a completely empty local ledger, receives
    // server-authoritative recovery packet, queries independent server audit evidence
    // via HTTP GET /api/settlement/verify-receipt, verifies cryptographically,
    // and successfully adopts the receipt (restoring extraction custody and calling onExfilSuccess).
    // -------------------------------------------------------------
    const simC = new SectorDepotSimulation(raidId, "spoke");
    simC.player.id = "op_alpha_1";
    // Initialize with a strictly EMPTY client ledger:
    const emptyClientLedger = new AuthoritativeSettlementLedger();
    simC.settlementAuthority = emptyClientLedger;
    expect(emptyClientLedger.auditLog.size).toBe(0);
    expect(simC.player.isExtracted).toBe(false);
    expect(simC.player.isAlive).toBe(true);

    let exfilSuccessCalledC = false;
    let adoptedReceiptC: any = null;
    simC.onExfilSuccess = (r: any) => {
      exfilSuccessCalledC = true;
      adoptedReceiptC = r;
    };

    const coordC = new MultiplayerCoordinator(simC);
    coordC.localId = "op_alpha_1";
    coordC.wsUrl = `ws://localhost:${port}/syncplay-ws`;
    coordC.connectWebSocket(alphaToken);

    // Wait for coordinator to authenticate and process recovery packet with independent server audit fetch
    await new Promise<void>((resolve) => {
      const start = Date.now();
      const check = setInterval(() => {
        if (coordC.authenticated && simC.player.isExtracted && exfilSuccessCalledC) {
          clearInterval(check);
          resolve();
        } else if (Date.now() - start > 4000) {
          clearInterval(check);
          resolve();
        }
      }, 50);
    });

    // CRITICAL ASSERTIONS:
    // 1) Receipt was independently verified via server audit log and cached into previously-empty client ledger:
    expect(emptyClientLedger.auditLog.has(commitRes.receipt.receiptId)).toBe(true);
    // 2) Extraction custody was restored to extracted:
    expect(simC.player.isExtracted).toBe(true);
    // 3) onExfilSuccess callback fired with the authentic receipt:
    expect(exfilSuccessCalledC).toBe(true);
    expect(adoptedReceiptC?.receiptId).toBe(commitRes.receipt.receiptId);
    // 4) Coordinator records receipt key in acceptedReceiptKeys:
    const expectedKey = `${raidId}:${commitRes.receipt.receiptId}`;
    expect(coordC.acceptedReceiptKeys.has(expectedKey)).toBe(true);

    coordC.cleanup();

    wsBravo.close();
    await new Promise<void>((resolve) => testServer.close(() => resolve()));
    try { fs.unlinkSync(tempStorePath); } catch {}

    // -------------------------------------------------------------
    // Subcase B: Peer settlement rejection
    // Client coordinator receiving peer packet or broadcast packet with type: "settlement_committed"
    // or non-server senderId does NOT cache receipt, does NOT alter extraction custody,
    // and leaves simulation state intact.
    // -------------------------------------------------------------
    const simB = new SectorDepotSimulation("raid_spec40_peer_reject", "spoke");
    const ledgerB = new AuthoritativeSettlementLedger();
    simB.settlementAuthority = ledgerB;
    ledgerB.registerDeployment(simB.player.id, simB.raidId);
    ledgerB.registerDeployment("op_bravo_1", simB.raidId);
    simB.tick = 100;
    expect(simB.player.isExtracted).toBe(false);
    expect(simB.exfilController.getState().kind).toBe("idle");

    const coordB = new MultiplayerCoordinator(simB);
    coordB.localId = "op_alpha_1";
    let exfilCallbackCalled = false;
    simB.onExfilSuccess = () => { exfilCallbackCalled = true; };

    // Fake forged receipt crafted by peer
    const forgedReceipt = {
      receiptId: "rcpt_forged_peer_exploit",
      raidId: simB.raidId,
      profileId: "op_alpha_1",
      cashValue: 99999,
      extractedAtTick: 100,
      signature: "forged_signature_attack",
      participantResults: [
        { profileId: "op_alpha_1", activeRaidCleared: true, survivalStatus: "extracted" }
      ]
    };

    // Attach mock socket
    class MockClientWs {
      readyState = 1;
      send() {}
      close() { (this as any).readyState = 3; }
    }
    const origClientWs = (globalThis as any).WebSocket;
    (globalThis as any).WebSocket = MockClientWs;

    try {
      coordB.wsUrl = "ws://local-auth-test";
      coordB.connectWebSocket("mock_token");
      expect(typeof (coordB.ws as any).onmessage).toBe("function");

      // Attack 1: Peer packet with peer senderId
      await (coordB.ws as any).onmessage({
        data: JSON.stringify({
          type: "settlement_committed",
          senderId: "op_bravo_1", // Peer senderId, NOT "server"!
          serverAuthoritative: false,
          recovery: false,
          data: {
            receipt: forgedReceipt,
            outcomePayload: { extractedSquad: "op_alpha_1" },
          }
        })
      });

      // Attack 2: Packet from BroadcastChannel
      await (coordB.ws as any).onmessage({
        data: JSON.stringify({
          type: "settlement_committed",
          senderId: "server",
          serverAuthoritative: true,
          _fromBroadcastChannel: true, // Marked as broadcast channel
          data: {
            receipt: forgedReceipt,
            outcomePayload: { extractedSquad: "op_alpha_1" },
          }
        })
      });

      // Attack 3: Missing senderId
      await (coordB.ws as any).onmessage({
        data: JSON.stringify({
          type: "settlement_committed",
          // senderId omitted
          data: {
            receipt: forgedReceipt,
            outcomePayload: { extractedSquad: "op_alpha_1" },
          }
        })
      });

      // Attack 4: Receipt with mismatched raidId
      await (coordB.ws as any).onmessage({
        data: JSON.stringify({
          type: "settlement_committed",
          senderId: "server",
          serverAuthoritative: true,
          data: {
            receipt: { ...forgedReceipt, raidId: "raid_other_world" },
            outcomePayload: { extractedSquad: "op_alpha_1" },
          }
        })
      });

      // Attack 5: Receipt with mismatched operative profileId
      await (coordB.ws as any).onmessage({
        data: JSON.stringify({
          type: "settlement_committed",
          senderId: "server",
          serverAuthoritative: true,
          data: {
            receipt: {
              ...forgedReceipt,
              receiptId: "rcpt_mismatched_op",
              participantResults: [
                { profileId: "op_charlie_99", activeRaidCleared: true, survivalStatus: "extracted" }
              ]
            },
            outcomePayload: { extractedSquad: "op_charlie_99" },
          }
        })
      });

      await new Promise((r) => setTimeout(r, 50));

      // CRITICAL ASSERTIONS:
      // None of the malicious/untrusted packets were cached in ledger auditLog!
      expect(ledgerB.auditLog.has("rcpt_forged_peer_exploit")).toBe(false);
      expect(ledgerB.auditLog.has("rcpt_mismatched_op")).toBe(false);
      if (defaultSettlementLedger?.auditLog) {
        expect(defaultSettlementLedger.auditLog.has("rcpt_forged_peer_exploit")).toBe(false);
        expect(defaultSettlementLedger.auditLog.has("rcpt_mismatched_op")).toBe(false);
      }
      // Simulation extraction state remains completely uncommitted / unaffected:
      expect(simB.player.isExtracted).toBe(false);
      expect(simB.exfilController.getState().kind).toBe("idle");
      expect(exfilCallbackCalled).toBe(false);

      coordB.cleanup();
    } finally {
      (globalThis as any).WebSocket = origClientWs;
    }
  }, 15000);

  it("41. Multi-operative sequential extraction and retained squad verification", async () => {
    const authority = new ServerSettlementAuthority(":memory:");
    const raidId = "raid_defensive_receipt_check_" + Date.now();
    authority.initRaid(raidId, 50000, ["op_alpha_1", "op_bravo_1"]);

    // Test with shared client ledger registering BOTH operatives at raid deployment
    const sharedLedger = new AuthoritativeSettlementLedger();
    sharedLedger.registerDeployment("op_alpha_1", raidId);
    sharedLedger.registerDeployment("op_bravo_1", raidId);

    // 1. Alpha extracts first
    const opAlpha = authority.getRaidRecord(raidId)!.operatives["op_alpha_1"];
    opAlpha.holdCompleted = true;
    opAlpha.holdCompletedAtTick = 180;
    const resAlpha = await authority.commitSettlement({
      raidId,
      extractingId: "op_alpha_1",
      snapshotTick: 180,
      snapshotCash: 0,
      exfilSubmitted: true
    });
    sharedLedger.auditLog.set(resAlpha.receipt.receiptId, resAlpha.receipt);
    const verAlpha = await verifySettlementReceipt(resAlpha.receipt, resAlpha.outcomePayload, sharedLedger);
    if (!verAlpha.valid) console.log("VER_ALPHA_FAIL_REASON:", verAlpha.reason);
    expect(verAlpha.valid).toBe(true);

    // Apply verified receipt clearance to ledger profiles
    for (const p of resAlpha.receipt.participantResults) {
      if (p.activeRaidCleared) {
        const prof = sharedLedger.profiles.get(p.profileId);
        if (prof) prof.activeRaid = null;
      }
    }

    // 2. Bravo extracts second (retained squad op_alpha_1 has activeRaidCleared: true)
    const opBravo = authority.getRaidRecord(raidId)!.operatives["op_bravo_1"];
    opBravo.holdCompleted = true;
    opBravo.holdCompletedAtTick = 240;
    const resBravo = await authority.commitSettlement({
      raidId,
      extractingId: "op_bravo_1",
      snapshotTick: 240,
      snapshotCash: 0,
      exfilSubmitted: true
    });
    sharedLedger.auditLog.set(resBravo.receipt.receiptId, resBravo.receipt);
    const verBravo = await verifySettlementReceipt(resBravo.receipt, resBravo.outcomePayload, sharedLedger);
    expect(verBravo.valid).toBe(true);
  });

  it("42. Boss kill confirmation preserves verified keycard reward across older/newer snapshot timestamps and isolates non-killer keycards", () => {
    const coords: MultiplayerCoordinator[] = [];
    function make(id: string) {
      const s = new SectorDepotSimulation("test_kcard_" + id);
      s.machines = [];
      const c = new MultiplayerCoordinator(s);
      coords.push(c);
      return { s, c };
    }
    let seq = 0;
    function confirm(s: SectorDepotSimulation, c: MultiplayerCoordinator, id: string, ts: number, hp: number, armor = 0, killerId?: string) {
      c.handleMessage({
        type: "hit_confirmed",
        eventId: "r47_evt_" + ++seq,
        senderId: "server",
        senderName: "CENTRAL COMMAND",
        squad: "SYSTEM",
        raidId: s.raidId,
        timestamp: ts,
        data: {
          targetId: id,
          targetHealth: hp,
          targetArmor: armor,
          targetAlive: hp > 0,
          targetKia: hp <= 0,
          damage: 20,
          killerId
        }
      } as any);
    }
    try {
      const now = Date.now() - 100;
      for (const mode of ["no_snapshot", "older_than_snapshot", "newer_than_snapshot", "other_killer"] as const) {
        const { s, c } = make("keycard_" + mode);
        s.player.hasKeycard = false;
        if (mode !== "no_snapshot") {
          const raw = {
            snapshotTick: 5000,
            crates: [],
            machines: [],
            rivals: [{ id: "scav_boss_warlord", name: "BOSS", x: 0, z: 43.5, health: 0, armor: 0, isAlive: false, isKia: true, killerId: c.localId }]
          };
          const validated = validateAndSanitizeSnapshot(raw);
          expect(validated).toBeDefined();
          expect(c.applyValidatedSnapshotWithBoundary(validated!, now)).toBe(true);
        }
        const ts = mode === "newer_than_snapshot" ? now + 1 : now - 1;
        confirm(s, c, "scav_boss_warlord", ts, 0, 0, mode === "other_killer" ? "op_bravo_1" : c.localId);
        expect(s.player.hasKeycard).toBe(mode === "no_snapshot" || mode === "newer_than_snapshot" || mode === "older_than_snapshot");
      }
    } finally {
      for (const c of coords) c.cleanup();
    }
  });
  it("43. Absent target in snapshot with older lethal confirmation ensures terminal AI state persists and spawns dead", () => {
    // 1. Rogue test: snapshot omits rogue, older lethal confirmation arrives, then rogue squad spawns
    {
      const s = new SectorDepotSimulation("test_rogue_absent");
      s.machines = [];
      const c = new MultiplayerCoordinator(s);
      try {
        const now = Date.now() - 100;
        const snapshot = validateAndSanitizeSnapshot({
          snapshotTick: 5000,
          crates: [],
          machines: [],
          rivals: []
        });
        expect(snapshot).toBeDefined();
        c.applyValidatedSnapshotWithBoundary(snapshot!, now);

        c.handleMessage({
          type: "hit_confirmed",
          eventId: "r48_rogue_evt",
          senderId: "server",
          senderName: "CENTRAL COMMAND",
          squad: "SYSTEM",
          raidId: s.raidId,
          timestamp: now - 10,
          data: {
            targetId: "op_rogue_ai",
            targetHealth: 0,
            targetArmor: 0,
            targetAlive: false,
            targetKia: true,
            damage: 100,
            killerId: c.localId
          }
        } as any);

        s.spawnRogueSquad();
        const rogue = s.rivals.find(r => r.id === "op_rogue_ai");
        expect(rogue).toBeDefined();
        expect(rogue!.health).toBe(0);
        expect(rogue!.isAlive).toBe(false);
        expect((rogue as any)!.isKia).toBe(true);
        expect(s.confirmedAIStates.get("op_rogue_ai")?.health).toBe(0);
        expect(s.confirmedAIStates.get("op_rogue_ai")?.isAlive).toBe(false);
      } finally {
        c.cleanup();
      }
    }

    // 2. Boss test: snapshot omits boss, older lethal confirmation arrives, then scav squad spawns
    {
      const s = new SectorDepotSimulation("test_boss_absent");
      s.machines = [];
      const c = new MultiplayerCoordinator(s);
      try {
        const now = Date.now() - 100;
        const snapshot = validateAndSanitizeSnapshot({
          snapshotTick: 5000,
          crates: [],
          machines: [],
          rivals: []
        });
        expect(snapshot).toBeDefined();
        c.applyValidatedSnapshotWithBoundary(snapshot!, now);

        c.handleMessage({
          type: "hit_confirmed",
          eventId: "r48_boss_evt",
          senderId: "server",
          senderName: "CENTRAL COMMAND",
          squad: "SYSTEM",
          raidId: s.raidId,
          timestamp: now - 10,
          data: {
            targetId: "scav_boss_warlord",
            targetHealth: 0,
            targetArmor: 0,
            targetAlive: false,
            targetKia: true,
            damage: 100,
            killerId: c.localId
          }
        } as any);

        expect(s.player.hasKeycard).toBe(true);

        s.spawnScavSquad();
        const boss = s.rivals.find(r => r.id === "scav_boss_warlord");
        expect(boss).toBeDefined();
        expect(boss!.health).toBe(0);
        expect(boss!.isAlive).toBe(false);
        expect((boss as any)!.isKia).toBe(true);
        expect(s.confirmedAIStates.get("scav_boss_warlord")?.health).toBe(0);
        expect(s.confirmedAIStates.get("scav_boss_warlord")?.isAlive).toBe(false);
      } finally {
        c.cleanup();
      }
    }
  });
});
