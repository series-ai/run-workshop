import { useEffect, useRef, useState, useLayoutEffect } from 'react';
import type { ContextMenuState, WorkspaceAction, ImageNode } from './types';

interface ContextMenuProps {
  menu: ContextMenuState;
  dispatch: React.Dispatch<WorkspaceAction>;
  onClose: () => void;
  selectedIds: Set<string>;
  images: ImageNode[];
  onSaveImages?: (ids: string[], mode: '1:1' | 'display') => void;
  onRasterizeElement?: (id: string) => void;
}

export function ContextMenu({ menu, dispatch, onClose, selectedIds, images, onSaveImages, onRasterizeElement }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('pointerdown', handleClick, true);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handleClick, true);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const multiSelected = selectedIds.size > 1;
  const selectionIds = Array.from(selectedIds);

  const items: { label: string; action: () => void; separator?: boolean; danger?: boolean }[] = [];

  // Layer ordering (single image)
  items.push({
    label: 'Bring to Front',
    action: () => {
      dispatch({ type: 'BRING_TO_FRONT', id: menu.imageId });
      onClose();
    },
  });
  items.push({
    label: 'Bring Forward',
    action: () => {
      dispatch({ type: 'BRING_FORWARD', id: menu.imageId });
      onClose();
    },
  });
  items.push({
    label: 'Send Backward',
    action: () => {
      dispatch({ type: 'SEND_BACKWARD', id: menu.imageId });
      onClose();
    },
  });
  items.push({
    label: 'Send to Back',
    action: () => {
      dispatch({ type: 'SEND_TO_BACK', id: menu.imageId });
      onClose();
    },
  });

  // 1:1 scale (always available)
  items.push({ label: '', separator: true, action: () => {} });
  items.push({
    label: '1:1 Scale',
    action: () => {
      const ids = multiSelected ? selectionIds : [menu.imageId];
      dispatch({ type: 'ORIGINAL_SCALE_SELECTION', ids });
      onClose();
    },
  });
  if (onRasterizeElement && images.find((i) => i.id === menu.imageId)?.nodeType !== 'text') {
    items.push({
      label: 'Rasterize to New Element',
      action: () => {
        onRasterizeElement(menu.imageId);
        onClose();
      },
    });
  }

  // Make Canvas
  if (multiSelected) {
    items.push({
      label: 'Make Page from Selection',
      action: () => {
        const selected = images.filter((img) => selectedIds.has(img.id));
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const img of selected) {
          const cx = img.x + img.width / 2;
          const cy = img.y + img.height / 2;
          const rad = (img.rotation * Math.PI) / 180;
          const cos = Math.abs(Math.cos(rad));
          const sin = Math.abs(Math.sin(rad));
          const rbw = img.width * cos + img.height * sin;
          const rbh = img.width * sin + img.height * cos;
          minX = Math.min(minX, cx - rbw / 2);
          minY = Math.min(minY, cy - rbh / 2);
          maxX = Math.max(maxX, cx + rbw / 2);
          maxY = Math.max(maxY, cy + rbh / 2);
        }
        const bw = Math.round(maxX - minX);
        const bh = Math.round(maxY - minY);
        dispatch({ type: 'SET_CANVAS', canvas: { width: bw, height: bh } });
        dispatch({ type: 'MOVE_IMAGES', ids: selectionIds, dx: -minX, dy: -minY });
        onClose();
      },
    });
    items.push({
      label: 'Make Page (1:1) from Selection',
      action: () => {
        dispatch({ type: 'ORIGINAL_SCALE_SELECTION', ids: selectionIds });
        dispatch({ type: 'MAKE_CANVAS_FROM_SELECTION', ids: selectionIds });
        onClose();
      },
    });
  } else {
    items.push({
      label: 'Make Page (1:1)',
      action: () => {
        const image = images.find((img) => img.id === menu.imageId);
        if (!image) { onClose(); return; }
        const rawW = image.cropRect ? image.cropRect.w : image.naturalWidth;
        const rawH = image.cropRect ? image.cropRect.h : image.naturalHeight;
        const rad = (image.rotation * Math.PI) / 180;
        const cos = Math.abs(Math.cos(rad));
        const sin = Math.abs(Math.sin(rad));
        const cw = Math.round(rawW * cos + rawH * sin);
        const ch = Math.round(rawW * sin + rawH * cos);
        dispatch({ type: 'SET_CANVAS', canvas: { width: cw, height: ch } });
        dispatch({ type: 'RESIZE_IMAGE', id: image.id, width: rawW, height: rawH, x: (cw - rawW) / 2, y: (ch - rawH) / 2 });
        dispatch({ type: 'SEND_TO_BACK', id: image.id });
        onClose();
      },
    });
    items.push({
      label: 'Make Page (Display)',
      action: () => {
        const image = images.find((img) => img.id === menu.imageId);
        if (!image) { onClose(); return; }
        const rad = (image.rotation * Math.PI) / 180;
        const cos = Math.abs(Math.cos(rad));
        const sin = Math.abs(Math.sin(rad));
        const cw = Math.round(image.width * cos + image.height * sin);
        const ch = Math.round(image.width * sin + image.height * cos);
        dispatch({ type: 'SET_CANVAS', canvas: { width: cw, height: ch } });
        dispatch({ type: 'MOVE_IMAGES', ids: [image.id], dx: (cw - image.width) / 2 - image.x, dy: (ch - image.height) / 2 - image.y });
        dispatch({ type: 'SEND_TO_BACK', id: image.id });
        onClose();
      },
    });
  }

  // Scale options for multi-selection
  if (multiSelected) {
    items.push({
      label: 'Scale Reset Up',
      action: () => {
        dispatch({ type: 'SCALE_SELECTION_TO_LARGEST', ids: selectionIds });
        onClose();
      },
    });
    items.push({
      label: 'Scale Reset Down',
      action: () => {
        dispatch({ type: 'SCALE_SELECTION_TO_SMALLEST', ids: selectionIds });
        onClose();
      },
    });
    items.push({
      label: 'Normalize',
      action: () => {
        // Use the average height of selected images as the target
        const selected = images.filter((img) => selectedIds.has(img.id));
        const avgH = Math.round(selected.reduce((sum, img) => sum + img.height, 0) / selected.length);
        dispatch({ type: 'NORMALIZE_SELECTION', ids: selectionIds, targetHeight: avgH });
        onClose();
      },
    });
  }

  // Arrange in grid (multi-select)
  if (multiSelected) {
    items.push({ label: '', separator: true, action: () => {} });
    items.push({
      label: 'Arrange in Grid',
      action: () => {
        dispatch({ type: 'ARRANGE_GRID', ids: selectionIds });
        onClose();
      },
    });
    items.push({
      label: 'Arrange as Strip',
      action: () => {
        dispatch({ type: 'ARRANGE_STRIP', ids: selectionIds });
        onClose();
      },
    });
    items.push({
      label: 'Arrange as List',
      action: () => {
        dispatch({ type: 'ARRANGE_LIST', ids: selectionIds });
        onClose();
      },
    });
  }

  // Detach from parent (if element has a parent)
  const targetImg = images.find((img) => img.id === menu.imageId);
  if (targetImg?.parentId) {
    items.push({ label: '', separator: true, action: () => {} });
    items.push({
      label: 'Detach from Parent',
      action: () => {
        dispatch({ type: 'DETACH_FROM_PARENT', childId: menu.imageId });
        onClose();
      },
    });
  }

  // Save as images
  if (onSaveImages) {
    items.push({ label: '', separator: true, action: () => {} });
    const saveIds = multiSelected ? selectionIds : [menu.imageId];
    const label = multiSelected ? `Save ${selectedIds.size} Images` : 'Save Image';
    items.push({
      label: `${label} (1:1)`,
      action: () => { onSaveImages(saveIds, '1:1'); onClose(); },
    });
    items.push({
      label: `${label} (Display)`,
      action: () => { onSaveImages(saveIds, 'display'); onClose(); },
    });
  }

  // Delete
  items.push({ label: '', separator: true, action: () => {} });
  items.push({
    label: multiSelected ? `Delete (${selectedIds.size})` : 'Delete',
    danger: true,
    action: () => {
      dispatch({ type: 'REMOVE_IMAGES', ids: multiSelected ? selectionIds : [menu.imageId] });
      onClose();
    },
  });

  const [pos, setPos] = useState({ x: menu.x, y: menu.y });

  // After render, measure the menu and clamp to viewport
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    let x = menu.x;
    let y = menu.y;
    if (x + rect.width > window.innerWidth - pad) x = window.innerWidth - rect.width - pad;
    if (y + rect.height > window.innerHeight - pad) y = window.innerHeight - rect.height - pad;
    if (x < pad) x = pad;
    if (y < pad) y = pad;
    setPos({ x, y });
  }, [menu.x, menu.y, items.length]);

  return (
    <div
      ref={ref}
      className="context-menu"
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {items.map((item, i) =>
        item.separator ? (
          <div key={i} className="context-menu-separator" />
        ) : (
          <button
            key={i}
            className={`context-menu-item${item.danger ? ' context-menu-item-danger' : ''}`}
            onClick={item.action}
          >
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}
