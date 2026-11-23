// LOCAL ONLY (2026-11-11, the test "design a building yourself"): ?dressplan=1 applies THE DRESSING PLAN
// (bakelib/dress_plan.json - text, written by the AI planner, checked by its paper gate in oYmer AI Dressing/make_plan.py).
// This file is MACHINERY: it reads the plan and paints. It decides nothing.
//   - which rule: the object's category + type name.   - which wing colour: the zone the object stands in.
//   - which part: the Revit material each triangle carries in the pack (elements.json 'mats' runs), or - where the
//     family has no material data - the small islands at the bottom (legs), the same test Viewer-Finish-DetailPaint uses.
//   - the biggest part of an object is painted through the viewer's own paint (WM.applyOp material.set), so it swaps and
//     writes back like any finish. The other parts are a copy of their triangles on top (never the pack's geometry).
// Loads AFTER tm-look.js: both add their entries to window.TM_ENTRIES before the catalogue arrives.
(function () {
  'use strict';
  if (!/[?&]dressplan=1/.test(location.search)) return;
  function getJSON(u) { var x = new XMLHttpRequest(); x.open('GET', u + '?v=' + Date.now(), false); x.send(); return JSON.parse(x.responseText); }
  var PLAN, lib = {};
  // ONE PLAN PER BUILDING (2026-11-18, the second building): ?dressfile=<name> reads bakelib/dress_plan_<name>.json
  var PF = (location.search.match(/[?&]dressfile=([\w-]+)/) || [])[1];
  try { PLAN = getJSON('bakelib/dress_plan' + (PF ? '_' + PF : '') + '.json'); getJSON('../Library/materials.json').materials.forEach(function (e) { lib[e.id] = e; }); }
  catch (e) { return console.error('[dress] no plan', e); }
  if (PLAN.start) window.__dressStart = PLAN.start;            // where the eye stands when the page opens (bake-view.js)
  window.TM_ENTRIES = window.TM_ENTRIES || [];
  PLAN.materials.forEach(function (m) {
    var src = m.from && lib[m.from] ? lib[m.from] : null;
    ['', '~p', '~f', '~c'].forEach(function (sfx) {                // '~c' = objects that carry NO baked light of their own (the casework)
                 // '~f' = the floor-per-room layer                 // '~p' = the copy used for parts on top (its own material: its own light)
      // REAL SURFACES (2026-11-13): 'detail' = the light-and-dark of a real fabric / leather / veneer; the plan's colour goes over it
      window.TM_ENTRIES.push({ id: m.id + sfx, name: m.name, nameEn: m.name, color: m.color, maps: m.detail ? { albedo: m.detail } : src ? JSON.parse(JSON.stringify(src.maps || {})) : {},
        scaleM: m.detail ? m.detailM : src ? src.scaleM : 1, rough: m.rough, metal: 0, finish: 'matte', tags: ['dress'] });
    });
  });
  var OBJ = { 'Furniture': 1, 'Casework': 1, 'Plumbing Fixtures': 1, 'Generic Models': 1, 'Specialty Equipment': 1 };
  function zoneOf(el) {
    var b = el.bbox; if (!b) return PLAN.zones[PLAN.zones.length - 1];
    var x = (b.min[0] + b.max[0]) / 2, z = (b.min[2] + b.max[2]) / 2;
    for (var i = 0; i < PLAN.zones.length; i++) { var t = PLAN.zones[i].test || {};
      if ((t.xMax == null || x < t.xMax) && (t.xMin == null || x > t.xMin) && (t.zMax == null || z < t.zMax) && (t.zMin == null || z > t.zMin) && (t.yMax == null || b.min[1] < t.yMax) && (t.yMin == null || b.min[1] > t.yMin)) return PLAN.zones[i]; }   // yMin / yMax: a zone can be a level
    return PLAN.zones[PLAN.zones.length - 1];
  }
  function hash(n, k) { var h = (Number(n) * 2654435761 + k * 40503) >>> 0; h ^= h >>> 15; return (h * 2246822519) >>> 0; }
  // the chair triangles of a table set -> chairs: islands (shared vertices), merged when their centres lie within 0.4 m
  function splitChairs(mesh, tris) {
    var pos = mesh.geometry.getAttribute('position'), idx = mesh.geometry.getIndex(), n = tris.length, parent = new Int32Array(n), vert = {}, i, k;
    for (i = 0; i < n; i++) parent[i] = i;
    function find(a) { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; }
    for (i = 0; i < n; i++) for (k = 0; k < 3; k++) { var v = idx.getX(tris[i] * 3 + k), p = vert[v]; if (p === undefined) vert[v] = i; else { var ra = find(i), rb = find(p); if (ra !== rb) parent[ra] = rb; } }
    var isl = {}; for (i = 0; i < n; i++) (isl[find(i)] || (isl[find(i)] = [])).push(tris[i]);
    var cl = [];
    Object.keys(isl).forEach(function (q) { var T = isl[q], x = 0, z = 0, m = 0;
      T.forEach(function (t) { for (var k2 = 0; k2 < 3; k2++) { var v = idx.getX(t * 3 + k2); x += pos.getX(v); z += pos.getZ(v); m++; } }); x /= m; z /= m;
      var hit = null; cl.forEach(function (c) { if (!hit && Math.hypot(c.x - x, c.z - z) < 0.4) hit = c; });
      if (hit) { hit.tris = hit.tris.concat(T); } else cl.push({ x: x, z: z, tris: T.slice() }); });
    cl.forEach(function (c) { c.cy = {}; c.lo = 1e9; c.hi = -1e9;
      c.tris.forEach(function (t) { var s = 0; for (var k3 = 0; k3 < 3; k3++) { var y = pos.getY(idx.getX(t * 3 + k3)); s += y; if (y < c.lo) c.lo = y; if (y > c.hi) c.hi = y; } c.cy[t] = s / 3; }); });
    cl.sort(function (a, b) { return a.x - b.x || a.z - b.z; });
    return cl;
  }
  function ruleOf(el) {
    for (var i = 0; i < PLAN.rules.length; i++) { var r = PLAN.rules[i]; if (r.cat !== el.cat) continue;
      if (r.name != null) { if (r.name === el.name) return r; continue; }
      if (r.match != null && String(el.name || '').indexOf(r.match) >= 0) return r; }
    return null;
  }
  // the disjoint islands of one element (shared vertices), with their height range and their triangles
  function islandsOf(mesh, el) {
    var idx = mesh.geometry.getIndex(), pos = mesh.geometry.getAttribute('position'), t0 = el.triStart, n = el.triCount;
    var parent = new Int32Array(n); for (var i = 0; i < n; i++) parent[i] = i;
    function find(a) { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; }
    var vert = {};
    for (var t = 0; t < n; t++) for (var k = 0; k < 3; k++) { var v = idx.getX((t0 + t) * 3 + k), p = vert[v];
      if (p === undefined) vert[v] = t; else { var ra = find(t), rb = find(p); if (ra !== rb) parent[ra] = rb; } }
    var g = {};
    for (var t2 = 0; t2 < n; t2++) { var r = find(t2), o = g[r] || (g[r] = { tris: [], minY: Infinity, maxY: -Infinity });
      o.tris.push(t0 + t2);
      for (var k2 = 0; k2 < 3; k2++) { var y = pos.getY(idx.getX((t0 + t2) * 3 + k2)); if (y < o.minY) o.minY = y; if (y > o.maxY) o.maxY = y; } }
    return Object.keys(g).map(function (k3) { return g[k3]; });
  }
  // a copy of the triangles on top, carrying the baked per-vertex light of its vertices. The viewer draws every object
  // 2 depth steps BEHIND its true place (its depth ladder), so a copy at the true place always wins - no offset needed.
  var OV = {};
  // ⚠ A PATCH FOR THE TEST ONLY (strength 1): the night bake gives NO light to glass triangles, and that includes a glass
  // table top the plan turns into oak. Such a triangle borrows the mean light of its own element (the chairs around it).
  // The real fix is in the bake: the plan's materials go INTO the bake, so an oak table is baked as oak.
  function fallbackLight(mesh, el) {
    var fb = mesh.userData.dressFb || (mesh.userData.dressFb = new Float32Array(mesh.geometry.getIndex().count)), col = mesh.geometry.getAttribute('color'), idx = mesh.geometry.getIndex();
    if (!col) return; var s = [0, 0, 0], n = 0, t, k, vi;
    for (t = el.triStart; t < el.triStart + el.triCount; t++) for (k = 0; k < 3; k++) { vi = idx.getX(t * 3 + k); var r = col.getX(vi), g = col.getY(vi), b = col.getZ(vi);
      if (r + g + b > 0) { s[0] += r; s[1] += g; s[2] += b; n++; } }
    if (!n) return; for (t = el.triStart; t < el.triStart + el.triCount; t++) { fb[t * 3] = s[0] / n; fb[t * 3 + 1] = s[1] / n; fb[t * 3 + 2] = s[2] / n; }
  }
  function overlay(mesh, tris, material, key) {
    var THREE = window.WM.THREE, g0 = mesh.geometry, pos = g0.getAttribute('position'), col = g0.getAttribute('color'), idx = g0.getIndex();
    var P = new Float32Array(tris.length * 9), C = col ? new Float32Array(tris.length * 9) : null;   // getX reads the light as 0..1 whatever the pack stores
    for (var i = 0; i < tris.length; i++) for (var k = 0; k < 3; k++) {
      var vi = idx.getX(tris[i] * 3 + k);
      P[i * 9 + k * 3] = pos.getX(vi); P[i * 9 + k * 3 + 1] = pos.getY(vi); P[i * 9 + k * 3 + 2] = pos.getZ(vi);
      if (C) { var r = col.getX(vi), gg = col.getY(vi), b = col.getZ(vi), fb = mesh.userData.dressFb;
        if (r + gg + b === 0 && fb) { r = fb[tris[i] * 3]; gg = fb[tris[i] * 3 + 1]; b = fb[tris[i] * 3 + 2]; }
        C[i * 9 + k * 3] = r; C[i * 9 + k * 3 + 1] = gg; C[i * 9 + k * 3 + 2] = b; }
    }
    var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    if (C) g.setAttribute('color', new THREE.BufferAttribute(C, 3));
    // the object light is a 1x1 white light map read through 'uv1': the shader does not compile without that attribute
    var Z = new Float32Array(tris.length * 6); g.setAttribute('uv1', new THREE.BufferAttribute(Z, 2)); g.setAttribute('uv', new THREE.BufferAttribute(Z, 2));
    g.computeVertexNormals();
    var own = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).filter(function (m) { return m && m.lightMap; })[0];
    material.vertexColors = !!C;                                   // the baked light of this object, as on the object itself
    if (own) { material.lightMap = own.lightMap; material.lightMapIntensity = own.lightMapIntensity; }
    material.envMapIntensity = 0; material.needsUpdate = true;
    var o = new THREE.Mesh(g, material); o.matrixAutoUpdate = false; o.matrix.copy(mesh.matrixWorld); o.name = key; o.userData.dressPlan = true; o.userData.notPack = true; o.frustumCulled = false;
    window.WM.scene.add(o); OV[key] = o;
  }
  function run() {
    var unlit = [];
    var WM = window.WM, MATS = (WM.pack.manifest && WM.pack.manifest.materials) || [], groups = {}, parts = {}, rep = { elements: 0, partTris: 0, byZone: {}, byRule: {}, noRule: 0 };
    // LIGHT THAT IS MISSING ON OBJECTS (his words 2026-11-13: "check again for places missing lighting").
    // MEASURED (night_tests/nlight.eval.js): the floor has no dark place (4 shadows under chairs, 0.3 - 0.5 m2), but 63 objects
    // carry corners with NO baked light at all - 26 of the 28 shelving units on 62% of their corners (the inside of the shelves
    // drew black), TV backs, mirrors, some chairs. The bake lights an object per corner, and a corner the rays did not reach
    // stays exactly 0. Such a corner now takes a share (plan.darkFill, 0.55) of the mean light of its own object's lit
    // corners: the inside of a shelf is darker than its front, not black. Only the light numbers change - never a position.
    // ⚠ Strength 1 (a repair after the bake). The real fix is in the bake: light per face for the low-polygon objects.
    rep.darkFilled = { objects: 0, corners: 0 };
    if (PLAN.darkFill) WM.pack.elements.forEach(function (el) { if (!OBJ[el.cat] || !el.bbox) return; var mesh = WM.pack.meshes.get(el.mesh), col = mesh && mesh.geometry.getAttribute('color'), idx = mesh && mesh.geometry.getIndex(); if (!col || !idx) return;
      var s = [0, 0, 0], n = 0, zero = [], seen = {}, t, v;
      for (t = el.triStart * 3; t < (el.triStart + el.triCount) * 3; t++) { v = idx.getX(t); if (seen[v]) continue; seen[v] = 1; var r = col.getX(v), g = col.getY(v), b = col.getZ(v); if (r + g + b > 0) { s[0] += r; s[1] += g; s[2] += b; n++; } else zero.push(v); }
      if (!zero.length || n < 3 || zero.length / (n + zero.length) < 0.03) return; var k = PLAN.darkFill / n;
      zero.forEach(function (q) { col.setXYZ(q, s[0] * k, s[1] * k, s[2] * k); }); col.needsUpdate = true; rep.darkFilled.objects++; rep.darkFilled.corners += zero.length; });
    WM.pack.elements.forEach(function (el) {
      // 'alsoPaint' (2026-11-13): the model's own furniture that stands in the patio garden, one level down, is dressed too
      var inLevel = (PLAN.levelNames || [PLAN.level]).some(function (nm) { return String(el.level || '').indexOf(nm) >= 0; }) || (PLAN.paintNoLevel && !el.level) /* the second building's wood deck carries no level in Revit */ || (PLAN.alsoPaint || []).some(function (a) { var b = el.bbox; if (!b || String(el.level || '').indexOf(a.level) < 0) return false;
        var x = (b.min[0] + b.max[0]) / 2, z = (b.min[2] + b.max[2]) / 2; return x > a.box[0] && x < a.box[1] && z > a.box[2] && z < a.box[3]; });
      if (!OBJ[el.cat] || !inLevel) return;
      var rule = ruleOf(el); if (!rule) { rep.noRule++; return; }
      var zone = zoneOf(el), mesh = WM.pack.meshes.get(el.mesh); if (!mesh) return;
      // VARIATIONS (his words "some with dif color"): '$accentv' = one colour of the wing's family, '$wood' = one of the plan's
      // woods - chosen by a fixed hash of the element id, so a piece keeps its colour on every load
      var fam = zone.family || [zone.accent], H0 = hash(el.id, 0);
      function res(ref) { return ref === '$accent' ? zone.accent : ref === '$accentv' ? fam[H0 % fam.length] : ref === '$wood' ? PLAN.woods[hash(el.id, 7) % PLAN.woods.length] : ref; }
      var tri = {}, t, k, chairT = [];
      function addT(id, tt) { (tri[id] || (tri[id] = [])).push(tt); }
      var hasData = rule.parts && el.mats && el.mats.length;
      if (hasData) { t = el.triStart; el.mats.forEach(function (r) { var nm = r[1] >= 0 ? (MATS[r[1]] || {}).name : '(none)', ref = rule.parts[nm] || rule.base;
        for (var j = 0; j < r[0]; j++) { if (ref === '$chairs') chairT.push(t + j); else addT(res(ref), t + j); } t += r[0]; }); }
      // EACH CHAIR OF A TABLE SET ITS OWN COLOUR, SEAT AND BACK APART (his words "color each part independently, so not all the
      // chair is yellow"): the chair triangles split into chairs (islands within 0.4 m), each chair takes the next colour of the
      // family; inside a chair, what lies in the lower 60% of its height is the seat, the rest is the back (rule.back).
      if (chairT.length) { splitChairs(mesh, chairT).forEach(function (ch, kc) { var v = fam[(H0 + kc) % fam.length], b = rule.back ? res(rule.back) : v;
        ch.tris.forEach(function (tt) { addT(ch.cy[tt] < ch.lo + 0.6 * (ch.hi - ch.lo) ? v : b, tt); }); }); }
      else { var all = tri[res(rule.base)] = []; for (k = 0; k < el.triCount; k++) all.push(el.triStart + k); }
      if (rule.legs && !hasData) {
        var isl = islandsOf(mesh, el);
        if (isl.length > 1) { var lo = Infinity, hi = -Infinity; isl.forEach(function (i) { if (i.minY < lo) lo = i.minY; if (i.maxY > hi) hi = i.maxY; });
          var H = (hi - lo) || 1, legs = [], body = [];
          isl.forEach(function (i) { var leg = i.minY <= lo + 0.08 * H && (i.maxY - i.minY) <= 0.5 * H && i.tris.length <= 0.35 * el.triCount; (leg ? legs : body).push.apply(leg ? legs : body, i.tris); });
          if (legs.length && body.length) { tri = {}; tri[res(rule.legs)] = legs.slice();
            // seat and back apart on a chair with no Revit parts: the body's lower part (rule.seatFrac of the height) is the seat
            if (rule.back) { var pos = mesh.geometry.getAttribute('position'), ix = mesh.geometry.getIndex(), sb = res(rule.base), bb = res(rule.back), cut = lo + (rule.seatFrac || 0.55) * H;
              body.forEach(function (tt) { var y = 0; for (var q = 0; q < 3; q++) y += pos.getY(ix.getX(tt * 3 + q)); addT(y / 3 < cut ? sb : bb, tt); }); }
            else tri[res(rule.base)] = body; } }
      }
      // AN OBJECT WITH NO BAKED LIGHT AT ALL (measured 2026-11-13: the mesh 'Casework' - every desk and counter - has no
      // per-corner light and is not in the wall bake, so it drew BLACK): it is not painted here; it gets a lit copy below.
      if (!mesh.geometry.getAttribute('color')) { Object.keys(tri).forEach(function (id) { unlit.push({ el: el, mesh: mesh, id: id, tris: tri[id] }); }); rep.elements++; rep.byRule[rule.what] = (rep.byRule[rule.what] || 0) + 1; return; }
      if (Object.keys(tri).length > 1) fallbackLight(mesh, el);
      var best = null; Object.keys(tri).forEach(function (id) { if (!best || tri[id].length > tri[best].length) best = id; });
      (groups[best] = groups[best] || []).push(el.id);
      Object.keys(tri).forEach(function (id) { if (id === best) return; var m = parts[el.mesh] || (parts[el.mesh] = {}), a = m[id] || (m[id] = []);
        for (var j = 0; j < tri[id].length; j++) a.push(tri[id][j]); rep.partTris += tri[id].length; });
      rep.elements++; rep.byZone[zone.id] = (rep.byZone[zone.id] || 0) + 1; rep.byRule[rule.what] = (rep.byRule[rule.what] || 0) + 1;
    });
    // the plan's colour over a detail picture, divided by the picture's measured mean: the mean colour on screen = the plan's colour
    PLAN.materials.forEach(function (pm) { if (!pm.detail) return; ['', '~p', '~c'].forEach(function (sfx) { var m = window.WMPaint.materialFor(pm.id + sfx); if (!m) return;
      m.color.set(pm.color).multiplyScalar(1 / (pm.detailMean || 1)); m.color.r = Math.min(1, m.color.r); m.color.g = Math.min(1, m.color.g); m.color.b = Math.min(1, m.color.b); m.needsUpdate = true; }); });
    function paintBase() { Object.keys(groups).forEach(function (id) { WM.applyOp({ type: 'material.set', elementIds: groups[id], materialId: id }); }); }
    paintBase(); setTimeout(paintBase, 4000);                          // once more, after tm-look's own per-element pass
    Object.keys(parts).forEach(function (mn) { var mesh = WM.pack.meshes.get(mn);
      Object.keys(parts[mn]).forEach(function (id) { overlay(mesh, parts[mn][id], window.WMPaint.materialFor(id + '~p'), 'dress:' + mn + ':' + id); }); });
    // THE LIT COPY OF AN UNLIT OBJECT: the light of the FLOOR around it (the floor's own baked light, read from the light map at
    // 8 points 0.35 m outside the object's box; the brightest half is kept, so the object's own shadow does not darken it),
    // on every corner - tops full, sides 0.8, undersides 0.5, so the form reads. ⚠ Strength 1: a repair in the viewer. The real
    // fix is the bake: the casework baked like the furniture.
    rep.unlit = { objects: 0, noFloor: 0 };
    if (unlit.length) (function () { var T = WM.THREE, F = WM.pack.meshes.get('Floors'), fp = F.geometry.getAttribute('position'), fi = F.geometry.getIndex(), fu = F.geometry.getAttribute('uv1') || F.geometry.getAttribute('uv2');
      var fown = (Array.isArray(F.material) ? F.material : [F.material]).filter(function (m) { return m && m.lightMap; })[0], FU = WM.pack.meshes.get('Furniture'), oown = FU ? (Array.isArray(FU.material) ? FU.material : [FU.material]).filter(function (m) { return m && m.lightMap && FU.geometry.getAttribute('color'); })[0] : null; if (!fown) { rep.unlit.noFloorLight = true; return; }
      // a pack whose objects have no light of their own at all (the second building): a plain white 1 x 1 light map at the
      // floor's own strength, so the corner light below is read exactly like the floor's light
      if (!oown) { var w1 = new T.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, T.RGBAFormat); w1.needsUpdate = true; w1.channel = 1; oown = { lightMap: w1, lightMapIntensity: fown.lightMapIntensity }; }
      function floorUV(x, z, y) { var best = null, by = -1e9; for (var t = 0; t < fi.count / 3; t++) { var a = fi.getX(t * 3), b = fi.getX(t * 3 + 1), c = fi.getX(t * 3 + 2), ya = fp.getY(a); if (ya > y + 0.3 || ya < y - 1.2) continue;
          var ax = fp.getX(a), az = fp.getZ(a), bx = fp.getX(b), bz = fp.getZ(b), cx = fp.getX(c), cz = fp.getZ(c); if (Math.min(ax, bx, cx) > x || Math.max(ax, bx, cx) < x || Math.min(az, bz, cz) > z || Math.max(az, bz, cz) < z) continue;
          var den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(den) < 1e-10) continue; var l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / den, l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / den, l3 = 1 - l1 - l2; if (l1 < 0 || l2 < 0 || l3 < 0) continue;
          var yy = l1 * ya + l2 * fp.getY(b) + l3 * fp.getY(c); if (yy > by) { by = yy; best = [l1 * fu.getX(a) + l2 * fu.getX(b) + l3 * fu.getX(c), l1 * fu.getY(a) + l2 * fu.getY(b) + l3 * fu.getY(c)]; } } return best; }
      var els = [], seenEl = {}; unlit.forEach(function (u) { if (!seenEl[u.el.id]) { seenEl[u.el.id] = 1; els.push(u.el); } });
      var uvs = [], own = []; els.forEach(function (el, k) { var b = el.bbox, cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2, hx = (b.max[0] - b.min[0]) / 2 + 0.35, hz = (b.max[2] - b.min[2]) / 2 + 0.35;
        [[hx, 0], [-hx, 0], [0, hz], [0, -hz], [hx, hz], [-hx, hz], [hx, -hz], [-hx, -hz]].forEach(function (o) { var q = floorUV(cx + o[0], cz + o[1], b.min[1]); if (q) { uvs.push(q[0], q[1]); own.push(k); } }); });
      var N = own.length; if (!N) return; var data = new Float32Array(N * 4); for (var i = 0; i < N; i++) { data[i * 4] = uvs[i * 2]; data[i * 4 + 1] = uvs[i * 2 + 1]; }
      var dt = new T.DataTexture(data, N, 1, T.RGBAFormat, T.FloatType); dt.needsUpdate = true; dt.minFilter = dt.magFilter = T.NearestFilter;
      var rt = new T.WebGLRenderTarget(N, 1, { type: T.FloatType, minFilter: T.NearestFilter, magFilter: T.NearestFilter }), sc = new T.Scene(), cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      sc.add(new T.Mesh(new T.PlaneGeometry(2, 2), new T.ShaderMaterial({ uniforms: { a: { value: dt }, b: { value: fown.lightMap } }, vertexShader: 'varying vec2 q; void main(){ q = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: 'uniform sampler2D a; uniform sampler2D b; varying vec2 q; void main(){ vec2 u = texture2D(a, q).xy; gl_FragColor = vec4(texture2D(b, u).rgb, 1.0); }' })));
      var R = WM.renderer, prev = R.getRenderTarget(), xr = R.xr.enabled, px = new Float32Array(N * 4); R.xr.enabled = false; R.setRenderTarget(rt); R.render(sc, cam); R.readRenderTargetPixels(rt, 0, 0, N, 1, px); R.setRenderTarget(prev); R.xr.enabled = xr; rt.dispose(); dt.dispose();
      var light = {}, K = fown.lightMapIntensity / oown.lightMapIntensity; els.forEach(function (el, k) { var s = []; for (var i = 0; i < N; i++) if (own[i] === k) s.push([px[i * 4], px[i * 4 + 1], px[i * 4 + 2]]);
        s.sort(function (a, b) { return (b[0] + b[1] + b[2]) - (a[0] + a[1] + a[2]); }); s = s.slice(0, Math.max(1, Math.ceil(s.length / 2))); if (!s.length) { rep.unlit.noFloor++; light[el.id] = null; return; }
        var m = [0, 0, 0]; s.forEach(function (q) { m[0] += q[0]; m[1] += q[1]; m[2] += q[2]; }); light[el.id] = [m[0] / s.length * K, m[1] / s.length * K, m[2] / s.length * K]; rep.unlit.objects++; });
      var by = {}; unlit.forEach(function (u) { if (!light[u.el.id]) return; var k = u.mesh.name + '|' + u.id, g = by[k] || (by[k] = { mesh: u.mesh, id: u.id, P: [], C: [] }), pos = u.mesh.geometry.getAttribute('position'), idx = u.mesh.geometry.getIndex(), L = light[u.el.id];
        u.tris.forEach(function (t) { var v = [0, 1, 2].map(function (q) { var i = idx.getX(t * 3 + q); return [pos.getX(i), pos.getY(i), pos.getZ(i)]; });
          var nx = (v[1][1] - v[0][1]) * (v[2][2] - v[0][2]) - (v[1][2] - v[0][2]) * (v[2][1] - v[0][1]), ny = (v[1][2] - v[0][2]) * (v[2][0] - v[0][0]) - (v[1][0] - v[0][0]) * (v[2][2] - v[0][2]), nz = (v[1][0] - v[0][0]) * (v[2][1] - v[0][1]) - (v[1][1] - v[0][1]) * (v[2][0] - v[0][0]), ln = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
          var up = ny / ln, f = up > 0.5 ? 1 : up < -0.5 ? 0.5 : 0.8; v.forEach(function (q) { g.P.push(q[0], q[1], q[2]); g.C.push(L[0] * f, L[1] * f, L[2] * f); }); }); });
      Object.keys(by).forEach(function (k) { var g = by[k], ge = new T.BufferGeometry(), n = g.P.length / 3; ge.setAttribute('position', new T.BufferAttribute(new Float32Array(g.P), 3)); ge.setAttribute('color', new T.BufferAttribute(new Float32Array(g.C), 3));
        ge.setAttribute('uv1', new T.BufferAttribute(new Float32Array(n * 2), 2)); ge.setAttribute('uv', new T.BufferAttribute(new Float32Array(n * 2), 2)); ge.computeVertexNormals();
        var m = window.WMPaint.materialFor(g.id + '~c'); m.vertexColors = true; m.lightMap = oown.lightMap; m.lightMapIntensity = oown.lightMapIntensity; m.envMapIntensity = 0; m.polygonOffset = true; m.polygonOffsetFactor = 0; m.polygonOffsetUnits = -8; m.needsUpdate = true;
        var o = new T.Mesh(ge, m); o.matrixAutoUpdate = false; o.matrix.copy(g.mesh.matrixWorld); o.name = 'dress-lit:' + k; o.userData.dressPlan = true; o.userData.notPack = true; o.frustumCulled = false; WM.scene.add(o); OV['lit:' + k] = o; }); })();
    // for the bake (oYmer AI Dressing/plan2bake.py): which plan material every object triangle got
    window.__dressPlan = { plan: PLAN, report: rep, overlays: OV, assign: { groups: groups, parts: parts } };
    // the decorations (dress-objects.js): placed by measuring, refused where a check fails
    // THE GROUND OUTDOORS first (dress-ground.js): what is planted later stands on it
    try { if (window.__dressGround && PLAN.ground) rep.ground = window.__dressGround(PLAN); } catch (e) { console.error('[dress] ground failed', e); }
    try { if (window.__dressShell && PLAN.shell) rep.shell = window.__dressShell(PLAN); } catch (e) { console.error('[dress] shell failed', e); }
    // SEVERAL LEVELS IN ONE PLAN (2026-11-19, the second building): plan.levelPlans = what stands on each level. The same machinery
    // runs once per level with that level's name, objects, extras and people; the question record is kept from level to level.
    if (PLAN.levelPlans) { rep.levels = []; var SZ = getJSON('bakelib/dress/_sizes.json'); window.__dressPlan.placed = [];
      PLAN.levelPlans.forEach(function (lp, li) { var sub = Object.assign({}, PLAN, lp, { __keepQ: li > 0, levelPlans: null }), lr = { level: lp.name || lp.level };
        try { var pl = window.__dressPlaceObjects(sub, SZ, zoneOf); lr.objects = pl.log; window.__dressPlan.placed = window.__dressPlan.placed.concat(pl.placed); window.__dressPlan.answers = pl.answers; } catch (e) { console.error('[dress] objects failed on ' + lr.level, e); }
        try { if (window.__dressMore && sub.more && sub.more.length) lr.more = window.__dressMore(sub); } catch (e) { console.error('[dress] more failed on ' + lr.level, e); }
        try { if (window.__dressTVs && PLAN.screens) lr.screens = window.__dressTVs(sub, MATS); } catch (e) { console.error('[dress] screens failed on ' + lr.level, e); }
        rep.levels.push(lr); }); }
    try { if (window.__dressPlaceObjects && PLAN.objects) { var po = window.__dressPlaceObjects(PLAN, getJSON('bakelib/dress/_sizes.json'), zoneOf); rep.objects = po.log; window.__dressPlan.placed = po.placed; window.__dressPlan.answers = po.answers; } }
    catch (e) { console.error('[dress] objects failed', e); }
    try { if (window.__dressOutdoor && PLAN.outdoor) rep.outdoor = window.__dressOutdoor(PLAN); } catch (e) { console.error('[dress] outdoor failed', e); }
    try { if (window.__dressFloors && PLAN.floors) rep.floors = window.__dressFloors(PLAN); } catch (e) { console.error('[dress] floors failed', e); }
    try { if (window.__dressMore && PLAN.more) rep.more = window.__dressMore(PLAN); } catch (e) { console.error('[dress] more failed', e); }
    try { if (window.__dressPatches && PLAN.patches) rep.patches = window.__dressPatches(PLAN); } catch (e) { console.error('[dress] patches failed', e); }
    try { if (window.__dressTVs && PLAN.screens && !PLAN.levelPlans) rep.screens = window.__dressTVs(PLAN, MATS); } catch (e) { console.error('[dress] screens failed', e); }
    try { if (window.__dressDoors && PLAN.doors) rep.doors = window.__dressDoors(PLAN); } catch (e) { console.error('[dress] doors failed', e); }
    try { if (window.__dressLightFill && PLAN.lightFill) rep.lightFill = window.__dressLightFill(PLAN); } catch (e) { console.error('[dress] light fill failed', e); }
    try { if (window.__dressShine && PLAN.shine) rep.shine = window.__dressShine(PLAN); } catch (e) { console.error('[dress] shine failed', e); }
    console.log('[dress] plan applied: ' + JSON.stringify(rep));
    WM.setStatus('dressing plan: ' + rep.elements + ' objects');
  }
  var tries = 0, TM = /[?&]tmall=1/.test(location.search), readyAt = 0;
  (function wait() {
    var WM = window.WM, ok = WM && WM.pack && window.WMPaint && window.WMPaint.entries && window.WMPaint.entries().length;
    // ⛔ FOUND ON THE SECOND BUILDING (2026-11-18): the plan waited for the furniture's per-corner light, which only the Blender
    // night bake writes. A pack without it (the Soldiers Club: UE5 light on the shell only) never became 'ready'. The wait
    // is now 10 s at most; objects without baked light take the path made for the unlit casework.
    if (ok) { var F = WM.pack.meshes.get('Furniture'), lit = !!(F && F.geometry.getAttribute('color')); if (!lit) { readyAt = readyAt || Date.now(); lit = !F || Date.now() - readyAt > 10000; } ok = lit && (!TM || !!window.__tmLook); }
    if (ok) return setTimeout(run, 2500);
    if (++tries < 600) setTimeout(wait, 250); else console.error('[dress] the viewer never got ready');
  })();
})();
