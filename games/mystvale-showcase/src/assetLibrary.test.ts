import { describe, it, expect, vi, beforeEach } from 'vitest'
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'
import {
  MYSTVALE_PACK,
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

  it('has pinned content version 04811e1dd830', () => {
    expect(MYSTVALE_PACK.id).toBe('series-ai/mystvale')
    expect(MYSTVALE_PACK.version).toBe('04811e1dd830')
  })

  it('resolves asset URLs against the pack base URL', async () => {
    vi.mocked(RundotGameAPI.initializeAsync).mockResolvedValue({} as never)
    vi.mocked(RundotGameAPI.assetLibrary.getPackBaseUrl).mockResolvedValue(
      'https://storage.googleapis.com/run-asset-library/packs/series-ai/mystvale@04811e1dd830',
    )

    const url = await resolveAssetUrl('avatar/avatar-base.png')
    expect(url).toBe(
      'https://storage.googleapis.com/run-asset-library/packs/series-ai/mystvale@04811e1dd830/avatar/avatar-base.png',
    )
    expect(RundotGameAPI.initializeAsync).toHaveBeenCalledTimes(1)
    expect(RundotGameAPI.assetLibrary.getPackBaseUrl).toHaveBeenCalledWith(
      'series-ai/mystvale',
      '04811e1dd830',
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
