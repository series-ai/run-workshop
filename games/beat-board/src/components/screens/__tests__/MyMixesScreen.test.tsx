/**
 * MyMixesScreen — tile-grid tests.
 *
 * Sessions-only model: each mix is a JSON timeline. Tile renders
 * cover + title + duration; tap opens the detail modal which carries
 * play/share/rename/delete.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import * as React from 'react'

import { InMemoryMixRepository } from '../../../systems/mixes/in-memory-repo'
import { MixLibrary } from '../../../systems/mixes/library'
import { __setMixLibraryForTests, MIX_SESSION_VERSION } from '../../../systems/mixes'
import {
  installMixLibraryBinding,
  resetMixesStore,
  saveMix,
} from '../../../stores/mixesStore'
import { MyMixesScreen } from '../MyMixesScreen'
import { useNavigationStore } from '../../../stores/navigationStore'
import '../../../tabs/tabConfig'

const h = React.createElement

let library: MixLibrary

function buildSession(kitId = 'kit_alpha') {
  return {
    kitId,
    bpm: 84,
    durationBeats: 32,
    createdAtMs: 0,
    events: [],
    version: MIX_SESSION_VERSION,
  }
}

beforeEach(() => {
  library = new MixLibrary({
    repository: new InMemoryMixRepository(),
    now: () => 1_700_000_000_000,
  })
  __setMixLibraryForTests(library)
  resetMixesStore()
  installMixLibraryBinding()
  useNavigationStore.setState({ activeTab: 'mixes', modalStack: [] })
})

afterEach(() => {
  cleanup()
  __setMixLibraryForTests(null)
  resetMixesStore()
})

describe('MyMixesScreen — empty state', () => {
  it('shows the "No mixes yet" CTA when the list is empty', () => {
    render(h(MyMixesScreen))
    expect(screen.getByTestId('mixes-empty-state')).toBeInTheDocument()
    expect(screen.getByTestId('mixes-empty-cta')).toHaveTextContent(/pad grid/i)
  })

  it('clicking the empty CTA switches to the play tab', () => {
    render(h(MyMixesScreen))
    fireEvent.click(screen.getByTestId('mixes-empty-cta'))
    expect(useNavigationStore.getState().activeTab).toBe('play')
  })
})

describe('MyMixesScreen — populated grid', () => {
  it('renders one tile per saved mix', async () => {
    await saveMix({ title: 'Sunrise Loop', session: buildSession() })
    await saveMix({ title: 'Late Train', session: buildSession() })
    render(h(MyMixesScreen))
    expect(screen.getByTestId('my-mixes-grid')).toBeInTheDocument()
    expect(screen.getAllByTestId(/^mix-tile-mix_/)).toHaveLength(2)
    expect(screen.getByText(/Sunrise Loop/)).toBeInTheDocument()
    expect(screen.getByText(/Late Train/)).toBeInTheDocument()
  })

  it('header count reflects the number of mixes', async () => {
    await saveMix({ title: 'one', session: buildSession() })
    render(h(MyMixesScreen))
    expect(screen.getByText(/My Mixes \(1\)/)).toBeInTheDocument()
  })

  it('does NOT render any inline play, rename, or kebab controls', async () => {
    const saved = await saveMix({ title: 'no inline ctrls', session: buildSession() })
    render(h(MyMixesScreen))
    expect(screen.queryByTestId(`mix-play-${saved.id}`)).not.toBeInTheDocument()
    expect(screen.queryByTestId(`mix-menu-${saved.id}`)).not.toBeInTheDocument()
    expect(screen.queryByTestId(`mix-rename-${saved.id}`)).not.toBeInTheDocument()
    expect(screen.queryByTestId(`mix-media-${saved.id}`)).not.toBeInTheDocument()
  })
})

describe('MyMixesScreen — tap navigation', () => {
  it('clicking a tile opens RecordingReview in replay mode with the mix id', async () => {
    const saved = await saveMix({ title: 'open me', session: buildSession() })
    render(h(MyMixesScreen))
    fireEvent.click(screen.getByTestId(`mix-tile-${saved.id}`))
    const nav = useNavigationStore.getState()
    expect(nav.modalStack).toContain('recordingReview')
    const params = nav.modalParams['recordingReview']
    expect(params).toMatchObject({ mixId: saved.id, mode: 'replay' })
  })

  it('opens the focused imported mix when a share deep link routes to Mixes', async () => {
    const saved = await saveMix({ title: 'shared', session: buildSession() })
    useNavigationStore.getState().setFocusedMix(saved.id, true)

    render(h(MyMixesScreen))

    const nav = useNavigationStore.getState()
    expect(nav.modalStack).toContain('recordingReview')
    expect(nav.modalParams['recordingReview']).toMatchObject({
      mixId: saved.id,
      mode: 'replay',
    })
    expect(nav.focusedMixId).toBeNull()
  })

  it('Enter on a focused tile also opens the detail modal', async () => {
    const saved = await saveMix({ title: 'kbd nav', session: buildSession() })
    render(h(MyMixesScreen))
    fireEvent.keyDown(screen.getByTestId(`mix-tile-${saved.id}`), { key: 'Enter' })
    expect(useNavigationStore.getState().modalStack).toContain('recordingReview')
  })
})
