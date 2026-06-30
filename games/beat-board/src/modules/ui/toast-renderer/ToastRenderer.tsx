import type { ComponentProps } from 'react'
import { useToastStore } from '@modules/ui/toast-notifications/ToastNotifications'
import { Toast } from '@modules/ui/skin'

export interface ToastRendererProps {
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
}

type ToastStackItem = ComponentProps<typeof Toast.Stack>['items'][number]

/** Slide direction based on container position (top slides down, bottom slides up) */
function entryAnimation(position: string): string {
  const fromTop = position.startsWith('top')
  return fromTop ? 'toast-slide-in-top' : 'toast-slide-in-bottom'
}

/** Injects keyframe animations once into the document */
const STYLE_ID = 'toast-renderer-keyframes'
function ensureKeyframes() {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    @keyframes toast-slide-in-top {
      from { opacity: 0; transform: translateY(-16px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes toast-slide-in-bottom {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `
  document.head.appendChild(style)
}

export function ToastRenderer({ position = 'top-center' }: ToastRendererProps) {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  if (toasts.length === 0) return null

  ensureKeyframes()

  const items: ToastStackItem[] = toasts.map((toast) => ({
    id: toast.id,
    message: toast.message,
    severity: toast.severity,
    actionLabel: toast.action?.label,
    onAction: toast.action?.onPress,
    testId: `toast-${toast.id}`,
    dismissTestId: `dismiss-${toast.id}`,
    role: 'alert',
    style: {
      minWidth: 200,
      maxWidth: 360,
      animation: `${entryAnimation(position)} 250ms ease-out`,
    },
  }))

  return <Toast.Stack items={items} onDismiss={dismiss} position={position} />
}
