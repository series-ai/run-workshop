import { useState } from 'react';
import { SceneDemo } from './scenes/SceneDemo';
import { ImageDemo } from './scenes/ImageDemo';
import { VideoDemo } from './scenes/VideoDemo';
import { Button, MobileDrawerContext, bottomBarStyle, colors, fonts, useIsMobile } from './components/ui';

type Tab = 'scene' | 'image' | 'video';

const TABS: { id: Tab; label: string }[] = [
  { id: 'scene', label: '3D Scene' },
  { id: 'image', label: 'Image' },
  { id: 'video', label: 'Video' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('scene');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isMobile = useIsMobile();

  const selectTab = (t: Tab) => {
    setTab(t);
    setDrawerOpen(false);
  };

  return (
    <MobileDrawerContext.Provider value={{ open: drawerOpen, setOpen: setDrawerOpen }}>
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
            minHeight: isMobile ? 40 : 52,
            background: colors.panel,
            borderBottom: `1px solid ${colors.border}`,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: isMobile ? 12 : 14,
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
          {!isMobile && (
            <nav style={{ display: 'flex', gap: 8 }}>
              {TABS.map((t) => (
                <Button key={t.id} active={tab === t.id} onClick={() => selectTab(t.id)}>
                  {t.label}
                </Button>
              ))}
            </nav>
          )}
        </header>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {tab === 'scene' && <SceneDemo />}
          {tab === 'image' && <ImageDemo />}
          {tab === 'video' && <VideoDemo />}
        </div>
        {isMobile && (
          <nav style={bottomBarStyle}>
            {TABS.map((t) => (
              <Button
                key={t.id}
                active={tab === t.id}
                onClick={() => selectTab(t.id)}
                style={{ flex: 1, padding: '9px 2px', fontSize: 10, whiteSpace: 'nowrap' }}
              >
                {t.label}
              </Button>
            ))}
            <Button
              active={drawerOpen}
              onClick={() => setDrawerOpen(!drawerOpen)}
              style={{ flex: 1, padding: '9px 2px', fontSize: 10, whiteSpace: 'nowrap' }}
            >
              {drawerOpen ? '▼ Controls' : '▲ Controls'}
            </Button>
          </nav>
        )}
      </div>
    </MobileDrawerContext.Provider>
  );
}
