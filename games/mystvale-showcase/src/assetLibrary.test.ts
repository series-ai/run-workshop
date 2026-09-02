import { describe, it, expect, vi, beforeEach } from 'vitest'
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'
import {
  MYSTVALE_PACKS,
  resolveAssetUrl,
  clearAssetLibraryCacheForTests,
} from './assetLibrary'

vi.mock('@series-inc/rundot-game-sdk/api', () => ({
  default: {
    initializeAsync: vi.fn(),
    assetLibrary: {
      getPackBaseUrl: vi.fn(),
    },
  },
}))

describe('assetLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearAssetLibraryCacheForTests()
  })

  it('has pinned content versions for 2d, ui, icons, and audio', () => {
    expect(MYSTVALE_PACKS['2d'].id).toBe('series-ai-mystvale/2D/top-down-rpg')
    expect(MYSTVALE_PACKS['2d'].version).toBe('772c5adf50fb')
    expect(MYSTVALE_PACKS.ui.id).toBe('series-ai-mystvale/ui')
    expect(MYSTVALE_PACKS.ui.version).toBe('15af28714f4d')
    expect(MYSTVALE_PACKS.icons.id).toBe('series-ai-mystvale/icons')
    expect(MYSTVALE_PACKS.icons.version).toBe('f4d3822f6da3')
    expect(MYSTVALE_PACKS.audio.id).toBe('series-ai-mystvale/audio')
    expect(MYSTVALE_PACKS.audio.version).toBe('700bc6650a6d')
  })

  it('resolves 2D asset URLs against the 2D pack base URL', async () => {
    vi.mocked(RundotGameAPI.initializeAsync).mockResolvedValue({} as never)
    vi.mocked(RundotGameAPI.assetLibrary.getPackBaseUrl).mockResolvedValue(
      'https://storage.googleapis.com/run-asset-library/packs/series-ai-mystvale/2D/top-down-rpg@772c5adf50fb',
    )

    const url = await resolveAssetUrl('avatar/avatar-base.png')
    expect(url).toBe(
      'https://storage.googleapis.com/run-asset-library/packs/series-ai-mystvale/2D/top-down-rpg@772c5adf50fb/avatar/avatar-base.png',
    )
    expect(RundotGameAPI.initializeAsync).toHaveBeenCalledTimes(1)
    expect(RundotGameAPI.assetLibrary.getPackBaseUrl).toHaveBeenCalledWith(
      'series-ai-mystvale/2D/top-down-rpg',
      '772c5adf50fb',
    )
  })

  it('routes UI asset paths to the UI pack base URL', async () => {
    vi.mocked(RundotGameAPI.initializeAsync).mockResolvedValue({} as never)
    vi.mocked(RundotGameAPI.assetLibrary.getPackBaseUrl).mockResolvedValue(
      'https://storage.googleapis.com/run-asset-library/packs/series-ai-mystvale/ui@15af28714f4d',
    )

    const url = await resolveAssetUrl('ui/btn-brown.png')
    expect(url).toBe(
      'https://storage.googleapis.com/run-asset-library/packs/series-ai-mystvale/ui@15af28714f4d/btn-brown.png',
    )
    expect(RundotGameAPI.assetLibrary.getPackBaseUrl).toHaveBeenCalledWith(
      'series-ai-mystvale/ui',
      '15af28714f4d',
    )
  })

  it('evicts failed base URL from cache and allows retry', async () => {
    vi.mocked(RundotGameAPI.initializeAsync).mockResolvedValue({} as never)
    vi.mocked(RundotGameAPI.assetLibrary.getPackBaseUrl)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce('https://cdn.example.com/mystvale')

    await expect(resolveAssetUrl('crops/crop_wheat_0.png')).rejects.toThrow('Network error')

    // Subsequent call should retry and succeed
    const url = await resolveAssetUrl('crops/crop_wheat_0.png')
    expect(url).toBe('https://cdn.example.com/mystvale/crops/crop_wheat_0.png')
    expect(RundotGameAPI.assetLibrary.getPackBaseUrl).toHaveBeenCalledTimes(2)
  })
})
