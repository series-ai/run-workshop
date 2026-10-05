/**
 * @file game.ts
 * 60Hz deterministic game loop, kinetic stickman locomotion,
 * machine defense AI, proximity warning, and extraction zone logic.
 */

import { SIM_CONFIG } from './config.js';
import { createExfilController, ExfilController, StagedIngressController } from './airlock.js';

export interface Vector2D {
  x: number;
  z: number;
}

export type StickActionState = 'idle' | 'walk' | 'sprint' | 'slide' | 'roll' | 'kick' | 'shoot';

export interface OperativeState {
  id: string;
  isPlayer: boolean;
  isRival: boolean;
  isAI: boolean;
  name: string;
  badge?: string;
  x: number;
  y: number;
  z: number;
  facing: number; // radians
  health: number;
  armor: number;
  cash: number;
  action: StickActionState;
  actionTicks: number;
  isInvulnerable: boolean;
  isAlive: boolean;
  isExtracted: boolean;
  ammo: number;
  maxAmmo: number;
}

export interface MachineDefense {
  id: string;
  type: 'turret' | 'drone';
  x: number;
  y: number;
  z: number;
  facing: number;
  health: number;
  isAlive: boolean;
  targetId?: string;
  cooldownTicks: number;
}

export interface LootCrate {
  id: string;
  x: number;
  z: number;
  cashValue: number;
  opened: boolean;
}

export interface ProximityAlert {
  active: boolean;
  distance: number;
  bearing: number; // 0-360 degrees
  targetName?: string;
  isRogueAI?: boolean;
}

export interface GameInput {
  dx: number;
  dz: number;
  sprint: boolean;
  slide: boolean;
  roll: boolean;
  kick: boolean;
  shoot: boolean;
  interact: boolean;
  aimAngle?: number;
}

export class SectorDepotSimulation {
  public tick = 0;
  public player: OperativeState;
  public squadmate: OperativeState;
  public rivals: OperativeState[] = [];
  public machines: MachineDefense[] = [];
  public crates: LootCrate[] = [];
  public exfilController: ExfilController;
  public ingressController: StagedIngressController;
  public proximityAlert: ProximityAlert = { active: false, distance: 999, bearing: 0 };
  public combatLog: string[] = [];

  constructor() {
    this.exfilController = createExfilController();
    this.ingressController = new StagedIngressController();

    // Spawn player operative
    this.player = {
      id: 'op_player',
      isPlayer: true,
      isRival: false,
      isAI: false,
      name: 'OPERATIVE GHOST-1',
      badge: 'SQUAD ALPHA',
      x: SIM_CONFIG.SPAWN_SQUAD_A.x,
      y: 0,
      z: SIM_CONFIG.SPAWN_SQUAD_A.z,
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
    };

    // Spawn companion scout
    this.squadmate = {
      id: 'op_squadmate',
      isPlayer: false,
      isRival: false,
      isAI: true,
      name: 'SCOUT VIPER-2',
      badge: 'SQUAD ALPHA',
      x: SIM_CONFIG.SPAWN_SQUAD_A.x + 2,
      y: 0,
      z: SIM_CONFIG.SPAWN_SQUAD_A.z - 2,
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
    };

    this.initMachines();
    this.initCrates();
  }

  private initMachines(): void {
    // 4 Choke-point turrets
    this.machines.push(
      { id: 'turret_depot_nw', type: 'turret', x: -25, y: 0, z: -10, facing: 0, health: 120, isAlive: true, cooldownTicks: 0 },
      { id: 'turret_depot_ne', type: 'turret', x: 25, y: 0, z: -15, facing: Math.PI / 2, health: 120, isAlive: true, cooldownTicks: 0 },
      { id: 'turret_depot_sw', type: 'turret', x: -10, y: 0, z: 25, facing: Math.PI, health: 120, isAlive: true, cooldownTicks: 0 },
      { id: 'turret_exfil_guard', type: 'turret', x: 30, y: 0, z: 35, facing: Math.PI * 0.75, health: 150, isAlive: true, cooldownTicks: 0 },
    );

    // 2 Aerial surveillance drones
    this.machines.push(
      { id: 'drone_patrol_a', type: 'drone', x: 0, y: 4, z: 0, facing: 0, health: 60, isAlive: true, cooldownTicks: 0 },
      { id: 'drone_patrol_b', type: 'drone', x: 20, y: 4, z: 20, facing: 0, health: 60, isAlive: true, cooldownTicks: 0 },
    );
  }

  private initCrates(): void {
    this.crates.push(
      { id: 'crate_1', x: -40, z: -35, cashValue: 1250, opened: false },
      { id: 'crate_2', x: -20, z: -45, cashValue: 2400, opened: false },
      { id: 'crate_3', x: 0, z: -20, cashValue: 3100, opened: false },
      { id: 'crate_4', x: 15, z: 0, cashValue: 1800, opened: false },
      { id: 'crate_5', x: -15, z: 30, cashValue: 4200, opened: false },
      { id: 'crate_6', x: 35, z: 25, cashValue: 5500, opened: false },
    );
  }

  public spawnRogueSquad(): void {
    if (this.rivals.some((r) => r.badge === 'ROGUE AI OPERATOR')) return;

    this.rivals.push({
      id: 'op_rogue_leader',
      isPlayer: false,
      isRival: true,
      isAI: true,
      name: 'KAGE-01',
      badge: 'ROGUE AI OPERATOR',
      x: SIM_CONFIG.SPAWN_ROGUE_AI.x,
      y: 0,
      z: SIM_CONFIG.SPAWN_ROGUE_AI.z,
      facing: Math.PI / 4,
      health: 120,
      armor: 100,
      cash: 6500,
      action: 'idle',
      actionTicks: 0,
      isInvulnerable: false,
      isAlive: true,
      isExtracted: false,
      ammo: 30,
      maxAmmo: 30,
    });

    this.combatLog.push(`[TICK ${this.tick}] WARNING: ROGUE AI OPERATOR detected in Sector 7 Safehouse.`);
  }

  public step(input: GameInput): void {
    if (!this.player.isAlive || this.player.isExtracted) return;
    this.tick += 1;

    // 1. Check Zero-Liquidity Fallback at Tick 7,200 (2:00)
    if (this.tick === SIM_CONFIG.AI_FALLBACK_TICK && this.rivals.length === 0) {
      this.spawnRogueSquad();
    }

    // 2. Process Player Locomotion & Actions
    let damageTakenThisTick = 0;
    this.stepPlayer(input);

    // 3. Process Squadmate companion AI
    this.stepSquadmate();

    // 4. Process Rival Operators AI
    this.stepRivals();

    // 5. Process Machine Defenses (Turrets & Drones)
    damageTakenThisTick += this.stepMachines();

    // 6. Proximity Radar Alert Calculation
    this.updateProximityAlert();

    // 7. Check Exfil Zone & Step ExfilController
    const distToExfil = Math.hypot(
      this.player.x - SIM_CONFIG.EXFIL_ZONE.x,
      this.player.z - SIM_CONFIG.EXFIL_ZONE.z,
    );
    const inExfilZone = distToExfil <= SIM_CONFIG.EXFIL_ZONE.radius;

    // Dwell accumulation and damage suppression handled autoritatively by ExfilController
    this.exfilController.onTick(
      this.tick,
      inExfilZone,
      SIM_CONFIG.EXFIL_ZONE.zoneId,
      damageTakenThisTick,
    );

    // If successfully extracted
    if (this.exfilController.getState().kind === 'extracted') {
      this.player.isExtracted = true;
    }
  }

  private stepPlayer(input: GameInput): void {
    if (this.exfilController.isInputLocked()) {
      return; // Inputs frozen during corridor presentation or extraction
    }

    // Handle ongoing action countdowns
    if (this.player.actionTicks > 0) {
      this.player.actionTicks -= 1;
      if (this.player.actionTicks === 0) {
        this.player.action = 'idle';
        this.player.isInvulnerable = false;
      }
    }

    // Combat roll initiation (Space)
    if (input.roll && this.player.action !== 'roll' && this.player.action !== 'slide') {
      this.player.action = 'roll';
      this.player.actionTicks = SIM_CONFIG.ROLL_TICKS;
      this.player.isInvulnerable = true;
    }

    // Slide initiation (C / slide while sprinting)
    if (input.slide && input.sprint && this.player.action !== 'slide' && this.player.action !== 'roll') {
      this.player.action = 'slide';
      this.player.actionTicks = SIM_CONFIG.SLIDE_TICKS;
    }

    // Melee kick initiation (F)
    if (input.kick && this.player.action !== 'kick' && this.player.action !== 'roll') {
      this.player.action = 'kick';
      this.player.actionTicks = SIM_CONFIG.KICK_TICKS;
      this.performMeleeKick();
    }

    // Gunplay shooting
    if (input.shoot && this.player.ammo > 0 && this.player.action !== 'roll') {
      this.player.ammo -= 1;
      this.player.action = 'shoot';
      this.fireWeapon();
    }

    // Movement calculation
    let speed = input.sprint ? SIM_CONFIG.SPEED_SPRINT : SIM_CONFIG.SPEED_WALK;
    if (this.player.action === 'slide') speed *= 1.35;
    if (this.player.action === 'roll') speed *= 1.1;

    const moveMagnitude = Math.hypot(input.dx, input.dz);
    if (moveMagnitude > 0.01) {
      const normX = input.dx / moveMagnitude;
      const normZ = input.dz / moveMagnitude;
      const dt = SIM_CONFIG.TICK_INTERVAL_MS / 1000;

      this.player.x = Math.max(SIM_CONFIG.MAP_MIN_X, Math.min(SIM_CONFIG.MAP_MAX_X, this.player.x + normX * speed * dt));
      this.player.z = Math.max(SIM_CONFIG.MAP_MIN_Z, Math.min(SIM_CONFIG.MAP_MAX_Z, this.player.z + normZ * speed * dt));

      if (input.aimAngle !== undefined) {
        this.player.facing = input.aimAngle;
      } else {
        this.player.facing = Math.atan2(normX, normZ);
      }

      if (this.player.actionTicks === 0) {
        this.player.action = input.sprint ? 'sprint' : 'walk';
      }
    } else if (this.player.actionTicks === 0) {
      this.player.action = 'idle';
    }

    // Loot crate pickup
    if (input.interact) {
      for (const crate of this.crates) {
        if (!crate.opened && Math.hypot(this.player.x - crate.x, this.player.z - crate.z) <= 3.0) {
          crate.opened = true;
          this.player.cash += crate.cashValue;
          this.player.ammo = this.player.maxAmmo;
          this.combatLog.push(`[TICK ${this.tick}] Scavenged Crate: +$${crate.cashValue.toLocaleString()}`);
          break;
        }
      }
    }
  }

  private performMeleeKick(): void {
    // 2.5m range kick damaging turrets, drones, or rivals
    const kickRange = 2.5;
    for (const machine of this.machines) {
      if (machine.isAlive && Math.hypot(this.player.x - machine.x, this.player.z - machine.z) <= kickRange) {
        machine.health -= 50;
        if (machine.health <= 0) {
          machine.isAlive = false;
          this.combatLog.push(`[TICK ${this.tick}] Machine destroyed by kinetic kick: ${machine.id}`);
        }
      }
    }
  }

  private fireWeapon(): void {
    // Raycast/cone shot toward facing direction
    const range = 35.0;
    const bulletDirX = Math.sin(this.player.facing);
    const bulletDirZ = Math.cos(this.player.facing);

    // Check hit against machines
    for (const m of this.machines) {
      if (!m.isAlive) continue;
      const dx = m.x - this.player.x;
      const dz = m.z - this.player.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= range) {
        // Dot product angle check
        const dot = (dx * bulletDirX + dz * bulletDirZ) / dist;
        if (dot > 0.85) {
          m.health -= SIM_CONFIG.RIFLE_DAMAGE;
          if (m.health <= 0) {
            m.isAlive = false;
            this.combatLog.push(`[TICK ${this.tick}] Enemy destroyed: ${m.id}`);
          }
          break;
        }
      }
    }

    // Check hit against rivals
    for (const r of this.rivals) {
      if (!r.isAlive || r.isExtracted) continue;
      const dx = r.x - this.player.x;
      const dz = r.z - this.player.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= range) {
        const dot = (dx * bulletDirX + dz * bulletDirZ) / dist;
        if (dot > 0.88) {
          r.health -= SIM_CONFIG.RIFLE_DAMAGE;
          if (r.health <= 0) {
            r.isAlive = false;
            this.combatLog.push(`[TICK ${this.tick}] Rival operator eliminated: ${r.name}`);
          }
          break;
        }
      }
    }
  }

  private stepSquadmate(): void {
    if (!this.squadmate.isAlive || this.squadmate.isExtracted) return;
    // Follow player at ~3m distance
    const dx = this.player.x - this.squadmate.x;
    const dz = this.player.z - this.squadmate.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 3.5) {
      const dt = SIM_CONFIG.TICK_INTERVAL_MS / 1000;
      this.squadmate.x += (dx / dist) * SIM_CONFIG.SPEED_WALK * dt;
      this.squadmate.z += (dz / dist) * SIM_CONFIG.SPEED_WALK * dt;
      this.squadmate.facing = Math.atan2(dx, dz);
      this.squadmate.action = 'walk';
    } else {
      this.squadmate.action = 'idle';
    }
  }

  private stepRivals(): void {
    for (const rival of this.rivals) {
      if (!rival.isAlive || rival.isExtracted) continue;
      // Tactical patrol / engage behavior
      const distToPlayer = Math.hypot(this.player.x - rival.x, this.player.z - rival.z);
      if (distToPlayer < 25.0) {
        // Move into cover or fire
        rival.facing = Math.atan2(this.player.x - rival.x, this.player.z - rival.z);
        rival.action = 'shoot';
      } else {
        rival.action = 'walk';
      }
    }
  }

  private stepMachines(): number {
    let damageToPlayer = 0;

    for (const machine of this.machines) {
      if (!machine.isAlive) continue;

      const dist = Math.hypot(this.player.x - machine.x, this.player.z - machine.z);
      const detectionRange = machine.type === 'turret' ? 20.0 : 25.0;

      if (dist <= detectionRange) {
        // Rotate toward player
        machine.facing = Math.atan2(this.player.x - machine.x, this.player.z - machine.z);

        if (machine.cooldownTicks <= 0) {
          // Machine fires at player!
          machine.cooldownTicks = machine.type === 'turret' ? 45 : 30; // 0.75s / 0.5s rate
          if (!this.player.isInvulnerable) {
            const rawDmg = machine.type === 'turret' ? 14 : 10;
            if (this.player.armor > 0) {
              const absorbed = Math.min(this.player.armor, rawDmg);
              this.player.armor -= absorbed;
              const leftover = rawDmg - absorbed;
              this.player.health -= leftover;
            } else {
              this.player.health -= rawDmg;
            }
            damageToPlayer += rawDmg;

            if (this.player.health <= 0) {
              this.player.isAlive = false;
              this.combatLog.push(`[TICK ${this.tick}] K.I.A. Operative eliminated by ${machine.id}`);
            }
          }
        } else {
          machine.cooldownTicks -= 1;
        }
      }
    }

    return damageToPlayer;
  }

  private updateProximityAlert(): void {
    let closestDist = 999;
    let closestRival: OperativeState | undefined;

    for (const rival of this.rivals) {
      if (!rival.isAlive || rival.isExtracted) continue;
      const d = Math.hypot(this.player.x - rival.x, this.player.z - rival.z);
      if (d < closestDist) {
        closestDist = d;
        closestRival = rival;
      }
    }

    if (closestDist <= SIM_CONFIG.PROXIMITY_ALERT_RADIUS && closestRival) {
      // Calculate compass bearing theta (0 - 360 degrees)
      const dx = closestRival.x - this.player.x;
      const dz = closestRival.z - this.player.z;
      let angleRad = Math.atan2(dx, dz);
      let angleDeg = (angleRad * 180) / Math.PI;
      if (angleDeg < 0) angleDeg += 360;

      this.proximityAlert = {
        active: true,
        distance: Math.round(closestDist),
        bearing: Math.round(angleDeg),
        targetName: closestRival.name,
        isRogueAI: closestRival.badge === 'ROGUE AI OPERATOR',
      };
    } else {
      this.proximityAlert = {
        active: false,
        distance: Math.round(closestDist),
        bearing: 0,
      };
    }
  }
}
