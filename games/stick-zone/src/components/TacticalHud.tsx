import React from 'react';
import {
  Shield,
  Heart,
  Crosshair,
  Compass,
  AlertTriangle,
  Radio,
  DollarSign,
  Footprints,
  RotateCcw,
} from 'lucide-react';
import { type SectorDepotSimulation, DEPOT_CONTAINERS } from '../sim/game.js';
import { SIM_CONFIG } from '../sim/config.js';

interface TacticalHudProps {
  sim: SectorDepotSimulation;
}

export const TacticalHud: React.FC<TacticalHudProps> = ({ sim }) => {
  const { player, proximityAlert, exfilController, tick } = sim;
  const isSlidingActive = player.action === "slide" || !!player.isSliding || ((player.slideTicksRemaining || 0) > 0);

  // Formatting match time
  const remainingTicks = Math.max(0, SIM_CONFIG.RAID_DEADLINE_TICK - tick);
  const totalSeconds = Math.floor(remainingTicks / SIM_CONFIG.TICKS_PER_SECOND);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const timeFormatted = `${minutes}:${String(seconds).padStart(2, '0')}`;

  const exfilState = exfilController.getState();
  const isHoldingLZ = exfilState.kind === 'holding_zone';
  const holdTicks = isHoldingLZ ? exfilState.currentTicks : 0;
  // Combat damage feedback window: for ~2s after a hit that reset the extraction
  // counter, surface the interruption notice even while a new hold attempt is
  // already accumulating, so players see WHY their counter zeroed.
  const recentInterruption = sim.lastInterruptionTick > 0 && tick - sim.lastInterruptionTick < 120;
  const showResetBanner = !isHoldingLZ
    ? sim.lastInterruptionTick > 0 && tick - sim.lastInterruptionTick < 300
    : recentInterruption;

  const headingDeg = Math.round(((Math.atan2(Math.sin(player.facing), -Math.cos(player.facing)) * 180 / Math.PI + 360) % 360 + 360) % 360);
  const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
  const currentCardinal = CARDINALS[Math.round(headingDeg / 45) % 8];

  return (
    <div className="hud-layer">
      {/* Top Header: Compass, Proximity Radar Banner & Match Timer */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <div className="tactical-top-bar">
          {/* Top Left: Sector & Squad Info */}
          <div className="tactical-top-left" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span className="tactical-badge badge-cyan">SECTOR 7 DEPOT</span>
              <span className="tactical-badge badge-green">{player.badge}</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-dim)', fontFamily: 'monospace' }}>
              60 HZ SYNCHUB DETERMINISTIC AIRLOCK &bull; MULTI-SQUAD
            </div>
          </div>

          {/* Top Center: Dynamic Compass Bar */}
          <div className="compass-bar" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Compass size={16} color="var(--tactical-cyan)" style={{ transform: `rotate(${-headingDeg}deg)`, transition: 'transform 0.08s linear' }} />
            <span style={{ fontWeight: 800, color: 'var(--tactical-cyan)', fontFamily: 'monospace' }}>
              HDG {String(headingDeg).padStart(3, '0')}&deg; [{currentCardinal}]
            </span>
            <span style={{ color: 'var(--text-dim)' }}>&bull;</span>
            <span style={{ color: currentCardinal === 'N' ? 'var(--tactical-cyan)' : 'var(--text-muted)', fontWeight: currentCardinal === 'N' ? 800 : 400 }}>000&deg; N</span>
            <span style={{ color: 'var(--text-dim)' }}>&bull;</span>
            <span style={{ color: currentCardinal === 'E' ? 'var(--tactical-cyan)' : 'var(--text-muted)', fontWeight: currentCardinal === 'E' ? 800 : 400 }}>090&deg; E</span>
            <span style={{ color: 'var(--text-dim)' }}>&bull;</span>
            <span style={{ color: currentCardinal === 'S' ? 'var(--tactical-cyan)' : 'var(--text-muted)', fontWeight: currentCardinal === 'S' ? 800 : 400 }}>180&deg; S</span>
            <span style={{ color: 'var(--text-dim)' }}>&bull;</span>
            <span style={{ color: currentCardinal === 'W' ? 'var(--tactical-cyan)' : 'var(--text-muted)', fontWeight: currentCardinal === 'W' ? 800 : 400 }}>270&deg; W</span>
          </div>

          {/* Top Right: Match Deadline Countdown & Mini-Map Radar */}
          <div className="tactical-top-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
              <div className="tactical-badge badge-amber" style={{ fontSize: '13px' }}>
                EXFIL DEADLINE: {timeFormatted}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                {tick < SIM_CONFIG.INGRESS_WINDOW_TICKS
                  ? `INGRESS WINDOW OPEN (${Math.floor((SIM_CONFIG.INGRESS_WINDOW_TICKS - tick) / 60)}s)`
                  : 'INGRESS CLOSED // FINAL EXFIL'}
              </div>
            </div>

            {/* Tactical 2D Mini-Map Radar Box */}
            <div
              className="mini-map-radar"
              style={{
                width: '88px',
                height: '88px',
                background: 'rgba(10, 15, 24, 0.85)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <svg width="88" height="88" viewBox="-85 -85 170 170" style={{ width: '100%', height: '100%', display: 'block' }}>
                {/* Depot perimeter grid */}
                <rect x="-80" y="-80" width="160" height="160" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.0" />
                {/* Extraction Zone at (45, 45) with radius 6 */}
                <circle cx="45" cy="45" r="6.0" fill="rgba(34, 197, 94, 0.25)" stroke="#22c55e" strokeWidth="1.2" />
                {/* Containers */}
                {DEPOT_CONTAINERS.map((c, i) => (
                  <rect
                    key={i}
                    x={c.minX}
                    y={c.minZ}
                    width={c.maxX - c.minX}
                    height={c.maxZ - c.minZ}
                    fill="rgba(100, 116, 139, 0.45)"
                    stroke="rgba(148, 163, 184, 0.7)"
                    strokeWidth="0.8"
                  />
                ))}
                {/* Loot crates */}
                {sim.crates.map((c) => (
                  <circle key={c.id} cx={c.x} cy={c.z} r="2.5" fill={c.opened ? '#64748b' : '#f59e0b'} />
                ))}
                {/* Machine defenses */}
                {sim.machines.filter((m) => m.isAlive).map((m) => (
                  <circle key={m.id} cx={m.x} cy={m.z} r="3.0" fill="#ef4444" />
                ))}
                {/* Rivals with heading indicators */}
                {sim.rivals.filter((r) => r.isAlive && !r.isExtracted).map((r) => (
                  <g key={r.id} transform={`translate(${r.x}, ${r.z})`}>
                    <circle cx="0" cy="0" r="3.0" fill="#f43f5e" />
                    <line x1="0" y1="0" x2={Math.sin(r.facing) * 5.0} y2={Math.cos(r.facing) * 5.0} stroke="#f43f5e" strokeWidth="1.5" />
                  </g>
                ))}
                {/* Player Operative with Accurate Forward Heading Arrow */}
                <g transform={`translate(${player.x}, ${player.z})`}>
                  <circle cx="0" cy="0" r="3.5" fill="#06b6d4" />
                  <line x1="0" y1="0" x2={Math.sin(player.facing) * 6.5} y2={Math.cos(player.facing) * 6.5} stroke="#06b6d4" strokeWidth="2.0" />
                </g>
              </svg>
            </div>
          </div>
        </div>

        {/* Staged Ingress Status & Admission Countdown Banner */}
        {!sim.isAdmitted() && (
          <div
            className="ingress-status-banner"
            style={{
              background: "rgba(6, 182, 212, 0.25)",
              border: "2px solid var(--tactical-cyan)",
              borderRadius: "8px",
              padding: "10px 24px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
              backdropFilter: "blur(8px)",
            }}
          >
            <div style={{ color: "var(--tactical-cyan)", fontWeight: 800, fontSize: "14px", fontFamily: "monospace", letterSpacing: "1px" }}>
              STAGED INGRESS PROTOCOL: {sim.ingressController.getState().kind.toUpperCase()}
            </div>
            <div style={{ fontSize: "11px", color: "#e0f2fe" }}>
              SYNCHUB ADMISSION GATES ACTIVE &bull; INGRESS WINDOW {Math.max(0, SIM_CONFIG.INGRESS_WINDOW_TICKS - sim.tick)} TICKS
            </div>
          </div>
        )}

        {/* Proximity Radar Warning Banner (Warzone DMZ Style) */}
        {proximityAlert.active ? (
          <div
            className="proximity-warning-banner"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'rgba(239, 68, 68, 0.2)',
              border: '2px solid var(--alert-crimson)',
              padding: '8px 24px',
              borderRadius: '8px',
              color: '#fff',
              fontFamily: 'monospace',
              fontWeight: 800,
              fontSize: '14px',
              backdropFilter: 'blur(10px)',
            }}
          >
            <AlertTriangle size={20} color="var(--alert-crimson)" />
            <span>
              &para; HOSTILE OPERATOR SQUAD DETECTED [BEARING {proximityAlert.bearing}&deg; // {proximityAlert.distance}m]
            </span>
            {proximityAlert.isRogueAI && (
              <span className="tactical-badge badge-amber">ROGUE AI OPERATOR</span>
            )}
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(16, 21, 31, 0.6)',
              border: '1px solid var(--border-color)',
              padding: '4px 16px',
              borderRadius: '6px',
              color: 'var(--text-muted)',
              fontSize: '12px',
              fontFamily: 'monospace',
            }}
          >
            <Radio size={14} color="var(--exfil-green)" />
            <span>PROXIMITY: ALL CLEAR (&gt; 60m)</span>
          </div>
        )}

        {/* Exfil Hold Countdown Ring / Notice OR Damage Interruption Notice */}
        {(isHoldingLZ && !recentInterruption) ? (
          <div
            className="exfil-hold-banner"
            style={{
              background: "rgba(34, 197, 94, 0.2)",
              border: "2px solid var(--exfil-green)",
              borderRadius: "8px",
              padding: "10px 24px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
              backdropFilter: "blur(8px)",
            }}
          >
            <div style={{ color: "var(--exfil-green)", fontWeight: 800, fontSize: "15px", fontFamily: "monospace" }}>
              HOLDING EXTRACTION LZ: {holdTicks} / {SIM_CONFIG.EXFIL_HOLD_TICKS} TICKS ({(holdTicks / 60).toFixed(1)}s / 3.0s)
            </div>
            <div style={{ fontSize: "11px", color: "#fff" }}>
              DO NOT TAKE DAMAGE OR EXIT SMOKE BEACON
            </div>
          </div>
        ) : (showResetBanner) ? (
          <div
            className="exfil-reset-banner"
            style={{
              background: "rgba(239, 68, 68, 0.25)",
              border: "2px solid var(--alert-crimson)",
              borderRadius: "8px",
              padding: "10px 24px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
              backdropFilter: "blur(8px)",
            }}
          >
            <div style={{ color: "var(--alert-crimson)", fontWeight: 800, fontSize: "15px", fontFamily: "monospace" }}>
              DAMAGE INTERRUPTION — HOLD RESET: {holdTicks} / {SIM_CONFIG.EXFIL_HOLD_TICKS} TICKS
            </div>
            <div style={{ fontSize: "11px", color: "#fca5a5" }}>
              {holdTicks > 0 ? `HOLD RESTARTED — CURRENT PROGRESS ${holdTicks} / ${SIM_CONFIG.EXFIL_HOLD_TICKS} TICKS` : "COMBAT HIT RESET EXTRACTION COUNTER TO ZERO"}
            </div>
          </div>
        ) : null}
      </div>

      {/* Bottom Bar: Health, Armor, Actions, Ammo, and Scavenged Loot */}
      <div className="tactical-bottom-bar">
        {/* Bottom Left: Vitals & Kinetic Action States */}
        <div className="tactical-vitals-column">
          {/* Armor Bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px', fontWeight: 700 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--tactical-cyan)' }}>
                <Shield size={14} /> ARMOR PLATES
              </span>
              <span>{player.armor} / 100</span>
            </div>
            <div style={{ height: '8px', background: '#1e293b', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${player.armor}%`,
                  height: '100%',
                  background: 'var(--tactical-cyan)',
                  transition: 'width 0.15s ease',
                }}
              />
            </div>
          </div>

          {/* Health Bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px', fontWeight: 700 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: player.health > 40 ? 'var(--exfil-green)' : 'var(--alert-crimson)' }}>
                <Heart size={14} /> OPERATIVE HEALTH
              </span>
              <span>{player.health} / 100</span>
            </div>
            <div style={{ height: '8px', background: '#1e293b', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${player.health}%`,
                  height: '100%',
                  background: player.health > 40 ? 'var(--exfil-green)' : 'var(--alert-crimson)',
                  transition: 'width 0.15s ease',
                }}
              />
            </div>
          </div>

          {/* Kinetic Controls & Action Pills */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
            <span
              className={`tactical-badge ${player.action === 'sprint' ? 'badge-cyan' : ''}`}
              style={{ background: player.action === 'sprint' ? undefined : 'rgba(16, 21, 31, 0.7)' }}
            >
              [SHIFT] SPRINT
            </span>
            <span
              className={`tactical-badge ${isSlidingActive ? 'badge-cyan' : ''}`}
              style={{ background: isSlidingActive ? undefined : 'rgba(16, 21, 31, 0.7)' }}
            >
              [C] CROUCH / [SHIFT+C] SLIDE
            </span>
            <span
              className={`tactical-badge ${player.action === 'roll' ? 'badge-green' : ''}`}
              style={{ background: player.action === 'roll' ? undefined : 'rgba(16, 21, 31, 0.7)' }}
            >
              [SPACE] JUMP / [SHIFT+SPACE] ROLL
            </span>
            <span
              className={`tactical-badge ${player.action === 'kick' ? 'badge-amber' : ''}`}
              style={{ background: player.action === 'kick' ? undefined : 'rgba(16, 21, 31, 0.7)' }}
            >
              [F] KICK
            </span>
          </div>
        </div>

        {/* Bottom Center: Combat Log Ticker */}
        <div className="tactical-combat-log">
          {sim.combatLog.slice(-3).map((log, idx) => (
            <div key={idx} style={{ background: 'rgba(9, 12, 16, 0.7)', padding: '2px 8px', borderRadius: '4px' }}>
              {log}
            </div>
          ))}
        </div>

        {/* Bottom Right: Ammo & Scavenged Cash */}
        <div className="tactical-ammo-cash">
          {/* Tactical Weapon Selector & Combat Loadout */}
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <div
              style={{
                background: player.action === "kick" ? "rgba(16, 21, 31, 0.85)" : "rgba(6, 182, 212, 0.2)",
                border: player.action === "kick" ? "1px solid #334155" : "1px solid var(--tactical-cyan)",
                borderRadius: "6px",
                padding: "6px 10px",
                fontSize: "11px",
                fontFamily: "monospace",
                fontWeight: 700,
                color: player.action === "kick" ? "#94a3b8" : "var(--tactical-cyan)",
              }}
            >
              [L-CLICK / J] M4 RIFLE (35M)
            </div>
            <div
              style={{
                background: player.action === "kick" ? "rgba(245, 158, 11, 0.25)" : "rgba(16, 21, 31, 0.85)",
                border: player.action === "kick" ? "1px solid #f59e0b" : "1px solid #334155",
                borderRadius: "6px",
                padding: "6px 10px",
                fontSize: "11px",
                fontFamily: "monospace",
                fontWeight: 700,
                color: player.action === "kick" ? "#f59e0b" : "#94a3b8",
              }}
            >
              [F] KICK (2.5M)
            </div>
          </div>
          {/* Scavenged Cash */}
          <div
            style={{
              background: 'rgba(16, 21, 31, 0.85)',
              border: '1px solid var(--border-color)',
              padding: '10px 18px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <DollarSign size={20} color="var(--loot-amber)" />
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                CASH SCAVENGED
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--loot-amber)', fontFamily: 'monospace' }}>
                ${player.cash.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Ammo Status */}
          <div
            style={{
              background: 'rgba(16, 21, 31, 0.85)',
              border: '1px solid var(--border-color)',
              padding: '10px 18px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <Crosshair size={22} color="var(--tactical-cyan)" />
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                TACTICAL RIFLE
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#fff', fontFamily: 'monospace' }}>
                {player.ammo} <span style={{ fontSize: '13px', color: 'var(--text-dim)' }}>/ {player.maxAmmo}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
