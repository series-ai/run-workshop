import React, { useEffect, useRef, useState } from 'react';
import { SectorDepotSimulation, type GameInput } from './sim/game.js';
import { GameCanvas } from './components/GameCanvas.js';
import { TacticalHud } from './components/TacticalHud.js';
import { ExfilOverlay } from './components/ExfilOverlay.js';
import './styles.css';

export const App: React.FC = () => {
  const [sim, setSim] = useState(() => new SectorDepotSimulation());
  const [, setFrame] = useState(0);

  const keysPressed = useRef<Set<string>>(new Set());
  const mousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isMouseDown = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.code);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.code);
    };

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate aim angle from screen center
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;
      mousePos.current = { x: dx, y: dy };
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) isMouseDown.current = true;
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) isMouseDown.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    // 60Hz simulation loop
    let lastTime = performance.now();
    const interval = 1000 / 60;
    let animId: number;

    const loop = (currentTime: number) => {
      const delta = currentTime - lastTime;

      if (delta >= interval) {
        lastTime = currentTime - (delta % interval);

        // Gather inputs
        const keys = keysPressed.current;
        let dx = 0;
        let dz = 0;

        if (keys.has('KeyW') || keys.has('ArrowUp')) dz += 1;
        if (keys.has('KeyS') || keys.has('ArrowDown')) dz -= 1;
        if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
        if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;

        const aimAngle = Math.atan2(mousePos.current.x, -mousePos.current.y);

        const input: GameInput = {
          dx,
          dz,
          sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'),
          slide: keys.has('KeyC'),
          roll: keys.has('Space'),
          kick: keys.has('KeyF'),
          shoot: isMouseDown.current,
          interact: keys.has('KeyE'),
          aimAngle,
        };

        sim.step(input);
        setFrame((f) => f + 1);
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      cancelAnimationFrame(animId);
    };
  }, [sim]);

  const handleRestart = () => {
    setSim(new SectorDepotSimulation());
  };

  return (
    <div className="game-viewport">
      <GameCanvas sim={sim} />
      <TacticalHud sim={sim} />
      <ExfilOverlay sim={sim} onRestart={handleRestart} />
    </div>
  );
};

export default App;
