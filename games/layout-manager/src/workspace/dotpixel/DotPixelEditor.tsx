import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ImageNode } from '../types';
import { drawNodeToCtx } from '../renderNode';
import { buildSampleGrid, sampleDotPixel, posterizeSource, activeAnchors } from './sampling';
import type { DotAnchor, DotFrame, DotLine } from './sampling';
import { editDotDocument, transformDotFrame } from './document';
import type { DotDocument } from './document';
import { adjustFrame } from './frameGeometry';
import type { FrameHandle } from './frameGeometry';
import './dotpixel.css';

type Cell = { col: number; row: number };
type Gesture =
  | { type: 'pin'; anchor: DotAnchor }
  | {
      type: 'band';
      axis: 'row' | 'column';
      index: number;
      delta: number;
      start: { x: number; y: number };
    }
  | { type: 'resolution'; size: number }
  | { type: 'line'; line: DotLine }
  | { type: 'settings'; settings: Partial<Pick<DotDocument, 'levels' | 'radius' | 'strength'>> }
  | {
      type: 'adjust-frame';
      start: { x: number; y: number };
      original: DotFrame;
      frame: DotFrame;
      handle: FrameHandle;
    }
  | { type: 'frame'; start: { x: number; y: number }; frame: DotFrame };

const FRAME_HANDLES: { handle: FrameHandle; u: number; v: number }[] = [
  { handle: 'nw', u: 0, v: 0 },
  { handle: 'n', u: 0.5, v: 0 },
  { handle: 'ne', u: 1, v: 0 },
  { handle: 'w', u: 0, v: 0.5 },
  { handle: 'e', u: 1, v: 0.5 },
  { handle: 'sw', u: 0, v: 1 },
  { handle: 's', u: 0.5, v: 1 },
  { handle: 'se', u: 1, v: 1 },
];

interface DotPixelEditorProps {
  image: ImageNode;
  onClose: () => void;
  onAdd: (url: string, width: number, height: number) => void;
}

export function DotPixelEditor({ image, onClose, onAdd }: DotPixelEditorProps) {
  const width = Math.max(1, Math.round(image.cropRect?.w ?? image.naturalWidth));
  const height = Math.max(1, Math.round(image.cropRect?.h ?? image.naturalHeight));
  const [history, edit] = useReducer(editDotDocument, {
    present: { frame: { x: 0, y: 0, w: width, h: height }, anchors: [] },
    past: [],
    future: [],
  });
  const [source, setSource] = useState<{ data: ImageData; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'pin' | 'row' | 'column' | 'frame' | 'new-frame' | 'line'>(
    'pin',
  );
  const [square, setSquare] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState(1);
  const [selected, setSelected] = useState<Cell | null>(null);
  const [target, setTarget] = useState<Cell | null>(null);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const [status, setStatus] = useState('');
  const rootRef = useRef<HTMLDialogElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const scale = fit * zoom;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = rootRef.current;
    dialog?.showModal();
    rootRef.current?.focus();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    // Ignore workspace display transforms/opacity, including onion skin.
    // Native image/layer alpha still passes through the compositor unchanged.
    // The shared compositor preserves paint, masks, flips and colour adjustments.
    drawNodeToCtx(
      canvas.getContext('2d')!,
      { ...image, x: 0, y: 0, width, height, rotation: 0, opacity: 1 },
      'nearest',
    )
      .then(() => {
        if (!cancelled)
          setSource({
            data: canvas.getContext('2d')!.getImageData(0, 0, width, height),
            url: canvas.toDataURL(),
          });
      })
      .catch(() => {
        if (!cancelled)
          setError(
            'Could not read this image. Try importing a local PNG, then open DotPixel again.',
          );
      });
    return () => {
      cancelled = true;
    };
  }, [image, width, height]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(() => {
      setFit(
        Math.max(
          0.01,
          Math.min((viewport.clientWidth - 48) / width, (viewport.clientHeight - 48) / height),
        ),
      );
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [width, height]);

  const draft = useMemo(() => {
    if (gesture?.type === 'band') return editDotDocument(history, gesture).present;
    if (gesture?.type === 'resolution') return editDotDocument(history, gesture).present;
    if (gesture?.type === 'frame')
      return { ...history.present, frame: gesture.frame, anchors: [], lines: [] };
    if (gesture?.type === 'adjust-frame') return transformDotFrame(history.present, gesture.frame);
    if (gesture?.type === 'line')
      return { ...history.present, lines: [...(history.present.lines ?? []), gesture.line] };
    if (gesture?.type === 'settings') return { ...history.present, ...gesture.settings };
    if (gesture?.type === 'pin') return editDotDocument(history, gesture).present;
    return history.present;
  }, [history.present, gesture]);
  const {
    frame,
    anchors: allAnchors,
    size: SIZE = 32,
    outputHeight: ROWS = SIZE,
    lines = [],
    levels = 0,
    radius = 2,
    strength = 0.8,
  } = draft;
  const [customWidth, setCustomWidth] = useState(String(SIZE));
  const [customHeight, setCustomHeight] = useState(String(ROWS));
  useEffect(() => {
    setCustomWidth(String(SIZE));
    setCustomHeight(String(ROWS));
  }, [SIZE, ROWS]);
  const anchors = useMemo(() => activeAnchors(allAnchors), [allAnchors]);
  const pinnedCells = useMemo(
    () => new Set(anchors.map((a) => a.row * SIZE + a.col)),
    [anchors, SIZE],
  );
  const attraction = useMemo(() => ({ lines, radius, strength }), [draft.lines, radius, strength]);
  const sampledSource = useMemo(() => {
    if (!source) return null;
    const data = posterizeSource(source.data, levels);
    if (data === source.data) return { data, url: source.url };
    const canvas = document.createElement('canvas');
    canvas.width = data.width;
    canvas.height = data.height;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(data.width, data.height);
    imageData.data.set(data.data);
    ctx.putImageData(imageData, 0, 0);
    return { data, url: canvas.toDataURL() };
  }, [source, levels]);
  const grid = useMemo(
    () => buildSampleGrid(frame, SIZE, allAnchors, attraction, ROWS),
    [frame, SIZE, ROWS, allAnchors, attraction],
  );
  const pixels = useMemo(
    () =>
      sampledSource
        ? sampleDotPixel(sampledSource.data, frame, SIZE, allAnchors, attraction, ROWS)
        : null,
    [sampledSource, frame, SIZE, ROWS, allAnchors, attraction],
  );
  useEffect(() => {
    if (!pixels || !previewRef.current) return;
    const ctx = previewRef.current.getContext('2d')!;
    const data = ctx.createImageData(SIZE, ROWS);
    data.data.set(pixels);
    ctx.putImageData(data, 0, 0);
  }, [pixels, SIZE, ROWS]);

  const changeGesture = (next: Gesture | null) => {
    if (next?.type === 'resolution') {
      setTarget(null);
      setSelected(null);
    }
    gestureRef.current = next;
    setGesture(next);
  };
  const commitSettings = () => {
    if (gestureRef.current?.type !== 'settings') return;
    edit({ type: 'settings', settings: gestureRef.current.settings });
    changeGesture(null);
    setStatus('');
  };
  const changeResolution = (size: number, height = size) => {
    changeGesture(null);
    setTarget(null);
    setSelected(null);
    setStatus('');
    edit({ type: 'resolution', size, height });
  };
  const commitResolution = () => {
    if (gestureRef.current?.type === 'resolution') changeResolution(gestureRef.current.size);
  };
  const close = () => {
    if (
      history.past.length &&
      !window.confirm(
        'Close DotPixel? Your added images are kept, but this editing session’s frame, anchors, lines and colour settings will be discarded.',
      )
    )
      return;
    onClose();
  };
  const historyAction = (type: 'undo' | 'redo') => {
    changeGesture(null);
    setTarget(null);
    setSelected(null);
    setStatus('');
    edit({ type });
  };
  const pointAt = (e: React.PointerEvent<SVGSVGElement>) => {
    const bounds = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(width - 0.0001, ((e.clientX - bounds.left) * width) / bounds.width)),
      y: Math.max(
        0,
        Math.min(height - 0.0001, ((e.clientY - bounds.top) * height) / bounds.height),
      ),
    };
  };
  const inFrame = (p: { x: number; y: number }) => ({
    x: Math.max(frame.x, Math.min(frame.x + frame.w - 0.0001, p.x)),
    y: Math.max(frame.y, Math.min(frame.y + frame.h - 0.0001, p.y)),
  });
  const bandCellAt = (p: { x: number; y: number }, element: EventTarget) => {
    const sampleId = (element as Element).getAttribute('data-sample');
    let index = sampleId === null ? -1 : Number(sampleId);
    if (index < 0) {
      let nearest = Infinity;
      grid.forEach((sample, i) => {
        const distance = (sample.x - p.x) ** 2 + (sample.y - p.y) ** 2;
        if (distance < nearest) {
          nearest = distance;
          index = i;
        }
      });
    }
    return { col: index % SIZE, row: Math.floor(index / SIZE) };
  };
  const selectedAnchor = anchors.find((a) => a.col === selected?.col && a.row === selected?.row);
  const removeSelected = () => {
    if (!selectedAnchor) return;
    // Cancel the draft first so pointer-up cannot commit the deleted pin again.
    changeGesture(null);
    edit({ type: 'remove', col: selectedAnchor.col, row: selectedAnchor.row });
    setSelected(null);
    setTarget(null);
    setStatus('');
  };

  return createPortal(
    <dialog
      className="dotpixel-editor"
      aria-label="DotPixel"
      tabIndex={-1}
      ref={rootRef}
      onCancel={(e) => {
        e.preventDefault();
        // A disabled toolbar button can leave focus on body, so Escape may
        // arrive as the dialog's native cancel event rather than keydown.
        if (gestureRef.current || target) {
          changeGesture(null);
          setTarget(null);
        } else close();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onPaste={(e) => e.stopPropagation()}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragOver={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Tab') {
          const controls = Array.from(
            rootRef.current!.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input, [tabindex="0"]',
            ),
          );
          const first = controls[0],
            last = controls[controls.length - 1];
          if (
            e.shiftKey &&
            (window.document.activeElement === first ||
              window.document.activeElement === rootRef.current)
          ) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && window.document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          if (gestureRef.current || target) {
            changeGesture(null);
            setTarget(null);
          } else close();
          return;
        }
        if ((e.target as HTMLElement).tagName === 'INPUT') return;
        if ((e.ctrlKey || e.metaKey) && ['z', 'y'].includes(e.key.toLowerCase())) {
          e.preventDefault();
          historyAction(e.shiftKey || e.key.toLowerCase() === 'y' ? 'redo' : 'undo');
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          removeSelected();
        }
      }}
    >
      <header className="dotpixel-header">
        <div>
          <strong>DotPixel</strong>
          <span className="dotpixel-muted">
            {image.fileName} · {width} × {height} → {SIZE} × {ROWS}
          </span>
        </div>
        <div className="dotpixel-actions">
          <button
            disabled={!pixels}
            onClick={() => {
              if (!previewRef.current) return;
              onAdd(previewRef.current.toDataURL('image/png'), SIZE, ROWS);
              setStatus('Added to workspace.');
            }}
          >
            Add to workspace
          </button>
          <button aria-label="Close" onClick={close}>
            Close
          </button>
        </div>
      </header>
      <div className="dotpixel-tools">
        <button
          aria-pressed={mode === 'pin'}
          onClick={() => {
            setMode('pin');
            setTarget(null);
          }}
        >
          Anchors
        </button>
        <button
          aria-pressed={mode === 'row'}
          onClick={() => {
            setMode('row');
            setTarget(null);
            setSelected(null);
          }}
        >
          Rows
        </button>
        <button
          aria-pressed={mode === 'column'}
          onClick={() => {
            setMode('column');
            setTarget(null);
            setSelected(null);
          }}
        >
          Columns
        </button>
        <button
          aria-pressed={mode === 'frame'}
          onClick={() => {
            setMode('frame');
            setTarget(null);
          }}
        >
          Frame
        </button>
        <button
          aria-pressed={mode === 'new-frame'}
          onClick={() => {
            setMode('new-frame');
            setTarget(null);
          }}
        >
          New frame
        </button>
        <button
          aria-pressed={mode === 'line'}
          onClick={() => {
            setMode('line');
            setTarget(null);
          }}
        >
          Attract lines
        </button>
        <label>
          <input type="checkbox" checked={square} onChange={(e) => setSquare(e.target.checked)} />{' '}
          Square frame
        </label>
        <button
          disabled={!source}
          onClick={() => {
            edit({ type: 'adjust-frame', frame: { x: 0, y: 0, w: width, h: height } });
            setTarget(null);
            setStatus('');
          }}
        >
          Full image
        </button>
        <span className="dotpixel-divider" />
        <button disabled={!history.past.length || !!gesture} onClick={() => historyAction('undo')}>
          Undo
        </button>
        <button
          disabled={!history.future.length || !!gesture}
          onClick={() => historyAction('redo')}
        >
          Redo
        </button>
        <label>
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => setShowGrid(e.target.checked)}
          />{' '}
          Sampling grid
        </label>
        <label title="When enabled, dragging a point, row or column also adjusts nearby automatic samples. Off moves only the selected points.">
          <input
            type="checkbox"
            checked={draft.softSelection ?? false}
            onChange={(e) =>
              edit({ type: 'settings', settings: { softSelection: e.target.checked } })
            }
          />
          Soft selection
        </label>
        <span className="dotpixel-divider" />
        <button aria-label="Zoom out" onClick={() => setZoom((v) => Math.max(0.25, v / 1.5))}>
          −
        </button>
        <button
          onClick={() => {
            setZoom(1);
            viewportRef.current?.scrollTo(0, 0);
          }}
        >
          Fit
        </button>
        <button aria-label="Zoom in" onClick={() => setZoom((v) => Math.min(8, v * 1.5))}>
          +
        </button>
        <span className="dotpixel-muted">{Math.round(scale * 100)}%</span>
      </div>
      <div className="dotpixel-body">
        <div className="dotpixel-source-pane">
          <p className="dotpixel-hint">
            {mode === 'frame'
              ? 'Drag inside to move; drag an edge or corner to resize. Anchors and lines move with the frame.'
              : mode === 'row' || mode === 'column'
                ? `Drag any square to move its whole ${mode} ${mode === 'row' ? 'up/down' : 'left/right'}. ${draft.softSelection ? 'Soft selection affects nearby automatic points.' : 'Soft selection is off; other points stay put.'}`
                : mode === 'new-frame'
                  ? 'Drag a new frame. This clears anchors and lines; Undo restores them.'
                  : mode === 'line'
                    ? 'Drag to trace an outline. Nearby automatic squares are attracted to it; pinned squares stay fixed.'
                    : target
                      ? `Click the source detail for output column ${target.col + 1}, row ${target.row + 1}. Escape cancels.`
                      : 'Click to pin a detail. Drag an anchor to change its sample. Scroll to pan when zoomed.'}
          </p>
          <div className="dotpixel-viewport" ref={viewportRef}>
            {error ? (
              <p role="alert">{error}</p>
            ) : !source ? (
              <p>Loading source…</p>
            ) : (
              <div
                className="dotpixel-source-wrap"
                style={{
                  width: Math.max(width * scale + 48, 1),
                  minWidth: '100%',
                  height: Math.max(height * scale + 48, 1),
                  minHeight: '100%',
                }}
              >
                <svg
                  className="dotpixel-source dotpixel-checker"
                  aria-label="Source image with anchor grid"
                  width={width * scale}
                  height={height * scale}
                  viewBox={`0 0 ${width} ${height}`}
                  style={{
                    cursor:
                      mode === 'row' ? 'ns-resize' : mode === 'column' ? 'ew-resize' : 'crosshair',
                  }}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    e.preventDefault();
                    rootRef.current?.focus({ preventScroll: true });
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setStatus('');
                    const p = pointAt(e);
                    if (mode === 'frame') {
                      const handle = (e.target as Element).getAttribute(
                        'data-frame-handle',
                      ) as FrameHandle | null;
                      if (
                        handle ||
                        (p.x >= frame.x &&
                          p.y >= frame.y &&
                          p.x <= frame.x + frame.w &&
                          p.y <= frame.y + frame.h)
                      ) {
                        changeGesture({
                          type: 'adjust-frame',
                          start: p,
                          original: frame,
                          frame,
                          handle: handle ?? 'move',
                        });
                      }
                      return;
                    }
                    if (mode === 'new-frame') {
                      changeGesture({
                        type: 'frame',
                        start: p,
                        frame: { x: p.x, y: p.y, w: 1, h: 1 },
                      });
                      return;
                    }
                    if (
                      p.x < frame.x ||
                      p.y < frame.y ||
                      p.x >= frame.x + frame.w ||
                      p.y >= frame.y + frame.h
                    )
                      return;
                    if (mode === 'line') {
                      changeGesture({ type: 'line', line: [inFrame(p)] });
                      return;
                    }
                    if (mode === 'row' || mode === 'column') {
                      const cell = bandCellAt(p, e.target);
                      setSelected(cell);
                      setTarget(null);
                      changeGesture({
                        type: 'band',
                        axis: mode,
                        index: mode === 'row' ? cell.row : cell.col,
                        delta: 0,
                        start: p,
                      });
                      return;
                    }
                    const sampleId = (e.target as Element).getAttribute('data-sample');
                    const clickedSample = sampleId === null ? null : Number(sampleId);
                    const hit = target
                      ? undefined
                      : [...anchors]
                          .reverse()
                          .find((a) =>
                            clickedSample !== null
                              ? a.row * SIZE + a.col === clickedSample
                              : Math.hypot(a.x - p.x, a.y - p.y) * scale <= 9,
                          );
                    const cell =
                      target ??
                      hit ??
                      (clickedSample !== null
                        ? { col: clickedSample % SIZE, row: Math.floor(clickedSample / SIZE) }
                        : {
                            col: Math.min(SIZE - 1, Math.floor(((p.x - frame.x) / frame.w) * SIZE)),
                            row: Math.min(ROWS - 1, Math.floor(((p.y - frame.y) / frame.h) * ROWS)),
                          });
                    const anchor = hit ?? {
                      col: cell.col,
                      row: cell.row,
                      ...(!target && clickedSample !== null ? grid[clickedSample]! : inFrame(p)),
                    };
                    setSelected({ col: anchor.col, row: anchor.row });
                    setTarget(null);
                    changeGesture({ type: 'pin', anchor });
                  }}
                  onPointerMove={(e) => {
                    const current = gestureRef.current;
                    const p = pointAt(e);
                    if (!current) {
                      if (mode === 'row' || mode === 'column') {
                        const cell = bandCellAt(p, e.target);
                        setSelected((previous) =>
                          previous?.col === cell.col && previous?.row === cell.row
                            ? previous
                            : cell,
                        );
                      }
                      return;
                    }
                    if (current.type === 'band') {
                      changeGesture({
                        ...current,
                        delta:
                          current.axis === 'row' ? p.y - current.start.y : p.x - current.start.x,
                      });
                      return;
                    }
                    if (current.type === 'pin') {
                      changeGesture({ type: 'pin', anchor: { ...current.anchor, ...inFrame(p) } });
                      return;
                    }
                    if (current.type === 'adjust-frame') {
                      changeGesture({
                        ...current,
                        frame: adjustFrame(
                          current.original,
                          current.handle,
                          p.x - current.start.x,
                          p.y - current.start.y,
                          width,
                          height,
                          square,
                        ),
                      });
                      return;
                    }
                    if (current.type === 'line') {
                      const next = inFrame(p),
                        last = current.line[current.line.length - 1]!;
                      if (Math.hypot(next.x - last.x, next.y - last.y) * scale >= 3)
                        changeGesture({ type: 'line', line: [...current.line, next] });
                      return;
                    }
                    if (current.type !== 'frame') return;
                    let dx = p.x - current.start.x,
                      dy = p.y - current.start.y;
                    if (square) {
                      const side = Math.min(Math.abs(dx), Math.abs(dy));
                      dx = (dx < 0 ? -1 : 1) * side;
                      dy = (dy < 0 ? -1 : 1) * side;
                    }
                    const x = Math.floor(Math.min(current.start.x, current.start.x + dx));
                    const y = Math.floor(Math.min(current.start.y, current.start.y + dy));
                    changeGesture({
                      ...current,
                      frame: {
                        x,
                        y,
                        w: Math.max(1, Math.min(width - x, Math.round(Math.abs(dx)))),
                        h: Math.max(1, Math.min(height - y, Math.round(Math.abs(dy)))),
                      },
                    });
                  }}
                  onPointerUp={(e) => {
                    const current = gestureRef.current;
                    if (current?.type === 'pin') edit({ type: 'pin', anchor: current.anchor });
                    else if (current?.type === 'band') edit(current);
                    else if (current?.type === 'line') {
                      const end = inFrame(pointAt(e)),
                        last = current.line[current.line.length - 1]!;
                      const line =
                        Math.hypot(end.x - last.x, end.y - last.y) > 0.001
                          ? [...current.line, end]
                          : current.line;
                      if (line.length >= 2) edit({ type: 'line', line });
                    } else if (current?.type === 'adjust-frame')
                      edit({ type: 'adjust-frame', frame: current.frame });
                    else if (
                      current?.type === 'frame' &&
                      current.frame.w > 1 &&
                      current.frame.h > 1
                    ) {
                      edit({ type: 'frame', frame: current.frame });
                      setSelected(null);
                      setMode('pin');
                    }
                    changeGesture(null);
                    if (e.currentTarget.hasPointerCapture(e.pointerId))
                      e.currentTarget.releasePointerCapture(e.pointerId);
                  }}
                  onPointerCancel={() => changeGesture(null)}
                  onLostPointerCapture={() => changeGesture(null)}
                >
                  <image href={sampledSource?.url ?? source.url} width={width} height={height} />
                  <path
                    d={`M0 0H${width}V${height}H0Z M${frame.x} ${frame.y}V${frame.y + frame.h}H${frame.x + frame.w}V${frame.y}Z`}
                    fill="black"
                    opacity="0.6"
                    fillRule="evenodd"
                    pointerEvents="none"
                  />
                  {showGrid && (
                    <g stroke="#8cdbed" strokeOpacity="0.4" fill="none" pointerEvents="none">
                      {Array.from({ length: ROWS }, (_, i) => (
                        <polyline
                          key={`row-${i}`}
                          vectorEffect="non-scaling-stroke"
                          points={grid
                            .slice(i * SIZE, (i + 1) * SIZE)
                            .map((p) => `${p.x},${p.y}`)
                            .join(' ')}
                        />
                      ))}
                      {Array.from({ length: SIZE }, (_, i) => (
                        <polyline
                          key={`col-${i}`}
                          vectorEffect="non-scaling-stroke"
                          points={Array.from({ length: ROWS }, (_, row) => grid[row * SIZE + i]!)
                            .map((p) => `${p.x},${p.y}`)
                            .join(' ')}
                        />
                      ))}
                    </g>
                  )}
                  {pixels &&
                    grid
                      .map((point, index) => ({
                        point,
                        index,
                        pinned: pinnedCells.has(index),
                      }))
                      .sort((a, b) => Number(a.pinned) - Number(b.pinned))
                      .map(({ point, index, pinned }) => {
                        if (!showGrid && !pinned) return null;
                        const side = Math.min(frame.w / SIZE, frame.h / ROWS) * 0.65;
                        const col = index % SIZE,
                          row = Math.floor(index / SIZE),
                          color = index * 4;
                        return (
                          <rect
                            key={index}
                            data-sample={index}
                            data-anchor={pinned ? `${col}:${row}` : undefined}
                            x={point.x - side / 2}
                            y={point.y - side / 2}
                            width={side}
                            height={side}
                            fill={`rgba(${pixels[color]},${pixels[color + 1]},${pixels[color + 2]},${pixels[color + 3]! / 255})`}
                            stroke={
                              (
                                mode === 'row'
                                  ? row === selected?.row
                                  : mode === 'column'
                                    ? col === selected?.col
                                    : col === selected?.col && row === selected?.row
                              )
                                ? '#ffe176'
                                : pinned
                                  ? '#62e6dd'
                                  : '#17212a'
                            }
                            strokeWidth={pinned ? 2 : 0.7}
                            vectorEffect="non-scaling-stroke"
                          >
                            <title>
                              {pinned ? 'Pinned' : 'Automatic'} · Column {col + 1}, row {row + 1}
                            </title>
                          </rect>
                        );
                      })}
                  {lines.map((line, index) => (
                    <polyline
                      key={index}
                      data-attraction-line={index}
                      points={line.map((p) => `${p.x},${p.y}`).join(' ')}
                      fill="none"
                      stroke="#ff82da"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                      pointerEvents="none"
                    />
                  ))}
                  <rect
                    data-frame-border="true"
                    x={frame.x}
                    y={frame.y}
                    width={frame.w}
                    height={frame.h}
                    fill="none"
                    stroke="#fff"
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />
                  {mode === 'frame' && (
                    <>
                      <rect
                        data-frame-handle="move"
                        x={frame.x}
                        y={frame.y}
                        width={frame.w}
                        height={frame.h}
                        fill="transparent"
                        style={{ cursor: 'move' }}
                      />
                      {FRAME_HANDLES.map(({ handle, u, v }) => (
                        <rect
                          key={handle}
                          data-frame-handle={handle}
                          x={frame.x + u * frame.w - 5 / scale}
                          y={frame.y + v * frame.h - 5 / scale}
                          width={10 / scale}
                          height={10 / scale}
                          fill="white"
                          stroke="#17212a"
                          vectorEffect="non-scaling-stroke"
                          style={{ cursor: `${handle}-resize` }}
                        >
                          <title>Resize {handle}</title>
                        </rect>
                      ))}
                    </>
                  )}
                  {target && (
                    <rect
                      x={grid[target.row * SIZE + target.col]!.x - 8 / scale}
                      y={grid[target.row * SIZE + target.col]!.y - 8 / scale}
                      width={16 / scale}
                      height={16 / scale}
                      fill="none"
                      stroke="#ffe176"
                      vectorEffect="non-scaling-stroke"
                      pointerEvents="none"
                    />
                  )}
                </svg>
              </div>
            )}
          </div>
        </div>
        <aside className="dotpixel-preview-pane">
          <div className="dotpixel-resolution">
            <label className="dotpixel-range">
              Output resolution{' '}
              <output>
                {SIZE} × {ROWS}
              </output>
              <input
                aria-label="Output resolution"
                type="range"
                min={1}
                max={128}
                step={1}
                value={SIZE}
                onChange={(e) =>
                  changeGesture({ type: 'resolution', size: Number(e.target.value) })
                }
                onPointerUp={commitResolution}
                onKeyUp={commitResolution}
                onBlur={commitResolution}
                onPointerCancel={() => changeGesture(null)}
              />
            </label>
            <div className="dotpixel-actions">
              {[2, 4, 8, 16, 32, 64, 128].map((size) => (
                <button
                  key={size}
                  aria-pressed={SIZE === size && ROWS === size}
                  onClick={() => changeResolution(size)}
                >
                  {size} × {size}
                </button>
              ))}
            </div>
            <p className="dotpixel-muted">
              Start small and pin the important details. Raise the resolution to add samples guided
              by those coarse anchors.
            </p>
            <form
              className="dotpixel-custom-size"
              onSubmit={(e) => {
                e.preventDefault();
                changeResolution(Number(customWidth), Number(customHeight));
              }}
            >
              <label>
                Width
                <input
                  aria-label="Custom width"
                  type="number"
                  min={1}
                  max={128}
                  step={1}
                  required
                  value={customWidth}
                  onChange={(e) => setCustomWidth(e.target.value)}
                />
              </label>
              <label>
                Height
                <input
                  aria-label="Custom height"
                  type="number"
                  min={1}
                  max={128}
                  step={1}
                  required
                  value={customHeight}
                  onChange={(e) => setCustomHeight(e.target.value)}
                />
              </label>
              <button type="submit">Apply size</button>
              <span className="dotpixel-muted">
                1–128 pixels per side. Presets and slider set square sizes.
              </span>
            </form>
          </div>
          <h3>
            Live preview{' '}
            <span className="dotpixel-muted">
              {SIZE} × {ROWS}
            </span>
          </h3>
          <div
            className="dotpixel-preview dotpixel-checker"
            style={{
              aspectRatio: `${SIZE} / ${ROWS}`,
              width: `min(100%, ${(320 * SIZE) / ROWS}px)`,
            }}
            onClick={(e) => {
              if (!source) return;
              const bounds = e.currentTarget.getBoundingClientRect();
              const cell = {
                col: Math.min(
                  SIZE - 1,
                  Math.max(0, Math.floor(((e.clientX - bounds.left) / bounds.width) * SIZE)),
                ),
                row: Math.min(
                  ROWS - 1,
                  Math.max(0, Math.floor(((e.clientY - bounds.top) / bounds.height) * ROWS)),
                ),
              };
              setSelected(cell);
              setTarget(cell);
              setMode('pin');
            }}
          >
            <canvas
              ref={previewRef}
              width={SIZE}
              height={ROWS}
              aria-label={`${SIZE} by ${ROWS} pixel output`}
            />
            {selected && (
              <span
                className="dotpixel-cell"
                style={{
                  left: `${(selected.col / SIZE) * 100}%`,
                  top: `${(selected.row / ROWS) * 100}%`,
                  width: `${100 / SIZE}%`,
                  height: `${100 / ROWS}%`,
                }}
              />
            )}
          </div>
          <div className="dotpixel-controls">
            <label>
              <input
                type="checkbox"
                checked={levels >= 2}
                onChange={(e) => {
                  edit({ type: 'settings', settings: { levels: e.target.checked ? 4 : 0 } });
                  setStatus('');
                }}
              />
              Posterize
            </label>
            <label className="dotpixel-range">
              Levels per channel <output>{levels || 'Off'}</output>
              <input
                aria-label="Posterize levels"
                type="range"
                min={2}
                max={16}
                step={1}
                disabled={!levels}
                value={levels || 4}
                onChange={(e) =>
                  changeGesture({ type: 'settings', settings: { levels: Number(e.target.value) } })
                }
                onPointerUp={commitSettings}
                onKeyUp={commitSettings}
                onBlur={commitSettings}
                onPointerCancel={() => changeGesture(null)}
              />
            </label>
            <p className="dotpixel-muted">
              Posterize affects the source view, sample squares and output. Off restores the
              original colours.
            </p>
            <h3>Line attraction</h3>
            <label className="dotpixel-range">
              Radius <output>{radius} cells</output>
              <input
                aria-label="Attraction radius"
                type="range"
                min={0.5}
                max={6}
                step={0.5}
                value={radius}
                onChange={(e) =>
                  changeGesture({ type: 'settings', settings: { radius: Number(e.target.value) } })
                }
                onPointerUp={commitSettings}
                onKeyUp={commitSettings}
                onBlur={commitSettings}
                onPointerCancel={() => changeGesture(null)}
              />
            </label>
            <label className="dotpixel-range">
              Strength <output>{Math.round(strength * 100)}%</output>
              <input
                aria-label="Attraction strength"
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(strength * 100)}
                onChange={(e) =>
                  changeGesture({
                    type: 'settings',
                    settings: { strength: Number(e.target.value) / 100 },
                  })
                }
                onPointerUp={commitSettings}
                onKeyUp={commitSettings}
                onBlur={commitSettings}
                onPointerCancel={() => changeGesture(null)}
              />
            </label>
            <button
              disabled={!lines.length}
              onClick={() => {
                edit({ type: 'clear-lines' });
                setStatus('');
              }}
            >
              Clear lines
            </button>
            <span className="dotpixel-muted"> {lines.length} outlines · Pins stay fixed</span>
          </div>
          <p className="dotpixel-muted">
            Click a preview pixel, then a source detail to assign it precisely. A new pin replaces
            any pin in that cell.
          </p>
          <p>
            {anchors.length} visible anchors · Frame {frame.w} × {frame.h}
          </p>
          {allAnchors.length > anchors.length && (
            <p className="dotpixel-muted">
              {allAnchors.length - anchors.length} overlapping anchors retained for higher
              resolutions. Coarse anchors take priority.
            </p>
          )}
          <p className="dotpixel-selection">
            {selected
              ? `Column ${selected.col + 1}, row ${selected.row + 1}${selectedAnchor ? ` · source ${Math.floor(selectedAnchor.x)}, ${Math.floor(selectedAnchor.y)} · placed at ${selectedAnchor.basisSize ?? SIZE}×${selectedAnchor.basisHeight ?? selectedAnchor.basisSize ?? ROWS}` : ' · automatic sample'}`
              : 'No anchor selected'}
          </p>
          <div className="dotpixel-actions">
            <button disabled={!selectedAnchor} onClick={removeSelected}>
              Remove anchor
            </button>
            <button
              disabled={!anchors.length}
              onClick={() => {
                edit({ type: 'clear' });
                setTarget(null);
                setStatus('');
              }}
            >
              Clear anchors
            </button>
          </div>
          <p className="dotpixel-muted">
            Squares show sampled colours. Cyan borders mark manual pins; pink lines attract only
            automatic squares.
          </p>
          <p className="dotpixel-muted">
            Your source stays untouched. Add creates a separate image you can refine in Paint.
            Frame, anchors, lines and colour settings are kept only while this editor is open.
          </p>
          <p role="status">{status}</p>
        </aside>
      </div>
    </dialog>,
    window.document.body,
  );
}
