# Layout Manager - Project Notes

## Overview

Layout Manager is a browser-based image layout and composition tool, inspired by [PureRef](https://www.pureref.com/). It provides a freeform workspace for importing, arranging, and aligning images — built specifically for sprite work like overlaying character heads onto headless bodies.

The project uses a React + Vite + TypeScript stack running in the browser. It was bootstrapped from a RUN.game 2D React template and repurposed into this tool.

### Reference

- **AnimRef** (open-source PureRef remake): https://github.com/lettucegoblin/AnimRef
  - Electron-based PureRef clone with support for animated/video content
  - Used as a reference for understanding PureRef-style UI patterns and controls

## Motivation

The primary use case is combining chibi character images:

1. A headless character body (front and side views) serves as a base
2. Multiple head variations (different emotions) need to be overlaid on the body
3. Heads need precise alignment and may require masking
4. Once aligned, the head position is saved and offset onto a sprite sheet

PureRef's window-overlay features aren't needed — a browser window is sufficient. The core value is the freeform image control: moving, scaling, rotating, and aligning images with precision.

## Tech Stack

- **React** 18.x with TypeScript
- **Vite** 6.x (dev server & bundler)
- **DOM-based rendering** using CSS transforms (not HTML5 Canvas)
- **State management**: `useReducer` hook (no external libraries)

## Architecture

```
src/
├── workspace/
│   ├── types.ts              # ImageNode, WorkspaceState, ProjectFile, action types
│   ├── useWorkspaceState.ts  # useReducer state management + image loading + alignment
│   ├── Workspace.tsx         # Main viewport: pan, zoom, drop zone, keyboard shortcuts
│   ├── ImageNode.tsx         # Draggable/resizable/rotatable image component
│   ├── GroupTransformBox.tsx  # Multi-select bounding box with group scale/rotate handles
│   ├── Toolbar.tsx           # Hamburger menu, import, zoom controls, normalize, 1:1
│   ├── ContextMenu.tsx       # Right-click menu for layers and scale operations
│   ├── InfoPanel.tsx         # Right-side panel showing selected image details
│   └── projectFile.ts        # Save/load .layout project files
├── components/
│   └── ErrorBoundary.tsx     # React error boundary
├── App.tsx                   # Root component, renders Workspace
├── main.tsx                  # Entry point
└── style.css                 # All styles
```

### Key Design Decisions

- **DOM-based (not Canvas)**: Individual images are `<div>` elements with CSS `transform` for position, scale, and rotation. This integrates naturally with React and is performant for the expected number of images.
- **Workspace coordinate system**: An inner "canvas" div is transformed with `translate` and `scale` inside a fixed "viewport" div. All image positions are in workspace coordinates; screen-to-workspace conversion accounts for pan and zoom.
- **Pointer events** (not mouse events) for cross-device compatibility.
- **Project files**: Saved as `.layout` JSON files with images embedded as base64 data URLs — fully self-contained, no external file dependencies.

## Features Implemented

### Project Save/Load
- **Save Project** (Ctrl+S): Exports workspace as a `.layout` file with all images embedded as base64
- **Open Project** (Ctrl+O): Loads a `.layout` file and restores full workspace state
- Accessible via hamburger menu in the toolbar

### Image Import
- Drag and drop files onto the workspace
- File picker via Import button in toolbar
- Supports: PNG, JPG, GIF, WebP, SVG
- Images are loaded via `URL.createObjectURL()` for efficiency

### Image Manipulation
- **Move**: Left-click drag (moves all selected images together)
- **Resize**: Corner handles (aspect-ratio locked by default, Shift for free resize)
- **Rotate**: Top circle handle (Shift for 15-degree snap)
- **Delete**: Delete or Backspace key
- **1:1 Scale** (toolbar): Resets all images to their original/native resolution

### Group Transform (Multi-Select)
When 2+ images are selected, a dashed bounding box appears around the group with:
- **Corner resize handles**: Drag to scale all images proportionally as a group. Images scale relative to the opposite corner anchor, maintaining their relative positions (no overlaps from in-place scaling)
- **Rotation handle**: Drag the circle above the box to rotate all images around the group center. Shift-snaps to 15-degree increments
- Individual image handles are hidden during multi-select; only the group box handles are shown
- Both group scale and group rotate are continuous operations backed by SNAPSHOT for single-step undo

### Selection
- Click to select a single image
- Ctrl+click to toggle individual images in/out of selection
- **Marquee selection**: Ctrl+drag on empty space draws a selection box
- Ctrl+A to select all
- Click empty space to deselect

### Layer Ordering
- Right-click context menu: Bring to Front, Bring Forward, Send Backward, Send to Back
- Keyboard: Ctrl+] (bring forward), Ctrl+[ (send backward)

### Alignment (PureRef-style)
Requires 2+ images selected. Uses a two-pass algorithm:
1. **Collision slide**: Each image slides in the chosen direction until it hits an obstacle or another selected image (processed front-to-back so they stack like pushing blocks)
2. **Overlap resolution**: Any images that still overlap after the slide (e.g. images that started perfectly stacked) get pushed out into a line along the perpendicular axis

- **Ctrl+Up**: Slide images upward; overlaps resolved left-to-right
- **Ctrl+Down**: Slide images downward; overlaps resolved left-to-right
- **Ctrl+Left**: Slide images leftward; overlaps resolved top-to-bottom
- **Ctrl+Right**: Slide images rightward; overlaps resolved top-to-bottom

### Scale Operations
- **Normalize** (toolbar): Normalizes all images to 300px height, preserving aspect ratio
- **1:1** (toolbar): Resets all images to their native resolution
- **Scale Reset Up** (context menu, multi-select): Scales selected images to match the tallest
- **Scale Reset Down** (context menu, multi-select): Scales selected images to match the shortest
- **Normalize** (context menu, multi-select): Scales selected images to their average height

### Info Panel
Appears on the right side when image(s) are selected:
- Thumbnail preview of the last-selected image
- File name, image type, original resolution, display resolution, position, rotation, layer
- Multi-select badge showing count
- Focus button to zoom-to-fit the selected image

### Undo / Redo
- **Ctrl+Z**: Undo last action
- **Ctrl+Shift+Z** or **Ctrl+Y**: Redo
- Undo/redo buttons in the toolbar (with disabled state when stack is empty)
- History wrapper pattern: non-undoable actions (select, pan, zoom) skip history; continuous actions (drag, resize, rotate) use a SNAPSHOT before the operation so the entire drag is one undo step
- Max history depth: 100 states

### Viewport
- **F**: Frame selection (zoom-to-fit selected images, or all images if nothing selected)
- Mouse wheel to zoom (centered on cursor)
- Middle-click drag or Space+drag to pan
- Zoom in/out/reset buttons in toolbar
- Zoom percentage display
- Subtle grid background

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| Ctrl+S | Save project |
| Ctrl+O | Open project |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z / Ctrl+Y | Redo |
| Ctrl+A | Select all images |
| F | Frame selection (or all images) |
| Delete / Backspace | Delete selected images |
| Ctrl+] | Bring selected forward one layer |
| Ctrl+[ | Send selected backward one layer |
| Ctrl+Up | Align selection to top |
| Ctrl+Down | Align selection to bottom |
| Ctrl+Left | Align selection to left |
| Ctrl+Right | Align selection to right |
| Space + drag | Pan workspace |
| Middle-click + drag | Pan workspace |
| Scroll wheel | Zoom (centered on cursor) |
| Ctrl+click | Toggle image in/out of selection |
| Ctrl+drag (empty space) | Marquee selection |
| Shift (while resizing) | Free resize (ignore aspect ratio) |
| Shift (while rotating) | Snap to 15-degree increments |
| Escape | Close context menu |

## Future Directions

- Head-on-body alignment saving and position export
- Masking / clipping for head images
- Sprite sheet layout and export
- Per-image opacity control
- Snap-to-grid or snap-to-edge guides
