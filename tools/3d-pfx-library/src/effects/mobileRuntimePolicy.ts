import { PFX_MOBILE_RUNTIME_POLICY } from '../constants/01'
import type { PfxMobileRuntimePolicy } from '../types/01'

export function createPfxMobileRuntimePolicy(): PfxMobileRuntimePolicy {
  return {
    ...PFX_MOBILE_RUNTIME_POLICY,
    canvasDprRange: [...PFX_MOBILE_RUNTIME_POLICY.canvasDprRange],
    webgl: { ...PFX_MOBILE_RUNTIME_POLICY.webgl },
    tierConcurrencyCaps: { ...PFX_MOBILE_RUNTIME_POLICY.tierConcurrencyCaps },
    requiredOptimizations: [...PFX_MOBILE_RUNTIME_POLICY.requiredOptimizations],
  }
}
