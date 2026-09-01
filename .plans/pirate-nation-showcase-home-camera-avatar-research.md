---
title: "Pirate Nation showcase home, model orientation, and avatar depth research"
status: reviewed
created: 2026-08-30
updated: 2026-08-30
tags: [pirate-nation, showcase, landing-page, three, r3f, avatar]
---

# Pirate Nation showcase home, model orientation, and avatar depth research

> **For agentic workers:** Use the `execute-spec` skill to implement this plan
> task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Pirate Nation showcase easier to enter, easier to browse, and safer to diagnose when avatar parts fight in depth.

**Architecture:** Share one model yaw constant between the model viewer and the thumbnail renderer. Replace the technical Overview surface with a CDN-backed Home surface that routes visitors to each showcase area and records session-only progress. Add a bounded avatar z-fighting research report that tests the asset geometry and renderer settings without applying an unverified production workaround.

**Tech Stack:** React, TypeScript, React Three Fiber, drei, three.js, RUN asset-library SDK, Vitest, and Playwright.

---

## Overview

The Models page currently opens models at a different orientation from their saved thumbnails. The thumbnail renderer rotates each model by `Math.PI - Math.PI / 5`, while `ModelViewer` leaves the model at its source yaw. Visitors must rotate every model before they can compare it with the card image.

The first tab currently presents a technical manifest, collection list, provenance table, and exclusion list. It does not guide a visitor into the five interactive surfaces. The new Home surface will use the Pirate Nation menu background from the pinned UI pack, present clear exploration routes, and track which routes the visitor has reviewed during the current session. The footer and landing copy will thank Proof of Play for sharing the work. A separate research task will document the remaining avatar z-fighting problem before a rendering or asset fix is selected.

## Background

- `src/thumb.tsx` rotates the thumbnail root by `Math.PI - Math.PI / 5` before `FitCamera` frames it. `src/components/ModelViewer.tsx` passes a `PackModel` with no rotation, so the Models stage does not match the thumbnail orientation.
- `src/pack3d/PackModel.tsx` owns the placed model group but currently exposes no yaw option. `src/pack3d/PackCanvas.tsx` and `src/pack3d/FitCamera.tsx` are shared by the model and scene surfaces. The orientation change must remain local to the model preview and must not rotate the multi-model Scene surface.
- `src/App.tsx` starts on a tab named `Overview`. The tab list stores components directly, so a Home route that can navigate to another tab needs a small typed navigation callback. The app already keeps tab state in memory and has no server-backed session state.
- `src/tabs/Dashboard.tsx` loads `public/catalog/pirate-nation/manifest.json` and shows the technical overview. It does not load an image or expose callbacks to the other tabs.
- `src/assetLibrary.ts` pins the UI pack at `ui/proofofplay-pirate-nation-ui@97835c36f9f1`. The jam-ready-assets UI pack contains `branding-menu-background.png` at its pack root. `src/catalog.ts` already maps branding sprite paths to the UI pack, so the Home background can use the same RUN asset-library resolver instead of adding a local binary.
- The manifest reports 375 model files because it includes 20 collision files. The Models page reports 355 visual entries. Home copy must label these values so visitors do not read them as the same count.
- `src/App.tsx` and `src/tabs/Dashboard.tsx` show the phrase `allowlisted extract` to visitors. `public/catalog/pirate-nation/manifest.json` also supplies that phrase as the displayed open-source status. The technical provenance files use the term to describe source-selection rules; that technical wording is not part of this UI change.
- `src/tabs/AvatarLab.tsx` uses its own `Canvas` with `logarithmicDepthBuffer: true`, `FitCamera`, a floor at `y = -0.01`, and a 2048 shadow map. It provides orbit controls but no turntable control. `src/avatar/PirateAvatar.tsx` clones one skinned GLB and removes unselected part nodes. No material depth bias or vertex offset is currently applied.
- The pinned avatar GLB has 344 nodes, 327 meshes, one skin, and 32 animations. A bind-pose skinning probe found 24 shoe vertices within `1e-6` of `bottoms 12` for shoes 2, 3, 4, 5, and 15. Nine of those matches are within `1e-8`. The affected part meshes use the opaque `PN-Material`. This supports an asset-level near-coplanar cause, but does not rule out animation, camera range, shadow acne, or other part pairs.

## Requirements

1. Define one exported `MODEL_PREVIEW_YAW` constant with the current thumbnail yaw, `Math.PI - Math.PI / 5`. `src/thumb.tsx` and the Models page must import this constant. No second numeric copy of the yaw may remain.
2. Add an optional `rotationY` prop to `PackModel`. Its default must be zero so the Scene surface keeps its current world orientation. `ModelViewer` must pass `MODEL_PREVIEW_YAW` to the visual and collision model roots, and turntable rotation must start from that yaw.
3. Rename the first tab from `Overview` to `Home`. Home must remain the default tab and must render its route cards when either the local manifest or the background asset fails. Home may show a non-blocking status and must use fixed fallback title, counts, and source-link values when the manifest is unavailable.
4. Home must render a full-width hero using `branding-menu-background.png` from the pinned UI asset-library pack. The hero must include a readable overlay, the pack title, a short invitation to explore, clear pack counts, and a primary action that opens Models. If the background URL cannot resolve, the hero must keep its fallback colour and content.
5. Home must provide five keyboard-accessible route buttons for Models, Scene, Avatar Lab, Sprites, and Audio. Each route must show a stable description and a count or capability label. Activating a route must switch the app to the matching tab.
6. Track reviewed routes in memory for the current page session. Direct tab navigation and Home route buttons must both mark the matching content route as reviewed. Home must show a `reviewed / 5` progress value and a reviewed state on each completed route. Do not persist this state or add a score, account, or server request.
7. Replace the visible `allowlisted extract` wording with gratitude. The footer and Home copy must say that visitors can thank Proof of Play for sharing the work so others can build with it, retain the MIT license and copyright, and keep the source link. Change the displayed manifest status to `Converted from the archival MIT release`. Do not change the technical source-selection wording in `PROVENANCE.md` or `THIRD_PARTY_NOTICES.md`.
8. Research the avatar z-fighting issue before selecting a production fix. The research must inspect all slot-pair geometry at bind pose, sample the named leg and foot animations, capture reproducible visual cases, compare the existing depth and camera settings, and test the candidate mitigations `polygonOffset`, `depthWrite = false` on affected opaque parts, a small shader normal offset, and a source-geometry correction in a throwaway harness. The report must state which candidates separate the surfaces and which create visible defects. This plan must not change production avatar materials or geometry as part of the research.
9. Preserve the existing collision toggle, repaired model GLBs, CDN asset-library loading, Scene layout helpers, Avatar Lab controls, sprite and audio surfaces, model thumbnails, and existing error-boundary behavior.
10. Update the showcase README and tests for the new Home label, route behavior, background asset request, model orientation contract, and avatar research report. The docs must explain that the Home progress is session-only and that avatar z-fighting remains under investigation until a separate fix is selected.

## Non-goals

- Do not regenerate or move jam-ready-assets files.
- Do not change the pinned pack versions or add a direct GCS/CORS path.
- Do not implement a permanent avatar z-fighting workaround, edit the avatar GLB, or change the pack export in this plan.
- Do not add user accounts, persistent progress, points, achievements, or gameplay logic.
- Do not rotate the Scene tab or change the saved model thumbnails.
- Do not remove the detailed catalog metadata from the repository. Home may stop displaying the old long technical overview, but the catalog and provenance files remain available.

## Acceptance Criteria

- [ ] `MODEL_PREVIEW_YAW` is defined once, imported by both `src/thumb.tsx` and `src/components/ModelViewer.tsx`, and equals `Math.PI - Math.PI / 5`.
- [ ] `PackModel` accepts `rotationY`, defaults it to zero, and the Scene surface still passes no rotation.
- [ ] The Models surface starts with the same yaw used by the thumbnail renderer. Collision swaps, keyboard paging, and turntable mode preserve that starting yaw.
- [ ] The first tab is labelled `Home`, opens by default, and its route buttons remain usable when the manifest request or background asset request fails.
- [ ] A successful Home render requests `branding-menu-background.png` from `UI_PACK`, displays the hero copy and counts, and displays a fallback hero when that request rejects. A failed manifest uses the specified fallback title, counts, and source link and shows a non-blocking status.
- [ ] Home exposes exactly five `.landing-route` buttons. Each route switches to its tab and marks one progress item as reviewed. Top navigation marks the same items.
- [ ] The rendered UI contains no `Allowlisted extract` or `allowlisted extract` phrase. The footer contains a Proof of Play thank-you sentence, MIT license text, and the source link.
- [ ] `docs/avatar-z-fighting.md` records the asset probe, reproduction selections, sampled clips, current renderer settings, candidate mitigation results, and a recommendation or explicit decision to defer the production fix.
- [ ] Existing unit tests, existing CDN request assertions, and all new Home and orientation tests pass. The build passes.
- [ ] The README documents Home, the shared thumbnail orientation, session-only progress, and the avatar research report.

## File Roster

| File | Action | Why |
|------|--------|-----|
| `games/pirate-nation-showcase/src/pack3d/modelViewConfig.ts` | create | Own the shared model thumbnail yaw. |
| `games/pirate-nation-showcase/src/pack3d/modelViewConfig.test.ts` | create | Verify the shared yaw contract. |
| `games/pirate-nation-showcase/src/pack3d/PackModel.tsx` | modify | Add optional model yaw while keeping the zero default for scenes. |
| `games/pirate-nation-showcase/src/components/ModelViewer.tsx` | modify | Start the model and collision roots at the thumbnail yaw. |
| `games/pirate-nation-showcase/src/thumb.tsx` | modify | Replace the local yaw expression with the shared constant. |
| `games/pirate-nation-showcase/src/catalog.ts` | modify | Add the typed reference for the CDN menu background. |
| `games/pirate-nation-showcase/src/catalog.test.ts` | modify | Test the menu background asset reference. |
| `games/pirate-nation-showcase/src/App.tsx` | modify | Rename Overview to Home, add typed navigation and session progress, and update footer attribution. |
| `games/pirate-nation-showcase/src/tabs/Dashboard.tsx` | modify | Turn the technical dashboard into the CDN-backed Home hero and route board. |
| `games/pirate-nation-showcase/src/styles.css` | modify | Style the hero, route buttons, progress, fallback state, and responsive Home layout. |
| `games/pirate-nation-showcase/public/catalog/pirate-nation/manifest.json` | modify | Replace the displayed technical status phrase. |
| `games/pirate-nation-showcase/e2e/smoke.spec.ts` | modify | Cover Home, route navigation, background loading, attribution, and shared orientation behavior. |
| `games/pirate-nation-showcase/docs/avatar-z-fighting.md` | create | Preserve the reproducible avatar depth diagnosis and mitigation decision. |
| `games/pirate-nation-showcase/README.md` | modify | Document the Home surface, model orientation, session progress, and avatar research status. |

## Implementation Plan

### Task 1: Share the thumbnail model orientation

**Files:**
- Create: `games/pirate-nation-showcase/src/pack3d/modelViewConfig.ts`
- Create: `games/pirate-nation-showcase/src/pack3d/modelViewConfig.test.ts`
- Modify: `games/pirate-nation-showcase/src/pack3d/PackModel.tsx`
- Modify: `games/pirate-nation-showcase/src/components/ModelViewer.tsx`
- Modify: `games/pirate-nation-showcase/src/thumb.tsx`

- [ ] **Step 1: Write the failing unit test**

Create `src/pack3d/modelViewConfig.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { MODEL_PREVIEW_YAW } from './modelViewConfig'

describe('model preview orientation', () => {
  it('uses the yaw used by the thumbnail renderer', () => {
    expect(MODEL_PREVIEW_YAW).toBeCloseTo(Math.PI - Math.PI / 5)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/pack3d/modelViewConfig.test.ts`

Expected: FAIL — `./modelViewConfig` does not exist.

- [ ] **Step 3: Implement the shared yaw and PackModel prop**

Create `src/pack3d/modelViewConfig.ts`:

```ts
/** Yaw shared by model cards and the Models page default view. */
export const MODEL_PREVIEW_YAW = Math.PI - Math.PI / 5
```

In `PackModel.tsx`, add `rotationY?: number` to `PackModelProps`, destructure it with a zero default in `LoadedPackModel`, and add it to the placed group:

```tsx
export interface PackModelProps extends ModelTransformOptions {
  entry: PirateNationModelEntry
  name?: string
  wireframe?: boolean
  castShadow?: boolean
  rotationY?: number
  groupRef?: Ref<Group>
}

function LoadedPackModel({
  url,
  entry,
  name,
  wireframe = false,
  castShadow = true,
  rotationY = 0,
  groupRef,
  ...transform
}: PackModelProps & { url: string }) {
  const { scene } = useGLTF(url)
  const model = useMemo(() => scene.clone(true), [scene])
  const placement = modelTransform(entry.bounds, transform)

  useEffect(() => {
    model.traverse((object) => {
      const mesh = object as Mesh
      if (mesh.isMesh !== true) return
      mesh.castShadow = castShadow
      mesh.receiveShadow = castShadow
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materials) {
        (material as MeshStandardMaterial).wireframe = wireframe
      }
    })
  }, [model, wireframe, castShadow])

  return (
    <group
      ref={groupRef}
      name={name}
      position={placement.position}
      rotation={[0, rotationY, 0]}
      scale={placement.scale}
      dispose={null}
    >
      <primitive object={model} />
    </group>
  )
}
```

Replace the existing group opening with:

```tsx
<group
  ref={groupRef}
  name={name}
  position={placement.position}
  rotation={[0, rotationY, 0]}
  scale={placement.scale}
  dispose={null}
>
  <primitive object={model} />
</group>
```

Keep the existing `useGLTF`, clone, placement, material effect, and return behavior. The only behavior change in this function is the `rotationY` value on the placed group.

- [ ] **Step 4: Use the constant in both render paths**

In `ModelViewer.tsx`, import `MODEL_PREVIEW_YAW` from `../pack3d/modelViewConfig` and pass it to the existing `PackModel` call:

```tsx
<PackModel
  entry={entry}
  name={MODEL_VIEWER_ROOT_NAME}
  wireframe={wireframe}
  rotationY={MODEL_PREVIEW_YAW}
  anchor="native"
  groupRef={group}
/>
```

In `thumb.tsx`, import the same constant and replace the literal group rotation:

```tsx
<group name={MODEL_VIEWER_ROOT_NAME} rotation={[0, MODEL_PREVIEW_YAW, 0]}>
  <primitive object={scene} />
</group>
```

Do not pass `rotationY` from `SceneStage`; its zero default preserves the current scene layout.

- [ ] **Step 5: Run orientation and regression tests**

Run: `npx vitest run src/pack3d/modelViewConfig.test.ts src/pack3d/modelTransform.test.ts src/pack3d/layout.test.ts`

Expected: PASS — all orientation and placement tests pass.

Run: `npm run typecheck`

Expected: PASS — the new prop and imports typecheck.

### Task 2: Add the Home route state and CDN background reference

**Files:**
- Modify: `games/pirate-nation-showcase/src/catalog.ts`
- Modify: `games/pirate-nation-showcase/src/catalog.test.ts`
- Modify: `games/pirate-nation-showcase/src/App.tsx`
- Modify: `games/pirate-nation-showcase/src/tabs/Dashboard.tsx`

- [ ] **Step 1: Add the failing catalog test**

Append to the `asset references` suite in `src/catalog.test.ts`:

```ts
it('maps the Home menu background to the pinned UI pack', () => {
  expect(menuBackgroundAssetReference()).toEqual({
    pack: 'ui',
    path: 'branding-menu-background.png',
  })
})
```

Add `menuBackgroundAssetReference` to the existing import from `./catalog`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/catalog.test.ts`

Expected: FAIL — `menuBackgroundAssetReference` is not exported.

- [ ] **Step 3: Add the catalog helper and typed Home route**

Add this function to `src/catalog.ts` beside the other asset-reference helpers:

```ts
export function menuBackgroundAssetReference(): AssetReference {
  return { pack: 'ui', path: 'branding-menu-background.png' }
}
```

In `Dashboard.tsx`, define the route type and props:

```ts
export type ExploreTab = 'models' | 'scene' | 'avatar' | 'sprites' | 'audio'

export interface DashboardProps {
  onNavigate: (tab: ExploreTab) => void
  visited: ReadonlySet<ExploreTab>
}
```

The component will accept `DashboardProps`. It will keep the manifest request and error state, but it must not return an error-only or loading-only page. It will render the Home route surface immediately with fallback title, counts, and source-link values, then replace those values when the manifest resolves. It will resolve the background with `resolveAssetUrl(menuBackgroundAssetReference())` inside an effect and keep `null` when that promise rejects. Neither rejected promise may be thrown during render.

Use this manifest state and effect at the start of the component:

```tsx
export function Dashboard({ onNavigate, visited }: DashboardProps) {
  const [manifest, setManifest] = useState<PackManifest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null)

  useEffect(() => {
    loadManifest().then(setManifest, (err: Error) => setError(err.message))
  }, [])
```

Keep the existing `useEffect` and `useState` imports, add `resolveAssetUrl` from `../assetLibrary`, add `menuBackgroundAssetReference` to the `../catalog` import, and close the function after the Home return tree below.

- [ ] **Step 4: Update App navigation and progress state**

In `App.tsx`, import `type ExploreTab` and keep the existing tab ids. Rename the first label to `Home`. Add a session-only set and one navigation function:

```tsx
const [visited, setVisited] = useState<Set<ExploreTab>>(new Set())

const navigate = (next: TabId) => {
  setTab(next)
  if (next !== 'dashboard') {
    setVisited((previous) => new Set(previous).add(next))
  }
}
```

Use `navigate` for tab button clicks. Render `Dashboard` with `onNavigate={navigate}` and `visited={visited}`. Render the other active component as before. Keep `dashboard` as the default tab id.

- [ ] **Step 5: Run catalog tests and typecheck**

Run: `npx vitest run src/catalog.test.ts`

Expected: PASS — the new helper test and all existing catalog tests pass.

Run: `npm run typecheck`

Expected: PASS — Home route types and navigation state compile.

### Task 3: Replace Overview with an interactive Home surface

**Files:**
- Modify: `games/pirate-nation-showcase/src/tabs/Dashboard.tsx`
- Modify: `games/pirate-nation-showcase/src/styles.css`

- [ ] **Step 1: Write the failing Home e2e checks**

Replace the existing overview smoke test with checks for the new route. Keep the same `UI_PACK` constant and add the background path:

```ts
test('Home introduces the pack and routes to each surface', async ({ page }) => {
  const urls = requestUrls(page)
  await page.goto('/')

  await expect(page.getByRole('button', { name: 'Home', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Build your next world.' })).toBeVisible()
  await expect(page.getByTestId('home-progress')).toHaveText(/0 \/ 5 reviewed/)
  await expect(page.getByTestId('home-route-models')).toBeVisible()
  await expect(page.getByTestId('home-route-scene')).toBeVisible()
  await expect(page.getByTestId('home-route-avatar')).toBeVisible()
  await expect(page.getByTestId('home-route-sprites')).toBeVisible()
  await expect(page.getByTestId('home-route-audio')).toBeVisible()
  await expect(page.getByText(/Thank you to Proof of Play/)).toBeVisible()
  await expect(page.getByText(/allowlisted extract/i)).toHaveCount(0)
  await expect.poll(() => urls.some((url) => url.includes(UI_PACK) && url.endsWith('branding-menu-background.png'))).toBe(true)

  await page.getByTestId('home-route-models').click()
  await expect(page.getByPlaceholder(/Search 355 models/)).toBeVisible()
  await page.getByRole('button', { name: 'Home', exact: true }).click()
  await expect(page.getByTestId('home-progress')).toHaveText(/1 \/ 5 reviewed/)
  await expect(page.getByTestId('home-route-models')).toHaveText(/Reviewed/)
})
```

Add this navigation coverage so each route button is exercised:

```ts
test('Home route buttons open every showcase surface', async ({ page }) => {
  await page.goto('/')

  for (const route of [
    ['models', 'Models'],
    ['scene', 'Scene'],
    ['avatar', 'Avatar Lab'],
    ['sprites', 'Sprites'],
    ['audio', 'Audio'],
  ] as const) {
    await page.getByTestId(`home-route-${route[0]}`).click()
    await expect(page.getByRole('button', { name: route[1], exact: true })).toHaveClass(/active/)
    await page.getByRole('button', { name: 'Home', exact: true }).click()
  }
})
```

Add this failure-path test. The route aborts must leave the five route buttons usable:

```ts
test('Home keeps routes usable when manifest and background requests fail', async ({ page }) => {
  await page.route('**/catalog/pirate-nation/manifest.json', (route) => route.abort())
  await page.route('**/branding-menu-background.png', (route) => route.abort())
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Build your next world.' })).toBeVisible()
  await expect(page.getByTestId('home-route-models')).toBeVisible()
  await expect(page.getByTestId('home-route-audio')).toBeVisible()
  await expect(page.getByRole('status')).toHaveText(/Manifest details unavailable/)
  await expect(page.getByTestId('home-progress')).toHaveText(/0 \/ 5 reviewed/)
})
```

- [ ] **Step 2: Run the e2e test to verify it fails**

Run: `npx playwright test e2e/smoke.spec.ts -g 'Home introduces|Home route|Home keeps'`

Expected: FAIL — the app still renders Overview and has no Home route buttons or manifest failure fallback.

- [ ] **Step 3: Implement the Home content**

Replace the old Dashboard return tree with these data and elements. Keep the manifest request and store its result or error, but render the route surface without waiting for the request. Use these fallback values until the manifest resolves or when it rejects:

```tsx
const EXPEDITIONS: Array<{
  id: ExploreTab
  label: string
  description: string
  count: string
}> = [
  { id: 'models', label: 'Models', count: '375 files · 355 visual models', description: 'Inspect ships, buildings, creatures, props, and collision geometry.' },
  { id: 'scene', label: 'Scene', count: '5-model scenes', description: 'Place several models together with shared scale and ground alignment.' },
  { id: 'avatar', label: 'Avatar Lab', count: '326 parts · 32 clips', description: 'Build a pirate from the shared character rig.' },
  { id: 'sprites', label: 'Sprites', count: '513 sprites', description: 'Review icons, interface art, and branding images.' },
  { id: 'audio', label: 'Audio', count: '30 tracks', description: 'Listen to music and sound effects from the game.' },
]
```

Add this fallback data beside `EXPEDITIONS`:

```tsx
const FALLBACK_HOME_DATA = {
  displayName: 'Pirate Nation Art & Audio Pack',
  totalModels: 375,
  totalSprites: 513,
  totalAudioTracks: 30,
  sourceRepo: 'https://github.com/proofofplay/piratenation-game',
} as const

const displayName = manifest?.displayName ?? FALLBACK_HOME_DATA.displayName
const totalModels = manifest?.counts.totalModels ?? FALLBACK_HOME_DATA.totalModels
const totalSprites = manifest?.counts.totalSprites ?? FALLBACK_HOME_DATA.totalSprites
const totalAudioTracks = manifest?.counts.totalAudioTracks ?? FALLBACK_HOME_DATA.totalAudioTracks
const sourceRepo = manifest?.provenance.sourceRepo ?? FALLBACK_HOME_DATA.sourceRepo
```

Render this status inside the hero when the manifest request rejects:

```tsx
{error && (
  <p className="landing-data-warning" role="status">
    Manifest details unavailable. Explore routes remain available.
  </p>
)}
```

Render the background with a fallback style and route buttons:

```tsx
const heroStyle = backgroundUrl
  ? { backgroundImage: `linear-gradient(90deg, rgba(8, 13, 24, 0.94) 0%, rgba(8, 13, 24, 0.68) 48%, rgba(8, 13, 24, 0.2) 100%), url("${backgroundUrl}")` }
  : undefined

return (
  <section className="landing-page">
    <header className="landing-hero" style={heroStyle}>
      <div className="landing-hero-copy">
        <p className="landing-kicker">{displayName}</p>
        <h2>Build your next world.</h2>
        <p>Explore the models, characters, sprites, and sounds that make a voxel pirate world.</p>
        <button type="button" className="primary-action" onClick={() => onNavigate('models')}>
          Start with models
        </button>
        <p className="landing-thanks">Thank you to Proof of Play for sharing this work so others can build with it.</p>
      </div>
      <div className="landing-stats" aria-label="Pack contents">
        <span><strong>{totalModels}</strong> model files</span>
        <span><strong>{totalSprites}</strong> sprites</span>
        <span><strong>{totalAudioTracks}</strong> audio tracks</span>
      </div>
    </header>

    <section className="landing-explore" aria-labelledby="landing-explore-title">
      <div className="landing-section-heading">
        <div>
          <p className="landing-kicker">Choose a route</p>
          <h3 id="landing-explore-title">Explore the collection</h3>
        </div>
        <span data-testid="home-progress">{visited.size} / {EXPEDITIONS.length} reviewed</span>
      </div>
      <div className="landing-route-grid">
        {EXPEDITIONS.map((route) => {
          const reviewed = visited.has(route.id)
          return (
            <button
              key={route.id}
              type="button"
              data-testid={`home-route-${route.id}`}
              className={reviewed ? 'landing-route reviewed' : 'landing-route'}
              onClick={() => onNavigate(route.id)}
            >
              <span className="landing-route-label">{route.label}</span>
              <strong>{route.count}</strong>
              <span>{route.description}</span>
              <span className="landing-route-status">{reviewed ? 'Reviewed' : 'Open'}</span>
            </button>
          )
        })}
      </div>
    </section>

    <p className="landing-license">MIT · Copyright (c) 2026 Proof of Play, Inc. · <a href={sourceRepo}>View source</a></p>
  </section>
)
```

The background effect must use this failure-safe pattern:

```tsx
useEffect(() => {
  let active = true
  resolveAssetUrl(menuBackgroundAssetReference()).then(
    (url) => { if (active) setBackgroundUrl(url) },
    () => { if (active) setBackgroundUrl(null) },
  )
  return () => { active = false }
}, [])
```

- [ ] **Step 4: Add responsive Home styles**

Replace the old Dashboard-only layout rules with styles for `.landing-page`, `.landing-hero`, `.landing-hero-copy`, `.landing-stats`, `.landing-explore`, `.landing-section-heading`, `.landing-route-grid`, `.landing-route`, `.landing-route.reviewed`, `.landing-route-status`, and `.landing-license`. The rules must:

```css
.landing-page {
  display: grid;
  gap: 18px;
  max-width: 1240px;
  margin: 0 auto;
}

.landing-hero {
  min-height: min(62vh, 620px);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 24px;
  padding: clamp(24px, 5vw, 64px);
  border: 1px solid var(--border);
  border-radius: 18px;
  background-color: #172235;
  background-position: center;
  background-size: cover;
  overflow: hidden;
}

.landing-route-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.landing-route {
  min-height: 150px;
  display: grid;
  align-content: start;
  gap: 8px;
  text-align: left;
  padding: 14px;
  color: var(--text);
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  cursor: pointer;
}

.landing-route:hover,
.landing-route:focus-visible,
.landing-route.reviewed {
  border-color: var(--accent);
}

@media (max-width: 900px) {
  .landing-hero { grid-template-columns: 1fr; }
  .landing-route-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 560px) {
  .landing-route-grid { grid-template-columns: 1fr; }
}
```

Retain the shared control and metadata styles used by the other tabs. Remove only styles that are no longer referenced by the replaced Dashboard markup.

- [ ] **Step 5: Run Home e2e checks**

Run: `npx playwright test e2e/smoke.spec.ts -g 'Home introduces|attribution'`

Expected: PASS — Home renders, requests the UI pack background, routes to Models, and records one reviewed route.

### Task 4: Update visible attribution and documentation

**Files:**
- Modify: `games/pirate-nation-showcase/src/App.tsx`
- Modify: `games/pirate-nation-showcase/public/catalog/pirate-nation/manifest.json`
- Modify: `games/pirate-nation-showcase/README.md`

- [ ] **Step 1: Replace the footer copy**

Use this footer content in `App.tsx`:

```tsx
<footer className="app-footer">
  Pirate Nation art © 2026 Proof of Play, Inc. — MIT license. Thank you to Proof of Play for
  sharing this work so others can build with it.{' '}
  <a href="https://github.com/proofofplay/piratenation-game">View the source release</a>.
</footer>
```

The footer must not contain `Allowlisted extract`.

- [ ] **Step 2: Update the displayed manifest status**

Change only the `openSourceStatus` value in `public/catalog/pirate-nation/manifest.json`:

```json
"openSourceStatus": "Converted from the archival MIT release"
```

Keep the source repository, commit, license, copyright, and compatibility fields unchanged.

- [ ] **Step 3: Update the README**

Change the first-tab description from `Overview` to `Home`. Document that Home uses the pinned UI-pack menu background, provides five route buttons, and reports session-only reviewed progress. Add the shared model yaw note under Models: the Models page starts at the same `MODEL_PREVIEW_YAW` used for saved thumbnails. Add a short link to `docs/avatar-z-fighting.md` and state that it documents diagnosis only; it does not apply a production workaround.

- [ ] **Step 4: Verify visible copy and docs references**

Run: `rg -n -i 'allowlisted extract|Overview|MODEL_PREVIEW_YAW|avatar-z-fighting|session-only' src public/catalog/pirate-nation/manifest.json README.md`

Expected: no user-facing source contains `allowlisted extract`; README contains Home, orientation, session-progress, and research references. Technical provenance files may still contain `allowlisted` source-selection wording.

### Task 5: Research avatar z-fighting without changing production rendering

**Files:**
- Create: `games/pirate-nation-showcase/docs/avatar-z-fighting.md`

- [ ] **Step 1: Capture reproducible current-render cases**

From `games/pirate-nation-showcase`, run `npm run dev`. Create the throwaway script `/private/tmp/avatar-z-fighting-research.spec.ts` and run it with `npx playwright test /private/tmp/avatar-z-fighting-research.spec.ts --config=playwright.config.ts --workers=1`. The script must select the values through the existing `label.slot-row` controls, select animations through the existing `Animation` control, click the existing `.stage-backdrop-toggle` for the light-stage pass, and save screenshots under `/private/tmp/avatar-z-fighting/`. Use these exact screenshot dimensions and names: `1280x900`, and `<bottoms>-<shoes>/<stage>/<animation>-initial.png`, `<animation>-front.png`, `<animation>-side.png`, and `<animation>-rear.png`. Use a fresh fit before each camera direction and perform the orbit with the canvas pointer so the camera state is reproducible. Delete the throwaway script and screenshots after the report is complete.

Use these exact selections:

```text
bottoms 12 + shoes 2
bottoms 12 + shoes 3
bottoms 12 + shoes 4
bottoms 12 + shoes 5
bottoms 12 + shoes 15
bottoms 1 + shoes 1
bottoms 23 + shoes 6
```

Capture the bind pose and these clips: `00_TPose`, `01_Idle_1`, `04_Walk`, `06_Jump_Run`, `22_Drunk`, and `31_Swimming`. Record whether the artifact is visible in the initial camera and after orbit to front, side, and rear views. Avatar Lab has no turntable control, so do not add one for this research. Store temporary screenshots outside the repository.

Expected: exactly 392 screenshots exist for the seven part pairs, two stages, seven animation states, and four camera states. The matrix identifies which part and animation combinations show depth instability. The existing `logarithmicDepthBuffer`, floor offset, camera near/far values, and shadow settings are recorded with each run.

- [ ] **Step 2: Run the asset-level geometry probe**

Use `~/dev/jam-ready-assets/3D/pirate/proofofplay-pirate-nation-models/characters-skins/characters-skins-avatar-animation-all-023.glb` as the input. Create `/private/tmp/avatar-z-fighting-probe.ts`, then run `node --import tsx /private/tmp/avatar-z-fighting-probe.ts --input ~/dev/jam-ready-assets/3D/pirate/proofofplay-pirate-nation-models/characters-skins/characters-skins-avatar-animation-all-023.glb --output /private/tmp/avatar-z-fighting/probe.json`. The output must be JSON that the report can cite. Delete the throwaway probe after the report is complete. The probe must:

1. Parse the embedded GLB buffer and validate the one skin and its inverse-bind matrices.
2. Apply bind-pose skin matrices to POSITION vertices using JOINTS_0 and WEIGHTS_0.
3. Compare all renderable part meshes across slot pairs at thresholds `1e-8`, `1e-6`, `1e-5`, and `1e-4`.
4. Report the pair, vertex count, closest distance, material name, and alpha mode for every pair that crosses a threshold.
5. Report whether each animation sample changes the distance for the affected pair.

The JSON must contain `thresholds`, `pairs`, `closestDistance`, `vertexCount`, `materialName`, `alphaMode`, and `animationSamples` fields. Expected baseline: the probe reports the known `shoes 2`, `3`, `4`, `5`, and `15` versus `bottoms 12` matches and reports their opaque `PN-Material`. Any new pair must also appear in the report.

- [ ] **Step 3: Test candidate rendering mitigations in a throwaway harness**

Create `/private/tmp/avatar-z-fighting-harness.ts` from the current avatar renderer for the experiment, and run `node --import tsx /private/tmp/avatar-z-fighting-harness.ts --input /private/tmp/avatar-z-fighting/probe.json --output /private/tmp/avatar-z-fighting/mitigations.json`. Test one change at a time against the same matrix. Do not edit `src/avatar/PirateAvatar.tsx` or commit a workaround during this step. Test:

```text
1. Current logarithmic depth only.
2. Three.js polygonOffset on affected opaque materials.
3. depthWrite = false on affected opaque materials.
4. A small view-space or normal-direction vertex offset after skinning.
5. A source-geometry offset applied only to the affected outer shell.
6. A camera near/far adjustment without material or geometry changes.
```

The JSON must contain one row for every candidate, part pair, stage, camera state, and animation state. Each row must contain `candidate`, `artifact`, `holes`, `ordering`, `shadows`, `animationStable`, and `pass` values. For each candidate, record whether it removes the artifact, causes holes or ordering errors, changes shadows, affects all selected parts, and remains stable in the sampled animations. A candidate passes only when it removes the artifact in all reproductions without a new visible defect.

- [ ] **Step 4: Write the research report**

Create `docs/avatar-z-fighting.md` with these exact headings:

1. `# Avatar z-fighting research`
2. `## Scope`
3. `## Current renderer`
4. `## Reproduction matrix`
5. `## Asset evidence`
6. `## Mitigation results`
7. `## Recommendation`

Under `Scope`, state that the report covers `src/avatar/PirateAvatar.tsx` and `src/tabs/AvatarLab.tsx`, is diagnosis only, and does not change the shipped avatar GLB or apply a production workaround. Under `Current renderer`, include the measured Canvas depth flag, camera FOV, FitCamera near/far rules, floor offset, shadow settings, material alpha modes, and selected-part removal path. Under `Reproduction matrix`, include every tested bottoms/shoes pair, stage, camera state, and animation with its observed result. Under `Asset evidence`, include the probe distances and material data, including the known `bottoms 12` matches for shoes 2, 3, 4, 5, and 15. Under `Mitigation results`, include one completed result for every candidate and state its visual, animation, shadow, and pass/fail outcome. Under `Recommendation`, state the confirmed cause, the least invasive valid mitigation, and whether production implementation is deferred to a separate change.

The report must contain measured values and completed decisions. It must not contain an empty result field, a sample value presented as a finding, or an unresolved candidate.

- [ ] **Step 5: Verify that research did not change production rendering**

Run: `git diff -- src/avatar/PirateAvatar.tsx src/tabs/AvatarLab.tsx src/pack3d/PackCanvas.tsx`

Expected: no diff. The research report is the only permanent avatar-specific addition.

### Task 6: Run the complete verification suite

**Files:**
- Verify all files in the roster.

- [ ] **Step 1: Run unit tests and typecheck**

Run: `npm run typecheck && npm test`

Expected: typecheck passes and all unit tests pass.

- [ ] **Step 2: Run the complete e2e suite**

Run: `npm run test:e2e`

Expected: all existing tests and the new Home, route, attribution, and orientation tests pass.

- [ ] **Step 3: Build the production app**

Run: `npm run build`

Expected: Vite builds successfully. The build contains catalog metadata but no local Pirate Nation GLB, MP3, WAV, or generated model-preview payload.

- [ ] **Step 4: Perform the final source checks**

Run: `rg -n 'Math\.PI - Math\.PI / 5|MODEL_PREVIEW_YAW' src/thumb.tsx src/components/ModelViewer.tsx src/pack3d`

Expected: the numeric yaw expression appears only in `src/pack3d/modelViewConfig.ts`, and both render paths reference `MODEL_PREVIEW_YAW`.

Run: `rg -n -i 'allowlisted extract' src public/catalog/pirate-nation/manifest.json README.md`

Expected: no match. Technical provenance documents are outside this check by design.

Run: `test -f docs/avatar-z-fighting.md && rg -n 'Current renderer|Reproduction matrix|Asset evidence|Mitigation results|Recommendation' docs/avatar-z-fighting.md`

Expected: the research report exists and contains all required sections.

## Open Questions

- The avatar report may recommend a follow-up production change. That change is intentionally separate from this plan until the evidence identifies one mitigation that works for all reproduced combinations.
- Home uses the existing menu background as a CSS background. A later design pass may add a dedicated preview image or additional motion, but this plan does not add either.
