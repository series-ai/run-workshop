import {
  ANIMAL_RIG_CONTRACTS,
  ARACHNID_RIG,
  QUADRUPED_RIG,
  RIG_IDS,
  RIG_SPECS,
  UAL1_RIG,
  isAnimalRig,
  type RigId,
} from '@voxchar/contracts/rig'

export type AnimationCategory =
  | 'Idle & Social'
  | 'Locomotion'
  | 'Work & Interact'
  | 'Combat & Weapons'
  | 'Magic & Reactions'
  | 'Creature'

export type ReviewStatus = 'todo' | 'pass' | 'issue'

export interface ClipReviewEntry {
  status: ReviewStatus
  note: string
  updatedAt?: string
}

export interface ClipReviewSpec {
  rigId: RigId
  name: string
  duration: number
  category: AnimationCategory
  isOneShot: boolean
  suggestedHeldRight?: string | null
  suggestedHeldLeft?: string | null
  auditNote?: string
}

const KNOWN_AUDIT_NOTES: Readonly<Record<string, string>> = {
  A_TPose: 'Rest/bind pose — verify shoulders, neck drop into shirt, and hand socket alignment.',
  Roll: 'Known UAL1 audit finding: pelvis/root dips below y = 0 mid-roll.',
  Sitting_Idle_Loop: 'Known UAL1 audit note: forearms/hands sit close to thighs; check heavy physique clearance.',
  Idle_Torch_Loop: 'Pairs with held right-hand prop (blowtorch/lantern style raise).',
  Fixing_Kneeling: 'Long 5.2s kneeling repair cycle — check knee-to-ground contact and wrench reach.',
}

const ONE_SHOT_CLIPS = new Set<string>([
  'Death01',
  'Death',
  'death',
  'dead',
  'Hit_Chest',
  'Hit_Head',
  'Hit_Knockback',
  'Interact',
  'Jump_Land',
  'Jump_Start',
  'NinjaJump_Land',
  'NinjaJump_Start',
  'ClimbUp_1m',
  'Slide_Start',
  'Slide_Exit',
  'LayToIdle',
  'Chest_Open',
  'Consume',
  'Idle_Rail_Call',
  'Idle_Shield_Break',
  'Yes',
  'PickUp_Table',
  'Pistol_Reload',
  'Pistol_Shoot',
  'Punch_Cross',
  'Punch_Jab',
  'Melee_Hook',
  'Melee_Hook_Rec',
  'OverhandThrow',
  'Shield_Dash',
  'Shield_OneShot',
  'Sword_Dash',
  'Sword_Heavy_Combo',
  'Sword_Regular_A',
  'Sword_Regular_A_Rec',
  'Sword_Regular_B',
  'Sword_Regular_B_Rec',
  'Sword_Regular_C',
  'Sword_Regular_Combo',
  'Zombie_Scratch',
  'Melee_2H_Attack_Chop',
  'Melee_2H_Attack_Slice',
  'Melee_2H_Attack_Spin',
  'Melee_2H_Attack_Stab',
  'Ranged_2H_Aiming',
  'Ranged_2H_Reload',
  'Ranged_2H_Shoot',
  'Roll',
  'Sitting_Enter',
  'Sitting_Exit',
  'Spell_Simple_Enter',
  'Spell_Simple_Exit',
  'Spell_Simple_Shoot',
  'Sword_Attack',
  'Attack',
  'attack',
  'Howl',
  'howl',
  'bark',
  'bite',
  'fall',
  'jump',
  'Head_But',
  'Kick',
  'Rear',
  'AnimalArmature|Attack',
  'AnimalArmature|Death',
  'AnimalArmature|Jump_ToIdle',
  'play_dead',
  'play_dead_enter',
  'play_dead_exit',
  'jump_up',
  'jump_down',
  'land',
  'pounce',
  'paw_swipe',
  'Bite',
  'Hit',
  'Dead_Floating',
  'Hop',
  'Take_Off',
  'Land',
  'Fire_Breath',
  'Roar',
  'Hurt',
  'Tail_Attack',
])

function categorizeUal1Clip(name: string): AnimationCategory {
  if (
    name === 'A_TPose' ||
    name === 'Yes' ||
    name === 'LayToIdle' ||
    name === 'Zombie_Idle_Loop' ||
    name.startsWith('Idle_') ||
    name.startsWith('Sitting_')
  ) {
    return 'Idle & Social'
  }
  if (
    name.startsWith('Walk_') ||
    name.startsWith('Jog_') ||
    name.startsWith('Sprint_') ||
    name.startsWith('Crouch_') ||
    name.startsWith('Jump_') ||
    name.startsWith('NinjaJump_') ||
    name.startsWith('Slide_') ||
    name.startsWith('Swim_') ||
    name === 'ClimbUp_1m' ||
    name === 'Zombie_Walk_Fwd_Loop' ||
    name === 'Roll'
  ) {
    return 'Locomotion'
  }
  if (
    name === 'Interact' ||
    name === 'PickUp_Table' ||
    name === 'Push_Loop' ||
    name === 'Fixing_Kneeling' ||
    name === 'Driving_Loop' ||
    name === 'Chest_Open' ||
    name === 'Consume' ||
    name === 'TreeChopping_Loop' ||
    name.startsWith('Farm_')
  ) {
    return 'Work & Interact'
  }
  if (
    name.startsWith('Pistol_') ||
    name.startsWith('Sword_') ||
    name.startsWith('Punch_') ||
    name.startsWith('Shield_') ||
    name.startsWith('Melee_') ||
    name.startsWith('Ranged_2H_') ||
    name === 'OverhandThrow' ||
    name === 'Zombie_Scratch'
  ) {
    return 'Combat & Weapons'
  }
  return 'Magic & Reactions'
}

function suggestedPropsForUal1(name: string): {
  suggestedHeldRight?: string | null
  suggestedHeldLeft?: string | null
} {
  if (name.startsWith('Pistol_') || name.startsWith('Ranged_2H_')) {
    return { suggestedHeldRight: 'held_voxel_pistol', suggestedHeldLeft: null }
  }
  if (name === 'Melee_2H_Attack_Chop') {
    return { suggestedHeldRight: 'held_warhammer', suggestedHeldLeft: null }
  }
  if (name.startsWith('Melee_2H_')) {
    return { suggestedHeldRight: 'held_broadsword', suggestedHeldLeft: null }
  }
  if (name.startsWith('Idle_Shield_') || name.startsWith('Shield_')) {
    return { suggestedHeldRight: 'held_broadsword', suggestedHeldLeft: 'held_heater_shield' }
  }
  if (name.startsWith('Sword_')) {
    return { suggestedHeldRight: 'held_broadsword', suggestedHeldLeft: null }
  }
  if (name === 'TreeChopping_Loop') return { suggestedHeldRight: 'held_warhammer', suggestedHeldLeft: null }
  if (name === 'Fixing_Kneeling') return { suggestedHeldRight: 'held_pipe_wrench', suggestedHeldLeft: null }
  if (name === 'Idle_Torch_Loop' || name === 'Idle_Lantern_Loop') {
    return { suggestedHeldRight: 'held_blowtorch', suggestedHeldLeft: null }
  }
  if (name === 'Idle_TalkingPhone_Loop') return { suggestedHeldRight: 'held_walkie_talkie', suggestedHeldLeft: null }
  if (name === 'Idle_Talking_Loop') return { suggestedHeldRight: null, suggestedHeldLeft: 'held_walkie_talkie' }
  if (
    name === 'Push_Loop' ||
    name === 'Walk_Carry_Loop' ||
    name === 'Idle_FoldArms_Loop' ||
    name === 'OverhandThrow' ||
    name.startsWith('Melee_Hook') ||
    name.startsWith('Punch_') ||
    name.startsWith('Swim_') ||
    name.startsWith('Spell_')
  ) {
    return { suggestedHeldRight: null, suggestedHeldLeft: null }
  }
  return {}
}

function buildRigCatalog(rigId: RigId): readonly ClipReviewSpec[] {
  const sourceClips =
    rigId === 'ual1'
      ? UAL1_RIG.clips
      : rigId === 'quadruped'
        ? QUADRUPED_RIG.clips
        : rigId === 'arachnid'
          ? ARACHNID_RIG.clips
          : isAnimalRig(rigId)
            ? ANIMAL_RIG_CONTRACTS[rigId].clips
            : []

  return sourceClips.map((clip) => {
    const props = rigId === 'ual1' ? suggestedPropsForUal1(clip.name) : {}
    return {
      rigId,
      name: clip.name,
      duration: clip.duration,
      category: rigId === 'ual1' ? categorizeUal1Clip(clip.name) : 'Creature',
      isOneShot: ONE_SHOT_CLIPS.has(clip.name),
      ...props,
      ...(KNOWN_AUDIT_NOTES[clip.name] ? { auditNote: KNOWN_AUDIT_NOTES[clip.name] } : {}),
    }
  })
}

export const CLIP_REVIEW_CATALOG: Readonly<Record<RigId, readonly ClipReviewSpec[]>> = Object.fromEntries(
  RIG_IDS.map((id) => [id, buildRigCatalog(id)]),
) as Readonly<Record<RigId, readonly ClipReviewSpec[]>>

export const UAL1_REVIEW_CATEGORIES: readonly AnimationCategory[] = [
  'Idle & Social',
  'Locomotion',
  'Work & Interact',
  'Combat & Weapons',
  'Magic & Reactions',
]

export function clipReviewKey(rigId: RigId, clipName: string): string {
  return `${rigId}:${clipName}`
}

export function getClipSpecsForRig(rigId: RigId): readonly ClipReviewSpec[] {
  return CLIP_REVIEW_CATALOG[rigId]
}

export function isLoopingByDefault(rigId: RigId, clipName: string): boolean {
  const spec = CLIP_REVIEW_CATALOG[rigId].find((c) => c.name === clipName)
  return spec ? !spec.isOneShot : clipName !== 'Death' && clipName !== 'Death01'
}

export function summarizeReviews(
  specs: readonly ClipReviewSpec[],
  reviews: Readonly<Record<string, ClipReviewEntry>>,
): { total: number; pass: number; issue: number; todo: number } {
  let pass = 0
  let issue = 0
  let todo = 0
  for (const spec of specs) {
    const entry = reviews[clipReviewKey(spec.rigId, spec.name)]
    if (entry?.status === 'pass') pass++
    else if (entry?.status === 'issue') issue++
    else todo++
  }
  return { total: specs.length, pass, issue, todo }
}

export function formatReviewReportMarkdown(params: {
  rigId: RigId
  presetLabel: string
  specs: readonly ClipReviewSpec[]
  reviews: Readonly<Record<string, ClipReviewEntry>>
}): string {
  const { rigId, presetLabel, specs, reviews } = params
  const summary = summarizeReviews(specs, reviews)
  const lines: string[] = [
    `# Animation Review Report — ${RIG_SPECS[rigId].label}`,
    `- Subject preset: **${presetLabel}**`,
    `- Progress: **${summary.pass} pass**, **${summary.issue} issue**, **${summary.todo} todo** (${summary.total} total)`,
    '',
  ]

  const issues = specs.filter((s) => reviews[clipReviewKey(s.rigId, s.name)]?.status === 'issue')
  const passes = specs.filter((s) => reviews[clipReviewKey(s.rigId, s.name)]?.status === 'pass')
  const notedTodos = specs.filter((s) => {
    const r = reviews[clipReviewKey(s.rigId, s.name)]
    return (!r || r.status === 'todo') && Boolean(r?.note?.trim())
  })

  if (issues.length > 0) {
    lines.push('## Issues')
    for (const s of issues) {
      const note = reviews[clipReviewKey(s.rigId, s.name)]?.note?.trim()
      lines.push(`- [ISSUE] \`${s.name}\` (${s.duration.toFixed(2)}s)${note ? ` — ${note}` : ''}`)
    }
    lines.push('')
  }

  if (notedTodos.length > 0) {
    lines.push('## Notes (Unmarked)')
    for (const s of notedTodos) {
      const note = reviews[clipReviewKey(s.rigId, s.name)]?.note?.trim()
      lines.push(`- [NOTE] \`${s.name}\` (${s.duration.toFixed(2)}s) — ${note}`)
    }
    lines.push('')
  }

  if (passes.length > 0) {
    lines.push('## Passed')
    for (const s of passes) {
      const note = reviews[clipReviewKey(s.rigId, s.name)]?.note?.trim()
      lines.push(`- [PASS] \`${s.name}\`${note ? ` — ${note}` : ''}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}
