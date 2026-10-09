import baseline from '../fixtures/r32-deck-roof-baseline.json';
import { withoutR31RoofPolicy } from './r31RoofPolicy';

/** Restore only the deleted R32 block before the older shader oracle. */
export function withoutR32RoofPolicy(source: string, key: string): string {
  if (key === 'towerFragment') {
    const anchor = '  // Hero blade light:';
    if (source.includes('float deckRoof') || source.split(anchor).length !== 2) {
      throw new Error('R32_ROOF_POLICY_LOCATION_CHANGED');
    }
    source = source.replace(anchor, baseline.block + anchor);
  }
  return withoutR31RoofPolicy(source, key);
}
