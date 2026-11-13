/** Reads only the JSON chunk of a GLB: fast metadata scans over large packs. */
import { closeSync, openSync, readSync } from 'node:fs'

export interface GlbJson {
  animations?: { name?: string }[]
  nodes?: { name?: string }[]
}

export function readGlbJson(path: string): GlbJson {
  const fd = openSync(path, 'r')
  try {
    const header = Buffer.alloc(20)
    readSync(fd, header, 0, 20, 0)
    if (header.readUInt32LE(0) !== 0x46546c67) throw new Error(`${path} is not a GLB`)
    const length = header.readUInt32LE(12)
    const json = Buffer.alloc(length)
    readSync(fd, json, 0, length, 20)
    return JSON.parse(json.toString('utf8')) as GlbJson
  } finally {
    closeSync(fd)
  }
}
