import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ART_STYLE } from './style/artStyle';
import { buildCityBuilding, CITY_LAYERS } from './style/cityShapes';
import { buildProfileShape, FURNACE_GLOW, SKYLINE_LAYERS } from './style/skylineShapes';
import { glowTexture } from './style/glowTexture';

/** Above 1.0 in the HDR target, so the bloom picks it up. */
const FURNACE_MOUTH = new THREE.Color(ART_STYLE.palette.glow).multiplyScalar(3);
/** Lit windows: bright enough to read as lights at dusk, not so bright that the bloom smears them. */
const WINDOW_GAIN = 1.35;
/** Windows sit this far in front of their facade so they never z-fight with it at 250 m. */
const WINDOW_OFFSET = 1.5;
const AVIATION_RED = new THREE.Color('#ff3326').multiplyScalar(2.5);

/** Places building-local geometry on the ring: facing the yard at `azimuthDeg`, `distance` out. */
function placeOnRing(geometry: THREE.BufferGeometry, azimuthDeg: number, distance: number, baseY: number): THREE.BufferGeometry {
  const azimuth = (azimuthDeg * Math.PI) / 180;
  geometry.rotateY(azimuth + Math.PI);
  geometry.translate(Math.sin(azimuth) * distance, baseY, -Math.cos(azimuth) * distance);
  return geometry;
}

/** Merged silhouettes, lit windows (vertex colors), and aviation light positions for the city rings. */
function buildCity() {
  const silhouettes: THREE.BufferGeometry[] = [];
  const beacons: THREE.Vector3[] = [];
  const windowPositions: number[] = [];
  const windowColors: number[] = [];
  const windowIndices: number[] = [];
  for (const layer of CITY_LAYERS) {
    const layerShapes: THREE.BufferGeometry[] = [];
    for (const building of layer.buildings) {
      const { shape, windows, beacon } = buildCityBuilding(building);
      const outline = new THREE.ShapeGeometry(shape, 6);
      // Extend the bases below the horizon for elevated cameras.
      const positions = outline.getAttribute('position');
      for (let i = 0; i < positions.count; i += 1) if (positions.getY(i) === 0) positions.setY(i, -1000);
      layerShapes.push(placeOnRing(outline, building.azimuthDeg, layer.distance, layer.baseY));

      const azimuth = (building.azimuthDeg * Math.PI) / 180;
      const facing = azimuth + Math.PI;
      const cos = Math.cos(facing);
      const sin = Math.sin(facing);
      const distance = layer.distance - WINDOW_OFFSET;
      const cx = Math.sin(azimuth) * distance;
      const cz = -Math.cos(azimuth) * distance;
      // Local x turned by `facing` about +Y: (cos, 0, -sin).
      const place = (x: number, y: number) => [cx + x * cos, layer.baseY + y, cz - x * sin];
      for (const lit of windows) {
        const base = windowPositions.length / 3;
        for (const [x, y] of [[lit.x, lit.y], [lit.x + lit.width, lit.y], [lit.x + lit.width, lit.y + lit.height], [lit.x, lit.y + lit.height]] as const) {
          windowPositions.push(...place(x, y));
          windowColors.push(lit.color.r * WINDOW_GAIN, lit.color.g * WINDOW_GAIN, lit.color.b * WINDOW_GAIN);
        }
        windowIndices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
      if (beacon) {
        const [x, y, z] = place(beacon[0], beacon[1] + 0.8);
        beacons.push(new THREE.Vector3(x, y, z));
      }
    }
    silhouettes.push(mergeGeometries(layerShapes, false));
    layerShapes.forEach((g) => g.dispose());
  }
  const windows = new THREE.BufferGeometry();
  windows.setAttribute('position', new THREE.Float32BufferAttribute(windowPositions, 3));
  windows.setAttribute('color', new THREE.Float32BufferAttribute(windowColors, 3));
  windows.setIndex(windowIndices);
  return { silhouettes, windows, beacons };
}

export function Skyline() {
  const city = useMemo(buildCity, []);
  useEffect(() => () => {
    city.silhouettes.forEach((g) => g.dispose());
    city.windows.dispose();
  }, [city]);
  const beaconRefs = useRef<(THREE.Sprite | null)[]>([]);
  useFrame(({ clock }) => {
    // Aviation lights blink slowly, each tower on its own phase.
    beaconRefs.current.forEach((sprite, index) => {
      if (sprite) sprite.visible = Math.sin(clock.elapsedTime * 2.2 + index * 1.7) > 0.2;
    });
  });
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
      {/* The city: downtown towers and mid-rise blocks behind the factory rings. */}
      {city.silhouettes.map((geom, idx) => (
        <mesh key={`city-layer-${idx}`} geometry={geom} renderOrder={-520 + idx}>
          <meshBasicMaterial color={CITY_LAYERS[idx]!.color} fog={false} toneMapped={false} side={THREE.DoubleSide} depthWrite={true} />
        </mesh>
      ))}
      <mesh geometry={city.windows} renderOrder={-505}>
        <meshBasicMaterial vertexColors fog={false} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      {city.beacons.map((position, index) => (
        <sprite key={index} ref={(sprite) => { beaconRefs.current[index] = sprite; }} position={position} scale={[5, 5, 1]} renderOrder={-500}>
          <spriteMaterial map={glowTexture()} color={AVIATION_RED} transparent blending={THREE.AdditiveBlending} depthWrite={false} fog={false} toneMapped={false} />
        </sprite>
      ))}
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
