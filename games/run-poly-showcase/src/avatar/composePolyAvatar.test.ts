import { describe, expect, it } from 'vitest'
import type { PackCatalog } from '@poly/contracts/catalog'
import { CONTEXT_DEFAULT_PALETTES } from '@poly/contracts/palette'
import { PROPORTION_DEFAULTS } from '@poly/contracts/catalog'
import { PolyPartIndex, resolveVisibleParts, type PolyAvatarSelection } from './composePolyAvatar'

const MOCK_CORE: PackCatalog = {
  version: 1,
  pack: 'core',
  label: 'Core',
  license: 'CC0-1.0',
  rigModelPath: 'core-rig.glb',
  clips: ['Idle_Loop', 'Walk_Loop'],
  parts: [
    { id: 'body_athletic', pack: 'core', leaf: 'characters', relativePath: 'core-rig.glb', nodeName: 'body_athletic', slot: 'body', label: 'Athletic', triangles: 720, rules: { hidesHair: false, hidesLegsUpper: false } },
    { id: 'head_hero', pack: 'core', leaf: 'characters', relativePath: 'core-rig.glb', nodeName: 'head_hero', slot: 'head', label: 'Hero', triangles: 180, rules: { hidesHair: false, hidesLegsUpper: false } },
    { id: 'hair_short_part', pack: 'core', leaf: 'characters', relativePath: 'core-rig.glb', nodeName: 'hair_short_part', slot: 'hair', label: 'Short Part', triangles: 120, rules: { hidesHair: false, hidesLegsUpper: false } },
  ],
  heldItems: [],
  props: [],
  presets: [],
}

const MOCK_MED: PackCatalog = {
  version: 1,
  pack: 'medieval',
  label: 'Medieval',
  license: 'LicenseRef-RUN-Repository-Supplemental-1.0',
  clips: [],
  parts: [
    { id: 'torso_medieval_knight', pack: 'medieval', leaf: 'characters', relativePath: 'medieval-parts.glb', nodeName: 'torso_medieval_knight', slot: 'torso', label: 'Knight', triangles: 440, rules: { hidesHair: false, hidesLegsUpper: false } },
    { id: 'legs_medieval_greaves', pack: 'medieval', leaf: 'characters', relativePath: 'medieval-parts.glb', nodeName: 'legs_medieval_greaves', slot: 'legs', label: 'Greaves', triangles: 320, rules: { hidesHair: false, hidesLegsUpper: false } },
    { id: 'headwear_great_helm', pack: 'medieval', leaf: 'characters', relativePath: 'medieval-parts.glb', nodeName: 'headwear_great_helm', slot: 'headwear', label: 'Great Helm', triangles: 240, rules: { hidesHair: true, hidesLegsUpper: false } },
  ],
  heldItems: [],
  props: [],
  presets: [],
}

describe('composePolyAvatar', () => {
  it('hides hair when enclosing headwear sets hidesHair=true', () => {
    const idx = new PolyPartIndex([MOCK_CORE, MOCK_MED])
    const base: PolyAvatarSelection = {
      body: 'body_athletic',
      head: 'head_hero',
      hair: 'hair_short_part',
      torso: 'torso_medieval_knight',
      legs: 'legs_medieval_greaves',
      headwear: 'headwear_great_helm',
      back: null,
      heldRight: null,
      heldLeft: null,
      clip: 'Idle_Loop',
      palette: { ...CONTEXT_DEFAULT_PALETTES.medieval },
      proportions: { ...PROPORTION_DEFAULTS },
    }
    const vis = resolveVisibleParts(base, idx)
    expect(vis.parts.map((p) => p.id)).not.toContain('hair_short_part')
    expect(vis.totalTriangles).toBe(720 + 180 + 440 + 320 + 240)
  })
})
