import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(process.argv[2]!); const node = process.argv[4]
const ang = (a: number[], b: number[]) => 2 * Math.acos(Math.min(1, Math.abs(a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3]))) * 180 / Math.PI
for (const anim of doc.getRoot().listAnimations().filter(a => a.getName() === process.argv[3])) for (const ch of anim.listChannels()) {
  if (ch.getTargetNode()!.getName() !== node || ch.getTargetPath() !== 'rotation') continue
  const s = ch.getSampler()!, i = s.getInput()!, o = s.getOutput()!
  const r: string[] = []
  for (let k = 1; k < i.getCount(); k++) r.push(`${Math.round(i.getElement(k, [])[0]! * 30)}:${Math.round(ang(o.getElement(k-1, []), o.getElement(k, [])) * 30)}`)
  console.log(r.join(' '))
}
