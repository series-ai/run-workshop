/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  BOTTOM_SHEET_HOST_ATTR,
  ensureBottomSheetHostMounted,
  resetBottomSheetHostMountedForTest,
} from './portal'

beforeEach(() => {
  resetBottomSheetHostMountedForTest()
  document.body.innerHTML = ''
})

afterEach(() => {
  resetBottomSheetHostMountedForTest()
  document.body.innerHTML = ''
})

describe('bottom-sheet portal self-mount', () => {
  it('first call appends the host node to document.body', () => {
    ensureBottomSheetHostMounted()
    const host = document.querySelector(`[${BOTTOM_SHEET_HOST_ATTR}]`)
    expect(host).not.toBeNull()
    expect(host?.parentElement).toBe(document.body)
  })

  it('is idempotent — second call does not duplicate the host', () => {
    ensureBottomSheetHostMounted()
    ensureBottomSheetHostMounted()
    const hosts = document.querySelectorAll(`[${BOTTOM_SHEET_HOST_ATTR}]`)
    expect(hosts.length).toBe(1)
  })

  it('adopts an existing host node if one is already in the DOM', () => {
    const preexisting = document.createElement('div')
    preexisting.setAttribute(BOTTOM_SHEET_HOST_ATTR, '')
    document.body.appendChild(preexisting)

    ensureBottomSheetHostMounted()
    const hosts = document.querySelectorAll(`[${BOTTOM_SHEET_HOST_ATTR}]`)
    expect(hosts.length).toBe(1)
    expect(hosts[0]).toBe(preexisting)
  })

  it('is a no-op when document is undefined (SSR)', () => {
    // Simulate SSR by temporarily deleting document. JSDOM leaves it on
    // globalThis; we monkey-patch the reference seen by the module.
    const realDocument = globalThis.document
    // @ts-expect-error — intentional undefined for SSR test
    globalThis.document = undefined
    expect(() => ensureBottomSheetHostMounted()).not.toThrow()
    globalThis.document = realDocument
  })
})
