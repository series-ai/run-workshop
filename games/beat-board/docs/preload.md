# Preload Guide

The template now ships one canonical preload surface:

- Runtime API: `src/preload/assets.ts`
- Coordinator + presenter: `src/preload/`
- App-facing catalog: `src/content-assets/assetCatalog.ts`
- Generator-owned catalog backing file: `src/content-assets/assetCatalog.generated.ts`

## Mental Model

- **Ownership** says which pack is responsible for a runtime asset path.
- **Prefetch** fetches bytes into cache without claiming the asset is decoded.
- **Prepare** parses or instantiates the asset for a concrete runtime consumer.
- **Stages** describe entry points like `startup-critical`, `first-screen-ready`, or a later transition.
- **Touch reporting** lets the runtime promote a pack when an owned asset is first requested through the preload API.

## Startup vs Later Loads

Boot uses the native SDK preloader in `src/main.tsx` and runs named stages
through the shared coordinator. After React mounts, `src/preload/PreloadOverlay.tsx`
renders the same coordinator state through semantic UI primitives for blocking
or background loads.

## Runtime API

Use `src/preload/assets.ts` instead of ad hoc CDN helpers.

```ts
import {
  assetUrl,
  assetHttpUrl,
  assetJson,
  prepareAsset,
  releaseAsset,
  useAssetUrl,
} from '@/preload/assets';

const logoUrl = await assetUrl('images/logo.png');
const modelHttpUrl = assetHttpUrl('models/hero.glb');
const tuning = await assetJson<{ price: number }>('data/shop.json');

const prepared = await prepareAsset({
  path: 'data/shop.json',
  kind: 'json',
  scope: 'shop-stage',
  retain: true,
});

releaseAsset(prepared);
releaseAsset('shop-stage');
```

Use `assetHttpUrl()` or `createPackAssetResolver()` when a loader needs a stable
`/cdn-assets/...` URL. Use `assetUrl()` / `useAssetUrl()` when a blob URL is the
right transport.

## Catalog Setup

`src/content-assets/assetCatalog.generated.ts` is overwritten by asset sync. Do
not edit it directly.

`src/content-assets/assetCatalog.ts` is the stable file for project overrides.
The default composition maps generator-emitted `defaultPrefetch` and
`defaultPrepare` into runtime `prefetch` / `prepare` fields, and you can extend
that with explicit pack priority, exclusions, or extra stage membership.

## Coverage and Verification

Project asset ownership is checked against `public/cdn-assets/**`.

- Generate or refresh imported-pack metadata:
  `npm run preload:catalog -- --project <project-dir>`
- Check ownership coverage:
  `npm run preload:coverage -- --project <project-dir>`
- Make unowned assets blocking:
  `npm run preload:coverage -- --project <project-dir> --mode fail`
- Run template preload tests:
  `npm run test:preload`

Coverage reports classify each runtime asset as `owned`, `excluded`, or
`unowned`, warn on duplicate ownership, and suggest starter ownership rules for
new custom asset folders.

## Custom Assets

Assets placed directly under `public/cdn-assets/<custom-path>/...` are part of
the same runtime estate as synced imported packs. Add them to a pack ownership
rule or exclude them explicitly with a reason in `assetCatalog.ts`; otherwise
the coverage check will flag them as unowned.
