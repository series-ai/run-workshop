import type { BuiltInUiRendererVariantId } from '../types'
import { BUILTIN_UI_RENDERER_CATALOG, type BuiltInUiRendererCatalogEntry } from './catalog'
import type { UiRendererDesignFamilyId } from './types'

export interface UiRendererSelectionRequest {
  designFamilyId?: UiRendererDesignFamilyId
  keywords?: readonly string[]
}

export interface UiRendererSelectionMatch {
  entry: BuiltInUiRendererCatalogEntry
  variantId: BuiltInUiRendererVariantId
  label: string
  score: number
  matchedKeywords: readonly string[]
  conflictingKeywords: readonly string[]
  reasons: readonly string[]
}

function normalizeKeyword(value: string): string {
  return value.trim().toLowerCase()
}

function normalizeKeywords(values: readonly string[] | undefined): string[] {
  if (!values) {
    return []
  }

  return [...new Set(values.map(normalizeKeyword).filter((value) => value.length > 0))]
}

export function getBuiltInUiRendererCatalogEntry(
  variantId: BuiltInUiRendererVariantId,
): BuiltInUiRendererCatalogEntry | undefined {
  return BUILTIN_UI_RENDERER_CATALOG.find((entry) => entry.manifest.variantId === variantId)
}

export function rankBuiltInUiRenderers(request: UiRendererSelectionRequest): UiRendererSelectionMatch[] {
  const requestKeywords = normalizeKeywords(request.keywords)

  return [...BUILTIN_UI_RENDERER_CATALOG]
    .map((entry) => {
      const profile = entry.selection
      const entryKeywords = new Set(profile.keywords.map(normalizeKeyword))
      const entryAvoidKeywords = new Set(profile.avoidKeywords.map(normalizeKeyword))
      const matchedKeywords = requestKeywords.filter((keyword) => entryKeywords.has(keyword))
      const conflictingKeywords = requestKeywords.filter((keyword) => entryAvoidKeywords.has(keyword))
      const reasons: string[] = []
      let score = 0

      if (request.designFamilyId) {
        if (profile.designFamilyId === request.designFamilyId) {
          score += 4
          reasons.push(`${profile.designFamilyLabel} design family match`)
        } else {
          score -= 1
        }
      }

      if (matchedKeywords.length > 0) {
        score += matchedKeywords.length * 2
        reasons.push(`matched keywords: ${matchedKeywords.join(', ')}`)
      }

      if (conflictingKeywords.length > 0) {
        score -= conflictingKeywords.length * 3
        reasons.push(`conflicting keywords: ${conflictingKeywords.join(', ')}`)
      }

      if (reasons.length === 0) {
        reasons.push(profile.selectionSummary)
      }

      return {
        entry,
        variantId: entry.manifest.variantId,
        label: entry.manifest.label,
        score,
        matchedKeywords,
        conflictingKeywords,
        reasons,
      }
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      if (left.entry.displayOrder !== right.entry.displayOrder) {
        return left.entry.displayOrder - right.entry.displayOrder
      }

      return left.label.localeCompare(right.label)
    })
}

export function recommendBuiltInUiRenderer(
  request: UiRendererSelectionRequest,
): UiRendererSelectionMatch | undefined {
  return rankBuiltInUiRenderers(request)[0]
}
