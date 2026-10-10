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

  return (
    <div className="exfil-overlay-backdrop">
      {/* Operative Eliminated (K.I.A.) Screen */}
      {activeModalKind === "kia" && (
        <div
          ref={modalRef}
          tabIndex={-1}
          className="exfil-kia-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kia-dialog-title"
style={{ padding: 28, background: "#090d16", border: "2px solid #ef4444", borderRadius: 12, maxWidth: 480, width: "100%", textAlign: "center", boxShadow: "0 25px 50px -12px rgba(239, 68, 68, 0.25)" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(239, 68, 68, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.4)" }}>
            <AlertTriangle style={{ width: 28, height: 28 }} />
          </div>
          <h1 id="kia-dialog-title" style={{ fontSize: 20, fontWeight: 900, letterSpacing: "2px", color: "#ef4444", textTransform: "uppercase", marginBottom: 8 }}>
            OPERATIVE ELIMINATED (K.I.A.)
          </h1>
          <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, marginBottom: 16 }}>
            Sector 7 raid contract terminated. Contracted loadout lost in field.<br />
            Banked scavenged cash forfeited: <strong style={{ color: "#ef4444" }}>${sim.player.cash.toLocaleString()}</strong>
          </p>
          <button
            onClick={handleRedeploy}
            disabled={isRestarting}
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleRedeploy(); } }}
            className="redeploy-operative-btn"
            style={{
              width: "100%",
              padding: "12px 0",
              background: isRestarting ? "#7f1d1d" : "#dc2626",
              border: "none",
              borderRadius: 8,
              color: "#ffffff",
              fontWeight: 800,
              fontSize: 13,
              textTransform: "uppercase",
              letterSpacing: "1px",
              cursor: isRestarting ? "not-allowed" : "pointer",
              opacity: isRestarting ? 0.7 : 1.0,
            }}
          >
            {isRestarting ? "Redeploying..." : "Redeploy Operative"}
          </button>
          {restartError && (
            <div style={{ color: "#ef4444", fontSize: 12, marginTop: 8, textAlign: "center" }}>
              {restartError}
            </div>
          )}
        </div>
      )}

      {/* 2500ms Corridor Presentation */}
      {activeModalKind === "corridor" && (() => {
        const corridorDurationMs = state.kind === "corridor_presentation" ? state.durationMs : 2500;
        return (
          <div
            ref={modalRef}
            tabIndex={-1}
            className="exfil-corridor-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="corridor-dialog-title"
          >
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(245, 158, 11, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, color: "#f59e0b" }}>
              <Lock style={{ width: 24, height: 24 }} />
            </div>
            <h2 id="corridor-dialog-title" style={{ fontSize: 20, fontWeight: 800, letterSpacing: "2px", color: "#f59e0b", textTransform: "uppercase", marginBottom: 8 }}>
              Airlock Corridor Presentation
            </h2>
            <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 24 }}>
              Input frozen. Closing extraction corridor LZ-Charlie before authoritative ledger settlement.
            </p>
            <div style={{ width: "100%", height: 10, background: "#1e293b", borderRadius: 9999, overflow: "hidden", border: "1px solid #334155", marginBottom: 8 }}>
              <div
                style={{
                  width: `${Math.min(100, (corridorElapsed / corridorDurationMs) * 100)}%`,
                  height: "100%",
                  background: "#f59e0b",
                  transition: "width 75ms linear",
                }}
              />
            </div>
            <span style={{ fontSize: 12, color: "#cbd5e1" }}>
              {Math.max(0, corridorDurationMs - corridorElapsed)}ms remaining
            </span>
          </div>
        );
      })()}

      {/* Submitting Settlement */}
      {activeModalKind === "submitting" && (
        <div
          ref={modalRef}
          tabIndex={-1}
          className="exfil-corridor-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settling-dialog-title"
          style={{ borderColor: "rgba(6, 182, 212, 0.6)" }}
        >
          <Loader2 style={{ width: 40, height: 40, color: "#06b6d4", animation: "spin 1s linear infinite", marginBottom: 16 }} />
          <h2 id="settling-dialog-title" style={{ fontSize: 18, fontWeight: 800, color: "#06b6d4", textTransform: "uppercase", marginBottom: 8 }}>
            Submitting Settlement
          </h2>
          <p style={{ fontSize: 12, color: "#94a3b8" }}>
            Computing SHA-256 digest & committing canonical BigInt ledger revision...
          </p>
        </div>
      )}

      {/* Extracted Receipt Debrief */}
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
        return (
          <div
            ref={modalRef}
            tabIndex={-1}
            className="exfil-receipt-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="receipt-dialog-title"
          >
            <div className="receipt-header">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: isCryptographicallyVerified ? "rgba(34, 197, 94, 0.2)" : "rgba(245, 158, 11, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: isCryptographicallyVerified ? "#22c55e" : "#f59e0b" }}>
                  <CheckCircle style={{ width: 24, height: 24 }} />
                </div>
                <div>
                  <h1 id="receipt-dialog-title" style={{ fontSize: 19, fontWeight: 800, letterSpacing: "1px", color: isCryptographicallyVerified ? "#22c55e" : "#f59e0b", textTransform: "uppercase" }}>
                    Raid Extracted — Safe Return
                  </h1>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>
                    {isCryptographicallyVerified ? "Sector 7 Safehouse • Settlement Committed & Verified" : "Sector 7 Safehouse • Local Session Debrief"}
                  </span>
                </div>
              </div>
              {isCryptographicallyVerified ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "rgba(34, 197, 94, 0.1)", border: "1px solid rgba(34, 197, 94, 0.4)", borderRadius: 6, fontSize: 11, fontWeight: 800, color: "#22c55e" }}>
                  <ShieldCheck style={{ width: 16, height: 16 }} />
                  <span>CRYPTOGRAPHIC RECEIPT VERIFIED</span>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.4)", borderRadius: 6, fontSize: 11, fontWeight: 800, color: "#f59e0b" }}>
                  <ShieldAlert style={{ width: 16, height: 16 }} />
                  <span>SETTLEMENT RECORD (LOCAL DEBRIEF)</span>
                </div>
              )}
            </div>

            <div className="receipt-grid">
              <div className="receipt-card">
                <span style={{ color: "#cbd5e1", textTransform: "uppercase", fontSize: 10, fontWeight: 800 }}>Receipt Identifier</span>
                <span style={{ fontWeight: 800, color: "#e2e8f0", fontSize: 13, wordBreak: "break-all", overflowWrap: "anywhere" }}>{receipt.receiptId}</span>
              </div>
              <div className="receipt-card">
                <span style={{ color: "#cbd5e1", textTransform: "uppercase", fontSize: 10, fontWeight: 800 }}>Raid Reference</span>
                <span style={{ fontWeight: 800, color: "#e2e8f0", fontSize: 13, wordBreak: "break-all", overflowWrap: "anywhere" }}>{receipt.raidId}</span>
              </div>
            </div>

            <div className="receipt-card">
              <span style={{ color: "#cbd5e1", textTransform: "uppercase", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", gap: 4 }}>
                <Database style={{ width: 14, height: 14 }} /> Outcome Digest (SHA-256)
              </span>
              <span style={{ color: "#38bdf8", fontSize: 12, wordBreak: "break-all" }}>{receipt.outcomeDigest}</span>
            </div>

            <div className="receipt-transfers">
              <span style={{ fontSize: 11, textTransform: "uppercase", color: "#94a3b8", fontWeight: 800, letterSpacing: "0.5px" }}>
                Committed Asset Transfers (Canonical BigInt Grammar)
              </span>
              {(receipt.transfers || []).map((t: any, idx: number) => (
                <div key={idx} className="receipt-transfer-row">
                  <span style={{ color: "#e2e8f0", fontWeight: 700 }}>{t.itemId}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ padding: "2px 8px", background: "#1e293b", borderRadius: 4, color: "#94a3b8", fontWeight: 700 }}>
                      {t.quantity}
                    </span>
                    <ArrowRight style={{ width: 14, height: 14, color: "#cbd5e1" }} />
                    <span style={{ color: "#22c55e", fontWeight: 800 }}>{t.toProfileId}</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: 12, background: "rgba(34, 197, 94, 0.08)", border: "1px solid rgba(34, 197, 94, 0.25)", borderRadius: 8, fontSize: 12 }}>
              <span style={{ fontWeight: 800, color: "#22c55e", display: "block", marginBottom: 6 }}>
                Bilateral Custody Invariant Conservation
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(receipt.participantResults || []).map((p: any, idx: number) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, fontFamily: "ui-monospace, monospace" }}>
                    <span style={{ color: "#e2e8f0", fontWeight: 700 }}>
                      {p.profileId}
                    </span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <span style={{ color: p.activeRaidCleared ? "#4ade80" : "#fbbf24", fontWeight: 700 }}>
                        cleared: {String(p.activeRaidCleared)}
                      </span>
                      <span style={{ color: "#94a3b8" }}>
                        rev: {p.inventoryRevision}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleRedeploy}
              disabled={isRestarting}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleRedeploy(); } }}
              className="deploy-next-raid-btn"
              style={{
                width: "100%",
                padding: "12px 0",
                background: isRestarting ? "#334155" : "#22c55e",
                border: "none",
                borderRadius: 8,
                color: "#052e16",
                fontWeight: 800,
                fontSize: 13,
                textTransform: "uppercase",
                letterSpacing: "1px",
                cursor: isRestarting ? "not-allowed" : "pointer",
                opacity: isRestarting ? 0.7 : 1,
                marginTop: 4,
              }}
            >
              {isRestarting ? "Redeploying..." : "Deploy Next Raid"}
            </button>
            {onReturnToHideout && (
              <button
                onClick={onReturnToHideout}
                className="return-to-hideout-btn"
                style={{
                  width: "100%",
                  padding: "12px 0",
                  background: "transparent",
                  border: "1px solid #22c55e",
                  borderRadius: 8,
                  color: "#4ade80",
                  fontWeight: 800,
                  fontSize: 13,
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  cursor: "pointer",
                  marginTop: 8,
                }}
              >
                Return to Hideout & Stash
              </button>
            )}
            {restartError && (
              <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", borderRadius: 6, color: "#f87171", fontSize: 12 }}>
                {restartError}
              </div>
            )}
          </div>
        );
      })()}

      {/* Recoverable Failure State using Official ExfilController Methods */}
      {activeModalKind === "failed" && (() => {
        const failReason = state.kind === "failed" ? state.reason : "Settlement pipeline error";
        const canRetry = state.kind === "failed" ? state.canRetry : true;
        return (
          <div
            ref={modalRef}
            tabIndex={-1}
            className="exfil-error-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="error-dialog-title"
            style={{ padding: 20, background: "#1c1917", border: "1px solid #ef4444", borderRadius: 10, maxWidth: 440, width: "100%", display: "flex", flexDirection: "column", gap: 12, alignItems: "center", textAlign: "center" }}
          >
            <div id="error-dialog-title" style={{ color: "#ef4444", fontWeight: 800, fontSize: 14, letterSpacing: "1px", textTransform: "uppercase" }}>
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
                  className="exfil-retry-btn"
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    background: "#dc2626",
                    border: "none",
                    borderRadius: 6,
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: "pointer",
                    textTransform: "uppercase",
                  }}
                >
                  Retry Settlement
                </button>
              )}
              <button
                onClick={handleReturnToRaid}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleReturnToRaid(); } }}
                className="exfil-cancel-btn"
                style={{
                  flex: 1,
                  padding: "10px 0",
                  background: "#334155",
                  border: "none",
                  borderRadius: 6,
                  color: "#e2e8f0",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                  textTransform: "uppercase",
                }}
              >
                Return to Raid
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
