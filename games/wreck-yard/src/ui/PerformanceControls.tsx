import { useEffect, useState } from 'react';
import type { PerfApi } from '../perf/api';
import './PerformanceControls.css';

function api(): PerfApi | undefined { return window.__WRECK_YARD_PERF__; }

export function PerformanceControls() {
  const [status, setStatus] = useState(() => api()?.status());
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const timer = window.setInterval(() => setStatus(api()?.status()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  function record() {
    api()?.start({ capacity: 65_536, maxDurationMs: 60_000 });
    setMessage('Resume. Repeat the action. Then wait for recovery.');
    setStatus(api()?.status());
  }
  function stop() {
    api()?.stop();
    setStatus(api()?.status());
    setMessage('Recording stopped. Save the report.');
  }
  async function save() {
    const recorder = api();
    if (!recorder) return;
    setSaving(true);
    try {
      const report = recorder.export();
      setStatus(recorder.status());
      const file = new File([JSON.stringify(report)], `wreck-yard-performance-${Date.now()}.json`, { type: 'application/json' });
      let shared = false;
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'Wreck Yard performance' });
          shared = true;
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') throw error;
        }
      }
      if (!shared) {
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.name;
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
      setMessage(report.overwrittenRecords
        ? `Report ready. ${report.overwrittenRecords} detailed records were replaced. Full capture summaries remain.`
        : 'Report ready. No detailed records were replaced.');
    } catch (error) {
      setMessage(error instanceof DOMException && error.name === 'AbortError'
        ? 'Save cancelled. The report is still available.' : 'The report could not be saved. Try again.');
    } finally { setSaving(false); }
  }
  const active = status?.active ?? false;
  const seconds = Math.min(60, Math.floor((status?.elapsedMs ?? 0) / 1000));
  return (
    <details className="yard-performance">
      <summary>Performance capture</summary>
      <p role="status">{active ? `Recording: ${seconds}/60 seconds.` : status?.totalRecords ? `Report: ${seconds} seconds.` : 'No report yet.'} {message}</p>
      <div className="yard-performance__actions">
        <button type="button" className="yard-button" onClick={record} disabled={!status || active || saving}>Record performance</button>
        {active ? <button type="button" className="yard-button" onClick={stop}>Stop recording</button> : null}
        <button type="button" className="yard-button" onClick={() => { void save(); }} disabled={!status?.totalRecords || saving}>{saving ? 'Saving…' : 'Save report'}</button>
      </div>
      <p>Local recording. No upload. Maximum 60 seconds. Starting a new recording replaces the previous report.</p>
    </details>
  );
}
