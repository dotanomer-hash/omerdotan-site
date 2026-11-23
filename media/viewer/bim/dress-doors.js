// LOCAL ONLY (2026-11-12 night run): METAL DOORS, HANDLES IN ANOTHER COLOUR (his words "the doors need to be real metal, the
// handles in different colors"). Called by dress-plan.js after tm-look has made its door copies.
//  - THE LEAF AND THE FRAME: tm-look's door copies (tm:Doors:tm-door-o / tm-doorframe-o) were metal 0 - the baked light has no
//    reflections, so a metal drew dark. Here they keep their baked light AND get a reflection of the scene's sky: metalness
//    and roughness from the plan, the environment at full strength. Locked like the glass (the viewer's own loop re-sets
//    material values every 2.5 s - a tug of war would flicker).
//  - THE HANDLE: the door families carry no Revit material, so the handle is found by SHAPE: a separate piece of the door at
//    hand height (0.8 - 1.25 m above the floor), less than 15 cm tall, a small part of the door's triangles. It becomes a copy
//    on top in the plan's handle material, carrying the door's baked light.
(function () {
  'use strict';
  window.__dressDoors = function (PLAN) {
    var WM = window.WM, THREE = WM.THREE, P = PLAN.doors, out = { doors: 0, handles: 0, locked: [] }; if (!P) return out;
    var D = WM.pack.meshes.get('Doors'); if (!D) return out;
    var pos = D.geometry.getAttribute('position'), idx = D.geometry.getIndex(), col = D.geometry.getAttribute('color');
    function lock(m, vals) { if (!m || m.userData.metalLock) return; Object.keys(vals).forEach(function (k) {
      Object.defineProperty(m, k, { get: function () { return vals[k]; }, set: function () {}, configurable: true }); }); m.userData.metalLock = true; m.needsUpdate = true; }
    Object.keys(window.__tmOverlays || {}).forEach(function (k) { var o = window.__tmOverlays[k];
      if (/:Doors:tm-door-o$/.test(k)) { lock(o.material, { metalness: P.leafMetal, roughness: P.leafRough, envMapIntensity: P.env }); out.locked.push(k); }
      if (/:Doors:tm-doorframe-o$/.test(k)) { lock(o.material, { metalness: P.frameMetal, roughness: P.frameRough, envMapIntensity: P.env }); out.locked.push(k); } });
    var tris = [];
    WM.pack.elements.forEach(function (el) {
      if (el.cat !== 'Doors' || String(el.level || '').indexOf(PLAN.level) < 0) return; out.doors++;
      var t0 = el.triStart, n = el.triCount, parent = new Int32Array(n), vert = {}, i, k;
      for (i = 0; i < n; i++) parent[i] = i;
      function find(a) { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; }
      for (i = 0; i < n; i++) for (k = 0; k < 3; k++) { var v = idx.getX((t0 + i) * 3 + k), p = vert[v]; if (p === undefined) vert[v] = i; else { var ra = find(i), rb = find(p); if (ra !== rb) parent[ra] = rb; } }
      var g = {};
      for (i = 0; i < n; i++) { var r = find(i), o = g[r] || (g[r] = { t: [], lo: [1e9, 1e9, 1e9], hi: [-1e9, -1e9, -1e9] }); o.t.push(t0 + i);
        for (k = 0; k < 3; k++) { var vi = idx.getX((t0 + i) * 3 + k), q = [pos.getX(vi), pos.getY(vi), pos.getZ(vi)]; for (var a = 0; a < 3; a++) { if (q[a] < o.lo[a]) o.lo[a] = q[a]; if (q[a] > o.hi[a]) o.hi[a] = q[a]; } } }
      var floor = el.bbox.min[1];
      Object.keys(g).forEach(function (r) { var o = g[r], h = o.hi[1] - o.lo[1], cy = (o.lo[1] + o.hi[1]) / 2 - floor, w = Math.max(o.hi[0] - o.lo[0], o.hi[2] - o.lo[2]);
        if (h < 0.15 && cy > 0.8 && cy < 1.25 && w < 1.0 && o.t.length < 0.25 * n) { Array.prototype.push.apply(tris, o.t); out.handles++; } });
    });
    if (tris.length) {
      var Pp = new Float32Array(tris.length * 9), C = col ? new Float32Array(tris.length * 9) : null;
      for (var i2 = 0; i2 < tris.length; i2++) for (var k2 = 0; k2 < 3; k2++) { var vi2 = idx.getX(tris[i2] * 3 + k2);
        Pp[i2 * 9 + k2 * 3] = pos.getX(vi2); Pp[i2 * 9 + k2 * 3 + 1] = pos.getY(vi2); Pp[i2 * 9 + k2 * 3 + 2] = pos.getZ(vi2);
        if (C) { C[i2 * 9 + k2 * 3] = col.getX(vi2); C[i2 * 9 + k2 * 3 + 1] = col.getY(vi2); C[i2 * 9 + k2 * 3 + 2] = col.getZ(vi2); } }
      var gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(Pp, 3)); if (C) gg.setAttribute('color', new THREE.BufferAttribute(C, 3));
      var Z = new Float32Array(tris.length * 6); gg.setAttribute('uv1', new THREE.BufferAttribute(Z, 2)); gg.setAttribute('uv', new THREE.BufferAttribute(Z.slice(), 2)); gg.computeVertexNormals();
      var own = (Array.isArray(D.material) ? D.material : [D.material]).filter(function (m) { return m && m.lightMap; })[0];
      var m = window.WMPaint.materialFor(P.handle + '~p'); m.vertexColors = !!C; if (own) { m.lightMap = own.lightMap; m.lightMapIntensity = own.lightMapIntensity; }
      lock(m, { metalness: P.handleMetal, roughness: P.handleRough, envMapIntensity: P.env });
      m.polygonOffset = true; m.polygonOffsetFactor = 0; m.polygonOffsetUnits = -6; m.side = THREE.DoubleSide;
      var hm = new THREE.Mesh(gg, m); hm.name = 'dress-handles'; hm.userData.notPack = true; hm.userData.dressPlan = true; hm.frustumCulled = false;
      hm.matrixAutoUpdate = false; hm.matrix.copy(D.matrixWorld); WM.scene.add(hm);
    }
    // A METAL NEEDS SOMETHING TO REFLECT: the sky alone gave a flat grey. One 360-degree picture of the building's inside,
    // taken once (P.probe = where), is the reflection of every leaf, frame and handle. Taken after the dressing is in.
    setTimeout(function () {
      try {
        var R = WM.renderer, rt = new THREE.WebGLCubeRenderTarget(P.probeSize || 512, { type: THREE.HalfFloatType }), cam = new THREE.CubeCamera(0.1, 200, rt);
        cam.position.fromArray(P.probe || [-10, 575.9, -2]); WM.scene.add(cam); var xr = R.xr.enabled, gl = window.__dressLampGlints ? window.__dressLampGlints(PLAN) : null; R.xr.enabled = false; cam.update(R, WM.scene); R.xr.enabled = xr; WM.scene.remove(cam); if (gl) gl.remove(); out.glints = gl ? gl.n : 0;   /* the lamps are in the picture: a metal needs bright things to reflect */
        var pm = new THREE.PMREMGenerator(R), env = pm.fromCubemap(rt.texture).texture; pm.dispose(); window.__dressRoomEnvTex = env;   /* dress-shine.js uses the same picture */
        var ms = []; Object.keys(window.__tmOverlays || {}).forEach(function (k) { if (/:Doors:tm-door(frame)?-o$/.test(k)) ms.push(window.__tmOverlays[k].material); });
        var hh = WM.scene.getObjectByName('dress-handles'); if (hh) ms.push(hh.material);
        ms.forEach(function (m) { m.envMap = env; m.needsUpdate = true; });
        out.probe = ms.length; console.log('[dress] doors reflect the room: ' + ms.length + ' materials');
      } catch (e) { console.error('[dress] door reflection failed', e); }
    }, P.probeDelay || 6000);
    console.log('[dress] doors: ' + JSON.stringify(out));
    return out;
  };
})();
