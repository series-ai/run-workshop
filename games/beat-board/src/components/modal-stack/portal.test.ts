/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  MODAL_STACK_HOST_ATTR,
  ensureModalStackHostMounted,
  resetModalStackHostMountedForTest,
} from './portal'

beforeEach(() => {
  resetModalStackHostMountedForTest()
  document.body.innerHTML = ''
})

afterEach(() => {
  resetModalStackHostMountedForTest()
  document.body.innerHTML = ''
})

describe('modal-stack portal self-mount', () => {
  it('first call appends the host node to document.body', () => {
    ensureModalStackHostMounted()
    const host = document.querySelector(`[${MODAL_STACK_HOST_ATTR}]`)
    expect(host).not.toBeNull()
    expect(host?.parentElement).toBe(document.body)
  })

  it('is idempotent — second call does not duplicate the host', () => {
    ensureModalStackHostMounted()
    ensureModalStackHostMounted()
    const hosts = document.querySelectorAll(`[${MODAL_STACK_HOST_ATTR}]`)
    expect(hosts.length).toBe(1)
  })

  it('adopts an existing host node if one is already in the DOM', () => {
    const preexisting = document.createElement('div')
    preexisting.setAttribute(MODAL_STACK_HOST_ATTR, '')
    document.body.appendChild(preexisting)

    ensureModalStackHostMounted()
    const hosts = document.querySelectorAll(`[${MODAL_STACK_HOST_ATTR}]`)
    expect(hosts.length).toBe(1)
    expect(hosts[0]).toBe(preexisting)
  })

  it('is a no-op when document is undefined (SSR)', () => {
    const realDocument = globalThis.document
    // @ts-expect-error — intentional undefined for SSR test
    globalThis.document = undefined
    expect(() => ensureModalStackHostMounted()).not.toThrow()
    globalThis.document = realDocument
  })
})
