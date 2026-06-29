export type ToastSeverity = 'info' | 'success' | 'error' | 'warning'
export interface Toast { id: string; message: string; severity: ToastSeverity; action?: { label: string; onPress: () => void }; durationMs?: number }
export interface ToastStore { toasts: Toast[]; show(toast: Omit<Toast, 'id'>): string; dismiss(id: string): void; dismissAll(): void }
