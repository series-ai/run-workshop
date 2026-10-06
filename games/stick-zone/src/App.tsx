import React, { useEffect, useRef, useState } from "react";
import { SectorDepotSimulation, type GameInput, computeGroundAimAngle } from "./sim/game.js";
import { MultiplayerCoordinator } from "./sim/multiplayer.js";
import { GameCanvas } from "./components/GameCanvas.js";
import { TacticalHud } from "./components/TacticalHud.js";
import { ExfilOverlay } from "./components/ExfilOverlay.js";
import { sound } from "./audio.js";
import "./styles.css";

async function requestSessionToken(raidId: string, opId: string, maxAttempts = 4): Promise<string | null> {
  if (typeof fetch === "undefined") return null;
  const storageKey = `sz_session_${raidId}_${opId}`;
  const resumeStorageKey = `sz_resume_${raidId}_${opId}`;
  let savedToken: string | null = null;
  let savedResumeKey: string | null = null;
  if (typeof sessionStorage !== "undefined") {
    savedToken = sessionStorage.getItem(storageKey);
    savedResumeKey = sessionStorage.getItem(resumeStorageKey);
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (savedToken) {
        headers["Authorization"] = `Bearer ${savedToken}`;
      }
      if (savedResumeKey) {
        headers["x-resumption-key"] = savedResumeKey;
      }
      try {
        const res = await fetch("/api/settlement/join", {
          method: "POST",
          headers,
          signal: controller.signal,
          body: JSON.stringify({
            raidId,
            operativeId: opId,
            ...(savedResumeKey ? { resumeKey: savedResumeKey } : {}),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const tok = data?.token || null;
          const resKey = data?.resumeKey || null;
          if (typeof sessionStorage !== "undefined") {
            if (tok) sessionStorage.setItem(storageKey, tok);
            if (resKey) sessionStorage.setItem(resumeStorageKey, resKey);
            if (typeof data?.ammo === "number") {
              sessionStorage.setItem(`sz_ammo_${raidId}_${opId}`, String(data.ammo));
            }
            if (data && (data.holdCompleted || data.holdCompletedAtTick || data.isExtracted || data.receipt)) {
              sessionStorage.setItem(`sz_exfil_${raidId}_${opId}`, JSON.stringify({
                holdCompleted: !!data.holdCompleted,
                holdCompletedAtTick: data.holdCompletedAtTick || 0,
                isExtracted: !!data.isExtracted,
                extractedAtTick: data.extractedAtTick || 0,
                receipt: data.receipt,
              }));
            } else if (data && data.holdCompleted === false && data.isExtracted === false) {
              sessionStorage.removeItem(`sz_exfil_${raidId}_${opId}`);
            }
            if (data?.isKia) {
              sessionStorage.setItem(`sz_kia_${raidId}_${opId}`, "true");
            }
          }
          if (data?.isTerminal) {
            return tok || `sz_term_${raidId}_${opId}`;
          }
          return tok;
        }
        if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
          if (!savedResumeKey || attempt >= 1) return null;
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch {}
    if (attempt < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, Math.min(2500, 400 * Math.pow(1.5, attempt))));
    }
  }
  return null;
}

export const App: React.FC = () => {
  const [sim, setSim] = useState(() => {
    let initialRaidId: string | undefined = undefined;
    // Allow an explicit raidId from the URL (?raidId=raid_sector7_...) — used by
    // repeat-raid / fresh-raid flows where each raid session has an immutable ledger id.
    if (typeof window !== "undefined") {
      const urlRaid = new URLSearchParams(window.location.search).get("raidId");
      if (urlRaid && /^[A-Za-z0-9_-]{3,64}$/.test(urlRaid)) {
        initialRaidId = urlRaid;
        try {
          sessionStorage.setItem("sz_active_raid", urlRaid);
        } catch {}
      }
    }
    if (typeof sessionStorage !== "undefined") {
      const savedRaid = sessionStorage.getItem("sz_active_raid");
      if (savedRaid) initialRaidId = savedRaid;
    }
    const s = new SectorDepotSimulation(initialRaidId);
    if (typeof sessionStorage !== "undefined" && initialRaidId) {
      const savedExfil = sessionStorage.getItem(`sz_exfil_${initialRaidId}_${s.player.id}`);
      if (savedExfil) {
        try {
          const exfilInfo = JSON.parse(savedExfil);
          s.restoreExtractionCustody(exfilInfo);
        } catch {}
      }
      const savedKia = sessionStorage.getItem(`sz_kia_${initialRaidId}_${s.player.id}`);
      if (savedKia === "true") {
        s.player.health = 0;
        s.player.isAlive = false;
      }
    }
    if (typeof window !== "undefined") (window as any).debugSim = s;
    return s;
  });
  const [, setFrame] = useState(0);

  const coordinatorRef = useRef<MultiplayerCoordinator | null>(null);
  const keysPressed = useRef<Set<string>>(new Set());
  const mousePos = useRef<{ clientX: number; clientY: number }>({ clientX: typeof window !== "undefined" ? window.innerWidth / 2 : 960, clientY: typeof window !== "undefined" ? window.innerHeight / 2 : 540 });
  const hasMouseMovedRef = useRef(false);
  const lastMouseMoveTimeRef = useRef(0);
  const isMouseDown = useRef(false);
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
    // Fetch active raid and obtain verified session token on mount
    if (typeof fetch !== "undefined") {
      (async () => {
        try {
          let savedRaidId: string | null = null;
          if (typeof sessionStorage !== "undefined") {
            savedRaidId = sessionStorage.getItem("sz_active_raid");
          }
          let tok: string | null = null;
          let currentRaidId = sim.raidId;

          let activeRaidData: any = null;
          try {
            const activeCtrl = typeof AbortController !== "undefined" ? new AbortController() : null;
            const activeTid = activeCtrl ? setTimeout(() => activeCtrl.abort(), 4000) : null;
            try {
              const res = await fetch("/api/settlement/active-raid", { signal: activeCtrl ? activeCtrl.signal : undefined });
              activeRaidData = await res.json();
            } finally {
              if (activeTid) clearTimeout(activeTid);
            }
            if (isCancelled) return;
            if (activeRaidData && activeRaidData.activeRaidId === sim.raidId && activeRaidData.machines && Array.isArray(activeRaidData.machines)) {
              for (const m of activeRaidData.machines) {
                const existing = sim.machines.find((x) => x.id === m.id);
                if (existing) {
                  if (sim.tick < 60) {
                    existing.health = Math.min(existing.health, m.health);
                    existing.isAlive = m.isAlive && existing.health > 0;
                  } else if (m.isAlive === false || m.health <= 0) {
                    existing.health = 0;
                    existing.isAlive = false;
                  }
                } else {
                  sim.machines.push({ ...m });
                }
              }
            }
          } catch {}

          // If the browser already has an ongoing session in savedRaidId, resume that raid!
          if (savedRaidId) {
            tok = await requestSessionToken(savedRaidId, sim.player.id);
            if (isCancelled) return;
            if (tok) {
              sim.raidId = savedRaidId;
              currentRaidId = savedRaidId;
              try {
                const savedCtrl = typeof AbortController !== "undefined" ? new AbortController() : null;
                const savedTid = savedCtrl ? setTimeout(() => savedCtrl.abort(), 4000) : null;
                let raidData: any = null;
                try {
                  const raidRes = await fetch(`/api/settlement/active-raid?raidId=${encodeURIComponent(savedRaidId)}`, { signal: savedCtrl ? savedCtrl.signal : undefined });
                  raidData = await raidRes.json();
                } finally {
                  if (savedTid) clearTimeout(savedTid);
                }
                if (raidData && raidData.machines && Array.isArray(raidData.machines)) {
                  for (const m of raidData.machines) {
                    const existing = sim.machines.find((x) => x.id === m.id);
                    if (existing) {
                      if (sim.tick < 60) {
                        existing.health = Math.min(existing.health, m.health);
                        existing.isAlive = m.isAlive && existing.health > 0;
                      } else if (m.isAlive === false || m.health <= 0) {
                        existing.health = 0;
                        existing.isAlive = false;
                      }
                    } else {
                      sim.machines.push({ ...m });
                    }
                  }
                }
                if (raidData && (raidData.holdCompleted || raidData.holdCompletedAtTick || raidData.isExtracted)) {
                  sim.restoreExtractionCustody({
                    holdCompleted: !!raidData.holdCompleted,
                    holdCompletedAtTick: raidData.holdCompletedAtTick || 0,
                    isExtracted: !!raidData.isExtracted,
                    extractedAtTick: raidData.extractedAtTick || 0,
                  });
                }
              } catch {}
            }
          }

          if (!tok) {
            if (activeRaidData && activeRaidData.activeRaidId && activeRaidData.activeRaidId !== sim.raidId) {
              if (sim.ingressController.getState().kind !== "confirmed_active") {
                sim.raidId = activeRaidData.activeRaidId;
                currentRaidId = activeRaidData.activeRaidId;
              }
            }
            tok = await requestSessionToken(currentRaidId, sim.player.id);
          }

          if (isCancelled) return;
          if (tok) {
            sim.sessionToken = tok;
            const savedAmmo = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(`sz_ammo_${currentRaidId}_${sim.player.id}`) : null;
            if (savedAmmo && !isNaN(Number(savedAmmo))) {
              sim.player.ammo = Number(savedAmmo);
            }
            const savedExfil = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(`sz_exfil_${currentRaidId}_${sim.player.id}`) : null;
            if (savedExfil) {
              try {
                const exfilInfo = JSON.parse(savedExfil);
                sim.restoreExtractionCustody(exfilInfo);
              } catch {}
            }
            const savedKia = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(`sz_kia_${currentRaidId}_${sim.player.id}`) : null;
            if (savedKia === "true") {
              sim.player.health = 0;
              sim.player.isAlive = false;
            }
            if (typeof sessionStorage !== "undefined") {
              sessionStorage.setItem("sz_active_raid", currentRaidId);
            }
            if (coordinatorRef.current && !sim.player.isExtracted && sim.player.isAlive && !tok.startsWith("sz_term_")) {
              coordinatorRef.current.connectWebSocket(tok);
            }
          }
        } catch {
          const tok = await requestSessionToken(sim.raidId, sim.player.id);
          if (tok) sim.sessionToken = tok;
        }
      })();
    }

    let lastReportedHoldTicks = 0;
    let lastReportTick = 0;
    let lastReportWallClock = 0;
    let mainHoldInFlight = false;
  sim.onHoldProgress = (holdTicks: number, currentTick: number) => {
      const now = Date.now();
      if (holdTicks === 0 && lastReportedHoldTicks === 0) {
        return;
      }
      const isReset = holdTicks === 0 && lastReportedHoldTicks !== 0;
      const isComplete = holdTicks >= 180;
      let shouldReport = false;
      if (isReset) {
        shouldReport = true;
      } else if (isComplete) {
        // Completed-phase custody reports: continue at a fine cadence (40ms) so the
        // relay's tick ladder and duration criteria (>=50 reports, >=3000ms) are fully
        // satisfied through corridor presentation and settlement submission.
        if (lastReportedHoldTicks < 180 || now - lastReportWallClock >= 40) {
          shouldReport = true;
        }
      } else {
        shouldReport = (now - lastReportWallClock >= 40 && currentTick - lastReportTick >= 2);
      }
      if (!shouldReport) {
        return;
      }
      lastReportWallClock = now;
      lastReportedHoldTicks = holdTicks;
      lastReportTick = currentTick;

      if (typeof fetch !== "undefined" && !mainHoldInFlight) {
        mainHoldInFlight = true;
        const sentAttemptId = typeof sim.exfilController?.getHoldAttemptId === "function" ? sim.exfilController.getHoldAttemptId() : 0;
        const holdCtrl = typeof AbortController !== "undefined" ? new AbortController() : null;
        const holdTid = holdCtrl ? setTimeout(() => holdCtrl.abort(), 3000) : null;
        fetch("/api/settlement/hold", {
          signal: holdCtrl ? holdCtrl.signal : undefined,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-operative-id": sim.player.id,
            ...(sim.sessionToken ? { "Authorization": `Bearer ${sim.sessionToken}` } : {}),
          },
          body: JSON.stringify({
            raidId: sim.raidId,
            operativeId: sim.player.id,
            holdTicks,
            currentTick,
            attemptId: sentAttemptId,
            x: sim.player.x,
            z: sim.player.z,
            inZone: sim.isPlayerInExfilZone(),
            isAlive: sim.player.isAlive,
            isKia: !sim.player.isAlive,
          }),
        })
          .then((res) => (res.ok ? res.json() : null))
          .finally(() => { if (holdTid) clearTimeout(holdTid); mainHoldInFlight = false; })
          .then((data) => {
            if (!data) return;
            const respAttemptId = typeof data.attemptId === "number" ? data.attemptId : sentAttemptId;
            const currentAttemptId = typeof (sim.exfilController as any)?.getHoldAttemptId === "function"
              ? (sim.exfilController as any).getHoldAttemptId()
              : sentAttemptId;
            if (respAttemptId !== currentAttemptId) {
              return; // Validate attempt before applying any response fields!
            }
            const exState = sim.exfilController.getState();
            const isCompletedInGrace = (exState.kind === "corridor_presentation" ||
              exState.kind === "submitting_settlement" ||
              exState.kind === "failed") &&
              ((sim as any).serverHoldCompletedAtTick > 0 && (sim as any).serverHoldCompletedAtTick <= 54000) &&
              sim.tick <= 57600;
            if ((data.reset === true || data.currentHoldTicks === 0) && !isCompletedInGrace) {
              lastReportedHoldTicks = 0;
              sim.exfilController.reconcileAuthoritativeHold(0, true, respAttemptId);
            } else if (typeof data.currentHoldTicks === "number") {
              lastReportedHoldTicks = data.currentHoldTicks;
              sim.exfilController.reconcileAuthoritativeHold(data.currentHoldTicks, false, respAttemptId);
            }
            if (typeof data.holdCompletedAtTick === "number") {
              (sim as any).serverHoldCompletedAtTick = data.holdCompletedAtTick;
            }
          })
          .catch(() => {});
      }
    };

    const prevDeath = sim.onPlayerDeath;
    sim.onPlayerDeath = () => {
      if (typeof prevDeath === "function") {
        prevDeath();
      } else if (coordinatorRef.current) {
        coordinatorRef.current.broadcastState(0);
      }
      if (typeof fetch !== "undefined") {
        const kiaCtrl = typeof AbortController !== "undefined" ? new AbortController() : null;
        const kiaTid = kiaCtrl ? setTimeout(() => kiaCtrl.abort(), 4000) : null;
        fetch("/api/settlement/kia", {
          signal: kiaCtrl ? kiaCtrl.signal : undefined,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-operative-id": sim.player.id,
            ...(sim.sessionToken ? { "Authorization": `Bearer ${sim.sessionToken}` } : {}),
          },
          body: JSON.stringify({
            raidId: sim.raidId,
            operativeId: sim.player.id,
            playerId: sim.player.id,
          }),
        })
          .finally(() => { if (kiaTid) clearTimeout(kiaTid); })
          .catch(() => {});
      }
    };

    sim.onLootCrate = (crateId: string, cash: number, claimTimestamp?: number) => {
      const ts = claimTimestamp || Date.now();
      if (typeof fetch !== 'undefined') {
        const lootCtrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const lootTid = lootCtrl ? setTimeout(() => lootCtrl.abort(), 4000) : null;
        (async () => {
          try {
            const res = await fetch('/api/settlement/loot', {
              signal: lootCtrl ? lootCtrl.signal : undefined,
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-operative-id': sim.player.id,
                ...(sim.sessionToken ? { 'Authorization': `Bearer ${sim.sessionToken}` } : {}),
              },
              body: JSON.stringify({
                raidId: sim.raidId,
                crateId,
                claimantId: sim.player.id,
                cashValue: cash,
                claimTimestamp: ts,
                timestamp: ts,
                x: sim.player.x,
                z: sim.player.z,
              }),
            });
            if (!res.ok) {
              sim.reconcileCrateRejection(crateId, cash);
              return;
            }
            const data = await res.json();
            if (data && (data.success === false || data.error)) {
              sim.reconcileCrateRejection(crateId, cash);
            } else if (data && data.success === true) {
              sim.reconcileCrateApproval?.(crateId, cash, data.claimTimestamp || ts);
            }
          } catch {
            sim.reconcileCrateRejection(crateId, cash);
          } finally {
            if (lootTid) clearTimeout(lootTid);
          }
        })();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (sim.isInputLocked()) return;
      keysPressed.current.add(e.code);
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
      accumulator = Math.max(0, accumulator - ms);
      accumulatorRef.current = accumulator;
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

        const isSprinting = keys.has("ShiftLeft") || keys.has("ShiftRight") || !!touchInputRef.current.sprint || !!touchInputRef.current.slide;
        const input: GameInput = {
          dx,
          dz,
          sprint: isSprinting,
          slide: keys.has("KeyC") || !!touchInputRef.current.slide,
          crouch: (keys.has("KeyC") && !isSprinting) || (!!touchInputRef.current.crouch && !touchInputRef.current.slide),
          roll: (keys.has("Space") && isSprinting) || !!touchInputRef.current.roll,
          jump: (keys.has("Space") && !isSprinting) || !!touchInputRef.current.jump,
          kick: keys.has("KeyF") || !!touchInputRef.current.kick,
          shoot: keys.has("KeyJ") || keys.has("KeyK") || keys.has("Enter") || isMouseDown.current || !!touchInputRef.current.shoot,
          interact: keys.has("KeyE") || !!touchInputRef.current.interact,
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

        // Gunshot audio on ammo consumption
        if (sim.player.ammo < prevAmmo) {
          sound.playGunshot();
          if (coordinatorRef.current) {
            coordinatorRef.current.broadcastFire(
              sim.player.x + Math.sin(sim.player.facing) * 20,
              sim.player.z + Math.cos(sim.player.facing) * 20
            );
          }
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
      let nextRaidId = overrideRaidId || pendingNextRaidId.current || undefined;
      const isPeerRaid = fromPeer || (!overrideRaidId && !!pendingNextRaidId.current);
      let newToken: string | null = null;

      if (isPeerRaid && nextRaidId) {
        if (typeof fetch !== "undefined") {
          const actCtrl = typeof AbortController !== "undefined" ? new AbortController() : null;
          const actTid = actCtrl ? setTimeout(() => actCtrl.abort(), 4000) : null;
          try {
            const res = await fetch("/api/settlement/active-raid", { signal: actCtrl ? actCtrl.signal : undefined });
            if (res.ok) {
              const activeData = await res.json();
              if (activeData.activeRaidId !== nextRaidId) {
                console.warn(`[REJECT RESTART] Peer announced raid ${nextRaidId} does not match server active raid ${activeData.activeRaidId}`);
                pendingNextRaidId.current = null;
                return false;
              }
            }
          } catch {
            pendingNextRaidId.current = null;
            return false;
          } finally {
            if (actTid) clearTimeout(actTid);
          }
        }
        newToken = await requestSessionToken(nextRaidId, sim.player.id);
        if (!newToken) {
          console.error("Failed to acquire session token for peer raid:", nextRaidId);
          pendingNextRaidId.current = null;
          return false;
        }
      } else {
        nextRaidId = overrideRaidId || `raid_sector7_${Date.now()}`;
        if (typeof fetch !== "undefined") {
          const initCtrl = typeof AbortController !== "undefined" ? new AbortController() : null;
          const initTid = initCtrl ? setTimeout(() => initCtrl.abort(), 4000) : null;
          try {
            const resp = await fetch("/api/settlement/init-raid", {
              signal: initCtrl ? initCtrl.signal : undefined,
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-operative-id": sim.player.id,
                ...(sim.sessionToken ? { "Authorization": `Bearer ${sim.sessionToken}` } : {}),
              },
              body: JSON.stringify({
                raidId: nextRaidId,
                allowablePool: 50000,
                operatives: ["op_player", "op_alpha_1", "op_bravo_1"],
              }),
            });
            if (!resp.ok) {
              console.error("Failed to initialize raid on server:", resp.status);
              return false; // Require successful initialization before restart!
            }
            const data = await resp.json();
            newToken = data?.token || (data?.tokens && data.tokens[sim.player.id]) || null;
          } catch (err) {
            console.error("init-raid network error:", err);
            return false; // Require successful initialization before restart!
          } finally {
            if (initTid) clearTimeout(initTid);
          }
        }
        if (!newToken) {
          newToken = await requestSessionToken(nextRaidId, sim.player.id);
        }
      }

      if (newToken && typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(`sz_session_${nextRaidId}_${sim.player.id}`, newToken);
        sessionStorage.setItem("sz_active_raid", nextRaidId);
      }
      pendingNextRaidId.current = null; // Cleared strictly upon successful redeployment
      const newSim = new SectorDepotSimulation(nextRaidId);
      if (newToken) {
        newSim.sessionToken = newToken;
      }
      setSim(newSim);
      if (typeof window !== "undefined") {
        (window as any).debugSim = newSim;
      }

      if (!fromPeer && coordinatorRef.current) {
        coordinatorRef.current.broadcastRaidRestart(nextRaidId);
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

  return (
    <div className="game-viewport">
      <GameCanvas sim={sim} />
      <TacticalHud sim={sim} />
      <ExfilOverlay sim={sim} onRestart={() => handleRestart()} />

      {/* Mobile Tactical Touch Controls */}
      <div className="mobile-touch-controls">
        <div
          className="mobile-dpad"
          onTouchStart={handleTouchDpadStart}
          onTouchMove={handleTouchDpadMove}
          onTouchEnd={handleTouchDpadEnd}
          onTouchCancel={handleTouchDpadEnd}
        >
          <div className="mobile-stick-thumb" />
        </div>
        <div className="mobile-action-buttons" onMouseDown={(e) => e.stopPropagation()}>
          <button
            className="mobile-btn mobile-btn-fire"
            onPointerDown={(e) => handleActionPointerDown("shoot", e)}
            onPointerUp={(e) => handleActionPointerUp("shoot", e)}
            onPointerCancel={(e) => handleActionPointerUp("shoot", e)}
            onMouseDown={(e) => handleActionMouseDown("shoot", e)}
            onMouseUp={(e) => handleActionMouseUp("shoot", e)}
            onKeyDown={(e) => handleButtonKeyDown("shoot", e)}
            onKeyUp={(e) => handleButtonKeyUp("shoot", e)}
            onBlur={() => handleButtonBlur("shoot")}
          >
            Fire
          </button>
          <button
            className="mobile-btn"
            onPointerDown={(e) => handleActionPointerDown("kick", e)}
            onPointerUp={(e) => handleActionPointerUp("kick", e)}
            onPointerCancel={(e) => handleActionPointerUp("kick", e)}
            onMouseDown={(e) => handleActionMouseDown("kick", e)}
            onMouseUp={(e) => handleActionMouseUp("kick", e)}
            onKeyDown={(e) => handleButtonKeyDown("kick", e)}
            onKeyUp={(e) => handleButtonKeyUp("kick", e)}
            onBlur={() => handleButtonBlur("kick")}
          >
            Kick
          </button>
          <button
            className="mobile-btn"
            onPointerDown={(e) => handleActionPointerDown("interact", e)}
            onPointerUp={(e) => handleActionPointerUp("interact", e)}
            onPointerCancel={(e) => handleActionPointerUp("interact", e)}
            onMouseDown={(e) => handleActionMouseDown("interact", e)}
            onMouseUp={(e) => handleActionMouseUp("interact", e)}
            onKeyDown={(e) => handleButtonKeyDown("interact", e)}
            onKeyUp={(e) => handleButtonKeyUp("interact", e)}
            onBlur={() => handleButtonBlur("interact")}
          >
            Loot (E)
          </button>
          <button
            className="mobile-btn"
            onPointerDown={(e) => handleActionPointerDown("slide", e)}
            onPointerUp={(e) => handleActionPointerUp("slide", e)}
            onPointerCancel={(e) => handleActionPointerUp("slide", e)}
            onMouseDown={(e) => handleActionMouseDown("slide", e)}
            onMouseUp={(e) => handleActionMouseUp("slide", e)}
            onKeyDown={(e) => handleButtonKeyDown("slide", e)}
            onKeyUp={(e) => handleButtonKeyUp("slide", e)}
            onBlur={() => handleButtonBlur("slide")}
          >
            Slide (C)
          </button>
          <button
            className="mobile-btn"
            onPointerDown={(e) => handleActionPointerDown("sprint", e)}
            onPointerUp={(e) => handleActionPointerUp("sprint", e)}
            onPointerCancel={(e) => handleActionPointerUp("sprint", e)}
            onMouseDown={(e) => handleActionMouseDown("sprint", e)}
            onMouseUp={(e) => handleActionMouseUp("sprint", e)}
            onKeyDown={(e) => handleButtonKeyDown("sprint", e)}
            onKeyUp={(e) => handleButtonKeyUp("sprint", e)}
            onBlur={() => handleButtonBlur("sprint")}
          >
            Sprint
          </button>
          <button
            className="mobile-btn"
            onPointerDown={(e) => handleActionPointerDown("jump", e)}
            onPointerUp={(e) => handleActionPointerUp("jump", e)}
            onPointerCancel={(e) => handleActionPointerUp("jump", e)}
            onMouseDown={(e) => handleActionMouseDown("jump", e)}
            onMouseUp={(e) => handleActionMouseUp("jump", e)}
            onKeyDown={(e) => handleButtonKeyDown("jump", e)}
            onKeyUp={(e) => handleButtonKeyUp("jump", e)}
            onBlur={() => handleButtonBlur("jump")}
          >
            Jump
          </button>
          <button
            className="mobile-btn"
            onPointerDown={(e) => handleActionPointerDown("crouch", e)}
            onPointerUp={(e) => handleActionPointerUp("crouch", e)}
            onPointerCancel={(e) => handleActionPointerUp("crouch", e)}
            onMouseDown={(e) => handleActionMouseDown("crouch", e)}
            onMouseUp={(e) => handleActionMouseUp("crouch", e)}
            onKeyDown={(e) => handleButtonKeyDown("crouch", e)}
            onKeyUp={(e) => handleButtonKeyUp("crouch", e)}
            onBlur={() => handleButtonBlur("crouch")}
          >
            Crouch
          </button>
          <button
            className="mobile-btn"
            onPointerDown={(e) => handleActionPointerDown("roll", e)}
            onPointerUp={(e) => handleActionPointerUp("roll", e)}
            onPointerCancel={(e) => handleActionPointerUp("roll", e)}
            onMouseDown={(e) => handleActionMouseDown("roll", e)}
            onMouseUp={(e) => handleActionMouseUp("roll", e)}
            onKeyDown={(e) => handleButtonKeyDown("roll", e)}
            onKeyUp={(e) => handleButtonKeyUp("roll", e)}
            onBlur={() => handleButtonBlur("roll")}
          >
            Roll
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
