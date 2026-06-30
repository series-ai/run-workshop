import RundotAPI from '@series-inc/rundot-game-sdk/api'
import type {
  ShareClickData,
  ShareContextSource,
  ShareMetadata,
  ShareParams,
  ShareProvider,
  ShareResult,
} from '@modules/data/share-service/ShareService'

export function createRundotShareProvider(): ShareProvider {
  return {
    async shareLink(params: ShareParams, metadata?: ShareMetadata): Promise<ShareResult> {
      const result = await RundotAPI['social'].shareLinkAsync({
        shareParams: params,
        metadata,
      })
      return {
        shareUrl: result.shareUrl,
        shareLinkId: result.shareLinkId,
      }
    },

    async addShareClickData(
      shareLinkId: string,
      metadata?: Record<string, string>,
    ): Promise<void> {
      await RundotAPI['social'].addShareClickDataAsync({ shareLinkId, metadata })
    },

    async getShareClicks(
      shareLinkId: string,
    ): Promise<{ clicks: ShareClickData[]; truncated: boolean }> {
      return RundotAPI['social'].getShareClicksAsync({ shareLinkId })
    },

    async getMyShareClickData(shareLinkId: string): Promise<ShareClickData | null> {
      return RundotAPI['social'].getMyShareClickDataAsync({ shareLinkId })
    },
  }
}

export function createRundotShareContextSource(): ShareContextSource {
  return {
    async getIncomingShareParams(): Promise<ShareParams | null> {
      const intent = await RundotAPI['app'].resolveLaunchIntent()
      if (intent.kind !== 'share') return null
      const params = intent.params
      if (!params || Object.keys(params).length === 0) return null
      return params as ShareParams
    },
    async getIncomingShareLinkId(): Promise<string | null> {
      const intent = await RundotAPI['app'].resolveLaunchIntent()
      const id = intent.shareLinkId
      return typeof id === 'string' && id.length > 0 ? id : null
    },
  }
}
