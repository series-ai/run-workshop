async (page) => {
  await page.locator("select").first().selectOption("game");
  await page.getByRole("button", { name: "Stand and breathe" }).click();
  const play = page.getByRole("button", { name: "Play", exact: true });
  if (await play.count()) await play.click();
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const report = await page.evaluate(async () => {
    const url = performance
      .getEntriesByType("resource")
      .map((e) => e.name)
      .find((n) => n.includes("@react-three_fiber.js"));
    const { _roots } = await import(url);
    const root = [..._roots.values()][0].store
      .getState()
      .scene.getObjectByName("generated-assistant-rig");
    const mesh = root.getObjectByName("char1");
    root.updateWorldMatrix(true, true);
    mesh.skeleton.update();
    const attrs = mesh.geometry.attributes,
      index = mesh.geometry.index;
    const positions = [];
    for (let i = 0; i < attrs.position.count; i++) {
      const p = mesh.position.clone();
      mesh.getVertexPosition(i, p);
      mesh.localToWorld(p);
      root.worldToLocal(p);
      positions.push(p.toArray());
    }
    const report = {};
    for (const side of ["Left", "Right"]) {
      const armIds = ["ForeArm", "Hand"].map((n) =>
        mesh.skeleton.bones.findIndex((b) => b.name === side + n),
      );
      const legIds = ["UpLeg", "Leg"].map((n) =>
        mesh.skeleton.bones.findIndex((b) => b.name === side + n),
      );
      const arms = [],
        legWeight = [];
      for (let i = 0; i < positions.length; i++) {
        let aw = 0,
          lw = 0;
        for (let j = 0; j < 4; j++) {
          const b = attrs.skinIndex.getComponent(i, j),
            w = attrs.skinWeight.getComponent(i, j);
          if (armIds.includes(b)) aw += w;
          if (legIds.includes(b)) lw += w;
        }
        if (aw > 0.85) arms.push(i);
        legWeight.push(lw);
      }
      const bins = new Map(),
        size = 0.04;
      for (let i = 0; i < index.count; i += 3) {
        const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
        if (ids.reduce((s, j) => s + legWeight[j], 0) / 3 < 0.7) continue;
        const tri = ids.map((j) => positions[j]);
        const minY = Math.floor(Math.min(...tri.map((p) => p[1])) / size),
          maxY = Math.floor(Math.max(...tri.map((p) => p[1])) / size);
        const minZ = Math.floor(Math.min(...tri.map((p) => p[2])) / size),
          maxZ = Math.floor(Math.max(...tri.map((p) => p[2])) / size);
        for (let y = minY; y <= maxY; y++)
          for (let z = minZ; z <= maxZ; z++) {
            const key = y + "," + z;
            if (!bins.has(key)) bins.set(key, []);
            bins.get(key).push(tri);
          }
      }
      let inside = 0,
        maxDepth = 0;
      for (const id of arms) {
        const p = positions[id],
          hits = [];
        for (const [a, b, c] of bins.get(
          Math.floor(p[1] / size) + "," + Math.floor(p[2] / size),
        ) ?? []) {
          const d =
            (b[2] - c[2]) * (a[1] - c[1]) + (c[1] - b[1]) * (a[2] - c[2]);
          if (Math.abs(d) < 1e-12) continue;
          const u =
            ((b[2] - c[2]) * (p[1] - c[1]) + (c[1] - b[1]) * (p[2] - c[2])) / d;
          const v =
            ((c[2] - a[2]) * (p[1] - c[1]) + (a[1] - c[1]) * (p[2] - c[2])) / d;
          if (u >= 0 && v >= 0 && u + v <= 1)
            hits.push(u * a[0] + v * b[0] + (1 - u - v) * c[0]);
        }
        hits.sort((a, b) => a - b);
        const unique = hits.filter((x, i) => !i || x - hits[i - 1] > 0.00001);
        for (let i = 0; i + 1 < unique.length; i += 2)
          if (p[0] > unique[i] + 0.001 && p[0] < unique[i + 1] - 0.001) {
            inside++;
            maxDepth = Math.max(
              maxDepth,
              Math.min(p[0] - unique[i], unique[i + 1] - p[0]),
            );
            break;
          }
      }
      report[side] = { vertices: arms.length, inside, maxDepth };
    }
    return report;
  });
  if (Object.values(report).some((side) => side.inside > 0))
    throw Error(JSON.stringify(report));
  return report;
}
