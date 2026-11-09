// The editor runs the sprite build scripts in the browser. Their node-only imports (files, child
// processes, paths) point here in vite.config.ts: harmless stand-ins, since nothing is written.
export const mkdirSync = (): void => {}
export const rmSync = (): void => {}
export const writeFileSync = (): void => {}
export const execFileSync = (): void => {}
export const join = (...parts: string[]): string => parts.join('/')
export const dirname = (p: string): string => p.split('/').slice(0, -1).join('/')
export const fileURLToPath = (u: string | URL): string => String(u)
