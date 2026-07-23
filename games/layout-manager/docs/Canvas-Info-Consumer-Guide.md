# Canvas Info Consumer Guide

How to read and use the `canvas-export.json` file produced by LayoutManager.

## Quick Start

You get two files with matching names:
- A `.png` file — the sprite sheet image.
- A `.json` file — metadata describing every sprite on the sheet, their positions, and how they relate to each other.

The `meta.image` field inside the JSON tells you which PNG file it belongs to.

## Coordinate System

- **Origin**: top-left corner of the sprite sheet.
- **X**: increases rightward.
- **Y**: increases downward.
- This is standard screen/canvas coordinates. No y-flip.

## Cutting Sprites from the Sheet

Every sprite has a `frame` field:

```json
"helmet": {
  "frame": { "x": 200, "y": 50, "w": 48, "h": 28 }
}
```

This is the clip rect. Cut a 48x28 rectangle starting at pixel (200, 50) from the PNG. That's your helmet sprite.

## Rotation

If `rotation` is non-zero, the sprite is rotated on the sheet. The pivot point is the center of the `frame` rect.

If you don't want to deal with rotation math, use the `corners` array instead — it gives you the 4 actual pixel positions of the sprite's corners after rotation:

```json
"corners": [
  { "x": 197.2, "y": 53.8 },   // top-left
  { "x": 243.6, "y": 66.3 },   // top-right
  { "x": 230.8, "y": 94.2 },   // bottom-right
  { "x": 184.4, "y": 81.7 }    // bottom-left
]
```

## sourceSize

Original dimensions of the source image before any scaling in the layout. This is metadata — you don't need it for rendering. It tells you the native resolution of the art asset.

## Parent-Child Relationships (Rigging)

Some sprites have parent-child relationships for paper doll / equipment systems.

### Identifying relationships

- A child has a `parent` field with the sprite name of its parent.
- A parent has a `children` array listing its child sprite names.
- Either field alone is enough to reconstruct the tree — both are included for convenience.

### Equipping a child on a parent (using offset)

A child with an `offset` field has authored dressing data:

```json
"helmet": {
  "frame": { "x": 200, "y": 50, "w": 48, "h": 28 },
  "parent": "head",
  "offset": { "dx": -92, "dy": -40, "dw": 0, "dh": 0, "dRotation": 0 },
  "layerOrder": "above"
}
```

To render the helmet equipped on the head:

```
dressedX = frame.x + offset.dx    →  200 + (-92) = 108
dressedY = frame.y + offset.dy    →  50 + (-40) = 10
dressedW = frame.w + offset.dw    →  48 + 0 = 48
dressedH = frame.h + offset.dh    →  28 + 0 = 28
dressedRotation = rotation + offset.dRotation
```

The offset is the delta from the sprite's **sheet position** to its **dressed/equipped position**. You add it to the frame values.

**The dressed position may be outside the canvas bounds.** This is normal — a large sword extending past the character, for example. The offset coordinates are in the same y-down coordinate space as everything else.

### Layer Order

- `"layerOrder": "above"` — draw this child on top of the parent.
- `"layerOrder": "below"` — draw this child behind the parent.

### Replacing the Parent

Some children have `"replacesParent": true`. This means the child is a visual replacement for the parent — a different pose, a variant, etc.

When a `replacesParent` child is active:
1. Hide the parent sprite.
2. Render this replacement child in its place.
3. Other children of the parent still render as normal (they may still need to dress onto the replacement).

Example: a "body" parent has children "head", "helmet", and "body_sitting". The sitting body has `replacesParent: true`. When the character sits, you hide the standing body and show body_sitting, but the head and helmet still render on top using their offsets.

### Children without offset

If a child has a `parent` but no `offset`, the rig relationship exists but the dressed position hasn't been authored. The sprite is on the sheet but there's no positioning data for equipping it yet.

## Full Example

```json
{
  "guide": { ... },
  "frames": {
    "body": {
      "frame": { "x": 0, "y": 0, "w": 64, "h": 96 },
      "rotation": 0,
      "corners": [
        { "x": 0, "y": 0 }, { "x": 64, "y": 0 },
        { "x": 64, "y": 96 }, { "x": 0, "y": 96 }
      ],
      "sourceSize": { "w": 256, "h": 384 },
      "children": ["head", "sword", "body_sleeping"]
    },
    "head": {
      "frame": { "x": 70, "y": 0, "w": 32, "h": 32 },
      "rotation": 0,
      "corners": [
        { "x": 70, "y": 0 }, { "x": 102, "y": 0 },
        { "x": 102, "y": 32 }, { "x": 70, "y": 32 }
      ],
      "sourceSize": { "w": 128, "h": 128 },
      "parent": "body",
      "offset": { "dx": -54, "dy": -28, "dw": 0, "dh": 0, "dRotation": 0 },
      "layerOrder": "above",
      "children": ["helmet"]
    },
    "helmet": {
      "frame": { "x": 110, "y": 0, "w": 36, "h": 24 },
      "rotation": 0,
      "corners": [
        { "x": 110, "y": 0 }, { "x": 146, "y": 0 },
        { "x": 146, "y": 24 }, { "x": 110, "y": 24 }
      ],
      "sourceSize": { "w": 144, "h": 96 },
      "parent": "head",
      "offset": { "dx": -96, "dy": -18, "dw": 0, "dh": 0, "dRotation": 0 },
      "layerOrder": "above"
    },
    "sword": {
      "frame": { "x": 150, "y": 0, "w": 16, "h": 48 },
      "rotation": 0,
      "corners": [
        { "x": 150, "y": 0 }, { "x": 166, "y": 0 },
        { "x": 166, "y": 48 }, { "x": 150, "y": 48 }
      ],
      "sourceSize": { "w": 64, "h": 192 },
      "parent": "body",
      "offset": { "dx": -110, "dy": 20, "dw": 0, "dh": 0, "dRotation": -15 },
      "layerOrder": "above"
    },
    "body_sleeping": {
      "frame": { "x": 170, "y": 0, "w": 96, "h": 48 },
      "rotation": 0,
      "corners": [
        { "x": 170, "y": 0 }, { "x": 266, "y": 0 },
        { "x": 266, "y": 48 }, { "x": 170, "y": 48 }
      ],
      "sourceSize": { "w": 384, "h": 192 },
      "parent": "body",
      "offset": { "dx": -170, "dy": 24, "dw": 32, "dh": -48, "dRotation": 90 },
      "layerOrder": "above",
      "replacesParent": true
    }
  },
  "meta": {
    "app": "LayoutManager",
    "image": "See matching .png file",
    "size": { "w": 512, "h": 256 },
    "scale": "1"
  }
}
```

### Rendering the standing character

1. Draw `body` at (0, 0) from the sheet.
2. Draw `head` at (70 + -54, 0 + -28) = (16, -28) — above the body (`layerOrder: "above"`).
3. Draw `helmet` at (110 + -96, 0 + -18) = (14, -18) — above the head.
4. Draw `sword` at (150 + -110, 0 + 20) = (40, 20) rotated -15° — above the body.

### Switching to sleeping

1. `body_sleeping` has `replacesParent: true`.
2. Hide `body`.
3. Draw `body_sleeping` at its dressed position (170 + -170, 0 + 24) = (0, 24) with its offset applied.
4. Other children (`head`, `helmet`, `sword`) still render as normal using their own offsets.

## The `guide` field

The JSON itself contains a `guide` object at the top level with short descriptions of every field. Read it if you're unsure about any field while working with the data.
