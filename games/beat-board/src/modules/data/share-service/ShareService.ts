import {
  createRundotShareContextSource,
  createRundotShareProvider,
} from '@modules/ugc/rundot-share-provider/RundotShareProvider'

export interface ShareParams {
  [key: string]: string
}

export interface ShareMetadata {
  title?: string
  description?: string
  imageUrl?: string
}

export interface ShareResult {
  shareUrl: string
  shareLinkId: string
}

export interface ShareLinkDesktopFallbackResult extends ShareResult {
  copiedToClipboard: boolean
}

export interface ShareClickData {
  clickerProfileId: string
  metadata: Record<string, string>
  createdAt: number
  updatedAt: number
}

export interface ShareProvider {
  shareLink(params: ShareParams, metadata?: ShareMetadata): Promise<ShareResult>
  addShareClickData(shareLinkId: string, metadata?: Record<string, string>): Promise<void>
  getShareClicks(shareLinkId: string): Promise<{ clicks: ShareClickData[]; truncated: boolean }>
  getMyShareClickData(shareLinkId: string): Promise<ShareClickData | null>
}

export interface ShareContextSource {
  getIncomingShareParams(): Promise<ShareParams | null>
  getIncomingShareLinkId(): Promise<string | null>
}

export interface ShareServiceConfig {
  provider?: ShareProvider
  contextSource?: ShareContextSource
  onShareComplete?: (params: ShareParams) => void
}

export interface ShareServiceDebugDiagnostics {
  incomingShareParams: ShareParams | null
  incomingShareLinkId: string | null
}

export const SHARE_LINK_DESKTOP_FALLBACK_TIMEOUT_MS = 10_000

export interface ShareLinkDesktopFallbackOptions {
  isDesktopViewport?: () => boolean
  timeoutMs?: number
  writeText?: (text: string) => Promise<void>
}

function withShareTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  if (timeoutMs <= 0) return promise

  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Share timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    promise.then(
      value => {
        clearTimeout(timeoutId)
        resolve(value)
      },
      error => {
        clearTimeout(timeoutId)
        reject(error)
      },
    )
  })
}

function defaultIsDesktopViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia('(min-width: 768px)').matches
}

function getClipboardWriteText(): ((text: string) => Promise<void>) | undefined {
  if (typeof navigator === 'undefined') return undefined
  return navigator.clipboard?.writeText?.bind(navigator.clipboard)
}

export async function copyShareUrlForDesktopFallback(
  shareUrl: string,
  options?: ShareLinkDesktopFallbackOptions,
): Promise<boolean> {
  const isDesktopViewport = options?.isDesktopViewport ?? defaultIsDesktopViewport
  if (!isDesktopViewport()) return false

  const writeText = options?.writeText ?? getClipboardWriteText()
  if (!writeText) return false

  try {
    await writeText(shareUrl)
    return true
  } catch {
    return false
  }
}

export function createShareService(config?: ShareServiceConfig) {
  const provider = config?.provider ?? createRundotShareProvider()
  const contextSource = config?.contextSource ?? createRundotShareContextSource()
  const shareLink = async (
    params: ShareParams,
    metadata?: ShareMetadata,
  ): Promise<ShareResult> => {
    const result = await provider.shareLink(params, metadata)
    config?.onShareComplete?.(params)
    return result
  }

  return {
    shareLink,

    async shareLinkWithDesktopFallback(
      params: ShareParams,
      metadata?: ShareMetadata,
      options?: ShareLinkDesktopFallbackOptions,
    ): Promise<ShareLinkDesktopFallbackResult> {
      const timeoutMs = options?.timeoutMs ?? SHARE_LINK_DESKTOP_FALLBACK_TIMEOUT_MS
      const result = await withShareTimeout(shareLink(params, metadata), timeoutMs)
      const copiedToClipboard = await copyShareUrlForDesktopFallback(result.shareUrl, options)
      return { ...result, copiedToClipboard }
    },

    async addShareClickData(
      shareLinkId: string,
      metadata?: Record<string, string>,
    ): Promise<void> {
      await provider.addShareClickData(shareLinkId, metadata)
    },

    async getShareClicks(
      shareLinkId: string,
    ): Promise<{ clicks: ShareClickData[]; truncated: boolean }> {
      return provider.getShareClicks(shareLinkId)
    },

    async getMyShareClickData(
      shareLinkId: string,
    ): Promise<ShareClickData | null> {
      return provider.getMyShareClickData(shareLinkId)
    },

    getIncomingShareParams(): Promise<ShareParams | null> {
      return contextSource.getIncomingShareParams()
    },

    getIncomingShareLinkId(): Promise<string | null> {
      return contextSource.getIncomingShareLinkId()
    },

    async getDebugDiagnostics(): Promise<ShareServiceDebugDiagnostics> {
      return {
        incomingShareParams: await contextSource.getIncomingShareParams(),
        incomingShareLinkId: await contextSource.getIncomingShareLinkId(),
      }
    },
  }
}

export function getIncomingShareParams(
  contextSource: ShareContextSource = createRundotShareContextSource(),
): Promise<ShareParams | null> {
  return contextSource.getIncomingShareParams()
}

export function getIncomingShareLinkId(
  contextSource: ShareContextSource = createRundotShareContextSource(),
): Promise<string | null> {
  return contextSource.getIncomingShareLinkId()
}

const ORDINAL_SUFFIXES: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' }

export function getRankText(rank: number): string {
  if (rank === 1) return `got 1${ORDINAL_SUFFIXES[1]} place`
  if (rank === 2) return `placed 2${ORDINAL_SUFFIXES[2]}`
  if (rank === 3) return `placed 3${ORDINAL_SUFFIXES[3]}`
  if (rank >= 4 && rank <= 10) return `placed #${rank}`
  if (rank >= 11 && rank <= 100) return 'made the top 100'
  return 'competed'
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export function formatDisplayDate(dateKey: string): string {
  const year = dateKey.substring(0, 4)
  const monthIndex = parseInt(dateKey.substring(4, 6), 10) - 1
  const day = parseInt(dateKey.substring(6, 8), 10)

  return `${MONTHS[monthIndex]} ${day}, ${year}`
}
