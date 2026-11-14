import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SectorDepotSimulation } from '../src/sim/game.js';
import { MultiplayerCoordinator } from '../src/sim/multiplayer.js';
import {
  EFFECTS,
  EFFECT_PRESET_IDS,
  EFFECT_BY_ID,
  resolveEffectColor,
} from '../src/render/inkEffectsPresets.js';
import { InkEffects } from '../src/render/InkEffects.js';

describe('inkEffects', () => {
  describe('Preset Lookup & Catalog Completeness', () => {
    it('contains all 64 authored INKLINE presets', () => {
      expect(EFFECTS.length).toBe(64);
      expect(EFFECT_PRESET_IDS.length).toBe(64);
      expect(EFFECT_BY_ID.size).toBe(64);
    });

    it('provides valid recipe definitions for primary combat flash presets', () => {
      const rifle = EFFECT_BY_ID.get('rifle-flash');
      expect(rifle).toBeDefined();
      expect(rifle!.shape).toBe('spark');
      expect(rifle!.duration).toBeGreaterThan(0);

      const shotgun = EFFECT_BY_ID.get('shotgun-flash');
      expect(shotgun).toBeDefined();
      expect(shotgun!.shape).toBe('star');
      expect(shotgun!.layers?.length).toBeGreaterThan(0);
    });

    it('resolves semantic paper, ink, and accent color roles correctly', () => {
      expect(resolveEffectColor('paper')).toBe('#eeece5');
      expect(resolveEffectColor('ink')).toBe('#151716');
      expect(resolveEffectColor('accent')).toBe('#d45538');
      expect(resolveEffectColor('accent', '#38bdf8')).toBe('#38bdf8');
      expect(resolveEffectColor('ink', undefined, true)).toBe('#30342f');
    });
  });

  describe('Single-Owner Presentation Event Bus', () => {
    it('enqueues presentation events and drains them atomically', () => {
      const sim = new SectorDepotSimulation('test_event_bus');
      sim.enqueuePresentationEvent({
        type: 'fire',
        shooterId: 'player-01',
        origin: { x: 0, y: 1, z: 0 },
        dir: { x: 0, y: 0, z: 1 },
        weapon: 'shotgun',
      });
      sim.enqueuePresentationEvent({
        type: 'impact',
        position: { x: 5, y: 1, z: 5 },
        surface: 'metal',
      });

      const drained = sim.drainPresentationEvents();
      expect(drained.length).toBe(2);
      expect(drained[0].type).toBe('fire');
      expect(drained[1].type).toBe('impact');

      // Second drain immediately returns empty array, preserving single-owner contract
      const emptyDrain = sim.drainPresentationEvents();
      expect(emptyDrain.length).toBe(0);
    });

    it('enqueues presentation events on local operative fire', () => {
      const sim = new SectorDepotSimulation('test_local_fire');
      sim.admitOperative(0);
      sim.player.ammo = 5;
      sim.player.weapon = 'rifle';

      const fired = sim.fire();
      expect(fired).toBe(true);

      const events = sim.drainPresentationEvents();
      expect(events.length).toBeGreaterThan(0);
      const fireEvent = events.find((e) => e.type === 'fire');
      expect(fireEvent).toBeDefined();
      expect(fireEvent!.type).toBe('fire');
      if (fireEvent && fireEvent.type === 'fire') {
        expect(fireEvent.shooterId).toBe(sim.player.id);
        expect(fireEvent.weapon).toBe('rifle');
      }
    });

    it('remote peer fire enqueues presentation event without triggering local camera recoil condition', () => {
      const sim = new SectorDepotSimulation('test_remote_fire');
      const coord = new MultiplayerCoordinator(sim);
      sim.admitOperative(0);

      // Admitted rival
      const rivalId = 'op_bravo_1';
      sim.rivals.push({
        id: rivalId,
        name: 'Bravo',
        badge: 'b2',
        x: 10,
        y: 0,
        z: 10,
        facing: Math.PI / 2,
        health: 100,
        armor: 50,
        isAlive: true,
        weapon: 'shotgun',
        action: 'idle',
        actionTicks: 0,
        squad: 'bravo',
      } as any);

      // Ingest remote fire packet
      (coord as any).handleMessage({
        eventId: 'evt_fire_1',
        type: 'fire',
        senderId: rivalId,
        senderName: 'Bravo',
        squad: 'bravo',
        raidId: sim.raidId,
        timestamp: Date.now(),
        data: { weapon: 'shotgun' },
      });

      const events = sim.drainPresentationEvents();
      expect(events.length).toBe(1);
      const ev = events[0];
      expect(ev.type).toBe('fire');
      if (ev.type === 'fire') {
        expect(ev.shooterId).toBe(rivalId);
        // Assert camera recoil condition: strictly shooterId === sim.player.id
        const shouldTriggerLocalCameraRecoil = ev.shooterId === sim.player.id;
        expect(shouldTriggerLocalCameraRecoil).toBe(false);
      }

      coord.cleanup();
    });
  });

  describe('InkEffects Instanced Mesh Engine & Capacity Safety', () => {
    it('triggers presets, tracks active counts, and bounds particles', () => {
      const effects = new InkEffects(512);
      expect(effects.activeCount).toBe(0);
      expect(effects.activeBursts).toBe(0);

      const duration = effects.trigger('shotgun-flash', new THREE.Vector3(0, 1, 0));
      expect(duration).toBeGreaterThan(0);
      expect(effects.activeCount).toBeGreaterThan(0);
      expect(effects.activeBursts).toBe(1);

      const bounds = effects.getActiveParticleBounds();
      expect(bounds.min.x).toBeLessThanOrEqual(bounds.max.x);
      expect(bounds.min.y).toBeLessThanOrEqual(bounds.max.y);
      expect(bounds.min.z).toBeLessThanOrEqual(bounds.max.z);

      const camera = new THREE.PerspectiveCamera();
      camera.position.set(0, 10, -10);
      camera.lookAt(0, 0, 0);

      // Update simulation step
      effects.update(0.016, camera);
      expect(effects.activeCount).toBeGreaterThan(0);

      effects.setParticlesVisible(false);
      expect(effects.group.visible).toBe(false);
      effects.setParticlesVisible(true);
      expect(effects.group.visible).toBe(true);

      effects.clear();
      expect(effects.activeCount).toBe(0);
      expect(effects.activeBursts).toBe(0);

      effects.dispose();
    });

    it('caps particles at capacity without throwing errors', () => {
      const capacity = 16;
      const effects = new InkEffects(capacity);

      for (let i = 0; i < 20; i++) {
        effects.trigger('punch-impact', new THREE.Vector3(i, 0, 0));
      }
      expect(effects.activeCount).toBeLessThanOrEqual(capacity);

      effects.dispose();
    });
  });
});
