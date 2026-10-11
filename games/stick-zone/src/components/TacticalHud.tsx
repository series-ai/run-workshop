import React, { useState, useEffect, useRef, useMemo } from "react";
import { type SectorDepotSimulation, DEPOT_CONTAINERS } from "../sim/game.js";
import { SIM_CONFIG } from "../sim/config.js";
import { sound } from "../audio.js";
import { useStashStore } from "../progression/stashStore.js";

interface TacticalHudProps {
  sim: SectorDepotSimulation;
  onOpenHideout?: () => void;
  onTriggerKick?: () => void;
}

/* =========================================================================
   CLEAN VECTOR SILHOUETTE ICONS (Zero external dependencies)
   ========================================================================= */

const ShotgunIcon: React.FC<{ active?: boolean }> = ({ active }) => (
  <svg viewBox="0 0 48 16" width="36" height="12" fill={active ? "#ffffff" : "#94a3b8"}>
    {/* Pump shotgun silhouette */}
    <path d="M2 11 L10 11 L14 8 L38 8 L38 6 L46 6 L46 9 L40 9 L40 10 L28 10 L26 12 L16 12 L12 14 L2 14 Z" />
    <rect x="22" y="11" width="8" height="2" rx="0.5" fill={active ? "#f8fafc" : "#64748b"} />
  </svg>
);

const RifleIcon: React.FC<{ active?: boolean }> = ({ active }) => (
  <svg viewBox="0 0 48 18" width="36" height="14" fill={active ? "#ffffff" : "#94a3b8"}>
    {/* Carbine rifle silhouette with magazine */}
    <path d="M2 12 L8 12 L12 9 L22 9 L22 14 L26 14 L26 9 L44 9 L44 7 L46 7 L46 10 L44 10 L42 10 L40 11 L28 11 L24 16 L20 16 L18 11 L10 11 L6 14 L2 14 Z" />
    <rect x="14" y="5" width="6" height="3" rx="0.5" fill={active ? "#38bdf8" : "#475569"} />
  </svg>
);

const FistIcon: React.FC<{ active?: boolean }> = ({ active }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill={active ? "#ffffff" : "#94a3b8"}>
    {/* Clenched strike fist / martial arts kick */}
    <path d="M6 5 C6 3.9 6.9 3 8 3 L14 3 C15.1 3 16 3.9 16 5 L16 7 L18 7 C19.1 7 20 7.9 20 9 L20 14 C20 17.3 17.3 20 14 20 L10 20 C6.7 20 4 17.3 4 14 L4 9 C4 7.9 4.9 7 6 7 L6 5 Z M8 5 L8 7 L14 7 L14 5 Z" />
  </svg>
);

const GrenadeIcon: React.FC<{ active?: boolean }> = ({ active }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill={active ? "#ffffff" : "#10b981"}>
    {/* Fragmentation grenade */}
    <path d="M12 2 C10.9 2 10 2.9 10 4 L14 4 C14 2.9 13.1 2 12 2 Z M10 5 L14 5 L15 7 L9 7 Z M7 9 C6.4 9 6 9.4 6 10 L6 17 C6 19.8 8.2 22 11 22 L13 22 C15.8 22 18 19.8 18 17 L18 10 C18 9.4 17.6 9 17 9 Z" />
  </svg>
);

const HelmetIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="#cbd5e1">
    <path d="M12 3 C6.5 3 2 7.5 2 13 C2 15 3 16 5 16 L6 16 L6 18 C6 19.1 6.9 20 8 20 L10 20 L10 16 L14 16 L14 20 L16 20 C17.1 20 18 19.1 18 18 L18 16 L19 16 C21 16 22 15 22 13 C22 7.5 17.5 3 12 3 Z" />
  </svg>
);

const VestIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="#38bdf8">
    <path d="M6 3 L10 3 L11 7 L13 7 L14 3 L18 3 L20 9 L18 11 L18 20 L6 20 L6 11 L4 9 Z M9 10 L15 10 L15 13 L9 13 Z M9 15 L15 15 L15 18 L9 18 Z" />
  </svg>
);

const BackpackIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="#f59e0b">
    <path d="M8 3 C8 1.9 8.9 1 10 1 L14 1 C15.1 1 16 1.9 16 3 L19 3 C20.1 3 21 3.9 21 5 L21 19 C21 20.7 19.7 22 18 22 L6 22 C4.3 22 3 20.7 3 19 L3 5 C3 3.9 3.9 3 5 3 Z M7 8 L17 8 L17 14 L7 14 Z M7 16 L17 16 L17 20 L7 20 Z" />
  </svg>
);

/* =========================================================================
   SURVIV.IO STYLE MOVING MINIMAP (60 FPS Canvas-Driven)
   ========================================================================= */

const SurvivMinimap: React.FC<{ sim: SectorDepotSimulation }> = ({ sim }) => {
  const [zoomLevel, setZoomLevel] = useState<1 | 2>(1); // 1 = 42m radius, 2 = 75m radius
  const zoomLevelRef = useRef<1 | 2>(zoomLevel);
  zoomLevelRef.current = zoomLevel;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const coordsRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const center = width / 2; // 88px

    const render = () => {
      const isPaused =
        typeof window !== "undefined" &&
        Boolean((window as any).__STICK_ZONE_TEST__?.isPaused);

      if (!isPaused) {
        const player = sim.player;
        const currentZoom = zoomLevelRef.current;
        const radarRadius = currentZoom === 1 ? 42 : 75;
        const pxPerMeter = center / radarRadius;

        // Update footer coords text directly without React re-render
        if (coordsRef.current) {
          coordsRef.current.textContent = `${Math.round(player.x)}, ${Math.round(player.z)}`;
        }

        ctx.clearRect(0, 0, width, height);

        // 1. Tactical dark background
        ctx.fillStyle = "rgba(15, 23, 42, 0.94)";
        ctx.fillRect(0, 0, width, height);

        // 2. Smooth scrolling terrain grid lines (12m cells)
        const gridCellPx = 12 * pxPerMeter;
        const gridOffsetX = ((-player.x * pxPerMeter) % gridCellPx + gridCellPx) % gridCellPx;
        const gridOffsetY = ((-player.z * pxPerMeter) % gridCellPx + gridCellPx) % gridCellPx;

        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = gridOffsetX; x <= width; x += gridCellPx) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
        }
        for (let y = gridOffsetY; y <= height; y += gridCellPx) {
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
        }
        ctx.stroke();

        // 3. Cargo containers relative to player
        for (const box of DEPOT_CONTAINERS) {
          const x1 = center + (box.minX - player.x) * pxPerMeter;
          const y1 = center + (box.minZ - player.z) * pxPerMeter;
          const w = (box.maxX - box.minX) * pxPerMeter;
          const h = (box.maxZ - box.minZ) * pxPerMeter;

          // Cull out of bounds
          if (x1 + w < -10 || x1 > width + 10 || y1 + h < -10 || y1 > height + 10) continue;

          ctx.fillStyle = "rgba(51, 65, 85, 0.78)";
          ctx.fillRect(x1, y1, w, h);
          ctx.strokeStyle = "rgba(148, 163, 184, 0.65)";
          ctx.lineWidth = 1.2;
          ctx.strokeRect(x1, y1, w, h);
        }

        // 4. Supply Crates (golden diamonds/dots)
        for (const c of sim.crates) {
          if (c.opened) continue;
          const cx = center + (c.x - player.x) * pxPerMeter;
          const cy = center + (c.z - player.z) * pxPerMeter;
          if (cx < 4 || cx > width - 4 || cy < 4 || cy > height - 4) continue;

          ctx.fillStyle = "#fbbf24";
          ctx.beginPath();
          ctx.arc(cx, cy, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // 5. Enemy Scavs and Boss Contacts
        for (const r of sim.rivals) {
          if (!r.isAlive || r.isExtracted) continue;
          const rx = center + (r.x - player.x) * pxPerMeter;
          const ry = center + (r.z - player.z) * pxPerMeter;
          if (rx < 4 || rx > width - 4 || ry < 4 || ry > height - 4) continue;

          const isBoss = r.id === "scav_boss_warlord" || /boss|warlord/i.test(r.name);
          if (isBoss) {
            // Boss: Crimson dot + outer ring
            ctx.fillStyle = "#ef4444";
            ctx.beginPath();
            ctx.arc(rx, ry, 4.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#f87171";
            ctx.lineWidth = 1.5;
            ctx.stroke();
          } else {
            // Scav: Orange dot
            ctx.fillStyle = "#f97316";
            ctx.beginPath();
            ctx.arc(rx, ry, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }

        // 6. Extraction Points: In-View or Clamped to Edge
        const isHub = sim.zoneMode === "hub";
        const exfilSites = isHub
          ? [{ id: "airlock", name: "AIRLOCK", x: 0, z: -52, color: "#38bdf8" }]
          : [
              { id: "lz1", name: "LZ-1", x: 45, z: 45, color: "#10b981" },
              { id: "bnk", name: "BNK", x: -45, z: -45, color: "#c084fc" },
              { id: "fob", name: "FOB", x: 0, z: -48, color: "#38bdf8" },
            ];

        for (const site of exfilSites) {
          const dx = site.x - player.x;
          const dz = site.z - player.z;
          const dist = Math.hypot(dx, dz);
          const rawX = center + dx * pxPerMeter;
          const rawY = center + dz * pxPerMeter;

          const isInside = rawX >= 16 && rawX <= width - 16 && rawY >= 16 && rawY <= height - 16;
          if (isInside) {
            // Draw in-bounds pin
            ctx.fillStyle = site.color;
            ctx.beginPath();
            ctx.arc(rawX, rawY, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.font = "900 9px monospace";
            ctx.fillStyle = site.color;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillText(site.name, rawX, rawY + 6);
          } else {
            // Clamped edge pointer with distance
            const angle = Math.atan2(dz, dx);
            const clampRadius = center - 14;
            const edgeX = center + Math.cos(angle) * clampRadius;
            const edgeY = center + Math.sin(angle) * clampRadius;

            // Draw small directional triangle
            ctx.save();
            ctx.translate(edgeX, edgeY);
            ctx.rotate(angle);
            ctx.fillStyle = site.color;
            ctx.beginPath();
            ctx.moveTo(6, 0);
            ctx.lineTo(-4, -4);
            ctx.lineTo(-4, 4);
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            // Distance label
            ctx.font = "800 8.5px monospace";
            ctx.fillStyle = site.color;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const textRadius = clampRadius - 10;
            ctx.fillText(`${Math.round(dist)}m`, center + Math.cos(angle) * textRadius, center + Math.sin(angle) * textRadius);
          }
        }

        // 7. Central Player Marker & Sight Cone
        // Forward vector in 3D: forwardX = sin(facing), forwardZ = cos(facing)
        const aimDirX = Math.sin(player.facing);
        const aimDirY = Math.cos(player.facing);

        // Sight FOV cone
        ctx.fillStyle = "rgba(56, 189, 248, 0.18)";
        ctx.beginPath();
        ctx.moveTo(center, center);
        const halfFov = 0.45; // ~26 degrees
        const coneLen = 28;
        const leftAngle = player.facing - halfFov;
        const rightAngle = player.facing + halfFov;
        ctx.lineTo(center + Math.sin(leftAngle) * coneLen, center + Math.cos(leftAngle) * coneLen);
        ctx.arc(
          center,
          center,
          coneLen,
          Math.atan2(Math.cos(leftAngle), Math.sin(leftAngle)),
          Math.atan2(Math.cos(rightAngle), Math.sin(rightAngle)),
          false
        );
        ctx.closePath();
        ctx.fill();

        // Forward aim line
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(center, center);
        ctx.lineTo(center + aimDirX * 18, center + aimDirY * 18);
        ctx.stroke();

        // Player core dot
        ctx.fillStyle = "#38bdf8";
        ctx.beginPath();
        ctx.arc(center, center, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(center, center, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [sim]);

  return (
    <div className="surviv-minimap-root">
      {/* North Compass Indicator */}
      <div className="surviv-minimap-compass-n">N</div>

      {/* Viewport 2D Canvas */}
      <div className="surviv-minimap-viewport">
        <canvas
          ref={canvasRef}
          width={176}
          height={176}
          style={{ width: "100%", height: "100%", display: "block" }}
        />
      </div>

      {/* Minimap Footer Controls */}
      <div className="surviv-minimap-footer">
        <button
          onClick={() => setZoomLevel((z) => (z === 1 ? 2 : 1))}
          className="surviv-minimap-zoom-btn"
          title="Toggle Minimap Zoom [1x / 2x]"
        >
          🔍 {zoomLevel}x
        </button>
        <span ref={coordsRef} className="surviv-minimap-coords">
          {Math.round(sim.player.x)}, {Math.round(sim.player.z)}
        </span>
      </div>
    </div>
  );
};

/* =========================================================================
   MAIN TACTICAL HUD
   ========================================================================= */

export const TacticalHud: React.FC<TacticalHudProps> = React.memo(
  ({ sim, onOpenHideout, onTriggerKick }) => {
    const { player, tick, exfilController } = sim;
    const loadout = useStashStore((s) => s.loadout);

    // Throttled refresh (10Hz) to prevent React render spikes
    const [, setTickCounter] = useState(0);
    useEffect(() => {
      const timer = setInterval(() => setTickCounter((t) => t + 1), 100);
      return () => clearInterval(timer);
    }, []);

    const exfilState = exfilController.getState();
    const isHoldingLZ = exfilState.kind === "holding_zone";
    const holdTicks = isHoldingLZ && "currentTicks" in exfilState ? (exfilState as any).currentTicks : 0;
    const remainingHoldSeconds = isHoldingLZ
      ? Math.max(0, (SIM_CONFIG.EXFIL_HOLD_TICKS - holdTicks) / 60).toFixed(1)
      : "0.0";

    const remainingTicks = Math.max(0, SIM_CONFIG.RAID_DEADLINE_TICK - tick);
    const totalSeconds = Math.floor(remainingTicks / SIM_CONFIG.TICKS_PER_SECOND);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const timeFormatted = `${minutes}:${seconds.toString().padStart(2, "0")}`;

    const nearbyCrate = sim.crates.find(
      (c) => !c.opened && Math.hypot(player.x - c.x, player.z - c.z) <= 4.0
    );

    // Active AI + Player count for surviv.io top-right alive badge
    const aliveScavs = sim.rivals.filter((r) => r.isAlive && !r.isExtracted).length;
    const aliveTotal = aliveScavs + (player.isAlive ? 1 : 0);

    const isShotgunActive = player.weapon === "shotgun";
    const isRifleActive = player.weapon === "rifle";
    const isFistsActive = player.weapon === "fists";
    const isGrenadeActive = player.weapon === "grenade";

    const currentAmmo = player.ammo;
    const currentReserve =
      player.weapon === "shotgun"
        ? player.reserveShotgunAmmo ?? 24
        : player.reserveRifleAmmo ?? 90;

    return (
      <div className="surviv-hud-root">
        {/* Top-Left: Clean Utility Bar (Arsenal & Leave) */}
        <div className="surviv-top-left">
          {onOpenHideout && (
            <button
              onClick={onOpenHideout}
              className="surviv-btn-pill"
              title="Open Stash, Armory & Trader [TAB]"
            >
              ARSENAL [TAB]
            </button>
          )}
          {sim.zoneMode === "spoke" && (
            <span className="surviv-zone-badge">SECTOR 7 DEPOT</span>
          )}
        </div>

        {/* Top-Right: Clean Alive Count & Raid Clock (Surviv.io Style) */}
        <div className="surviv-top-right">
          <div className="surviv-alive-card">
            <span className="alive-count">{aliveTotal}</span>
            <span className="alive-label">ALIVE</span>
          </div>
          <div className="surviv-clock-badge">
            <span className="clock-icon">⏱</span>
            <span>{timeFormatted}</span>
          </div>
        </div>

        {/* Directional Screen Damage Arcs (Flashing only upon taking damage) */}
        {sim.damageIndicators.length > 0 && (
          <div className="directional-damage-container" aria-hidden="true">
            {sim.damageIndicators.map((indicator) => {
              const ageTicks = sim.tick - indicator.tick;
              if (ageTicks < 0 || ageTicks >= 80) return null;
              const opacity = Math.max(0, 1 - ageTicks / 75);
              return (
                <div
                  key={indicator.id}
                  className="directional-damage-indicator"
                  style={{
                    transform: `translate(-50%, -50%) rotate(${indicator.angleDeg}deg)`,
                    opacity,
                  }}
                >
                  <svg viewBox="0 0 160 60" width="160" height="60">
                    <path
                      d="M 12 48 Q 80 8 148 48"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="6"
                      strokeLinecap="round"
                    />
                    <polygon points="80,10 68,26 80,21 92,26" fill="#ef4444" />
                  </svg>
                </div>
              );
            })}
          </div>
        )}

        {/* Directional Damage Flash Vignette */}
        {sim.lastPlayerDamageTick > 0 && sim.tick - sim.lastPlayerDamageTick < 12 && (
          <div className="damage-flash-vignette" />
        )}

        {/* Bottom-Left: Moving Mini Map */}
        <SurvivMinimap sim={sim} />

        {/* Mid-Bottom: Health, Armor & Ammo Counter */}
        <div className="surviv-mid-bottom">
          {/* Active Action / Stim / Extraction Countdown Channel */}
          {isHoldingLZ && (
            <div className="surviv-action-channel">
              <span className="channel-spinner" />
              <span>EXTRACTING LZ-1: {remainingHoldSeconds}s</span>
            </div>
          )}

          {/* Arterial Bleeding Warning */}
          {player.isBleeding && (
            <div className="surviv-bleed-alert">
              <span>🩸 ARTERIAL BLEEDING — PRESS [H] TO STIM</span>
            </div>
          )}

          {/* Ammo Counter Pill directly above health bar */}
          <div className="surviv-ammo-row">
            {player.weapon === "fists" ? (
              <>
                <span className="surviv-clip-ammo" style={{ fontSize: "20px", color: "#f59e0b" }}>KICK</span>
                <span className="surviv-reserve-ammo">35 DMG</span>
              </>
            ) : player.weapon === "grenade" ? (
              <>
                <span className="surviv-clip-ammo" style={{ fontSize: "22px", color: "#10b981" }}>x{player.fragGrenades ?? 2}</span>
                <span className="surviv-reserve-ammo">/ 2 FRAG</span>
              </>
            ) : (
              <>
                <span className="surviv-clip-ammo">{currentAmmo}</span>
                <span className="surviv-reserve-ammo">/ {currentReserve}</span>
              </>
            )}
          </div>

          {/* Armor Bar */}
          <div className="surviv-armor-track">
            <div
              className="surviv-armor-fill"
              style={{ width: `${Math.max(0, Math.min(100, player.armor))}%` }}
            />
          </div>

          {/* Health Bar (Vibrant surviv.io rounded coral pill) */}
          <div className="surviv-health-track">
            <div
              className={`surviv-health-fill ${player.health < 30 ? "critical" : ""}`}
              style={{ width: `${Math.max(0, Math.min(100, player.health))}%` }}
            />
            <span className="surviv-health-text">
              {Math.round(player.health)} / 100
            </span>
          </div>
        </div>

        {/* Bottom-Right: Weapon Choices & Quick Swap */}
        <div className="surviv-bottom-right">
          {/* Weapon Slots Stack */}
          <div className="surviv-weapon-slots">
            {/* Slot 1: Shotgun */}
            <div
              onClick={() => {
                sim.setWeapon("shotgun");
                sound.playReload();
              }}
              className={`surviv-weapon-slot ${isShotgunActive ? "active" : ""}`}
              title="Equip M590 Breacher Shotgun [1]"
            >
              <div className="slot-key">1</div>
              <ShotgunIcon active={isShotgunActive} />
              <div className="slot-info">
                <span className="slot-name">M590</span>
                <span className="slot-ammo">
                  {player.shotgunAmmo || 0} / {player.reserveShotgunAmmo || 0}
                </span>
              </div>
            </div>

            {/* Slot 2: Assault Rifle */}
            <div
              onClick={() => {
                sim.setWeapon("rifle");
                sound.playReload();
              }}
              className={`surviv-weapon-slot ${isRifleActive ? "active" : ""}`}
              title="Equip M4A1 Tactical Rifle [2]"
            >
              <div className="slot-key">2</div>
              <RifleIcon active={isRifleActive} />
              <div className="slot-info">
                <span className="slot-name">M4A1</span>
                <span className="slot-ammo">
                  {player.rifleAmmo || 0} / {player.reserveRifleAmmo || 0}
                </span>
              </div>
            </div>

            {/* Slot 3: Melee / Kick */}
            <div
              onClick={() => {
                sim.setWeapon("fists");
                sound.playKick();
              }}
              className={`surviv-weapon-slot ${isFistsActive ? "active" : ""}`}
              title="Equip Melee Fists & Kicks [3]"
            >
              <div className="slot-key">3</div>
              <FistIcon active={isFistsActive} />
              <div className="slot-info">
                <span className="slot-name">KICK</span>
                <span className="slot-ammo" style={{ color: "#f59e0b" }}>35 DMG</span>
              </div>
            </div>

            {/* Slot 4: Frag Grenade */}
            <div
              onClick={() => {
                sim.setWeapon("grenade");
              }}
              className={`surviv-weapon-slot ${isGrenadeActive ? "active" : ""}`}
              title="Equip Frag Grenade [4 / G]"
            >
              <div className="slot-key">4</div>
              <GrenadeIcon active={isGrenadeActive} />
              <div className="slot-info">
                <span className="slot-name">FRAG</span>
                <span className="slot-ammo" style={{ color: "#10b981" }}>x${player.fragGrenades ?? 2}</span>
              </div>
            </div>
          </div>

          {/* Gear Tiers & Tactical Accessories */}
          <div className="surviv-gear-row">
            <div className="surviv-gear-item" title="Ballistic Helmet Lvl 2">
              <HelmetIcon />
              <span>Lvl. 2</span>
            </div>
            <div className="surviv-gear-item" title={`Tactical Vest Lvl ${loadout?.armorTier === "light" ? 1 : loadout?.armorTier === "heavy" ? 3 : 2}`}>
              <VestIcon />
              <span>Lvl. {loadout?.armorTier === "light" ? 1 : loadout?.armorTier === "heavy" ? 3 : 2}</span>
            </div>
            <div className="surviv-gear-item" title="Assault Rucksack Lvl 2">
              <BackpackIcon />
              <span>Lvl. 2</span>
            </div>
            <button
              onClick={() => {
                const isLaserOn = sim.toggleLaser();
                sound.playFlashlightClick(isLaserOn);
              }}
              className={`surviv-gear-btn ${player.hasLaser ? "active" : ""}`}
              title="Toggle Tactical Laser [T]"
            >
              LASER [T]
            </button>
            <button
              onClick={() => {
                const isLightOn = sim.toggleFlashlight();
                sound.playFlashlightClick(isLightOn);
              }}
              className={`surviv-gear-btn ${(player.isFlashlightOn ?? true) ? "active" : ""}`}
              title="Toggle Tactical Flashlight [L]"
            >
              LIGHT [L]
            </button>
          </div>
        </div>

        {/* Right Rail: Consumables, Ammunition & Loot */}
        <div className="surviv-right-rail">
          {/* Quick Loot Overlay (Docks into top of right rail) */}
          {nearbyCrate && (
            <div className="surviv-quick-loot-card">
              <div className="loot-card-header">
                <span>📦 {nearbyCrate.containerTitle || "SUPPLY CACHE"}</span>
                <span className="loot-card-cash">+$${nearbyCrate.cashValue.toLocaleString()}</span>
              </div>
              <button
                onClick={() => {
                  sim.requestLootCrate(nearbyCrate.id);
                  sound.playLootChime();
                }}
                className="surviv-loot-action-btn"
              >
                QUICK LOOT ALL [E / F]
              </button>
            </div>
          )}

          {/* Consumables Inventory */}
          <div className="surviv-rail-section">
            <div className="rail-item" title="Bandages">
              <span className="rail-icon">🩹</span>
              <span className="rail-count">3</span>
            </div>
            <div className="rail-item" title="First Aid Medkit">
              <span className="rail-icon">🧰</span>
              <span className="rail-count">1</span>
            </div>
            <div
              onClick={() => {
                if (sim.useStim()) sound.playHealInject();
              }}
              className="rail-item stim-item"
              title="Combat Stim Injector [H] (Click to Inject)"
            >
              <span className="rail-icon">💉</span>
              <span className="rail-count">{player.stimsRemaining || 0}</span>
            </div>
            <div className="rail-item" title="Tourniquet / Splint">
              <span className="rail-icon">💊</span>
              <span className="rail-count">1</span>
            </div>
          </div>

          {/* Ammunition Blocks */}
          <div className="surviv-rail-section ammo-section">
            <div className="ammo-chip rifle-chip" title="5.56x45mm NATO Ammo Stock">
              <span className="ammo-num">
                {(player.reserveRifleAmmo || 0) + (player.rifleAmmo || 0)}
              </span>
            </div>
            <div className="ammo-chip shotgun-chip" title="12-Gauge Buckshot Stock">
              <span className="ammo-num">
                {(player.reserveShotgunAmmo || 0) + (player.shotgunAmmo || 0)}
              </span>
            </div>
          </div>

          {/* Scavenged Cash Secured */}
          <div className="surviv-rail-cash" title="Secured Raid Cash">
            <span>$${player.cash.toLocaleString()}</span>
          </div>

          {/* Keycard Badge if secured */}
          {player.hasKeycard && (
            <div className="surviv-rail-keycard" title="Violet Lab Access Keycard Secured!">
              <span>💳 LAB KEY</span>
            </div>
          )}
        </div>
      </div>
    );
  }
);
