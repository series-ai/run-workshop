import type { Kit, PadColor, PadMeta } from '../types/kit'
import {
  selectElementsForTier,
  validateDynamicMusicManifest,
  type DynamicMusicElement,
  type DynamicMusicElementRole,
  type DynamicMusicManifest,
  type DynamicMusicQualityTier,
} from '@modules/audio/dynamic-music/DynamicMusic'

export type BeatBoardMusicQualityTier = DynamicMusicQualityTier
export type BeatBoardDynamicMusicElement = DynamicMusicElement
export type BeatBoardDynamicMusicManifest = DynamicMusicManifest

export interface BeatBoardMusicDebugInput {
  activePadIds: string[]
  queuedPadIds: string[]
  qualityTier: BeatBoardMusicQualityTier
}

export interface BeatBoardMusicDebugSnapshot {
  currentStateId: 'play'
  qualityTier: BeatBoardMusicQualityTier
  activeElementIds: string[]
  queuedElementIds: string[]
  availableElementIds: string[]
}

export function toDynamicMusicManifest(kit: Kit): BeatBoardDynamicMusicManifest {
  const elements = kit.pads.map((pad) => toElement(kit, pad))
  return validateDynamicMusicManifest({
    version: 1,
    bpm: kit.bpm,
    timeSig: [4, 4],
    defaultState: 'play',
    elements,
    states: [
      {
        id: 'play',
        quantize: 'bar',
        elementIds: elements.map((element) => element.id),
        successorIds: [],
        preloadIds: elements.filter((element) => element.minTier !== 'full').map((element) => element.id),
      },
    ],
    transitions: [],
    quality: { defaultTier: 'reduced' },
  })
}

export function selectBeatBoardElementsForTier(
  manifest: BeatBoardDynamicMusicManifest,
  tier: BeatBoardMusicQualityTier,
): BeatBoardDynamicMusicElement[] {
  return selectElementsForTier(manifest, 'play', tier)
}

export function buildBeatBoardMusicDebugSnapshot(
  manifest: BeatBoardDynamicMusicManifest,
  input: BeatBoardMusicDebugInput,
): BeatBoardMusicDebugSnapshot {
  const available = selectBeatBoardElementsForTier(manifest, input.qualityTier).map((element) => element.id)
  return {
    currentStateId: 'play',
    qualityTier: input.qualityTier,
    activeElementIds: input.activePadIds.filter((id) => available.includes(id)),
    queuedElementIds: input.queuedPadIds.filter((id) => available.includes(id)),
    availableElementIds: available,
  }
}

function toElement(kit: Kit, pad: PadMeta): DynamicMusicElement {
  return {
    id: pad.padId,
    role: roleForColor(pad.color),
    kind: pad.isOneShot ? 'stinger' : 'loop',
    url: pad.bufferUrl,
    bars: pad.isOneShot ? 1 : 4,
    bpm: kit.bpm,
    keyGroup: kit.key,
    tags: [pad.color, pad.bank, pad.blockId, pad.layerId, pad.layerName],
    minTier: tierForPad(pad),
    source: {
      generatedBy: 'beat-board-adapter',
    },
  }
}

function roleForColor(color: PadColor): DynamicMusicElementRole {
  switch (color) {
    case 'drums':
      return 'pulse'
    case 'bass':
      return 'bass'
    case 'melody':
    case 'vocals':
      return 'texture'
    case 'drumFills':
    case 'fx':
      return 'accent'
  }
}

function tierForPad(pad: PadMeta): BeatBoardMusicQualityTier {
  if (pad.isOneShot) return 'full'
  if (pad.color === 'drums') return 'fallback'
  return 'reduced'
}
