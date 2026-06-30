/**
 * CreditsSheet — bottom-sheet modal that lists project credits,
 * open-source attributions, and the build version + hash.
 *
 * Audio is generated via the `rundot` CLI and is workshop-owned content;
 * the RUN platform pipeline does not require a provider attribution in
 * the game, so there is no audio-attribution section here.
 *
 * Issue beat-board-16-credits-modal owns this file.
 *
 * Reachable from:
 *   - Settings modal "Credits" row
 *   - Packs screen footer link
 *
 * Both consumers open the sheet by pushing this component into the
 * `ui/bottom-sheet` portal:
 *
 *   useBottomSheetStore.getState().open(
 *     <CreditsSheet onClose={() => useBottomSheetStore.getState().close()} />
 *   )
 *
 * The component is also renderable directly (without the portal) so unit and
 * acceptance tests can assert on its content without mounting the portal host.
 */

import { useEffect } from 'react'
import {
  Cluster,
  Label,
  NavClose,
  Panel,
  Stack,
} from '@modules/ui/skin'
import pkg from '../../../package.json'
import { analytics as analyticsModule } from '../../modules/data/analytics-service/AnalyticsService'

export interface CreditsSheetProps {
  /** Called when the sheet should dismiss (drag handle, X button). */
  onClose: () => void
}

/**
 * Placeholder team list. Replaced by visual design once the team page lands.
 * Kept inline so the static modal renders without a network/storage round-trip.
 */
const MADE_BY_TEAM = [
  'BeatBoard team',
  'Engineering, design, and audio direction',
] as const

/**
 * Placeholder open-source attribution rows. The build-time generator will
 * populate this section with real package metadata in a later pass; in the
 * meantime we list the headline runtime dependencies so the section is not
 * empty in shipping builds.
 */
const OPEN_SOURCE_ROWS = [
  'React — MIT',
  'Zustand — MIT',
  'Vite — MIT',
  'Lucide icons — ISC',
] as const

/**
 * Resolve the build hash. Vite injects `VITE_BUILD_HASH` at build time when
 * the release pipeline sets it; in dev/test the value is undefined and we
 * fall back to a stable "dev" placeholder so the version line is always
 * well-formed.
 */
function resolveBuildHash(): string {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
  const hash = env?.['VITE_BUILD_HASH']
  if (typeof hash === 'string' && hash.length > 0) return hash
  return 'dev'
}

export function CreditsSheet({ onClose }: CreditsSheetProps) {
  // Fire screen_viewed analytics once per mount. Re-renders of the same
  // instance must not re-fire (acceptance test asserts this), so the effect
  // depends on the empty array.
  useEffect(() => {
    analyticsModule.track('screen_viewed', { screen: 'credits' })
  }, [])

  const versionLine = `v${pkg.version} · build ${resolveBuildHash()}`

  return (
    <Panel.Modal
      data-testid="credits-sheet"
      data-skin-role="panel.modal"
    >
      <Stack space="md">
        {/* Top affordances: drag handle (left) + close X (right). The drag
            handle is a real button so it is keyboard reachable in the
            375x667 safe-area smallest viewport. */}
        <Cluster justify="between" align="center">
          <button
            type="button"
            data-testid="credits-sheet-handle"
            aria-label="Dismiss"
            onClick={onClose}
            style={{
              width: 48,
              height: 6,
              borderRadius: 3,
              background: 'var(--ui-color-border, rgba(0,0,0,0.2))',
              border: 0,
              padding: 0,
              cursor: 'pointer',
            }}
          />
          <NavClose
            data-testid="credits-close"
            onClick={onClose}
            aria-label="Close credits"
          />
        </Cluster>

        {/* Title. */}
        <Label.Title data-testid="credits-title">Credits</Label.Title>

        {/* Made by. */}
        <Stack space="xs">
          <Label.Section data-testid="credits-section-made-by">
            Made by
          </Label.Section>
          <ul
            data-testid="credits-made-by-list"
            style={{ margin: 0, paddingInlineStart: '1.25rem' }}
          >
            {MADE_BY_TEAM.map((line) => (
              <li key={line}>
                <Label.Section>{line}</Label.Section>
              </li>
            ))}
          </ul>
        </Stack>

        {/* Open source — placeholder list, populated by the build-time
            generator in a later pass. */}
        <Stack space="xs">
          <Label.Section data-testid="credits-section-open-source">
            Open source
          </Label.Section>
          <ul
            data-testid="credits-open-source-list"
            style={{ margin: 0, paddingInlineStart: '1.25rem' }}
          >
            {OPEN_SOURCE_ROWS.map((line) => (
              <li key={line}>
                <Label.Section>{line}</Label.Section>
              </li>
            ))}
          </ul>
        </Stack>

        {/* Version + build hash. */}
        <Stack space="xs">
          <Label.Section data-testid="credits-section-version">
            Version
          </Label.Section>
          <Label.Value data-testid="credits-version-line">
            {versionLine}
          </Label.Value>
        </Stack>
      </Stack>
    </Panel.Modal>
  )
}
