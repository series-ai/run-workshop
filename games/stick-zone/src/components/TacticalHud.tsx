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
import type { SectorDepotSimulation } from '../sim/game.js';
import { SIM_CONFIG } from '../sim/config.js';

interface TacticalHudProps {
  sim: SectorDepotSimulation;
}

export const TacticalHud: React.FC<TacticalHudProps> = ({ sim }) => {
  const { player, proximityAlert, exfilController, tick } = sim;

  // Formatting match time
  const remainingTicks = Math.max(0, SIM_CONFIG.RAID_DEADLINE_TICK - tick);
  const totalSeconds = Math.floor(remainingTicks / SIM_CONFIG.TICKS_PER_SECOND);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const timeFormatted = `${minutes}:${String(seconds).padStart(2, '0')}`;

  const exfilState = exfilController.getState();
  const isHoldingLZ = exfilState.kind === 'holding_zone';
  const holdTicks = isHoldingLZ ? exfilState.currentTicks : 0;

  return (
    <div className="hud-layer">
      {/* Top Header: Compass, Proximity Radar Banner & Match Timer */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'flex-start' }}>
          {/* Top Left: Sector & Squad Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span className="tactical-badge badge-cyan">SECTOR 7 DEPOT</span>
              <span className="tactical-badge badge-green">{player.badge}</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-dim)', fontFamily: 'monospace' }}>
              60 HZ SYNCHUB DETERMINISTIC AIRLOCK &bull; MULTI-SQUAD
            </div>
          </div>

          {/* Top Center: Compass Bar */}
          <div className="compass-bar">
            <Compass size={16} color="var(--tactical-cyan)" />
            <span>N</span>
            <span style={{ color: 'var(--text-dim)' }}>&bull;</span>
            <span>045&deg; NE</span>
            <span style={{ color: 'var(--text-dim)' }}>&bull;</span>
            <span style={{ color: 'var(--tactical-cyan)' }}>090&deg; E</span>
            <span style={{ color: 'var(--text-dim)' }}>&bull;</span>
            <span>180&deg; S</span>
            <span style={{ color: 'var(--text-dim)' }}>&bull;</span>
            <span>270&deg; W</span>
          </div>

          {/* Top Right: Match Deadline Countdown */}
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
        </div>

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

        {/* Exfil Hold Countdown Ring / Notice */}
        {isHoldingLZ && (
          <div
            style={{
              background: 'rgba(34, 197, 94, 0.2)',
              border: '2px solid var(--exfil-green)',
              borderRadius: '8px',
              padding: '10px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              backdropFilter: 'blur(8px)',
            }}
          >
            <div style={{ color: 'var(--exfil-green)', fontWeight: 800, fontSize: '15px', fontFamily: 'monospace' }}>
              HOLDING EXTRACTION LZ: {holdTicks} / {SIM_CONFIG.EXFIL_HOLD_TICKS} TICKS ({(holdTicks / 60).toFixed(1)}s / 3.0s)
            </div>
            <div style={{ fontSize: '11px', color: '#fff' }}>
              DO NOT TAKE DAMAGE OR EXIT SMOKE BEACON
            </div>
          </div>
        )}
      </div>

      {/* Bottom Bar: Health, Armor, Actions, Ammo, and Scavenged Loot */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%' }}>
        {/* Bottom Left: Vitals & Kinetic Action States */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '280px' }}>
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
              className={`tactical-badge ${player.action === 'slide' ? 'badge-cyan' : ''}`}
              style={{ background: player.action === 'slide' ? undefined : 'rgba(16, 21, 31, 0.7)' }}
            >
              [C] SLIDE
            </span>
            <span
              className={`tactical-badge ${player.action === 'roll' ? 'badge-green' : ''}`}
              style={{ background: player.action === 'roll' ? undefined : 'rgba(16, 21, 31, 0.7)' }}
            >
              [SPACE] ROLL (IFRAMES)
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
        <div
          style={{
            maxWidth: '380px',
            fontSize: '11px',
            fontFamily: 'monospace',
            color: 'var(--text-muted)',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          {sim.combatLog.slice(-3).map((log, idx) => (
            <div key={idx} style={{ background: 'rgba(9, 12, 16, 0.7)', padding: '2px 8px', borderRadius: '4px' }}>
              {log}
            </div>
          ))}
        </div>

        {/* Bottom Right: Ammo & Scavenged Cash */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
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
