// LOCAL ONLY (2026-11-19): A TRUE MIRROR FOR THE GLASS WALL NEAREST TO THE EYE. His words: "dir el asad - glass still flat";
// his yes to "build a true mirror for the nearest glass wall, like the floor".
// Measured before: the soft room picture (dress-shine.js) shows 2 - 3% of the room at a normal angle and has no shapes in it -
// one picture from one point cannot put a chair where its reflection belongs. The floor has a true mirror: the room drawn once
// more, seen from the eye mirrored in the floor (tm-look.js). This is the same for a standing pane:
//   1. THE GLASS WALLS are found once: every see-through triangle of the windows, the curtain panels and the door glass,
//      grouped by the plane it lies in (its direction to 1 degree, its place to 4 cm). A plane = a wall of glass.
//   2. EACH FRAME the wall nearest to the eye and in front of it is chosen (re-chosen every 10 frames), and the room is drawn
//      once more from the eye mirrored in that wall - only what is on the eye's side of the glass (the cut is the glass).
//   3. THE PANES of that wall show that picture, a little face on and most at a flat angle; the other panes keep the soft picture.
// ⛔ It costs one more draw of the whole scene per frame, like the floor. Desktop only here (never in a headset session) -
// measure it on the Quest before it is kept. plan.shine.glassMirror = { f0: share face on, k: strength, scale, maxDist };
// &glassmirror=<f0> in the address tries another share (0 = off).
(function () {
  'use strict';
  window.__glassMirrorInit = function (PLAN) {
    if (window.__glassMirror) return window.__glassMirror;
    var WM = window.WM, T = WM.THREE, R = WM.renderer, C = Object.assign({ f0: 0.08, k: 0.6, scale: 0.5, maxDist: 25, minArea: 1.5 }, (PLAN.shine && PLAN.shine.glassMirror) || {});
    var q = parseFloat((location.search.match(/[?&]glassmirror=([0-9.]+)/) || [])[1]); if (q >= 0) C.f0 = q;
    var dummy = new T.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); dummy.needsUpdate = true;
    var rt = new T.WebGLRenderTarget(16, 16, { type: T.HalfFloatType, samples: 0 });
    var U = { uGM: { value: dummy }, uGMM: { value: new T.Matrix4() }, uGMN: { value: new T.Vector3(1, 0, 0) }, uGMD: { value: 1e9 }, uGMK: { value: 0 }, uGMF: { value: C.f0 } };
    var GM = (window.__glassMirror = { U: U, rt: rt, planes: [], active: null, cfg: C, on: C.f0 > 0 && !(PLAN.shine && PLAN.shine.glassMirror === false) });
    if (!GM.on) return GM;
    // 1. the glass walls
    var by = {};
    WM.pack.meshes.forEach(function (mesh, cat) { if (!/^(Windows|Curtain[ _]Panels|Doors|Railings)$/.test(cat) || !mesh.geometry) return;
      var g = mesh.geometry, pos = g.getAttribute('position'), idx = g.getIndex(), mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]; if (!pos || !idx) return;
      (g.groups && g.groups.length ? g.groups : [{ start: 0, count: idx.count, materialIndex: 0 }]).forEach(function (gr) { var m = mats[gr.materialIndex]; if (!m || !m.transparent || !(m.opacity < 1)) return;
        for (var i = gr.start; i < gr.start + gr.count; i += 3) { var a = idx.getX(i), b = idx.getX(i + 1), c = idx.getX(i + 2);
          var ax = pos.getX(a), ay = pos.getY(a), az = pos.getZ(a), bx = pos.getX(b), by_ = pos.getY(b), bz = pos.getZ(b), cx = pos.getX(c), cy = pos.getY(c), cz = pos.getZ(c);
          var n0 = (by_ - ay) * (cz - az) - (bz - az) * (cy - ay), n1 = (bz - az) * (cx - ax) - (bx - ax) * (cz - az), n2 = (bx - ax) * (cy - ay) - (by_ - ay) * (cx - ax), ln = Math.hypot(n0, n1, n2), area = ln / 2;
          if (area < 0.02 || Math.abs(n1) / ln > 0.2) continue;                                 // a sliver, or not a standing pane
          var ang = Math.atan2(n2, n0); if (ang < 0) ang += Math.PI; var ab = Math.round(ang * 180 / Math.PI) % 180, nx = Math.cos(ab * Math.PI / 180), nz = Math.sin(ab * Math.PI / 180);
          var d = nx * (ax + bx + cx) / 3 + nz * (az + bz + cz) / 3, key = ab + ':' + Math.round(d / 0.04), p = by[key] || (by[key] = { nx: nx, nz: nz, area: 0, ds: 0, t0: 1e9, t1: -1e9, y0: 1e9, y1: -1e9 });
          p.area += area; p.ds += d * area;
          [[ax, ay, az], [bx, by_, bz], [cx, cy, cz]].forEach(function (v) { var t = -nz * v[0] + nx * v[2]; if (t < p.t0) p.t0 = t; if (t > p.t1) p.t1 = t; if (v[1] < p.y0) p.y0 = v[1]; if (v[1] > p.y1) p.y1 = v[1]; }); } }); });
    Object.keys(by).forEach(function (k) { var p = by[k]; if (p.area < C.minArea) return; p.d = p.ds / p.area; GM.planes.push(p); });
    console.log('[dress] glass mirror: ' + GM.planes.length + ' glass walls, ' + Math.round(GM.planes.reduce(function (s, p) { return s + p.area; }, 0)) + ' m2');
    if (!GM.planes.length) { GM.on = false; return GM; }
    // THE SHINE (his words 2026-11-19: "glass is reflecting but not shining like the floor"). Measured: the glass's mirror picture is
    // half as bright as the floor's (it looks sideways at walls, the floor's looks up at the lit ceiling) and its brightest spot is
    // 1.4 - at the 5 - 7% a pane shows face on, nothing in it can shine. A lamp is far brighter than a wall: while the mirror is
    // drawn, a bright disc hangs at every lamp of the bake (the same discs the metals' room picture takes); never in the view itself.
    var GL = C.glint !== 0 && window.__dressLampGlints ? window.__dressLampGlints(PLAN) : null; if (GL) GL.group.visible = false; GM.glints = GL ? GL.n : 0;
    // 2. the mirror of the nearest wall, drawn before the frame (an invisible helper, drawn first, right after the floor's)
    var vcam = new T.PerspectiveCamera(), N = new T.Vector3(), P0 = new T.Vector3(), cp = new T.Vector3(), view = new T.Vector3(), look = new T.Vector3(), tgt = new T.Vector3(), rot = new T.Matrix4(),
      plane = new T.Plane(), clip = new T.Vector4(), qv = new T.Vector4(), sz = new T.Vector2(), fwd = new T.Vector3(), busy = false, frame = 0;
    function choose(c, f) { var best = null, bd = C.maxDist; GM.planes.forEach(function (p) { var s = p.nx * c.x + p.nz * c.z - p.d; if (Math.abs(s) < 0.06) return;
      var t = -p.nz * c.x + p.nx * c.z, tt = Math.min(p.t1, Math.max(p.t0, t)), yy = Math.min(p.y1, Math.max(p.y0, c.y)), sg = s > 0 ? 1 : -1;
      var px = p.nx * p.d - p.nz * tt, pz = p.nz * p.d + p.nx * tt, dx = px - c.x, dy = yy - c.y, dz = pz - c.z, dist = Math.hypot(dx, dy, dz);
      if (dist >= bd || (dx * f.x + dy * f.y + dz * f.z) / dist < -0.25) return;                // too far, or behind the eye
      bd = dist; best = { p: p, sg: sg }; }); return best; }
    var helper = new T.Mesh(new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(new Float32Array(9), 3)), new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false }));
    helper.frustumCulled = false; helper.renderOrder = -1e6 + 1; helper.name = 'dress-glass-mirror'; helper.userData.notPack = true;
    helper.onBeforeRender = function (renderer, scene, camera) {
      if (busy || renderer.xr.isPresenting || camera !== WM.camera) return;                    // not inside another mirror's own draw, not in a headset
      cp.setFromMatrixPosition(camera.matrixWorld); rot.extractRotation(camera.matrixWorld); fwd.set(0, 0, -1).applyMatrix4(rot);
      if ((frame++ % 10) === 0 || !GM.active) GM.active = choose(cp, fwd);
      var A = GM.active; if (!A) { U.uGMK.value = 0; return; }
      N.set(A.p.nx * A.sg, 0, A.p.nz * A.sg); var D = A.p.d * A.sg; P0.copy(N).multiplyScalar(D);                 // the wall's plane, its normal toward the eye
      var s = N.dot(cp) - D; if (s < 0.05) { GM.active = null; U.uGMK.value = 0; return; }
      renderer.getDrawingBufferSize(sz); var w = Math.max(16, Math.round(sz.x * C.scale)), h = Math.max(16, Math.round(sz.y * C.scale)); if (rt.width !== w || rt.height !== h) rt.setSize(w, h);
      view.copy(cp).addScaledVector(N, -2 * s);                                                                  // the eye mirrored in the glass
      look.set(0, 0, -1).applyMatrix4(rot).add(cp); tgt.copy(look).addScaledVector(N, -2 * (N.dot(look) - D));
      vcam.position.copy(view); vcam.up.set(0, 1, 0).applyMatrix4(rot); vcam.up.addScaledVector(N, -2 * N.dot(vcam.up)); vcam.lookAt(tgt); vcam.far = camera.far; vcam.near = camera.near;
      vcam.updateMatrixWorld(); vcam.projectionMatrix.copy(camera.projectionMatrix);
      U.uGMM.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(vcam.projectionMatrix).multiply(vcam.matrixWorldInverse);
      plane.setFromNormalAndCoplanarPoint(N, P0).applyMatrix4(vcam.matrixWorldInverse); clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
      var e = vcam.projectionMatrix.elements; qv.x = (Math.sign(clip.x) + e[8]) / e[0]; qv.y = (Math.sign(clip.y) + e[9]) / e[5]; qv.z = -1; qv.w = (1 + e[10]) / e[14];
      clip.multiplyScalar(2 / clip.dot(qv)); e[2] = clip.x; e[6] = clip.y; e[10] = clip.z + 1 - 0.003; e[14] = clip.w; vcam.projectionMatrixInverse.copy(vcam.projectionMatrix).invert();
      // while the mirror is drawn the panes read nothing (a picture cannot be drawn into and read at once), and the floor's mirror waits
      busy = true; window.__glassMirrorBusy = true; U.uGM.value = dummy; U.uGMK.value = 0; if (GL) GL.group.visible = true;
      var prevRT = renderer.getRenderTarget(), prevSM = renderer.shadowMap.autoUpdate, vp = camera.viewport; renderer.shadowMap.autoUpdate = false; renderer.setRenderTarget(rt); renderer.state.buffers.depth.setMask(true);
      if (renderer.autoClear === false) renderer.clear();
      try { renderer.render(scene, vcam); } finally { renderer.shadowMap.autoUpdate = prevSM; renderer.setRenderTarget(prevRT); if (vp) renderer.state.viewport(vp); busy = false; window.__glassMirrorBusy = false; if (GL) GL.group.visible = false; }
      U.uGM.value = rt.texture; U.uGMN.value.copy(N); U.uGMD.value = D; U.uGMK.value = C.k; U.uGMF.value = C.f0;
    };
    WM.scene.add(helper); GM.helper = helper;
    return GM;
  };
})();
