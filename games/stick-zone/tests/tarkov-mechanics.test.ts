import { computePrefabObstacleBox, PREFAB_CATALOG, FOB_PREFABS, FOB_PREFAB_OBSTACLES } from "../src/sim/prefabs.js";
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SectorDepotSimulation, type GameInput } from '../src/sim/game.js';
import { authoritativeLedgerCommit, verifySettlementReceipt, AuthoritativeSettlementLedger, registerDeployment, defaultSettlementLedger } from '../src/sim/airlock.js';
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

  it('4b. Propital stim is not wasted at full health without bleeding', () => {
    sim.machines = [];
    sim.rivals = [];
    sim.player.health = 100;
    sim.player.isBleeding = false;
    sim.player.stimsRemaining = 2;

    expect(sim.useStim()).toBe(false);
    expect(sim.player.isUsingStim).toBeFalsy();
    expect(sim.player.stimsRemaining).toBe(2);

    // Bleeding at full health is still a valid stim target.
    sim.player.isBleeding = true;
    expect(sim.useStim()).toBe(true);
    expect(sim.player.isUsingStim).toBe(true);
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
    boss.x = 0;
    boss.z = 43.5;
    (boss as any).playerAlertTicks = 120;
    sim.player.x = 0;
    sim.player.z = 42;
    sim.player.facing = 0;

    sim.step(makeInput({ dx: 0, dz: 0, shoot: false, interact: false, kick: true }));
    for (let i = 0; i < 16; i++) {
      sim.step(makeInput({ dx: 0, dz: 0, shoot: false, interact: false, kick: false }));
    }
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

  it('28. Gunfire acoustic propagation: gunshot alerts unaware AI within 45m and ignores distant AI', () => {
    sim.rivals = [];
    sim.machines = []; // Isolate AI combat from stationary turret fire
    sim.player.x = 0;
    sim.player.z = 0;
    sim.player.facing = 0;
    sim.player.ammo = 30;

    // AI 1 within 45m (distance = 25m)
    sim.rivals.push({
      id: 'scav_close',
      isPlayer: false,
      isRival: true,
      isAI: true,
      name: 'Scav Close',
      x: 0,
      y: 0,
      z: 25,
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
    });

    // AI 2 outside 45m (distance = 60m)
    sim.rivals.push({
      id: 'scav_far',
      isPlayer: false,
      isRival: true,
      isAI: true,
      name: 'Scav Far',
      x: 0,
      y: 0,
      z: 60,
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
    });

    expect((sim.rivals[0] as any).playerAlertTicks).toBeUndefined();
    expect((sim.rivals[1] as any).playerAlertTicks).toBeUndefined();

    // Player fires rifle west (-X), missing both scavs located to the south (+Z)
    sim.player.facing = -Math.PI / 2;
    sim.fire();

    // Close AI is alerted and turned towards sound
    expect((sim.rivals[0] as any).playerAlertTicks).toBe(240);
    expect(sim.rivals[0].barkText).toBeDefined();
    expect(sim.rivals[0].barkTick).toBe(sim.tick);

    // Far AI is outside hearing distance and remains unaware
    expect((sim.rivals[1] as any).playerAlertTicks).toBeUndefined();
  });

  it('29. Boss bodyguard aggro linking: damaging Warlord commands guards to converge; damaging guard alerts Warlord', () => {
    sim.rivals = [];
    sim.spawnScavSquad();

    const boss = sim.rivals.find(r => r.id === 'scav_boss_warlord')!;
    const runner = sim.rivals.find(r => r.id === 'scav_runner_01')!;
    const enforcer = sim.rivals.find(r => r.id === 'scav_enforcer_02')!;

    expect((runner as any).convergeOnPlayer).toBeFalsy();
    expect((enforcer as any).convergeOnPlayer).toBeFalsy();

    // Attack Boss
    sim.handleRivalDamage(boss, 30);

    // Both bodyguards immediately receive alert and converge directive
    expect((runner as any).playerAlertTicks).toBe(360);
    expect((runner as any).convergeOnPlayer).toBe(true);
    expect(runner.barkText).toBeDefined();

    expect((enforcer as any).playerAlertTicks).toBe(360);
    expect((enforcer as any).convergeOnPlayer).toBe(true);
    expect(enforcer.barkText).toBeDefined();

    // Attack a guard -> alerts the Boss
    boss.barkText = undefined;
    sim.handleRivalDamage(runner, 20);
    expect((boss as any).playerAlertTicks).toBe(360);
    expect(boss.barkText).toBeDefined();
    expect(sim.recentBark?.isBoss).toBe(true);
  });

  it('30. Scav pre-attack telegraph: target acquisition emits vocal bark and wind-up delay before discharge', () => {
    sim.rivals = [];
    sim.machines = []; // Isolate Scav telegraph from background machine fire
    sim.player.x = 0;
    sim.player.z = 0;
    sim.player.health = 100;
    sim.player.armor = 100;

    // Spawn Scav Runner in line of sight at 10m
    sim.rivals.push({
      id: 'scav_runner_01',
      isPlayer: false,
      isRival: true,
      isAI: true,
      badge: 'SCAV PATROL',
      name: 'Scav Runner',
      x: 0,
      y: 0,
      z: 10,
      facing: Math.PI,
      health: 80,
      armor: 0,
      cash: 500,
      action: 'idle',
      actionTicks: 0,
      isInvulnerable: false,
      isAlive: true,
      isExtracted: false,
      ammo: 30,
      maxAmmo: 30,
      shootCooldownTicks: 0,
    });

    const scav = sim.rivals[0];

    // Step 1: Scav acquires target, initiates telegraph wind-up (20 ticks) and emits voice bark
    sim.step(makeInput({ dx: 0, dz: 0 }));
    expect(scav.aimTicks).toBe(20);
    expect(scav.barkText).toBeDefined();
    expect(sim.player.health).toBe(100); // Has NOT fired yet! Telegraph provides reaction window

    // Step 20 ticks until discharge
    for (let i = 0; i < 20; i++) {
      sim.step(makeInput({ dx: 0, dz: 0 }));
    }

    // Now weapon discharges and deals damage
    expect(scav.action).toBe('shoot');
    // Projectile travels 10m to player (~12 ticks)
    for (let i = 0; i < 12; i++) {
      sim.step(makeInput({ dx: 0, dz: 0 }));
    }
    expect(sim.player.armor).toBe(76); // 24 damage absorbed by armor (100 - 24)
  });

  it('31. Aim punch telemetry: player damage records tick, amount, and directional angle', () => {
    sim.player.x = 10;
    sim.player.z = 10;
    sim.lastPlayerDamageTick = 0;

    // Attacker fires from (10, 20) -> relative dz = +10, dx = 0, angle = 0
    sim.applyDamageToPlayer(15, 10, 20);

    expect(sim.lastPlayerDamageTick).toBe(sim.tick);
    expect(sim.lastPlayerDamageAmount).toBe(15);
    expect(sim.lastPlayerDamageAngle).toBeCloseTo(0, 2);
  });

  it('32. AI Frag Grenade flush: when player holds container cover, Scav AI tosses F-1 grenade with fuse and blast falloff', () => {
    sim.rivals = [];
    sim.machines = [];
    sim.activeGrenades = [];
    sim.player.x = 0;
    sim.player.z = 15;
    sim.player.health = 100;
    sim.player.armor = 100;

    // Place Scav at (0, 0)
    sim.rivals.push({
      id: 'scav_grenadier',
      isPlayer: false,
      isRival: true,
      isAI: true,
      badge: 'SCAV PATROL',
      name: 'Scav Grenadier',
      x: 0,
      y: 0,
      z: 0,
      facing: 0,
      health: 80,
      armor: 0,
      cash: 500,
      action: 'idle',
      actionTicks: 0,
      isInvulnerable: false,
      isAlive: true,
      isExtracted: false,
      ammo: 30,
      maxAmmo: 30,
    });

    const scav = sim.rivals[0];
    (scav as any).playerAlertTicks = 240; // In combat
    (scav as any).grenadeCooldownTicks = 0; // Ready to throw

    const origRay = sim.checkContainerRayObstruction.bind(sim);
    sim.checkContainerRayObstruction = (x1, z1, x2, z2) => {
      // Direct horizontal ray between scav (z <= 1) and player (z >= 14) is blocked by cover
      if ((z1 <= 1 && z2 >= 14) || (z2 <= 1 && z1 >= 14)) return true;
      return false; // Air arc and grenade landing position has clear detonation cone
    };

    // Step simulation: Scav detects player in cover and lobs F-1 grenade over cover
    sim.step(makeInput({ dx: 0, dz: 0 }));

    expect(sim.activeGrenades.length).toBe(1);
    const grenade = sim.activeGrenades[0];
    expect(grenade.throwerId).toBe('scav_grenadier');
    expect(grenade.fuseTicks).toBe(89); // 90 minus 1 on step
    expect(grenade.vy).toBeGreaterThan(0); // Arcing upward
    expect(scav.barkText).toBeDefined();

    // Fast-forward fuse countdown (remaining 89 ticks) to trigger detonation
    for (let i = 0; i < 89; i++) {
      sim.step(makeInput({ dx: 0, dz: 0 }));
    }

    // Grenade detonated and removed from active list
    expect(sim.activeGrenades.length).toBe(0);
    // Player sustained fragmentation blast damage
    expect(sim.player.armor).toBeLessThan(100);
    expect(sim.combatLog.some(msg => msg.includes('F-1 fragmentation blast'))).toBe(true);

    sim.checkContainerRayObstruction = origRay;
  });

  it('33. Dynamic concealment & shadow detection: crouching reduces visual spotting range to 15m and acoustic footprint to 4m', () => {
    sim.rivals = [];
    sim.machines = [];
    sim.player.x = 0;
    sim.player.z = 20;

    // Scav facing North towards player (facing = 0, player at z = 20, distance = 20m)
    sim.rivals.push({
      id: 'scav_sentry',
      isPlayer: false,
      isRival: true,
      isAI: true,
      badge: 'SCAV PATROL',
      name: 'Scav Sentry',
      x: 0,
      y: 0,
      z: 0,
      facing: 0,
      health: 80,
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

    const scav = sim.rivals[0];

    // Scenario A: Player crouches at 20m (within standing visual range of 28m, but outside crouch visual range of 15m)
    sim.step(makeInput({ dx: 0, dz: 0, crouch: true }));
    expect(sim.player.isCrouching).toBe(true);
    // Scav does NOT spot crouching player at 20m!
    expect((scav as any).playerAlertTicks || 0).toBe(0);

    // Scenario B: Player stands up at 20m (within standing visual range of 28m)
    sim.step(makeInput({ dx: 0, dz: 0, crouch: false }));
    expect(sim.player.isCrouching).toBe(false);
    // Scav immediately spots standing player at 20m!
    expect((scav as any).playerAlertTicks).toBe(300);

    // Scenario C: Acoustic stealth. Reset alert and put Scav facing away (facing = PI, looking South).
    (scav as any).playerAlertTicks = 0;
    scav.facing = Math.PI;
    sim.player.x = 0;
    sim.player.z = 6; // Distance = 6m behind scav

    // Crouching sneaking at 6m: acoustic detection range is 4m, so Scav remains unaware!
    sim.step(makeInput({ dx: 0, dz: 0, crouch: true }));
    expect((scav as any).playerAlertTicks || 0).toBe(0);

    // Walking at 6m: standing footstep acoustic range is 10m, so Scav hears the player and alerts!
    sim.step(makeInput({ dx: 0, dz: 0, crouch: false }));
    expect((scav as any).playerAlertTicks).toBe(300);
  });

  it("34. Directional damage indicator telemetry: calculates Cardinal and Ordinal angles and maintains damage indicator pool", () => {
    sim.zoneMode = "spoke";
    sim.player.isAlive = true;
    sim.player.isInvulnerable = false;
    sim.player.x = 0;
    sim.player.z = 0;
    sim.rivals = [];
    sim.machines = [];
    sim.damageIndicators = [];

    // Hit from North (attacker at 0, -10): dx = 0, -dz = 10 -> angle = 0 deg
    sim.applyDamageToPlayer(10, 0, -10);
    expect(sim.lastDamageDirectionDeg).toBe(0);
    expect(sim.damageIndicators.length).toBe(1);
    expect(sim.damageIndicators[0].angleDeg).toBe(0);
    expect(sim.damageIndicators[0].damage).toBe(10);

    // Hit from East (attacker at 10, 0): dx = 10, -dz = 0 -> angle = 90 deg
    sim.applyDamageToPlayer(15, 10, 0);
    expect(sim.lastDamageDirectionDeg).toBe(90);
    expect(sim.damageIndicators.length).toBe(2);
    expect(sim.damageIndicators[1].angleDeg).toBe(90);

    // Hit from South (attacker at 0, 10): dx = 0, -dz = -10 -> angle = 180 deg
    sim.applyDamageToPlayer(20, 0, 10);
    expect(sim.lastDamageDirectionDeg).toBe(180);
    expect(sim.damageIndicators.length).toBe(3);
    expect(sim.damageIndicators[2].angleDeg).toBe(180);

    // Hit from West (attacker at -10, 0): dx = -10, -dz = 0 -> angle = -90 deg
    sim.applyDamageToPlayer(12, -10, 0);
    expect(sim.lastDamageDirectionDeg).toBe(-90);
    expect(sim.damageIndicators.length).toBe(4);
    expect(sim.damageIndicators[3].angleDeg).toBe(-90);

    // Advance 95 ticks: step() must prune expired damage indicators
    for (let i = 0; i < 95; i++) {
      sim.step(makeInput());
    }
    expect(sim.damageIndicators.length).toBe(0);
  });

  it('35. Authoritative Prefab System: Environment prop prefabs automatically generate synchronized collision geometry', () => {
    // 1. Rotation and Scale AABB derivation
    const barrierDef = PREFAB_CATALOG.barrierConcrete;
    expect(barrierDef).toBeDefined();
    expect(barrierDef.collision).toBeDefined();

    // Standard unrotated barrier at (0, 0, 0)
    const unrotatedBox = computePrefabObstacleBox({
      id: "test_unrotated",
      prefabKey: "barrierConcrete",
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: 1.0,
    });
    expect(unrotatedBox).toBeDefined();
    expect(unrotatedBox?.maxX).toBeCloseTo(1.1, 1);
    expect(unrotatedBox?.maxZ).toBeCloseTo(0.35, 1);

    // 90-degree rotated barrier (halfWidth and halfDepth swap axes)
    const rotatedBox = computePrefabObstacleBox({
      id: "test_rotated",
      prefabKey: "barrierConcrete",
      position: [10, 0, 20],
      rotation: [0, Math.PI / 2, 0],
      scale: 1.0,
    });
    expect(rotatedBox).toBeDefined();
    expect((rotatedBox!.maxX) - (rotatedBox!.minX)).toBeCloseTo(0.7, 1);
    expect((rotatedBox!.maxZ) - (rotatedBox!.minZ)).toBeCloseTo(2.2, 1);

    // 2. Placed FOB prefabs generate physical collision automatically in game simulation
    expect(FOB_PREFABS.length).toBeGreaterThanOrEqual(15);
    expect(FOB_PREFAB_OBSTACLES.length).toBeGreaterThanOrEqual(15);

    // Workbench at [-5.6, 0, -69.8] blocks entry
    expect(sim.checkContainerCollision(-5.6, -69.8, 0.45)).toBe(true);

    // Diesel generator at [6.5, 0, -63.0] blocks entry
    expect(sim.checkContainerCollision(6.5, -63.0, 0.45)).toBe(true);

    // Firing stall barrier partition at [-3.3, 0, -61.2] blocks entry
    expect(sim.checkContainerCollision(-3.3, -61.2, 0.45)).toBe(true);

    // 3. Bullet ray obstruction through placed prefabs
    const rayBlockedByGenerator = sim.checkContainerRayObstruction(4.0, -63.0, 9.0, -63.0, 1.0, 1.0);
    expect(rayBlockedByGenerator).toBe(true);

    const rayBlockedByWorkbench = sim.checkContainerRayObstruction(-3.0, -69.8, -8.0, -69.8, 1.0, 1.0);
    expect(rayBlockedByWorkbench).toBe(true);

    // 4. Critical corridors and test coordinates remain completely unobstructed
    // Central runway corridor at x = 0
    expect(sim.checkContainerCollision(0.0, -66.0, 0.45)).toBe(false);
    expect(sim.checkContainerCollision(0.0, -60.0, 0.45)).toBe(false);
    expect(sim.checkContainerCollision(0.0, -54.0, 0.45)).toBe(false);

    // Firing range shooting line to dummy [-5, 0, -60] to [-5, 0, -64]
    expect(sim.checkContainerCollision(-5.0, -60.0, 0.45)).toBe(false);
    expect(sim.checkContainerRayObstruction(-5.0, -60.0, -5.0, -63.9, 1.0, 1.0)).toBe(false);

    // Looting point at training supply locker [4.5, 0, -63.0]
    expect(sim.checkContainerCollision(4.5, -63.0, 0.45)).toBe(false);
  });
});
