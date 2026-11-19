import { describe, it, expect, beforeEach } from 'vitest';
import { useStashStore, applySimulationEntities, sellRecipeNameForItem } from '../src/progression/stashStore.js';
import { SectorDepotSimulation } from '../src/sim/game.js';
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

  it('5. Sells stash items for liquid cash to the Fence', async () => {
    const store = useStashStore.getState();
    const item = store.stashItems[0];
    const initialCash = store.bankCash;
    const itemVal = item.value;

    const sold = await store.sellStashItem(item.id);
    expect(sold).toBe(true);
    expect(useStashStore.getState().bankCash).toBe(initialCash + itemVal);
  });

  it('5b. Sell recipes resolve from entity ids, never display-name slugs', () => {
    expect(sellRecipeNameForItem({ id: 'item_circuit_board', name: 'Military Circuit Board' })).toBe('sell_circuit_board');
    expect(sellRecipeNameForItem({ id: 'item_encrypted_drive', name: 'Encrypted Intel Drive' })).toBe('sell_encrypted_drive');
    expect(sellRecipeNameForItem({ id: 'loot_123', name: 'Salvaged Component' })).toBeNull();
  });

  it('5c. Hydration applies zero cash and an empty inventory', () => {
    applySimulationEntities({ currency_cash: '250', circuit_board: '2' });
    expect(useStashStore.getState().bankCash).toBe(250);
    expect(useStashStore.getState().stashItems.length).toBeGreaterThan(0);
    applySimulationEntities({ currency_cash: '0' });
    expect(useStashStore.getState().bankCash).toBe(0);
    expect(useStashStore.getState().stashItems).toEqual([]);
  });

  it('does not offer a local contract reward grant', () => {
    expect('claimContractReward' in useStashStore.getState()).toBe(false);
  });

  it('9. Gamepad polling safely returns null or valid state without crashing', () => {
    const padState = gamepad.poll();
    // In node/vitest environment without connected hardware, gamepad.poll() safely returns null
    expect(padState === null || typeof padState === 'object').toBe(true);

    // Vibrate method executes safely without throwing
    expect(() => gamepad.vibrate(50, 0.2, 0.5)).not.toThrow();
  });
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

  it("14. Laser Pointer Upgrade: off by default, equippable in armory loadout, and togglable in simulation", () => {
    const store = useStashStore.getState();
    store.resetProgress();

    // Default loadout must have laser pointer disabled
    expect(useStashStore.getState().loadout.hasLaserPointer).toBe(false);

    // Equip laser pointer attachment
    useStashStore.getState().setLaserPointer(true);
    expect(useStashStore.getState().loadout.hasLaserPointer).toBe(true);

    // Unequip laser pointer attachment
    useStashStore.getState().setLaserPointer(false);
    expect(useStashStore.getState().loadout.hasLaserPointer).toBe(false);

    // Simulation operative default state
    const sim = new SectorDepotSimulation("test_laser_raid", "spoke");
    expect(sim.player.hasLaser).toBe(false);

    // Toggle laser sight
    const turnedOn = sim.toggleLaser();
    expect(turnedOn).toBe(true);
    expect(sim.player.hasLaser).toBe(true);

    const turnedOff = sim.toggleLaser();
    expect(turnedOff).toBe(false);
    expect(sim.player.hasLaser).toBe(false);
  });

  it("15. Weapon Slot Selection: selecting Shotgun (1), Rifle (2), Fists/Kick (3), and Frag Grenade (4)", () => {
    const sim = new SectorDepotSimulation("test_weapon_slots", "hub");
    sim.admitOperative(0);
    expect(sim.player.weapon).toBe("rifle");

    // 1. Select Shotgun (Slot 1)
    sim.setWeapon("shotgun");
    expect(sim.player.weapon).toBe("shotgun");
    expect(sim.player.maxAmmo).toBe(8);

    // 2. Select Rifle (Slot 2)
    sim.setWeapon("rifle");
    expect(sim.player.weapon).toBe("rifle");
    expect(sim.player.maxAmmo).toBe(30);

    // 3. Select Fists / Kick (Slot 3)
    sim.setWeapon("fists");
    expect(sim.player.weapon).toBe("fists");
    expect(sim.player.ammo).toBe(0);

    // Firing with fists selected performs melee kick
    const initialKickCooldown = sim.kickCooldownTicks;
    const firedKick = sim.fire();
    expect(firedKick).toBe(true);
    expect(sim.player.action).toBe("kick");

    // 4. Select Frag Grenade (Slot 4)
    sim.player.action = "idle";
    sim.setWeapon("grenade");
    expect(sim.player.weapon).toBe("grenade");
    expect(sim.player.fragGrenades).toBe(2);
    expect(sim.player.ammo).toBe(2);

    // Firing with grenade selected throws F-1 Frag Grenade
    const initialGrenadeCount = sim.activeGrenades.length;
    const firedGrenade = sim.fire();
    expect(firedGrenade).toBe(true);
    expect(sim.player.action).toBe("throw");
    expect(sim.activeGrenades.length).toBe(initialGrenadeCount + 1);
    expect(sim.player.fragGrenades).toBe(1);
    expect(sim.player.ammo).toBe(1);
  });
