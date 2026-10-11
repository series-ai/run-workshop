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
              useStashStore.getState().recordVerifiedSettlement({
                receipt: canonicalReceipt,
                outcomePayload,
                cratesLooted: sim.crates.filter((c) => c.opened && c.claimedBy === sim.player.id).length,
                kills: sim.combatLog.filter((l) => l.includes("Eliminated") || l.includes("Terminated") || l.includes("downed")).length,
                bossKill: sim.combatLog.some((l) => l.includes("WARLORD") || l.includes("Boss")),
                hasKeycard: Boolean(sim.player.hasKeycard),
                hadBleed: Boolean(sim.player.isBleeding),
                itemsSecured: ((sim.player as any).lootItems || []).map((item: any) => ({
                  id: item.id || "loot_" + Date.now(),
                  name: item.name || "Salvaged Component",
                  type: item.type || "valuable",
                  rarity: item.rarity || "rare",
                  icon: item.icon || "💎",
                  value: item.value || 500,
                  count: 1,
                })),
              });
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
        useStashStore.getState().recordVerifiedSettlement({
          receipt: canonicalReceipt,
          outcomePayload,
          cratesLooted: sim.crates.filter((c) => c.opened && c.claimedBy === sim.player.id).length,
          kills: sim.combatLog.filter((l) => l.includes("Eliminated") || l.includes("Terminated") || l.includes("downed")).length,
          bossKill: sim.combatLog.some((l) => l.includes("WARLORD") || l.includes("Boss")),
          hasKeycard: Boolean(sim.player.hasKeycard),
          hadBleed: Boolean(sim.player.isBleeding),
          itemsSecured: ((sim.player as any).lootItems || []).map((item: any) => ({
            id: item.id || "loot_" + Date.now(),
            name: item.name || "Salvaged Component",
            type: item.type || "valuable",
            rarity: item.rarity || "rare",
            icon: item.icon || "💎",
            value: item.value || 500,
            count: 1,
          })),
        });
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
    if (activeModalKind === "kia" && outcomeRecordedRef.current !== sim.raidId) {
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
      {/* 1. OPERATIVE ELIMINATED (K.I.A.) - 40/60 Full-Screen Manga Split Layout */}
      {activeModalKind === "kia" && (
        <div
          ref={modalRef}
          tabIndex={-1}
          className="exfil-kia-fullscreen"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kia-dialog-title"
        >
          <div className="kia-split-container">
            {/* Left Pane: Frozen Combat Frame with Crimson Ink Slash */}
            <div className="kia-left-panel clip-cut-panel">
              <div className="kia-slash-overlay" />
              <div style={{ position: "relative", zIndex: 2, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <div style={{ width: 68, height: 68, borderRadius: "50%", background: "rgba(255, 54, 94, 0.18)", border: "2px solid #FF365E", display: "flex", alignItems: "center", justifyContent: "center", color: "#FF365E", boxShadow: "0 0 24px rgba(255, 54, 94, 0.5)" }}>
                  <AlertTriangle style={{ width: 34, height: 34 }} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: "2px", color: "#FF365E", fontFamily: "monospace", textTransform: "uppercase" }}>
                  OPERATIVE NEUTRALIZED
                </div>
                <div style={{ fontSize: 11, color: "#94A3B8", fontFamily: "monospace" }}>
                  BIOMETRIC SIGNAL: TERMINATED<br />
                  LOCATION: SECTOR 7 DEPOT (LZ-CHARLIE)
                </div>
                <div style={{ marginTop: 16, padding: "6px 14px", background: "rgba(15, 23, 42, 0.8)", border: "1px solid #334155", borderRadius: 4, fontSize: 10, color: "#cbd5e1", fontFamily: "monospace" }}>
                  LOCAL RE-CLONE READY • SAFE FOB RE-ENTRY
                </div>
              </div>
            </div>

            {/* Right Pane: Brutalist Typography, EKG Flatline, Telemetry & CTAs */}
            <div className="kia-right-panel clip-cut-panel">
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 800, color: "#94A3B8", letterSpacing: "1px" }}>
                    CONTRACT #{sim.raidId.slice(-8).toUpperCase()} // SECTOR 7
                  </span>
                  <span style={{ fontSize: 10, fontFamily: "monospace", fontWeight: 800, color: "#FF365E", background: "rgba(255, 54, 94, 0.15)", padding: "2px 8px", borderRadius: 3, border: "1px solid rgba(255, 54, 94, 0.4)" }}>
                    K.I.A. VERIFIED
                  </span>
                </div>

                <h1 id="kia-dialog-title" className="kia-title-signal">
                  SIGNAL LOST <span style={{ color: "#FF365E" }}>// FLATLINE</span>
                </h1>

                {/* Animated SVG EKG Flatline Waveform */}
                <svg viewBox="0 0 400 30" width="100%" height="28" style={{ margin: "8px 0" }}>
                  <path
                    d="M 0 15 L 120 15 L 135 4 L 150 26 L 165 2 L 180 22 L 195 15 L 400 15"
                    fill="none"
                    stroke="#FF365E"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    style={{
                      strokeDasharray: 400,
                      strokeDashoffset: 0,
                    }}
                  />
                </svg>

                <p style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.5, margin: "6px 0 12px" }}>
                  Eliminated by: <strong style={{ color: "#ffffff" }}>{killerName}</strong><br />
                  Fatal trauma: <span style={{ color: "#fca5a5" }}>Thorax / Point-Blank Kinetic Impact</span>
                </p>

                {/* Telemetry Breakdown Grid */}
                <div className="kia-telemetry-grid">
                  <div>
                    <span style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase", fontWeight: 800, display: "block" }}>Damage Taken</span>
                    <strong style={{ fontSize: 15, color: "#FF365E", fontFamily: "monospace" }}>100+ HP</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase", fontWeight: 800, display: "block" }}>Raid Time</span>
                    <strong style={{ fontSize: 15, color: "#51E5F0", fontFamily: "monospace" }}>{survivalFormatted}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase", fontWeight: 800, display: "block" }}>Contract Status</span>
                    <strong style={{ fontSize: 13, color: "#f59e0b", fontFamily: "monospace" }}>FORFEITED</strong>
                  </div>
                </div>

                {/* Economic Loss Breakdown */}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "rgba(255, 54, 94, 0.08)", border: "1px solid rgba(255, 54, 94, 0.25)", borderRadius: 4, marginBottom: 18, fontSize: 12 }}>
                  <div>
                    <span style={{ color: "#94a3b8", display: "block", fontSize: 10 }}>Scavenged Cash Lost:</span>
                    <strong style={{ color: "#FF365E", fontSize: 14, fontFamily: "monospace" }}>${sim.player.cash.toLocaleString()}</strong>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ color: "#94a3b8", display: "block", fontSize: 10 }}>Cargo Lost in Field:</span>
                    <strong style={{ color: "#FF365E", fontSize: 14, fontFamily: "monospace" }}>{lostCargoCount} Items (${lostCargoEstVal.toLocaleString()})</strong>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button
                  onClick={handleRedeploy}
                  disabled={isRestarting}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleRedeploy(); } }}
                  className="redeploy-operative-btn kia-btn-redeploy clip-cut-btn"
                >
                  {isRestarting ? "Re-Cloning Operative..." : "RE-CLONE & REDEPLOY →"}
                </button>
                {onReturnToHideout && (
                  <button
                    onClick={onReturnToHideout}
                    className="kia-btn-ghost clip-cut-btn"
                  >
                    RETURN TO HIDEOUT & STASH
                  </button>
                )}
                {restartError && (
                  <div style={{ color: "#FF365E", fontSize: 12, textAlign: "center", marginTop: 4 }}>
                    {restartError}
                  </div>
                )}
              </div>
            </div>
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

      {/* 4. Extracted Receipt Debrief - Sleek Contractor Terminal */}
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
            className="exfil-receipt-modal clip-cut-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="receipt-dialog-title"
            style={{
              background: "rgba(18, 24, 36, 0.96)",
              border: "2px solid #334155",
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.7)",
              color: "#f8fafc",
            }}
          >
            {/* Contractor Header */}
            <div className="receipt-header" style={{ borderBottom: "1px solid #334155" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: isCryptographicallyVerified ? "rgba(114, 241, 168, 0.15)" : "rgba(255, 194, 71, 0.15)", border: `1px solid ${isCryptographicallyVerified ? "#72F1A8" : "#FFC247"}`, display: "flex", alignItems: "center", justifyContent: "center", color: isCryptographicallyVerified ? "#72F1A8" : "#FFC247" }}>
                  <CheckCircle style={{ width: 26, height: 26 }} />
                </div>
                <div>
                  <h1 id="receipt-dialog-title" style={{ fontSize: 20, fontWeight: 900, letterSpacing: "1px", color: "#FFFFFF", textTransform: "uppercase" }}>
                    EXTRACTION COMPLETE // SAFE RETURN
                  </h1>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>
                    Sector 7 Safehouse • Contractor Settlement Terminal
                  </span>
                </div>
              </div>

              {/* Cryptographic Laser Stamp Badge */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                background: isCryptographicallyVerified ? "rgba(114, 241, 168, 0.12)" : "rgba(255, 194, 71, 0.12)",
                border: `1px solid ${isCryptographicallyVerified ? "#72F1A8" : "#FFC247"}`,
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 900,
                color: isCryptographicallyVerified ? "#72F1A8" : "#FFC247",
                animation: "seal-stamp 220ms ease-out both",
              }}>
                {isCryptographicallyVerified ? <ShieldCheck style={{ width: 18, height: 18 }} /> : <ShieldAlert style={{ width: 18, height: 18 }} />}
                <span>{isCryptographicallyVerified ? "✓ CRYPTOGRAPHIC RECEIPT VERIFIED" : "SETTLEMENT AUDIT PENDING"}</span>
              </div>
            </div>

            {/* Payout Summary Strip */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", background: "rgba(11, 15, 25, 0.8)", border: "1px solid #334155", borderRadius: 4 }}>
              <div>
                <span style={{ fontSize: 10, textTransform: "uppercase", color: "#94a3b8", fontWeight: 800 }}>Total Banked Payout</span>
                <div style={{ fontSize: 24, fontWeight: 900, color: "#72F1A8", fontFamily: "monospace" }}>
                  ${sim.player.cash.toLocaleString()}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 10, textTransform: "uppercase", color: "#94a3b8", fontWeight: 800 }}>Cargo Secured</span>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#51E5F0", fontFamily: "monospace" }}>
                  {securedItems.length} SALVAGED COMPONENTS
                </div>
              </div>
            </div>

            {/* Itemized Secured Cargo Grid */}
            {securedItems.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#94a3b8", letterSpacing: "1px", marginBottom: 8 }}>
                  SECURED CARGO MANIFEST
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
                  {securedItems.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        padding: "8px 10px",
                        background: "rgba(15, 23, 42, 0.7)",
                        border: "1px solid #334155",
                        borderLeft: `3px solid ${item.rarity === "epic" ? "#BC98FF" : item.rarity === "rare" ? "#51E5F0" : "#72F1A8"}`,
                        borderRadius: 3,
                        fontSize: 11,
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

            {/* Ledger Reference Cards */}
            <div className="receipt-grid">
              <div className="receipt-card" style={{ background: "rgba(11, 15, 25, 0.7)", borderColor: "#334155" }}>
                <span style={{ color: "#94a3b8", textTransform: "uppercase", fontSize: 9, fontWeight: 800 }}>Receipt Identifier</span>
                <span style={{ fontWeight: 800, color: "#e2e8f0", fontSize: 12, wordBreak: "break-all" }}>{receipt.receiptId}</span>
              </div>
              <div className="receipt-card" style={{ background: "rgba(11, 15, 25, 0.7)", borderColor: "#334155" }}>
                <span style={{ color: "#94a3b8", textTransform: "uppercase", fontSize: 9, fontWeight: 800 }}>Raid Contract Reference</span>
                <span style={{ fontWeight: 800, color: "#e2e8f0", fontSize: 12, wordBreak: "break-all" }}>{receipt.raidId}</span>
              </div>
            </div>

            <div className="receipt-card" style={{ background: "rgba(11, 15, 25, 0.7)", borderColor: "#334155" }}>
              <span style={{ color: "#94a3b8", textTransform: "uppercase", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", gap: 4 }}>
                <Database style={{ width: 14, height: 14 }} /> Authoritative Outcome Digest (SHA-256)
              </span>
              <span style={{ color: "#51E5F0", fontSize: 11, wordBreak: "break-all", fontFamily: "monospace" }}>{receipt.outcomeDigest}</span>
            </div>

            {/* Committed Asset Transfers */}
            <div className="receipt-transfers">
              <span style={{ fontSize: 10, textTransform: "uppercase", color: "#94a3b8", fontWeight: 800, letterSpacing: "0.5px" }}>
                Committed Asset Transfers (Canonical BigInt Grammar)
              </span>
              {(receipt.transfers || []).map((t: any, idx: number) => (
                <div key={idx} className="receipt-transfer-row" style={{ background: "rgba(11, 15, 25, 0.7)", borderColor: "#334155" }}>
                  <span style={{ color: "#e2e8f0", fontWeight: 700 }}>{t.itemId}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ padding: "2px 8px", background: "#1e293b", borderRadius: 4, color: "#94a3b8", fontWeight: 700 }}>
                      {t.quantity}
                    </span>
                    <ArrowRight style={{ width: 14, height: 14, color: "#cbd5e1" }} />
                    <span style={{ color: "#72F1A8", fontWeight: 800 }}>{t.toProfileId}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
              <button
                onClick={handleRedeploy}
                disabled={isRestarting}
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleRedeploy(); } }}
                className="deploy-next-raid-btn kia-btn-redeploy clip-cut-btn"
                style={{ flex: 1.2 }}
              >
                {isRestarting ? "Redeploying..." : "DEPLOY NEXT RAID →"}
              </button>
              {onReturnToHideout && (
                <button
                  onClick={onReturnToHideout}
                  className="return-to-hideout-btn kia-btn-ghost clip-cut-btn"
                  style={{ flex: 1 }}
                >
                  VIEW STASH & HIDEOUT
                </button>
              )}
            </div>
            {restartError && (
              <div style={{ padding: "8px 12px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", borderRadius: 4, color: "#f87171", fontSize: 12 }}>
                {restartError}
              </div>
            )}
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
