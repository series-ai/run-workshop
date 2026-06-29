const suspended = new Set<string>()

export function suspendPolling(id: string): void {
  suspended.add(id)
}

export function resumePolling(id: string): void {
  suspended.delete(id)
}

export function isPollingSuspended(id: string): boolean {
  return suspended.has(id)
}

export function resetPollingSuspensionForTesting(): void {
  suspended.clear()
}
