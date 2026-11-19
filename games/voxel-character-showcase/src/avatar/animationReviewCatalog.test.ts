import { describe, expect, it } from 'vitest'
import { RIG_IDS, RIG_SPECS } from '@voxchar/contracts/rig'
import {
  CLIP_REVIEW_CATALOG,
  clipReviewKey,
  formatReviewReportMarkdown,
  getClipSpecsForRig,
  isLoopingByDefault,
  summarizeReviews,
} from './animationReviewCatalog'

describe('animationReviewCatalog', () => {
  it('covers 100% of UAL1 (43), Quadruped (6), Arachnid (5), and all 7 animal rigs without duplicates', () => {
    expect(CLIP_REVIEW_CATALOG.ual1).toHaveLength(43)
    expect(CLIP_REVIEW_CATALOG.quadruped).toHaveLength(6)
    expect(CLIP_REVIEW_CATALOG.arachnid).toHaveLength(5)

    for (const rigId of RIG_IDS) {
      const specs = getClipSpecsForRig(rigId)
      const names = specs.map((s) => s.name)
      expect(new Set(names).size).toBe(RIG_SPECS[rigId].clips.length)
      expect(names).toEqual(RIG_SPECS[rigId].clips)
      for (const spec of specs) {
        expect(spec.duration).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('flags known one-shot clips vs looping clips properly', () => {
    expect(isLoopingByDefault('ual1', 'Idle_Loop')).toBe(true)
    expect(isLoopingByDefault('ual1', 'Walk_Loop')).toBe(true)
    expect(isLoopingByDefault('ual1', 'Death01')).toBe(false)
    expect(isLoopingByDefault('ual1', 'Roll')).toBe(false)
    expect(isLoopingByDefault('ual1', 'Pistol_Shoot')).toBe(false)
    expect(isLoopingByDefault('quadruped', 'Death')).toBe(false)
    expect(isLoopingByDefault('quadruped', 'Run')).toBe(true)
  })

  it('assigns context-appropriate held props for UAL1 weapon/tool clips', () => {
    const byName = new Map(CLIP_REVIEW_CATALOG.ual1.map((c) => [c.name, c]))
    expect(byName.get('Pistol_Shoot')?.suggestedHeldRight).toBe('held_voxel_pistol')
    expect(byName.get('Fixing_Kneeling')?.suggestedHeldRight).toBe('held_pipe_wrench')
    expect(byName.get('Idle_Torch_Loop')?.suggestedHeldRight).toBe('held_blowtorch')
    expect(byName.get('Idle_Talking_Loop')?.suggestedHeldLeft).toBe('held_walkie_talkie')
    expect(byName.get('Roll')?.auditNote).toMatch(/below y = 0/i)
  })

  it('summarizes reviews and formats Markdown report cleanly', () => {
    const specs = getClipSpecsForRig('quadruped')
    const reviews = {
      [clipReviewKey('quadruped', 'Idle')]: { status: 'pass' as const, note: 'Clean breathing' },
      [clipReviewKey('quadruped', 'Attack')]: { status: 'issue' as const, note: 'Jaw opens slightly wide' },
    }
    expect(summarizeReviews(specs, reviews)).toEqual({
      total: 6,
      pass: 1,
      issue: 1,
      todo: 4,
    })

    const md = formatReviewReportMarkdown({
      rigId: 'quadruped',
      presetLabel: 'Guard Hound',
      specs,
      reviews,
    })
    expect(md).toContain('# Animation Review Report — Quadruped (23j)')
    expect(md).toContain('**1 pass**, **1 issue**, **4 todo**')
    expect(md).toContain('- [ISSUE] `Attack` (0.90s) — Jaw opens slightly wide')
    expect(md).toContain('- [PASS] `Idle` — Clean breathing')
  })
})
