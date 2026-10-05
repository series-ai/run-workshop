import { describe, it, expect, beforeEach } from 'vitest';
import { SectorDepotSimulation } from '../src/sim/game.js';
import { SIM_CONFIG } from '../src/sim/config.js';
import { StagedIngressController, createExfilController } from '../src/sim/airlock.js';
import { verifyReceiptIntegrity, type SettlementReceipt } from '@series-inc/rundot-syncplay/extensions/hub';
import type { RaidId, ProfileId } from '@series-inc/rundot-syncplay/extensions/hub';

describe('Stick Zone: Exfil Simulation & Lifecycle Verification', () => {
  let sim: SectorDepotSimulation;

  beforeEach(() => {
    sim = new SectorDepotSimulation();
  });

  it('1. staged ingress cutoff: tick > 28,800 rejects admission', () => {
    const ingress = new StagedIngressController();
    expect(ingress.enterCorridor(10_000)).toBe(true);
    expect(ingress.getState().kind).toBe('corridor_entered');

    const expiredIngress = new StagedIngressController();
    expect(expiredIngress.enterCorridor(28_801)).toBe(false);
    expect(expiredIngress.getState().kind).toBe('idle');
  });

  it('2. 2m AI fallback: squad count == 1 at tick 7,200 spawns ROGUE AI OPERATOR', () => {
    expect(sim.rivals.length).toBe(0);

    // Step simulation up to tick 7,200
    for (let t = 0; t < 7200; t++) {
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

    expect(sim.tick).toBe(7200);
    expect(sim.rivals.length).toBe(1);
    expect(sim.rivals[0].badge).toBe('ROGUE AI OPERATOR');
    expect(sim.rivals[0].name).toBe('KAGE-01');
  });

  it('3. radar threshold: distance <= 60m triggers alert with bearing; distance > 60m clears to ALL CLEAR', () => {
    sim.spawnRogueSquad();
    const rogue = sim.rivals[0];

    // Place rogue at 70m distance (outside radar)
    rogue.x = sim.player.x + 70;
    rogue.z = sim.player.z;

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

    expect(sim.proximityAlert.active).toBe(false);

    // Move rogue within 45m distance (inside radar)
    rogue.x = sim.player.x + 45;
    rogue.z = sim.player.z;

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

    expect(sim.proximityAlert.active).toBe(true);
    expect(sim.proximityAlert.distance).toBe(45);
    expect(sim.proximityAlert.bearing).toBe(90); // Direct East
    expect(sim.proximityAlert.isRogueAI).toBe(true);
  });

  it('4. exfil hold determinism: 179 ticks fails exfil; 180 ticks triggers 2500ms corridor', () => {
    let fakeNow = 1000;
    const exfil = createExfilController({ now: () => fakeNow });

    // 179 ticks inside zone
    for (let t = 1; t <= 179; t++) {
      exfil.onTick(t, true, 'lz_sector_7', 0);
    }
    expect(exfil.getState().kind).toBe('holding_zone');
    if (exfil.getState().kind === 'holding_zone') {
      expect((exfil.getState() as any).currentTicks).toBe(179);
    }

    // 180th tick completes hold and transitions to corridor_presentation
    exfil.onTick(180, true, 'lz_sector_7', 0);
    expect(exfil.getState().kind).toBe('corridor_presentation');
    expect(exfil.isInputLocked()).toBe(true);
  });

  it('5. damage reset: taking any damage inside zone resets hold ticks to 0 and idle state', () => {
    let fakeNow = 1000;
    const exfil = createExfilController({ now: () => fakeNow });

    // Advance 60 ticks
    for (let t = 1; t <= 60; t++) {
      exfil.onTick(t, true, 'lz_sector_7', 0);
    }
    expect(exfil.getState().kind).toBe('holding_zone');

    // Take damage on tick 61
    exfil.onTick(61, true, 'lz_sector_7', 15);
    expect(exfil.getState().kind).toBe('idle');
  });

  it('6. receipt validation: strict canonical BigInt grammar is enforced', () => {
    const validReceipt: SettlementReceipt = {
      v: 1,
      receiptId: 'receipt_s7_ok',
      raidId: 'raid_sector7' as RaidId,
      outcomeId: 'outcome_ok',
      intentHash: 'hash_1',
      outcomeDigest: 'digest_1',
      throughTick: 14400,
      committedAtMs: 2000,
      participantResults: [
        {
          profileId: 'p_alpha' as ProfileId,
          releasedEscrowIds: ['esc_1'],
          inventoryRevision: 1,
          activeRaidCleared: true,
        },
      ],
      transfers: [
        {
          itemId: 'cash',
          quantity: 'BE:5000',
          toProfileId: 'p_alpha' as ProfileId,
          source: 'world_spawn',
        },
      ],
    };

    expect(verifyReceiptIntegrity(validReceipt)).toBe(true);

    const malformedReceipt: SettlementReceipt = {
      ...validReceipt,
      transfers: [
        {
          itemId: 'cash',
          quantity: '+5000', // Leading sign forbidden
          toProfileId: 'p_alpha' as ProfileId,
          source: 'world_spawn',
        },
      ],
    };

    expect(verifyReceiptIntegrity(malformedReceipt)).toBe(false);
  });
});
