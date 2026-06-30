import { useEffect, useState } from 'react'
import { Settings } from '@modules/ui/skin/semantic'
import type { DebugConsoleModuleFactoryExport } from '../types'
import {
  clearCapturedLogs,
  formatCapturedLogsForCopy,
  getCapturedLogs,
  subscribeToLogBuffer,
  type CapturedLogEntry,
} from '../logBuffer'

function levelColor(level: CapturedLogEntry['level']): string {
  switch (level) {
    case 'error':
      return 'var(--ui-color-danger, #ff6b6b)'
    case 'warn':
      return 'var(--ui-color-warning, #f5b441)'
    case 'info':
      return 'var(--ui-color-info, #6cc6ff)'
    case 'debug':
      return 'var(--ui-text-muted, #9aa3b2)'
    default:
      return 'var(--ui-text-primary, #e8eaf0)'
  }
}

function LogsModule() {
  const [, force] = useState(0)
  useEffect(() => subscribeToLogBuffer(() => force((n) => n + 1)), [])
  const entries = getCapturedLogs()
  const copyAll = async () => {
    const text = formatCapturedLogsForCopy()
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Clipboard API can fail (no permission / iframe sandbox). Fall back to a
      // selectable textarea so the player can copy manually.
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
  }
  return (
    <Settings.Section title={`Logs (${entries.length})`}>
      <Settings.Row
        title="Actions"
        description="Capture buffer is the most recent 500 log/warn/error events from console.* and RundotAPI."
        controlPlacement="stacked"
        control={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              data-testid="debug-logs-copy"
              onClick={copyAll}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid var(--ui-color-border)',
                background: 'var(--ui-color-accent-soft)',
                color: 'var(--ui-text-primary)',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              Copy all
            </button>
            <button
              type="button"
              data-testid="debug-logs-clear"
              onClick={() => clearCapturedLogs()}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid var(--ui-color-border)',
                background: 'transparent',
                color: 'var(--ui-text-primary)',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              Clear
            </button>
          </div>
        }
      />
      <pre
        data-testid="debug-logs-output"
        style={{
          margin: 0,
          maxHeight: 320,
          overflow: 'auto',
          fontSize: 11,
          lineHeight: 1.4,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          padding: 8,
          borderRadius: 8,
          background: 'var(--ui-page-bg, rgba(0,0,0,0.4))',
          border: '1px solid var(--ui-color-border)',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}
      >
        {entries.length === 0
          ? '(no logs yet — interact with the app to populate)'
          : entries.map((e, i) => {
              const t = new Date(e.ts).toISOString().slice(11, 23)
              return (
                <div key={i} style={{ color: levelColor(e.level) }}>
                  {`[${t}] ${e.level.toUpperCase().padEnd(5)} ${e.source}: ${e.text}`}
                </div>
              )
            })}
      </pre>
    </Settings.Section>
  )
}

export const createDebugConsoleModule: DebugConsoleModuleFactoryExport['createDebugConsoleModule'] = () => ({
  id: 'logs',
  title: 'Logs',
  // High order so it lands beneath the diagnostics summary but above
  // long-form modules. Players hit the overlay after a tap-not-firing
  // bug; logs is what they actually need to inspect first.
  order: 5,
  render: () => <LogsModule />,
})
