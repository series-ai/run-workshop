/**
 * Share Service Adapter — sessions-based.
 *
 * Each share carries the full `MixSession` JSON in `shareParams`.
 * Recipients reconstitute the mix by importing the session into their
 * own `MixLibrary` — no audio bytes cross the wire.
 *
 *   - `shareMix(mixId)` reads the session from the library, sanity-
 *     checks it fits inside the SDK's 90 KB shareParams cap, and
 *     forwards through the share-service module.
 *   - `handleIncomingShare(payload)` parses the session, imports it via
 *     `MixLibrary.importShared`, and routes to the Mixes tab.
 *   - `recording_shared` analytics fires on share success.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import {
  createShareServiceAdapter,
  __resetShareAdapterState,
  __getLastShareEvent,
} from '../systems/share-service-adapter'
import { useNavigationStore } from '../stores/navigationStore'
import {
  __setMixLibraryForTests,
  MIX_SESSION_VERSION,
  MixLibrary,
  InMemoryMixRepository,
} from '../systems/mixes'
import {
  installMixLibraryBinding,
  resetMixesStore,
  useMixesStore,
} from '../stores/mixesStore'
import { analytics as analyticsModule } from '../modules/data/analytics-service/AnalyticsService'
import { NAVIGATION } from '../tabs/tabConfig'

function configureNavigation() {
  useNavigationStore.getState().configure(NAVIGATION)
}

let library: MixLibrary

async function seedOwnedMix(input: {
  title: string
  kitId: string
  events?: Array<{ t: number; type: 'pad_activate'; padId: string }>
}): Promise<string> {
  const summary = await library.save({
    title: input.title,
    session: {
      kitId: input.kitId,
      bpm: 84,
      durationBeats: 32,
      createdAtMs: 0,
      events: input.events ?? [],
      version: MIX_SESSION_VERSION,
    },
  })
  return summary.id
}

beforeEach(() => {
  vi.clearAllMocks()
  __resetShareAdapterState()
  configureNavigation()
  library = new MixLibrary({
    repository: new InMemoryMixRepository(),
    now: () => 1_700_000_000_000,
  })
  __setMixLibraryForTests(library)
  resetMixesStore()
  installMixLibraryBinding()
  // Default: no pending launch intent. Tests that exercise an incoming
  // share override this with a `kind: 'share'` resolution.
  vi.mocked(RundotAPI.app.resolveLaunchIntent).mockResolvedValue({
    kind: 'none',
    params: {},
  })
})

afterEach(() => {
  __setMixLibraryForTests(null)
  resetMixesStore()
})

describe('Share Service Adapter — outgoing share', () => {
  it('packs the session JSON into shareParams and returns the share URL', async () => {
    vi.mocked(RundotAPI.social.shareLinkAsync).mockResolvedValue({
      shareUrl: 'https://share.mock/beat-1',
      shareLinkId: 'link-1',
    })
    const id = await seedOwnedMix({ title: 'My Beat', kitId: 'lofi_heights_hero' })

    const adapter = createShareServiceAdapter()
    const result = await adapter.shareMix(id)

    expect(result.url).toBe('https://share.mock/beat-1')
    expect(result.payload.sourceMixId).toBe(id)
    expect(result.payload.kitId).toBe('lofi_heights_hero')
    expect(result.payload.v).toBe(String(MIX_SESSION_VERSION))

    // sessionJson must round-trip back to a MixSession.
    const parsed = JSON.parse(result.payload.sessionJson)
    expect(parsed.kitId).toBe('lofi_heights_hero')
    expect(parsed.version).toBe(MIX_SESSION_VERSION)
    expect(Array.isArray(parsed.events)).toBe(true)

    // Outgoing call shape — sessionJson in shareParams, no rich metadata.
    // The production share endpoint creates AppsFlyer OneLinks before it
    // persists shareParams; keeping metadata undefined avoids platform
    // validation 500s while preserving the mix payload.
    expect(RundotAPI.social.shareLinkAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        shareParams: expect.objectContaining({
          sourceMixId: id,
          kitId: 'lofi_heights_hero',
          v: String(MIX_SESSION_VERSION),
        }),
        metadata: undefined,
      }),
    )
  })

  it('rejects sessions larger than the 90KB shareParams cap', async () => {
    // Build a session whose JSON exceeds 90KB by stuffing huge padIds.
    const fatEvents = Array.from({ length: 5_000 }, (_, i) => ({
      t: i,
      type: 'pad_activate' as const,
      padId: 'x'.repeat(100) + i,
    }))
    const id = await library
      .save({
        title: 'fat',
        session: {
          kitId: 'kit_a',
          bpm: 84,
          durationBeats: 999,
          createdAtMs: 0,
          events: fatEvents,
          version: MIX_SESSION_VERSION,
        },
      })
      .then((s) => s.id)

    const adapter = createShareServiceAdapter()
    await expect(adapter.shareMix(id)).rejects.toThrow(/too large/i)
  })

  it('analytics recording_shared fires with mix_id + bytes', async () => {
    vi.mocked(RundotAPI.social.shareLinkAsync).mockResolvedValue({
      shareUrl: 'https://share.mock/x',
      shareLinkId: 'link-x',
    })
    const id = await seedOwnedMix({ title: 't', kitId: 'lofi_heights_hero' })

    const trackSpy = vi.spyOn(analyticsModule, 'track')
    const adapter = createShareServiceAdapter()
    await adapter.shareMix(id)

    expect(trackSpy).toHaveBeenCalledWith(
      'recording_shared',
      expect.objectContaining({
        mix_id: id,
        share_target: 'system_sheet',
        bytes: expect.any(Number),
      }),
    )
  })

  it('records the last share event for debug-api inspection', async () => {
    vi.mocked(RundotAPI.social.shareLinkAsync).mockResolvedValue({
      shareUrl: 'https://share.mock/last',
      shareLinkId: 'link-last',
    })
    const id = await seedOwnedMix({ title: 'last', kitId: 'lofi_heights_hero' })

    const adapter = createShareServiceAdapter()
    await adapter.shareMix(id)

    const last = __getLastShareEvent()
    expect(last?.mixId).toBe(id)
    expect(last?.url).toBe('https://share.mock/last')
  })

  it('rejects when the mix id is unknown', async () => {
    const adapter = createShareServiceAdapter()
    await expect(adapter.shareMix('does-not-exist')).rejects.toThrow(/unknown mixId/)
  })
})

describe('Share Service Adapter — incoming share', () => {
  it('imports the session into MixLibrary and routes to Mixes', async () => {
    const adapter = createShareServiceAdapter()
    const session = {
      kitId: 'lofi_heights_hero',
      bpm: 84,
      durationBeats: 32,
      createdAtMs: 1_700_000_000_500,
      events: [{ t: 0, type: 'pad_activate' as const, padId: 'drums-1' }],
      version: MIX_SESSION_VERSION,
    }

    await adapter.handleIncomingShare({
      sourceMixId: 'mix_friend_001',
      kitId: 'lofi_heights_hero',
      sessionJson: JSON.stringify({
        ...session,
        id: 'mix_friend_001',
        title: 'Friend mix',
      }),
      v: String(MIX_SESSION_VERSION),
    })

    expect(useMixesStore.getState().mixes).toHaveLength(1)
    expect(useMixesStore.getState().mixes[0]!.id).toBe('mix_friend_001')
    expect(useMixesStore.getState().mixes[0]!.title).toBe('Friend mix')
    expect(useNavigationStore.getState().focusedMixId).toBe('mix_friend_001')
    expect(useNavigationStore.getState().activeTab).toBe('mixes')
  })

  it('handling the same payload twice focuses the existing imported row', async () => {
    const adapter = createShareServiceAdapter()
    const payload = {
      sourceMixId: 'mix_dup',
      kitId: 'lofi_heights_hero',
      sessionJson: JSON.stringify({
        id: 'mix_dup',
        title: 'Dupe',
        kitId: 'lofi_heights_hero',
        bpm: 84,
        durationBeats: 32,
        createdAtMs: 1_000,
        events: [],
        version: MIX_SESSION_VERSION,
      }),
      v: String(MIX_SESSION_VERSION),
    }
    await adapter.handleIncomingShare(payload)
    await adapter.handleIncomingShare(payload)
    expect(useMixesStore.getState().mixes).toHaveLength(1)
    expect(useMixesStore.getState().mixes[0]!.id).toBe('mix_dup')
    expect(useNavigationStore.getState().focusedMixId).toBe('mix_dup')
  })

  it('drops payloads with the wrong schema version', async () => {
    const adapter = createShareServiceAdapter()
    await adapter.handleIncomingShare({
      sourceMixId: 'mix_old',
      kitId: 'lofi_heights_hero',
      sessionJson: JSON.stringify({
        id: 'mix_old',
        title: 't',
        kitId: 'lofi_heights_hero',
        bpm: 84,
        durationBeats: 0,
        createdAtMs: 0,
        events: [],
        version: 999, // wrong
      }),
      v: '999',
    })
    expect(useMixesStore.getState().mixes).toEqual([])
    // Still routes to Mixes so the player isn't stranded on Play.
    expect(useNavigationStore.getState().activeTab).toBe('mixes')
  })
})
