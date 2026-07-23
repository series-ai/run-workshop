# Rigging

## Overview

Rigging defines parent-child relationships between sprite elements for paper doll / equipment systems. The purpose is to author sprite sheets where each element has a known position on the sheet AND a known offset for when it's "dressed" onto a parent element at runtime.

For example: a body sprite is the parent. A helmet sprite sits at position (200, 50) on the sprite sheet. When the helmet is equipped, the game engine needs to know "move this helmet by (-92, -40) from its sheet position and render it above the head." That delta is the **offset** — and rigging is how you author it visually.

## Core Concept

Every child element has two positions:

1. **Base position** — where the sprite lives on the sheet. This is its canvas position at export time, captured in the standard `frame` field that every element already has.
2. **Offset position** — where the sprite goes when dressed on the parent. The user visually positions/rotates/scales the child over the parent and saves this.

The export computes the **delta** between these two positions. A game engine reads: "take this sprite from its sheet position, apply this offset, render it above/below the parent."

## Terminology

- **Parent**: An element that has children attached to it (e.g. a body sprite).
- **Child**: An element attached to a parent (e.g. a hat, weapon, head).
- **Base position**: Where the child sits on the sprite sheet. Its current canvas position.
- **Offset position**: Where the child goes when equipped/dressed on the parent. Saved explicitly by the user.
- **Offset (exported)**: The delta between base and offset positions — what the game engine applies at runtime.
- **Layer order**: Whether the child renders above or below the parent (controls z-index).

## Authoring Workflow

### 1. Link parent to child

Select the parent element. A **chain link icon** appears in the top button row (next to lock and onion skin). Drag from this icon onto another element — the element you release on becomes the child.

### 2. Set base position

With the child selected, arrange it where you want it on the sprite sheet. Click **Set Base Position** in the Info Panel's Rig section. This saves a snapshot of the child's current x, y, width, height, and rotation.

### 3. Set offset position

Move/rotate/scale the child to where it should render when dressed on the parent (e.g. place the helmet on the head). Click **Set Offset Position**. This saves the dressed pose.

### 4. Snap back for export

Click **Go To Base** to snap the child back to its sheet position. The sprite sheet is now laid out for export — all elements in their packed positions.

Click **Go To Offset** anytime to preview the dressed look again.

### 5. Export

**Export Canvas Info** produces a JSON file. Each child element's `frame` is its base/sheet position. The `offset` field is the computed delta from base to offset position. The game engine applies that delta at runtime to dress the paper doll.

## UI

### Attach button (on selected elements)

Chain link icon in the top button row. Drag FROM the parent TO the child to establish the relationship. A dashed line follows the cursor during the drag.

### Node Tree Panel (left side)

Appears when a selected element is part of a rig. Shows the hierarchy as an indented tree:

```
 Node Tree
 ─────────────────────
 body
 ├── head        A ✕
 │   └── helmet  A ✕
 ├── left_arm    A ✕
 │   └── shield  B ✕
 └── right_arm   A ✕
     └── sword   A ✕
```

- **Click** a node to select it on the canvas.
- **A/B badge** indicates above/below layer order.
- **✕ button** on each child to detach it.
- **Expand/collapse** subtrees with the arrow toggle.
- **Collapsible header** to minimize the panel.

### Info Panel — Rig section (child selected)

- **Parent**: clickable link to select the parent.
- **Layer**: Above/Below toggle — actually changes the element's z-index relative to the parent.
- **Set Base Position**: saves current canvas position as the sheet position.
- **Go To Base**: snaps element back to saved base position.
- **Set Offset Position**: saves current canvas position as the dressed position.
- **Go To Offset**: snaps element to saved offset position (preview dressed look).
- **Detach**: removes the parent-child relationship.

### Info Panel — Rig section (parent selected)

Shows role (Parent) and child count.

### Context Menu

**Detach from Parent** option appears when right-clicking a child element.

## Behavior

### Moving a parent moves children

Dragging a parent moves all descendants with it. Recursive — moving the body moves the head, which moves the helmet.

### Deleting a parent

Children are detached (become root elements at their current positions). Children are never implicitly deleted.

### Cycle prevention

A node cannot be attached to its own descendant. The reducer rejects the action.

### Non-destructive

- Rigging is metadata — element positions are independent.
- Replacing a source image preserves all rig relationships and saved positions.
- Detaching clears rig data but leaves the element where it is.
- All rig operations are undoable.
- Rig data is persisted in `.layout` project files.

## Data Model

### ImageNode fields

```typescript
interface ImageNode {
  // ... existing fields (x, y, width, height, rotation, etc.) ...

  /** ID of the parent node, or null if root. */
  parentId: string | null;

  /** Saved sheet position (set by user via "Set Base Position"). */
  basePosition: SavedPosition | null;

  /** Saved dressed position (set by user via "Set Offset Position"). */
  offsetPosition: SavedPosition | null;

  /** Whether this child renders above or below its parent. */
  layerOrder: 'above' | 'below';
}

interface SavedPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}
```

### Reducer actions

- `ATTACH_TO_PARENT { childId, parentId }` — link child to parent.
- `DETACH_FROM_PARENT { childId }` — remove relationship, clear saved positions.
- `SET_LAYER_ORDER { id, layerOrder }` — change z-index relative to parent.
- `SET_BASE_POSITION { id }` — snapshot current position as base.
- `SET_OFFSET_POSITION { id }` — snapshot current position as offset.
- `GOTO_BASE_POSITION { id }` — restore element to saved base position.
- `GOTO_OFFSET_POSITION { id }` — restore element to saved offset position.

## Export: Canvas Info JSON

The exported JSON includes rig data on child elements:

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

### Field reference for child elements

| Field | Description |
|---|---|
| `frame` | Where the sprite is on the sheet (base position). Same as every element. |
| `parent` | Sprite name of the parent element. |
| `offset` | Delta from base to dressed position: `{dx, dy, dw, dh, dRotation}`. Apply this to `frame` to get the equipped position. |
| `layerOrder` | `"above"` or `"below"` — render order relative to parent. |
| `children` | Array of child sprite names (convenience — tree is also reconstructable from `parent` fields). |

### How a game engine uses this

1. Render the body sprite at its `frame` position (or wherever the character is on screen).
2. For each child (e.g. helmet): take its `frame` from the sheet, apply the `offset` delta to position it relative to the body.
3. Use `layerOrder` to determine draw order.
4. Swapping equipment = same offset, different sprite from the sheet.

Root elements (no `parent`) have no `offset` or `layerOrder` fields. Their `frame` is their only position.
