export function SceneLighting({
  inspection = false,
}: {
  inspection?: boolean;
}) {
  return (
    <group name="cellar-lighting">
      <ambientLight intensity={inspection ? 0.55 : 0.025} color="#8b9075" />
      {inspection && (
        <directionalLight
          position={[-1, 2, -1]}
          intensity={2}
          color="#d1bd8d"
        />
      )}
    </group>
  );
}
