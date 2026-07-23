import { useState, useRef, useEffect } from 'react';
import { useMemorySnapshot, formatBytes } from './memoryStats';
import { residentAiSessions, releaseAiSessions } from './ai/aiSessionRegistry';

interface MemoryMonitorProps {
  imageCount: number;
  historyPast: number;
  historyFuture: number;
  historyMax: number;
  onClearHistory: () => void;
}

/** Heap usage thresholds (relative to jsHeapSizeLimit) for color states. */
const WARN_THRESHOLD = 0.7;
const DANGER_THRESHOLD = 0.85;

export function MemoryMonitor({ imageCount, historyPast, historyFuture, historyMax, onClearHistory }: MemoryMonitorProps) {
  const snap = useMemorySnapshot(1000);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  // snap re-renders every second, so this stays current while the popover is open
  const aiSessions = residentAiSessions();

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const heapUsed = snap.jsHeap?.used ?? null;
  const heapLimit = snap.jsHeap?.limit ?? null;
  const heapPct = heapUsed && heapLimit ? heapUsed / heapLimit : null;

  let state: 'normal' | 'warn' | 'danger' = 'normal';
  if (heapPct !== null) {
    if (heapPct >= DANGER_THRESHOLD) state = 'danger';
    else if (heapPct >= WARN_THRESHOLD) state = 'warn';
  }

  const display = heapUsed !== null
    ? formatBytes(heapUsed)
    : formatBytes(snap.blob.bytes);
  const title = heapUsed !== null
    ? `JS heap: ${formatBytes(heapUsed)} / ${formatBytes(heapLimit!)} (${Math.round(heapPct! * 100)}%)`
    : `Tracked blobs: ${formatBytes(snap.blob.bytes)} (heap stats unavailable)`;

  return (
    <div className="memory-monitor-wrapper" ref={wrapperRef}>
      <button
        className={`toolbar-btn memory-monitor-btn memory-monitor-${state}`}
        onClick={() => setOpen((v) => !v)}
        title={title}
      >
        <span className="memory-monitor-label">MEM</span>
        <span className="memory-monitor-value">{display}</span>
      </button>
      {open && (
        <div className="memory-monitor-popover" onPointerDown={(e) => e.stopPropagation()}>
          <div className="memory-monitor-section">
            <div className="memory-monitor-section-title">JS Heap</div>
            {heapUsed !== null && heapLimit !== null ? (
              <>
                <Row label="Used" value={formatBytes(heapUsed)} />
                <Row label="Total alloc" value={formatBytes(snap.jsHeap!.total)} />
                <Row label="Limit" value={formatBytes(heapLimit)} />
                <Row label="Pressure" value={`${(heapPct! * 100).toFixed(1)}%`} />
                <div className="memory-monitor-bar">
                  <div
                    className={`memory-monitor-bar-fill memory-monitor-${state}`}
                    style={{ width: `${Math.min(100, heapPct! * 100)}%` }}
                  />
                </div>
              </>
            ) : (
              <div className="memory-monitor-empty">Not exposed in this browser</div>
            )}
          </div>

          <div className="memory-monitor-section">
            <div className="memory-monitor-section-title">Tracked Blobs</div>
            <Row label="Count" value={String(snap.blob.count)} />
            <Row label="Total bytes" value={formatBytes(snap.blob.bytes)} />
          </div>

          <div className="memory-monitor-section">
            <div className="memory-monitor-section-title">Workspace</div>
            <Row label="Images" value={String(imageCount)} />
            <Row label="Undo depth" value={`${historyPast} / ${historyMax}`} />
            <Row label="Redo depth" value={`${historyFuture} / ${historyMax}`} />
          </div>

          {aiSessions.length > 0 && (
            <div className="memory-monitor-section">
              <div className="memory-monitor-section-title">Loaded AI Models</div>
              {aiSessions.map((s) => (
                <Row key={s.id} label={s.label} value={s.sizeHint} />
              ))}
            </div>
          )}

          <button
            className="memory-monitor-purge"
            disabled={historyPast === 0 && historyFuture === 0 && aiSessions.length === 0}
            title="Deleted images stay in memory so they can be undone — purging the undo/redo history releases them. Loaded AI models are also evicted (they reload from browser cache on next use)."
            onClick={() => {
              const modelNote = aiSessions.length > 0 ? '\nLoaded AI models are also evicted (they reload quickly on next use).' : '';
              if (window.confirm(`Clear undo/redo history to free memory?${modelNote}\n\nYour current workspace is untouched, but you will not be able to undo past this point.`)) {
                onClearHistory();
                void releaseAiSessions();
              }
            }}
          >
            Free Memory (clear undo history)
          </button>

          <div className="memory-monitor-hint">
            Yellow at {Math.round(WARN_THRESHOLD * 100)}%, red at {Math.round(DANGER_THRESHOLD * 100)}% of heap limit. Save and reload if it stays red.
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="memory-monitor-row">
      <span className="memory-monitor-row-label">{label}</span>
      <span className="memory-monitor-row-value">{value}</span>
    </div>
  );
}
