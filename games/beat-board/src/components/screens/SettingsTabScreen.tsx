/**
 * SettingsTabScreen — Settings as a 4th bottom-nav tab.
 *
 * Replaces the previous Play-screen top-right gear icon. The tab simply
 * embeds the existing `SettingsSheet` content (audio + subscription +
 * about) — the sheet was always tab-shaped under the modal chrome, so
 * mounting it inside a tab keeps the wiring (settings-overlay store,
 * subscription store, credits modal handoff) untouched.
 *
 * Because the screen is a tab, there is no "dismiss" affordance — the
 * player navigates away by tapping a different tab. We pass a no-op
 * `onClose` to satisfy the SettingsSheet contract; the internal drag
 * handle / NavClose buttons therefore become no-ops in the tab variant.
 * They remain visible because the renderer relies on the same Panel.Modal
 * shell to provide the section dividers; hiding only the close affordances
 * would require a sheet-API split larger than this change warrants.
 *
 * Future polish (out of scope for this change): split SettingsSheet into a
 * `<SettingsContent />` body + a `<SettingsSheetShell />` that wraps the
 * body in modal chrome, then the tab can render the body alone without
 * the dismiss row.
 */

import { SettingsSheet } from '../sheets/SettingsSheet'

export function SettingsTabScreen() {
  return (
    <div
      data-testid="settings-tab-screen"
      data-skin-role="panel.section"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        padding: '12px 12px 0',
        overflowY: 'auto',
      }}
    >
      <SettingsSheet onClose={noop} hideDismiss />
    </div>
  )
}

function noop(): void {
  /* SettingsTabScreen has no dismiss target — the tab is its own destination. */
}
