import baseline from '../fixtures/r31-city-policy-baseline.json';

/** Reverse only the approved R31 shader policy for the older material oracle. */
export function withoutR31RoofPolicy(source: string, key: string): string {
  const replaceOnce = (from: string, to: string): void => {
    if (source.split(from).length !== 2) throw new Error(`R31_POLICY_LOCATION_CHANGED:${key}:${from}`);
    source = source.replace(from, to);
  };
  if (key === 'towerVertex' || key === 'towerFragment') replaceOnce('flat varying float vEmissionAllowed;\n', '');
  if (key === 'towerVertex') {
    replaceOnce('attribute float aEmissionAllowed; // R31: equipment has no self-emission\n', '');
    replaceOnce('  vEmissionAllowed = aEmissionAllowed;\n', '');
  }
  if (key === 'towerFragment') {
    replaceOnce('* layerDim * EMISSIVE_GAIN * vEmissionAllowed;', '* layerDim * EMISSIVE_GAIN;');
    replaceOnce('* ( 1.0 - vIsSide ) * vEmissionAllowed;', '* ( 1.0 - vIsSide );');
    replaceOnce('* grazingFade * vIsSide * vEmissionAllowed,', '* grazingFade * vIsSide,');
    replaceOnce('* paneStepMask * vEmissionAllowed;', '* paneStepMask;');
    if (!baseline.parapetBlock || source.includes('parapetLive')) throw new Error('R31_PARAPET_POLICY_CHANGED');
    replaceOnce('  // --- window grid', baseline.parapetBlock + '  // --- window grid');
  }
  if (key === 'impostorFragment') replaceOnce("  // Keep the far silhouette. Only the upper cap's sampled emission is dark.\n  card.rgb *= 1.0 - smoothstep( 0.90, 0.92, vCardUv.y );\n", '');
  return source;
}
