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

    // Target Dummy Hit Callout
    if (sim.lastDummyHitTick && sim.lastDummyHitTick !== lastDummyHitRef.current) {
      lastDummyHitRef.current = sim.lastDummyHitTick;
      newEntries.push({
        id: `dummy_${now}`,
        text: "THWACK!",
        sub: "TARGET IMPACT // 100 DMG",
        kind: "amber",
      });
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

    // Dynamic Hitmarker Callout
    if (
      player.lastHitmarkerTick &&
      player.lastHitmarkerTick !== lastHitmarkerRef.current
    ) {
      lastHitmarkerRef.current = player.lastHitmarkerTick;
      newEntries.push({
        id: `hit_${now}`,
        text: player.lastHitmarkerCrit
          ? "CRITICAL HIT!"
          : player.weapon === "shotgun"
          ? "12G BLAST"
          : "DIRECT HIT",
        sub: player.lastHitmarkerCrit ? "-60 HP" : "-35 HP",
        kind: player.lastHitmarkerCrit ? "crit" : "default",
      });
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
        if (log.includes("Eliminated") || log.includes("Terminated") || log.includes("downed")) {
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
    <div className="hud-layer">
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

      {/* Dynamic FOB Pre-Flight Readiness Card */}
      {sim.zoneMode === "hub" && (
        <div className="fob-briefing-card tactical-ink-card hud-interactive">
          <div className="fob-briefing-watermark" aria-hidden="true">TRAINING</div>
          <div className="fob-briefing-header">
            <span className="fob-briefing-tag">// FORWARD OPERATING BASE</span>
            <span className="fob-briefing-title">PRE-FLIGHT READINESS</span>
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
          TOP BAR: Minimal, Clean, Desloppified
          ============================================================ */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
        <div className="tactical-top-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          {/* Top Left: Sector Status & Proximity Warning */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="tactical-badge">
              {sim.zoneMode === "hub" ? "SECTOR 7 // HUB" : "SECTOR 7 // RAID"}
            </span>
            {onOpenHideout && (
              <button
                onClick={onOpenHideout}
                className="tactical-ink-btn hud-interactive"
                style={{ padding: "4px 10px", fontSize: "11px", fontWeight: 800, display: "flex", alignItems: "center", gap: "6px", pointerEvents: "auto" }}
                title="Open Stash & Armory [TAB]"
              >
                <span>📦</span>
                <span>HIDEOUT [TAB]</span>
              </button>
            )}
            {proximityAlert.distance < 45 ? (
              <span className="tactical-badge badge-crimson">
                ⚠️ HOSTILE {Math.round(proximityAlert.distance)}M
              </span>
            ) : (
              <span style={{ fontSize: "11px", color: "#64748b", fontFamily: "monospace", fontWeight: 700 }}>
                RADAR CLEAR
              </span>
            )}

            {sim.squadmate && sim.squadmate.isAlive && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "3px 8px",
                  background: "rgba(18, 24, 36, 0.85)",
                  border: "1px solid rgba(81, 229, 240, 0.4)",
                  borderRadius: "4px",
                  fontFamily: "monospace",
                  fontSize: "11px",
                  fontWeight: 800,
                  color: "#51E5F0",
                }}
              >
                <span>◇ VIPER-2</span>
                <span style={{ color: "#64748b" }}>|</span>
                <span style={{ color: sim.squadmate.health > 40 ? "#72F1A8" : "#FF365E" }}>
                  {sim.squadmate.health} HP
                </span>
              </div>
            )}

            {/* Compact Mobile/Landscape Vitals Pill */}
            <div
              className="tactical-vitals-mobile-pill"
              style={{
                display: "none",
                alignItems: "center",
                gap: "8px",
                background: "#f3f4f6",
                border: "2px solid #151716",
                borderRadius: "4px",
                padding: "3px 8px",
                fontFamily: "monospace",
                fontWeight: 800,
                fontSize: "11px",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "3px", color: player.health > 35 ? "#16a34a" : "#ff2212" }}>
                <Heart size={12} fill={player.health > 35 ? "#16a34a" : "#ff2212"} /> {player.health}
              </span>
              <span style={{ color: "#cbd5e1" }}>|</span>
              <span style={{ display: "flex", alignItems: "center", gap: "3px", color: "#0284c7" }}>
                <Shield size={12} fill="#0284c7" /> {player.armor}
              </span>
            </div>
          </div>

          {/* Top Center: Clean Minimal Compass */}
          <div className="compass-bar" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Compass
              size={16}
              color="#151716"
              style={{
                transform: `rotate(${-headingDeg}deg)`,
                transition: "transform 0.08s linear",
              }}
            />
            <span style={{ fontWeight: 800, color: "#151716", fontFamily: "monospace", fontSize: "12px" }}>
              {String(headingDeg).padStart(3, "0")}° [{currentCardinal}]
            </span>
          </div>

          {/* Top Right: Match Deadline Countdown & Mini-Map Radar */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div className="tactical-badge badge-amber" style={{ fontSize: "12px" }}>
              EXFIL: {timeFormatted}
            </div>

            {/* Tactical 2D Mini-Map Radar */}
            <div
              className="mini-map-radar"
              style={{
                width: "72px",
                height: "72px",
                background: "#f3f4f6",
                border: "2px solid #151716",
                borderRadius: "6px",
                position: "relative",
                overflow: "hidden",
                boxShadow: "2px 2px 0px #151716",
              }}
            >
              <svg width="72" height="72" viewBox="-85 -85 170 170" style={{ width: "100%", height: "100%", display: "block" }}>
                <rect x="-80" y="-80" width="160" height="160" fill="none" stroke="#151716" strokeWidth="1.2" opacity="0.3" />
                <circle cx="45" cy="45" r="7.0" fill="rgba(34, 197, 94, 0.4)" stroke="#151716" strokeWidth="1.4" />
                {DEPOT_CONTAINERS.map((c, i) => (
                  <rect
                    key={i}
                    x={c.minX}
                    y={c.minZ}
                    width={c.maxX - c.minX}
                    height={c.maxZ - c.minZ}
                    fill="#cbd5e1"
                    stroke="#151716"
                    strokeWidth="1.0"
                  />
                ))}
                {sim.crates.map((c) => (
                  <circle key={c.id} cx={c.x} cy={c.z} r="2.5" fill={c.opened ? "#94a3b8" : "#d45538"} />
                ))}
                {sim.machines.filter((m) => m.isAlive).map((m) => (
                  <circle key={m.id} cx={m.x} cy={m.z} r="3.2" fill="#ff2212" />
                ))}
                {sim.rivals.filter((r) => r.isAlive && !r.isExtracted).map((r) => (
                  <g key={r.id} transform={`translate(${r.x}, ${r.z})`}>
                    <circle cx="0" cy="0" r="3.2" fill="#ff2212" />
                    <line x1="0" y1="0" x2={Math.sin(r.facing) * 5.0} y2={Math.cos(r.facing) * 5.0} stroke="#ff2212" strokeWidth="1.5" />
                  </g>
                ))}
                <g transform={`translate(${player.x}, ${player.z})`}>
                  <circle cx="0" cy="0" r="3.5" fill="#151716" />
                  <line x1="0" y1="0" x2={Math.sin(player.facing) * 7.0} y2={Math.cos(player.facing) * 7.0} stroke="#151716" strokeWidth="2.0" />
                </g>
              </svg>
            </div>
          </div>
        </div>

        {/* Center Alert Banners (Conditional) */}
        {isHoldingLZ && !recentInterruption && (
          <div
            className="tactical-ink-card"
            style={{
              padding: "8px 20px",
              background: "#22c55e",
              color: "#ffffff",
              boxShadow: "4px 4px 0px #151716",
              fontWeight: 900,
              fontSize: "13px",
              fontFamily: "monospace",
            }}
          >
            HOLDING EXTRACTION LZ: {(holdTicks / 60).toFixed(1)}s / 3.0s
          </div>
        )}

        {showResetBanner && (
          <div
            className="tactical-ink-card"
            style={{
              padding: "8px 20px",
              background: "#ff2212",
              color: "#ffffff",
              boxShadow: "4px 4px 0px #151716",
              fontWeight: 900,
              fontSize: "13px",
              fontFamily: "monospace",
            }}
          >
            DAMAGE INTERRUPTION — LZ HOLD RESET!
          </div>
        )}

        {player.isBleeding && (
          <div
            onClick={() => {
              if (sim.useStim()) sound.playHealInject();
            }}
            className="tactical-ink-card bleed-alert-pulse hud-interactive"
            style={{
              padding: "6px 18px",
              background: "#ff2212",
              color: "#ffffff",
              cursor: "pointer",
              boxShadow: "4px 4px 0px #151716",
              fontWeight: 900,
              fontSize: "12px",
              fontFamily: "monospace",
              pointerEvents: "auto",
            }}
          >
            ⚠️ ARTERIAL BLEED! INJECT STIM [H]
          </div>
        )}

        {player.hasKeycard && !sim.isPlayerInExfilZone() && !nearbyCrate && (
          <div
            className="tactical-ink-card"
            style={{
              padding: "4px 14px",
              background: "#fef3c7",
              color: "#151716",
              fontWeight: 800,
              fontSize: "11px",
              fontFamily: "monospace",
            }}
          >
            💳 VIOLET KEYCARD ACTIVE — EMERGENCY BUNKER (-45, -45)
          </div>
        )}
      </div>

      {/* ============================================================
          BOTTOM BAR: Unified Translucent Modern Shooter HUD
          ============================================================ */}
      <div className="tactical-bottom-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", width: "100%" }}>
        {/* Bottom Left: Streamlined Vital Status */}
        <div
          className="tactical-ink-card"
          style={{
            padding: "8px 14px",
            minWidth: "200px",
            maxWidth: "240px",
            display: "flex",
            flexDirection: "column",
            gap: "5px",
          }}
        >
          {/* Ingress Shield Banner if active */}
          {(player as any).ingressShieldTicks > 0 && (
            <div style={{ fontSize: "10px", fontWeight: 800, color: "#38bdf8", letterSpacing: "0.5px" }}>
              ⚡ INGRESS SHIELD ACTIVE
            </div>
          )}

          {/* Health Bar */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: 800, color: "#f8fafc" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <Heart size={12} color="#22c55e" /> HP
              </span>
              <span style={{ fontFamily: "monospace" }}>{player.health}/100</span>
            </div>
            <div style={{ height: "4px", background: "rgba(51, 65, 85, 0.6)", borderRadius: "2px", overflow: "hidden" }}>
              <div
                style={{
                  width: `${player.health}%`,
                  height: "100%",
                  background: player.health > 35 ? "#22c55e" : "#ef4444",
                  transition: "width 0.15s ease",
                }}
              />
            </div>
          </div>

          {/* Armor Bar */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: 800, color: "#f8fafc" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <Shield size={12} color="#38bdf8" /> AP
              </span>
              <span style={{ fontFamily: "monospace" }}>{player.armor}/100</span>
            </div>
            <div style={{ height: "4px", background: "rgba(51, 65, 85, 0.6)", borderRadius: "2px", overflow: "hidden" }}>
              <div
                style={{
                  width: `${player.armor}%`,
                  height: "100%",
                  background: "#38bdf8",
                  transition: "width 0.15s ease",
                }}
              />
            </div>
          </div>

          {/* Clean Controls Hint */}
          <div style={{ display: "flex", gap: "4px", fontSize: "8.5px", fontWeight: 700, fontFamily: "monospace", color: "#94a3b8", marginTop: "1px" }}>
            <span>SHIFT RUN</span> &bull; <span>C SLIDE</span> &bull; <span>SPACE ROLL</span> &bull; <span>V KICK</span>
          </div>
        </div>

        {/* Bottom Center: Minimal Combat Ticker */}
        {sim.combatLog.length > 0 && (
          <div style={{ maxWidth: "340px", display: "flex", flexDirection: "column", gap: "3px", pointerEvents: "none" }}>
            {sim.combatLog.slice(-2).map((log, idx) => (
              <div
                key={idx}
                className="tactical-ink-card"
                style={{
                  padding: "3px 10px",
                  fontSize: "10px",
                  fontFamily: "monospace",
                  fontWeight: 700,
                  opacity: 0.9,
                }}
              >
                {log}
              </div>
            ))}
          </div>
        )}

        {/* Bottom Right: Clean High-Craft Arsenal & Resources Widget */}
        <div
          className="tactical-ink-card hud-interactive"
          style={{
            padding: "6px 12px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            pointerEvents: "auto",
          }}
        >
          {/* Current Weapon & Ammo */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Crosshair size={20} color={player.weapon === "shotgun" ? "#f59e0b" : "#38bdf8"} />
            <div>
              <div style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", color: player.weapon === "shotgun" ? "#f59e0b" : "#38bdf8", letterSpacing: "0.5px" }}>
                {player.weapon === "shotgun" ? "M590 SHOTGUN" : "M4A1 RIFLE"}
              </div>
              <div style={{ fontSize: "20px", fontWeight: 900, fontFamily: "monospace", color: "#f8fafc", lineHeight: 1.1 }}>
                {player.ammo} <span style={{ fontSize: "11px", color: "#94a3b8" }}>/ {player.weapon === "shotgun" ? player.reserveShotgunAmmo ?? 24 : player.reserveRifleAmmo ?? 90}</span>
              </div>
            </div>
          </div>

          {/* Quick Action Chips */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <button
              onClick={() => sim.switchWeapon()}
              className="tactical-ink-btn"
              style={{ padding: "1px 6px", fontSize: "8.5px" }}
              title="Swap Weapon [1/2 or Q]"
            >
              [1/2] SWAP
            </button>
            <button
              onClick={() => {
                if (sim.reload()) sound.playReload();
              }}
              className="tactical-ink-btn"
              style={{ padding: "1px 6px", fontSize: "8.5px" }}
              title="Reload Weapon [R]"
            >
              [R] RELOAD
            </button>
          </div>

          {/* Divider */}
          <div style={{ width: "1px", height: "24px", background: "rgba(148, 163, 184, 0.25)" }} />

          {/* Scavenged Cash */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            <span style={{ fontSize: "8.5px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>LOOT</span>
            <span style={{ fontSize: "15px", fontWeight: 900, color: "#10b981", fontFamily: "monospace" }}>
              ${player.cash.toLocaleString()}
            </span>
          </div>

          {/* Stims Button */}
          <button
            onClick={() => {
              if (sim.useStim()) sound.playHealInject();
            }}
            className="tactical-ink-btn"
            style={{
              padding: "3px 7px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              background: (player.stimsRemaining || 0) > 0 ? "rgba(30, 41, 59, 0.9)" : "rgba(15, 23, 42, 0.6)",
              borderColor: (player.stimsRemaining || 0) > 0 ? "#38bdf8" : "rgba(148, 163, 184, 0.2)",
            }}
            title="Inject Stim [H]"
          >
            <span>💉</span>
            <span style={{ fontSize: "10px", fontFamily: "monospace", color: "#f8fafc" }}>{player.stimsRemaining || 0} [H]</span>
          </button>
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
