import { useState, useRef, useEffect } from 'react';
import type { WorkspaceAction, ScaleFilter } from './types';

interface FilterMenuProps {
  scaleFilter: ScaleFilter;
  dispatch: React.Dispatch<WorkspaceAction>;
}

const FILTERS: { value: ScaleFilter; label: string; description: string }[] = [
  { value: 'bicubic', label: 'Bicubic', description: 'Smooth scaling — best general quality' },
  { value: 'nearest', label: 'Nearest Neighbor', description: 'No interpolation — crisp pixel art' },
];

export function FilterMenu({ scaleFilter, dispatch }: FilterMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('pointerdown', handleClick, true);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handleClick, true);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  const currentLabel = FILTERS.find((f) => f.value === scaleFilter)?.label ?? 'Bicubic';

  return (
    <div className="toolbar-menu-wrapper" ref={menuRef}>
      <button
        className="toolbar-btn"
        onClick={() => setMenuOpen((v) => !v)}
        title="Scale filtering"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        <span>{currentLabel}</span>
      </button>
      {menuOpen && (
        <div className="toolbar-dropdown" onPointerDown={(e) => e.stopPropagation()}>
          {FILTERS.map((f) => (
            <button
              key={f.value}
              className="toolbar-dropdown-item"
              onClick={() => {
                dispatch({ type: 'SET_SCALE_FILTER', filter: f.value });
                setMenuOpen(false);
              }}
              style={{ opacity: f.value === scaleFilter ? 1 : 0.7 }}
            >
              <span style={{ width: 16, textAlign: 'center', flexShrink: 0, fontSize: 14 }}>
                {f.value === scaleFilter ? '\u2713' : ''}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span>{f.label}</span>
                <span style={{ fontSize: 11, opacity: 0.5 }}>{f.description}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
