/** Check that an art review is bound to the final GLB and has no release blocker. */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { z } from 'zod'

const reviewSchema = z.object({
  assetId: z.string().trim().min(1),
  glbPath: z.string().trim().min(1),
  glbSha256: z.string().regex(/^[a-f0-9]{64}$/),
  author: z.string().trim().min(1),
  evidence: z.object({
    fourViews: z.string().trim().min(1),
    thumbnail128: z.string().trim().min(1),
    nativeScaleLineup: z.string().trim().min(1),
    categorySheet: z.string().trim().min(1),
    motion: z.array(z.string().trim().min(1)),
    viewer: z.string().trim().min(1),
  }).strict(),
  reviews: z.array(z.object({
    reviewer: z.string().trim().min(1),
    verdict: z.enum(['ship', 'revise', 'reject']),
    findings: z.array(z.object({ severity: z.enum(['P0', 'P1', 'P2']), note: z.string().trim().min(1) }).strict()),
  }).strict()).min(1),
}).strict()

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? undefined : process.argv[index + 1]
}

const recordPath = arg('record')
if (!recordPath) throw new Error('pass --record <review.json>')
const minReviewers = Number(arg('min-reviewers') ?? 1)
if (!Number.isInteger(minReviewers) || minReviewers < 1) throw new Error('--min-reviewers must be a positive integer')

const record = reviewSchema.parse(JSON.parse(readFileSync(recordPath, 'utf8')))
const glbPath = resolve(dirname(recordPath), record.glbPath)
if (basename(glbPath) !== `${record.assetId}.glb`) throw new Error(`GLB name does not match ${record.assetId}`)
const hash = createHash('sha256').update(readFileSync(glbPath)).digest('hex')
if (hash !== record.glbSha256) throw new Error(`${record.assetId}: review hash is stale; final GLB has ${hash}`)
const names = record.reviews.map((review) => review.reviewer.trim().toLowerCase())
if (new Set(names).size !== names.length || names.includes(record.author.trim().toLowerCase())) throw new Error(`${record.assetId}: reviewers must be distinct and independent of the author`)
if (record.reviews.length < minReviewers) throw new Error(`${record.assetId}: ${record.reviews.length} reviewers, need ${minReviewers}`)
for (const review of record.reviews) {
  if (review.verdict !== 'ship') throw new Error(`${record.assetId}: ${review.reviewer} verdict is ${review.verdict}`)
  const blocker = review.findings.find((finding) => finding.severity === 'P0' || finding.severity === 'P1')
  if (blocker) throw new Error(`${record.assetId}: ${review.reviewer} has ${blocker.severity}: ${blocker.note}`)
}
console.log(`${record.assetId}: ${record.reviews.length} independent ship review(s), no P0/P1, GLB hash matches`)
