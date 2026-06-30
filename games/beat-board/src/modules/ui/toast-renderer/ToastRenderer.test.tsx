import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ToastRenderer } from './ToastRenderer'
import { useToastStore, resetToastStore } from '@modules/ui/toast-notifications/ToastNotifications'

describe('ToastRenderer', () => {
  beforeEach(() => {
    resetToastStore()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders nothing when no toasts', () => {
    const { container } = render(<ToastRenderer />)
    expect(container.firstChild).toBeNull()
  })

  it('renders a toast when one is shown', () => {
    useToastStore.getState().show({ message: 'Hello!', severity: 'info' })
    render(<ToastRenderer />)
    expect(screen.getByText('Hello!')).toBeTruthy()
  })

  it('renders multiple toasts', () => {
    useToastStore.getState().show({ message: 'First', severity: 'info' })
    useToastStore.getState().show({ message: 'Second', severity: 'success' })
    render(<ToastRenderer />)
    expect(screen.getByText('First')).toBeTruthy()
    expect(screen.getByText('Second')).toBeTruthy()
  })

  it('dismisses a toast when X is clicked', () => {
    const id = useToastStore.getState().show({ message: 'Bye', severity: 'warning' })
    const { rerender } = render(<ToastRenderer />)
    expect(screen.getByText('Bye')).toBeTruthy()

    fireEvent.click(screen.getByTestId(`dismiss-${id}`))
    rerender(<ToastRenderer />)
    expect(screen.queryByText('Bye')).toBeNull()
  })

  it('renders toast action button when action provided', () => {
    const onPress = () => {}
    useToastStore.getState().show({ message: 'Undo?', severity: 'info', action: { label: 'Undo', onPress } })
    render(<ToastRenderer />)
    expect(screen.getByText('Undo')).toBeTruthy()
  })

  it('toast has role="alert" for accessibility', () => {
    useToastStore.getState().show({ message: 'Alert!', severity: 'error' })
    render(<ToastRenderer />)
    expect(screen.getByRole('alert')).toBeTruthy()
  })

  it('toast has entry animation applied', () => {
    useToastStore.getState().show({ message: 'Animated', severity: 'info' })
    render(<ToastRenderer position="top-center" />)
    const toast = screen.getByRole('alert')
    expect(toast.style.animation).toContain('toast-slide-in-top')
  })

  it('bottom-positioned toast uses bottom slide animation', () => {
    useToastStore.getState().show({ message: 'Bottom', severity: 'info' })
    render(<ToastRenderer position="bottom-center" />)
    const toast = screen.getByRole('alert')
    expect(toast.style.animation).toContain('toast-slide-in-bottom')
  })
})
