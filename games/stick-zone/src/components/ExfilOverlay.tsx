import { useStashStore } from "../progression/stashStore.js";
import React, { useEffect, useState, useRef } from "react";
import type { SectorDepotSimulation } from "../sim/game.js";
import {
  type ExfilState,
  authoritativeLedgerCommit,
  verifySettlementReceipt,
  defaultSettlementLedger,
  verifiedReceiptSnapshots,
  recordVerifiedReceipt,
  isReceiptContentVerified,
} from "../sim/airlock.js";
import { Loader2, CheckCircle, ArrowRight, ShieldCheck, ShieldAlert, Database, Lock, AlertTriangle } from "lucide-react";

interface ExfilOverlayProps {
  sim: SectorDepotSimulation;
  onRestart: () => Promise<boolean | void> | boolean | void;
  onReturnToHideout?: () => void;
}

export const ExfilOverlay: React.FC<ExfilOverlayProps> = ({ sim, onRestart, onReturnToHideout }) => {
  const [state, setState] = useState<ExfilState>(() => sim.exfilController.getState());
  const [corridorElapsed, setCorridorElapsed] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [restartError, setRestartError] = useState<string | null>(null);
  const [receiptCryptoVerified, setReceiptCryptoVerified] = useState(false);

  useEffect(() => {
    setIsRestarting(false);
    setRestartError(null);
  }, [sim.raidId]);

  const handleRedeploy = async () => {
    if (isRestarting) return;
    setIsRestarting(true);
    setRestartError(null);
    try {
      const res = await Promise.resolve(onRestart?.());
      if (res === false) {
        setRestartError("Redeployment failed on server. Please retry.");
        setIsRestarting(false);
      } else {
        setIsRestarting(false);
      }
    } catch (err: any) {
      setRestartError(err?.message || "Redeployment request failed. Please retry.");
      setIsRestarting(false);
    }
  };

  useEffect(() => {
    const timer = setInterval(async () => {
      const currentState = sim.exfilController.getState();
      setState(currentState);


      if (currentState.kind === "corridor_presentation") {
        if (!sim.player.isAlive || sim.player.health <= 0) {
          sim.exfilController.cancel();
          setState(sim.exfilController.getState());
          return;
        }
        const elapsed = Date.now() - currentState.startedAtMs;
        setCorridorElapsed(elapsed);

        // When 2500ms corridor finishes — wait until the relay CUSTODY has verified the
        // completed hold (serverHoldCompletedAtTick is stamped from the /hold response
        // the moment the authoritative ladder reaches 180 verified ticks), then submit.
        if (elapsed >= currentState.durationMs && !isSubmitting && !corridorSettlingRef.current) {
          // Synchronous operation guard acquired BEFORE the first await: later interval
          // ticks see isSubmitting true immediately (React state updates are async, so
          // the ref guard closes the race window the interval could otherwise re-enter).
          corridorSettlingRef.current = true;
          setIsSubmitting(true);
          const t0 = Date.now();
          while (!(sim as any).serverHoldCompletedAtTick && Date.now() - t0 < 12000) {
            await new Promise((r) => setTimeout(r, 100));
            if (sim.exfilController.getState().kind !== "corridor_presentation" || !sim.player.isAlive || sim.player.health <= 0) {
              corridorSettlingRef.current = false;
              setIsSubmitting(false);
              return;
            }
          }
          corridorSettlingRef.current = false;

          if (sim.exfilController.getState().kind !== "corridor_presentation" || !sim.player.isAlive || sim.player.health <= 0) {
            setIsSubmitting(false);
            return;
          }

          try {
            sim.exfilController.submitSettlement();
            setState(sim.exfilController.getState());

            if (sim.isSocketDisconnected === false && sim.serverMachineDamageAuthority && !(sim as any).serverHoldCompletedAtTick) {
              throw new Error("Relay authority hold verification required but not confirmed");
            }

            // Freeze settlement snapshot for idempotent retries, preserving eligible hold completion tick through submission
            const serverHoldTick = (sim as any).serverHoldCompletedAtTick || 0;
            const targetSnapshotTick = (serverHoldTick > 0 && serverHoldTick <= 54000)
              ? Math.min(sim.tick, serverHoldTick)
              : Math.min(sim.tick, 54000);
            sim.freezeSettlementSnapshot(targetSnapshotTick);

            // Invoke authoritative ledger commitment authority with automatic corridor retry
            let canonicalReceipt: any = null;
            let outcomePayload: any = null;
            const activeLedger = (sim as any).settlementAuthority || defaultSettlementLedger;

            if (typeof (sim as any).requestServerSettlement === "function") {
              for (let attempt = 1; attempt <= 5; attempt++) {
                try {
                  const res = await (sim as any).requestServerSettlement(targetSnapshotTick, sim.player.cash);
                  canonicalReceipt = res.receipt;
                  outcomePayload = res.outcomePayload;
                  break;
                } catch (commitErr: any) {
                  if (commitErr?.message?.includes("Airlock corridor presentation in progress") && attempt < 5) {
                    const backoffMs = 200 * Math.pow(2, attempt - 1);
                    await new Promise((r) => setTimeout(r, backoffMs));
                    continue;
                  }
                  throw commitErr;
                }
              }
            } else {
              for (let attempt = 1; attempt <= 5; attempt++) {
                try {
                  const res = await authoritativeLedgerCommit(sim, activeLedger);
                  canonicalReceipt = res.receipt;
                  outcomePayload = res.outcomePayload;
                  break;
                } catch (commitErr: any) {
                  if (commitErr?.message?.includes("Airlock corridor presentation in progress") && attempt < 5) {
                    const backoffMs = 200 * Math.pow(2, attempt - 1);
                    await new Promise((r) => setTimeout(r, backoffMs));
                    continue;
                  }
                  throw commitErr;
                }
              }
            }

            (sim as any).lastSettlementReceipt = canonicalReceipt;
            (sim as any).lastOutcomePayload = outcomePayload;

            if (activeLedger?.auditLog && typeof activeLedger.auditLog.set === "function") {
              activeLedger.auditLog.set(canonicalReceipt.receiptId, canonicalReceipt);
            }
            if (defaultSettlementLedger?.auditLog && typeof defaultSettlementLedger.auditLog.set === "function") {
              defaultSettlementLedger.auditLog.set(canonicalReceipt.receiptId, canonicalReceipt);
            }

            // Verify strict canonical BigInt, SHA-256 digest, and structural invariants against authoritative ledger BEFORE any profile or audit mutations
            const verification = await verifySettlementReceipt(canonicalReceipt, outcomePayload, activeLedger);

            const curState = sim.exfilController.getState();
            if (verification.valid && sim.player.isAlive && sim.player.health > 0 && (curState.kind === "submitting_settlement" || curState.kind === "extracted")) {
              if (canonicalReceipt && canonicalReceipt.receiptId) {
                if (activeLedger?.auditLog && typeof activeLedger.auditLog.set === "function") {
                  activeLedger.auditLog.set(canonicalReceipt.receiptId, canonicalReceipt);
                }
                if (defaultSettlementLedger?.auditLog && typeof defaultSettlementLedger.auditLog.set === "function") {
                  defaultSettlementLedger.auditLog.set(canonicalReceipt.receiptId, canonicalReceipt);
                }
                for (const p of canonicalReceipt.participantResults || []) {
                  if (p.activeRaidCleared) {
                    const prof1 = activeLedger?.profiles?.get(p.profileId);
                    if (prof1 && (prof1.activeRaid === canonicalReceipt.raidId || !prof1.activeRaid)) {
                      prof1.activeRaid = null;
                    }
                    const prof2 = defaultSettlementLedger?.profiles?.get(p.profileId);
                    if (prof2 && (prof2.activeRaid === canonicalReceipt.raidId || !prof2.activeRaid)) {
                      prof2.activeRaid = null;
                    }
                  }
                }
              }
              if (curState.kind !== "extracted") {
                sim.exfilController.onReceipt(canonicalReceipt);
                sim.player.isExtracted = true;
              }
              recordVerifiedReceipt(canonicalReceipt);
              (sim as any).__cryptographicallyVerifiedReceiptId = canonicalReceipt.receiptId;
              setReceiptCryptoVerified(true);
              const receiptKey = `${canonicalReceipt.raidId || sim.raidId}:${canonicalReceipt.receiptId}`;
              const coordinator = (sim as any).multiplayerCoordinator || (sim as any).coordinator;
              if (
                sim.acceptedReceiptKeys?.has(receiptKey) ||
                coordinator?.acceptedReceiptKeys?.has(receiptKey) ||
                (sim as any).__acceptedReceiptKeys?.has(receiptKey)
              ) {
                return;
              }
                            sim.onExfilSuccess?.(canonicalReceipt);
              // SyncHub-only settlement: rewards bank from the server
              // debrief (co-op) or not at all (offline practice). The
              // local ledger never credits cash, items, or XP.
              sim.combatLog.push(
                sim.coopSpokeAttached
                  ? "[CO-OP] Rewards settle from the SyncHub debrief only. Local credit skipped."
                  : "[PRACTICE] Offline raid complete. No rewards banked without SyncHub settlement.",
              );
              sim.acceptedReceiptKeys?.add(receiptKey);
              coordinator?.acceptedReceiptKeys?.add(receiptKey);
              if (!(sim as any).__acceptedReceiptKeys) (sim as any).__acceptedReceiptKeys = new Set<string>();
              (sim as any).__acceptedReceiptKeys.add(receiptKey);
              setState(sim.exfilController.getState());
            } else {
              const reason = !verification.valid
                ? `Settlement verification failed: ${verification.reason}`
                : "Operative eliminated or settlement state invalid";
              if (sim.exfilController.getState().kind === "submitting_settlement") {
                sim.exfilController.onFailure(reason, true);
              }
              setState(sim.exfilController.getState());
            }
          } catch (err: any) {
            if (sim.exfilController.getState().kind === "submitting_settlement") {
              sim.exfilController.onFailure(err.message || "Settlement pipeline error", true);
            }
            setState(sim.exfilController.getState());
          } finally {
            setIsSubmitting(false);
          }
        }
      }
    }, 40);

    return () => clearInterval(timer);
  }, [sim, isSubmitting]);

  const handleRetry = async () => {
    if (state.kind !== "failed") return;
    if (!sim.player.isAlive || sim.player.health <= 0) return;
    sim.exfilController.retrySettlement();
    setState(sim.exfilController.getState());
    setIsSubmitting(true);

    try {
      const activeLedger = (sim as any).settlementAuthority || defaultSettlementLedger;
      let canonicalReceipt: any = null;
      let outcomePayload: any = null;
      const targetSnapshotTick = sim.frozenSettlementTick ?? sim.tick;
      const targetSnapshotCash = sim.frozenSettlementCash ?? sim.player.cash;

      if (typeof (sim as any).requestServerSettlement === "function") {
        for (let attempt = 1; attempt <= 5; attempt++) {
          try {
            const res = await (sim as any).requestServerSettlement(targetSnapshotTick, targetSnapshotCash);
            canonicalReceipt = res.receipt;
            outcomePayload = res.outcomePayload;
            break;
          } catch (commitErr: any) {
            if (commitErr?.message?.includes("Airlock corridor presentation in progress") && attempt < 5) {
              const backoffMs = 200 * Math.pow(2, attempt - 1);
              await new Promise((r) => setTimeout(r, backoffMs));
              continue;
            }
            throw commitErr;
          }
        }
      } else {
        const res = await authoritativeLedgerCommit(sim, activeLedger);
        canonicalReceipt = res.receipt;
        outcomePayload = res.outcomePayload;
      }

      if (activeLedger?.auditLog && typeof activeLedger.auditLog.set === "function") {
        activeLedger.auditLog.set(canonicalReceipt.receiptId, canonicalReceipt);
      }
      if (defaultSettlementLedger?.auditLog && typeof defaultSettlementLedger.auditLog.set === "function") {
        defaultSettlementLedger.auditLog.set(canonicalReceipt.receiptId, canonicalReceipt);
      }



      const verification = await verifySettlementReceipt(canonicalReceipt, outcomePayload, activeLedger);

      if (verification.valid && sim.player.isAlive && sim.player.health > 0 && sim.exfilController.getState().kind === "submitting_settlement") {
        const receiptKey = `${canonicalReceipt.raidId || sim.raidId}:${canonicalReceipt.receiptId}`;
        const coordinator = (sim as any).multiplayerCoordinator || (sim as any).coordinator;
        if (
          sim.acceptedReceiptKeys?.has(receiptKey) ||
          coordinator?.acceptedReceiptKeys?.has(receiptKey) ||
          (sim as any).__acceptedReceiptKeys?.has(receiptKey)
        ) {
          return;
        }
        recordVerifiedReceipt(canonicalReceipt);
        sim.exfilController.onReceipt(canonicalReceipt);
        sim.player.isExtracted = true;
        sim.onExfilSuccess?.(canonicalReceipt);
        // SyncHub-only settlement: see the corridor branch above.
        sim.combatLog.push(
          sim.coopSpokeAttached
            ? "[CO-OP] Rewards settle from the SyncHub debrief only. Local credit skipped."
            : "[PRACTICE] Offline raid complete. No rewards banked without SyncHub settlement.",
        );
        sim.acceptedReceiptKeys?.add(receiptKey);
        coordinator?.acceptedReceiptKeys?.add(receiptKey);
        if (!(sim as any).__acceptedReceiptKeys) (sim as any).__acceptedReceiptKeys = new Set<string>();
        (sim as any).__acceptedReceiptKeys.add(receiptKey);
        setState(sim.exfilController.getState());
      } else {
        const reason = !verification.valid
          ? `Settlement verification failed: ${verification.reason}`
          : "Operative eliminated or settlement state invalid";
        if (sim.exfilController.getState().kind === "submitting_settlement") {
          sim.exfilController.onFailure(reason, true);
        }
        setState(sim.exfilController.getState());
      }
    } catch (err: any) {
      if (sim.exfilController.getState().kind === "submitting_settlement") {
        sim.exfilController.onFailure(err.message || "Settlement retry failed", true);
      }
      setState(sim.exfilController.getState());
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturnToRaid = () => {
    sim.clearFrozenSettlement();
    sim.exfilController.cancel();
    setState(sim.exfilController.getState());
  };

  
  
  const isDead = !sim.player.isAlive && !sim.player.isExtracted;
  const activeModalKind: "none" | "kia" | "corridor" | "submitting" | "extracted" | "failed" = (() => {
    if (isDead) return "kia";
    if (state.kind === "corridor_presentation") return "corridor";
    if (state.kind === "submitting_settlement") return "submitting";
    if (state.kind === "extracted") return "extracted";
    if (state.kind === "failed") return "failed";
    return "none";
  })();
  const isModalActive = activeModalKind !== "none";
  const outcomeRecordedRef = useRef<string | null>(null);

  useEffect(() => {
    // SyncHub-only settlement: the server debrief owns raid statistics
    // too, so a co-op KIA records nothing locally.
    if (activeModalKind === "kia" && outcomeRecordedRef.current !== sim.raidId && !sim.coopSpokeAttached) {
      outcomeRecordedRef.current = sim.raidId;
      useStashStore.getState().recordKiaOutcome(sim.raidId);
    }
  }, [activeModalKind, sim.raidId]);


  useEffect(() => {
    if (activeModalKind === "extracted") {
      const rawReceipt = (state as any).receipt || (sim as any).lastSettlementReceipt || null;
      if (!rawReceipt || typeof rawReceipt !== "object") {
        setReceiptCryptoVerified(false);
        return;
      }
      // Bound strictly to immutable verified snapshot and content parity
      if (isReceiptContentVerified(rawReceipt)) {
        setReceiptCryptoVerified(true);
        return;
      }
      setReceiptCryptoVerified(false);
      let active = true;
      (async () => {
        try {
          const ledger = sim.settlementAuthority || defaultSettlementLedger;
          let outcomePayload = (state as any).outcomePayload || (sim as any).lastOutcomePayload;
          // Outcome payload resolved from Synchub coordinator state
          if (!outcomePayload) {
            if (active) setReceiptCryptoVerified(false);
            return;
          }
          const verification = await verifySettlementReceipt(rawReceipt, outcomePayload, ledger);
          if (active) {
            const isValid = Boolean(verification && verification.valid);
            if (isValid) {
              recordVerifiedReceipt(rawReceipt);
            }
            setReceiptCryptoVerified(isValid);
          }
        } catch {
          if (active) setReceiptCryptoVerified(false);
        }
      })();
      return () => { active = false; };
    } else {
      setReceiptCryptoVerified(false);
    }
  }, [activeModalKind, (state as any)?.receipt, (sim as any)?.lastSettlementReceipt]);

  const modalRef = useRef<HTMLDivElement>(null);
  // Single-flight settlement guard: exactly one corridor->settlement continuation runs.
  const corridorSettlingRef = useRef<boolean>(false);

  // Background elements inert & aria-hidden management to make non-dialog controls inactive
  useEffect(() => {
    if (!isModalActive) return;

    const backgroundElements: HTMLElement[] = [];
    document.querySelectorAll<HTMLElement>(".game-viewport > :not(.exfil-overlay-backdrop)").forEach((el) => {
      el.setAttribute("aria-hidden", "true");
      (el as any).inert = true;
      backgroundElements.push(el);
    });

    return () => {
      backgroundElements.forEach((el) => {
        el.removeAttribute("aria-hidden");
        (el as any).inert = false;
      });
    };
  }, [isModalActive]);

  // Robust focus trap and management within active modal
  useEffect(() => {
    if (!isModalActive || !modalRef.current) return;
    const container = modalRef.current;

    const getFocusables = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
        )
      );

    const focusables = getFocusables();
    if (focusables.length > 0) {
      focusables[0].focus();
    } else {
      container.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeModalKind === "kia" || activeModalKind === "extracted") {
        if (e.code === "Space" || e.code === "Enter") {
          e.preventDefault();
          handleRedeploy();
          return;
        }
        if (e.code === "Escape" && onReturnToHideout) {
          e.preventDefault();
          onReturnToHideout();
          return;
        }
      }
      if (e.key !== "Tab") return;
      const currentFocusables = getFocusables();
      if (currentFocusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = currentFocusables[0];
      const last = currentFocusables[currentFocusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first || !container.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last || !container.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isModalActive, activeModalKind]);

  if (!isModalActive) {
    return null;
  }

    const survivalSec = Math.floor(sim.tick / 60);
  const survivalMin = Math.floor(survivalSec / 60);
  const survivalSecRem = survivalSec % 60;
  const survivalFormatted = `${survivalMin}:${String(survivalSecRem).padStart(2, "0")}`;

  const lastElimLog = sim.combatLog
    .slice()
    .reverse()
    .find((l) => l.includes("Eliminated") || l.includes("downed") || l.includes("Terminated") || l.includes("WARLORD") || l.includes("Shotgun"));
  const killerName = lastElimLog ? lastElimLog.replace(/^\[.*?\]\s*/, "") : "SCAV ENFORCER / M590 SHORTBARREL";

  const lostCargoItems = ((sim.player as any).lootItems || []) as any[];
  const lostCargoCount = lostCargoItems.length;
  const lostCargoEstVal = lostCargoItems.reduce((acc: number, it: any) => acc + (it.value || 450), 0);

  return (
    <div className="exfil-overlay-backdrop">
      {/* 1. OPERATIVE ELIMINATED (K.I.A.) - Visceral Manga Arcade Game Over */}
      {activeModalKind === "kia" && (
        <div
          ref={modalRef}
          tabIndex={-1}
          className="exfil-kia-fullscreen"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kia-dialog-title"
        >
          <div className="kia-manga-arcade-card">
            {/* Giant Graphic Impact Watermark */}
            <div className="kia-watermark-text" aria-hidden="true">K.I.A.</div>

            {/* Diagonal Comic Warning Ribbon */}
            <div className="kia-manga-ribbon">
              <span>SECTOR 7 CASUALTY REPORT // COMBAT LOSS</span>
            </div>

            {/* Massive Distressed Arcade Title */}
            <div className="kia-manga-title-wrap">
              <h1 id="kia-dialog-title" className="kia-manga-title">
                OPERATIVE DOWN
              </h1>
              <div className="kia-manga-subtag">
                CRITICAL VITAL FLATLINE // DEFEATED IN COMBAT
              </div>
            </div>

            {/* Fatal Encounter Comic Box */}
            <div className="kia-manga-encounter">
              <span className="kia-encounter-kicker">TERMINATED BY</span>
              <span className="kia-encounter-killer">{killerName}</span>
            </div>

            {/* Arcade Score Tally Grid */}
            <div className="kia-arcade-score-grid">
              <div className="kia-score-tile">
                <span className="kia-tile-label">TIME SURVIVED</span>
                <span className="kia-tile-val text-cyan">{survivalFormatted}</span>
              </div>
              <div className="kia-score-tile">
                <span className="kia-tile-label">HOSTILES ELIMINATED</span>
                <span className="kia-tile-val text-amber">
                  {sim.combatLog.filter((l) => l.includes("Eliminated") || l.includes("downed") || l.includes("Terminated")).length} KILLS
                </span>
              </div>
              <div className="kia-score-tile">
                <span className="kia-tile-label">CARGO FORFEITED</span>
                <span className="kia-tile-val text-crimson">
                  -₡{sim.player.cash.toLocaleString()}
                </span>
              </div>
            </div>

            {/* High-Impact Tactical Arcade Action Buttons */}
            <div className="kia-arcade-actions">
              <button
                onClick={handleRedeploy}
                disabled={isRestarting}
                autoFocus
                className="redeploy-operative-btn kia-manga-btn-primary"
              >
                {isRestarting ? "RE-CLONING OPERATIVE..." : "⚡ REDEPLOY OPERATIVE [SPACE]"}
              </button>
              {onReturnToHideout && (
                <button
                  onClick={onReturnToHideout}
                  className="kia-manga-btn-secondary"
                >
                  🛡️ RETURN TO HIDEOUT [ESC]
                </button>
              )}
            </div>

            {restartError && (
              <div className="kia-error-notice">
                {restartError}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. 2500ms Corridor Presentation - Dark Industrial Airlock Sequence */}
      {activeModalKind === "corridor" && (() => {
        const corridorDurationMs = state.kind === "corridor_presentation" ? state.durationMs : 2500;
        return (
          <div
            ref={modalRef}
            tabIndex={-1}
            className="exfil-corridor-modal clip-cut-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="corridor-dialog-title"
            style={{
              background: "rgba(18, 24, 36, 0.95)",
              border: "2px solid #FFC247",
              boxShadow: "0 0 35px rgba(255, 194, 71, 0.25)",
              color: "#f8fafc",
            }}
          >
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(255, 194, 71, 0.15)", border: "1px solid #FFC247", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14, color: "#FFC247" }}>
              <Lock style={{ width: 26, height: 26 }} />
            </div>
            <h2 id="corridor-dialog-title" style={{ fontSize: 20, fontWeight: 900, letterSpacing: "1.5px", color: "#FFC247", textTransform: "uppercase", marginBottom: 6 }}>
              PNEUMATIC AIRLOCK // DEPLOYMENT SEALED
            </h2>
            <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 20, maxWidth: "420px" }}>
              Input locked. Hydraulic brackets engaged on LZ-Charlie corridor. Committing authoritative cryptographic ledger snapshot...
            </p>
            <div style={{ width: "100%", height: 8, background: "#0B0F19", borderRadius: 4, overflow: "hidden", border: "1px solid #334155", marginBottom: 10 }}>
              <div
                style={{
                  width: `${Math.min(100, (corridorElapsed / corridorDurationMs) * 100)}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #FFC247 0%, #72F1A8 100%)",
                  transition: "width 75ms linear",
                }}
              />
            </div>
            <span style={{ fontSize: 12, color: "#51E5F0", fontFamily: "monospace", fontWeight: 800 }}>
              {(Math.max(0, corridorDurationMs - corridorElapsed) / 1000).toFixed(1)}s REMAINING
            </span>
          </div>
        );
      })()}

      {/* 3. Submitting Settlement - High-Tech Cipher Commit */}
      {activeModalKind === "submitting" && (
        <div
          ref={modalRef}
          tabIndex={-1}
          className="exfil-corridor-modal clip-cut-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settling-dialog-title"
          style={{
            background: "rgba(18, 24, 36, 0.95)",
            border: "2px solid #51E5F0",
            boxShadow: "0 0 35px rgba(81, 229, 240, 0.3)",
            color: "#f8fafc",
          }}
        >
          <Loader2 style={{ width: 44, height: 44, color: "#51E5F0", animation: "spin 1s linear infinite", marginBottom: 16 }} />
          <h2 id="settling-dialog-title" style={{ fontSize: 18, fontWeight: 900, color: "#51E5F0", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8 }}>
            AUTHORITATIVE SETTLEMENT IN PROGRESS
          </h2>
          <p style={{ fontSize: 12, color: "#94a3b8", fontFamily: "monospace" }}>
            Computing SHA-256 state digest & committing canonical BigInt ledger revision...
          </p>
        </div>
      )}

      {/* 4. Extracted Receipt Debrief - Visceral Manga Arcade Card */}
      {activeModalKind === "extracted" && (() => {
        const rawReceipt = (state as any).receipt || (sim as any).lastSettlementReceipt || null;
        const isContentVerified = isReceiptContentVerified(rawReceipt);
        const verifiedSnapshot = (rawReceipt && rawReceipt.receiptId) ? verifiedReceiptSnapshots.get(rawReceipt.receiptId) : null;
        const isCryptographicallyVerified = receiptCryptoVerified && isContentVerified;
        const receipt = (isCryptographicallyVerified && verifiedSnapshot) ? verifiedSnapshot : (rawReceipt || {
          receiptId: "pending_recovery",
          raidId: sim.raidId || "raid_sector7_1042",
          outcomeDigest: "Settlement record pending cryptographic verification",
          transfers: [],
          participantResults: [{ profileId: sim.player.id || "op_player", activeRaidCleared: true, inventoryRevision: 1 }],
        });

        const securedItems = ((sim.player as any).lootItems || []) as any[];

        return (
          <div
            ref={modalRef}
            tabIndex={-1}
            className="exfil-kia-fullscreen"
            role="dialog"
            aria-modal="true"
            aria-labelledby="receipt-dialog-title"
          >
            <div className="exfil-extracted-arcade-card">
              {/* Giant Graphic Impact Watermark */}
              <div className="extracted-watermark-text" aria-hidden="true">SURVIVED</div>

              {/* Angled Comic Ribbon */}
              <div className="extracted-manga-ribbon">
                <span>CONTRACT COMPLETE // LZ-CHARLIE SECURED</span>
              </div>

              {/* Massive Distressed Arcade Title */}
              <div className="kia-manga-title-wrap">
                <h1 id="receipt-dialog-title" className="extracted-manga-title">
                  EXTRACTION SUCCESS
                </h1>
                <div className="kia-manga-subtag">
                  AUTHORITATIVE CONTRACT SETTLEMENT // LEDGER CUSTODY COMMITTED
                </div>
              </div>

              {/* Cryptographic Laser Stamp Badge */}
              <div className="extracted-crypto-stamp">
                {isCryptographicallyVerified ? <ShieldCheck style={{ width: 18, height: 18 }} /> : <ShieldAlert style={{ width: 18, height: 18 }} />}
                <span>{isCryptographicallyVerified ? "✓ CRYPTOGRAPHIC RECEIPT VERIFIED" : "SETTLEMENT AUDIT PENDING"}</span>
              </div>

              {/* Arcade Score Tally Grid */}
              <div className="kia-arcade-score-grid">
                <div className="kia-score-tile">
                  <span className="kia-tile-label">TOTAL BANKED PAYOUT</span>
                  <span className="kia-tile-val text-emerald">+${sim.player.cash.toLocaleString()}</span>
                </div>
                <div className="kia-score-tile">
                  <span className="kia-tile-label">CARGO SECURED</span>
                  <span className="kia-tile-val text-cyan">{securedItems.length} ITEMS</span>
                </div>
                <div className="kia-score-tile">
                  <span className="kia-tile-label">HOSTILES ELIMINATED</span>
                  <span className="kia-tile-val text-amber">
                    {sim.combatLog.filter((l) => l.includes("Eliminated") || l.includes("downed") || l.includes("Terminated")).length} KILLS
                  </span>
                </div>
              </div>

              {/* Itemized Secured Cargo Grid */}
              {securedItems.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "#94a3b8", letterSpacing: "1px", marginBottom: 6 }}>
                    SECURED CARGO MANIFEST
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 6 }}>
                    {securedItems.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          padding: "6px 8px",
                          background: "rgba(15, 23, 42, 0.75)",
                          border: "1.5px solid #1e293b",
                          borderLeft: `3px solid ${item.rarity === "epic" ? "#BC98FF" : item.rarity === "rare" ? "#51E5F0" : "#72F1A8"}`,
                          borderRadius: 3,
                          fontSize: 10,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, color: "#ffffff" }}>
                          <span>{item.icon || "💎"} {item.name || "Component"}</span>
                        </div>
                        <span style={{ fontSize: 10, color: "#72F1A8", fontWeight: 800, fontFamily: "monospace" }}>
                          +${(item.value || 500).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ledger Proof Details */}
              <div style={{ padding: "8px 12px", background: "rgba(11, 15, 25, 0.8)", border: "1px solid #1e293b", borderRadius: 4, marginBottom: 20, fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>
                <div>RECEIPT: <strong style={{ color: "#e2e8f0" }}>{receipt.receiptId}</strong></div>
                <div style={{ marginTop: 2, wordBreak: "break-all" }}>DIGEST: <span style={{ color: "#51E5F0" }}>{receipt.outcomeDigest}</span></div>
              </div>

              {/* High-Impact Tactical Arcade Action Buttons */}
              <div className="kia-arcade-actions">
                <button
                  onClick={handleRedeploy}
                  disabled={isRestarting}
                  autoFocus
                  className="deploy-next-raid-btn extracted-manga-btn-primary"
                >
                  {isRestarting ? "REDEPLOYING TO FOB..." : "⚡ DEPLOY NEXT RAID [SPACE]"}
                </button>
                {onReturnToHideout && (
                  <button
                    onClick={onReturnToHideout}
                    className="return-to-hideout-btn kia-manga-btn-secondary"
                  >
                    🛡️ VIEW STASH & HIDEOUT [ESC]
                  </button>
                )}
              </div>
              {restartError && (
                <div className="kia-error-notice">
                  {restartError}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* 5. Recoverable Failure State */}
      {activeModalKind === "failed" && (() => {
        const failReason = state.kind === "failed" ? state.reason : "Settlement pipeline error";
        const canRetry = state.kind === "failed" ? state.canRetry : true;
        return (
          <div
            ref={modalRef}
            tabIndex={-1}
            className="exfil-error-card clip-cut-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="error-dialog-title"
            style={{ padding: 24, background: "rgba(18, 24, 36, 0.96)", border: "2px solid #FF365E", borderRadius: 4, maxWidth: 460, width: "100%", display: "flex", flexDirection: "column", gap: 14, alignItems: "center", textAlign: "center" }}
          >
            <div id="error-dialog-title" style={{ color: "#FF365E", fontWeight: 900, fontSize: 16, letterSpacing: "1px", textTransform: "uppercase" }}>
              Settlement Pipeline Error
            </div>
            <div style={{ color: "#fca5a5", fontSize: 12, lineHeight: 1.5 }}>
              {failReason}
            </div>
            <div style={{ display: "flex", gap: 10, width: "100%", marginTop: 8 }}>
              {canRetry && (
                <button
                  onClick={handleRetry}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleRetry(); } }}
                  className="exfil-retry-btn kia-btn-redeploy clip-cut-btn"
                  style={{ flex: 1 }}
                >
                  Retry Settlement
                </button>
              )}
              <button
                onClick={handleReturnToRaid}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleReturnToRaid(); } }}
                className="exfil-cancel-btn kia-btn-ghost clip-cut-btn"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
