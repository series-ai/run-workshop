import { beforeEach, describe, expect, it, vi } from 'vitest'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import {
  createRundotShareContextSource,
  createRundotShareProvider,
} from './RundotShareProvider'

describe('RundotShareProvider', () => {
  beforeEach(() => {
    vi.mocked(RundotAPI.social.shareLinkAsync).mockResolvedValue({
      shareUrl: 'https://ugc.mock/share',
      shareLinkId: 'share-1',
    })
  })

  it('forwards share-link creation to the SDK', async () => {
    const provider = createRundotShareProvider()
    const result = await provider.shareLink({ entryId: 'ugc-1' }, { title: 'Share me' })

    expect(RundotAPI.social.shareLinkAsync).toHaveBeenCalledWith({
      shareParams: { entryId: 'ugc-1' },
      metadata: { title: 'Share me' },
    })
    expect(result.shareLinkId).toBe('share-1')
  })

  it('reads incoming share context from the resolved launch intent', async () => {
    vi.mocked(RundotAPI.app.resolveLaunchIntent).mockResolvedValue({
      kind: 'share',
      params: { entryId: 'ugc-1' },
      shareLinkId: 'share-1',
    })

    const contextSource = createRundotShareContextSource()

    expect(await contextSource.getIncomingShareParams()).toEqual({ entryId: 'ugc-1' })
    expect(await contextSource.getIncomingShareLinkId()).toBe('share-1')
  })
})
