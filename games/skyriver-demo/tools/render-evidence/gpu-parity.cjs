'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const playwrightModule = process.env.PLAYWRIGHT_MODULE;
if (!playwrightModule) throw new Error('SKYRIVER_PLAYWRIGHT_MODULE_REQUIRED: Set PLAYWRIGHT_MODULE to an installed Playwright module.');
const { chromium } = require(playwrightModule);

const url = process.argv[2];
const outputDirectory = process.argv[3];
if (!url || !outputDirectory) throw new Error('SKYRIVER_GPU_PROOF_ARGUMENTS_REQUIRED: Provide URL and output directory.');
const out = path.resolve(outputDirectory);
const requestedCount = Number(process.env.R21_GPU_COUNT || 20000);
const seed = Number(process.env.R21_GPU_SEED || 424242);
if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new Error('R21_GPU_SEED must be an unsigned 32-bit integer.');
const toleranceM = Number(process.env.R21_GPU_TOLERANCE_M || 0.05);
const dumpPositions = process.env.R21_GPU_DUMP_POSITIONS === '1';
const progressExpression = (process.env.R21_GPU_PROGRESS_EXPR || '').trim();
if (progressExpression && !/^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*$/.test(progressExpression)) throw new Error('R21_GPU_PROGRESS_EXPR must name an actual shader variable or member.');
const extraHeldout = process.env.R21_GPU_HELDOUT_CARS ? JSON.parse(process.env.R21_GPU_HELDOUT_CARS) : [];
if(!Array.isArray(extraHeldout)||extraHeldout.some(i=>!Number.isInteger(i)||i<0))throw new Error('Invalid held-out car indices.');
const extraTimes = process.env.R21_GPU_TIMES ? JSON.parse(process.env.R21_GPU_TIMES) : [];
if (!Number.isInteger(requestedCount) || requestedCount <= 0) throw new Error('R21_GPU_COUNT must be a positive integer.');
if (!Array.isArray(extraTimes) || extraTimes.some(t => !Number.isFinite(t))) throw new Error('R21_GPU_TIMES must be a JSON array of finite seconds.');
const sha = source => crypto.createHash('sha256').update(source).digest('hex');
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const logs = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('console', m => { if (m.type() === 'error' || m.text().includes('gl adapter')) { logs.push(`${m.type()}: ${m.text()}`); console.log(m.text()); } });
    page.on('pageerror', e => logs.push(`pageerror: ${e.message}`));
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__skyriver?.stats().firstFrameMs !== null && window.__skyriverDiag?.impostorPosition, null, { timeout: 20000 });
    const result = await page.evaluate(async ({ requestedCount, seed, toleranceM, extraTimes, dumpPositions, progressExpression, extraHeldout }) => {
      const app = window.__skyriver;
      const diag = window.__skyriverDiag;
      app.suspend();
      const renderer = app.scene.renderer;
      const gl = renderer.getContext();
      if (typeof gl.createTransformFeedback !== 'function') throw new Error('WebGL 2 is required.');
      const mesh = app.traffic.objects.find(o => o.name === 'skyriver.traffic.impostors');
      if (!mesh) throw new Error('Impostor mesh is missing.');
      const material = mesh.material;
      if(app.session.seed!==seed)throw new Error('Requested seed differs from the live render session.');
      const modelIdentity={seed:app.session.seed,textures:{},positionUniforms:{}};
      const plain=v=>ArrayBuffer.isView(v)?Array.from(v):Array.isArray(v)?v.map(plain):v&&typeof v.toArray==='function'?v.toArray():v;
      for(const name of Object.keys(material.uniforms).sort()){
        const value=material.uniforms[name].value;
        if(value?.isTexture){const image=value.image,data=image?.data;if(!ArrayBuffer.isView(data))throw new Error(`Model texture data are unavailable: ${name}`);const bytes=new Uint8Array(data.buffer,data.byteOffset,data.byteLength),digest=await crypto.subtle.digest('SHA-256',bytes);modelIdentity.textures[name]={width:image.width,height:image.height,type:data.constructor.name,sha256:Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('')};}
        else if(/^u(?:Loop|Stream|Ring|Path|Flow|Route|Fork|Hop|Speed|Model)/.test(name))modelIdentity.positionUniforms[name]=plain(value);
      }

      const count = Math.min(requestedCount, mesh.geometry.getAttribute('aImp').count);
      const originalProgram = renderer.properties.get(material).currentProgram?.program;
      if (!originalProgram) throw new Error('Compiled impostor program is missing.');
      const originalVertex = gl.getAttachedShaders(originalProgram).find(shader => gl.getShaderParameter(shader, gl.SHADER_TYPE) === gl.VERTEX_SHADER);
      const originalSource = gl.getShaderSource(originalVertex);
      const anchor = 'vec3 toCam = cameraPosition - pos;';
      if (originalSource.split(anchor).length !== 2) throw new Error('Position capture anchor must occur exactly once.');
      if (originalSource.includes('r21Position')) throw new Error('Capture output name already exists.');
      let source = originalSource.replace(/\bvoid\s+main\s*\(\s*\)\s*\{/, `out highp vec3 r21Position;\n${progressExpression?'out highp float r21CanyonArc;\n':''}$&`);
      if (source === originalSource) throw new Error('Vertex main is missing.');
      source = source.replace(anchor, `r21Position = pos;\n  ${progressExpression?`r21CanyonArc = ${progressExpression};\n  `:''}${anchor}`);
      const fragmentSource = '#version 300 es\nprecision highp float;\nout vec4 r21Color;\nvoid main() { r21Color = vec4(0.0); }';
      const resources = { shaders: [], buffers: [], vao: null, feedback: null, program: null };
      const saved = { program: gl.getParameter(gl.CURRENT_PROGRAM), vao: gl.getParameter(gl.VERTEX_ARRAY_BINDING), arrayBuffer: gl.getParameter(gl.ARRAY_BUFFER_BINDING), tf: gl.getParameter(gl.TRANSFORM_FEEDBACK_BINDING), tfBuffer: gl.getParameter(gl.TRANSFORM_FEEDBACK_BUFFER_BINDING), activeTexture: gl.getParameter(gl.ACTIVE_TEXTURE), discard: gl.isEnabled(gl.RASTERIZER_DISCARD), textures: [] };
      const errors = [];
      const drain = label => { let error; while ((error = gl.getError()) !== gl.NO_ERROR) errors.push({ stage: label, code: error }); };
      drain('before probe');
      const compile = (type, text) => {
        const shader = gl.createShader(type); resources.shaders.push(shader);
        gl.shaderSource(shader, text); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(`Shader compile failed: ${gl.getShaderInfoLog(shader)}`);
        return shader;
      };
      const attributeCopies = [];
      const uniformCopies = [];
      try {
        const vertex = compile(gl.VERTEX_SHADER, source), fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
        const program = gl.createProgram(); resources.program = program;
        gl.attachShader(program, vertex); gl.attachShader(program, fragment);
        gl.transformFeedbackVaryings(program, progressExpression?['r21Position','r21CanyonArc']:['r21Position'], gl.INTERLEAVED_ATTRIBS);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`Transform feedback link failed: ${gl.getProgramInfoLog(program)}`);
        const feedbackOutput = gl.getTransformFeedbackVarying(program, 0);
        if(progressExpression){const arcOutput=gl.getTransformFeedbackVarying(program,1);if(arcOutput.name!=='r21CanyonArc'||arcOutput.type!==gl.FLOAT||arcOutput.size!==1)throw new Error('Unexpected canyon arc output layout.');}
        if (feedbackOutput.name !== 'r21Position' || feedbackOutput.type !== gl.FLOAT_VEC3 || feedbackOutput.size !== 1) throw new Error('Unexpected transform feedback output layout.');
        gl.useProgram(program);
        const vao = gl.createVertexArray(); resources.vao = vao; gl.bindVertexArray(vao);
        const componentType = array => {
          if (array instanceof Float32Array) return gl.FLOAT;
          if (array instanceof Uint8Array || array instanceof Uint8ClampedArray) return gl.UNSIGNED_BYTE;
          if (array instanceof Int8Array) return gl.BYTE;
          if (array instanceof Uint16Array) return gl.UNSIGNED_SHORT;
          if (array instanceof Int16Array) return gl.SHORT;
          if (array instanceof Uint32Array) return gl.UNSIGNED_INT;
          if (array instanceof Int32Array) return gl.INT;
          throw new Error(`Unsupported attribute array: ${array.constructor.name}`);
        };
        const integerTypes = new Set([gl.INT, gl.INT_VEC2, gl.INT_VEC3, gl.INT_VEC4, gl.UNSIGNED_INT, gl.UNSIGNED_INT_VEC2, gl.UNSIGNED_INT_VEC3, gl.UNSIGNED_INT_VEC4]);
        const usedInstanced = [];
        for (let i = 0; i < gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES); i += 1) {
          const info = gl.getActiveAttrib(program, i);
          if (info.name.startsWith('gl_')) continue;
          const attribute = mesh.geometry.getAttribute(info.name);
          if (!attribute) throw new Error(`Active GPU attribute is not in geometry: ${info.name}`);
          const interleaved = attribute.isInterleavedBufferAttribute;
          const owner = interleaved ? attribute.data : attribute;
          const array = owner.array;
          const divisor = owner.isInstancedBufferAttribute || owner.isInstancedInterleavedBuffer ? owner.meshPerAttribute || 1 : 0;
          if (divisor && attribute.count * divisor < count) throw new Error(`Attribute capacity is too small: ${info.name}`);
          const buffer = gl.createBuffer(); resources.buffers.push(buffer);
          gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, array, gl.STATIC_DRAW);
          const location = gl.getAttribLocation(program, info.name);
          const stride = interleaved ? owner.stride * array.BYTES_PER_ELEMENT : 0;
          const offset = interleaved ? attribute.offset * array.BYTES_PER_ELEMENT : 0;
          if (integerTypes.has(info.type)) gl.vertexAttribIPointer(location, attribute.itemSize, componentType(array), stride, offset);
          else gl.vertexAttribPointer(location, attribute.itemSize, componentType(array), attribute.normalized, stride, offset);
          gl.enableVertexAttribArray(location); gl.vertexAttribDivisor(location, divisor);
          const copy = { name: info.name, itemSize: attribute.itemSize, componentArray: array.constructor.name, divisor, count: attribute.count };
          attributeCopies.push(copy);
          if (divisor) usedInstanced.push({ attribute, copy });
        }

        const derived = diag.deriveImpostorAttributes(seed, count);
        const derivedArrays = Object.entries(derived).filter(([, value]) => ArrayBuffer.isView(value) && !(value instanceof DataView));
        const attributeValidation = [];
        for (const { attribute, copy } of usedInstanced) {
          const matches = [];
          for (const [field, array] of derivedArrays) {
            if (array.length !== count * attribute.itemSize || copy.divisor !== 1) continue;
            let same = true;
            for (let j = 0; j < array.length; j += 1) {
              const car = Math.floor(j / attribute.itemSize), component = j % attribute.itemSize;
              const value = attribute.isInterleavedBufferAttribute ? attribute.data.array[car * attribute.data.stride + attribute.offset + component] : attribute.array[j];
              if (array[j] !== value) { same = false; break; }
            }
            if (same) matches.push(field);
          }
          attributeValidation.push({ attribute: copy.name, derivedFields: matches, exactMatch: matches.length > 0 });
          if (!matches.length) throw new Error(`Derived mirror attributes do not match GPU geometry: ${copy.name}`);
        }

        const setters = new Map([
          [gl.FLOAT, (loc, v) => gl.uniform1f(loc, v)], [gl.FLOAT_VEC2, (loc, v) => gl.uniform2fv(loc, v)], [gl.FLOAT_VEC3, (loc, v) => gl.uniform3fv(loc, v)], [gl.FLOAT_VEC4, (loc, v) => gl.uniform4fv(loc, v)],
          [gl.INT, (loc, v) => gl.uniform1i(loc, v)], [gl.INT_VEC2, (loc, v) => gl.uniform2iv(loc, v)], [gl.INT_VEC3, (loc, v) => gl.uniform3iv(loc, v)], [gl.INT_VEC4, (loc, v) => gl.uniform4iv(loc, v)],
          [gl.BOOL, (loc, v) => gl.uniform1i(loc, v)], [gl.BOOL_VEC2, (loc, v) => gl.uniform2iv(loc, v)], [gl.BOOL_VEC3, (loc, v) => gl.uniform3iv(loc, v)], [gl.BOOL_VEC4, (loc, v) => gl.uniform4iv(loc, v)],
          [gl.UNSIGNED_INT, (loc, v) => gl.uniform1ui(loc, v)], [gl.UNSIGNED_INT_VEC2, (loc, v) => gl.uniform2uiv(loc, v)], [gl.UNSIGNED_INT_VEC3, (loc, v) => gl.uniform3uiv(loc, v)], [gl.UNSIGNED_INT_VEC4, (loc, v) => gl.uniform4uiv(loc, v)],
          [gl.FLOAT_MAT2, (loc, v) => gl.uniformMatrix2fv(loc, false, v)], [gl.FLOAT_MAT3, (loc, v) => gl.uniformMatrix3fv(loc, false, v)], [gl.FLOAT_MAT4, (loc, v) => gl.uniformMatrix4fv(loc, false, v)],
          [gl.FLOAT_MAT2x3, (loc, v) => gl.uniformMatrix2x3fv(loc, false, v)], [gl.FLOAT_MAT2x4, (loc, v) => gl.uniformMatrix2x4fv(loc, false, v)], [gl.FLOAT_MAT3x2, (loc, v) => gl.uniformMatrix3x2fv(loc, false, v)], [gl.FLOAT_MAT3x4, (loc, v) => gl.uniformMatrix3x4fv(loc, false, v)], [gl.FLOAT_MAT4x2, (loc, v) => gl.uniformMatrix4x2fv(loc, false, v)], [gl.FLOAT_MAT4x3, (loc, v) => gl.uniformMatrix4x3fv(loc, false, v)],
        ]);
        const samplers = new Map([[gl.SAMPLER_2D, gl.TEXTURE_2D], [gl.INT_SAMPLER_2D, gl.TEXTURE_2D], [gl.UNSIGNED_INT_SAMPLER_2D, gl.TEXTURE_2D], [gl.SAMPLER_2D_SHADOW, gl.TEXTURE_2D], [gl.SAMPLER_CUBE, gl.TEXTURE_CUBE_MAP], [gl.SAMPLER_CUBE_SHADOW, gl.TEXTURE_CUBE_MAP], [gl.SAMPLER_3D, gl.TEXTURE_3D], [gl.SAMPLER_2D_ARRAY, gl.TEXTURE_2D_ARRAY], [gl.SAMPLER_2D_ARRAY_SHADOW, gl.TEXTURE_2D_ARRAY]]);
        const bindings = new Map([[gl.TEXTURE_2D, gl.TEXTURE_BINDING_2D], [gl.TEXTURE_CUBE_MAP, gl.TEXTURE_BINDING_CUBE_MAP], [gl.TEXTURE_3D, gl.TEXTURE_BINDING_3D], [gl.TEXTURE_2D_ARRAY, gl.TEXTURE_BINDING_2D_ARRAY]]);
        let nextTextureUnit = 0;
        for (let i = 0; i < gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS); i += 1) {
          const info = gl.getActiveUniform(program, i);
          for (let j = 0; j < info.size; j += 1) {
            const name = info.size > 1 ? info.name.replace('[0]', `[${j}]`) : info.name;
            const originalLocation = gl.getUniformLocation(originalProgram, name);
            const location = gl.getUniformLocation(program, name);
            if (originalLocation === null || location === null) throw new Error(`Uniform location is missing: ${name}`);
            const value = gl.getUniform(originalProgram, originalLocation);
            if (samplers.has(info.type)) {
              const base = info.name.replace(/\[0\]$/, '');
              const uniformValue = material.uniforms[base]?.value;
              const texture = Array.isArray(uniformValue) ? uniformValue[j] : uniformValue;
              const webglTexture = renderer.properties.get(texture).__webglTexture;
              if (!webglTexture) throw new Error(`Material texture is not uploaded: ${name}`);
              const unit = nextTextureUnit++, target = samplers.get(info.type);
              gl.activeTexture(gl.TEXTURE0 + unit);
              saved.textures.push({ unit, target, texture: gl.getParameter(bindings.get(target)) });
              gl.bindTexture(target, webglTexture); gl.uniform1i(location, unit);
              uniformCopies.push({ name, type: info.type, textureUnit: unit, originalTextureUnit: value, actualMaterialTexture: true });
            } else {
              const setter = setters.get(info.type);
              if (!setter) throw new Error(`Unsupported uniform type ${info.type}: ${name}`);
              setter(location, value);
              uniformCopies.push({ name, type: info.type, values: typeof value === 'number' || typeof value === 'boolean' ? value : Array.from(value) });
            }
          }
        }
        const timeLocation = gl.getUniformLocation(program, 'uTime');
        if (timeLocation === null) throw new Error('GPU uTime is inactive.');
        const strideFloats=progressExpression?4:3;
        const gpu = new Float32Array(count * strideFloats);
        const encodeGpu=()=>{const bytes=new Uint8Array(gpu.buffer);let text='';for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(text);};
        const feedbackBuffer = gl.createBuffer(); resources.buffers.push(feedbackBuffer);
        gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, feedbackBuffer); gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER, gpu.byteLength, gl.STREAM_READ);
        const feedback = gl.createTransformFeedback(); resources.feedback = feedback; gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, feedback);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, feedbackBuffer);
        gl.enable(gl.RASTERIZER_DISCARD);
        drain('setup');
        if (errors.length) throw new Error(`WebGL setup errors: ${JSON.stringify(errors)}`);

        const imp = derived.streamArcPhaseSeed || derived.pathArcPhaseSeed;
        const baselineTimes = [-1, -0.001, 0, 0.001, 10, 40, 100, 200, material.uniforms.uTime.value];
        const events = [];
        const seen = new Set();
        const streams = material.uniforms.uStreamA?.value;
        // Add exact baseline lap-seam times. R21 event times can be supplied through R21_GPU_TIMES.
        if (imp && derived.row && streams && originalSource.includes('st.y * ( 0.9 + 0.2 * row )')) {
          for (let i = 0; i < count; i += 1) {
            const k = imp[i * 4];
            if (k >= streams.length || seen.has(k)) continue;
            seen.add(k);
            const st = streams[k], row = derived.row[i], phase = imp[i * 4 + 2], loop = material.uniforms.uLoop.value;
            const arc = imp[i * 4 + 1] * loop, speed = st.y * (0.9 + 0.2 * row), omega = 0.3 + 0.25 * row, amp = st.y > 150 ? 110 : 40;
            const target = st.x > 0 ? loop : 0;
            let time = (target - arc) / (st.x * speed);
            for (let n = 0; n < 12; n += 1) time -= (arc + st.x * speed * time + amp * Math.sin(time * omega + phase * 97) - target) / (st.x * speed + amp * omega * Math.cos(time * omega + phase * 97));
            events.push({ kind: 'baseline lap seam', car: i, path: k, time });
            baselineTimes.push(time - 0.001, time, time + 0.001);
          }
        }
        const times = [...new Set([...baselineTimes, ...extraTimes].map(t => Number(t.toFixed(9))))].sort((a, b) => a - b);
        const heldout = new Set([0, 1, 3, 7, 31, 127, 511, 1023, 2047, 4095, 8191, 16383,...extraHeldout].filter(i => i < count));
        const pathSeen = new Set();
        if (imp) for (let i = 0; i < count; i += 1) { const k = imp[i * 4]; if (!pathSeen.has(k)) { heldout.add(i); pathSeen.add(k); } }
        for (const event of events) heldout.add(event.car);
        const frames = [];
        const cpu = { x: 0, y: 0, z: 0, dx: 0, dz: 0 };
        let maxErrorM = 0;
        let worst = null;
        for (const time of times) {
          gl.uniform1f(timeLocation, time);
          gl.beginTransformFeedback(gl.POINTS);
          gl.drawArraysInstanced(gl.POINTS, 0, 1, count);
          gl.endTransformFeedback();
          gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, feedbackBuffer); gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER, 0, gpu);
          drain(`time ${time}`);
          const errorValues = [], samples = [], perPath = new Map();
          let frameWorst = null;
          for (let i = 0; i < count; i += 1) {
            diag.impostorPosition(derived, i, time, cpu);
            const position = [gpu[i * strideFloats], gpu[i * strideFloats + 1], gpu[i * strideFloats + 2]];
            if (position.some(v => !Number.isFinite(v)) || ![cpu.x, cpu.y, cpu.z].every(Number.isFinite)) throw new Error(`Non-finite position at car ${i}, time ${time}`);
            const errorM = Math.hypot(position[0] - cpu.x, position[1] - cpu.y, position[2] - cpu.z);
            const k = imp ? imp[i * 4] : -1;
            const record = { car: i, path: k, time, gpu: position, cpu: [cpu.x, cpu.y, cpu.z], errorM };
            if (!frameWorst || errorM > frameWorst.errorM) frameWorst = record;
            if (!worst || errorM > maxErrorM) { maxErrorM = errorM; worst = record; }
            perPath.set(k, Math.max(perPath.get(k) || 0, errorM));
            errorValues.push(errorM);
            if (heldout.has(i)) samples.push(record);
          }
          errorValues.sort((a, b) => a - b);
          frames.push({ time, count, ...(dumpPositions?{gpuDataBase64:encodeGpu(),strideFloats}:{}), p50ErrorM: errorValues[Math.floor(count * 0.5)], p95ErrorM: errorValues[Math.floor(count * 0.95)], maxErrorM: frameWorst.errorM, worst: frameWorst, perPathMaxErrorM: Object.fromEntries(perPath), heldoutSamples: samples });
        }
        return { adapter: app.scene.glDiagnostics(), modelIdentity, dumpPositions, progressExpression, strideFloats, count, requestedCount, seed, toleranceM, maxErrorM, worst, pass: maxErrorM <= toleranceM && errors.length === 0, times, seamEvents: events, heldoutCars: [...heldout].sort((a, b) => a - b), frames, attributes: attributeCopies, attributeValidation, copiedUniforms: uniformCopies, originalShaderSource: originalSource, feedbackShaderSource: source, glErrors: errors,
          stats: app.stats(), limits: ['This captures position from a second GPU program built from the actual compiled vertex source.', 'Only an output declaration and a position assignment are added to the source.', 'The draw uses one vertex per instance. Every instance attribute comes from current geometry.', 'Derived CPU attributes must exactly match every active instance attribute.', 'The actual uploaded material textures and original program uniforms are used.', 'GLSL float math can differ from the CPU double math. The tolerance is stated in metres.', 'This does not prove fragment color, depth visibility, body transforms, or draw performance.', 'Baseline seam times are generated only when the old speed formula is present. Supply R21 hop and fork event times through R21_GPU_TIMES.', 'The probe does not change simulation state. It freezes the presentation and updates only its own uTime.'] };
      } finally {
        if (gl.getParameter(gl.TRANSFORM_FEEDBACK_ACTIVE)) gl.endTransformFeedback();
        if (!saved.discard) gl.disable(gl.RASTERIZER_DISCARD);
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, saved.tf);
        gl.bindVertexArray(saved.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, saved.arrayBuffer);
        gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, saved.tfBuffer);
        for (const { unit, target, texture } of saved.textures) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(target, texture); }
        gl.activeTexture(saved.activeTexture); gl.useProgram(saved.program);
        for (const buffer of resources.buffers) gl.deleteBuffer(buffer);
        if (resources.feedback) gl.deleteTransformFeedback(resources.feedback);
        if (resources.vao) gl.deleteVertexArray(resources.vao);
        if (resources.program) gl.deleteProgram(resources.program);
        for (const shader of resources.shaders) gl.deleteShader(shader);
        renderer.state.reset();
      }
    }, { requestedCount, seed, toleranceM, extraTimes, dumpPositions, progressExpression, extraHeldout });
    for(let i=0;i<result.frames.length;i++){const frame=result.frames[i];if(frame.gpuDataBase64){frame.gpuDataFile=`gpu-${i}.f32`;fs.writeFileSync(path.join(out,frame.gpuDataFile),Buffer.from(frame.gpuDataBase64,'base64'));delete frame.gpuDataBase64;}}
    const originalShaderSha256 = sha(result.originalShaderSource), feedbackShaderSha256 = sha(result.feedbackShaderSource);
    fs.writeFileSync(path.join(out, 'original-compiled-vertex.glsl'), result.originalShaderSource);
    fs.writeFileSync(path.join(out, 'feedback-compiled-vertex.glsl'), result.feedbackShaderSource);
    delete result.originalShaderSource; delete result.feedbackShaderSource;
    const postProbe = await page.evaluate(() => { const app = window.__skyriver, state = app.renderState(); app.scene.update(state.current.tick, state.current, state.alpha); return { draw: app.scene.debug(), glError: app.scene.renderer.getContext().getError(), tick: app.stats().tick }; });
    result.postProbe = postProbe;
    result.pass = result.pass && postProbe.glError === 0 && !logs.some(l => /^(error|pageerror):/.test(l));
    const report = { title: 'GPU position parity proof', url, capturedUtc: new Date().toISOString(), originalShaderSha256, feedbackShaderSha256, logs, ...result };
    fs.writeFileSync(path.join(out, 'gpu-parity.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(out, 'browser.log'), logs.join('\n') + '\n');
    const rows = result.frames.map(f => `<tr><td>${f.time.toFixed(6)}</td><td>${f.count}</td><td>${f.p50ErrorM.toFixed(6)}</td><td>${f.p95ErrorM.toFixed(6)}</td><td>${f.maxErrorM.toFixed(6)}</td><td>${f.worst.car}</td><td>${f.worst.path}</td></tr>`).join('');
    const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GPU position parity proof</title><style>body{margin:0;background:#08121e;color:#d9e7f7;font:15px/1.6 system-ui}main{max-width:1080px;margin:auto;padding:28px}p,li{color:#acc1d8}section{padding:18px;background:#112034;margin:18px 0;border-radius:12px}table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}td,th{padding:8px;text-align:left;border-bottom:1px solid #294158}.scroll,pre{overflow:auto}code,a{color:#7ad7ea}code{overflow-wrap:anywhere}.pass{color:${result.pass ? '#7cdca1' : '#ff9090'}}@media(max-width:650px){main{padding:16px}}</style><main><h1>GPU position parity proof</h1><p class="pass">${result.pass ? 'PASS' : 'FAIL'} at tolerance ${toleranceM} m. Maximum position error: ${result.maxErrorM.toFixed(6)} m.</p><p>Adapter: ${esc(result.adapter.renderer)}. Seed: ${seed}. Instances per sample: ${result.count}. Times: ${result.frames.length}. All active instance attributes match the derived CPU data exactly.</p><section><h2>Actual GPU capture</h2><p>The probe uses the compiled vertex shader from the live render program. It adds one transform feedback output. GPU feedback records <code>pos</code> before camera-facing and fade calculations. It uses the uploaded path texture, geometry attributes, and original program uniforms.</p><p>Original shader SHA-256: <code>${originalShaderSha256}</code>.</p><p>Feedback shader SHA-256: <code>${feedbackShaderSha256}</code>.</p></section><div class="scroll"><table><thead><tr><th>Time (s)</th><th>Cars</th><th>Median error (m)</th><th>P95 error (m)</th><th>Max error (m)</th><th>Worst car</th><th>Path</th></tr></thead><tbody>${rows}</tbody></table></div><section><h2>Worst sample</h2><pre>${esc(JSON.stringify(result.worst, null, 2))}</pre></section><section><h2>Limits</h2><ul>${result.limits.map(s => `<li>${esc(s)}</li>`).join('')}</ul><p>GPU errors: ${result.glErrors.length}. GL error after resource cleanup and a normal render: ${postProbe.glError}.</p></section><p><a href="gpu-parity.json">Data and held-out samples</a> · <a href="original-compiled-vertex.glsl">Original compiled shader</a> · <a href="feedback-compiled-vertex.glsl">Feedback shader</a></p></main></html>`;
    fs.writeFileSync(path.join(out, 'proof.html'), html);
    fs.rmSync(path.join(out, 'failure.json'), { force: true });
    fs.rmSync(path.join(out, 'failure.html'), { force: true });
    console.log(JSON.stringify({ proof: path.join(out, 'proof.html'), adapter: result.adapter.renderer, count: result.count, times: result.times.length, maxErrorM: result.maxErrorM, toleranceM, pass: result.pass, glErrors: result.glErrors, postProbe }, null, 2));
    if (!result.pass) process.exitCode = 2;
  } catch (error) {
    fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify({ url, error: error.stack || String(error), logs }, null, 2));
    fs.writeFileSync(path.join(out, 'failure.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><title>GPU parity probe failed</title><body><h1>GPU parity probe failed</h1><p>No parity pass is reported.</p><pre>${esc(error.stack || String(error))}</pre><pre>${esc(logs.join('\n'))}</pre></body></html>`);
    throw error;
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
