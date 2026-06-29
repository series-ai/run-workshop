/**
 * Ads service — wraps RundotAPI.ads with readiness checks and API-variant detection.
 * Source: venus-content/H5/cozy-crime/src/services/rundot/adsService.ts
 *
 * All methods return false on failure rather than throwing — ads should never crash the game.
 */

import RundotAPI from '@series-inc/rundot-game-sdk/api'

// ── Internal helpers ──────────────────────────────────────────────────────────

type RundotAdsApi = typeof RundotAPI['ads'] & {
  setGdprConsent?: (consented: boolean) => Promise<void> | void
  setConsent?: (consented: boolean) => Promise<void> | void
  setUserConsent?: (consented: boolean) => Promise<void> | void
}

function getAdsApi(): RundotAdsApi {
  return RundotAPI['ads'] as unknown as RundotAdsApi
}

// ── Service ───────────────────────────────────────────────────────────────────

class AdsService {
  private lastPrivacyConsent: boolean | null = null
  private lastRewardedAvailability: boolean | null = null
  private lastRewardedPlacement: string | null = null
  private lastInterstitialPlacement: string | null = null
  private lastError: string | null = null

  /** Set GDPR/privacy consent. Detects API variant across SDK versions. */
  async setPrivacyConsent(consented: boolean): Promise<void> {
    const api = getAdsApi()
    try {
      if (typeof api.setGdprConsent === 'function') {
        await api.setGdprConsent(consented)
      } else if (typeof api.setConsent === 'function') {
        await api.setConsent(consented)
      } else if (typeof api.setUserConsent === 'function') {
        await api.setUserConsent(consented)
      }
      this.lastPrivacyConsent = consented
      this.lastError = null
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error)
      RundotAPI.error('[AdsService] Failed to set consent', error)
    }
  }

  /**
   * Whether this platform/channel allows rewarded/interstitial ads at all.
   *
   * Reads the channel-static `capabilities.ads` flag from the SDK environment
   * (synchronous and fixed for the session, safe to read after
   * `initializeAsync()`). Distinct from `isRewardedAvailable()`, which probes
   * whether an ad is *loaded right now* on a platform that *does* support ads.
   *
   * Defaults to `true` so existing ad-enabled channels (web / mobile) are
   * unchanged and a host predating the capabilities field keeps working; only
   * an explicit `false` — shipped by no-ads channels such as the Steam build —
   * flips the game onto the RUN Bit bonus path.
   */
  areAdsAvailable(): boolean {
    try {
      const env = RundotAPI.system.getEnvironment() as {
        capabilities?: { ads?: boolean }
      }
      return env.capabilities?.ads !== false
    } catch (error) {
      RundotAPI.error('[AdsService] areAdsAvailable failed', error)
      return true
    }
  }

  /** Check if a rewarded ad is ready to show. */
  async isRewardedAvailable(): Promise<boolean> {
    try {
      const available = await RundotAPI['ads'].isRewardedAdReadyAsync()
      this.lastRewardedAvailability = available
      this.lastError = null
      return available
    } catch {
      this.lastRewardedAvailability = false
      this.lastError = 'isRewardedAdReadyAsync failed'
      return false
    }
  }

  /**
   * Show a rewarded ad.
   * @param placement - Identifier used for analytics (e.g. "energy_refill", "extra_life")
   * @returns true if the user watched the ad and should receive the reward
   */
  async showRewarded(placement: string): Promise<boolean> {
    try {
      this.lastRewardedPlacement = placement
      const ready = await this.isRewardedAvailable()
      if (!ready) return false
      const rewarded = await RundotAPI['ads'].showRewardedAdAsync({
        adDisplayId: placement,
        adDisplayName: placement,
      })
      this.lastError = null
      return rewarded
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error)
      RundotAPI.error('[AdsService] Rewarded ad failed', { placement, error })
      return false
    }
  }

  /**
   * Show an interstitial (forced) ad.
   * @param placement - Identifier used for analytics (e.g. "level_complete")
   * @returns true if shown successfully
   */
  async showInterstitial(placement: string): Promise<boolean> {
    try {
      this.lastInterstitialPlacement = placement
      const shown = await RundotAPI['ads'].showInterstitialAd({
        adDisplayId: placement,
        adDisplayName: placement,
      })
      this.lastError = null
      return shown
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error)
      RundotAPI.error('[AdsService] Interstitial ad failed', { placement, error })
      return false
    }
  }

  getDebugDiagnostics() {
    return {
      lastPrivacyConsent: this.lastPrivacyConsent,
      lastRewardedAvailability: this.lastRewardedAvailability,
      lastRewardedPlacement: this.lastRewardedPlacement,
      lastInterstitialPlacement: this.lastInterstitialPlacement,
      lastError: this.lastError,
    }
  }
}

export const adsService = new AdsService()
