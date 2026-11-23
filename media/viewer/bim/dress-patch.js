// LOCAL ONLY (night 2026-11-13): A MISSING PIECE OF THE BIM MODEL, CLOSED SO IT IS NOT SEEN AS A PATCH. Called by dress-plan.js.
// His words: "there is a hole in the ceiling near one of the columns ... i want to see if and how you can fix a missing bim
// part. try it to be unseen as a patch."
// MEASURED (night_tests/nceil.eval.js + nhole.eval.js): the gypsum ceiling by the column at the west tip of the patio has a
// cut-out for the wooden lamella panel, and the cut-out is 0.8 x 0.52 m LARGER than the panel at one end: through that
// rectangle one sees the slab and the roof above. A modelling slip, not a design.
// HOW IT IS CLOSED (never the pack's geometry - a separate mesh):
//   1. the plan gives only a point near the hole. The machinery finds the ceiling element whose own outline surrounds it:
//      the free edges of its bottom face, chained into a loop.
//   2. the whole loop is filled with new triangles made from the loop's OWN corners - so each corner keeps its own place in
//      the baked light map, and the light on the new piece is the light the bake already holds there.
//   3. the new piece lies HALF A MILLIMETRE above the ceiling's bottom face (at 2 mm a hairline of the cut-out's own side
//      showed along the rim in a close picture; half a millimetre is still real depth up to about 35 m away). Where the lamella panel covers the cut-out the piece is
//      inside the panel and never seen; it shows only where nothing was.
//   4. it takes the very material object the ceiling around it is drawn with - same colour, same glow, same light map.
// LAW D1: the patch is asked the list 'ceiling_patch' before it is made.
(function () {
  'use strict';
  window.__dressPatches = function (PLAN) {
    var WM = window.WM, T = WM.THREE, Q = window.__dressQ, out = { made: [], refused: [] };
    (PLAN.patches || []).forEach(function (pt) {
      if (pt.kind !== 'ceiling') return;
      var near = pt.near, y0 = pt.level || PLAN.levelY || 574.55, M = WM.pack.meshes.get('Ceilings'); if (!M) return;
      var p = M.geometry.getAttribute('position'), ix = M.geometry.getIndex(), uv = M.geometry.getAttribute('uv1') || M.geometry.getAttribute('uv2');
      var E = WM.pack.elements.filter(function (e) { return e.mesh === 'Ceilings' && e.bbox && e.bbox.min[1] > y0 + 2.2 && e.bbox.min[1] < y0 + 4; });
      function key(v) { return p.getX(v).toFixed(3) + ',' + p.getZ(v).toFixed(3); }
      function xz(k) { return k.split(',').map(Number); }
      function inside(L, x, z) { var c = false; for (var i = 0, j = L.length - 1; i < L.length; j = i++) { var a = xz(L[i]), b = xz(L[j]); if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
      function area(L) { var s = 0; for (var i = 0, j = L.length - 1; i < L.length; j = i++) { var a = xz(L[i]), b = xz(L[j]); s += (b[0] + a[0]) * (b[1] - a[1]); } return Math.abs(s / 2); }
      var hole = null, el = null, vOf = null, holeA = 1e9;
      E.forEach(function (e) { if (near[0] < e.bbox.min[0] || near[0] > e.bbox.max[0] || near[1] < e.bbox.min[2] || near[1] > e.bbox.max[2]) return;
        var yb = e.bbox.min[1], edges = {}, vv = {};
        for (var t = e.triStart; t < e.triStart + e.triCount; t++) { var a = ix.getX(t * 3), b = ix.getX(t * 3 + 1), c = ix.getX(t * 3 + 2); if (Math.abs(p.getY(a) - yb) > 0.005 || Math.abs(p.getY(b) - yb) > 0.005 || Math.abs(p.getY(c) - yb) > 0.005) continue;
          [[a, b], [b, c], [c, a]].forEach(function (q) { var ka = key(q[0]), kb = key(q[1]); vv[ka] = q[0]; vv[kb] = q[1]; var k = ka < kb ? ka + '|' + kb : kb + '|' + ka; edges[k] = (edges[k] || 0) + 1; }); }
        var adj = {}; Object.keys(edges).forEach(function (k) { if (edges[k] !== 1) return; var f = k.split('|'); (adj[f[0]] = adj[f[0]] || []).push(f[1]); (adj[f[1]] = adj[f[1]] || []).push(f[0]); });
        var used = {}; Object.keys(adj).forEach(function (s) { if (used[s]) return; var L = [s], cur = s; used[s] = 1; for (var g = 0; g < 5000; g++) { var nx = (adj[cur] || []).filter(function (q) { return !used[q]; })[0]; if (!nx) break; used[nx] = 1; L.push(nx); cur = nx; }
          var A = area(L); if (L.length >= 3 && A < holeA && A < (pt.maxLoop || 30) && inside(L, near[0], near[1])) { hole = L; holeA = A; el = e; vOf = vv; } }); });
      var name = 'ceiling patch near ' + near.join(', ');
      if (!hole) { var r0 = Q.ask('ceiling_patch', { given: { outline_found: false }, all: true }, {}); Q.refuse(name, 'ceiling_patch', 'the plan point', 1, { outline_found: 1 }, r0); out.refused.push(name + ': no ceiling outline surrounds the point'); return; }
      var yb = el.bbox.min[1];
      // how much of the loop is truly open: 10 cm cells inside it that no OTHER ceiling triangle covers (0.1 m below .. 0.6 m above)
      var bb = [1e9, -1e9, 1e9, -1e9]; hole.forEach(function (k) { var q = xz(k); bb = [Math.min(bb[0], q[0]), Math.max(bb[1], q[0]), Math.min(bb[2], q[1]), Math.max(bb[3], q[1])]; });
      var cells = [], cov = {};
      for (var z = bb[2] + 0.05; z < bb[3]; z += 0.1) for (var x = bb[0] + 0.05; x < bb[1]; x += 0.1) if (inside(hole, x, z)) cells.push([x, z]);
      E.forEach(function (e) { if (e === el || e.bbox.max[0] < bb[0] || e.bbox.min[0] > bb[1] || e.bbox.max[2] < bb[2] || e.bbox.min[2] > bb[3] || e.bbox.min[1] < yb - 0.1 || e.bbox.min[1] > yb + 0.6) return;
        for (var t = e.triStart; t < e.triStart + e.triCount; t++) { var a = ix.getX(t * 3), b = ix.getX(t * 3 + 1), c = ix.getX(t * 3 + 2), ax = p.getX(a), az = p.getZ(a), bx = p.getX(b), bz = p.getZ(b), cx = p.getX(c), cz = p.getZ(c), den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(den) < 1e-10) continue;
          for (var i = 0; i < cells.length; i++) { if (cov[i]) continue; var X = cells[i][0], Z = cells[i][1], l1 = ((bz - cz) * (X - cx) + (cx - bx) * (Z - cz)) / den, l2 = ((cz - az) * (X - cx) + (ax - cx) * (Z - cz)) / den; if (l1 >= -1e-4 && l2 >= -1e-4 && 1 - l1 - l2 >= -1e-4) cov[i] = 1; } } });
      var open = cells.filter(function (c, i) { return !cov[i]; }), openA = open.length * 0.01;
      // the material of the ceiling around it: the overlay that holds one of the rim's own corners, else the element's own material
      var rim = hole.map(function (k) { var v = vOf[k]; return { x: p.getX(v), z: p.getZ(v), u: uv.getX(v), v: uv.getY(v) }; }), mat = null, OV = window.__tmOverlays || {};
      Object.keys(OV).forEach(function (k) { if (mat || k.indexOf('Ceilings') < 0) return; var q = OV[k].geometry.getAttribute('position');
        for (var i = 0; i < q.count && !mat; i++) if (Math.abs(q.getY(i) - yb) < 0.003 && Math.abs(q.getX(i) - rim[0].x) < 0.002 && Math.abs(q.getZ(i) - rim[0].z) < 0.002) mat = OV[k].material; });
      if (!mat) mat = (Array.isArray(M.material) ? M.material : [M.material]).filter(function (m) { return m && m.lightMap; })[0];
      // the light at the rim's corners, read from the light map: do they agree with each other (a patch between very different lights would show)
      var lm = mat && mat.lightMap, spread = null;
      if (lm) { var N = rim.length, data = new Float32Array(N * 4); rim.forEach(function (q, i) { data[i * 4] = q.u; data[i * 4 + 1] = q.v; data[i * 4 + 3] = 1; });
        var dt = new T.DataTexture(data, N, 1, T.RGBAFormat, T.FloatType); dt.needsUpdate = true; dt.minFilter = dt.magFilter = T.NearestFilter;
        var rt = new T.WebGLRenderTarget(N, 1, { type: T.FloatType, minFilter: T.NearestFilter, magFilter: T.NearestFilter }), sc = new T.Scene(), cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        sc.add(new T.Mesh(new T.PlaneGeometry(2, 2), new T.ShaderMaterial({ uniforms: { a: { value: dt }, b: { value: lm } }, vertexShader: 'varying vec2 q; void main(){ q = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: 'uniform sampler2D a; uniform sampler2D b; varying vec2 q; void main(){ vec2 u = texture2D(a, q).xy; gl_FragColor = vec4(texture2D(b, u).rgb, 1.0); }' })));
        var R = WM.renderer, prev = R.getRenderTarget(), xr = R.xr.enabled, px = new Float32Array(N * 4); R.xr.enabled = false; R.setRenderTarget(rt); R.render(sc, cam); R.readRenderTargetPixels(rt, 0, 0, N, 1, px); R.setRenderTarget(prev); R.xr.enabled = xr; rt.dispose(); dt.dispose();
        var lo = 1e9, hi = -1e9; for (var i2 = 0; i2 < N; i2++) { var g = px[i2 * 4 + 1]; if (g < lo) lo = g; if (g > hi) hi = g; } spread = +(hi - lo).toFixed(3); }
      var res = Q.ask('ceiling_patch', { given: { outline_found: true, truly_open: +openA.toFixed(2), small: +openA.toFixed(2), material_found: !!(mat && mat.lightMap), light_agrees: spread }, all: true }, {});
      if (!res.ok) { var tl = {}; res.answers.forEach(function (a) { if (!a.pass) tl[a.id] = a.value; }); Q.refuse(name, 'ceiling_patch', el.name + ' #' + el.id, 1, tl, res); out.refused.push(name + ': ' + JSON.stringify(tl)); return; }
      // the new piece: the loop's own corners, triangulated; 2 mm above the bottom face; facing down
      var contour = rim.map(function (q) { return new T.Vector2(q.x, q.z); }), tris = T.ShapeUtils.triangulateShape(contour, []), P = [], U = [];
      tris.forEach(function (t) { [t[0], t[1], t[2]].forEach(function (i) { P.push(rim[i].x, yb + 0.0005, rim[i].z); U.push(rim[i].u, rim[i].v); }); });
      var ge = new T.BufferGeometry(); ge.setAttribute('position', new T.BufferAttribute(new Float32Array(P), 3)); ge.setAttribute('uv1', new T.BufferAttribute(new Float32Array(U), 2)); ge.setAttribute('uv', new T.BufferAttribute(new Float32Array(U), 2)); ge.computeVertexNormals();
      var o = new T.Mesh(ge, mat); o.name = 'dress-patch:ceiling:' + el.id; o.userData.notPack = true; o.userData.dressPlan = true; o.frustumCulled = false; o.matrixAutoUpdate = false; o.matrix.copy(M.matrixWorld); WM.scene.add(o);
      var cx = 0, cz = 0; open.forEach(function (c) { cx += c[0]; cz += c[1]; }); cx /= open.length || 1; cz /= open.length || 1;
      Q.record(name, el.name + ' #' + el.id, res, [cx, yb, cz]);
      out.made.push({ near: near, element: el.id, elementName: el.name, loopCorners: rim.length, loopArea: +holeA.toFixed(2), trulyOpen_m2: +openA.toFixed(2), openCentre: [+cx.toFixed(2), +cz.toFixed(2)], lightSpread: spread, tris: tris.length });
    });
    console.log('[dress] patches: ' + JSON.stringify(out));
    return out;
  };
  // ---- ROOMS THE BAKE LEFT WITHOUT A LAMP (his words 2026-11-13: "check again for places missing lighting") ----
  // MEASURED (night_tests/nroomlight.eval.js): the bake had 104 ceiling lamps; three rooms of the ground floor had NONE -
  // the laundry 113, the general store 114, the cleaning room 138 - and their walls hold 28 - 57% of the building's middle
  // light (the store drew almost black). The machinery finds such rooms itself: every room region of the floor machinery,
  // its floor's and walls' baked light read from the light map, the bake's lamps counted inside it.
  // THE REPAIR (in the viewer, strength 1): inside the box of a dark room, every surface that carries baked light gets a
  // little more of it - a fill, added where the shader adds the light map, so colours and pictures stay as they are.
  // Nothing outside the box changes. The real fix is in the bake: a lamp in every room (the lamp list must be made from
  // the ROOMS, not only from the ceilings that exist in the model).
  window.__dressLightFill = function (PLAN) {
    var WM = window.WM, T = WM.THREE, Q = window.__dressQ, cfg = PLAN.lightFill, lv = PLAN.levelY || 574.55, out = { rooms: [], patched: 0 }; if (!cfg || !Q) return out;
    var R = (window.__dressFloorRegions || []).filter(function (r) { return Math.abs(r.M.y0 - lv) < 0.01 && r.cover >= 0.7; }); if (!R.length) return out;
    var M = R[0].M, L = R[0].L, C = 0.1, nx = M.nx;
    function read(mesh, uvs) { var own = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).filter(function (m) { return m && m.lightMap; })[0], N = uvs.length / 2, W = 2048, H = Math.max(1, Math.ceil(N / W)), data = new Float32Array(W * H * 4), i;
      for (i = 0; i < N; i++) { data[i * 4] = uvs[i * 2]; data[i * 4 + 1] = uvs[i * 2 + 1]; }
      var dt = new T.DataTexture(data, W, H, T.RGBAFormat, T.FloatType); dt.needsUpdate = true; dt.minFilter = dt.magFilter = T.NearestFilter;
      var rt = new T.WebGLRenderTarget(W, H, { type: T.FloatType, minFilter: T.NearestFilter, magFilter: T.NearestFilter }), sc = new T.Scene(), cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      sc.add(new T.Mesh(new T.PlaneGeometry(2, 2), new T.ShaderMaterial({ uniforms: { a: { value: dt }, b: { value: own.lightMap } }, vertexShader: 'varying vec2 q; void main(){ q = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: 'uniform sampler2D a; uniform sampler2D b; varying vec2 q; void main(){ vec2 u = texture2D(a, q).xy; gl_FragColor = vec4(texture2D(b, u).rgb, 1.0); }' })));
      var Rr = WM.renderer, prev = Rr.getRenderTarget(), xr = Rr.xr.enabled, px = new Float32Array(W * H * 4); Rr.xr.enabled = false; Rr.setRenderTarget(rt); Rr.render(sc, cam); Rr.readRenderTargetPixels(rt, 0, 0, W, H, px); Rr.setRenderTarget(prev); Rr.xr.enabled = xr; rt.dispose(); dt.dispose();
      var o = new Float32Array(N); for (i = 0; i < N; i++) o[i] = 0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]; return o; }
    function med(a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }); return s[Math.floor(s.length / 2)]; }
    var F = WM.pack.meshes.get('Floors'), fp = F.geometry.getAttribute('position'), fi = F.geometry.getIndex(), fu = F.geometry.getAttribute('uv1') || F.geometry.getAttribute('uv2'), uvs = [], who = [], byN = {};
    R.forEach(function (r, ri) { byN[r.n] = ri; var rb = r.rb; for (var k = rb[2]; k <= rb[3]; k += 2) for (var i = rb[0]; i <= rb[1]; i += 2) { var c = k * nx + i; if (!r.reg[c] || L.triAt[c] < 0) continue; var t = L.triAt[c], a = fi.getX(t * 3), b = fi.getX(t * 3 + 1), cc = fi.getX(t * 3 + 2), x = M.x0 + (i + 0.5) * C, z = M.z0 + (k + 0.5) * C;
        var ax = fp.getX(a), az = fp.getZ(a), bx = fp.getX(b), bz = fp.getZ(b), cx = fp.getX(cc), cz = fp.getZ(cc), den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz), l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / den, l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / den, l3 = 1 - l1 - l2;
        uvs.push(l1 * fu.getX(a) + l2 * fu.getX(b) + l3 * fu.getX(cc), l1 * fu.getY(a) + l2 * fu.getY(b) + l3 * fu.getY(cc)); who.push(ri); } });
    var fl = read(F, new Float32Array(uvs)), per = R.map(function () { return []; }), i; for (i = 0; i < who.length; i++) per[who[i]].push(fl[i]);
    var Wm = WM.pack.meshes.get('Walls'), wp = Wm.geometry.getAttribute('position'), wi = Wm.geometry.getIndex(), wu = Wm.geometry.getAttribute('uv1') || Wm.geometry.getAttribute('uv2'), wuv = [], wwho = [];
    for (var t = 0; t < wi.count / 3; t++) { var a = wi.getX(t * 3), b = wi.getX(t * 3 + 1), c = wi.getX(t * 3 + 2), y = (wp.getY(a) + wp.getY(b) + wp.getY(c)) / 3; if (y < lv + 0.3 || y > lv + 2.2) continue; var x = (wp.getX(a) + wp.getX(b) + wp.getX(c)) / 3, z = (wp.getZ(a) + wp.getZ(b) + wp.getZ(c)) / 3;
      var e1 = [wp.getX(b) - wp.getX(a), wp.getY(b) - wp.getY(a), wp.getZ(b) - wp.getZ(a)], e2 = [wp.getX(c) - wp.getX(a), wp.getY(c) - wp.getY(a), wp.getZ(c) - wp.getZ(a)], nxw = e1[1] * e2[2] - e1[2] * e2[1], nzw = e1[0] * e2[1] - e1[1] * e2[0], ln = Math.hypot(nxw, nzw); if (ln < 1e-9) continue;
      for (var s = 0; s < 2; s++) { var cc2 = M.cell(x + nxw / ln * (s ? -0.2 : 0.2), z + nzw / ln * (s ? -0.2 : 0.2)), n = cc2 >= 0 ? L.taken[cc2] : 0; if (n > 0 && byN[n] != null) { wuv.push((wu.getX(a) + wu.getX(b) + wu.getX(c)) / 3, (wu.getY(a) + wu.getY(b) + wu.getY(c)) / 3); wwho.push(byN[n]); break; } } }
    var wl = read(Wm, new Float32Array(wuv)), wper = R.map(function () { return []; }); for (i = 0; i < wwho.length; i++) wper[wwho[i]].push(wl[i]);
    // ⛔ FOUND ON THE SECOND BUILDING: the lamp list read here was the Deir El Asad bake's. The plan now names its own bake's
    // lamp list (lightFill.lamps); with none, the question 'no lamp' has no answer and no room gets fill light (law D1).
    var lampN = R.map(function () { return cfg.lamps ? 0 : null; }), xh = new XMLHttpRequest(); xh.open('GET', (cfg.lamps || 'bakelib/none.json') + '?v=' + Date.now(), false);
    try { if (cfg.lamps) xh.send(); (JSON.parse(xh.responseText).lamps || []).forEach(function (l) { var c = M.cell(l.pos[0], l.pos[2]), n = c >= 0 ? L.taken[c] : 0; if (n > 0 && byN[n] != null && l.ceil_y > lv && l.ceil_y < lv + 4.5) lampN[byN[n]]++; }); } catch (e) {}
    var fm = med(Array.prototype.slice.call(fl)), wm = med(Array.prototype.slice.call(wl)), boxes = [];
    R.forEach(function (r, ri) { var f = med(per[ri]), w = med(wper[ri]); if (f == null || w == null) return;
      // LAW D1, the list 'light_fill': no lamp of the bake in the room, and its WALLS are truly dark (the first run also took the
      // balcony: its floor is dim but its walls are lit by the sky - a dim floor alone is shade, not a room without light)
      var res = Q.ask('light_fill', { given: { no_lamp: lampN[ri], dark: +(w / wm).toFixed(2), indoors: +r.cover.toFixed(2), a_room: +r.area.toFixed(1) }, all: true }, {});
      if (!res.ok) return; var add = Math.max(0, +(cfg.wallShare * wm - w).toFixed(4), +((cfg.floorShare * fm - f) * 0.6).toFixed(4)); if (add <= 0 || boxes.length >= 8) return;
      var rb = r.rb, box = [M.x0 + rb[0] * C - 0.08, M.z0 + rb[2] * C - 0.08, M.x0 + (rb[1] + 1) * C + 0.08, M.z0 + (rb[3] + 1) * C + 0.08]; boxes.push({ box: box, add: add });
      Q.record('light for ' + r.fl.id, 'no lamp in the bake', res, [(box[0] + box[2]) / 2, lv, (box[1] + box[3]) / 2]);
      out.rooms.push({ room: r.fl.id, area: +r.area.toFixed(1), lamps: lampN[ri], floorShare: +(f / fm).toFixed(2), wallShare: +(w / wm).toFixed(2), added: add }); });
    out.middle = { floor: +fm.toFixed(3), walls: +wm.toFixed(3) }; if (!boxes.length) return out;
    var U = { uFillBox: { value: [] }, uFillAmt: { value: [] }, uFillY: { value: new T.Vector2(lv - 0.1, lv + 4.4) } };
    for (i = 0; i < 8; i++) { var bq = boxes[i]; U.uFillBox.value.push(bq ? new T.Vector4(bq.box[0], bq.box[1], bq.box[2], bq.box[3]) : new T.Vector4(0, 0, 0, 0)); U.uFillAmt.value.push(bq ? bq.add : 0); }
    function patch(m) { if (!m || !m.lightMap || m.userData.fillLight || m.isShaderMaterial) return; m.userData.fillLight = true; var prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
      m.onBeforeCompile = function (sh, r) { if (prev) prev.call(this, sh, r); Object.assign(sh.uniforms, U);
        if (sh.fragmentShader.indexOf('#include <lights_fragment_maps>') < 0) return;                 // a shader this repair does not know: left as it is
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vFillW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvFillW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vFillW; uniform vec4 uFillBox[8]; uniform float uFillAmt[8]; uniform vec2 uFillY;\nfloat wmFill(vec3 p){ float f = 0.0; if (p.y > uFillY.x && p.y < uFillY.y) { for (int i = 0; i < 8; i++) { vec4 b = uFillBox[i]; if (p.x > b.x && p.z > b.y && p.x < b.z && p.z < b.w) f = max(f, uFillAmt[i]); } } return f; }')
          .replace('#include <lights_fragment_maps>', '#include <lights_fragment_maps>\n#if defined( RE_IndirectDiffuse ) && defined( USE_LIGHTMAP )\n irradiance += vec3(wmFill(vFillW)) * lightMapIntensity;\n#endif'); };
      m.customProgramCacheKey = function () { return (prevKey ? prevKey.call(this) : '') + 'fill'; }; m.needsUpdate = true; out.patched++; }
    function all() { WM.scene.traverse(function (o) { if (!o.isMesh) return; (Array.isArray(o.material) ? o.material : [o.material]).forEach(patch); }); }
    all(); setTimeout(all, 6000);                                 // once more: the viewer makes some paint materials a little later
    console.log('[dress] light fill: ' + JSON.stringify(out));
    return out;
  };
})();
