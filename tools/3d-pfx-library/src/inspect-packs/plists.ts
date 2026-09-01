const loaded = import.meta.glob('../../assets/duelyst/*.plist', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export function readDuelystPlist(fileName: string): string | null {
  const match = Object.entries(loaded).find(([path]) => path.endsWith(`/${fileName}`))
  const text = match?.[1]
  return typeof text === 'string' && text.includes('<plist') ? text : null
}
