export function joinClassName(...values: Array<string | false | null | undefined>): string | undefined {
  const result = values.filter(Boolean).join(' ').trim()
  return result || undefined
}
