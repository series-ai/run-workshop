/**
 * @file MobileControls.tsx
 * High-performance virtual touch dual-joystick and tactical button interface for mobile & tablet.
 */

import React, { useRef, useState } from "react";
import type { SectorDepotSimulation } from "../sim/game.js";
import { sound } from "../audio.js";

export interface TouchInputUpdate {
  dx?: number;
  dz?: number;
  aimAngle?: number;
  shoot?: boolean;
  sprint?: boolean;
  slide?: boolean;
  roll?: boolean;
  kick?: boolean;
  interact?: boolean;
  ads?: boolean;
}

interface MobileControlsProps {
  sim: SectorDepotSimulation;
  onTouchInput: (input: TouchInputUpdate) => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({ sim, onTouchInput }) => {
  const [touchAimActive, setTouchAimActive] = useState(false);
  const [adsActive, setAdsActive] = useState(false);

  // Left Dpad state
  const dpadTouchId = useRef<number | null>(null);
  const dpadOrigin = useRef<{ x: number; y: number } | null>(null);
  const [stickPos, setStickPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Right Aim/Fire state
  const aimTouchId = useRef<number | null>(null);
  const aimOrigin = useRef<{ x: number; y: number } | null>(null);

  const triggerHaptic = (ms = 15) => {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(ms);
      }
    } catch {}
  };

  const handleDpadStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (dpadTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    dpadTouchId.current = touch.identifier;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    dpadOrigin.current = { x: cx, y: cy };
    handleDpadMove(e);
  };

  const handleDpadMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (dpadTouchId.current === null || !dpadOrigin.current) return;
    let targetTouch: React.Touch | null = null;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === dpadTouchId.current) {
        targetTouch = e.changedTouches[i];
        break;
      }
    }
    if (!targetTouch) return;

    const dxRaw = targetTouch.clientX - dpadOrigin.current.x;
    const dyRaw = targetTouch.clientY - dpadOrigin.current.y;
    const dist = Math.hypot(dxRaw, dyRaw);
    const maxRadius = 45;
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dyRaw, dxRaw);

    const nx = Math.cos(angle) * (clampedDist / maxRadius);
    const nz = Math.sin(angle) * (clampedDist / maxRadius);

    setStickPos({
      x: Math.cos(angle) * clampedDist,
      y: Math.sin(angle) * clampedDist,
    });

    const isSprint = dist > maxRadius * 0.75;
    onTouchInput({
      dx: nx,
      dz: nz,
      sprint: isSprint,
    });
  };

  const handleDpadEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === dpadTouchId.current) {
        dpadTouchId.current = null;
        dpadOrigin.current = null;
        setStickPos({ x: 0, y: 0 });
        onTouchInput({
          dx: 0,
          dz: 0,
          sprint: false,
        });
        break;
      }
    }
  };

  const nearbyCrate = sim.crates.find(
    (c) => !c.opened && Math.hypot(sim.player.x - c.x, sim.player.z - c.z) <= 3.5
  );

  return (
    <div
      className="mobile-tactical-controls-root"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 50,
        touchAction: "none",
        userSelect: "none",
      }}
    >
      {/* Left Locomotion Analog Pad */}
      <div
        style={{
          position: "absolute",
          bottom: "max(20px, env(safe-area-inset-bottom, 20px))",
          left: "max(24px, env(safe-area-inset-left, 24px))",
          width: "120px",
          height: "120px",
          borderRadius: "50%",
          background: "rgba(15, 23, 42, 0.45)",
          border: "2px solid rgba(255, 255, 255, 0.2)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "auto",
        }}
        onTouchStart={handleDpadStart}
        onTouchMove={handleDpadMove}
        onTouchEnd={handleDpadEnd}
        onTouchCancel={handleDpadEnd}
      >
        <div
          style={{
            width: "50px",
            height: "50px",
            borderRadius: "50%",
            background: "radial-gradient(circle, #38bdf8 0%, #0284c7 100%)",
            boxShadow: "0 0 12px rgba(56, 189, 248, 0.5)",
            transform: `translate(${stickPos.x}px, ${stickPos.y}px)`,
            transition: dpadTouchId.current === null ? "transform 0.15s ease-out" : "none",
          }}
        />
      </div>

      {/* Right Tactical Action Cluster */}
      <div
        style={{
          position: "absolute",
          bottom: "max(20px, env(safe-area-inset-bottom, 20px))",
          right: "max(20px, env(safe-area-inset-right, 20px))",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: "12px",
          pointerEvents: "auto",
        }}
      >
        {/* Top Row: Utility & ADS */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {/* ADS / Focus Zoom Button */}
          <button
            onTouchStart={() => {
              triggerHaptic(20);
              setAdsActive(true);
              onTouchInput({ ads: true });
            }}
            onTouchEnd={() => {
              setAdsActive(false);
              onTouchInput({ ads: false });
            }}
            style={{
              padding: "8px 14px",
              background: adsActive ? "#3b82f6" : "rgba(30, 41, 59, 0.8)",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              borderRadius: "8px",
              color: "#f8fafc",
              fontSize: "11px",
              fontWeight: 900,
              boxShadow: adsActive ? "0 0 12px #3b82f6" : "none",
            }}
          >
            ADS ZOOM
          </button>

          {/* Weapon Swap Button */}
          <button
            onClick={() => {
              triggerHaptic(25);
              sim.switchWeapon();
            }}
            style={{
              padding: "8px 14px",
              background: sim.player.weapon === "shotgun" ? "#d97706" : "#0284c7",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              borderRadius: "8px",
              color: "#f8fafc",
              fontSize: "11px",
              fontWeight: 900,
            }}
          >
            {sim.player.weapon === "shotgun" ? "12G SHOTGUN" : "5.56 M4"}
          </button>

          {/* Stim Heal Button */}
          <button
            onClick={() => {
              if (sim.isInputLocked()) return;
              if (sim.useStim()) {
                triggerHaptic(40);
              }
            }}
            style={{
              padding: "8px 14px",
              background: sim.player.isBleeding ? "#ef4444" : "#15803d",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              borderRadius: "8px",
              color: "#f8fafc",
              fontSize: "11px",
              fontWeight: 900,
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span>💉</span> STIM ({sim.player.stimsRemaining || 0})
          </button>
        </div>

        {/* Middle Row: Tactical Evasion & Reload */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {/* Loot Crate (Contextual) */}
          {nearbyCrate && (
            <button
              onClick={() => {
                triggerHaptic(30);
                sim.requestLootCrate(nearbyCrate.id);
                sound.playLootChime();
              }}
              style={{
                padding: "10px 16px",
                background: "#ca8a04",
                border: "2px solid #fde047",
                borderRadius: "8px",
                color: "#fef08a",
                fontSize: "12px",
                fontWeight: 900,
                boxShadow: "0 0 16px rgba(202, 138, 4, 0.6)",
              }}
            >
              LOOT CRATE (${nearbyCrate.cashValue})
            </button>
          )}

          {/* Reload Button */}
          <button
            onClick={() => {
              triggerHaptic(20);
              if (sim.reload()) sound.playReload();
            }}
            style={{
              padding: "8px 14px",
              background: "rgba(30, 41, 59, 0.8)",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              borderRadius: "8px",
              color: "#f8fafc",
              fontSize: "11px",
              fontWeight: 900,
            }}
          >
            RELOAD ({sim.player.ammo})
          </button>

          {/* Combat Slide */}
          <button
            onClick={() => {
              triggerHaptic(25);
              onTouchInput({ slide: true });
              setTimeout(() => onTouchInput({ slide: false }), 200);
            }}
            style={{
              padding: "8px 14px",
              background: "rgba(51, 65, 85, 0.8)",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              borderRadius: "8px",
              color: "#f8fafc",
              fontSize: "11px",
              fontWeight: 900,
            }}
          >
            SLIDE
          </button>

          {/* Combat Roll */}
          <button
            onClick={() => {
              triggerHaptic(25);
              onTouchInput({ roll: true });
              setTimeout(() => onTouchInput({ roll: false }), 200);
            }}
            style={{
              padding: "8px 14px",
              background: "rgba(51, 65, 85, 0.8)",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              borderRadius: "8px",
              color: "#f8fafc",
              fontSize: "11px",
              fontWeight: 900,
            }}
          >
            ROLL
          </button>

          {/* Melee Kick */}
          <button
            onClick={() => {
              triggerHaptic(30);
              onTouchInput({ kick: true });
              setTimeout(() => onTouchInput({ kick: false }), 200);
            }}
            style={{
              padding: "8px 14px",
              background: "#854d0e",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              borderRadius: "8px",
              color: "#fef08a",
              fontSize: "11px",
              fontWeight: 900,
            }}
          >
            KICK
          </button>
        </div>

        {/* Big Tactile Fire & Aim Button */}
        <div
          style={{
            width: "84px",
            height: "84px",
            borderRadius: "50%",
            background: touchAimActive
              ? "radial-gradient(circle, #ef4444 0%, #b91c1c 100%)"
              : "radial-gradient(circle, #dc2626 0%, #991b1b 100%)",
            border: "3px solid #fecaca",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            fontWeight: 900,
            fontSize: "16px",
            letterSpacing: "1px",
            boxShadow: touchAimActive
              ? "0 0 24px rgba(239, 68, 68, 0.8)"
              : "0 4px 12px rgba(0, 0, 0, 0.5)",
            cursor: "pointer",
            transform: touchAimActive ? "scale(0.95)" : "scale(1.0)",
            transition: "transform 0.08s ease",
          }}
          onTouchStart={(e) => {
            triggerHaptic(30);
            setTouchAimActive(true);
            const touch = e.changedTouches[0];
            aimTouchId.current = touch.identifier;
            const rect = e.currentTarget.getBoundingClientRect();
            aimOrigin.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
            onTouchInput({ shoot: true });
          }}
          onTouchMove={(e) => {
            if (aimTouchId.current === null || !aimOrigin.current) return;
            let touch: React.Touch | null = null;
            for (let i = 0; i < e.changedTouches.length; i++) {
              if (e.changedTouches[i].identifier === aimTouchId.current) {
                touch = e.changedTouches[i];
                break;
              }
            }
            if (!touch) return;
            const fdx = touch.clientX - aimOrigin.current.x;
            const fdz = touch.clientY - aimOrigin.current.y;
            if (Math.hypot(fdx, fdz) > 10) {
              const angle = Math.atan2(fdx, fdz);
              onTouchInput({ aimAngle: angle, shoot: true });
            }
          }}
          onTouchEnd={() => {
            setTouchAimActive(false);
            aimTouchId.current = null;
            aimOrigin.current = null;
            onTouchInput({ shoot: false });
          }}
          onTouchCancel={() => {
            setTouchAimActive(false);
            aimTouchId.current = null;
            aimOrigin.current = null;
            onTouchInput({ shoot: false });
          }}
        >
          FIRE
        </div>
      </div>
    </div>
  );
};
