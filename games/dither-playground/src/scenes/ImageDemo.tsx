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
import { ControlsDrawer, FileButton, errorTextStyle, toolbarStyle, useIsMobile } from '../components/ui';
import type { DitherEffectConfig } from 'dither-kit';

function ImageStage({ url, aspect, config }: { url: string; aspect: number; config: DitherEffectConfig }) {
  const effectRef = useRef<DitherEffect>(null);

  const texture = useMemo(() => {
    const t = new THREE.TextureLoader().load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [url]);
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

export function ImageDemo() {
  const [image, setImage] = useState<{ url: string; aspect: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<DitherEffectConfig>(ALL_PRESETS[0]!.config);
  const isMobile = useIsMobile();

  const handleFile = (url: string) => {
    const img = new Image();
    img.onload = () => {
      setError(null);
      setImage({ url, aspect: img.naturalWidth / Math.max(img.naturalHeight, 1) });
    };
    img.onerror = () => setError("Couldn't load that file as an image.");
    img.src = url;
  };

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {isMobile ? (
        <ControlsDrawer>
          <DitherControls config={config} onChange={setConfig} fill />
        </ControlsDrawer>
      ) : (
        <DitherControls config={config} onChange={setConfig} />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {/* Persistent file controls — mobile has no drag-and-drop, and users
            must be able to swap media after one is already loaded. */}
        <div style={toolbarStyle}>
          <FileButton
            accept="image/*"
            onFile={(f) => handleFile(URL.createObjectURL(f))}
            style={isMobile ? { flex: 1, textAlign: 'center' } : undefined}
          >
            Choose file
          </FileButton>
          {error && <span style={errorTextStyle}>{error}</span>}
        </div>
        <DropZone accept="image/*" onFile={handleFile}>
          {image ? (
            <Canvas orthographic camera={{ position: [0, 0, 1], near: 0.01, far: 10 }} style={{ background: '#000' }}>
              <ImageStage url={image.url} aspect={image.aspect} config={config} />
            </Canvas>
          ) : null}
        </DropZone>
      </div>
    </div>
  );
}
