import { hydrateStashFromCloud } from "./progression/stashStore.js";
import { HideoutMenu } from "./components/HideoutMenu.js";
import { MobileControls, type TouchInputUpdate } from "./components/MobileControls.js";
import { gamepad } from "./input/gamepadController.js";
import React, { useEffect, useRef, useState } from "react";
import { SectorDepotSimulation, type GameInput, computeGroundAimAngle } from "./sim/game.js";
import { MultiplayerCoordinator } from "./sim/multiplayer.js";
import { preparePlatformRaid, registerDeployment } from "./sim/airlock.js";
import { GameCanvas } from "./components/GameCanvas.js";
import { TacticalHud } from "./components/TacticalHud.js";
import { ExfilOverlay } from "./components/ExfilOverlay.js";
import { sound } from "./audio.js";
import "./styles.css";



const MainApp: React.FC = () => {
  useEffect(() => {
    // Online RUN platform hydration: sync player stash and progression from cloud
    hydrateStashFromCloud().catch(() => {});
  }, []);
  const [dismissRotate, setDismissRotate] = useState(false);
  const [showHideout, setShowHideout] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(() => {
    if (typeof window !== "undefined") {
      return (
        ("ontouchstart" in window || navigator.maxTouchPoints > 0) &&
        window.matchMedia("(pointer: coarse)").matches &&
        window.innerWidth <= 844
      );
    }
    return false;
  });
  const [isPortrait, setIsPortrait] = useState(() => {
    if (typeof window !== "undefined") {
      const isTouch = ("ontouchstart" in window || navigator.maxTouchPoints > 0) &&
        window.matchMedia("(pointer: coarse)").matches &&
        window.innerWidth <= 844;
      return isTouch && window.innerHeight > window.innerWidth;
    }
    return false;
  });

  useEffect(() => {
    const handleOrientation = () => {
      const isTouch = ("ontouchstart" in window || navigator.maxTouchPoints > 0) &&
        window.matchMedia("(pointer: coarse)").matches &&
        window.innerWidth <= 844;
      setIsTouchDevice(isTouch);
      setIsPortrait(isTouch && window.innerHeight > window.innerWidth);
    };
    window.addEventListener("resize", handleOrientation);
    window.addEventListener("orientationchange", handleOrientation);
    return () => {
      window.removeEventListener("resize", handleOrientation);
      window.removeEventListener("orientationchange", handleOrientation);
    };
  }, []);

  const [sim, setSim] = useState(() => {
    let initialRaidId: string | undefined = undefined;
    if (typeof window !== "undefined") {
      const urlRaid = new URLSearchParams(window.location.search).get("raidId");
      if (urlRaid && /^[A-Za-z0-9_-]{3,64}$/.test(urlRaid)) {
        initialRaidId = urlRaid;
      }
    }
    const s = new SectorDepotSimulation(initialRaidId, "hub");
    if (typeof window !== "undefined" && (import.meta as any).env?.VITE_EXPOSE_DEBUG_SIM === "1") {
      (window as any).debugSim = s;
    }
    return s;
  });
  const [, setFrame] = useState(0);
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__stickZoneSim = sim;
    }
  }, [sim]);

  const coordinatorRef = useRef<MultiplayerCoordinator | null>(null);
  const keysPressed = useRef<Set<string>>(new Set());
  const mousePos = useRef<{ clientX: number; clientY: number }>({ clientX: typeof window !== "undefined" ? window.innerWidth / 2 : 960, clientY: typeof window !== "undefined" ? window.innerHeight / 2 : 540 });
  const hasMouseMovedRef = useRef(false);
  const lastMouseMoveTimeRef = useRef(0);
  const isMouseDown = useRef(false);
  const queuedSelectWeapon = useRef<'rifle' | 'shotgun' | null>(null);
  const queuedSwitchWeapon = useRef(false);
  const queuedStim = useRef(false);
  const queuedReload = useRef(false);
  const queuedInteract = useRef(false);
  const fireTouchOrigin = useRef<{ x: number; y: number } | null>(null);
  const touchInputRef = useRef<{ dx: number; dz: number; sprint?: boolean; slide?: boolean; crouch?: boolean; roll?: boolean; jump?: boolean; kick?: boolean; shoot?: boolean; interact?: boolean; aimAngle?: number }>({ dx: 0, dz: 0 });
  const actionPointersRef = useRef<Map<string, Set<number>>>(new Map());
  const prevActionRef = useRef<string>("idle");
  const prevProximityRef = useRef<boolean>(false);
  const prevCashRef = useRef<number>(0);
  const pendingNextRaidId = useRef<string | null>(null);
  const isRestartingRef = useRef<boolean>(false);

  useEffect(() => {
    // Instantiate multiplayer coordinator
    const coordinator = new MultiplayerCoordinator(sim);
    coordinatorRef.current = coordinator;
    coordinator.onRaidRestart = (newRaidId: string) => {
      pendingNextRaidId.current = newRaidId;
      const exfilState = sim.exfilController.getState();
      const isSettling = exfilState.kind === "corridor_presentation" ||
        exfilState.kind === "submitting_settlement" ||
        exfilState.kind === "failed";
      if (sim.player.isAlive && !sim.player.isExtracted && (sim.tick < 54000 || isSettling)) {
        sim.combatLog.push(`[RAID NOTICE] Next raid ${newRaidId} initialized. Complete extraction to redeploy.`);
        return;
      }
      handleRestart(newRaidId, true);
    };
    let isCancelled = false;
    // Turnkey platform extraction session initialization on mount (no offline)
    preparePlatformRaid({
      sector: "Sector 7 Depot",
      loadout: [
        { itemId: "weapon_rifle", quantity: "1" },
        { itemId: "med_stim", quantity: "2" },
      ],
    }).then((prep) => {
      if (prep.success && coordinatorRef.current) {
        coordinatorRef.current.attachSdkSession(prep.grant, prep.spokeSession);
      }
    }).catch(() => {});



      sim.onHoldProgress = (holdTicks: number, currentTick: number) => {
        if (coordinatorRef.current && !sim.player.isExtracted && sim.player.isAlive) {
          coordinatorRef.current.reportHoldProgress(holdTicks, currentTick);
        }
      };

      const originalOnExfilSuccess = sim.onExfilSuccess;
      sim.onExfilSuccess = (receipt?: any) => {
        originalOnExfilSuccess?.(receipt);
        if (coordinatorRef.current?.spokeSession) {
          coordinatorRef.current.spokeSession.requestExtractionAsync({ zoneId: "lz_sector_7" }).catch(() => {});
          coordinatorRef.current.spokeSession.waitForDebriefAsync().then(() => hydrateStashFromCloud()).catch(() => {});
        } else {
          hydrateStashFromCloud().catch(() => {});
        }
      };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (sim.isInputLocked()) return;
      if (e.repeat) return; // Ignore physical OS repeat
      keysPressed.current.add(e.code);

      if (e.code === "Tab") {
        e.preventDefault();
        setShowHideout((s) => !s);
        return;
      }
      if (e.code === "Digit1") {
        queuedSelectWeapon.current = "rifle";
      } else if (e.code === "Digit2") {
        queuedSelectWeapon.current = "shotgun";
      } else if (e.code === "KeyQ") {
        queuedSwitchWeapon.current = true;
      } else if (e.code === "KeyH") {
        queuedStim.current = true;
      } else if (e.code === "KeyR") {
        queuedReload.current = true;
      } else if (e.code === "KeyE" || e.code === "KeyF") {
        queuedInteract.current = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.code);
    };

    const handleMouseMove = (e: MouseEvent) => {
      hasMouseMovedRef.current = true;
      lastMouseMoveTimeRef.current = Date.now();
      mousePos.current = { clientX: e.clientX, clientY: e.clientY };
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (sim.isInputLocked()) return;
      if (e.button === 0) isMouseDown.current = true;
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        isMouseDown.current = false;
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button === 0) {
        isMouseDown.current = false;
      }
    };

    const resetInputs = () => {
      keysPressed.current.clear();
      isMouseDown.current = false;
      actionPointersRef.current.clear();
      touchInputRef.current = {
        dx: 0,
        dz: 0,
        sprint: false,
        slide: false,
        roll: false,
        kick: false,
        shoot: false,
        interact: false,
        jump: false,
        crouch: false,
      };
      dpadTouchIdRef.current = null;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("blur", resetInputs);
    document.addEventListener("visibilitychange", resetInputs);

    // Fixed-timestep 60Hz accumulator simulation loop
    let lastTime = performance.now();
    // Ref-backed accumulator: raid-clock reconciliation (multiplayer.ts) consumes
    // accumulated elapsed time via __stickZoneConsumeAccumulatorMs when it
    // fast-forwards the tick — single-owner tick advancement, no double counting.
    const accumulatorRef = { current: 0 };
    let accumulator = 0;
    const dt = 1000 / 60;
    let animId: number;
    (globalThis as any).__stickZoneConsumeAccumulatorMs = (ms: number) => {
      // Single-owner clock correction: drain the backpacked accumulator AND advance
      // the frame timestamp by the same interval, so the next frame's delta begins
      // AFTER the reconciled window (time can never be counted twice).
      accumulator = Math.max(0, accumulator - ms);
      accumulatorRef.current = accumulator;
      lastTime = Math.min(performance.now(), lastTime + ms);
    };

    const loop = (currentTime: number) => {
      let delta = currentTime - lastTime;
      lastTime = currentTime;
      // Elapsed time is NEVER discarded: the full delta feeds the accumulator; per-frame
      // EXECUTION is bounded (steps < 10) so catch-up drains over subsequent frames at a
      // bounded simulation rate. After a tab pause the local 60Hz tick trails the server
      // raid clock only briefly before the coordinator's raid-clock reconciliation
      // fast-forwards it (restoring deterministic drone patrol parity).
      // Safety window: after a very long pause the raid-clock reconciliation owns the
      // catch-up; local execution resumes from the next frame's tick window.
      if (delta > 5000) {
        accumulator = 0;
        accumulatorRef.current = 0;
        delta = 0;
      }
      accumulator += delta;
      accumulatorRef.current = accumulator;

      let steps = 0;
      while (accumulator >= dt && steps < 10) {
        // Gather inputs
        const keys = keysPressed.current;
        let dx = touchInputRef.current.dx || 0;
        let dz = touchInputRef.current.dz || 0;

        if (keys.has("KeyW") || keys.has("ArrowUp")) dz -= 1;
        if (keys.has("KeyS") || keys.has("ArrowDown")) dz += 1;
        if (keys.has("KeyA") || keys.has("ArrowLeft")) dx -= 1;
        if (keys.has("KeyD") || keys.has("ArrowRight")) dx += 1;

        const camParam = {
          cameraPos: sim.cameraPos,
          targetPos: sim.cameraTarget || { x: sim.player.x, y: sim.player.y + 1, z: sim.player.z },
          playerPos: { x: sim.player.x, y: sim.player.y, z: sim.player.z },
        };
        let aimAngle: number | undefined;
        let arrowDx = 0;
        let arrowDz = 0;
        if (keys.has("ArrowLeft")) arrowDx -= 1;
        if (keys.has("ArrowRight")) arrowDx += 1;
        if (keys.has("ArrowUp")) arrowDz -= 1;
        if (keys.has("ArrowDown")) arrowDz += 1;

        if (touchInputRef.current.aimAngle !== undefined) {
          aimAngle = touchInputRef.current.aimAngle;
        } else if (arrowDx !== 0 || arrowDz !== 0) {
          // Explicit keyboard aim with arrow keys always takes priority over mouse
          aimAngle = Math.atan2(arrowDx, arrowDz);
        } else if (hasMouseMovedRef.current && (isMouseDown.current || Date.now() - lastMouseMoveTimeRef.current < 2500)) {
          aimAngle = computeGroundAimAngle(mousePos.current.clientX, mousePos.current.clientY, window.innerWidth || 1920, window.innerHeight || 1080, 48, camParam);
        } else if (dx !== 0 || dz !== 0) {
          // Keyboard movement direction when mouse is stationary
          aimAngle = Math.atan2(dx, dz);
        } else {
          aimAngle = undefined;
        }

        
        const pad = gamepad.poll();
        if (pad) {
          if (pad.dx !== 0 || pad.dz !== 0) {
            dx = pad.dx;
            dz = pad.dz;
          }
          if (pad.aimAngle !== undefined) {
            aimAngle = pad.aimAngle;
          }
        }

        let isSprinting = keys.has("ShiftLeft") || keys.has("ShiftRight") || !!touchInputRef.current.sprint || !!touchInputRef.current.slide || !!pad?.sprint;

        const selectWeapon = queuedSelectWeapon.current || undefined;
        queuedSelectWeapon.current = null;
        const switchWeapon = queuedSwitchWeapon.current || !!(touchInputRef.current as any).switchWeapon;
        queuedSwitchWeapon.current = false;
        (touchInputRef.current as any).switchWeapon = false;

        const stim = queuedStim.current || !!(touchInputRef.current as any).stim;
        if (stim) sound.playHealInject();
        queuedStim.current = false;
        (touchInputRef.current as any).stim = false;

        const reload = queuedReload.current || !!(touchInputRef.current as any).reload;
        if (reload) sound.playReload();
        queuedReload.current = false;
        (touchInputRef.current as any).reload = false;

        const interact = queuedInteract.current || !!touchInputRef.current.interact;
        queuedInteract.current = false;

        const input: GameInput = {
          dx,
          dz,
          sprint: isSprinting,
          slide: keys.has("KeyC") || !!touchInputRef.current.slide || !!pad?.slide,
          crouch: (keys.has("KeyC") && !isSprinting) || (!!touchInputRef.current.crouch && !touchInputRef.current.slide),
          roll: (keys.has("Space") && isSprinting) || !!touchInputRef.current.roll || !!pad?.roll,
          jump: (keys.has("Space") && !isSprinting) || !!touchInputRef.current.jump,
          kick: keys.has("KeyV") || !!touchInputRef.current.kick || !!pad?.kick,
          shoot: keys.has("KeyJ") || keys.has("KeyK") || keys.has("Enter") || isMouseDown.current || !!touchInputRef.current.shoot || !!pad?.shoot,
          interact: interact || !!pad?.interact,
          selectWeapon,
          switchWeapon,
          stim,
          reload,
          aimAngle,
        };

        const prevAmmo = sim.player.ammo;
        sim.step(input);

        // Sound triggers on kinetic state transitions
        const currentAction = sim.player.action;
        if (currentAction !== prevActionRef.current) {
          if (currentAction === "slide") sound.playSlide();
          else if (currentAction === "roll") sound.playRoll();
          else if (currentAction === "kick") sound.playKick();
          prevActionRef.current = currentAction;
        }

        // Gunshot audio on actual shot event (consume each fire event once to avoid false shots on weapon switch or death)
        if (sim.consumeFireEvent()) {
          gamepad.vibrate(35, 0.2, 0.5);
          if (sim.player.weapon === 'shotgun') {
            sound.playShotgun();
          } else {
            sound.playGunshot();
          }
          if (coordinatorRef.current) {
            coordinatorRef.current.broadcastFire(
              sim.player.x + Math.sin(sim.player.facing) * 20,
              sim.player.z + Math.cos(sim.player.facing) * 20
            );
          }
        }

        // Hitmarker sound feedback
        if (sim.player.lastHitmarkerTick === sim.tick) {
          sound.playHitmarker(!!sim.player.lastHitmarkerCrit);
        }

        // Critical low health heartbeat
        if (sim.player.isAlive && sim.player.health < 30 && sim.tick % 50 === 0) {
          sound.playHeartbeat();
        }

        // Automatic Scav Squad deployment in Sector 7 Spoke
        if (sim.zoneMode === 'spoke' && sim.rivals.length === 0 && !sim.aiSpawned) {
          sim.spawnScavSquad();
          sound.playScavBark();
        }

        // Cash loot chime
        if (sim.player.cash > prevCashRef.current) {
          sound.playLootChime();
          prevCashRef.current = sim.player.cash;
        }

        // Radar alert ping on state flip
        if (sim.proximityAlert.active && !prevProximityRef.current) {
          sound.playRadarPing();
        }
        prevProximityRef.current = sim.proximityAlert.active;

        // Exfil siren pulse
        const exState = sim.exfilController.getState();
        if (exState.kind === "holding_zone" && sim.tick % 45 === 0) {
          sound.playExfilSiren();
        }

        // Sync state to peer browsers (only when admitted)
        if (coordinatorRef.current && sim.isAdmitted() && (sim.tick % 2 === 0 || !sim.player.isAlive)) {
          const currentHold = sim.exfilController.getState().kind === "holding_zone" ? (sim.exfilController.getState() as any).currentTicks : 0;
          coordinatorRef.current.broadcastState(currentHold);
        }

        accumulator -= dt;
        accumulatorRef.current = accumulator;
        steps++;
      }

      if (steps > 0) {
        setFrame((f) => f + 1);
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      isCancelled = true;
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("blur", resetInputs);
      document.removeEventListener("visibilitychange", resetInputs);
      cancelAnimationFrame(animId);
      if (coordinatorRef.current) {
        coordinatorRef.current.cleanup();
      }
    };
  }, [sim]);

  const handleRestart = async (overrideRaidId?: string, fromPeer = false): Promise<boolean> => {
    if (isRestartingRef.current) return false;
    isRestartingRef.current = true;
    try {
      const candidateRaidId = overrideRaidId || (pendingNextRaidId.current && pendingNextRaidId.current !== sim.raidId ? pendingNextRaidId.current : `raid_sector7_${Date.now()}`);
      pendingNextRaidId.current = null;

      const newSim = new SectorDepotSimulation(candidateRaidId);
      registerDeployment(newSim.player.id, candidateRaidId);

      preparePlatformRaid({
        sector: "Sector 7 Depot",
        loadout: [
          { itemId: "weapon_rifle", quantity: "1" },
          { itemId: "med_stim", quantity: "2" },
        ],
      }).then((prep) => {
        if (prep.success && coordinatorRef.current) {
          coordinatorRef.current.attachSdkSession(prep.grant, prep.spokeSession);
        }
      }).catch(() => {});

      setSim(newSim);
      if (typeof window !== "undefined") {
        if ((import.meta as any).env?.VITE_EXPOSE_DEBUG_SIM === "1") (window as any).debugSim = newSim;
      }

      if (!fromPeer && coordinatorRef.current) {
        coordinatorRef.current.broadcastRaidRestart(candidateRaidId);
      }
      return true;
    } finally {
      isRestartingRef.current = false;
    }
  };

  const dpadTouchIdRef = useRef<number | null>(null);

  const handleTouchDpadStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (dpadTouchIdRef.current !== null) return; // Prevent secondary touch from hijacking D-pad
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const dist = Math.hypot(touch.clientX - centerX, touch.clientY - centerY);
      if (dist <= rect.width / 2 + 25) {
        dpadTouchIdRef.current = touch.identifier;
        if (dist > 5) {
          const rawDx = touch.clientX - centerX;
          const rawDy = touch.clientY - centerY;
          touchInputRef.current.dx = rawDx / Math.max(dist, 40);
          touchInputRef.current.dz = rawDy / Math.max(dist, 40);
          touchInputRef.current.aimAngle = Math.atan2(rawDx, rawDy);
        } else {
          touchInputRef.current.dx = 0;
          touchInputRef.current.dz = 0;
        }
        break;
      }
    }
  };

  const handleTouchDpadMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (dpadTouchIdRef.current === null) return;
    let targetTouch: React.Touch | null = null;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === dpadTouchIdRef.current) {
        targetTouch = e.touches[i];
        break;
      }
    }
    if (!targetTouch) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const rawDx = targetTouch.clientX - centerX;
    const rawDy = targetTouch.clientY - centerY;
    const dist = Math.hypot(rawDx, rawDy);
    if (dist > 5) {
      touchInputRef.current.dx = rawDx / Math.max(dist, 40);
      touchInputRef.current.dz = rawDy / Math.max(dist, 40);
      touchInputRef.current.aimAngle = Math.atan2(rawDx, rawDy);
    } else {
      touchInputRef.current.dx = 0;
      touchInputRef.current.dz = 0;
    }
  };

  const handleTouchDpadEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (dpadTouchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === dpadTouchIdRef.current) {
        dpadTouchIdRef.current = null;
        touchInputRef.current.dx = 0;
        touchInputRef.current.dz = 0;
        touchInputRef.current.aimAngle = undefined;
        break;
      }
    }
  };

  const handleActionPointerDown = (action: string, e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    try {
      (e.currentTarget as any).setPointerCapture(e.pointerId);
    } catch {}
    let pointers = actionPointersRef.current.get(action);
    if (!pointers) {
      pointers = new Set();
      actionPointersRef.current.set(action, pointers);
    }
    pointers.add(e.pointerId);
    (touchInputRef.current as any)[action] = true;
    if (e.pointerType === "mouse" && action === "shoot") {
      isMouseDown.current = true;
    }
  };

  const handleActionPointerUp = (action: string, e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    try {
      (e.currentTarget as any).releasePointerCapture(e.pointerId);
    } catch {}
    if (e.pointerType === "mouse" && action === "shoot") {
      isMouseDown.current = false;
    }
    const pointers = actionPointersRef.current.get(action);
    if (pointers) {
      pointers.delete(e.pointerId);
      if (pointers.size === 0) {
        (touchInputRef.current as any)[action] = false;
      }
    } else {
      (touchInputRef.current as any)[action] = false;
    }
  };

  const handleActionMouseDown = (action: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (action === "shoot") {
      isMouseDown.current = true;
    }
    (touchInputRef.current as any)[action] = true;
  };

  const handleActionMouseUp = (action: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (action === "shoot") {
      isMouseDown.current = false;
    }
    const pointers = actionPointersRef.current.get(action);
    if (!pointers || pointers.size === 0) {
      (touchInputRef.current as any)[action] = false;
    }
  };

  const setTouchAction = (action: string, active: boolean) => {
    (touchInputRef.current as any)[action] = active;
  };

  const handleButtonKeyDown = (action: string, e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Tab") {
      (touchInputRef.current as any)[action] = false;
      if (action === "shoot") isMouseDown.current = false;
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      (touchInputRef.current as any)[action] = true;
      if (action === "shoot") isMouseDown.current = true;
    }
  };

  const handleButtonKeyUp = (action: string, e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      (touchInputRef.current as any)[action] = false;
      if (action === "shoot") isMouseDown.current = false;
    }
  };

  const handleButtonBlur = (action: string) => {
    (touchInputRef.current as any)[action] = false;
    if (action === "shoot") isMouseDown.current = false;
  };

  
  const handleTouchUpdate = (update: TouchInputUpdate) => {
    if (update.dx !== undefined) touchInputRef.current.dx = update.dx;
    if (update.dz !== undefined) touchInputRef.current.dz = update.dz;
    if (update.aimAngle !== undefined) touchInputRef.current.aimAngle = update.aimAngle;
    if (update.shoot !== undefined) {
      touchInputRef.current.shoot = update.shoot;
      isMouseDown.current = update.shoot;
    }
    if (update.sprint !== undefined) touchInputRef.current.sprint = update.sprint;
    if (update.slide !== undefined) touchInputRef.current.slide = update.slide;
    if (update.roll !== undefined) touchInputRef.current.roll = update.roll;
    if (update.kick !== undefined) touchInputRef.current.kick = update.kick;
    if (update.interact !== undefined) queuedInteract.current = update.interact;
  };

  return (
    <div className="game-viewport">
      <GameCanvas sim={sim} />
      <TacticalHud sim={sim} onOpenHideout={() => setShowHideout(true)} />

      {/* Landscape Orientation Advisory for Mobile/Tablet */}
      {isTouchDevice && isPortrait && !dismissRotate && (
        <div className="landscape-advisory-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>🔄</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: '11px', color: '#f59e0b', letterSpacing: '0.05em' }}>
                TACTICAL LANDSCAPE RECOMMENDED
              </div>
              <div style={{ fontSize: '10px', color: '#cbd5e1' }}>
                Rotate device for top-down wide-angle radar & dual-thumb controls
              </div>
            </div>
          </div>
          <button
            onClick={() => setDismissRotate(true)}
            style={{
              background: '#334155',
              border: '1px solid #64748b',
              color: '#fff',
              borderRadius: '4px',
              padding: '4px 10px',
              fontSize: '10px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            DISMISS
          </button>
        </div>
      )}
      <ExfilOverlay sim={sim} onRestart={() => handleRestart()} onReturnToHideout={() => setShowHideout(true)} />

      {/* Mobile Tactical Touch Controls */}
      {isTouchDevice && <MobileControls sim={sim} onTouchInput={handleTouchUpdate} />}
    
      {showHideout && (
        <HideoutMenu
          onDeploy={(loadout) => {
            sim.setWeapon(loadout.primaryWeapon === "shotgun" ? "shotgun" : "rifle");
            if (loadout.armorTier === "light") {
              sim.player.armor = 40;
            } else if (loadout.armorTier === "medium") {
              sim.player.armor = 75;
            } else {
              sim.player.armor = 100;
            }
            sim.player.stimsRemaining = loadout.stims;
            setShowHideout(false);
            sound.playDeploy();
          }}
        />
      )}
    </div>
  );
};

export const App: React.FC = () => {
  const isTestMode = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("testMode") === "1";
  if (isTestMode) {
    return <TestApp />;
  }
  return <MainApp />;
};

export default App;

function TestApp() {
  const [sim] = useState(() => {
    const s = new SectorDepotSimulation("test_sandbox_raid", "spoke");
    s.admitOperative(0);
    if (!s.isAdmitted()) {
      throw new Error("Test operative admission failed");
    }
    s.player.id = "test-operative-01";
    s.player.name = "SPECTRE-1";
    s.player.isAlive = true;
    s.player.health = 100;
    s.player.weapon = "shotgun";
    s.player.ammo = 8;
    s.player.shotgunAmmo = 8;
    s.player.x = 0;
    s.player.y = 0;
    s.player.z = 0;
    s.player.facing = 0;
    s.player.action = "idle";
    return s;
  });

  return (
    <div className="relative w-screen h-screen bg-[#dde0e4] overflow-hidden select-none">
      <GameCanvas sim={sim} />
      <div className="hud-panel" style={{ position: "absolute", top: 16, left: 16 }}>
        <TacticalHud sim={sim} />
      </div>
    </div>
  );
}


