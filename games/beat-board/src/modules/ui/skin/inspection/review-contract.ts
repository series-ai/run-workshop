import type { SemanticApprovalState, SemanticApprovalVariantId } from './semanticApproval'

export type SemanticSelfCheckStatus = 'missing' | 'pass' | 'fail' | 'not-applicable'

export interface SemanticSelfCheckSummary {
  componentName: string
  rendererVariantId: SemanticApprovalVariantId
  state: string
  status: SemanticSelfCheckStatus
  diffRatio: number | null
  alphaDiffRatio: number | null
  edgeDiffRatio: number | null
  artifactDir: string | null
  summary: string
}

export interface SemanticSelfCheckManifest {
  generatedAt: string
  entries: SemanticSelfCheckSummary[]
}

export interface SemanticReviewLedgerEntry {
  componentName: string
  rendererVariantId: SemanticApprovalVariantId
  state: string
  approvalState: SemanticApprovalState
  selfCheckStatus: SemanticSelfCheckStatus
}
