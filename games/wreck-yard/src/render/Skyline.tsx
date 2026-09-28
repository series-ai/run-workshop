import { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ART_STYLE } from './style/artStyle';
import { buildProfileShape, FURNACE_GLOW, SKYLINE_LAYERS } from './style/skylineShapes';
import { glowTexture } from './style/glowTexture';

/** Above 1.0 in the HDR target, so the bloom picks it up. */
const FURNACE_MOUTH = new THREE.Color(ART_STYLE.palette.glow).multiplyScalar(3);

export function Skyline() {
  const layerGeometries = useMemo(() => {
    return SKYLINE_LAYERS.map((layer) => {
      const geometries: THREE.BufferGeometry[] = [];

      for (const profile of layer.profiles) {
        const shape = buildProfileShape(profile);
        const shapeGeom = new THREE.ShapeGeometry(shape, 8);
        // Extend the factory bases below the horizon for elevated cameras.
        const positions = shapeGeom.getAttribute('position');
        for (let i = 0; i < positions.count; i++) {
          if (positions.getY(i) === 0) positions.setY(i, -1000);
        }

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

  // Furnace mouths and their halos, placed from the furnace profiles.
  const furnaceGlow = useMemo(() => {
    const mouths: THREE.BufferGeometry[] = [];
    const halos: THREE.BufferGeometry[] = [];
    for (const layer of SKYLINE_LAYERS) {
      for (const profile of layer.profiles) {
        if (profile.kind !== 'furnace') continue;
        const azimuthRad = (profile.azimuthDeg * Math.PI) / 180;
        const inset = layer.distance - 0.5;
        const place = (geom: THREE.BufferGeometry) => {
          geom.rotateY(azimuthRad + Math.PI);
          geom.translate(Math.sin(azimuthRad) * inset, layer.baseY + profile.height * FURNACE_GLOW.y, -Math.cos(azimuthRad) * inset);
          return geom;
        };
        mouths.push(place(new THREE.CircleGeometry(profile.width * FURNACE_GLOW.radius, 20)));
        halos.push(place(new THREE.PlaneGeometry(profile.width * 1.1, profile.width * 1.1)));
      }
    }
    const mouth = mergeGeometries(mouths, false);
    const halo = mergeGeometries(halos, false);
    [...mouths, ...halos].forEach((g) => g.dispose());
    return { mouth, halo };
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

      {/* Molten blast furnace mouths with an additive halo */}
      <mesh geometry={furnaceGlow.mouth} renderOrder={-490}>
        <meshBasicMaterial color={FURNACE_MOUTH} fog={false} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={furnaceGlow.halo} renderOrder={-480}>
        <meshBasicMaterial
          color={ART_STYLE.palette.glow}
          map={glowTexture()}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fog={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
