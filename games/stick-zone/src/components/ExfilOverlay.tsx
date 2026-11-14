import React, { useEffect, useState, useRef } from "react";
import type { SectorDepotSimulation } from "../sim/game.js";
import type { RaidExfilState } from "../sim/airlock.js";
import type { RaidCompletion } from "../sim/raidCompletion.js";
import { Loader2, ShieldCheck, ShieldAlert, Lock } from "lucide-react";

interface ExfilOverlayProps {
  sim: SectorDepotSimulation;
  onRestart: () => Promise<boolean | void> | boolean | void;
  onReturnToHideout?: () => void;
}

/** Copy for the extracted screen. One entry per completion kind. */
function completionCopy(completion: RaidCompletion): {
  title: string;
  ribbon: string;
  subtag: string;
  stamp: string;
  settled: boolean;
} {
  switch (completion.kind) {
    case "practice":
      return {
        title: "PRACTICE RUN COMPLETE",
        ribbon: "OFFLINE PRACTICE // LZ-CHARLIE REACHED",
        subtag: "No cash, items, or XP banked. Deploy through SyncHub to bank rewards.",
        stamp: "PRACTICE // NOTHING BANKED",
        settled: false,
      };
    case "settled":
      return {
        title: "EXTRACTION SUCCESS",
        ribbon: "CONTRACT COMPLETE // LZ-CHARLIE SECURED",
        subtag: "Rewards bank from the SyncHub debrief. Stash refreshes from the hub.",
        stamp: "SYNCHUB DEBRIEF SETTLED",
        settled: true,
      };
    case "voided":
      return {
        title: "RAID VOIDED",
        ribbon: "SYNCHUB VOID // LOADOUT REFUND",
        subtag: `Reason: ${completion.reason}. The debrief refunds the loadout. No loot banked.`,
        stamp: "SYNCHUB DEBRIEF VOID",
        settled: false,
      };
    default: {
      const unreachable: never = completion;
      throw new Error(`Unknown raid completion: ${JSON.stringify(unreachable)}`);
    }
  }
}

export const ExfilOverlay: React.FC<ExfilOverlayProps> = ({ sim, onRestart, onReturnToHideout }) => {
  const [state, setState] = useState<RaidExfilState>(() => sim.exfilController.getState());
  const [corridorElapsed, setCorridorElapsed] = useState(0);
  const [isRestarting, setIsRestarting] = useState(false);
  const [restartError, setRestartError] = useState<string | null>(null);

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
      }
    } catch (err: unknown) {
      setRestartError(err instanceof Error ? err.message : "Redeployment request failed. Please retry.");
    } finally {
      setIsRestarting(false);
    }
  };

  // Poll the controller. The completion flow owns the async work and
  // writes only to the controller, so a late result never reaches an
  // overlay that shows a different simulation.
  useEffect(() => {
    let active = true;
    const timer = setInterval(() => {
      if (!active) return;
      const current = sim.exfilController.getState();
      if (current.kind === "corridor_presentation") {
        if (!sim.player.isAlive || sim.player.health <= 0) {
          sim.exfilController.cancel();
        } else {
          setCorridorElapsed(Date.now() - current.startedAtMs);
          if (sim.exfilController.isCorridorComplete()) {
            void sim.raidCompletion.begin();
          }
        }
      }
      setState(sim.exfilController.getState());
    }, 40);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [sim]);

  const handleRetry = () => {
    void sim.raidCompletion.retry();
    setState(sim.exfilController.getState());
  };

  const handleReturnToRaid = () => {
    const current = sim.exfilController.getState();
    if (current.kind !== "failed" || !current.canReturnToRaid) return;
    sim.exfilController.cancel();
    setState(sim.exfilController.getState());
  };

  const isDead = !sim.player.isAlive && !sim.player.isExtracted;
  const activeModalKind: "none" | "kia" | "corridor" | "submitting" | "extracted" | "failed" = (() => {
    if (state.kind === "corridor_presentation") return "corridor";
    if (state.kind === "submitting_settlement") return "submitting";
    if (state.kind === "extracted") return "extracted";
    if (state.kind === "failed") return "failed";
    if (isDead) return "kia";
    return "none";
  })();
  const isModalActive = activeModalKind !== "none";

  const modalRef = useRef<HTMLDivElement>(null);

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
      if (activeModalKind === "failed" && e.code === "Escape") {
        e.preventDefault();
        void handleRedeploy();
        return;
      }
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
              Input locked. Hydraulic brackets engaged on LZ-Charlie corridor. {sim.coopSpokeAttached ? "SyncHub debrief follows the seal." : "Offline practice run. Nothing banks."}
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

      {/* 3. Completion in progress: practice closes at once, co-op waits for the debrief */}
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
            {sim.coopSpokeAttached ? "WAITING FOR SYNCHUB DEBRIEF" : "CLOSING PRACTICE RUN"}
          </h2>
          <p style={{ fontSize: 12, color: "#94a3b8", fontFamily: "monospace" }}>
            {sim.coopSpokeAttached
              ? "Extraction requested. The server debrief settles rewards for the squad."
              : "Offline practice. No cash, items, or XP bank."}
          </p>
        </div>
      )}

      {/* 4. Extracted debrief: practice, settled, or voided */}
      {state.kind === "extracted" && activeModalKind === "extracted" && (() => {
        const completion = state.completion;
        const copy = completionCopy(completion);
        const securedItems = ((sim.player as any).lootItems || []) as any[];
        const kills = sim.combatLog.filter((l) => l.includes("Eliminated") || l.includes("downed") || l.includes("Terminated")).length;

        return (
          <div
            ref={modalRef}
            tabIndex={-1}
            className="exfil-kia-fullscreen"
            role="dialog"
            aria-modal="true"
            aria-labelledby="receipt-dialog-title"
            data-completion={completion.kind}
          >
            <div className="exfil-extracted-arcade-card">
              <div className="extracted-watermark-text" aria-hidden="true">
                {completion.kind === "practice" ? "PRACTICE" : completion.kind === "voided" ? "VOID" : "SURVIVED"}
              </div>

              <div className="extracted-manga-ribbon">
                <span>{copy.ribbon}</span>
              </div>

              <div className="kia-manga-title-wrap">
                <h1 id="receipt-dialog-title" className="extracted-manga-title">
                  {copy.title}
                </h1>
                <div className="kia-manga-subtag">{copy.subtag}</div>
              </div>

              <div className="extracted-crypto-stamp">
                {copy.settled ? <ShieldCheck style={{ width: 18, height: 18 }} /> : <ShieldAlert style={{ width: 18, height: 18 }} />}
                <span>{copy.stamp}</span>
              </div>

              <div className="kia-arcade-score-grid">
                <div className="kia-score-tile">
                  <span className="kia-tile-label">
                    {completion.kind === "settled" ? "DEBRIEF TRANSFERS" : "RUN CASH (NOT BANKED)"}
                  </span>
                  <span className="kia-tile-val text-emerald">
                    {completion.kind === "settled" ? completion.transferCount : `₡${sim.player.cash.toLocaleString()}`}
                  </span>
                </div>
                <div className="kia-score-tile">
                  <span className="kia-tile-label">{completion.kind === "settled" ? "CARGO CARRIED OUT" : "CARGO (NOT BANKED)"}</span>
                  <span className="kia-tile-val text-cyan">{securedItems.length} ITEMS</span>
                </div>
                <div className="kia-score-tile">
                  <span className="kia-tile-label">HOSTILES ELIMINATED</span>
                  <span className="kia-tile-val text-amber">{kills} KILLS</span>
                </div>
              </div>

              {completion.kind !== "practice" && (
                <div style={{ padding: "8px 12px", background: "rgba(11, 15, 25, 0.8)", border: "1px solid #1e293b", borderRadius: 4, marginBottom: 20, fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>
                  <div>DEBRIEF: <strong style={{ color: "#e2e8f0" }}>{completion.receiptId}</strong></div>
                  <div style={{ marginTop: 2 }}>RAID: <span style={{ color: "#51E5F0" }}>{completion.raidId}</span></div>
                </div>
              )}

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
        const failReason = state.kind === "failed" ? state.reason : "SyncHub debrief failed";
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
              SyncHub Debrief Failed
            </div>
            <div style={{ color: "#fca5a5", fontSize: 12, lineHeight: 1.5 }}>
              {failReason}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, width: "100%", marginTop: 8 }}>
              {canRetry && (
                <button
                  onClick={handleRetry}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleRetry(); } }}
                  className="exfil-retry-btn kia-btn-redeploy clip-cut-btn"
                  style={{ flex: 1 }}
                >
                  Retry Debrief
                </button>
              )}

              {state.kind === "failed" && state.canReturnToRaid && (
                <button onClick={handleReturnToRaid} className="exfil-cancel-btn kia-btn-ghost clip-cut-btn" style={{ flex: 1 }}>
                  Return to Raid
                </button>
              )}
              <button
                onClick={handleRedeploy}
                disabled={isRestarting}
                className="exfil-exit-btn kia-btn-ghost clip-cut-btn"
                style={{ flex: 1 }}
              >
                {isRestarting ? "Returning..." : "Return to Hideout"}
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
