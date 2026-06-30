import type { FtueConfig } from './types'

/**
 * Example FTUE config demonstrating gameplay-first contextual pattern.
 *
 * Core loop steps teach by doing (linear phase — plays in sequence during first session).
 * Outer loop steps fire contextually when the player reaches each feature.
 */
export const DEFAULT_FTUE_CONFIG: FtueConfig = {
  storageKey: 'ftue_progress',
  phases: [
    { id: 'core_loop', mode: 'linear', completesWhen: 'all_non_stub' },
    { id: 'outer_loops', mode: 'contextual' },
  ],
  steps: [
    // --- Core loop (linear) — first session teaches by doing ---
    {
      id: 'first_action',
      phase: 'core_loop',
      spotlight: 'action-button',
      message: 'Try your first action',
      tooltipPosition: 'bottom',
      completion: { type: 'first_action_done' },
    },
    {
      id: 'first_reward',
      phase: 'core_loop',
      spotlight: 'reward-area',
      message: 'Collect your reward!',
      tooltipPosition: 'top',
      completion: { type: 'reward_collected' },
      gates: [{ name: 'core_complete', opensOn: 'complete' }],
    },
    // --- Outer loops (contextual) — fire when player reaches feature ---
    {
      id: 'shop_intro',
      phase: 'outer_loops',
      spotlight: 'shop-tab',
      message: 'Check out the shop for upgrades',
      tooltipPosition: 'top',
      completion: { type: 'shop_browsed' },
      trigger: { mode: 'ongoing', condition: 'reached_shop' },
    },
    {
      id: 'social_intro',
      phase: 'outer_loops',
      spotlight: 'social-tab',
      message: 'Play with friends!',
      tooltipPosition: 'top',
      completion: { type: 'social_viewed' },
      trigger: { mode: 'ongoing', condition: 'reached_social' },
    },
  ],
}
