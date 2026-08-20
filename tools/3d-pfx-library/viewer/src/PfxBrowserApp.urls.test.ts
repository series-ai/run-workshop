import { describe, expect, it } from 'vitest'
import * as app from './PfxBrowserApp'

type UrlHelpers = typeof app & {
  createRealDeviceCaptureQueueLink?: (
    platform: 'mobile-safari' | 'chrome-android' | 'auto' | undefined,
    autoUpload: boolean,
    deviceLabel: string,
  ) => string
  withProfileDeviceLabel?: (profileUrl: string, deviceLabel?: string | null) => string
  withProfileAutoUpload?: (profileUrl: string, deviceLabel?: string | null) => string
  readPfxReviewCaptureToken?: (search?: string) => string | null
}

const helpers = app as UrlHelpers

describe('mark filter URL helpers', () => {
  it('parses mark ids, label, and only flag from the query string', () => {
    expect(typeof helpers.readPfxMarkFilter).toBe('function')

    const filter = helpers.readPfxMarkFilter?.('?mark=mud-burst,%20shadow-burst,&markLabel=REDO&markOnly=1')
    expect(filter?.label).toBe('REDO')
    expect(filter?.only).toBe(true)
    expect([...(filter?.ids ?? [])].sort()).toEqual(['mud-burst', 'shadow-burst'])
  })

  it('defaults the label and only flag, and returns null without ids', () => {
    expect(helpers.readPfxMarkFilter?.('?mark=holy-burst')).toMatchObject({ label: 'MARKED', only: false })
    expect(helpers.readPfxMarkFilter?.('?mark=,%20,')).toBeNull()
    expect(helpers.readPfxMarkFilter?.('?markLabel=REDO')).toBeNull()
    expect(helpers.readPfxMarkFilter?.('')).toBeNull()
  })

  it('expands the inspect-sheets mark alias to every imported sheet id', () => {
    const filter = helpers.readPfxMarkFilter?.('?mark=inspect-sheets&markLabel=SHEETS&markOnly=1')
    expect(filter?.label).toBe('SHEETS')
    expect(filter?.only).toBe(true)
    expect(filter?.ids.has('burger-shop-flies')).toBe(true)
    expect(filter?.ids.has('duelyst-impact')).toBe(true)
    expect(filter?.ids.has('inspect-sheets')).toBe(false)
    expect(filter?.ids.size).toBeGreaterThan(30)
  })

  it('expands the mesh-stunted mark alias and defaults the badge label', () => {
    const filter = helpers.readPfxMarkFilter?.('?mark=mesh-stunted&markOnly=1')
    expect(filter?.label).toBe('MESH')
    expect(filter?.only).toBe(true)
    expect(filter?.ids.has('rain-burst')).toBe(true)
    expect(filter?.ids.has('healing-loop')).toBe(true)
    expect(filter?.ids.has('spawn-screen')).toBe(true)
    expect(filter?.ids.has('mesh-stunted')).toBe(false)
    expect(filter?.ids.size).toBe(18)
  })

  it('filters items only when markOnly is set', () => {
    expect(typeof helpers.applyPfxMarkFilter).toBe('function')

    const items = [
      { effect: { id: 'mud-burst' } },
      { effect: { id: 'slime-burst' } },
      { effect: { id: 'shadow-burst' } },
    ]
    const markAll = helpers.readPfxMarkFilter?.('?mark=mud-burst,shadow-burst')
    const markOnly = helpers.readPfxMarkFilter?.('?mark=mud-burst,shadow-burst&markOnly=1')
    expect(helpers.applyPfxMarkFilter?.(items, markAll ?? null).map((item) => item.effect.id)).toEqual([
      'mud-burst',
      'slime-burst',
      'shadow-burst',
    ])
    expect(helpers.applyPfxMarkFilter?.(items, markOnly ?? null).map((item) => item.effect.id)).toEqual([
      'mud-burst',
      'shadow-burst',
    ])
    expect(helpers.applyPfxMarkFilter?.(items, null)).toHaveLength(3)
  })
})

describe('real-device capture URL helpers', () => {
  it('encodes queue links with platform, auto-upload, and trimmed device labels', () => {
    expect(typeof helpers.createRealDeviceCaptureQueueLink).toBe('function')

    expect(helpers.createRealDeviceCaptureQueueLink?.('chrome-android', true, ' Pixel 8 Pro ')).toBe(
      '/__r3f-pfx-capture-next?platform=chrome-android&profileAutoUpload=1&profileDeviceLabel=Pixel+8+Pro',
    )
    expect(helpers.createRealDeviceCaptureQueueLink?.('mobile-safari', false, '')).toBe(
      '/__r3f-pfx-capture-next?platform=mobile-safari',
    )
    expect(helpers.createRealDeviceCaptureQueueLink?.(undefined, false, 'iPhone 15')).toBe(
      '/__r3f-pfx-capture-next?profileDeviceLabel=iPhone+15',
    )
  })

  it('adds device labels to absolute profile URLs without changing unlabeled links', () => {
    expect(typeof helpers.withProfileDeviceLabel).toBe('function')

    expect(
      helpers.withProfileDeviceLabel?.(
        'http://192.168.86.174:4765/?profileEffectIds=fireball&profilePlatform=mobile-safari',
        ' iPhone 15 ',
      ),
    ).toBe(
      'http://192.168.86.174:4765/?profileEffectIds=fireball&profilePlatform=mobile-safari&profileDeviceLabel=iPhone+15',
    )
    expect(
      helpers.withProfileDeviceLabel?.(
        'http://192.168.86.174:4765/?profileEffectIds=fireball&profilePlatform=mobile-safari',
        ' ',
      ),
    ).toBe('http://192.168.86.174:4765/?profileEffectIds=fireball&profilePlatform=mobile-safari')
  })

  it('adds auto-upload to profile URLs with consistently trimmed device labels', () => {
    expect(typeof helpers.withProfileAutoUpload).toBe('function')

    expect(
      helpers.withProfileAutoUpload?.(
        'http://192.168.86.174:4765/?profileEffectIds=hit-spark&profilePlatform=chrome-android',
        ' Pixel 8 Pro ',
      ),
    ).toBe(
      'http://192.168.86.174:4765/?profileEffectIds=hit-spark&profilePlatform=chrome-android&profileAutoUpload=1&profileDeviceLabel=Pixel+8+Pro',
    )
    expect(
      helpers.withProfileAutoUpload?.(
        'http://192.168.86.174:4765/?profileEffectIds=hit-spark&profilePlatform=chrome-android',
        ' ',
      ),
    ).toBe(
      'http://192.168.86.174:4765/?profileEffectIds=hit-spark&profilePlatform=chrome-android&profileAutoUpload=1',
    )
  })
})

describe('quality capture render handshake', () => {
  it('accepts an exact bounded capture token only on review-capture URLs', () => {
    expect(typeof helpers.readPfxReviewCaptureToken).toBe('function')

    expect(helpers.readPfxReviewCaptureToken?.(
      '?reviewCapture=1&reviewCaptureToken=spawn-telegraph%3Apeak%3A767%3A42',
    )).toBe('spawn-telegraph:peak:767:42')
    expect(helpers.readPfxReviewCaptureToken?.(
      '?reviewCaptureToken=spawn-telegraph%3Apeak%3A767%3A42',
    )).toBeNull()
    expect(helpers.readPfxReviewCaptureToken?.(
      `?reviewCapture=1&reviewCaptureToken=${'x'.repeat(201)}`,
    )).toBeNull()
    expect(helpers.readPfxReviewCaptureToken?.(
      '?reviewCapture=1&reviewCaptureToken=bad%20token',
    )).toBeNull()
  })
})
