export interface SemanticVerificationThresholds {
  maxDiffRatio: number
  maxAlphaDiffRatio: number
  maxEdgeDiffRatio: number
}

export const DEFAULT_SEMANTIC_VERIFICATION_THRESHOLDS: SemanticVerificationThresholds = {
  maxDiffRatio: 0.16,
  maxAlphaDiffRatio: 0.12,
  maxEdgeDiffRatio: 0.2,
}

export const LAYERLAB_GRAPHICAL_THRESHOLDS: SemanticVerificationThresholds = {
  maxDiffRatio: 0.12,
  maxAlphaDiffRatio: 0.08,
  maxEdgeDiffRatio: 0.14,
}
