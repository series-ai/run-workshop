import { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ART_STYLE } from './style/artStyle';
import { buildProfileShape, SKYLINE_LAYERS } from './style/skylineShapes';

export function Skyline() {
  const layerGeometries = useMemo(() => {
    return SKYLINE_LAYERS.map((layer) => {
      const geometries: THREE.BufferGeometry[] = [];

      for (const profile of layer.profiles) {
        const shape = buildProfileShape(profile);
        const shapeGeom = new THREE.ShapeGeometry(shape, 8);

        // Position on cylinder arc at distance and azimuth
        const azimuthRad = (profile.azimuthDeg * Math.PI) / 180;
        const x = Math.sin(azimuthRad) * layer.distance;
        const z = -Math.cos(azimuthRad) * layer.distance;

        // Facing origin (0, 0, 0)
        shapeGeom.rotateY(azimuthRad + Math.PI);
        shapeGeom.translate(x, layer.baseY, z);

        geometries.push(shapeGeom);
      }

      if (geometries.length === 0) {
        return new THREE.BufferGeometry();
      }

      const merged = mergeGeometries(geometries, false);
      geometries.forEach((g) => g.dispose());
      return merged;
    });
  }, []);

  // Small emissive molten furnace window on the blast furnace in the mid layer
  const windowGeom = useMemo(() => {
    const geom = new THREE.PlaneGeometry(3.5, 2.2);
    // Placed on furnace at azimuth 22 deg, distance 104.2m, baseY 2m + 8m
    const azimuthRad = (22 * Math.PI) / 180;
    const x = Math.sin(azimuthRad) * 104.2;
    const z = -Math.cos(azimuthRad) * 104.2;
    geom.rotateY(azimuthRad + Math.PI);
    geom.translate(x, 10, z);
    return geom;
  }, []);

  return (
    <group name="SkylineBackdrop">
      {layerGeometries.map((geom, idx) => (
        <mesh key={`skyline-layer-${idx}`} geometry={geom} renderOrder={-500}>
          <meshBasicMaterial
            color={SKYLINE_LAYERS[idx].color}
            fog={false}
            toneMapped={false}
            side={THREE.DoubleSide}
            depthWrite={true}
          />
        </mesh>
      ))}

      {/* Molten blast furnace inspection port / window */}
      <mesh geometry={windowGeom} renderOrder={-490}>
        <meshBasicMaterial
          color={ART_STYLE.palette.glow}
          fog={false}
          toneMapped={false}
          side={THREE.DoubleSide}
          depthWrite={true}
        />
      </mesh>
    </group>
  );
}
