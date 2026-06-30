import { describe, it, expect, vi, beforeEach } from 'vitest'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { adsService } from './AdsService'

// vi.mock is hoisted above imports — mock is in place before AdsService loads
vi.mock('@series-inc/rundot-game-sdk/api', () => ({
  default: {
    ads: {
      isRewardedAdReadyAsync: vi.fn().mockResolvedValue(true),
      showRewardedAdAsync: vi.fn().mockResolvedValue(true),
      showInterstitialAd: vi.fn().mockResolvedValue(true),
    },
    system: {
      getEnvironment: vi.fn().mockReturnValue({
        platform: 'web',
        isDevelopment: true,
        platformVersion: '1.0.0',
        capabilities: { ads: true, purchases: true },
      }),
    },
    error: vi.fn(),
  },
}))

const mockAds = vi.mocked(RundotAPI['ads'])
const mockSystem = vi.mocked(RundotAPI['system'])

beforeEach(() => {
  vi.clearAllMocks()
})

describe('isRewardedAvailable', () => {
  it('returns true when SDK says ready', async () => {
    mockAds.isRewardedAdReadyAsync.mockResolvedValue(true)
    expect(await adsService.isRewardedAvailable()).toBe(true)
  })

  it('returns false when SDK throws', async () => {
    mockAds.isRewardedAdReadyAsync.mockRejectedValue(new Error('no ad'))
    expect(await adsService.isRewardedAvailable()).toBe(false)
  })
})

describe('areAdsAvailable', () => {
  it('returns true when capabilities.ads is true', () => {
    mockSystem.getEnvironment.mockReturnValue({
      capabilities: { ads: true, purchases: true },
    } as ReturnType<typeof mockSystem.getEnvironment>)
    expect(adsService.areAdsAvailable()).toBe(true)
  })

  it('returns false when capabilities.ads is false (no-ads channel)', () => {
    mockSystem.getEnvironment.mockReturnValue({
      capabilities: { ads: false, purchases: false },
    } as ReturnType<typeof mockSystem.getEnvironment>)
    expect(adsService.areAdsAvailable()).toBe(false)
  })

  it('defaults to true when the capabilities field is absent (older host)', () => {
    mockSystem.getEnvironment.mockReturnValue(
      {} as ReturnType<typeof mockSystem.getEnvironment>,
    )
    expect(adsService.areAdsAvailable()).toBe(true)
  })

  it('defaults to true and reports when getEnvironment throws', () => {
    mockSystem.getEnvironment.mockImplementation(() => {
      throw new Error('not initialized')
    })
    expect(adsService.areAdsAvailable()).toBe(true)
    expect(RundotAPI.error).toHaveBeenCalledWith(
      '[AdsService] areAdsAvailable failed',
      expect.any(Error),
    )
  })
})

describe('showRewarded', () => {
  it('calls showRewardedAdAsync when ad is ready', async () => {
    mockAds.isRewardedAdReadyAsync.mockResolvedValue(true)
    mockAds.showRewardedAdAsync.mockResolvedValue(true)
    const result = await adsService.showRewarded('energy_refill')
    expect(result).toBe(true)
    expect(mockAds.showRewardedAdAsync).toHaveBeenCalledWith({
      adDisplayId: 'energy_refill',
      adDisplayName: 'energy_refill',
    })
  })

  it('returns false without calling showRewardedAdAsync when not ready', async () => {
    mockAds.isRewardedAdReadyAsync.mockResolvedValue(false)
    const result = await adsService.showRewarded('energy_refill')
    expect(result).toBe(false)
    expect(mockAds.showRewardedAdAsync).not.toHaveBeenCalled()
  })

  it('returns false when showRewardedAdAsync throws', async () => {
    mockAds.isRewardedAdReadyAsync.mockResolvedValue(true)
    mockAds.showRewardedAdAsync.mockRejectedValue(new Error('sdk error'))
    expect(await adsService.showRewarded('energy_refill')).toBe(false)
  })
})

describe('showInterstitial', () => {
  it('calls showInterstitialAd and returns result', async () => {
    mockAds.showInterstitialAd.mockResolvedValue(true)
    const result = await adsService.showInterstitial('level_complete')
    expect(result).toBe(true)
    expect(mockAds.showInterstitialAd).toHaveBeenCalledWith({
      adDisplayId: 'level_complete',
      adDisplayName: 'level_complete',
    })
  })

  it('returns false on error', async () => {
    mockAds.showInterstitialAd.mockRejectedValue(new Error('sdk error'))
    expect(await adsService.showInterstitial('level_complete')).toBe(false)
  })
})

describe('getDebugDiagnostics', () => {
  it('tracks last ad checks and errors', async () => {
    mockAds.isRewardedAdReadyAsync.mockResolvedValue(true)
    await adsService.isRewardedAvailable()

    expect(adsService.getDebugDiagnostics()).toEqual(
      expect.objectContaining({
        lastRewardedAvailability: true,
        lastError: null,
      }),
    )

    mockAds.showInterstitialAd.mockRejectedValue(new Error('sdk error'))
    await adsService.showInterstitial('level_complete')

    expect(adsService.getDebugDiagnostics()).toEqual(
      expect.objectContaining({
        lastInterstitialPlacement: 'level_complete',
        lastError: 'sdk error',
      }),
    )
  })
})

describe('SDK error reporting', () => {
  // Regression: integrator no-console rule. SDK errors must route through
  // RundotAPI.error so the platform telemetry sink picks them up; bare
  // console.warn was a silent telemetry hole in every game installing
  // ads-service.
  it('routes setPrivacyConsent failures through RundotAPI.error, not console', async () => {
    const api = (await import('@series-inc/rundot-game-sdk/api')).default as unknown as {
      ads: { setGdprConsent: ReturnType<typeof vi.fn> }
      error: ReturnType<typeof vi.fn>
    }
    api.ads.setGdprConsent = vi.fn().mockRejectedValue(new Error('consent broken'))
    await adsService.setPrivacyConsent(true)
    expect(api.error).toHaveBeenCalledWith(
      '[AdsService] Failed to set consent',
      expect.any(Error),
    )
  })

  it('routes showRewarded failures through RundotAPI.error with placement context', async () => {
    mockAds.isRewardedAdReadyAsync.mockResolvedValue(true)
    mockAds.showRewardedAdAsync.mockRejectedValue(new Error('rewarded broken'))
    await adsService.showRewarded('extra_life')
    expect(RundotAPI.error).toHaveBeenCalledWith(
      '[AdsService] Rewarded ad failed',
      expect.objectContaining({ placement: 'extra_life' }),
    )
  })

  it('routes showInterstitial failures through RundotAPI.error with placement context', async () => {
    mockAds.showInterstitialAd.mockRejectedValue(new Error('interstitial broken'))
    await adsService.showInterstitial('level_complete')
    expect(RundotAPI.error).toHaveBeenCalledWith(
      '[AdsService] Interstitial ad failed',
      expect.objectContaining({ placement: 'level_complete' }),
    )
  })
})
