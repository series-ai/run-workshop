import type { SpriteSheet, SpriteSheetClip, SpriteSheetFrame } from './types'

const POINT_PAIR = /\{\{\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\}\s*,\s*\{\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\}\}/
const SIZE_PAIR = /\{\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\}/
const FRAME_ENTRY = /<key>([^<]+\.png)<\/key>\s*<dict>([\s\S]*?)<\/dict>/g

function readPlistString(block: string, key: string): string | null {
  const match = block.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`))
  return match ? match[1] : null
}

function readPlistBool(block: string, key: string): boolean {
  const match = block.match(new RegExp(`<key>${key}</key>\\s*<(true|false)\\s*/>`))
  return match?.[1] === 'true'
}

function clipIdFromFrameName(name: string): { id: string; index: number } {
  const match = name.match(/^(.*?)[_-](\d+)\.png$/i)
  if (!match) return { id: name.replace(/\.png$/i, ''), index: 0 }
  return { id: match[1], index: Number.parseInt(match[2], 10) }
}

export function isCocosAtlasPlist(xml: string): boolean {
  return xml.includes('<key>frames</key>') && xml.includes('<key>frame</key>')
}

export function parseCocosAtlasPlist(xml: string): SpriteSheet {
  if (!xml.includes('<key>frames</key>')) {
    throw new Error('Plist is not a sprite atlas: missing frames')
  }
  const metadata = xml.split('<key>metadata</key>')[1] ?? ''
  const sizeText = readPlistString(metadata, 'size')
  const sizeMatch = sizeText ? sizeText.match(SIZE_PAIR) : null
  let textureWidth = sizeMatch ? Number.parseFloat(sizeMatch[1]) : 0
  let textureHeight = sizeMatch ? Number.parseFloat(sizeMatch[2]) : 0
  const textureFileName = readPlistString(metadata, 'textureFileName') ?? ''

  const frameBlock = xml.split('<key>frames</key>')[1]?.split('<key>metadata</key>')[0] ?? xml
  const frames: SpriteSheetFrame[] = []
  FRAME_ENTRY.lastIndex = 0
  for (const match of frameBlock.matchAll(FRAME_ENTRY)) {
    const name = match[1]
    const body = match[2]
    const frameText = readPlistString(body, 'frame')
    const parsed = frameText?.match(POINT_PAIR)
    if (!parsed) continue
    const x = Number.parseFloat(parsed[1])
    const y = Number.parseFloat(parsed[2])
    const width = Number.parseFloat(parsed[3])
    const height = Number.parseFloat(parsed[4])
    if (width < 2 || height < 2) continue
    frames.push({
      name,
      x,
      y,
      width,
      height,
      rotated: readPlistBool(body, 'rotated'),
      u: 0,
      v: 0,
      du: 0,
      dv: 0,
    })
  }
  if (frames.length === 0) throw new Error('Sprite atlas has no usable frames')
  if (textureWidth <= 0 || textureHeight <= 0) {
    textureWidth = Math.max(...frames.map((frame) => frame.x + frame.width))
    textureHeight = Math.max(...frames.map((frame) => frame.y + frame.height))
  }
  for (const frame of frames) {
    frame.u = frame.x / textureWidth
    frame.du = frame.width / textureWidth
    frame.dv = frame.height / textureHeight
    frame.v = 1 - (frame.y + frame.height) / textureHeight
  }
  return {
    textureWidth,
    textureHeight,
    textureFileName,
    frames,
    clips: groupSpriteClips(frames),
  }
}

export function groupSpriteClips(frames: readonly SpriteSheetFrame[]): SpriteSheetClip[] {
  const groups = new Map<string, Array<{ index: number; frame: SpriteSheetFrame }>>()
  for (const frame of frames) {
    const parsed = clipIdFromFrameName(frame.name)
    const list = groups.get(parsed.id) ?? []
    list.push({ index: parsed.index, frame })
    groups.set(parsed.id, list)
  }
  return [...groups.entries()].map(([id, items]) => {
    const ordered = [...items].sort((left, right) => left.index - right.index).map((item) => item.frame)
    return { id, frames: ordered, animated: clipLooksAnimated(ordered) }
  })
}

export function clipLooksAnimated(frames: readonly SpriteSheetFrame[]): boolean {
  if (frames.length < 3) return false
  const widths = frames.map((frame) => frame.width)
  const heights = frames.map((frame) => frame.height)
  const meanW = widths.reduce((sum, value) => sum + value, 0) / widths.length
  const meanH = heights.reduce((sum, value) => sum + value, 0) / heights.length
  const drift =
    widths.reduce((sum, value) => sum + Math.abs(value - meanW), 0) / widths.length / Math.max(1, meanW) +
    heights.reduce((sum, value) => sum + Math.abs(value - meanH), 0) / heights.length / Math.max(1, meanH)
  return drift < 0.35
}

export function createGridSpriteSheet(
  textureFileName: string,
  columns: number,
  rows: number,
  width: number,
  height: number,
  animated = false,
): SpriteSheet {
  const cellW = width / columns
  const cellH = height / rows
  const frames: SpriteSheetFrame[] = []
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column
      frames.push({
        name: `${textureFileName.replace(/\.[^.]+$/, '')}_${String(index).padStart(3, '0')}.png`,
        x: column * cellW,
        y: row * cellH,
        width: cellW,
        height: cellH,
        rotated: false,
        u: column / columns,
        v: 1 - (row + 1) / rows,
        du: 1 / columns,
        dv: 1 / rows,
      })
    }
  }
  return {
    textureWidth: width,
    textureHeight: height,
    textureFileName,
    frames,
    clips: [{ id: textureFileName.replace(/\.[^.]+$/, ''), frames, animated }],
  }
}

export function createFullImageSheet(textureFileName: string, width = 1, height = 1): SpriteSheet {
  const frame: SpriteSheetFrame = {
    name: textureFileName,
    x: 0,
    y: 0,
    width,
    height,
    rotated: false,
    u: 0,
    v: 0,
    du: 1,
    dv: 1,
  }
  return {
    textureWidth: width,
    textureHeight: height,
    textureFileName,
    frames: [frame],
    clips: [{ id: textureFileName.replace(/\.[^.]+$/, ''), frames: [frame], animated: false }],
  }
}
