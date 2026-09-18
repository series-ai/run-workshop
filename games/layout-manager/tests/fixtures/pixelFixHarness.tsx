import React from 'react';
import { createRoot } from 'react-dom/client';
import { PaintEditor } from '../../src/workspace/paint/PaintEditor';
import type { ImageNode } from '../../src/workspace/types';

// Isolated editor harness: synthetic image only, no external services/assets.
const container = document.createElement('div');
container.id = 'pixel-fix-test-root';
document.body.append(container);
const app = document.getElementById('root');
if (app) app.style.display = 'none';
const root = createRoot(container);
let session = 0;
const source = document.createElement('canvas');
source.width = 320;
source.height = 240;
const ctx = source.getContext('2d')!;
ctx.fillStyle = '#2878dd';
ctx.fillRect(100, 80, 100, 100);
ctx.fillStyle = 'rgba(40,120,220,0.01)';
ctx.fillRect(280, 30, 1, 1);
const image: ImageNode = {
  id: 'pixel-fix-fixture',
  src: source.toDataURL(),
  fileName: 'pixel-fix-fixture.png',
  naturalWidth: 320,
  naturalHeight: 240,
  width: 320,
  height: 240,
  x: 0,
  y: 0,
  rotation: 0,
  zIndex: 0,
  opacity: 1,
  locked: false,
  spriteName: '',
  parentId: null,
  basePosition: null,
  offsetPosition: null,
  layerOrder: 'above',
  replacesParent: false,
  flipH: false,
  flipV: false,
};
const qa = {
  image,
  applied: null as unknown[] | null,
  cancelled: false,
  history: null as {
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
  } | null,
  mount(overrides: Partial<ImageNode> = {}) {
    qa.applied = null;
    qa.cancelled = false;
    localStorage.setItem(
      'paintBrushSettings',
      JSON.stringify({ type: 'eraser', size: 8, opacity: 1, hardness: 1 }),
    );
    root.render(
      <PaintEditor
        key={++session}
        image={{ ...image, ...overrides }}
        zoom={1}
        pan={{ x: 340, y: 180 }}
        scaleFilter="nearest"
        guides={[]}
        snapEnabled={false}
        onApply={(...args) => {
          qa.applied = args;
          root.render(null);
        }}
        onCancel={() => {
          qa.cancelled = true;
          root.render(null);
        }}
        onHistoryChange={(state) => {
          qa.history = state;
        }}
      />,
    );
  },
};
(window as unknown as { pixelFixQa: typeof qa }).pixelFixQa = qa;
qa.mount();
