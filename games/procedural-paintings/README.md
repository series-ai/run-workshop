# Procedural Paintings

Twenty-one real-time procedural WebGL painting scenes built with Three.js and custom GLSL shaders — **16 pre-1910 public-domain works** and **5 original style studies** — with **zero external assets** (every brush stroke, canvas weave, impasto height field, SDF sculpture, and architectural silhouette is synthesized in code).

## Run it

```bash
npm install
npm run dev        # http://localhost:5200
```

Other scripts:

- `npm run typecheck` — run `tsc --noEmit`
- `npm run build` — typecheck and bundle to `dist/` (uses `rundotGameLibrariesPlugin` embedded Three.js CDN cache; pass `RUNDOT_GAME_DISABLE_EMBEDDED_LIBS=true` for a standalone bundle)
- `npm run preview` — preview `dist/` at `http://localhost:4200`
- `npm run test:e2e` — run Playwright WebGL smoke and `728×520` responsive layout checks across all 21 scenes

## Deploying to RUN

```bash
rundot login                                    # once per machine
rundot init --name "Procedural Paintings" --build-path ./dist
npm run deploy                                  # builds, then uploads
```

`rundot init` writes `game.config.prod.json`, which is per-account and gitignored.

## Query Parameters

- `?scene=<id>` — boot directly into any scene (e.g. `?scene=wave`, `?scene=grande-jatte`, `?scene=impossible-aqueduct`)
- `?single=1` — hide the gallery tab strip for single-painting showcase mode

## The 21 Scenes

### Public-Domain Works (Pre-1910)

1. `starry` — *The Starry Night* (Van Gogh · 1889)
2. `wave` — *The Great Wave off Kanagawa* (Hokusai · c. 1831)
3. `isle` — *Isle of the Dead* (Böcklin · 1883)
4. `lilies` — *Water Lilies and Japanese Footbridge* (Monet · 1899)
5. `grande-jatte` — *A Sunday Afternoon on the Island of La Grande Jatte* (Seurat · 1884)
6. `saint-tropez` — *The Port of Saint-Tropez* (Signac · 1901)
7. `impression-sunrise` — *Impression, Sunrise* (Monet · 1872)
8. `wheatfield` — *Wheatfield with Crows* (Van Gogh · 1890)
9. `cafe-terrace` — *Café Terrace at Night* (Van Gogh · 1888)
10. `sudden-shower` — *Sudden Shower over Shin-Ōhashi Bridge* (Hiroshige · 1857)
11. `red-fuji` — *Fine Wind, Clear Morning (Red Fuji)* (Hokusai · c. 1830)
12. `wanderer` — *Wanderer above the Sea of Fog* (Friedrich · 1818)
13. `sea-of-ice` — *The Sea of Ice* (Friedrich · 1824)
14. `scream` — *The Scream* (Munch · 1893)
15. `tree-of-life` — *The Tree of Life* (Klimt · 1905–09)
16. `birch-forest` — *Birch Forest* (Klimt · 1903)

### Original Style Studies

17. `daylight-nocturne` — *Harbor of Two Hours* (Surrealist Study)
18. `soft-time-desert` — *Meridian of Salt & Brass* (Surrealist Study)
19. `impossible-aqueduct` — *The Perpetual Aqueduct* (Paradox Lithograph)
20. `three-gravity-rotunda` — *Rotunda of Three Gravities* (Paradox Lithograph)
21. `kinetic-grid` — *Syncopated Grid No. 1* (Kinetic Relief Study)

## Controls

- **Drag** to orbit, **Scroll** to zoom
- **WASD / Arrow keys + Q / E** to fly (`Shift` for 3× speed)
- **Camera Presets** & **Auto-Drift** toggle in the bottom bar
