import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearAssetLibraryCacheForTests,
  PIRATE_PACKS,
  resolveAssetUrl,
} from './assetLibrary'

const sdk = vi.hoisted(() => ({
  initializeAsync: vi.fn(),
  getPackBaseUrl: vi.fn(),
}))

vi.mock('@series-inc/rundot-game-sdk/api', () => ({
  default: {
    initializeAsync: sdk.initializeAsync,
    get assetLibrary() {
      return { getPackBaseUrl: sdk.getPackBaseUrl }
    },
  },
}))

beforeEach(() => {
  clearAssetLibraryCacheForTests()
  sdk.initializeAsync.mockReset().mockResolvedValue(undefined)
  sdk.getPackBaseUrl.mockReset().mockResolvedValue('https://cdn.example/packs/models/')
})

describe('PIRATE_PACKS', () => {
  it('pins the four jam-ready-assets packs', () => {
    expect(PIRATE_PACKS).toEqual({
      models: { id: 'proofofplay-pirate-nation/3D/pirate', version: '2ae870ead5c1' },
      icons: { id: 'proofofplay-pirate-nation/icons', version: 'ec3e46dfcd27' },
      ui: { id: 'proofofplay-pirate-nation/ui', version: '97835c36f9f1' },
      audio: { id: 'proofofplay-pirate-nation/audio', version: '064b51d95ed5' },
    })
  })
})

describe('resolveAssetUrl', () => {
  it('initializes the SDK before resolving a pack URL and encodes path segments', async () => {
    const order: string[] = []
    sdk.initializeAsync.mockImplementation(async () => {
      order.push('initialize')
    })
    sdk.getPackBaseUrl.mockImplementation(async () => {
      order.push('resolve')
      return 'https://cdn.example/packs/models/'
    })

    await expect(resolveAssetUrl({ pack: 'models', path: 'ships/Previews/ship (1).jpg' }))
      .resolves.toBe('https://cdn.example/packs/models/ships/Previews/ship%20%281%29.jpg')
    expect(order).toEqual(['initialize', 'resolve'])
    expect(sdk.getPackBaseUrl).toHaveBeenCalledWith(
      'proofofplay-pirate-nation/3D/pirate',
      '2ae870ead5c1',
    )
  })

  it('resolves two references in one pack with one base URL request', async () => {
    await Promise.all([
      resolveAssetUrl({ pack: 'models', path: 'ships/ship.glb' }),
      resolveAssetUrl({ pack: 'models', path: 'ships/other.glb' }),
    ])
    expect(sdk.initializeAsync).toHaveBeenCalledTimes(1)
    expect(sdk.getPackBaseUrl).toHaveBeenCalledTimes(1)
  })

  it('removes a rejected base URL so the next request can retry', async () => {
    sdk.getPackBaseUrl
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce('https://cdn.example/packs/models')

    await expect(resolveAssetUrl({ pack: 'models', path: 'ship.glb' }))
      .rejects.toThrow('temporary failure')
    await expect(resolveAssetUrl({ pack: 'models', path: 'ship.glb' }))
      .resolves.toBe('https://cdn.example/packs/models/ship.glb')
    expect(sdk.getPackBaseUrl).toHaveBeenCalledTimes(2)
  })

  it('rejects an empty base URL', async () => {
    sdk.getPackBaseUrl.mockResolvedValue('')
    await expect(resolveAssetUrl({ pack: 'models', path: 'ship.glb' }))
      .rejects.toThrow('empty pack URL')
  })
})
