import React, { useEffect, useState } from 'react';
import { ShieldCheck, CheckCircle, ArrowRight, Loader2, Sparkles, Award } from 'lucide-react';
import type { SectorDepotSimulation } from '../sim/game.js';
import type { ExfilState, SettlementReceipt } from '../sim/airlock.js';
import type { RaidId, ProfileId } from '@series-inc/rundot-syncplay/extensions/hub';
import { verifyReceiptIntegrity } from '../sim/airlock.js';

interface ExfilOverlayProps {
  sim: SectorDepotSimulation;
  onRestart: () => void;
}

export const ExfilOverlay: React.FC<ExfilOverlayProps> = ({ sim, onRestart }) => {
  const [state, setState] = useState<ExfilState>(sim.exfilController.getState());
  const [corridorElapsed, setCorridorElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      const currentState = sim.exfilController.getState();
      setState(currentState);

      // Auto-step corridor presentation and submission
      if (currentState.kind === 'corridor_presentation') {
        const elapsed = Date.now() - currentState.startedAtMs;
        setCorridorElapsed(elapsed);
        if (elapsed >= currentState.durationMs) {
          try {
            sim.exfilController.submitSettlement();

            // Simulate atomic server settlement handshake (or talk to live endpoint)
            setTimeout(() => {
              const mockReceipt: SettlementReceipt = {
                v: 1,
                receiptId: `receipt_exfil_${Math.random().toString(16).slice(2, 10)}`,
                raidId: 'raid_sector7_1042' as RaidId,
                outcomeId: 'digest_sha256_mock_outcome',
                intentHash: 'hash_intent_exfil_1',
                outcomeDigest: 'digest_sha256_mock_outcome',
                throughTick: sim.tick,
                committedAtMs: Date.now(),
                participantResults: [
                  {
                    profileId: sim.player.id as ProfileId,
                    releasedEscrowIds: ['escrow_1'],
                    inventoryRevision: 2,
                    activeRaidCleared: true,
                  },
                ],
                transfers: [
                  {
                    itemId: 'cash_credits',
                    quantity: `BE:${sim.player.cash || 4500}`,
                    toProfileId: sim.player.id as ProfileId,
                    source: 'world_spawn',
                  },
                ],
              };

              if (verifyReceiptIntegrity(mockReceipt)) {
                sim.exfilController.onReceipt(mockReceipt);
                setState(sim.exfilController.getState());
              }
            }, 600);
          } catch {
            // Already submitted or presentation remaining
          }
        }
      }
    }, 50);

    return () => clearInterval(timer);
  }, [sim]);

  if (state.kind === 'idle' || state.kind === 'holding_zone') {
    return null;
  }

  // 1. Stage 2: 2500ms Corridor Presentation Mask
  if (state.kind === 'corridor_presentation' || state.kind === 'submitting_settlement') {
    const pct = Math.min(100, Math.round((corridorElapsed / 2500) * 100));

    return (
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(9, 12, 16, 0.92)',
          backdropFilter: 'blur(16px)',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '24px',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div className="tactical-badge badge-green" style={{ marginBottom: '12px', fontSize: '14px' }}>
            AIRLOCK EXTRACTION CORRIDOR ACTIVE
          </div>
          <h1 style={{ fontSize: '36px', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>
            SECURE EVAC HELO INBOUND
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px', fontSize: '15px' }}>
            Locking sector inventory ledger &bull; Initiating atomic SyncHub prefix settlement
          </p>
        </div>

        {/* Corridor Meter */}
        <div style={{ width: '360px', height: '10px', background: '#1e293b', borderRadius: '5px', overflow: 'hidden' }}>
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              background: 'var(--exfil-green)',
              transition: 'width 0.1s linear',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--tactical-cyan)', fontFamily: 'monospace' }}>
          <Loader2 size={16} className="animate-spin" />
          <span>{state.kind === 'corridor_presentation' ? `PRESENTATION CORRIDOR: ${pct}%` : 'VERIFYING RECEIPTS...'}</span>
        </div>
      </div>
    );
  }

  // 2. Stage 3: Victory Settlement Debrief Screen
  if (state.kind === 'extracted') {
    const receipt = state.receipt;

    return (
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(9, 12, 16, 0.95)',
          backdropFilter: 'blur(20px)',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        <div
          style={{
            maxWidth: '560px',
            width: '100%',
            background: 'var(--bg-card)',
            border: '2px solid var(--exfil-green)',
            borderRadius: '12px',
            padding: '32px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(34, 197, 94, 0.2)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <span className="tactical-badge badge-green" style={{ fontSize: '13px' }}>
              EXFIL SUCCESSFUL &bull; SURVIVOR
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-dim)' }}>
              TICK {sim.tick.toLocaleString()}
            </span>
          </div>

          <h2 style={{ fontSize: '32px', fontWeight: 900, color: '#fff', marginBottom: '8px' }}>
            MISSION ACCOMPLISHED
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>
            Operative successfully evacuated from Sector 7 Depot. Stash lock cleared and assets deposited.
          </p>

          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginBottom: '24px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Total Cash Scavenged:</span>
              <span style={{ fontSize: '22px', fontWeight: 800, color: 'var(--loot-amber)', fontFamily: 'monospace' }}>
                ${sim.player.cash.toLocaleString()}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Raid Ledger Receipt:</span>
              <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--tactical-cyan)' }}>
                {receipt.receiptId}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Integrity Format:</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--exfil-green)', fontSize: '13px', fontWeight: 700 }}>
                <CheckCircle size={14} /> STRICT CANONICAL BIGINT
              </span>
            </div>
          </div>

          <button
            onClick={onRestart}
            style={{
              width: '100%',
              padding: '14px 24px',
              background: 'var(--exfil-green)',
              color: '#000',
              fontWeight: 800,
              fontSize: '15px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <span>RE-DEPLOY TO SECTOR 7 DEPOT</span>
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  return null;
};
