import React from "react";
import {
  Shield,
  Heart,
  Crosshair,
  Compass,
} from "lucide-react";
import { type SectorDepotSimulation, DEPOT_CONTAINERS } from "../sim/game.js";
import { SIM_CONFIG } from "../sim/config.js";
import { sound } from "../audio.js";

interface TacticalHudProps {
  sim: SectorDepotSimulation;
  onOpenHideout?: () => void;
}

export const TacticalHud: React.FC<TacticalHudProps> = ({ sim, onOpenHideout }) => {
  const { player, proximityAlert, exfilController, tick } = sim;
  const isSlidingActive =
    player.action === "slide" ||
    !!player.isSliding ||
    ((player.slideTicksRemaining || 0) > 0);

  const isTestMode =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("testMode") === "1";

  // Floating Kinetic Comic Action Callouts system
  const [callouts, setCallouts] = React.useState<
    Array<{
      id: string;
      text: string;
      sub?: string;
      kind: "crit" | "amber" | "green" | "default";
    }>
  >([]);

  const [showIngressBanner, setShowIngressBanner] = React.useState(false);
  const [isFobMinimized, setIsFobMinimized] = React.useState(true);
  const hasShownIngressRef = React.useRef(false);
  const lastCombatLogCountRef = React.useRef(sim.combatLog.length);

  const lastSlideRef = React.useRef(false);
  const lastKickRef = React.useRef(false);
  const lastHitmarkerRef = React.useRef(0);
  const lastCashRef = React.useRef(player.cash);
  const lastBleedRef = React.useRef(player.isBleeding);
  const lastDummyHitRef = React.useRef(0);
  const lastRollRef = React.useRef(false);
  const lastReloadRef = React.useRef(false);

  React.useEffect(() => {
    if (isTestMode) return;
    const isSlidingNow =
      player.action === "slide" ||
      !!player.isSliding ||
      ((player.slideTicksRemaining || 0) > 0);
    const isKickingNow = player.action === "kick";
    const now = Date.now();

    const newEntries: Array<{
      id: string;
      text: string;
      sub?: string;
      kind: "crit" | "amber" | "green" | "default";
    }> = [];

    const isRollingNow = player.action === "roll";
    const isReloadingNow = player.action === "reload";

    // Kinetic Roll Callout
    if (isRollingNow && !lastRollRef.current) {
      newEntries.push({
        id: `roll_${now}`,
        text: "EVADE!",
        sub: "IFRAME COMBAT ROLL",
        kind: "default",
      });
    }
    lastRollRef.current = isRollingNow;

    // Tactical Reload Callout
    if (isReloadingNow && !lastReloadRef.current) {
      newEntries.push({
        id: `reload_${now}`,
        text: "KLIK-KLAK!",
        sub: "TACTICAL RELOAD",
        kind: "default",
      });
    }
    lastReloadRef.current = isReloadingNow;

    // Target Dummy Hit Callout (Rendered directly over target in 3D world space)
    if (sim.lastDummyHitTick && sim.lastDummyHitTick !== lastDummyHitRef.current) {
      lastDummyHitRef.current = sim.lastDummyHitTick;
    }

    // Kinetic Slide Callout
    if (isSlidingNow && !lastSlideRef.current) {
      newEntries.push({
        id: `slide_${now}`,
        text: "SLIDE!",
        sub: "KINETIC EVASION",
        kind: "amber",
      });
    }
    lastSlideRef.current = isSlidingNow;

    // Kinetic Kick Callout
    if (isKickingNow && !lastKickRef.current) {
      newEntries.push({
        id: `kick_${now}`,
        text: "ROUNDHOUSE KICK!",
        sub: "35 DMG // KNOCKBACK",
        kind: "crit",
      });
    }
    lastKickRef.current = isKickingNow;

    // Dynamic Hitmarker Callout (Rendered directly over target in 3D world space)
    if (
      player.lastHitmarkerTick &&
      player.lastHitmarkerTick !== lastHitmarkerRef.current
    ) {
      lastHitmarkerRef.current = player.lastHitmarkerTick;
    }

    // Scavenged Cash Callout
    if (player.cash > lastCashRef.current) {
      const delta = player.cash - lastCashRef.current;
      newEntries.push({
        id: `loot_${now}`,
        text: `+$${delta.toLocaleString()}`,
        sub: "SUPPLY SECURED",
        kind: "amber",
      });
    }
    lastCashRef.current = player.cash;

    // Bleeding Alert Callout
    if (player.isBleeding && !lastBleedRef.current) {
      newEntries.push({
        id: `bleed_${now}`,
        text: "BLEEDING!",
        sub: "PRESS [H] TO STIM",
        kind: "crit",
      });
    }
    lastBleedRef.current = player.isBleeding;

    // Elimination / Kill Confirmed Callout
    if (sim.combatLog.length > lastCombatLogCountRef.current) {
      const newLogs = sim.combatLog.slice(lastCombatLogCountRef.current);
      lastCombatLogCountRef.current = sim.combatLog.length;
      for (const log of newLogs) {
        const lower = log.toLowerCase();
        if (log.includes("[BOSS SLAIN]") || lower.includes("boss slain") || lower.includes("warlord eliminated")) {
          newEntries.push({
            id: `boss_kill_${now}_${Math.random()}`,
            text: "WARLORD PURGED!",
            sub: "HIGH VALUE TARGET DOWN // +1000 XP",
            kind: "crit",
          });
        } else if (lower.includes("eliminated") || lower.includes("terminated") || lower.includes("downed")) {
          newEntries.push({
            id: `kill_${now}_${Math.random()}`,
            text: "TARGET DOWN!",
            sub: "KILL CONFIRMED // +250 XP",
            kind: "crit",
          });
        }
      }
    }

    if (newEntries.length > 0) {
      setCallouts((prev) => [...prev.slice(-2), ...newEntries]);
      const timer = setTimeout(() => {
        setCallouts((prev) =>
          prev.filter((c) => !newEntries.some((n) => n.id === c.id))
        );
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [
    isTestMode,
    player.action,
    player.isSliding,
    player.slideTicksRemaining,
    player.lastHitmarkerTick,
    player.lastHitmarkerCrit,
    player.cash,
    player.isBleeding,
    player.weapon,
    player.action,
    sim.lastDummyHitTick,
  ]);

  // Sector Gateway Ingress Banner (Triggered when entering combat zone)
  React.useEffect(() => {
    if (isTestMode) return;
    if ((sim.zoneMode === "spoke" || player.z > -52) && !hasShownIngressRef.current) {
      hasShownIngressRef.current = true;
      setShowIngressBanner(true);
      const timer = setTimeout(() => setShowIngressBanner(false), 2400);
      return () => clearTimeout(timer);
    } else if (sim.zoneMode === "hub" && player.z < -62) {
      hasShownIngressRef.current = false;
    }
  }, [isTestMode, sim.zoneMode, player.z]);

  // Warlord Priority Boss Threat Proximity Detection
  const isWarlordNear = React.useMemo(() => {
    if (isTestMode || sim.zoneMode === "hub") return false;
    return sim.rivals.some(
      (r) => r.isAlive && (r.id === "scav_boss_warlord" || r.badge === "WARLORD" || /boss|warlord/i.test(r.name)) && Math.hypot(r.x - player.x, r.z - player.z) < 26
    );
  }, [isTestMode, sim.zoneMode, sim.rivals, player.x, player.z]);

  // Anime Action Speed Lines Canvas Overlay (active on slide or sprint)
  const speedLinesCanvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    if (isTestMode) return;
    const canvas = speedLinesCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const renderSpeedLines = () => {
      if (!canvas) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      ctx.clearRect(0, 0, w, h);

      const isSprinting = player.action === "sprint";
      const isSliding =
        player.action === "slide" ||
        !!player.isSliding ||
        ((player.slideTicksRemaining || 0) > 0);

      if (isSliding || isSprinting) {
        const cx = w / 2;
        const cy = h / 2;
        const lineCount = isSliding ? 34 : 18;
        const innerRadius = isSliding
          ? Math.min(w, h) * 0.22
          : Math.min(w, h) * 0.32;
        const maxDist = Math.hypot(w / 2, h / 2);

        for (let i = 0; i < lineCount; i++) {
          const angle =
            (Math.PI * 2 * i) / lineCount + (Math.random() - 0.5) * 0.12;
          const outerDist = maxDist * (0.8 + Math.random() * 0.3);
          const startDist = innerRadius * (1.0 + Math.random() * 0.4);

          const x1 = cx + Math.cos(angle) * outerDist;
          const y1 = cy + Math.sin(angle) * outerDist;
          const x2 = cx + Math.cos(angle) * startDist;
          const y2 = cy + Math.sin(angle) * startDist;

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = Math.random() < 0.25 ? "#eeece5" : "#151716";
          ctx.lineWidth = isSliding
            ? 2.5 + Math.random() * 3.5
            : 1.5 + Math.random() * 2.0;
          ctx.lineCap = "round";
          ctx.globalAlpha = 0.55 + Math.random() * 0.4;
          ctx.stroke();
        }
      }

      animId = requestAnimationFrame(renderSpeedLines);
    };

    animId = requestAnimationFrame(renderSpeedLines);
    return () => cancelAnimationFrame(animId);
  }, [isTestMode, player.action, player.isSliding, player.slideTicksRemaining]);

  // Match time formatted
  const remainingTicks = Math.max(0, SIM_CONFIG.RAID_DEADLINE_TICK - tick);
  const totalSeconds = Math.floor(remainingTicks / SIM_CONFIG.TICKS_PER_SECOND);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const timeFormatted = `${minutes}:${String(seconds).padStart(2, "0")}`;

  const exfilState = exfilController.getState();
  const isHoldingLZ = exfilState.kind === "holding_zone";
  const holdTicks = isHoldingLZ ? exfilState.currentTicks : 0;
  const recentInterruption =
    sim.lastInterruptionTick > 0 && tick - sim.lastInterruptionTick < 120;
  const showResetBanner = !isHoldingLZ
    ? sim.lastInterruptionTick > 0 && tick - sim.lastInterruptionTick < 300
    : recentInterruption;

  const nearbyCrate = sim.crates.find(
    (c) => !c.opened && Math.hypot(player.x - c.x, player.z - c.z) <= 4.0
  );
  const showHitmarker =
    !!player.lastHitmarkerTick && tick - player.lastHitmarkerTick < 15;
  const isHitmarkerCrit = !!player.lastHitmarkerCrit;
  const isCriticalHealth = player.isAlive && player.health < 30;

  const headingDeg = Math.round(
    (((Math.atan2(Math.sin(player.facing), -Math.cos(player.facing)) * 180) /
      Math.PI +
      360) %
      360 +
      360) %
      360
  );
  const CARDINALS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
  const currentCardinal = CARDINALS[Math.round(headingDeg / 45) % 8];

  return (
    <div className="tactical-hud hud-layer">
      {/* Anime Kinetic Speed Lines Canvas Overlay */}
      {!isTestMode && (isSlidingActive || player.action === "sprint" || sim.zoneMode === "airlock_corridor") && (
        <canvas
          ref={speedLinesCanvasRef}
          className="anime-speed-lines-canvas"
        />
      )}

      {/* Floating Kinetic Comic Action Callouts */}
      {!isTestMode && callouts.length > 0 && (
        <div className="comic-callouts-container">
          {callouts.map((c) => (
            <div
              key={c.id}
              className={`comic-callout-card ${
                c.kind === "crit"
                  ? "comic-callout-crit"
                  : c.kind === "amber"
                  ? "comic-callout-amber"
                  : c.kind === "green"
                  ? "comic-callout-green"
                  : ""
              }`}
            >
              <span className="main-text">{c.text}</span>
              {c.sub && <span className="sub-text">{c.sub}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Sector Gateway Ingress Graphic Banner */}
      {!isTestMode && showIngressBanner && (
        <div className="sector-ingress-banner">
          <div className="banner-watermark-text" aria-hidden="true">COMBAT ZONE</div>
          <div className="banner-ribbon"><span>SECTOR 7 DEPOT // AIRLOCK CLEARED</span></div>
          <div className="banner-title">WEAPONS HOT</div>
        </div>
      )}

      {/* Sector Warlord Priority Threat Warning Banner */}
      {!isTestMode && isWarlordNear && (
        <div className="warlord-alert-banner">
          <div className="banner-watermark-text" aria-hidden="true">HOSTILE</div>
          <div className="banner-ribbon warlord-ribbon"><span>// PRIORITY TARGET DETECTED //</span></div>
          <div className="banner-title warlord-title">SECTOR WARLORD ENGAGED</div>
        </div>
      )}

      {/* Critical Health Vignette */}
      {isCriticalHealth && <div className="critical-health-vignette" />}

      {/* Tarkov Micro: Directional Trauma Impact Flash Vignette */}
      {sim.lastPlayerDamageTick > 0 && (sim.tick - sim.lastPlayerDamageTick < 12) && (
        <div className="damage-flash-vignette" />
      )}

      {/* Tarkov Micro: Tactical Radio Intercept Banner */}
      {sim.recentBark && (sim.tick - sim.recentBark.tick < 90) && (
        <div className={`tactical-radio-banner ${sim.recentBark.isBoss ? "boss-bark" : ""}`}>
          <span className="radio-icon">📻</span>
          <span className="radio-label">COMMS INTERCEPT // {sim.recentBark.sender}:</span>
          <span className="radio-quote">"{sim.recentBark.text}"</span>
        </div>
      )}

      {/* Tarkov Micro: Active Frag Grenade Proximity Alarm */}
      {sim.activeGrenades.some((g) => Math.hypot(g.x - player.x, g.z - player.z) <= 8.5) && (
        <div className="grenade-warning-banner">
          <span className="warning-icon">💣</span>
          <span className="warning-text">INCOMING FRAG GRENADE! ROLL [SPACE] TO EVADE!</span>
        </div>
      )}

      

      {sim.zoneMode === "hub" && !isFobMinimized && (
        <div className="fob-briefing-card hud-shell hud-interactive" style={{ position: "absolute", top: "140px", left: "18px", zIndex: 30, maxWidth: "340px" }}>
          <div className="fob-briefing-watermark" aria-hidden="true">TRAINING</div>
          <div className="fob-briefing-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span className="fob-briefing-tag">// FORWARD OPERATING BASE</span>
              <span className="fob-briefing-title">PRE-FLIGHT READINESS</span>
            </div>
            <button
              onClick={() => setIsFobMinimized(true)}
              className="tactical-ink-btn"
              style={{ padding: "2px 8px", fontSize: "9px", background: "transparent", color: "#94a3b8", borderColor: "#475569" }}
              title="Minimize Checklist"
            >
              ▲ HIDE
            </button>
          </div>

          <div className="fob-briefing-checklist">
            <div className={`fob-task-row ${sim.trainingProgress?.dummyHit ? "completed" : "pending"}`}>
              <span className="task-status-icon">{sim.trainingProgress?.dummyHit ? "✓" : "○"}</span>
              <div className="task-text-group">
                <span className="task-label">TEST WEAPONS ON TARGET DUMMIES</span>
                <span className="task-subtext">[LEFT CLICK / J] FIRE • [R] RELOAD • [E] KICK</span>
              </div>
            </div>

            <div className={`fob-task-row ${sim.trainingProgress?.agilityUsed ? "completed" : "pending"}`}>
              <span className="task-status-icon">{sim.trainingProgress?.agilityUsed ? "✓" : "○"}</span>
              <div className="task-text-group">
                <span className="task-label">PRACTICE AGILITY MANEUVERS</span>
                <span className="task-subtext">[C] COMBAT SLIDE • [SPACE] EVASION ROLL</span>
              </div>
            </div>

            <div className={`fob-task-row ${sim.trainingProgress?.crateLooted ? "completed" : "pending"}`}>
              <span className="task-status-icon">{sim.trainingProgress?.crateLooted ? "✓" : "○"}</span>
              <div className="task-text-group">
                <span className="task-label">SEARCH TRAINING SUPPLY LOCKER</span>
                <span className="task-subtext">APPROACH EAST CRATE • PRESS [E / F] TO LOOT</span>
              </div>
            </div>

            <div className="fob-task-row deployment-task">
              <span className="task-status-icon deployment-icon">➔</span>
              <div className="task-text-group">
                <span className="task-label deployment-label">ENTER AIRLOCK GATEWAY (z: -52)</span>
                <span className="task-subtext">STEP ONTO PAD TO INITIATE SECTOR 7 EXTRACTION</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contextual Airlock Proximity Prompt */}
      {sim.zoneMode === "hub" && Math.hypot(player.x, player.z - (-52)) < 7.5 && (
        <div
          style={{
            position: "absolute",
            bottom: "108px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "linear-gradient(135deg, rgba(2, 132, 199, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)",
            border: "2px solid #38bdf8",
            borderRadius: "8px",
            padding: "10px 22px",
            boxShadow: "0 0 24px rgba(56, 189, 248, 0.6)",
            pointerEvents: "none",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "13px", fontWeight: 900, color: "#ffffff", letterSpacing: "1px" }}>
            ⚡ COMBAT AIRLOCK READY // STEP ONTO GATE OR PRESS [E] TO DEPLOY ⚡
          </div>
          <div style={{ fontSize: "11px", color: "#bae6fd", marginTop: "2px" }}>
            Ingress into Sector 7 Extraction Raid // Weapons Hot
          </div>
        </div>
      )}

      {/* Full-Screen Kinetic Manga Ingress Splash */}
      {sim.zoneMode === "airlock_corridor" && (
        <div
          style={{
            position: "absolute",
            top: "40%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "10px",
            pointerEvents: "none",
            zIndex: 100,
          }}
        >
          <div
            style={{
              fontSize: "22px",
              fontWeight: 900,
              color: "#f8fafc",
              background: "rgba(15, 23, 42, 0.94)",
              border: "3px solid #38bdf8",
              padding: "14px 28px",
              borderRadius: "12px",
              boxShadow: "0 0 32px rgba(56, 189, 248, 0.8)",
              letterSpacing: "2px",
              textTransform: "uppercase",
              textAlign: "center",
            }}
          >
            ⚡ INGRESS AUTHORIZED // DEPLOYING INTO SECTOR 7 ⚡
          </div>
          <div style={{ fontSize: "12px", color: "#38bdf8", fontWeight: 800, fontFamily: "monospace" }}>
            WEAPONS HOT • EXTRACTION CLOCK COMMENCING
          </div>
        </div>
      )}

      {/* Centered Hitmarker Indicator */}
      {showHitmarker && (
        <div key={player.lastHitmarkerTick} className="hitmarker-indicator">
          <svg width="44" height="44" viewBox="0 0 24 24">
            <line
              x1="2"
              y1="2"
              x2="8"
              y2="8"
              stroke={isHitmarkerCrit ? "#ff2212" : "#151716"}
              strokeWidth="3.6"
              strokeLinecap="round"
            />
            <line
              x1="22"
              y1="2"
              x2="16"
              y2="8"
              stroke={isHitmarkerCrit ? "#ff2212" : "#151716"}
              strokeWidth="3.6"
              strokeLinecap="round"
            />
            <line
              x1="2"
              y1="22"
              x2="8"
              y2="16"
              stroke={isHitmarkerCrit ? "#ff2212" : "#151716"}
              strokeWidth="3.6"
              strokeLinecap="round"
            />
            <line
              x1="22"
              y1="22"
              x2="16"
              y2="16"
              stroke={isHitmarkerCrit ? "#ff2212" : "#151716"}
              strokeWidth="3.6"
              strokeLinecap="round"
            />
          </svg>
        </div>
      )}

      {/* ============================================================
          AUTHENTIC DIEGETIC MILITARY GAME HUD (Sol 6.1 High Architecture)
          ============================================================ */}
      <span className="tactical-badge hud-panel" style={{ display: "none" }} />

      {/* Top Left: Callsign & Arsenal Station */}
      <div className="hud-station hud-callsign">
        <div className="hud-shell">
          <div className="hud-shell__body">
            <div className="hud-label">// OPERATIONAL SECTOR</div>
            <div className="hud-callsign-name">
              {sim.zoneMode === "hub" ? "FOB STAGING // SECTOR 7" : "SECTOR 7 // DEPOT RAID"}
            </div>
            <div className="hud-callsign-sub">
              {sim.zoneMode === "hub" ? "OUTPOST SECURE • PRE-RAID" : "HOSTILE INGRESS • WEAPONS HOT"}
            </div>

            {sim.squadmate && sim.squadmate.isAlive && (
              <div className="hud-squadmate-tag">
                <span>◇ VIPER-2:</span>
                <span style={{ color: sim.squadmate.health > 40 ? "var(--hud-phosphor)" : "var(--hud-danger)" }}>
                  {sim.squadmate.health} HP
                </span>
              </div>
            )}

            {sim.zoneMode === "hub" && (
              <div style={{ marginTop: "6px", borderTop: "1px solid var(--hud-line)", paddingTop: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="hud-label">PRE-FLIGHT READINESS</span>
                  <button
                    onClick={() => setIsFobMinimized(!isFobMinimized)}
                    className="hud-switch"
                    style={{ minHeight: "20px", padding: "1px 6px", fontSize: "8.5px" }}
                    title="Toggle Pre-Flight Task List"
                  >
                    {[sim.trainingProgress?.dummyHit, sim.trainingProgress?.agilityUsed, sim.trainingProgress?.crateLooted].filter(Boolean).length}/3 {isFobMinimized ? "▼" : "▲"}
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "6px" }}>
              {onOpenHideout && (
                <button
                  onClick={onOpenHideout}
                  className="hud-switch"
                  title="Open Tactical Stash & Armory [TAB]"
                >
                  [TAB] ARSENAL
                </button>
              )}
              {proximityAlert.distance < 45 ? (
                <span className="hud-proximity-alert">
                  ⚠️ HOSTILE {Math.round(proximityAlert.distance)}M
                </span>
              ) : (
                <span className="hud-proximity-clear">
                  RADAR CLEAR
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Top Right: Telemetry & Tactical Radar Station */}
      <div className="hud-station hud-telemetry">
        <div className="hud-shell">
          <div className="hud-shell__body">
            {sim.zoneMode === "hub" ? (
              <>
                <div className="hud-telemetry-row">
                  <span className="hud-label">BASE CAMP</span>
                  <span className="hud-exfil-timer" style={{ color: "var(--hud-phosphor)", fontSize: "14px" }}>
                    SECURE
                  </span>
                </div>
                <div className="hud-telemetry-status">
                  <span className="hud-status-indicator" style={{ background: "var(--hud-phosphor)" }} />
                  <span>AIRLOCK READY (z: -52)</span>
                </div>
                <div style={{ fontSize: "8.5px", color: "var(--hud-muted)", marginBottom: "6px" }}>
                  OBJ: STEP ONTO AIRLOCK PAD TO INGRESS
                </div>
              </>
            ) : (
              <>
                <div className="hud-telemetry-row">
                  <span className="hud-label">RAID CLOCK</span>
                  <span
                    className="hud-exfil-timer"
                    style={{ color: totalSeconds < 180 ? "var(--hud-danger)" : "var(--hud-warning)" }}
                  >
                    {timeFormatted}
                  </span>
                </div>
                <div className="hud-telemetry-status">
                  <span
                    className="hud-status-indicator"
                    style={{
                      background: isHoldingLZ
                        ? "var(--hud-warning)"
                        : exfilState.kind === "extracted"
                        ? "#10b981"
                        : "var(--hud-phosphor)",
                    }}
                  />
                  <span>
                    {isHoldingLZ
                      ? `EXTRACTING: ${((SIM_CONFIG.EXFIL_HOLD_TICKS - holdTicks) / 60).toFixed(1)}s`
                      : exfilState.kind === "extracted"
                      ? "EXTRACTION COMPLETE"
                      : "EXFIL SITES OPEN"}
                  </span>
                </div>
                {/* Tactical Extraction Points List */}
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "8.5px", marginBottom: "6px", fontFamily: "var(--hud-mono)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", color: isHoldingLZ ? "var(--hud-warning)" : "var(--hud-phosphor)" }}>
                    <span>LZ-01 [45, 45]:</span>
                    <span>{isHoldingLZ ? "HOLDING..." : "ACTIVE"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: player.hasKeycard ? "#c084fc" : "var(--hud-muted)" }}>
                    <span>BUNKER [-45, -45]:</span>
                    <span>{player.hasKeycard ? "UNLOCKED" : "KEYCARD REQ"}</span>
                  </div>
                </div>
              </>
            )}

            {/* Tactical Radar Display with Scope Crosshair & Scanlines */}
            <div className="hud-radar">
              <div className="hud-radar-crosshair" />
              <div className="hud-radar-ring" style={{ width: "38%", height: "38%" }} />
              <div className="hud-radar-ring" style={{ width: "76%", height: "76%" }} />
              
              {/* Rotating Player Heading Marker */}
              <div
                className="hud-radar-heading"
                style={{ transform: `translate(-50%, -50%) rotate(${headingDeg}deg)` }}
              >
                ▲
              </div>

              {/* Hostile Blips within 30m Detection Envelope */}
              {sim.rivals.map((r) => {
                if (!r.isAlive || r.isExtracted) return null;
                const dx = r.x - player.x;
                const dz = r.z - player.z;
                const dist = Math.hypot(dx, dz);
                if (dist > 30) return null;
                const px = 50 + (dx / 30) * 42;
                const py = 50 + (dz / 30) * 42;
                const isBoss = r.id === "scav_boss_warlord" || /boss|warlord/i.test(r.name);
                return (
                  <div
                    key={r.id}
                    className={`hud-radar-blip ${isBoss ? "boss-blip" : "enemy-blip"}`}
                    style={{ left: `${px}%`, top: `${py}%` }}
                  />
                );
              })}

              <div className="hud-radar-tag">
                RNG 30M // {currentCardinal} {String(headingDeg).padStart(3, "0")}°
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Center Dynamic Tactical Banners */}
      <div className="hud-center-alerts">
        {isHoldingLZ && !recentInterruption && (
          <div className="hud-alert-banner banner-holding">
            HOLDING EXTRACTION LZ: {(holdTicks / 60).toFixed(1)}s / 3.0s
          </div>
        )}

        {showResetBanner && (
          <div className="hud-alert-banner banner-reset">
            DAMAGE INTERRUPTION — LZ HOLD RESET!
          </div>
        )}

        {player.isBleeding && (
          <div
            onClick={() => {
              if (sim.useStim()) sound.playHealInject();
            }}
            className="hud-alert-banner banner-bleed"
            title="Inject Combat Stim [H]"
          >
            ⚠️ ARTERIAL BLEED! PRESS [H] TO STIM
          </div>
        )}

        {player.hasKeycard && !sim.isPlayerInExfilZone() && !nearbyCrate && (
          <div className="hud-alert-banner banner-keycard">
            💳 VIOLET KEYCARD ACTIVE — EMERGENCY BUNKER (-45, -45)
          </div>
        )}
      </div>

      {/* Bottom Left: Military Combat Vitals Station */}
      <div className="hud-station hud-vitals">
        <div className="hud-shell">
          <div className="hud-shell__body">
            {(player as any).ingressShieldTicks > 0 && (
              <div className="hud-shield-banner">
                ⚡ INGRESS SHIELD ACTIVE
              </div>
            )}

            <div className="hud-vitals-header">
              <span className="hud-label">OPERATIVE HEALTH</span>
              <span className={`hud-vitals-val ${player.health < 30 ? "hud-danger" : "hud-phosphor"}`}>
                {Math.round(player.health)} / 100
              </span>
            </div>

            {/* 5-Pip Discrete Military Health Cells */}
            <div className="hud-cells hud-cells--health">
              {[0, 1, 2, 3, 4].map((pipIdx) => {
                const pipMin = pipIdx * 20;
                const fillPct = Math.min(100, Math.max(0, ((player.health - pipMin) / 20) * 100));
                return (
                  <div key={pipIdx} className="hud-cell">
                    <div
                      className={`hud-cell__fill ${player.health < 30 ? "fill-danger" : "fill-health"}`}
                      style={{ width: `${fillPct}%` }}
                    />
                  </div>
                );
              })}
            </div>

            <div className="hud-vitals-header" style={{ marginTop: "6px" }}>
              <span className="hud-label">ARMOR // AP</span>
              <span className="hud-vitals-val" style={{ color: "#38bdf8" }}>
                {Math.round(player.armor)} / 100
              </span>
            </div>

            {/* 10-Pip Segmented Armor / AP Cells */}
            <div className="hud-cells hud-cells--resource">
              {Array.from({ length: 10 }).map((_, pipIdx) => {
                const pipMin = pipIdx * 10;
                const fillPct = Math.min(100, Math.max(0, ((player.armor - pipMin) / 10) * 100));
                return (
                  <div key={pipIdx} className="hud-cell hud-cell--sm">
                    <div className="hud-cell__fill fill-ap" style={{ width: `${fillPct}%` }} />
                  </div>
                );
              })}
            </div>

            {/* Affliction Alert */}
            {player.isBleeding && (
              <div className="hud-affliction">
                <span>⚠️ ARTERIAL BLEED</span>
                <span style={{ fontSize: "8.5px", color: "var(--hud-ink)" }}>PRESS [H]</span>
              </div>
            )}

            {/* Tactical Keybind Telemetry */}
            <div className="hud-maneuvers">
              <span>SHIFT RUN</span>
              <span>•</span>
              <span>C SLIDE</span>
              <span>•</span>
              <span>SPACE ROLL</span>
              <span>•</span>
              <span>V KICK</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Center: Minimal Combat Ticker */}
      {(() => {
        const displayLogs = sim.combatLog
          .filter((l) => !l.startsWith("[STAGED INGRESS]") && !l.startsWith("[SETTLEMENT]"))
          .slice(-2);
        if (displayLogs.length === 0) return null;
        return (
          <div className="hud-combat-ticker">
            {displayLogs.map((log, idx) => (
              <div key={idx} className="hud-ticker-line">
                {log}
              </div>
            ))}
          </div>
        );
      })()}

      {/* Bottom Right: Tactical Ballistics Station */}
      <div className="hud-station hud-ballistics">
        <div className="hud-shell">
          <div className="hud-shell__body">
            <div className="hud-weapon-header">
              <div>
                <div className="hud-weapon-name">
                  {player.weapon === "shotgun" ? "M590 BREACHER" : "M4A1 CQBR"}
                </div>
                <div className="hud-weapon-caliber">
                  {player.weapon === "shotgun" ? "12-GAUGE 00 BUCK • PUMP" : "5.56x45MM NATO • AUTO"}
                </div>
              </div>
              <div className="hud-ammo-display">
                <span className="hud-ammo">{player.ammo}</span>
                <span className="hud-ammo__reserve">
                  / {player.weapon === "shotgun" ? player.reserveShotgunAmmo ?? 24 : player.reserveRifleAmmo ?? 90}
                </span>
              </div>
            </div>

            {/* Tactical Magazine Bullet Pip Stack */}
            <div className="hud-mag-bar">
              {Array.from({ length: player.weapon === "shotgun" ? 8 : 30 }).map((_, i) => (
                <div
                  key={i}
                  className={`hud-mag-pip ${i < player.ammo ? "loaded" : "spent"}`}
                />
              ))}
            </div>

            {/* Mil-Spec Action Switches */}
            <div className="hud-controls-row">
              <button
                onClick={() => sim.switchWeapon()}
                className="hud-switch"
                title="Swap Weapon [1/2 or Q]"
              >
                [1/2] SWAP
              </button>
              <button
                onClick={() => {
                  if (sim.reload()) sound.playReload();
                }}
                className="hud-switch"
                title="Reload Weapon [R]"
              >
                [R] RELOAD
              </button>
              <button
                onClick={() => {
                  const isOn = sim.toggleFlashlight();
                  sound.playFlashlightClick(isOn);
                }}
                className={`hud-switch ${(player.isFlashlightOn ?? true) ? "illum-active" : ""}`}
                title="Toggle Tactical Light [L]"
              >
                [L] {(player.isFlashlightOn ?? true) ? "ILLUM ON" : "ILLUM OFF"}
              </button>
              <button
                onClick={() => {
                  if (sim.useStim()) sound.playHealInject();
                }}
                className="hud-switch hud-stim-btn"
                title="Inject Combat Stim [H]"
              >
                💉 {player.stimsRemaining || 0} [H]
              </button>
            </div>

            {/* Scavenged Loot Telemetry */}
            <div className="hud-loot-row">
              <span className="hud-label">SCAVENGED LOOT:</span>
              <span className="hud-loot-val">${player.cash.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick-Loot Modal Overlay (docked top-right on desktop) */}
      {nearbyCrate && (
        <div
          className="quick-loot-modal hud-interactive tactical-ink-card"
          style={{
            position: "absolute",
            top: "90px",
            right: "24px",
            padding: "14px 18px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            zIndex: 20,
            pointerEvents: "auto",
            minWidth: "280px",
            maxWidth: "340px",
            boxShadow: "5px 5px 0px #151716",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 900, fontSize: "14px", color: "#151716", fontFamily: "monospace", fontStyle: "italic" }}>
              📦 {nearbyCrate.containerTitle || "SUPPLY CACHE"}
            </span>
            <span style={{ fontSize: "12px", color: "#d45538", fontFamily: "monospace", fontWeight: 900 }}>
              ${nearbyCrate.cashValue.toLocaleString()}
            </span>
          </div>

          {nearbyCrate.items && (
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {nearbyCrate.items.map((it) => (
                <div
                  key={it.id}
                  className={`tarkov-item-card rarity-${it.rarity}`}
                  style={{ background: "#eeece5", border: "1.5px solid #151716", color: "#151716", fontWeight: 800 }}
                >
                  <span>{it.icon}</span>
                  <span>{it.name}</span>
                  <span style={{ color: "#d45538", fontWeight: 900 }}>${it.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => {
              sim.requestLootCrate(nearbyCrate.id);
              sound.playLootChime();
            }}
            className="tactical-ink-btn"
            style={{
              padding: "10px 16px",
              fontSize: "12px",
              letterSpacing: "1px",
              width: "100%",
              background: "#d45538",
              color: "#ffffff",
              border: "2px solid #151716",
            }}
          >
            QUICK LOOT ALL [E / F]
          </button>
        </div>
      )}
    </div>
  );
};
