# Canvas Info Export

## Overview

Export a JSON metadata file describing every sprite on the canvas — their names, positions, dimensions, rotation, exact corner coordinates, and rig relationships. This file is exported alongside the PNG and follows the **TexturePacker JSON Hash format**, the de facto standard for sprite sheet descriptors. It is natively supported by PixiJS, Phaser, Cocos2d, Godot, PlayCanvas, and others.

The primary goal is to produce a file that a human, an LLM, or a game engine can read and immediately understand the full layout of a sprite sheet — including how to dress a paper doll — without inspecting the image.

## Output Format

The exported file is named `canvas-export.json` and sits alongside `canvas-export.png`.

### Basic elements (no rig)

```json
{
  "frames": {
    "player_idle": {
      "frame": { "x": 10, "y": 20, "w": 64, "h": 64 },
      "rotation": 0,
      "corners": [
        { "x": 10, "y": 20 },
        { "x": 74, "y": 20 },
        { "x": 74, "y": 84 },
        { "x": 10, "y": 84 }
      ],
      "sourceSize": { "w": 64, "h": 64 }
    }
  },
  "meta": {
    "app": "LayoutManager",
    "image": "canvas-export.png",
    "size": { "w": 512, "h": 256 },
    "scale": "1"
  }
}
```

### Elements with rig relationships

```json
{
  "frames": {
    "body": {
      "frame": { "x": 100, "y": 50, "w": 64, "h": 96 },
      "rotation": 0,
      "corners": [
        { "x": 100, "y": 50 },
        { "x": 164, "y": 50 },
        { "x": 164, "y": 146 },
        { "x": 100, "y": 146 }
      ],
      "sourceSize": { "w": 64, "h": 96 },
      "children": ["head", "left_arm", "right_arm"]
    },
    "helmet": {
      "frame": { "x": 200, "y": 50, "w": 48, "h": 28 },
      "rotation": 0,
      "corners": [
        { "x": 200, "y": 50 },
        { "x": 248, "y": 50 },
        { "x": 248, "y": 78 },
        { "x": 200, "y": 78 }
      ],
      "sourceSize": { "w": 48, "h": 28 },
      "parent": "head",
      "offset": { "dx": -92, "dy": -40, "dw": 0, "dh": 0, "dRotation": 0 },
      "layerOrder": "above"
    }
  },
  "meta": {
    "app": "LayoutManager",
    "image": "canvas-export.png",
    "size": { "w": 512, "h": 256 },
    "scale": "1"
  }
}
```

## Field Reference

### Per-frame fields (all elements)

| Field | Description |
|---|---|
| `frame` | `{x, y, w, h}` — the element's position and display size on the sheet. This is the base/sheet position. `x` and `y` are the top-left origin before rotation. |
| `rotation` | Rotation in degrees. Pivot point is the center of the element. |
| `corners` | Array of 4 `{x, y}` points — actual pixel positions of the element's corners after rotation. Order: top-left, top-right, bottom-right, bottom-left. |
| `sourceSize` | `{w, h}` — original (natural) dimensions of the source image before any scaling. |

### Rig fields (child elements only)

| Field | Description |
|---|---|
| `parent` | Sprite name of the parent element. |
| `offset` | `{dx, dy, dw, dh, dRotation}` — the delta from the child's sheet position to its dressed/equipped position. Apply this to `frame` to get where the sprite goes when equipped on the parent. |
| `layerOrder` | `"above"` or `"below"` — render order relative to the parent. |

### Rig fields (parent elements only)

| Field | Description |
|---|---|
| `children` | Array of child sprite names. Convenience field — the tree can also be reconstructed from `parent` fields alone. |

### Meta fields

| Field | Description |
|---|---|
| `app` | Always `"LayoutManager"`. |
| `image` | Filename of the associated PNG export. |
| `size` | `{w, h}` — the canvas dimensions in pixels. |
| `scale` | Scale factor, always `"1"`. |

## How a game engine uses the offset

1. Render the parent sprite (e.g. body) at its game-world position.
2. For each child: read the sprite from its `frame` position on the sheet.
3. Apply `offset` to compute the equipped position: `equippedX = frame.x + offset.dx`, etc.
4. Use `layerOrder` to determine draw order relative to the parent.
5. Swapping equipment (e.g. different helmet) = same offset, different sprite from the sheet.

The `offset` is omitted if the user hasn't set an offset position for that child — meaning the rig relationship exists but the dressed pose hasn't been authored yet.

## Why both `frame` and `corners`?

The standard `frame` + `rotation` fields are what game engines expect. But reconstructing actual pixel bounds from a rect and an angle requires trigonometry, and mistakes are easy. The `corners` array eliminates that entirely:

- **Game engines** use `frame` and `rotation`, ignoring `corners`.
- **Humans and LLMs** read `corners` and immediately see exactly where each sprite is — no math required.
- **Unrotated elements** still include `corners` for consistency (they're just the 4 rect corners).

This is purely additive to the TexturePacker format — standard consumers ignore unknown fields, so compatibility is preserved.

## Scope: Canvas-only

Only elements that overlap the canvas area are included. The canvas occupies the rectangle from `(0, 0)` to `(canvas.width, canvas.height)`. An element is included if any part of it overlaps this region — the same check used by PNG export. Elements fully outside the canvas are excluded.

Element coordinates in the JSON are their actual workspace positions, which may be negative or extend beyond the canvas edge. This accurately represents where the sprite sits relative to the sheet.

## Sprite Name Resolution

Each frame is keyed by the element's **sprite name** (max 32 characters). The sprite name is an optional field in the Info Panel. If not set, the original filename (without extension) is used as the fallback.

## Pre-export Validation

Before export, the system checks for issues among canvas-overlapping elements and highlights problems directly on the canvas:

- **Missing sprite names** (yellow highlight) — elements using filename fallback instead of a custom sprite name.
- **Duplicate sprite names** (red highlight) — multiple elements sharing the same resolved name.

If issues are found, a warning panel lists them. The user can:

- **Cancel** and fix the names in the Info Panel.
- **Export Anyway**, in which case duplicates are disambiguated with `_2`, `_3`, etc. suffixes.

## UI

The **"Export Canvas Info"** button is in the canvas menu dropdown, next to "Export PNG". Clicking it:

1. Validates sprite names (checks for duplicates and missing names).
2. If issues exist, highlights problem elements on the canvas and shows a warning dialog.
3. Builds the JSON from all canvas-overlapping elements, sorted by z-index.
4. Triggers a file download of `canvas-export.json`.

Highlights are cleared when the warning is dismissed or the menu is closed.
