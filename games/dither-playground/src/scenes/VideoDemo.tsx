import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer } from '@react-three/postprocessing';
import * as THREE from 'three';
import { DropZone } from '../components/DropZone';
import { MediaPlane } from '../components/MediaPlane';
import { DitherEffectUpdater } from '../components/DitherEffectUpdater';
import { DitherControls } from '../components/DitherControls';
import { DitherPostProcess, type DitherEffect } from '../dither/DitherPostProcess';
import { ALL_PRESETS } from 'dither-kit';
import { Button, ControlsDrawer, FileButton, errorTextStyle, toolbarStyle, useIsMobile } from '../components/ui';
import type { DitherEffectConfig } from 'dither-kit';

// CC-BY 3.0, (c) Blender Foundation — see THIRD_PARTY_NOTICES.md.
// Plain public/ path, not cdn-assets/ (that dir is CDN-uploaded by `rundot
// deploy` and read via RundotGameAPI.cdn.fetchAssets()).
const SAMPLE_VIDEO_URL = 'video/big-buck-bunny-clip.mp4';

function VideoStage({ url, config, onError }: { url: string; config: DitherEffectConfig; onError: (message: string | null) => void }) {
  const effectRef = useRef<DitherEffect>(null);
  const [aspect, setAspect] = useState(16 / 9);

  const video = useMemo(() => {
    const v = document.createElement('video');
    v.src = url;
    v.crossOrigin = 'anonymous';
    v.loop = true;
    v.muted = true;
    v.playsInline = true;
    return v;
  }, [url]);

  useEffect(() => {
    const onMetadata = () => {
      if (video.videoHeight > 0) setAspect(video.videoWidth / video.videoHeight);
    };
    const onVideoError = () => onError("Couldn't load that file as a video.");
    video.addEventListener('loadedmetadata', onMetadata);
    video.addEventListener('error', onVideoError);
    void video.play().then(() => onError(null)).catch(() => {
      // Autoplay can be blocked before first user interaction; the video
      // starts on the next pointer event via the browser's gesture.
    });
    return () => {
      video.removeEventListener('loadedmetadata', onMetadata);
      video.removeEventListener('error', onVideoError);
      video.pause();
    };
  }, [video, onError]);

  const texture = useMemo(() => {
    const t = new THREE.VideoTexture(video);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [video]);
  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <>
      <MediaPlane texture={texture} aspect={aspect} />
      <EffectComposer>
        <DitherPostProcess ref={effectRef} config={config} />
      </EffectComposer>
      <DitherEffectUpdater effectRef={effectRef} />
    </>
  );
}

export function VideoDemo() {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<DitherEffectConfig>(ALL_PRESETS[0]!.config);
  const isMobile = useIsMobile();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {isMobile ? (
          <ControlsDrawer>
            <DitherControls config={config} onChange={setConfig} fill />
          </ControlsDrawer>
        ) : (
          <DitherControls config={config} onChange={setConfig} />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0 }}>
          {/* Persistent file controls — always visible so users can swap media
              or return to the sample clip after loading their own. */}
          <div style={toolbarStyle}>
            <FileButton
              accept="video/*"
              onFile={(f) => setUrl(URL.createObjectURL(f))}
              style={isMobile ? { flex: 1, textAlign: 'center' } : undefined}
            >
              Choose file
            </FileButton>
            <Button
              onClick={() => setUrl(SAMPLE_VIDEO_URL)}
              style={isMobile ? { flex: 1 } : undefined}
            >
              {isMobile ? 'Load sample clip' : 'Load sample clip (Big Buck Bunny, CC-BY)'}
            </Button>
            {error && <span style={errorTextStyle}>{error}</span>}
          </div>
          <DropZone accept="video/*" onFile={(u) => setUrl(u)}>
            {url ? (
              <Canvas orthographic camera={{ position: [0, 0, 1], near: 0.01, far: 10 }} style={{ background: '#000' }}>
                <VideoStage url={url} config={config} onError={setError} />
              </Canvas>
            ) : null}
          </DropZone>
        </div>
      </div>
    </div>
  );
}
