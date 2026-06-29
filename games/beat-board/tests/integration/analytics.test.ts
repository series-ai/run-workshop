/**
 * Integration test — `src/systems/analytics.ts`
 *
 * Issue beat-board-02-rundot-sdk-integrator. Asserts the typed analytics
 * surface fans out to the underlying SDK (`recordCustomEvent`,
 * `trackFunnelStep`) per PRD § Analytics Events / § Monetization Analytics
 * with the canonical funnel ordering.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import {
  BEATBOARD_FUNNEL_NAME,
  BEATBOARD_FUNNEL_STEPS,
  recordCustomEvent,
  recordFtueCompleted,
  recordFtueStarted,
  recordGameOpened,
  recordPlayerIdentity,
  recordScreenViewed,
  recordSessionEnd,
  trackBeatBoardFunnelStep,
  trackFunnelStep,
} from '../../src/systems/analytics'

describe('BeatBoard analytics — funnel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exposes the seven PRD funnel steps in canonical order', () => {
    // PRD § Analytics Events — first-session funnel ordering is normative.
    expect(Object.keys(BEATBOARD_FUNNEL_STEPS)).toEqual([
      'app_open',
      'first_pad_tap',
      'first_record',
      'mix_saved',
      'first_share',
      'welcome_pack_offer_shown',
      'welcome_pack_purchased',
    ])
    expect(Object.values(BEATBOARD_FUNNEL_STEPS)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('routes named funnel steps to RundotAPI.analytics.trackFunnelStep with the BeatBoard funnel name', () => {
    trackBeatBoardFunnelStep('first_record')
    expect(RundotAPI.analytics.trackFunnelStep).toHaveBeenCalledWith(
      3,
      'first_record',
      BEATBOARD_FUNNEL_NAME,
    )
  })

  it('forwards explicit funnel calls to the SDK with default funnel name when omitted', () => {
    trackFunnelStep(5, 'first_share')
    expect(RundotAPI.analytics.trackFunnelStep).toHaveBeenCalledWith(
      5,
      'first_share',
      BEATBOARD_FUNNEL_NAME,
    )
  })
})

describe('BeatBoard analytics — typed event helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('records game_opened with snake_case entry_point', () => {
    recordGameOpened({ entry_point: 'cold_start' })
    expect(RundotAPI.analytics.recordCustomEvent).toHaveBeenCalledWith('game_opened', {
      entry_point: 'cold_start',
    })
  })

  it('records screen_viewed with PRD-shaped properties', () => {
    recordScreenViewed({ screen: 'play', source: 'tab_tap' })
    expect(RundotAPI.analytics.recordCustomEvent).toHaveBeenCalledWith('screen_viewed', {
      screen: 'play',
      source: 'tab_tap',
    })
  })

  it('records ftue_started / ftue_completed with prd-shaped properties', () => {
    recordFtueStarted({ ftue_variant: 'beatboard_v1' })
    recordFtueCompleted({
      ftue_variant: 'beatboard_v1',
      duration_seconds: 42,
      skipped: false,
    })
    expect(RundotAPI.analytics.recordCustomEvent).toHaveBeenCalledWith('ftue_started', {
      ftue_variant: 'beatboard_v1',
    })
    expect(RundotAPI.analytics.recordCustomEvent).toHaveBeenCalledWith('ftue_completed', {
      ftue_variant: 'beatboard_v1',
      duration_seconds: 42,
      skipped: false,
    })
  })

  it('records session_end normalised to snake_case keys', () => {
    recordSessionEnd({
      screen: 'play',
      trigger: 'background_sleep',
      durationSeconds: 96,
    })
    expect(RundotAPI.analytics.recordCustomEvent).toHaveBeenCalledWith('session_end', {
      screen: 'play',
      trigger: 'background_sleep',
      duration_seconds: 96,
    })
  })

  it('records player_identity normalised to snake_case keys', () => {
    recordPlayerIdentity({ isSignedIn: true, hasProfileName: true })
    expect(RundotAPI.analytics.recordCustomEvent).toHaveBeenCalledWith('player_identity', {
      is_signed_in: true,
      has_profile_name: true,
    })
  })

  it('forwards arbitrary recordCustomEvent calls to the SDK', () => {
    recordCustomEvent('pad_activated', {
      pack_id: 'lofi-heights',
      pad_color: 'drums',
      layer_id: 'kick-hat',
      total_active_after: 2,
    })
    expect(RundotAPI.analytics.recordCustomEvent).toHaveBeenCalledWith('pad_activated', {
      pack_id: 'lofi-heights',
      pad_color: 'drums',
      layer_id: 'kick-hat',
      total_active_after: 2,
    })
  })
})
