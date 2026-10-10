/**
 * @file HideoutMenu.tsx
 * Tactical Hideout, Armory, Black Market Trader, and Bounties Hub for Stick Zone.
 */

import React, { useState } from "react";
import {
  Shield,
  Crosshair,
  DollarSign,
  Package,
  Award,
  Play,
  RotateCcw,
  CheckCircle2,
  MapPin,
  ShoppingBag,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useStashStore, type WeaponType, type ArmorTier } from "../progression/stashStore.js";
import { sound } from "../audio.js";

interface HideoutMenuProps {
  onDeploy: (loadoutOptions: {
    primaryWeapon: WeaponType;
    secondaryWeapon: WeaponType;
    armorTier: ArmorTier;
    stims: number;
  }) => void;
}

type TabType = "armory" | "stash" | "trader" | "contracts" | "intel";

export const HideoutMenu: React.FC<HideoutMenuProps> = ({ onDeploy }) => {
  const [activeTab, setActiveTab] = useState<TabType>("armory");
  const [soundEnabled, setSoundEnabled] = useState(true);

  const {
    bankCash,
    operativeLevel,
    xp,
    stats,
    loadout,
    stashItems,
    contracts,
    equipArmor,
    setStimsCount,
    buyShopItem,
    sellStashItem,
    claimContractReward,
    resetProgress,
  } = useStashStore();

  const xpRequired = 1000 + (operativeLevel - 1) * 750;
  const xpPercent = Math.min(100, Math.floor((xp / xpRequired) * 100));

  const handleDeployClick = () => {
    if (soundEnabled) {
      sound.playRadarPing();
    }
    onDeploy({
      primaryWeapon: loadout.primaryWeapon,
      secondaryWeapon: loadout.secondaryWeapon,
      armorTier: loadout.armorTier,
      stims: loadout.stims,
    });
  };

  const shopCatalog = [
    { id: "shop_m855a1", name: "5.56 M855A1 AP Ammo (30 Rnd)", type: "ammo" as const, rarity: "rare" as const, icon: "📦", price: 1200 },
    { id: "shop_magnum12g", name: "12-Gauge Magnum Buckshot (8 Rnd)", type: "ammo" as const, rarity: "common" as const, icon: "💥", price: 600 },
    { id: "shop_propital", name: "Propital Emergency Stim", type: "med" as const, rarity: "rare" as const, icon: "💉", price: 500 },
    { id: "shop_trooper", name: "Class 4 Trooper Ceramic Plate", type: "armor" as const, rarity: "epic" as const, icon: "🛡️", price: 2800 },
    { id: "shop_zabralo", name: "Class 6 Zabralo Heavy Carrier", type: "armor" as const, rarity: "legendary" as const, icon: "🦺", price: 5500 },
    { id: "shop_violet_card", name: "Violet Lab Access Keycard", type: "keycard" as const, rarity: "legendary" as const, icon: "💳", price: 7500 },
  ];

  return (
    <div className="hideout-screen-overlay" style={{
      position: "fixed",
      inset: 0,
      background: "radial-gradient(circle at 50% 20%, #1e293b 0%, #090d16 100%)",
      color: "#f8fafc",
      display: "flex",
      flexDirection: "column",
      zIndex: 9999,
      overflow: "hidden",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      userSelect: "none",
    }}>
      {/* Top Tactical Status Bar */}
      <header style={{
        height: "68px",
        borderBottom: "2px solid #1e293b",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 28px",
        background: "rgba(15, 23, 42, 0.85)",
        backdropFilter: "blur(12px)",
      }}>
        {/* Left: Operative Callout */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{
            width: "42px",
            height: "42px",
            borderRadius: "8px",
            background: "#22c55e",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 16px rgba(34, 197, 94, 0.4)",
          }}>
            <Crosshair size={26} color="#052e16" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px", fontWeight: 900, letterSpacing: "1px", color: "#f8fafc" }}>
                SPECTRE-1
              </span>
              <span style={{
                background: "rgba(34, 197, 94, 0.15)",
                color: "#4ade80",
                fontSize: "11px",
                fontWeight: 800,
                padding: "2px 8px",
                borderRadius: "4px",
                border: "1px solid rgba(34, 197, 94, 0.3)",
              }}>
                PMC OPERATIVE &bull; LVL {operativeLevel}
              </span>
            </div>
            {/* XP Bar */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
              <div style={{ width: "140px", height: "6px", background: "#334155", borderRadius: "3px", overflow: "hidden" }}>
                <div style={{
                  width: `${xpPercent}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #22c55e, #4ade80)",
                  transition: "width 0.3s ease",
                }} />
              </div>
              <span style={{ fontSize: "10px", color: "#94a3b8", fontFamily: "monospace", fontWeight: 700 }}>
                {xp} / {xpRequired} XP
              </span>
            </div>
          </div>
        </div>

        {/* Center: Quick Stats Pills */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>Raids Survived</span>
            <span style={{ fontSize: "14px", fontWeight: 800, color: "#f8fafc", fontFamily: "monospace" }}>
              {stats.survivedCount} / {stats.raidsCount} ({stats.raidsCount > 0 ? Math.round((stats.survivedCount / stats.raidsCount) * 100) : 0}%)
            </span>
          </div>
          <div style={{ width: "1px", height: "24px", background: "#334155" }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>Hostiles Terminated</span>
            <span style={{ fontSize: "14px", fontWeight: 800, color: "#ef4444", fontFamily: "monospace" }}>
              {stats.killsCount} KILLS {stats.bossKillsCount > 0 ? `(${stats.bossKillsCount} BOSS)` : ""}
            </span>
          </div>
          <div style={{ width: "1px", height: "24px", background: "#334155" }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>Extracted Net Worth</span>
            <span style={{ fontSize: "14px", fontWeight: 800, color: "#eab308", fontFamily: "monospace" }}>
              ${stats.totalValueExtracted.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Right: Bank Cash Ticker & Big Deploy Button */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div style={{
            background: "rgba(16, 185, 129, 0.1)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            padding: "8px 16px",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}>
            <DollarSign size={20} color="#34d399" />
            <div>
              <div style={{ fontSize: "9px", color: "#6ee7b7", textTransform: "uppercase", fontWeight: 800 }}>
                SECURE BANK BALANCE
              </div>
              <div style={{ fontSize: "18px", fontWeight: 900, color: "#34d399", fontFamily: "monospace", lineHeight: 1.1 }}>
                ${bankCash.toLocaleString()}
              </div>
            </div>
          </div>

          <button
            onClick={handleDeployClick}
            style={{
              background: "linear-gradient(135deg, #22c55e 0%, #15803d 100%)",
              color: "#ffffff",
              border: "none",
              padding: "12px 28px",
              borderRadius: "8px",
              fontWeight: 900,
              fontSize: "15px",
              letterSpacing: "1px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              cursor: "pointer",
              boxShadow: "0 0 24px rgba(34, 197, 94, 0.4)",
              transition: "transform 0.1s ease, box-shadow 0.2s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.03)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1.0)")}
          >
            <Play size={18} fill="#ffffff" />
            DEPLOY TO SECTOR 7
          </button>
        </div>
      </header>

      {/* Main Tactical Body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Navigation Sidebar */}
        <nav style={{
          width: "220px",
          background: "rgba(15, 23, 42, 0.6)",
          borderRight: "2px solid #1e293b",
          padding: "20px 12px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}>
          {[
            { id: "armory" as const, label: "ARMORY LOADOUT", icon: <Shield size={18} />, badge: "READY" },
            { id: "stash" as const, label: "STASH LOCKER", icon: <Package size={18} />, count: stashItems.reduce((acc, s) => acc + s.count, 0) },
            { id: "trader" as const, label: "TRADER VEKTOR", icon: <ShoppingBag size={18} />, badge: "SURPLUS" },
            { id: "contracts" as const, label: "TACTICAL CONTRACTS", icon: <Award size={18} />, count: contracts.filter(c => !c.claimed).length },
            { id: "intel" as const, label: "INTEL & BRIEFING", icon: <MapPin size={18} /> },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (soundEnabled) sound.playClick();
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  borderRadius: "8px",
                  border: isActive ? "1px solid #3b82f6" : "1px solid transparent",
                  background: isActive ? "rgba(59, 130, 246, 0.15)" : "transparent",
                  color: isActive ? "#60a5fa" : "#94a3b8",
                  fontWeight: 800,
                  fontSize: "12px",
                  letterSpacing: "0.5px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {tab.icon}
                  <span>{tab.label}</span>
                </div>
                {tab.count !== undefined && (
                  <span style={{
                    background: "#334155",
                    color: "#f8fafc",
                    fontSize: "10px",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    fontFamily: "monospace",
                  }}>
                    {tab.count}
                  </span>
                )}
                {tab.badge && (
                  <span style={{
                    background: isActive ? "rgba(59, 130, 246, 0.3)" : "rgba(148, 163, 184, 0.2)",
                    color: isActive ? "#93c5fd" : "#94a3b8",
                    fontSize: "9px",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    fontWeight: 900,
                  }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                background: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "6px",
                color: "#94a3b8",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              <span>{soundEnabled ? "SFX AUDIO ACTIVE" : "SFX MUTED"}</span>
            </button>

            <button
              onClick={() => {
                if (window.confirm("Reset all persistent stash, level, and cash progress?")) {
                  resetProgress();
                }
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                background: "transparent",
                border: "1px solid #475569",
                borderRadius: "6px",
                color: "#64748b",
                fontSize: "10px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <RotateCcw size={12} />
              <span>RESET SAVE DATA</span>
            </button>
          </div>
        </nav>

        {/* Tab Content Display Area */}
        <main style={{ flex: 1, padding: "28px", overflowY: "auto" }}>
          {/* TAB 1: ARMORY & LOADOUT */}
          {activeTab === "armory" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "900px" }}>
              <div>
                <h2 style={{ fontSize: "20px", fontWeight: 900, letterSpacing: "1px", color: "#f8fafc" }}>
                  OPERATIVE ARSENAL LOADOUT
                </h2>
                <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
                  Configure tactical armament, ballistic protection plates, and emergency stims prior to infil.
                </p>
              </div>

              {/* Weapon Archetype Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
                {/* Primary Weapon Selection */}
                <div style={{
                  background: "rgba(30, 41, 59, 0.5)",
                  border: "1px solid #334155",
                  borderRadius: "10px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", fontWeight: 900, color: "#60a5fa", textTransform: "uppercase" }}>
                      PRIMARY WEAPON SLOT
                    </span>
                    <span style={{ fontSize: "10px", color: "#94a3b8", fontFamily: "monospace" }}>KEY [1]</span>
                  </div>

                  <div style={{
                    padding: "14px",
                    background: "#0f172a",
                    border: "2px solid #3b82f6",
                    borderRadius: "8px",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "15px", fontWeight: 900, color: "#f8fafc" }}>M4A1 TACTICAL CARBINE</span>
                      <span style={{ fontSize: "11px", color: "#60a5fa", fontWeight: 800 }}>5.56 NATO</span>
                    </div>
                    <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>
                      Full-auto assault rifle. High velocity, pinpoint precision at medium-to-long engagement ranges.
                    </div>
                    <div style={{ display: "flex", gap: "12px", marginTop: "10px", fontSize: "10px", fontFamily: "monospace", color: "#cbd5e1" }}>
                      <span>DMG: 24</span> &bull; <span>CAP: 30 RND</span> &bull; <span>RPM: 450</span>
                    </div>
                  </div>
                </div>

                {/* Secondary Weapon Selection */}
                <div style={{
                  background: "rgba(30, 41, 59, 0.5)",
                  border: "1px solid #334155",
                  borderRadius: "10px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", fontWeight: 900, color: "#f59e0b", textTransform: "uppercase" }}>
                      SECONDARY BREACHING SLOT
                    </span>
                    <span style={{ fontSize: "10px", color: "#94a3b8", fontFamily: "monospace" }}>KEY [2]</span>
                  </div>

                  <div style={{
                    padding: "14px",
                    background: "#0f172a",
                    border: "2px solid #f59e0b",
                    borderRadius: "8px",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "15px", fontWeight: 900, color: "#f8fafc" }}>M590 TRENCH SHOTGUN</span>
                      <span style={{ fontSize: "11px", color: "#f59e0b", fontWeight: 800 }}>12G BUCKSHOT</span>
                    </div>
                    <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>
                      6-pellet high spread devastator. Brutal point-blank kinetic stopping power and door breaching.
                    </div>
                    <div style={{ display: "flex", gap: "12px", marginTop: "10px", fontSize: "10px", fontFamily: "monospace", color: "#cbd5e1" }}>
                      <span>DMG: 6x16 (96)</span> &bull; <span>CAP: 8 RND</span> &bull; <span>CONE: 30°</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Armor Tier Selection */}
              <div style={{
                background: "rgba(30, 41, 59, 0.5)",
                border: "1px solid #334155",
                borderRadius: "10px",
                padding: "18px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", fontWeight: 900, color: "#38bdf8", textTransform: "uppercase" }}>
                    BALLISTIC BODY ARMOR CARRIER
                  </span>
                  <span style={{ fontSize: "11px", color: "#94a3b8" }}>Current: Class {loadout.armorTier === "light" ? "2 PACA" : loadout.armorTier === "medium" ? "4 Trooper" : "6 Zabralo"}</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
                  {[
                    { tier: "light" as const, name: "Class 2 PACA Vest", desc: "Standard kevlar. Maximum sprint speed and agility.", armor: "40 AP", def: "10% Absorb" },
                    { tier: "medium" as const, name: "Class 4 Trooper Plate", desc: "Ceramic composite. Balanced ballistic defense against 5.56.", armor: "75 AP", def: "20% Absorb" },
                    { tier: "heavy" as const, name: "Class 6 Zabralo Heavy", desc: "Titanium juggernaut rig. Heavy protection against sniper & buckshot.", armor: "100 AP", def: "35% Absorb" },
                  ].map((arm) => {
                    const isEquipped = loadout.armorTier === arm.tier;
                    return (
                      <div
                        key={arm.tier}
                        onClick={() => {
                          equipArmor(arm.tier);
                          if (soundEnabled) sound.playClick();
                        }}
                        style={{
                          padding: "12px",
                          background: isEquipped ? "rgba(56, 189, 248, 0.15)" : "#0f172a",
                          border: isEquipped ? "2px solid #38bdf8" : "1px solid #334155",
                          borderRadius: "8px",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "13px", fontWeight: 800, color: isEquipped ? "#38bdf8" : "#f8fafc" }}>
                            {arm.name}
                          </span>
                          {isEquipped && <CheckCircle2 size={16} color="#38bdf8" />}
                        </div>
                        <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>
                          {arm.desc}
                        </div>
                        <div style={{ display: "flex", gap: "8px", marginTop: "8px", fontSize: "10px", fontFamily: "monospace", color: "#38bdf8" }}>
                          <span>{arm.armor}</span> &bull; <span>{arm.def}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Combat Stims Allocation */}
              <div style={{
                background: "rgba(30, 41, 59, 0.5)",
                border: "1px solid #334155",
                borderRadius: "10px",
                padding: "18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 900, color: "#f8fafc" }}>
                    IFAK / PROPITAL EMERGENCY STIMS INVENTORY
                  </div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                    Inject during firefights with [H] to instantly stop heavy arterial bleeding and restore +45 HP over 3 seconds.
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <button
                    onClick={() => {
                      if (loadout.stims > 0) {
                        setStimsCount(loadout.stims - 1);
                        if (soundEnabled) sound.playClick();
                      }
                    }}
                    style={{
                      width: "32px",
                      height: "32px",
                      background: "#334155",
                      border: "none",
                      borderRadius: "6px",
                      color: "#fff",
                      fontSize: "16px",
                      cursor: "pointer",
                    }}
                  >
                    -
                  </button>
                  <span style={{ fontSize: "18px", fontWeight: 900, fontFamily: "monospace", minWidth: "30px", textAlign: "center" }}>
                    {loadout.stims} / 4
                  </span>
                  <button
                    onClick={() => {
                      if (loadout.stims < 4) {
                        setStimsCount(loadout.stims + 1);
                        if (soundEnabled) sound.playClick();
                      }
                    }}
                    style={{
                      width: "32px",
                      height: "32px",
                      background: "#22c55e",
                      border: "none",
                      borderRadius: "6px",
                      color: "#052e16",
                      fontSize: "16px",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: STASH INVENTORY */}
          {activeTab === "stash" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                  <h2 style={{ fontSize: "20px", fontWeight: 900, letterSpacing: "1px", color: "#f8fafc" }}>
                    SECURE STASH VAULT
                  </h2>
                  <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
                    Items safely evacuated from Sector 7 Depot. Sell surplus loot to Fence for liquid bank cash.
                  </p>
                </div>
                <div style={{ fontSize: "12px", color: "#94a3b8", fontFamily: "monospace" }}>
                  TOTAL ITEMS: {stashItems.reduce((acc, s) => acc + s.count, 0)}
                </div>
              </div>

              {stashItems.length === 0 ? (
                <div style={{
                  padding: "48px",
                  textAlign: "center",
                  background: "rgba(30, 41, 59, 0.3)",
                  border: "2px dashed #334155",
                  borderRadius: "12px",
                  color: "#64748b",
                }}>
                  <Package size={48} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
                  <div style={{ fontSize: "15px", fontWeight: 700 }}>STASH IS EMPTY</div>
                  <div style={{ fontSize: "12px", marginTop: "4px" }}>Infil into Sector 7, loot military depot crates, and extract alive to secure items!</div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "14px" }}>
                  {stashItems.map((item) => {
                    const rarityColors = {
                      common: "#94a3b8",
                      rare: "#3b82f6",
                      epic: "#a855f7",
                      legendary: "#f59e0b",
                    };
                    const color = rarityColors[item.rarity] || "#94a3b8";

                    return (
                      <div
                        key={item.id}
                        style={{
                          background: "#0f172a",
                          border: `1px solid ${color}40`,
                          borderRadius: "8px",
                          padding: "14px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                          position: "relative",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <span style={{ fontSize: "28px" }}>{item.icon}</span>
                          <span style={{
                            fontSize: "10px",
                            fontWeight: 800,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: `${color}20`,
                            color: color,
                            textTransform: "uppercase",
                          }}>
                            {item.rarity}
                          </span>
                        </div>

                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 800, color: "#f8fafc" }}>
                            {item.name}
                          </div>
                          <div style={{ fontSize: "11px", color: "#64748b", textTransform: "capitalize" }}>
                            {item.type} &bull; Qty: {item.count}
                          </div>
                        </div>

                        <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "8px", borderTop: "1px solid #1e293b" }}>
                          <span style={{ fontSize: "13px", fontWeight: 900, color: "#34d399", fontFamily: "monospace" }}>
                            ${item.value.toLocaleString()}
                          </span>
                          <button
                            onClick={() => {
                              sellStashItem(item.id);
                              if (soundEnabled) sound.playLootChime();
                            }}
                            style={{
                              background: "rgba(239, 68, 68, 0.2)",
                              border: "1px solid rgba(239, 68, 68, 0.4)",
                              color: "#fca5a5",
                              fontSize: "10px",
                              fontWeight: 800,
                              padding: "4px 8px",
                              borderRadius: "4px",
                              cursor: "pointer",
                            }}
                          >
                            SELL
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TRADER VEKTOR */}
          {activeTab === "trader" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                  <h2 style={{ fontSize: "20px", fontWeight: 900, letterSpacing: "1px", color: "#f8fafc" }}>
                    TRADER VEKTOR // BLACK MARKET SURPLUS
                  </h2>
                  <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
                    "Got the highest-grade contraband in the exclusion zone. Cash only, operative."
                  </p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
                {shopCatalog.map((shopItem) => {
                  const canAfford = bankCash >= shopItem.price;

                  return (
                    <div
                      key={shopItem.id}
                      style={{
                        background: "#0f172a",
                        border: "1px solid #334155",
                        borderRadius: "10px",
                        padding: "16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "28px" }}>{shopItem.icon}</span>
                        <span style={{
                          fontSize: "10px",
                          fontWeight: 800,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: "#334155",
                          color: "#cbd5e1",
                          textTransform: "uppercase",
                        }}>
                          {shopItem.rarity}
                        </span>
                      </div>

                      <div>
                        <div style={{ fontSize: "14px", fontWeight: 800, color: "#f8fafc" }}>
                          {shopItem.name}
                        </div>
                        <div style={{ fontSize: "11px", color: "#64748b" }}>
                          Category: {shopItem.type}
                        </div>
                      </div>

                      <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "12px", borderTop: "1px solid #1e293b" }}>
                        <span style={{ fontSize: "15px", fontWeight: 900, color: "#34d399", fontFamily: "monospace" }}>
                          ${shopItem.price.toLocaleString()}
                        </span>
                        <button
                          disabled={!canAfford}
                          onClick={() => {
                            if (buyShopItem(shopItem)) {
                              if (soundEnabled) sound.playLootChime();
                            }
                          }}
                          style={{
                            background: canAfford ? "#22c55e" : "#334155",
                            color: canAfford ? "#052e16" : "#64748b",
                            border: "none",
                            borderRadius: "6px",
                            padding: "6px 14px",
                            fontWeight: 800,
                            fontSize: "11px",
                            cursor: canAfford ? "pointer" : "not-allowed",
                            textTransform: "uppercase",
                          }}
                        >
                          {canAfford ? "BUY SURPLUS" : "INSUFFICIENT FUNDS"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: TACTICAL CONTRACTS (BOUNTIES) */}
          {activeTab === "contracts" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <h2 style={{ fontSize: "20px", fontWeight: 900, letterSpacing: "1px", color: "#f8fafc" }}>
                  COMMAND CONTRACTS & BOUNTIES
                </h2>
                <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
                  Complete tactical field objectives during raids for bonus operational cash, experience, and gear.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {contracts.map((c) => {
                  const progressPct = Math.min(100, Math.floor((c.currentCount / c.targetCount) * 100));

                  return (
                    <div
                      key={c.id}
                      style={{
                        background: "#0f172a",
                        border: c.completed ? "2px solid #22c55e" : "1px solid #334155",
                        borderRadius: "10px",
                        padding: "18px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "20px",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 900, color: "#60a5fa", fontFamily: "monospace" }}>
                            {c.codename}
                          </span>
                          <span style={{ fontSize: "15px", fontWeight: 900, color: "#f8fafc" }}>
                            {c.title}
                          </span>
                        </div>
                        <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
                          {c.description}
                        </div>

                        {/* Progress Bar */}
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "12px" }}>
                          <div style={{ flex: 1, maxWidth: "260px", height: "8px", background: "#1e293b", borderRadius: "4px", overflow: "hidden" }}>
                            <div style={{
                              width: `${progressPct}%`,
                              height: "100%",
                              background: c.completed ? "#22c55e" : "#3b82f6",
                              transition: "width 0.3s ease",
                            }} />
                          </div>
                          <span style={{ fontSize: "11px", fontFamily: "monospace", fontWeight: 700, color: "#cbd5e1" }}>
                            {c.currentCount} / {c.targetCount}
                          </span>
                        </div>
                      </div>

                      {/* Reward & Claim */}
                      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: "15px", fontWeight: 900, color: "#34d399", fontFamily: "monospace" }}>
                            +${c.rewardCash.toLocaleString()}
                          </div>
                          <div style={{ fontSize: "11px", color: "#60a5fa", fontFamily: "monospace" }}>
                            +{c.rewardXp} XP
                          </div>
                        </div>

                        {c.claimed ? (
                          <div style={{
                            padding: "8px 16px",
                            background: "#1e293b",
                            color: "#64748b",
                            fontSize: "11px",
                            fontWeight: 800,
                            borderRadius: "6px",
                          }}>
                            CLAIMED
                          </div>
                        ) : c.completed ? (
                          <button
                            onClick={() => {
                              claimContractReward(c.id);
                              if (soundEnabled) sound.playLootChime();
                            }}
                            style={{
                              background: "#22c55e",
                              color: "#052e16",
                              border: "none",
                              borderRadius: "6px",
                              padding: "10px 20px",
                              fontWeight: 900,
                              fontSize: "12px",
                              cursor: "pointer",
                              boxShadow: "0 0 16px rgba(34, 197, 94, 0.4)",
                            }}
                          >
                            CLAIM BOUNTY
                          </button>
                        ) : (
                          <div style={{
                            padding: "8px 16px",
                            background: "#1e293b",
                            color: "#94a3b8",
                            fontSize: "11px",
                            fontWeight: 700,
                            borderRadius: "6px",
                          }}>
                            IN PROGRESS
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 5: INTEL & BRIEFING */}
          {activeTab === "intel" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "800px" }}>
              <div>
                <h2 style={{ fontSize: "20px", fontWeight: 900, letterSpacing: "1px", color: "#f8fafc" }}>
                  SECTOR 7 DEPOT INTEL & CONTROLS
                </h2>
                <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
                  Operational topography, hostile threat assessments, and tactical survival tactics.
                </p>
              </div>

              <div style={{
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "10px",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}>
                <div style={{ fontSize: "14px", fontWeight: 900, color: "#f8fafc" }}>
                  OPERATIONAL CONTROLS
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px", fontSize: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: "#1e293b", borderRadius: "4px" }}>
                    <span style={{ color: "#94a3b8" }}>Movement:</span>
                    <span style={{ fontWeight: 800, color: "#f8fafc", fontFamily: "monospace" }}>W, A, S, D</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: "#1e293b", borderRadius: "4px" }}>
                    <span style={{ color: "#94a3b8" }}>Aim & Shoot:</span>
                    <span style={{ fontWeight: 800, color: "#f8fafc", fontFamily: "monospace" }}>Mouse Aim / Left Click</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: "#1e293b", borderRadius: "4px" }}>
                    <span style={{ color: "#94a3b8" }}>Sprint:</span>
                    <span style={{ fontWeight: 800, color: "#f8fafc", fontFamily: "monospace" }}>Hold Shift</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: "#1e293b", borderRadius: "4px" }}>
                    <span style={{ color: "#94a3b8" }}>Combat Slide:</span>
                    <span style={{ fontWeight: 800, color: "#f8fafc", fontFamily: "monospace" }}>C (while moving)</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: "#1e293b", borderRadius: "4px" }}>
                    <span style={{ color: "#94a3b8" }}>Combat Roll:</span>
                    <span style={{ fontWeight: 800, color: "#f8fafc", fontFamily: "monospace" }}>Space (invincibility frames)</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: "#1e293b", borderRadius: "4px" }}>
                    <span style={{ color: "#94a3b8" }}>Melee Kick:</span>
                    <span style={{ fontWeight: 800, color: "#f8fafc", fontFamily: "monospace" }}>V or E (stagger hostiles)</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: "#1e293b", borderRadius: "4px" }}>
                    <span style={{ color: "#94a3b8" }}>Inject Stim:</span>
                    <span style={{ fontWeight: 800, color: "#f8fafc", fontFamily: "monospace" }}>H (stop bleed + heal)</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: "#1e293b", borderRadius: "4px" }}>
                    <span style={{ color: "#94a3b8" }}>Switch Weapon:</span>
                    <span style={{ fontWeight: 800, color: "#f8fafc", fontFamily: "monospace" }}>1 (M4) / 2 (Shotgun) or Q</span>
                  </div>
                </div>
              </div>

              <div style={{
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "10px",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}>
                <div style={{ fontSize: "14px", fontWeight: 900, color: "#f8fafc" }}>
                  EXTRACTION DIRECTIVES
                </div>
                <ul style={{ paddingLeft: "20px", fontSize: "12px", color: "#94a3b8", lineHeight: 1.6 }}>
                  <li>Primary Extraction LZ is situated at coordinates <b style={{ color: "#22c55e" }}>(45, 45)</b> marked with green thermal smoke.</li>
                  <li>You must physically hold inside the extraction smoke for <b>3.0 consecutive seconds</b>.</li>
                  <li>Taking hostile damage resets extraction hold timer immediately. Clean your sector first!</li>
                  <li>Securing a Violet Keycard from the Sector Boss unlocks the emergency underground bunker at <b style={{ color: "#a855f7" }}>(-45, -45)</b>.</li>
                </ul>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
