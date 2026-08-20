import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { colors, fonts, useIsMobile } from './ui';

interface DropZoneProps {
  accept: string; // e.g. 'image/*' or 'video/*'
  onFile: (url: string, file: File) => void;
  children?: ReactNode;
}

/**
 * File drop target. Children (typically the media canvas) stay mounted so
 * dropping a new file replaces the current one. Files are read locally via
 * object URLs — nothing is uploaded. Files whose MIME type doesn't match
 * `accept` are rejected with a brief inline message.
 */
export function DropZone({ accept, onFile, children }: DropZoneProps) {
  const [over, setOver] = useState(false);
  const [rejected, setRejected] = useState(false);
  const isMobile = useIsMobile();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith(accept.split('/')[0]!)) {
      setRejected(true);
      window.setTimeout(() => setRejected(false), 3000);
      return;
    }
    setRejected(false);
    onFile(URL.createObjectURL(file), file);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); handleFiles(e.dataTransfer.files); }}
      style={{ position: 'relative', flex: 1, minHeight: 0 }}
    >
      {children ?? (
        <div
          onClick={isMobile ? () => inputRef.current?.click() : undefined}
          role={isMobile ? 'button' : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            margin: 12,
            border: `2px dashed ${over ? colors.accentHi : colors.accentMuted}`,
            borderRadius: 6,
            background: over ? 'rgba(155, 188, 15, 0.06)' : 'transparent',
            color: colors.textDim,
            fontFamily: fonts.mono,
            fontSize: 12,
            letterSpacing: '0.08em',
            textAlign: 'center',
            padding: 16,
            cursor: isMobile ? 'pointer' : undefined,
            transition: 'border-color 120ms ease, background 120ms ease',
          }}
        >
          {isMobile
            ? 'Tap to choose a file — it never leaves your browser'
            : 'Drop a file here, or use the Choose file button above — it never leaves your browser'}
        </div>
      )}
      {/* Mobile has no drag-and-drop: the empty state taps through to this. */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      {over && (
        <div
          style={{
            position: 'absolute',
            inset: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `2px dashed ${colors.accentHi}`,
            borderRadius: 6,
            background: 'rgba(13, 15, 10, 0.72)',
            color: colors.accentHi,
            fontFamily: fonts.mono,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            pointerEvents: 'none',
          }}
        >
          Drop to load
        </div>
      )}
      {rejected && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '5px 12px',
            background: 'rgba(48, 24, 10, 0.92)',
            border: '1px solid #a05a28',
            borderRadius: 3,
            color: colors.error,
            fontFamily: fonts.mono,
            fontSize: 11,
            letterSpacing: '0.06em',
            pointerEvents: 'none',
          }}
        >
          That file isn't an {accept.split('/')[0]}
        </div>
      )}
    </div>
  );
}
