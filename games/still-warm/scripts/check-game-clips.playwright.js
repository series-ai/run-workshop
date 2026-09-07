async (page) => {
  return await page.evaluate(async () => {
    const T = await import("/node_modules/three/build/three.module.js");
    const { GLTFLoader } =
      await import("/node_modules/three/examples/jsm/loaders/GLTFLoader.js");
    const { DRACOLoader } =
      await import("/node_modules/three/examples/jsm/loaders/DRACOLoader.js");
    const loader = new GLTFLoader().setDRACOLoader(
      new DRACOLoader().setDecoderPath("/draco/"),
    );
    const combined = await loader.loadAsync("/assets/creature.glb");
    const mixer = new T.AnimationMixer(combined.scene);
    const reports = [];
    for (const [name, id] of [
      ["idle", 0],
      ["walk", 112],
      ["pickup", 276],
      ["collect", 284],
      ["push", 262],
      ["kneel", 365],
      ["scream", 386],
      ["left", 576],
      ["right", 586],
    ]) {
      const raw = await loader.loadAsync(
        id
          ? `/source-assets/assembled/animations/expanded/anim_${id}.glb`
          : "/source-assets/assembled/animations/anim_idle.glb",
      );
      const rm = new T.AnimationMixer(raw.scene);
      const ca = mixer
        .clipAction(combined.animations.find((c) => c.name === name))
        .play();
      const ra = rm.clipAction(raw.animations[0]).play();
      let max = 0;
      let maxAngle = 0;
      for (let t = 0; t < ra.getClip().duration; t += 0.2) {
        mixer.setTime(t);
        rm.setTime(t);
        combined.scene.updateMatrixWorld(true);
        raw.scene.updateMatrixWorld(true);
        raw.scene.traverse((b) => {
          if (b.isBone) {
            const bb = combined.scene.getObjectByName(b.name);
            maxAngle = Math.max(maxAngle, b.getWorldQuaternion(new T.Quaternion()).normalize().angleTo(bb.getWorldQuaternion(new T.Quaternion()).normalize()));
            max = Math.max(
              max,
              b
                .getWorldPosition(new T.Vector3())
                .distanceTo(bb.getWorldPosition(new T.Vector3())),
            );
          }
        });
      }
      ca.stop();
      ra.stop();
      reports.push({ name, maxBoneError: max, maxAngle });
    }
    if (reports.some((report) => report.maxBoneError > 0.0001 || report.maxAngle > 0.001))
      throw new Error(JSON.stringify(reports));
    return reports;
  });
}
