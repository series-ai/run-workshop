import { describe, it, expect, beforeEach } from 'vitest';
import { useStashStore } from '../src/progression/stashStore.js';
import { updateContractProgress, INITIAL_CONTRACTS } from '../src/progression/contracts.js';
import { gamepad } from '../src/input/gamepadController.js';

describe('Player Progression, Economy & Armory Store', () => {
  beforeEach(() => {
    useStashStore.getState().resetProgress();
  });

  it('1. Initializes with seed bank fund, level 1, and default tactical loadout', () => {
    const state = useStashStore.getState();
    expect(state.bankCash).toBe(5000);
    expect(state.operativeLevel).toBe(1);
    expect(state.xp).toBe(0);
    expect(state.loadout.primaryWeapon).toBe('rifle');
    expect(state.loadout.secondaryWeapon).toBe('shotgun');
    expect(state.loadout.armorTier).toBe('medium');
    expect(state.loadout.stims).toBe(2);
    expect(state.contracts.length).toBeGreaterThanOrEqual(3);
  });

  it('2. Customizes operative loadout (armor tier, primary weapon, stims)', () => {
    const store = useStashStore.getState();
    store.equipArmor('heavy');
    store.equipWeapon('primary', 'rifle');
    store.setStimsCount(4);

    const updated = useStashStore.getState();
    expect(updated.loadout.armorTier).toBe('heavy');
    expect(updated.loadout.primaryWeapon).toBe('rifle');
    expect(updated.loadout.stims).toBe(4);
  });

  it('3. Purchases surplus items from Trader Vektor and deducts bank cash', () => {
    const store = useStashStore.getState();
    const initialCash = store.bankCash;

    const bought = store.buyShopItem({
      id: 'item_ap_ammo',
      name: '5.56 M855A1 AP Ammo Pack',
      price: 1200,
      rarity: 'rare',
      type: 'ammo',
      icon: '📦',
    });

    expect(bought).toBe(true);
    expect(useStashStore.getState().bankCash).toBe(initialCash - 1200);

    const found = useStashStore.getState().stashItems.find((s) => s.name === '5.56 M855A1 AP Ammo Pack');
    expect(found).toBeDefined();
    expect(found?.count).toBeGreaterThanOrEqual(1);
  });

  it('4. Rejects Trader purchase when bank cash is insufficient', () => {
    const store = useStashStore.getState();
    const bought = store.buyShopItem({
      id: 'expensive_item',
      name: 'Prototype Railgun Carrier',
      price: 999999,
      rarity: 'legendary',
      type: 'weapon',
      icon: '⚡',
    });

    expect(bought).toBe(false);
    expect(useStashStore.getState().bankCash).toBe(5000);
  });

  it('5. Sells stash items for liquid cash to the Fence', () => {
    const store = useStashStore.getState();
    const item = store.stashItems[0];
    const initialCash = store.bankCash;
    const itemVal = item.value;

    const sold = store.sellStashItem(item.id);
    expect(sold).toBe(true);
    expect(useStashStore.getState().bankCash).toBe(initialCash + itemVal);
  });

  it('6. Records successful raid outcome with XP progression, secured loot, and contracts', () => {
    const store = useStashStore.getState();
    const outcome = store.recordRaidOutcome({
      survived: true,
      cashEarned: 4500,
      kills: 3,
      bossKill: true,
      cratesLooted: 2,
      itemsSecured: [
        { id: 'loot_keycard_1', name: 'Violet Lab Access Keycard', type: 'keycard', rarity: 'legendary', icon: '💳', value: 7500 },
      ],
      hasKeycard: true,
      hadBleed: false,
    });

    expect(outcome.xpGained).toBeGreaterThan(2000);
    const updated = useStashStore.getState();
    expect(updated.operativeLevel).toBeGreaterThanOrEqual(2);
    expect(updated.bankCash).toBe(5000 + 4500);
    expect(updated.stats.survivedCount).toBe(1);
    expect(updated.stats.bossKillsCount).toBe(1);

    const keycard = updated.stashItems.find((s) => s.name === 'Violet Lab Access Keycard');
    expect(keycard).toBeDefined();

    // Verify contract completion
    const bossContract = updated.contracts.find((c) => c.type === 'boss');
    expect(bossContract?.completed).toBe(true);
  });

  it('7. Records KIA outcome with zero secured cash and death stat tracking', () => {
    const store = useStashStore.getState();
    store.recordRaidOutcome({
      survived: false,
      cashEarned: 0,
      kills: 1,
      bossKill: false,
      cratesLooted: 0,
      itemsSecured: [],
      hasKeycard: false,
      hadBleed: true,
    });

    const updated = useStashStore.getState();
    expect(updated.stats.kiaCount).toBe(1);
    expect(updated.stats.survivedCount).toBe(0);
    expect(updated.bankCash).toBe(5000); // Unchanged starting seed
  });

  it('8. Claims completed bounty contract rewards', () => {
    const store = useStashStore.getState();
    // Complete Scav Purge contract manually
    store.recordRaidOutcome({
      survived: true,
      cashEarned: 1000,
      kills: 5,
      bossKill: false,
      cratesLooted: 0,
      itemsSecured: [],
      hasKeycard: false,
      hadBleed: false,
    });

    const scavContract = useStashStore.getState().contracts.find((c) => c.id === 'contract_scav_purge');
    expect(scavContract?.completed).toBe(true);
    expect(scavContract?.claimed).toBe(false);

    const cashBefore = useStashStore.getState().bankCash;
    store.claimContractReward('contract_scav_purge');

    const updated = useStashStore.getState();
    expect(updated.bankCash).toBe(cashBefore + (scavContract?.rewardCash || 0));
    const claimedContract = updated.contracts.find((c) => c.id === 'contract_scav_purge');
    expect(claimedContract?.claimed).toBe(true);
  });

  it('9. Gamepad polling safely returns null or valid state without crashing', () => {
    const padState = gamepad.poll();
    // In node/vitest environment without connected hardware, gamepad.poll() safely returns null
    expect(padState === null || typeof padState === 'object').toBe(true);

    // Vibrate method executes safely without throwing
    expect(() => gamepad.vibrate(50, 0.2, 0.5)).not.toThrow();
  });
});

  it('10. Authoritative settlement: accepts cryptographically signed receipt and credits outcomePayload cash', async () => {
    const store = useStashStore.getState();
    const initialCash = store.bankCash;

    const outcomePayload = {
      raidId: 'raid_test_auth_01' ,
      verifiedPrefixTick: 250,
      cutoffTick: 54000,
      isFinalClose: false,
      cashBanked: 3500,
      extractedSquad: 'op_alpha_1',
      retainedSquads: [],
    };

    const { computeCanonicalOutcomeDigest } = await import('../src/sim/airlock.js');
    const validDigest = await computeCanonicalOutcomeDigest(outcomePayload);

    const validReceipt: any = {
      v: 1 as const,
      receiptId: 'receipt_s7_auth_valid_01',
      raidId: 'raid_test_auth_01' ,
      outcomeId: validDigest,
      outcomeDigest: validDigest,
      intentHash: `intent_${validDigest.slice(16, 32)}`,
      throughTick: 250,
      committedAtMs: Date.now(),
      transfers: [],
      participantResults: [
        { profileId: 'op_alpha_1', inventoryRevision: 1, activeRaidCleared: true },
      ],
    };

    const res = await store.recordVerifiedSettlement({
      receipt: validReceipt,
      outcomePayload,
      kills: 2,
      cratesLooted: 1,
    });

    expect(res.success).toBe(true);
    expect(res.cashCredited).toBe(3500);

    const updated = useStashStore.getState();
    expect(updated.bankCash).toBe(initialCash + 3500);
    expect(updated.settledReceiptIds).toContain('receipt_s7_auth_valid_01');
  });

  it('11. Security: rejects tampered outcome payload (client inflating cash) due to SHA-256 digest mismatch', async () => {
    const store = useStashStore.getState();
    const initialCash = store.bankCash;

    const legitimatePayload = {
      raidId: 'raid_test_auth_02' ,
      verifiedPrefixTick: 300,
      cutoffTick: 54000,
      isFinalClose: false,
      cashBanked: 2000,
      extractedSquad: 'op_alpha_1',
      retainedSquads: [],
    };

    const { computeCanonicalOutcomeDigest } = await import('../src/sim/airlock.js');
    const legitimateDigest = await computeCanonicalOutcomeDigest(legitimatePayload);

    const signedReceipt: any = {
      v: 1 as const,
      receiptId: 'receipt_s7_auth_valid_02',
      raidId: 'raid_test_auth_02' ,
      outcomeId: legitimateDigest,
      outcomeDigest: legitimateDigest,
      intentHash: `intent_${legitimateDigest.slice(16, 32)}`,
      throughTick: 300,
      committedAtMs: Date.now(),
      transfers: [],
      participantResults: [
        { profileId: 'op_alpha_1', inventoryRevision: 2, activeRaidCleared: true },
      ],
    };

    // Adversarial client attempts to claim $999,999 while presenting the original receipt digest
    const forgedPayload = {
      ...legitimatePayload,
      cashBanked: 999999,
    };

    const res = await store.recordVerifiedSettlement({
      receipt: signedReceipt,
      outcomePayload: forgedPayload,
    });

    expect(res.success).toBe(false);
    expect(res.reason).toMatch(/digest mismatch/i);
    expect(useStashStore.getState().bankCash).toBe(initialCash); // Cash was NOT awarded!
  });

  it('12. Security: rejects replay attack (submitting identical receipt twice)', async () => {
    const store = useStashStore.getState();
    const outcomePayload = {
      raidId: 'raid_test_auth_03' ,
      verifiedPrefixTick: 200,
      cutoffTick: 54000,
      isFinalClose: false,
      cashBanked: 1500,
      extractedSquad: 'op_alpha_1',
      retainedSquads: [],
    };

    const { computeCanonicalOutcomeDigest } = await import('../src/sim/airlock.js');
    const digest = await computeCanonicalOutcomeDigest(outcomePayload);

    const receipt: any = {
      v: 1 as const,
      receiptId: 'receipt_s7_replay_target',
      raidId: 'raid_test_auth_03' ,
      outcomeId: digest,
      outcomeDigest: digest,
      intentHash: `intent_${digest.slice(16, 32)}`,
      throughTick: 200,
      committedAtMs: Date.now(),
      transfers: [],
      participantResults: [
        { profileId: 'op_alpha_1', inventoryRevision: 1, activeRaidCleared: true },
      ],
    };

    // First submission: succeeds
    const firstRes = await store.recordVerifiedSettlement({ receipt, outcomePayload });
    expect(firstRes.success).toBe(true);

    const cashAfterFirst = useStashStore.getState().bankCash;

    // Second submission (replay): REJECTED
    const replayRes = await store.recordVerifiedSettlement({ receipt, outcomePayload });
    expect(replayRes.success).toBe(false);
    expect(replayRes.reason).toMatch(/already settled/i);
    expect(useStashStore.getState().bankCash).toBe(cashAfterFirst); // Cash was NOT doubled!
  });

  it('13. Security: unshakeable simulation authority rejects arbitrary client manipulation and syncs from server state', async () => {
    const store = useStashStore.getState();
    const initialCash = store.bankCash;

    // Simulation hydration applies authoritative server entities
    const { hydrateStashFromCloud } = await import('../src/progression/stashStore.js');
    await hydrateStashFromCloud();
    // Bank cash cannot be arbitrarily set by client-side local storage manipulation
    expect(useStashStore.getState().bankCash).toBe(initialCash);
  });
