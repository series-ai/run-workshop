import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { ImageNode, WorkspaceAction } from './types';

interface BatchRenameProps {
  images: ImageNode[];
  selectedIds: Set<string>;
  dispatch: React.Dispatch<WorkspaceAction>;
  onClose: () => void;
  initialPrefix?: string;
}

/** Sort selected images in reading order: top-to-bottom rows, left-to-right within rows. */
function sortReadingOrder(images: ImageNode[]): ImageNode[] {
  if (images.length === 0) return [];

  const heights = images.map((img) => img.height).sort((a, b) => a - b);
  const medianH = heights[Math.floor(heights.length / 2)]!;
  const rowThreshold = medianH * 0.5;

  const byY = [...images].sort((a, b) => a.y - b.y);

  const rows: ImageNode[][] = [];
  let currentRow: ImageNode[] = [byY[0]!];
  let rowTop = byY[0]!.y;

  for (let i = 1; i < byY.length; i++) {
    const img = byY[i]!;
    if (img.y - rowTop <= rowThreshold) {
      currentRow.push(img);
    } else {
      rows.push(currentRow);
      currentRow = [img];
      rowTop = img.y;
    }
  }
  rows.push(currentRow);

  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
  }

  return rows.flat();
}

export function BatchRename({ images, selectedIds, dispatch, onClose, initialPrefix }: BatchRenameProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const prefixInputRef = useRef<HTMLInputElement>(null);

  const [prefix, setPrefix] = useState(initialPrefix ?? '');
  const [startNumber, setStartNumber] = useState(1);

  // Ordered list — initialized from reading order, user can reorder via drag
  const [order, setOrder] = useState<ImageNode[]>(() => {
    const selected = images.filter((img) => selectedIds.has(img.id));
    return sortReadingOrder(selected);
  });

  // Drag state: which item is being dragged, and where the insertion line is
  const dragIndexRef = useRef<number | null>(null);
  const insertAtRef = useRef<number | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  // insertAt is the gap index: 0 = before first, 1 = between 0 and 1, etc.
  const [insertAt, setInsertAt] = useState<number | null>(null);

  useEffect(() => {
    prefixInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onClose();
    },
    [onClose],
  );

  // Compute preview names from current order
  const previewItems = useMemo(() => {
    const maxNum = startNumber + order.length - 1;
    const digits = Math.max(2, String(maxNum).length);

    return order.map((img, i) => {
      const num = String(startNumber + i).padStart(digits, '0');
      const newName = prefix ? `${prefix}${num}` : num;
      return { id: img.id, src: img.src, fileName: img.fileName, newName, index: i };
    });
  }, [order, prefix, startNumber]);

  const handleApply = useCallback(() => {
    dispatch({ type: 'SNAPSHOT' });
    for (const item of previewItems) {
      dispatch({ type: 'RENAME_IMAGE', id: item.id, spriteName: item.newName });
    }
    onClose();
  }, [dispatch, previewItems, onClose]);

  // --- Drag to reorder ---
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    dragIndexRef.current = index;
    setDragFrom(index);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleItemDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dragIndexRef.current === null) return;

    // Determine if cursor is on left or right half of this item
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const gap = e.clientX < midX ? index : index + 1;

    // Don't show insertion at the dragged item's current position or right after it
    let newInsert: number | null;
    if (gap === dragIndexRef.current || gap === dragIndexRef.current + 1) {
      newInsert = null;
    } else {
      newInsert = gap;
    }
    insertAtRef.current = newInsert;
    setInsertAt(newInsert);
  }, []);

  const handleGridDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleGridDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const from = dragIndexRef.current;
    const to = insertAtRef.current;

    if (from === null || to === null) {
      setDragFrom(null);
      setInsertAt(null);
      insertAtRef.current = null;
      dragIndexRef.current = null;
      return;
    }

    setOrder((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      // Adjust target index since we removed an item
      const adjustedTo = to > from ? to - 1 : to;
      next.splice(adjustedTo, 0, item!);
      return next;
    });

    setDragFrom(null);
    setInsertAt(null);
    insertAtRef.current = null;
    dragIndexRef.current = null;
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragFrom(null);
    setInsertAt(null);
    insertAtRef.current = null;
    dragIndexRef.current = null;
  }, []);

  return createPortal(
    <div
      className="batch-rename-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      <div className="batch-rename-panel" onPointerDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="batch-rename-header">
          <h2>Batch Rename</h2>
          <span className="batch-rename-count">{order.length} image{order.length !== 1 ? 's' : ''} &middot; drag to reorder</span>
          <button className="batch-rename-close" onClick={onClose} title="Close (Esc)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="batch-rename-form">
          <div className="batch-rename-field">
            <label>Prefix</label>
            <input
              ref={prefixInputRef}
              type="text"
              className="batch-rename-input"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') handleApply();
              }}
              placeholder="walk_"
            />
          </div>
          <div className="batch-rename-field">
            <label>Start #</label>
            <input
              type="number"
              className="batch-rename-input batch-rename-input-num"
              value={startNumber}
              min={0}
              onChange={(e) => setStartNumber(Math.max(0, parseInt(e.target.value, 10) || 0))}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') handleApply();
              }}
            />
          </div>
          <button className="batch-rename-apply-btn" onClick={handleApply}>
            Apply
          </button>
        </div>

        {/* Preview grid — drag to reorder */}
        <div
          className="batch-rename-preview"
          onDragOver={handleGridDragOver}
          onDrop={handleGridDrop}
        >
          {previewItems.map((item, i) => (
            <div
              key={item.id}
              className={
                `batch-rename-item`
                + (dragFrom === i ? ' batch-rename-item-dragging' : '')
                + (insertAt === i ? ' batch-rename-item-insert-before' : '')
                + (insertAt === i + 1 && i === previewItems.length - 1 ? ' batch-rename-item-insert-after' : '')
              }
              draggable
              onDragStart={(e) => handleDragStart(e, i)}
              onDragOver={(e) => handleItemDragOver(e, i)}
              onDragEnd={handleDragEnd}
            >
              <div className="batch-rename-thumb">
                <img src={item.src} alt={item.fileName} draggable={false} />
                <div className="batch-rename-badge">{item.index + 1}</div>
              </div>
              <div className="batch-rename-name" title={item.newName}>{item.newName}</div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
