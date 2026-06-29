import { describe, it, expect, beforeEach } from 'vitest'
import { createTutorialStore } from './TutorialOverlay'
import type { TutorialStep } from './types'

const steps: TutorialStep[] = [
  { id: 't1', message: 'Tap the red button', targetElementId: 'btn-red', arrowDirection: 'down' },
  { id: 't2', message: 'Now drag the item', targetElementId: 'item-1' },
  { id: 't3', message: 'Great job!' },
]

let store: ReturnType<typeof createTutorialStore>

beforeEach(() => {
  store = createTutorialStore(steps)
})

describe('TutorialOverlay', () => {
  it('start activates tutorial', () => {
    store.getState().start()
    expect(store.getState().isActive).toBe(true)
    expect(store.getState().currentStep?.id).toBe('t1')
  })

  it('advance goes to next step', () => {
    store.getState().start()
    store.getState().advance()
    expect(store.getState().currentStep?.id).toBe('t2')
    expect(store.getState().stepIndex).toBe(1)
  })

  it('advance on last step ends tutorial', () => {
    store.getState().start()
    store.getState().advance()
    store.getState().advance()
    store.getState().advance() // past end
    expect(store.getState().isActive).toBe(false)
    expect(store.getState().currentStep).toBeNull()
  })

  it('dismiss ends tutorial', () => {
    store.getState().start()
    store.getState().dismiss()
    expect(store.getState().isActive).toBe(false)
  })

  it('getCurrentTarget returns element id', () => {
    store.getState().start()
    expect(store.getState().getCurrentTarget()).toBe('btn-red')
  })

  it('getCurrentTarget returns null when no target', () => {
    store.getState().start()
    store.getState().advance()
    store.getState().advance()
    expect(store.getState().getCurrentTarget()).toBeNull()
  })

  it('dismiss is blocked when dismissible is false', () => {
    const nonDismissibleSteps: TutorialStep[] = [
      { id: 'nd1', message: 'Must complete', dismissible: false },
      { id: 'nd2', message: 'Can dismiss' },
    ]
    const s = createTutorialStore(nonDismissibleSteps)
    s.getState().start()
    s.getState().dismiss()
    // Should still be active — dismiss was blocked
    expect(s.getState().isActive).toBe(true)
    expect(s.getState().currentStep?.id).toBe('nd1')
  })

  it('dismiss works when dismissible is undefined (default)', () => {
    store.getState().start()
    store.getState().dismiss()
    expect(store.getState().isActive).toBe(false)
  })

  it('dismiss works when dismissible is true', () => {
    const dismissibleSteps: TutorialStep[] = [
      { id: 'd1', message: 'Dismissible', dismissible: true },
    ]
    const s = createTutorialStore(dismissibleSteps)
    s.getState().start()
    s.getState().dismiss()
    expect(s.getState().isActive).toBe(false)
  })

  it('character field is accessible on step', () => {
    const charSteps: TutorialStep[] = [
      { id: 'c1', message: 'Hi from guide!', character: 'guide_npc' },
    ]
    const s = createTutorialStore(charSteps)
    s.getState().start()
    expect(s.getState().currentStep?.character).toBe('guide_npc')
  })

  it('tooltipPosition and tooltipAlign pass through', () => {
    const posSteps: TutorialStep[] = [
      { id: 'p1', message: 'Positioned', tooltipPosition: 'left', tooltipAlign: 'center' },
    ]
    const s = createTutorialStore(posSteps)
    s.getState().start()
    expect(s.getState().currentStep?.tooltipPosition).toBe('left')
    expect(s.getState().currentStep?.tooltipAlign).toBe('center')
  })

  it('hint field passes through', () => {
    const hintSteps: TutorialStep[] = [
      { id: 'h1', message: 'With hint', hint: 'swipe_left' },
    ]
    const s = createTutorialStore(hintSteps)
    s.getState().start()
    expect(s.getState().currentStep?.hint).toBe('swipe_left')
  })
})
