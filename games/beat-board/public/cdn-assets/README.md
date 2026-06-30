# cdn-assets

Place game assets here that will be served via CDN.

Load runtime assets through the canonical preload surface in
`src/preload/assets.ts`:

```ts
import { assetHttpUrl, assetUrl, prepareAsset } from '@/preload/assets';

// Blob URL for image/audio style consumers
const logoUrl = await assetUrl('images/logo.png');

// Stable /cdn-assets/... URL for loaders that need sibling-relative fetches
const modelUrl = assetHttpUrl('models/hero.glb');

// Parsed/retained prepare path for data or decoder-backed assets
const prepared = await prepareAsset({
  path: 'data/shop.json',
  kind: 'json',
  scope: 'shop-stage',
  retain: true,
});
```

Track ownership in `src/content-assets/assetCatalog.ts` and verify it with:

```bash
npm run preload:coverage -- --project <project-dir>
```

Use exclusions for intentionally streamed or debug-only assets. New files under
`public/cdn-assets/` that are neither owned nor excluded will be reported as
unowned.

See `docs/preload.md` for the full preload guide.
