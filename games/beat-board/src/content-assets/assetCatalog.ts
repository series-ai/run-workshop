import { generatedAssetCatalog } from './assetCatalog.generated';
import { defineAssetCatalog } from '../preload/types';

export const assetCatalog = defineAssetCatalog({
  packs: generatedAssetCatalog.packs.map((pack) => ({
    ...pack,
    prefetch: [...(pack.prefetch ?? pack.defaultPrefetch ?? [])],
    prepare: [...(pack.prepare ?? pack.defaultPrepare ?? [])],
  })),
  stages: generatedAssetCatalog.stages,
  exclude: generatedAssetCatalog.exclude,
});
