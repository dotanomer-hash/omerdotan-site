// LOCAL ONLY (2026-11-10, the night test images 04-06): ?tm=1 puts TWINMOTION'S MATERIALS - the exact ones our path
// tracer used for the truth pictures - on the viewer, through the viewer's OWN paint system (catalog entries +
// WM.applyOp material.set). So they sit over the baked light and swap like any other material. Never geometry.
//   The textures and the scene file come from pt.html ?scenefile=1 (bakelib/tm/, local only).
//   Which element gets which = the MAJORITY material of its triangles in that scene file (per element, not per face yet).
(function () {
  'use strict';
  if (!/[?&]tm=1/.test(location.search)) {
    // THE FLOOR MIRROR WITHOUT TWINMOTION (2026-11-24, the apartment building: his "the floor shining has the same defect as
    // Dir El Asad"): measured - the mirror only ever started inside tm=1&tmall=1, so on any other building a floor finish with
    // `mirror` in its plan never reflected anything. ?floorrefl=<k> alone now starts it, as soon as the pack's floors are in -
    // BEFORE the dressing lays its floor finishes, so dress-floors.js finds window.__blMirror and patches them.
    if (/[?&]floorrefl=[0-9.]+/.test(location.search)) (function waitFloors(n) {
      if (window.WM && window.WM.pack && window.WM.pack.meshes && window.WM.pack.meshes.get('Floors')) return mirror();
      if (n < 600) setTimeout(function () { waitFloors(n + 1); }, 100);
    })(0);
    return;
  }
  var T = '../bim/bakelib/tm/';                         // relative to the catalogue's own folder (../Library/)
  function e(id, en, color, maps, scaleM, rough, metal) {
    return { id: id, name: en, nameEn: en, color: color, maps: maps || {}, scaleM: scaleM, rough: rough, metal: metal || 0, finish: 'matte', tags: ['tm'] };
  }
  window.TM_ENTRIES = [
    e('tm-stone', 'TM Stone', '#ffffff', { albedo: T + 'pt_scene_stone_map.png' }, [1.265, 1.5], 0.85),
    e('tm-floor', 'TM Floor 120', '#ffffff', { albedo: T + 'pt_scene_floor_map.png' }, 6, 0.75),
    e('tm-floor60', 'TM Floor 60', '#ffffff', { albedo: T + 'pt_scene_floor_map.png' }, 3, 0.75),
    e('tm-access', 'TM Guidance strip', '#89743e', null, 1, 0.6),
    e('tm-lamella', 'TM Lamella', '#ffffff', { albedo: T + 'pt_scene_lamella_map.png' }, [2.23, 2.23 / 2.247983870967742], 0.55),
    e('tm-paint', 'TM Paint', '#ffffff', { albedo: T + 'pt_scene_wall_map.png', normal: T + 'pt_scene_wall_normal.png', rough: T + 'pt_scene_wall_rough.png' }, 1, 1),
    e('tm-ceiling', 'TM Ceiling 60/60', '#ffffff', { albedo: T + 'pt_scene_ceiling_map.png', normal: T + 'pt_scene_ceiling_normal.png', rough: T + 'pt_scene_ceiling_rough.png' }, 2, 1),
    e('tm-gypsum', 'TM Gypsum ceiling', '#f4f2ee', null, 1, 0.9),
    e('tm-door', 'TM Door (white aluminium)', '#ebeae6', null, 1, 0.35, 0.25),
    e('tm-doorframe', 'TM Door frame', '#8e9194', null, 1, 0.4, 0.55),
    e('tm-wood', 'TM Wood', '#ffffff', { albedo: T + 'pt_scene_wood_map.png', normal: T + 'pt_scene_wood_normal.png', rough: T + 'pt_scene_wood_rough.png' }, 0.6, 1),
    e('tm-steel', 'TM Steel', '#8a8d90', null, 1, 0.35, 0.8)
  ];
  // JOB 1 (?tmall=1, 2026-11-10): the WHOLE building, every triangle by pt.html's rule (bakelib/tm/bl_keys.json, made by
  // bl_bake.py). Objects (the per-vertex light) get their OWN copy of each entry ('-o'): the paint system keeps one material
  // per id, and a wall (atlas light) and a sink (vertex light) sharing one would overwrite each other's light.
  var TMALL = /[?&]tmall=1/.test(location.search);
  if (TMALL) window.TM_ENTRIES.slice().forEach(function (x) { var y = JSON.parse(JSON.stringify(x)); y.id += '-o'; y.name += ' (object)'; y.nameEn = y.name;
    y.metal = 0;      // the baked light has no reflections, so a metal (door frame 0.55, steel 0.8) would lose that share and draw near black
    window.TM_ENTRIES.push(y); });
  var KEY2ID = { stone: 'tm-stone', floor: 'tm-floor', floor60: 'tm-floor60', access: 'tm-access', lamella: 'tm-lamella',
    wall: 'tm-paint', slabside: 'tm-paint', ceiling: 'tm-ceiling', gypsum: 'tm-gypsum', door: 'tm-door', doorframe: 'tm-doorframe', wood: 'tm-wood', steel: 'tm-steel' };
  // the big object categories are painted per ELEMENT through the viewer's own paint (WM.applyOp) - a copy of 700k
  // furniture triangles would double the headset's load. Everything else: the exact triangles, as a copy on top.
  var BY_ELEMENT = { 'Furniture': 1, 'Plumbing Fixtures': 1, 'Specialty Equipment': 1, 'Generic Models': 1 };
  // THE COPY ON TOP, made here (not WM.paintTriangles): positions AND the lightmap layout (uv1), so the baked light reads
  // on it; it wins the depth test by a constant offset (units only - the slope factor is banned, rule never-touch-geometry).
  // The pack's own geometry is never changed: this is a separate mesh made from copies of its triangles.
  var OV = {};
  function overlay(mesh, tris, material, key) {
    var THREE = window.WM.THREE, g0 = mesh.geometry, pos = g0.getAttribute('position'), uv1 = g0.getAttribute('uv1') || g0.getAttribute('uv2'), idx = g0.getIndex();
    var col = TMALL ? g0.getAttribute('color') : null;           // the baked per-vertex light (vlm), copied with its vertex
    var P = new Float32Array(tris.length * 9), U = uv1 ? new Float32Array(tris.length * 6) : null, Cc = col ? new Uint8Array(tris.length * 9) : null;
    for (var i = 0; i < tris.length; i++) for (var k = 0; k < 3; k++) {
      var vi = idx ? idx.getX(tris[i] * 3 + k) : tris[i] * 3 + k;
      P[i * 9 + k * 3] = pos.getX(vi); P[i * 9 + k * 3 + 1] = pos.getY(vi); P[i * 9 + k * 3 + 2] = pos.getZ(vi);
      if (U) { U[i * 6 + k * 2] = uv1.getX(vi); U[i * 6 + k * 2 + 1] = uv1.getY(vi); }
      if (Cc) { Cc[i * 9 + k * 3] = col.array[vi * 3]; Cc[i * 9 + k * 3 + 1] = col.array[vi * 3 + 1]; Cc[i * 9 + k * 3 + 2] = col.array[vi * 3 + 2]; }
    }
    var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    if (U) { g.setAttribute('uv1', new THREE.BufferAttribute(U, 2)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2)); }
    if (Cc) { g.setAttribute('color', new THREE.BufferAttribute(Cc, 3, true)); material.vertexColors = true; }
    // ⭐ THE ORDER OF THE COPIES (his words 2026-11-11 "the first door ... to the 139 have flickering floor"): a wall's bottom face lies
    // exactly at floor height in that doorway, and every copy used to sit at the SAME -4 units, so the wall paint and the floor
    // tile took turns. Each copy now follows the viewer's own depth ladder (Floors 0 ... Walls 3, Curtain Panels 4): -4 + rung.
    // Units only - the slope factor is banned.
    var RUNG = { 'Floors': 0, 'Stairs': 0, 'Doors': 1, 'Windows': 1, 'Curtain Wall Mullions': 1, 'Railings': 1, 'Ceilings': 2, 'Walls': 3, 'Structural Columns': 3, 'Structural Framing': 3, 'Curtain Panels': 4 };
    var rung = RUNG[(mesh.name || '').replace(/_/g, ' ')]; if (rung == null) rung = 2;
    material.polygonOffset = true; material.polygonOffsetFactor = 0; material.polygonOffsetUnits = -4 + rung;
    var o = new THREE.Mesh(g, material); o.matrixAutoUpdate = false; o.matrix.copy(mesh.matrixWorld); o.name = key; o.userData.tmLook = true; o.frustumCulled = false;
    window.WM.scene.add(o); OV[key] = o;
  }
  window.__tmOverlays = OV;
  // the ceilings GLOW in the truth (emissive 0.25, the lamella 0.06): the bake carries the light they throw, not their
  // own glow, so the glow goes on the material. The viewer tones x exposure / 0.6 where the truth tones x 1.
  var GLOWKEY = { 'tm-ceiling': 'ceiling', 'tm-gypsum': 'gypsum', 'tm-lamella': 'lamella' };
  function glow(m, id, S) {
    var k = GLOWKEY[id.replace(/-o$/, '')]; if (!k || !m.emissive) return; var sm = S.materials[k];
    m.emissive.set(sm.emissive); m.emissiveIntensity = sm.emissiveIntensity * 0.6 / (window.WM.renderer.toneMappingExposure || 1); m.needsUpdate = true;
  }
  // ⭐ THE GLASS AS IN CANDIDATE E (his rule 2026-11-11, "most important"). Windows + Curtain Panels carry E's own baked
  // light (bl_encode copies E's vlm files). The DOOR glass in E ignores the baked light (E's flags rtobj/objwhite), measured
  // there: vertexColors off, envMapIntensity 1, roughness 0.75, metalness 0. Kept in force every 2 s - the viewer's own
  // material loop re-sets reflections on a 2.5 s timer.
  function glassAsE() {
    var D = window.WM.pack && window.WM.pack.meshes.get('Doors'); if (!D) return;
    (Array.isArray(D.material) ? D.material : [D.material]).forEach(function (m) {
      if (!m || !m.transparent || m.userData.glassE) return;
      // LOCKED, not re-set: the viewer's own loop writes these every 2.5 s, and a tug of war would make the glass flicker.
      // E's measured values; lightMapIntensity 0 = no baked light on the door glass, only its reflection.
      var E = { vertexColors: false, envMapIntensity: 1, roughness: 0.75, metalness: 0, lightMapIntensity: 0 };
      Object.keys(E).forEach(function (k) { Object.defineProperty(m, k, { get: function () { return E[k]; }, set: function () {}, configurable: true }); });
      m.userData.glassE = true; m.needsUpdate = true;
    });
  }
  // THE LAMPS (job 1): the 8 cm glowing disc under every ceiling lamp the bake used (bakelib/tm/bl_lights.json). One mesh,
  // NOT pack geometry - dressing, like the plants. Glow 8 in the truth; the viewer tones x exposure / 0.6.
  function lamps() {
    var WM = window.WM, THREE = WM.THREE;
    fetch('bakelib/tm/bl_lights.json?v=' + Date.now()).then(function (r) { return r.json(); }).then(function (L) {
      var N = 24, R = L.disc.radius_m, P = [];
      L.lamps.forEach(function (l) {
        var x = l.pos[0], y = l.ceil_y - L.drop_disc_m, z = l.pos[2];
        for (var k = 0; k < N; k++) { var a0 = 2 * Math.PI * k / N, a1 = 2 * Math.PI * (k + 1) / N;
          P.push(x, y, z, x + R * Math.cos(a1), y, z + R * Math.sin(a1), x + R * Math.cos(a0), y, z + R * Math.sin(a0)); }
      });
      var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3));
      var c = new THREE.Color(L.disc.emissive).multiplyScalar(L.disc.emissiveIntensity * 0.6 / (WM.renderer.toneMappingExposure || 1));
      var m = new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide });
      var o = new THREE.Mesh(g, m); o.name = 'bl-lamp-discs'; o.userData.notPack = true; o.frustumCulled = false; WM.scene.add(o);
      console.log('[tm] ' + L.lamps.length + ' lamp discs');
    });
  }
  // THE FLOOR MIRROR (job 1, ?floorrefl=<strength>, 1 = the truth's tiles): the scene drawn once more, mirrored in the
  // floor you stand on, into a texture the floor finishes read - by viewing angle (Fresnel, tiles F0 0.04) and softened
  // (the tiles are not a polished mirror). The same maths as three.js's Reflector (oblique near plane = nothing under the
  // floor shows), driven by an invisible helper drawn first, so it runs once per eye in a headset too.
  // ⛔ It costs one more draw of the whole scene per frame (per eye) - measure it on the Quest before it is kept.
  var MIR = null;
  function mirror() {
    var K = parseFloat((location.search.match(/[?&]floorrefl=([0-9.]+)/) || [])[1]); if (!(K > 0)) return;
    var WM = window.WM, THREE = WM.THREE, R = WM.renderer, SCALE = parseFloat((location.search.match(/[?&]floorres=([0-9.]+)/) || [])[1]) || 0.5;
    var rt = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, samples: 0 });
    var U = { uMir: { value: rt.texture }, uMirM: { value: new THREE.Matrix4() }, uMirY: { value: -1e9 }, uMirK: { value: K } };
    var vcam = new THREE.PerspectiveCamera(), n = new THREE.Vector3(0, 1, 0), P0 = new THREE.Vector3(), cp = new THREE.Vector3(), view = new THREE.Vector3(),
      look = new THREE.Vector3(), tgt = new THREE.Vector3(), rot = new THREE.Matrix4(), plane = new THREE.Plane(), clip = new THREE.Vector4(), q = new THREE.Vector4(),
      sz = new THREE.Vector2(), busy = false, ray = new THREE.Raycaster(), frame = 0;
    var floors = WM.pack.meshes.get('Floors');
    function floorY(camPos) {                                     // the floor you stand on: the first floor face under the eye
      ray.set(camPos, new THREE.Vector3(0, -1, 0)); ray.far = 3.0; var h = floors ? ray.intersectObject(floors, false) : [];
      return h.length ? h[0].point.y : U.uMirY.value;
    }
    var helper = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3)),
      new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false }));
    helper.frustumCulled = false; helper.renderOrder = -1e6; helper.name = 'bl-floor-mirror'; helper.userData.notPack = true;
    helper.onBeforeRender = function (renderer, scene, camera) {
      if (busy || window.__glassMirrorBusy) return;          // not inside the glass wall's own mirror draw (dress-glass.js)
      if ((frame++ % 15) === 0) U.uMirY.value = floorY(cp.setFromMatrixPosition(camera.matrixWorld));
      var Y = U.uMirY.value; if (Y < -1e8) return;
      P0.set(0, Y, 0); cp.setFromMatrixPosition(camera.matrixWorld);
      if (cp.y <= Y) return;                                      // under the floor: no reflection
      renderer.getDrawingBufferSize(sz); var vp = camera.viewport, w = Math.max(16, Math.round((vp ? vp.z : sz.x) * SCALE)), h = Math.max(16, Math.round((vp ? vp.w : sz.y) * SCALE));
      if (rt.width !== w || rt.height !== h) rt.setSize(w, h);
      view.set(cp.x, 2 * Y - cp.y, cp.z);                     // the eye mirrored in the floor
      rot.extractRotation(camera.matrixWorld); look.set(0, 0, -1).applyMatrix4(rot).add(cp); tgt.copy(look); tgt.y = 2 * Y - look.y;
      vcam.position.copy(view); vcam.up.set(0, 1, 0).applyMatrix4(rot); vcam.up.y = -vcam.up.y; vcam.lookAt(tgt); vcam.far = camera.far; vcam.near = camera.near;
      vcam.updateMatrixWorld(); vcam.projectionMatrix.copy(camera.projectionMatrix);
      U.uMirM.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(vcam.projectionMatrix).multiply(vcam.matrixWorldInverse);
      plane.setFromNormalAndCoplanarPoint(n, P0.set(0, Y + 0.012, 0))   /* the cut is 12 mm above the floor: a floor face drawn the wrong way round, or a finish layer 4 mm up, is cut away too */.applyMatrix4(vcam.matrixWorldInverse); clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
      var e = vcam.projectionMatrix.elements;
      q.x = (Math.sign(clip.x) + e[8]) / e[0]; q.y = (Math.sign(clip.y) + e[9]) / e[5]; q.z = -1; q.w = (1 + e[10]) / e[14];
      clip.multiplyScalar(2 / clip.dot(q)); e[2] = clip.x; e[6] = clip.y; e[10] = clip.z + 1 - 0.003; e[14] = clip.w;
      vcam.projectionMatrixInverse.copy(vcam.projectionMatrix).invert();
      busy = true; var prevRT = renderer.getRenderTarget(), prevXR = renderer.xr.enabled, prevSM = renderer.shadowMap.autoUpdate;
      renderer.xr.enabled = false; renderer.shadowMap.autoUpdate = false; renderer.setRenderTarget(rt); renderer.state.buffers.depth.setMask(true);
      if (renderer.autoClear === false) renderer.clear();
      // 2026-11-19 (his clip: the tiles reflected only after Remove took the model's floor): the model's floor is drawn on BOTH
      // sides, so the eye under the floor saw the floor's own top face from below and it covered the whole reflection (measured:
      // one-sided floor = the reflection is back). For this one draw the model's floors show their front side only.
      var fmat = [], fside = []; (floors ? (Array.isArray(floors.material) ? floors.material : [floors.material]) : []).forEach(function (m) { if (m && fmat.indexOf(m) < 0) { fmat.push(m); fside.push(m.side); m.side = THREE.FrontSide; } });
      renderer.render(scene, vcam);
      fmat.forEach(function (m, i) { m.side = fside[i]; });
      renderer.xr.enabled = prevXR; renderer.shadowMap.autoUpdate = prevSM; renderer.setRenderTarget(prevRT);
      if (vp) renderer.state.viewport(vp);
      busy = false;
    };
    WM.scene.add(helper);
    MIR = { U: U, rt: rt, helper: helper, patch: function (m, k) {      /* k = this finish's share of the mirror (1 = the tile; a matte parquet takes less) */
      var kk = (k == null ? 1 : +k).toFixed(2);
      if (!m || m.userData.blMirror) return; m.userData.blMirror = true;
      var prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
      m.onBeforeCompile = function (sh, r) {
        if (prev) prev.call(this, sh, r);
        Object.assign(sh.uniforms, U);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMirW;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMirW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vMirW; uniform sampler2D uMir; uniform mat4 uMirM; uniform float uMirY; uniform float uMirK;')
          .replace('#include <opaque_fragment>', [
            'if (abs(vMirW.y - uMirY) < 0.05) {',
            '  vec4 mp = uMirM * vec4(vMirW, 1.0); vec2 mu = mp.xy / mp.w; vec3 mc = vec3(0.0); float o = 0.006;',
            '  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) mc += texture2D(uMir, mu + vec2(float(i), float(j)) * o).rgb;',
            '  mc /= 9.0;',
            '  float ct = clamp(normalize(cameraPosition - vMirW).y, 0.0, 1.0); float F = (0.04 + 0.96 * pow(1.0 - ct, 5.0)) * uMirK * ' + kk + ';',
            '  outgoingLight = mix(outgoingLight, mc, clamp(F, 0.0, 1.0));',
            '}',
            '#include <opaque_fragment>'].join('\n'));
      };
      m.customProgramCacheKey = function () { return (prevKey ? prevKey.call(this) : '') + 'blmir' + kk; };
      m.needsUpdate = true;
    } };
    window.__blMirror = MIR;
    console.log('[tm] floor mirror on, strength ' + K + ', resolution x' + SCALE);
  }
  // per element: the key most of its triangles carry -> the viewer's own paint (swappable like any other finish)
  var ELS = null;
  function byElement(cat, a, KEYS) {
    var run = function (E) {
      var groups = {}, n = 0;
      E.forEach(function (el) {
        if (el.mesh !== cat) return; var cnt = {};
        for (var t = el.triStart; t < el.triStart + el.triCount; t++) if (a[t] >= 0) cnt[a[t]] = (cnt[a[t]] || 0) + 1;
        var best = -1, bn = 0; Object.keys(cnt).forEach(function (k) { if (cnt[k] > bn) { bn = cnt[k]; best = +k; } });
        var id = best >= 0 ? KEY2ID[KEYS[best]] : null; if (!id) return; id += '-o';
        (groups[id] = groups[id] || []).push(el.id); n++;
      });
      Object.keys(groups).forEach(function (id) { window.WM.applyOp({ type: 'material.set', elementIds: groups[id], materialId: id }); });
      console.log('[tm] ' + cat + ': ' + n + ' elements painted per element ' + JSON.stringify(Object.keys(groups).map(function (k) { return k + ' ' + groups[k].length; })));
    };
    if (ELS) return run(ELS);
    var pk = (location.search.match(/[?&]pack=([^&]+)/) || [])[1] || 'MKD_AR_ARM_M3_R24_16_-_no_Topo_PL';
    fetch('../Packs/' + decodeURIComponent(pk) + '/elements.json').then(function (r) { return r.json(); }).then(function (j) { ELS = j.elements || j; run(ELS); });
  }
  function go() {
    var WM = window.WM;
    fetch('bakelib/tm/pt_scene.json?v=' + Date.now()).then(function (r) { return r.json(); }).then(function (S) {
      if (!TMALL) return S;
      return fetch('bakelib/tm/bl_keys.json?v=' + Date.now()).then(function (r) { return r.json(); }).then(function (K) { S.triangles = K.triangles; return S; });
    }).then(function (S) {
      if (TMALL) { lamps(); mirror(); glassAsE(); setInterval(glassAsE, 2000); }
      var keyAt = {};                                    // mesh -> Int8Array of key index per triangle (-1 = not in the tracer's scene)
      var KEYS = Object.keys(S.materials);
      Object.keys(S.triangles).forEach(function (mesh) {
        var runs = S.triangles[mesh], n = 0; runs.forEach(function (r) { n = Math.max(n, r[0] + r[1]); });
        var a = new Int8Array(n).fill(-1); runs.forEach(function (r) { var k = KEYS.indexOf(r[2]); for (var t = r[0]; t < r[0] + r[1]; t++) a[t] = k; }); keyAt[mesh] = a;
      });
      // EXACTLY the tracer's triangles: per pack mesh, per material key, the list of triangles -> WM.paintTriangles (the
      // engine's own per-triangle paint, the one 'One face' uses) with the paint system's own material for that entry
      var done = [], painted = 0;
      Object.keys(keyAt).forEach(function (mname) {
        var mesh = WM.pack.meshes.get(mname) || WM.pack.meshes.get(mname.replace(/_/g, ' ')); if (!mesh) return;
        // the baked light lives in uv1 on the SHELL meshes only; doors keep the viewer's own white-object look (env, no lightmap)
        var own = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).filter(function (m) { return m && m.lightMap; })[0];
        var isDoor = /^Doors$/.test(mesh.name || mname) || mname === 'Doors';
        if (!own && !isDoor) return;                                         // objects without the lightmap layout: left as the viewer has them
        var a = keyAt[mname], lists = {}, vtx = TMALL && !!mesh.geometry.getAttribute('color'), cat = mname.replace(/_/g, ' ');
        if (TMALL && BY_ELEMENT[cat]) { byElement(cat, a, KEYS); return; }
        for (var t = 0; t < a.length; t++) { if (a[t] < 0) continue; var id = KEY2ID[KEYS[a[t]]]; if (id) { if (vtx) id += '-o'; (lists[id] = lists[id] || []).push(t); } }
        Object.keys(lists).forEach(function (id) {
          var m = window.WMPaint.materialFor(id);
          if (own && (TMALL || !/^tm-door/.test(id))) { m.lightMap = own.lightMap; m.lightMapIntensity = own.lightMapIntensity;   // the SAME baked light as the surface it covers
            m.envMapIntensity = own.envMapIntensity; if ('specularIntensity' in m) m.specularIntensity = 0; m.needsUpdate = true; }
          if (TMALL) glow(m, id, S);
          if (MIR && /^tm-(floor|floor60|access)$/.test(id)) MIR.patch(m);
          overlay(mesh, lists[id], m, 'tm:' + mname + ':' + id);
          painted += lists[id].length; done.push(mname + '/' + id + ' ' + lists[id].length);
        });
      });
      window.__tmLook = { painted: painted, groups: done };
      console.log('[tm] painted ' + painted + ' triangles: ' + window.__tmLook.groups.join(', '));
    }).catch(function (err) { console.error('[tm] failed', err); });
  }
  // after the viewer's own autopaint (it runs once the catalogue is in): wait for the pack, the catalogue, then 3 s
  var tries = 0;
  (function wait() {
    var ok = window.WM && window.WM.pack && window.WMPaint && window.WMPaint.entries && window.WMPaint.entries().length;
    if (ok && TMALL) { var D = window.WM.pack.meshes.get('Doors'); if (!(D && D.geometry.getAttribute('color')) && tries++ < 300) return setTimeout(wait, 200); }   // the vlm loads after the lightmap
    // a page behind a loading screen (2026-11-24): the viewer's own autopaint is SEEN to be over (the walls carry its assignment),
    // then 300 ms - instead of 3 s on trust
    var FASTP = !!(window.__siteStart && window.__siteStart.waitDress);
    if (ok && FASTP) { var Wl = window.WM.pack.meshes.get('Walls'); if (!(Wl && Wl.userData.assign && Wl.userData.assign.size) && tries++ < 300) return setTimeout(wait, 200); return setTimeout(go, 300); }
    if (ok) return setTimeout(go, 3000);
    if (++tries < 300) setTimeout(wait, 200);
  })();
})();
