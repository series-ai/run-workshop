import { BUILTIN_UI_RENDERER_CATALOG } from './renderers/catalog'
import { SEMANTIC_UI_COMPONENTS, type SemanticUiComponentDefinition } from './semanticComponents'
import type { BuiltInUiRendererVariantId } from './types'

export type SemanticApprovalState =
  | 'reference-only'
  | 'designed'
  | 'implemented-pending-approval'
  | 'approved'
  | 'error'

export type SemanticApprovalVariantId = BuiltInUiRendererVariantId

export interface SemanticApprovalVariant {
  id: SemanticApprovalVariantId
  family: 'html' | 'graphical'
  label: string
  eyebrow: string
}

export interface SemanticApprovalMatrixEntry {
  component: SemanticUiComponentDefinition
  variantStates: Record<SemanticApprovalVariantId, SemanticApprovalState>
}

function inferRendererFamilyFromSourceDir(sourceDir: string): SemanticApprovalVariant['family'] {
  if (sourceDir.startsWith('renderers/html/')) {
    return 'html'
  }

  if (sourceDir.startsWith('renderers/graphical/')) {
    return 'graphical'
  }

  throw new Error(`Unsupported renderer source directory: ${sourceDir}`)
}

export const SEMANTIC_APPROVAL_VARIANTS: readonly SemanticApprovalVariant[] = [
  ...BUILTIN_UI_RENDERER_CATALOG.map((entry) => ({
    id: entry.manifest.variantId,
    family: inferRendererFamilyFromSourceDir(entry.sourceDir),
    label: entry.manifest.label,
    eyebrow: entry.selection.designFamilyLabel,
  })),
] as const

export const DEFAULT_SEMANTIC_APPROVAL_STATE: SemanticApprovalState = 'approved'

export const SEMANTIC_APPROVAL_MATRIX: readonly SemanticApprovalMatrixEntry[] = SEMANTIC_UI_COMPONENTS.map(
  (component) => ({
    component,
    variantStates: Object.fromEntries(
      SEMANTIC_APPROVAL_VARIANTS.map((variant) => [variant.id, DEFAULT_SEMANTIC_APPROVAL_STATE]),
    ) as Record<SemanticApprovalVariantId, SemanticApprovalState>,
  }),
)

export function getSemanticApprovalEntry(componentName: string): SemanticApprovalMatrixEntry | undefined {
  return SEMANTIC_APPROVAL_MATRIX.find((entry) => entry.component.name === componentName)
}

export function isSemanticApprovalVariantId(value: string): value is SemanticApprovalVariantId {
  return SEMANTIC_APPROVAL_VARIANTS.some((variant) => variant.id === value)
}
