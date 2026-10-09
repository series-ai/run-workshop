import React from "react";
import {
  Shield,
  Heart,
  Crosshair,
  Compass,
  AlertTriangle,
  Radio,
  DollarSign,
} from "lucide-react";
import { type SectorDepotSimulation, DEPOT_CONTAINERS } from "../sim/game.js";
import { SIM_CONFIG } from "../sim/config.js";
import { sound } from "../audio.js";

interface TacticalHudProps {
  sim: SectorDepotSimulation;
}

export const TacticalHud: React.FC<TacticalHudProps> = ({ sim }) => {
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

  const lastSlideRef = React.useRef(false);
  const lastKickRef = React.useRef(false);
  const lastHitmarkerRef = React.useRef(0);
  const lastCashRef = React.useRef(player.cash);
  const lastBleedRef = React.useRef(player.isBleeding);

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
  ]);

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
      {!isTestMode && (isSlidingActive || player.action === "sprint") && (
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

      {/* Critical Health Vignette */}
      {isCriticalHealth && <div className="critical-health-vignette" />}

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
            {proximityAlert.distance < 45 ? (
              <span className="tactical-badge badge-crimson">
                ⚠️ HOSTILE {Math.round(proximityAlert.distance)}M
              </span>
            ) : (
              <span style={{ fontSize: "11px", color: "#64748b", fontFamily: "monospace", fontWeight: 700 }}>
                RADAR CLEAR
              </span>
            )}
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
          BOTTOM BAR: Unified, Matching, Zero Clutter
          ============================================================ */}
      <div className="tactical-bottom-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", width: "100%" }}>
        {/* Bottom Left: Operative Vitals & Controls */}
        <div
          className="tactical-ink-card"
          style={{
            padding: "10px 14px",
            minWidth: "220px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          {/* Health Bar */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: 900, color: "#151716" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <Heart size={13} color={player.health > 35 ? "#16a34a" : "#ff2212"} /> HP
              </span>
              <span style={{ fontFamily: "monospace" }}>{player.health}/100</span>
            </div>
            <div style={{ height: "6px", background: "#e2e8f0", borderRadius: "3px", overflow: "hidden", border: "1px solid #151716" }}>
              <div
                style={{
                  width: `${player.health}%`,
                  height: "100%",
                  background: player.health > 35 ? "#16a34a" : "#ff2212",
                  transition: "width 0.15s ease",
                }}
              />
            </div>
          </div>

          {/* Armor Bar */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: 900, color: "#151716" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <Shield size={13} color="#0284c7" /> ARMOR
              </span>
              <span style={{ fontFamily: "monospace" }}>{player.armor}/100</span>
            </div>
            <div style={{ height: "6px", background: "#e2e8f0", borderRadius: "3px", overflow: "hidden", border: "1px solid #151716" }}>
              <div
                style={{
                  width: `${player.armor}%`,
                  height: "100%",
                  background: "#0284c7",
                  transition: "width 0.15s ease",
                }}
              />
            </div>
          </div>

          {/* Clean Controls Hint */}
          <div style={{ display: "flex", gap: "4px", fontSize: "9px", fontWeight: 800, fontFamily: "monospace", color: "#64748b", marginTop: "2px" }}>
            <span>[SHIFT] RUN</span> &bull; <span>[C] SLIDE</span> &bull; <span>[SPACE] ROLL</span> &bull; <span>[V] KICK</span>
          </div>
        </div>

        {/* Bottom Center: Minimal Combat Ticker */}
        {sim.combatLog.length > 0 && (
          <div style={{ maxWidth: "380px", display: "flex", flexDirection: "column", gap: "3px", pointerEvents: "none" }}>
            {sim.combatLog.slice(-2).map((log, idx) => (
              <div
                key={idx}
                className="tactical-ink-card"
                style={{
                  padding: "3px 10px",
                  fontSize: "11px",
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

        {/* Bottom Right: Unified Combat Arsenal & Loot Widget */}
        <div
          className="tactical-ink-card hud-interactive"
          style={{
            padding: "8px 14px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            pointerEvents: "auto",
          }}
        >
          {/* Current Weapon & Ammo */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Crosshair size={22} color={player.weapon === "shotgun" ? "#d45538" : "#151716"} />
            <div>
              <div style={{ fontSize: "11px", fontWeight: 900, textTransform: "uppercase", color: player.weapon === "shotgun" ? "#d45538" : "#151716", fontStyle: "italic" }}>
                {player.weapon === "shotgun" ? "M590 SHOTGUN" : "M4A1 RIFLE"}
              </div>
              <div style={{ fontSize: "18px", fontWeight: 900, fontFamily: "monospace", color: "#151716", lineHeight: 1.1 }}>
                {player.ammo} <span style={{ fontSize: "11px", color: "#64748b" }}>/ {player.maxAmmo} ({player.weapon === "shotgun" ? player.reserveShotgunAmmo ?? 24 : player.reserveRifleAmmo ?? 90})</span>
              </div>
            </div>
          </div>

          {/* Weapon Swap & Reload Buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            <button
              onClick={() => sim.switchWeapon()}
              className="tactical-ink-btn"
              style={{ padding: "2px 8px", fontSize: "9px" }}
            >
              SWAP [1/2]
            </button>
            <button
              onClick={() => {
                if (sim.reload()) sound.playReload();
              }}
              className="tactical-ink-btn"
              style={{ background: "#f3f4f6", color: "#151716", padding: "2px 8px", fontSize: "9px" }}
            >
              RELOAD [R]
            </button>
          </div>

          {/* Divider */}
          <div style={{ width: "1px", height: "30px", background: "#cbd5e1" }} />

          {/* Scavenged Cash */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            <span style={{ fontSize: "9px", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>LOOT</span>
            <span style={{ fontSize: "16px", fontWeight: 900, color: "#151716", fontFamily: "monospace" }}>
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
              padding: "5px 9px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              background: (player.stimsRemaining || 0) > 0 ? "#151716" : "#94a3b8",
            }}
            title="Inject Stim [H]"
          >
            <span>💉</span>
            <span style={{ fontSize: "11px", fontFamily: "monospace" }}>{player.stimsRemaining || 0} [H]</span>
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
