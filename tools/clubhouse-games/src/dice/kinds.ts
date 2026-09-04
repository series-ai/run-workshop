export const DIE_KINDS = [4, 6, 8, 10, 12, 20] as const
export type DieKind = (typeof DIE_KINDS)[number]

export const DIE_STYLES = ['pip', 'ornate', 'numeral'] as const
export type DieStyle = (typeof DIE_STYLES)[number]

export function isDieKind(n: number): n is DieKind {
  return (DIE_KINDS as readonly number[]).includes(n)
}

export function parseDieKind(n: number): DieKind {
  if (!isDieKind(n)) throw new Error(`Unsupported die kind d${n}`)
  return n
}

export function parseDieStyle(s: string): DieStyle {
  if (!(DIE_STYLES as readonly string[]).includes(s)) {
    throw new Error(`Unknown die style: ${JSON.stringify(s)}`)
  }
  return s as DieStyle
}

export function faceCount(kind: DieKind): number {
  return kind
}

// pip art only exists for cubes. Other kinds use numerals.
export function resolveDieStyle(kind: DieKind, style: DieStyle): DieStyle {
  if (style === 'pip' && kind !== 6) {
    throw new Error(`pip style is only valid for d6 (got d${kind})`)
  }
  return style
}
