import { useState } from 'react';
import { SceneDemo } from './scenes/SceneDemo';
import { ImageDemo } from './scenes/ImageDemo';
import { VideoDemo } from './scenes/VideoDemo';
import { Button, colors, fonts } from './components/ui';

type Tab = 'scene' | 'image' | 'video';

const TABS: { id: Tab; label: string }[] = [
  { id: 'scene', label: '3D Scene' },
  { id: 'image', label: 'Image' },
  { id: 'video', label: 'Video' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('scene');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        background: colors.bg,
        color: colors.text,
        fontFamily: fonts.sans,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          padding: '0 16px',
          minHeight: 52,
          background: colors.panel,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: '0.18em',
            color: colors.accent,
            whiteSpace: 'nowrap',
            textShadow: '0 0 12px rgba(155, 188, 15, 0.35)',
          }}
        >
          DITHER<span style={{ color: colors.textDim }}>.</span>PLAYGROUND
          <span style={{ animation: 'dp-blink 1.2s steps(1) infinite', color: colors.accentHi }}>▊</span>
        </span>
        <nav style={{ display: 'flex', gap: 8 }}>
          {TABS.map((t) => (
            <Button key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
            </Button>
          ))}
        </nav>
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>
        {tab === 'scene' && <SceneDemo />}
        {tab === 'image' && <ImageDemo />}
        {tab === 'video' && <VideoDemo />}
      </div>
    </div>
  );
}
