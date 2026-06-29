/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  CONFIRM_DIALOG_HOST_ATTR,
  ensureConfirmDialogHostMounted,
  resetConfirmDialogHostMountedForTest,
} from './portal'

beforeEach(() => {
  resetConfirmDialogHostMountedForTest()
  document.body.innerHTML = ''
})

afterEach(() => {
  resetConfirmDialogHostMountedForTest()
  document.body.innerHTML = ''
})

describe('confirmation-dialog portal self-mount', () => {
  it('first call appends the host node to document.body', () => {
    ensureConfirmDialogHostMounted()
    const host = document.querySelector(`[${CONFIRM_DIALOG_HOST_ATTR}]`)
    expect(host).not.toBeNull()
    expect(host?.parentElement).toBe(document.body)
  })

  it('is idempotent — second call does not duplicate the host', () => {
    ensureConfirmDialogHostMounted()
    ensureConfirmDialogHostMounted()
    const hosts = document.querySelectorAll(`[${CONFIRM_DIALOG_HOST_ATTR}]`)
    expect(hosts.length).toBe(1)
  })

  it('adopts an existing host node if one is already in the DOM', () => {
    const preexisting = document.createElement('div')
    preexisting.setAttribute(CONFIRM_DIALOG_HOST_ATTR, '')
    document.body.appendChild(preexisting)

    ensureConfirmDialogHostMounted()
    const hosts = document.querySelectorAll(`[${CONFIRM_DIALOG_HOST_ATTR}]`)
    expect(hosts.length).toBe(1)
    expect(hosts[0]).toBe(preexisting)
  })

  it('is a no-op when document is undefined (SSR)', () => {
    const realDocument = globalThis.document
    // @ts-expect-error — intentional undefined for SSR test
    globalThis.document = undefined
    expect(() => ensureConfirmDialogHostMounted()).not.toThrow()
    globalThis.document = realDocument
  })
})
