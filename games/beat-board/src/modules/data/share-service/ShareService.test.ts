import { describe, it, expect, vi, beforeEach } from 'vitest'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import {
  copyShareUrlForDesktopFallback,
  createShareService,
  getIncomingShareParams,
  getIncomingShareLinkId,
  getRankText,
  formatDisplayDate,
} from './ShareService'
import type { ShareContextSource, ShareProvider } from './ShareService'

// ── shareLink ─────────────────────────────────────────────────────────────

describe('createShareService – shareLink', () => {
  beforeEach(() => {
    vi.mocked(RundotAPI.social.shareLinkAsync).mockResolvedValue({
      shareUrl: 'https://mock.share/link',
      shareLinkId: 'mock-share-link-id',
    })
  })

  it('calls SDK with correct shareParams and metadata', async () => {
    const svc = createShareService()

    await svc.shareLink(
      { mode: 'daily', date: '20260226' },
      { title: 'Challenge!', description: 'Beat my score' },
    )

    expect(RundotAPI.social.shareLinkAsync).toHaveBeenCalledWith({
      shareParams: { mode: 'daily', date: '20260226' },
      metadata: { title: 'Challenge!', description: 'Beat my score' },
    })
  })

  it('returns shareUrl and shareLinkId from the SDK result', async () => {
    const svc = createShareService()
    const result = await svc.shareLink({ key: 'val' })

    expect(result).toEqual({
      shareUrl: 'https://mock.share/link',
      shareLinkId: 'mock-share-link-id',
    })
  })

  it('calls onShareComplete callback on success', async () => {
    const onShareComplete = vi.fn()
    const svc = createShareService({ onShareComplete })

    await svc.shareLink({ mode: 'editor' })

    expect(onShareComplete).toHaveBeenCalledWith({ mode: 'editor' })
  })

  it('does not call onShareComplete when SDK throws', async () => {
    vi.mocked(RundotAPI.social.shareLinkAsync).mockRejectedValue(
      new Error('Network error'),
    )
    const onShareComplete = vi.fn()
    const svc = createShareService({ onShareComplete })

    await expect(svc.shareLink({ mode: 'daily' })).rejects.toThrow('Network error')
    expect(onShareComplete).not.toHaveBeenCalled()
  })

  it('propagates SDK errors', async () => {
    vi.mocked(RundotAPI.social.shareLinkAsync).mockRejectedValue(
      new Error('Share failed'),
    )
    const svc = createShareService()

    await expect(svc.shareLink({ x: '1' })).rejects.toThrow('Share failed')
  })

  it('can copy the generated URL for desktop fallback UX', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const svc = createShareService()
    const result = await svc.shareLinkWithDesktopFallback(
      { mode: 'daily' },
      { title: 'Challenge!' },
      { isDesktopViewport: () => true, writeText },
    )

    expect(result).toEqual({
      shareUrl: 'https://mock.share/link',
      shareLinkId: 'mock-share-link-id',
      copiedToClipboard: true,
    })
    expect(writeText).toHaveBeenCalledWith('https://mock.share/link')
  })

  it('times out desktop fallback share link generation', async () => {
    vi.useFakeTimers()
    const provider: ShareProvider = {
      shareLink() {
        return new Promise<never>(() => {})
      },
      async addShareClickData() {},
      async getShareClicks() {
        return { clicks: [], truncated: false }
      },
      async getMyShareClickData() {
        return null
      },
    }
    const svc = createShareService({ provider })

    try {
      const pending = expect(
        svc.shareLinkWithDesktopFallback(
          { mode: 'daily' },
          undefined,
          { timeoutMs: 5, isDesktopViewport: () => true, writeText: vi.fn() },
        ),
      ).rejects.toThrow('Share timed out after 5ms')

      await vi.advanceTimersByTimeAsync(5)
      await pending
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('copyShareUrlForDesktopFallback', () => {
  it('copies the share URL when desktop fallback is enabled', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)

    const copied = await copyShareUrlForDesktopFallback('https://mock.share/link', {
      isDesktopViewport: () => true,
      writeText,
    })

    expect(copied).toBe(true)
    expect(writeText).toHaveBeenCalledWith('https://mock.share/link')
  })

  it('does not copy on mobile viewports', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)

    const copied = await copyShareUrlForDesktopFallback('https://mock.share/link', {
      isDesktopViewport: () => false,
      writeText,
    })

    expect(copied).toBe(false)
    expect(writeText).not.toHaveBeenCalled()
  })

  it('does not fail the share flow when clipboard write fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('blocked'))

    const copied = await copyShareUrlForDesktopFallback('https://mock.share/link', {
      isDesktopViewport: () => true,
      writeText,
    })

    expect(copied).toBe(false)
  })
})

// ── addShareClickData ─────────────────────────────────────────────────────

describe('createShareService – addShareClickData', () => {
  it('calls SDK addShareClickDataAsync with shareLinkId and metadata', async () => {
    const svc = createShareService()
    await svc.addShareClickData('link-123', { source: 'invite' })

    expect(RundotAPI.social.addShareClickDataAsync).toHaveBeenCalledWith({
      shareLinkId: 'link-123',
      metadata: { source: 'invite' },
    })
  })

  it('calls SDK without metadata when not provided', async () => {
    const svc = createShareService()
    await svc.addShareClickData('link-456')

    expect(RundotAPI.social.addShareClickDataAsync).toHaveBeenCalledWith({
      shareLinkId: 'link-456',
      metadata: undefined,
    })
  })
})

// ── getShareClicks ────────────────────────────────────────────────────────

describe('createShareService – getShareClicks', () => {
  it('returns clicks from SDK', async () => {
    const mockClicks = {
      clicks: [
        { clickerProfileId: 'user-1', metadata: {}, createdAt: 1000, updatedAt: 1000 },
      ],
      truncated: false,
    }
    vi.mocked(RundotAPI.social.getShareClicksAsync).mockResolvedValue(mockClicks)

    const svc = createShareService()
    const result = await svc.getShareClicks('link-123')

    expect(RundotAPI.social.getShareClicksAsync).toHaveBeenCalledWith({ shareLinkId: 'link-123' })
    expect(result).toEqual(mockClicks)
  })
})

// ── getMyShareClickData ───────────────────────────────────────────────────

describe('createShareService – getMyShareClickData', () => {
  it('returns null when no click data exists', async () => {
    const svc = createShareService()
    const result = await svc.getMyShareClickData('link-123')

    expect(RundotAPI.social.getMyShareClickDataAsync).toHaveBeenCalledWith({ shareLinkId: 'link-123' })
    expect(result).toBeNull()
  })

  it('returns click data when it exists', async () => {
    const mockData = { clickerProfileId: 'me', metadata: { ref: 'home' }, createdAt: 500, updatedAt: 600 }
    vi.mocked(RundotAPI.social.getMyShareClickDataAsync).mockResolvedValue(mockData)

    const svc = createShareService()
    const result = await svc.getMyShareClickData('link-789')

    expect(result).toEqual(mockData)
  })
})

describe('createShareService – injected provider', () => {
  it('uses injected provider and context source', async () => {
    const provider: ShareProvider = {
      async shareLink(params) {
        return {
          shareUrl: `https://ugc.mock/${params['entryId']}`,
          shareLinkId: 'memory-link-1',
        }
      },
      async addShareClickData() {},
      async getShareClicks() {
        return { clicks: [], truncated: false }
      },
      async getMyShareClickData() {
        return null
      },
    }
    const contextSource: ShareContextSource = {
      async getIncomingShareParams() {
        return { entryId: 'ugc-42' }
      },
      async getIncomingShareLinkId() {
        return 'memory-link-1'
      },
    }

    const svc = createShareService({ provider, contextSource })
    const result = await svc.shareLink({ entryId: 'ugc-42' })

    expect(result.shareLinkId).toBe('memory-link-1')
    expect(await svc.getIncomingShareParams()).toEqual({ entryId: 'ugc-42' })
    expect(await svc.getIncomingShareLinkId()).toBe('memory-link-1')
    expect(await svc.getDebugDiagnostics()).toEqual({
      incomingShareParams: { entryId: 'ugc-42' },
      incomingShareLinkId: 'memory-link-1',
    })
  })
})

// ── getIncomingShareParams ────────────────────────────────────────────────

describe('getIncomingShareParams', () => {
  it('returns params when the launch intent is a share', async () => {
    vi.mocked(RundotAPI.app.resolveLaunchIntent).mockResolvedValue({
      kind: 'share',
      params: { mode: 'play', levelId: '42' },
    })

    const result = await getIncomingShareParams()
    expect(result).toEqual({ mode: 'play', levelId: '42' })
  })

  it('returns null when the launch intent is not a share', async () => {
    vi.mocked(RundotAPI.app.resolveLaunchIntent).mockResolvedValue({
      kind: 'none',
      params: {},
    })

    expect(await getIncomingShareParams()).toBeNull()
  })

  it('returns null when the share params are empty', async () => {
    vi.mocked(RundotAPI.app.resolveLaunchIntent).mockResolvedValue({
      kind: 'share',
      params: {},
    })

    expect(await getIncomingShareParams()).toBeNull()
  })
})

// ── getIncomingShareLinkId ────────────────────────────────────────────────

describe('getIncomingShareLinkId', () => {
  it('returns the shareLinkId when the intent carries one', async () => {
    vi.mocked(RundotAPI.app.resolveLaunchIntent).mockResolvedValue({
      kind: 'share',
      params: {},
      shareLinkId: 'link-abc',
    })
    expect(await getIncomingShareLinkId()).toBe('link-abc')
  })

  it('returns null when the intent has no shareLinkId', async () => {
    vi.mocked(RundotAPI.app.resolveLaunchIntent).mockResolvedValue({
      kind: 'none',
      params: {},
    })
    expect(await getIncomingShareLinkId()).toBeNull()
  })

  it('returns null when the shareLinkId is an empty string', async () => {
    vi.mocked(RundotAPI.app.resolveLaunchIntent).mockResolvedValue({
      kind: 'share',
      params: {},
      shareLinkId: '',
    })
    expect(await getIncomingShareLinkId()).toBeNull()
  })
})

// ── getRankText ───────────────────────────────────────────────────────────

describe('getRankText', () => {
  it('rank 1 -> "got 1st place"', () => {
    expect(getRankText(1)).toBe('got 1st place')
  })

  it('rank 2 -> "placed 2nd"', () => {
    expect(getRankText(2)).toBe('placed 2nd')
  })

  it('rank 3 -> "placed 3rd"', () => {
    expect(getRankText(3)).toBe('placed 3rd')
  })

  it('rank 5 -> "placed #5"', () => {
    expect(getRankText(5)).toBe('placed #5')
  })

  it('rank 50 -> "made the top 100"', () => {
    expect(getRankText(50)).toBe('made the top 100')
  })

  it('rank 150 -> "competed"', () => {
    expect(getRankText(150)).toBe('competed')
  })

  it('rank 10 -> "placed #10" (boundary)', () => {
    expect(getRankText(10)).toBe('placed #10')
  })

  it('rank 100 -> "made the top 100" (boundary)', () => {
    expect(getRankText(100)).toBe('made the top 100')
  })

  it('rank 101 -> "competed" (boundary)', () => {
    expect(getRankText(101)).toBe('competed')
  })
})

// ── formatDisplayDate ─────────────────────────────────────────────────────

describe('formatDisplayDate', () => {
  it('formats "20260226" as "Feb 26, 2026"', () => {
    expect(formatDisplayDate('20260226')).toBe('Feb 26, 2026')
  })

  it('formats "20251231" as "Dec 31, 2025"', () => {
    expect(formatDisplayDate('20251231')).toBe('Dec 31, 2025')
  })

  it('formats "20260101" as "Jan 1, 2026"', () => {
    expect(formatDisplayDate('20260101')).toBe('Jan 1, 2026')
  })

  it('formats "20261015" as "Oct 15, 2026"', () => {
    expect(formatDisplayDate('20261015')).toBe('Oct 15, 2026')
  })
})
