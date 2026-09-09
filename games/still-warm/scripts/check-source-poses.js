async (page) => {
  return await page.evaluate(async () => {
    const threeURL = performance
      .getEntriesByType("resource")
      .find((x) => x.name.includes("/three.js?")).name;
    const THREE = await import(threeURL);
    const { GLTFLoader } =
      await import("/node_modules/three/examples/jsm/loaders/GLTFLoader.js");
    const { DRACOLoader } =
      await import("/node_modules/three/examples/jsm/loaders/DRACOLoader.js");
    const loader = new GLTFLoader();
    const draco = new DRACOLoader().setDecoderPath("/draco/");
    loader.setDRACOLoader(draco);
    const combined = await loader.loadAsync("/assets/creature.glb");
    const bones = [
      "Hips",
      "Spine",
      "Head",
      "LeftArm",
      "LeftForeArm",
      "LeftHand",
      "RightArm",
      "RightForeArm",
      "RightHand",
      "LeftUpLeg",
      "LeftLeg",
      "LeftFoot",
      "RightUpLeg",
      "RightLeg",
      "RightFoot",
    ];
    const results = [];
    for (const [clipName, file] of Object.entries({
      idle: "animations/anim_idle.glb",
      walk: "animations/expanded/anim_112.glb",
      pickup: "animations/expanded/anim_276.glb",
      collect: "animations/expanded/anim_284.glb",
      scream: "animations/expanded/anim_386.glb",
    })) {
      const source = await loader.loadAsync("/source-assets/assembled/" + file);
      const a = new THREE.AnimationMixer(combined.scene),
        b = new THREE.AnimationMixer(source.scene);
      a.clipAction(combined.animations.find((c) => c.name === clipName)).play();
      b.clipAction(source.animations[0]).play();
      let maxPositionError = 0,
        worst = "";
      const samples = [];
      for (const t of [0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 7].filter(
        (t) =>
          t < combined.animations.find((c) => c.name === clipName).duration,
      )) {
        a.setTime(t);
        b.setTime(t);
        combined.scene.updateMatrixWorld(true);
        source.scene.updateMatrixWorld(true);
        let max = 0;
        for (const name of bones) {
          const pa = combined.scene
            .getObjectByName(name)
            .getWorldPosition(new THREE.Vector3());
          const pb = source.scene
            .getObjectByName(name)
            .getWorldPosition(new THREE.Vector3());
          const e = pa.distanceTo(pb);
          max = Math.max(max, e);
          if (e > maxPositionError) {
            maxPositionError = e;
            worst = `${name}@${t}`;
          }
        }
        samples.push({ t, max });
      }
      a.stopAllAction();
      b.stopAllAction();
      results.push({ clip: clipName, maxPositionError, worst, samples });
    }
    draco.dispose();
    if (results.some((r) => r.maxPositionError > 0.0001))
      throw new Error(JSON.stringify(results));
    return results;
  });
};
