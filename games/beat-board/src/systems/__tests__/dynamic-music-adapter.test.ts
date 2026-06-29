import { describe, expect, it } from 'vitest'
import {
  buildBeatBoardMusicDebugSnapshot,
  selectBeatBoardElementsForTier,
  toDynamicMusicManifest,
} from '../dynamic-music-adapter'
import { validateDynamicMusicManifest } from '@modules/audio/dynamic-music/DynamicMusic'
import type { Kit } from '../../types/kit'

const kit: Kit = {
  id: 'test-kit',
  name: 'Test Kit',
  bpm: 84,
  key: 'Cmin',
  pads: [
    {
      padId: 'A-block-0-0',
      color: 'drums',
      bank: 'A',
      blockId: 'block-0',
      variantIndex: 0,
      isOneShot: false,
      layerId: 'drums-a',
      bufferUrl: 'audio/test/drums.mp3',
      layerName: 'Drums',
    },
    {
      padId: 'A-block-1-0',
      color: 'bass',
      bank: 'A',
      blockId: 'block-1',
      variantIndex: 0,
      isOneShot: false,
      layerId: 'bass-a',
      bufferUrl: 'audio/test/bass.mp3',
      layerName: 'Bass',
    },
    {
      padId: 'A-block-4-0',
      color: 'drumFills',
      bank: 'A',
      blockId: 'block-4',
      variantIndex: 0,
      isOneShot: true,
      layerId: 'fill-a',
      bufferUrl: 'audio/test/fill.mp3',
      layerName: 'Fill',
    },
  ],
}

describe('dynamic music adapter', () => {
  it('converts a Beat Board kit into the upstream dynamic music manifest shape', () => {
    const manifest = toDynamicMusicManifest(kit)

    expect(manifest).toMatchObject({
      version: 1,
      bpm: 84,
      timeSig: [4, 4],
      defaultState: 'play',
      quality: { defaultTier: 'reduced' },
    })
    expect(manifest.elements.map((element) => [element.id, element.role, element.kind])).toEqual([
      ['A-block-0-0', 'pulse', 'loop'],
      ['A-block-1-0', 'bass', 'loop'],
      ['A-block-4-0', 'accent', 'stinger'],
    ])
    expect(manifest.states[0].elementIds).toEqual(['A-block-0-0', 'A-block-1-0', 'A-block-4-0'])
    expect(validateDynamicMusicManifest(manifest)).toBe(manifest)
  })

  it('applies dynamic music tier filtering to Beat Board kit elements', () => {
    const manifest = toDynamicMusicManifest(kit)

    expect(selectBeatBoardElementsForTier(manifest, 'fallback').map((element) => element.id)).toEqual([
      'A-block-0-0',
    ])
    expect(selectBeatBoardElementsForTier(manifest, 'reduced').map((element) => element.id)).toEqual([
      'A-block-0-0',
      'A-block-1-0',
    ])
    expect(selectBeatBoardElementsForTier(manifest, 'full').map((element) => element.id)).toEqual([
      'A-block-0-0',
      'A-block-1-0',
      'A-block-4-0',
    ])
  })

  it('builds a debug snapshot from Beat Board state without touching the audio graph', () => {
    const manifest = toDynamicMusicManifest(kit)
    const snapshot = buildBeatBoardMusicDebugSnapshot(manifest, {
      activePadIds: ['A-block-0-0', 'A-block-4-0'],
      queuedPadIds: ['A-block-1-0'],
      qualityTier: 'full',
    })

    expect(snapshot).toEqual({
      currentStateId: 'play',
      qualityTier: 'full',
      activeElementIds: ['A-block-0-0', 'A-block-4-0'],
      queuedElementIds: ['A-block-1-0'],
      availableElementIds: ['A-block-0-0', 'A-block-1-0', 'A-block-4-0'],
    })
  })
})
