// @vitest-environment jsdom
import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FtueOverlayShell, clickInteractiveDescendant } from './FtueOverlayShell'
import type { FtueStepConfig } from './types'

afterEach(() => {
  cleanup()
})

function createUseStore(stepConfigOverrides: Partial<FtueStepConfig> = {}) {
  const stepConfig: FtueStepConfig = {
    id: 'intro',
    phase: 'core',
    spotlight: null,
    message: 'Follow the guide',
    completion: { type: 'manual' },
    ...stepConfigOverrides,
  }

  const state = {
    currentStepId: stepConfig.id,
    isActive: true,
    isInitialized: true,
    currentPhase: 'core',
    isStepHidden: false,
    skipAll: vi.fn(),
    completeCurrentStep: vi.fn(),
    getCurrentStepConfig: () => stepConfig,
    getSpotlightTarget: () => stepConfig.spotlight ?? null,
    getGuideMessage: () => 'Follow the guide',
    dismissContextual: vi.fn(),
    isOverlayActive: () => true,
  }

  const useStore = (<T,>(selector: (snapshot: typeof state) => T) => selector(state)) as {
    <T>(selector: (snapshot: typeof state) => T): T
    getState: () => typeof state
  }
  useStore.getState = () => state
  return useStore
}

describe('clickInteractiveDescendant', () => {
  it('forwards clicks to the first interactive descendant instead of the wrapper', () => {
    const wrapper = document.createElement('div')
    const button = document.createElement('button')
    wrapper.appendChild(button)

    const wrapperClick = vi.spyOn(wrapper, 'click')
    const buttonClick = vi.spyOn(button, 'click')

    clickInteractiveDescendant(wrapper)

    expect(buttonClick).toHaveBeenCalledTimes(1)
    expect(wrapperClick).not.toHaveBeenCalled()
  })
})

describe('FtueOverlayShell', () => {
  it('drops overlay pointer events for allowPointerThrough steps', () => {
    const useStore = createUseStore({
      completion: {
        type: 'manual',
        params: { allowPointerThrough: true },
      },
    })

    render(<FtueOverlayShell useStore={useStore} />)

    expect(screen.getByTestId('ftue-overlay')).toHaveAttribute('data-ftue-pointer-events', 'none')
  })
})
