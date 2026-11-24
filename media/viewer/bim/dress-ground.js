// LOCAL ONLY (2026-11-18, the second building): THE GROUND OUTDOORS - grass, roads and paving with the sun and the shadows.
// Called by dress-plan.js (plan.ground, plan.outdoor). His words: "its also include outdoor - sky, grass, terrain plants. shadows."
// The terrain of a Revit model is a few big triangles with no light layout, so:
//   - its LIGHT is one flat picture over the site (ground.<set>.json + .png, baked by bake_any.py 'ground': sun, sky, the
//     shadow of the building, of the neighbours and of everything the dressing placed);
//   - its FINISH is chosen per Revit material of each triangle (plan.ground.finishes: grass, asphalt, paving ...), a picture
//     laid by the world's x / z, turned as the plan says.
// A copy of the terrain's triangles carries both (never the pack's geometry); the pack's own terrain mesh is switched off
// while the copy is shown. window.__dressGroundAt(x, z) = the ground's height, slope and finish there.
// THE PLANTS (plan.outdoor): spots come from a fixed rule (a hash, the same on every load) inside the site (the floors'
// footprint + a margin); every spot is asked the list 'ground_item' (law D1) - is there ground, is it the ground this plant
// grows on, is it flat enough, is it clear of the building and of everything in the model (an obstacle map of every model
// triangle above the ground, 0.5 m cells), is it clear of the other plants, does the baked light reach it.
(function () {
  'use strict';
  function h01(n, k) { var h = (Math.imul(n | 0, 2654435761) + Math.imul(k | 0, 40503)) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; h = Math.imul(h, 3266489917) >>> 0; h ^= h >>> 16; return h / 4294967296; }
  window.__dressGround = function (PLAN) {
    var WM = window.WM, T = WM.THREE, G = PLAN.ground, Q = window.__dressQ, out = { made: [], light: false }; if (!G) return out;
    var MATS = (WM.pack.manifest && WM.pack.manifest.materials) || [], q = new URLSearchParams(location.search), set = (q.get('set') || '').replace(/[^a-z0-9_-]/gi, '');
    var base = '../Packs/' + q.get('pack') + '/', lm = null, ltex = null;
    try { var x = new XMLHttpRequest(); x.open('GET', base + 'ground.' + set + '.json?v=' + Date.now(), false); x.send(); if (x.status === 200) lm = JSON.parse(x.responseText); } catch (e) {}
    var nTri = 0; (G.cats || ['Topography']).forEach(function (cat) { var mesh = WM.pack.meshes.get(cat); if (mesh) WM.pack.elements.forEach(function (el) { if (el.mesh === cat) nTri += el.triCount; }); });
    // LAW D1, the list 'ground_finish': no baked light picture = no answer = the terrain is left as the model draws it
    // A SITE WITH NO TERRAIN (2026-11-24, the WS house: the lawns, the paving and the pool are Revit FLOORS): the plan says
    // ground.cats = [] - there is no terrain to copy, so its question is not asked; the site's floors below are still dressed
    var noTerrain = Array.isArray(G.cats) && !G.cats.length;
    if (Q && !noTerrain) { var res = Q.ask('ground_finish', { given: { has_ground: nTri, has_light: !!lm }, all: true }, {}); if (!res.ok) { Q.refuse('the ground', 'ground_finish', 'the site', 1, {}, res); out.refused = res.failed; return out; } Q.record('the ground', 'the site', res, [0, 0, 0]); }
    if (lm) { ltex = new T.TextureLoader().load(base + lm.file + '?v=' + Date.now()); ltex.flipY = false; ltex.colorSpace = T.SRGBColorSpace; ltex.channel = 1; ltex.wrapS = ltex.wrapT = T.ClampToEdgeWrapping; ltex.generateMipmaps = true; out.light = true; }
    var H = [], HF = [];                                       // every ground triangle + its finish, for the height under a point
    (G.cats || ['Topography']).forEach(function (cat) {
      var mesh = WM.pack.meshes.get(cat); if (!mesh) return; var pos = mesh.geometry.getAttribute('position'), idx = mesh.geometry.getIndex(), by = {};
      WM.pack.elements.forEach(function (el) { if (el.mesh !== cat) return; var t = el.triStart;
        function fin(name) { for (var i = 0; i < G.finishes.length; i++) if (new RegExp(G.finishes[i].match, 'i').test(name || '')) return G.finishes[i]; return G.finishes[G.finishes.length - 1]; }
        var runs = el.mats && el.mats.length ? el.mats : [[el.triCount, -1]];
        runs.forEach(function (r) { var f = fin(r[1] >= 0 ? (MATS[r[1]] || {}).name : ''), b = by[f.finish] || (by[f.finish] = { f: f, P: [], U1: [], U0: [] });
          for (var j = 0; j < r[0]; j++) { var v = [0, 1, 2].map(function (k) { var i = idx ? idx.getX((t + j) * 3 + k) : (t + j) * 3 + k; return [pos.getX(i), pos.getY(i), pos.getZ(i)]; });
            var up = (v[1][2] - v[0][2]) * (v[2][0] - v[0][0]) - (v[1][0] - v[0][0]) * (v[2][2] - v[0][2]); if (up < 0) { var s = v[1]; v[1] = v[2]; v[2] = s; }   // every ground triangle faces up
            H.push(v[0][0], v[0][1], v[0][2], v[1][0], v[1][1], v[1][2], v[2][0], v[2][1], v[2][2]); HF.push(f.finish);
            v.forEach(function (p) { b.P.push(p[0], p[1] + (f.lift || 0), p[2]); var tm = f.texM || 2, a = (f.turn || 0) * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
              b.U0.push((p[0] * c + p[2] * sn) / tm, (-p[0] * sn + p[2] * c) / tm);
              if (lm) b.U1.push((p[0] - lm.box[0]) / (lm.box[2] - lm.box[0]), (p[2] - lm.box[1]) / (lm.box[3] - lm.box[1])); else b.U1.push(0.5, 0.5); }); }
          t += r[0]; }); });
      Object.keys(by).forEach(function (id) { var b = by[id], pm = (PLAN.materials || []).filter(function (m) { return m.id === id; })[0] || {}, ge = new T.BufferGeometry();
        ge.setAttribute('position', new T.BufferAttribute(new Float32Array(b.P), 3)); ge.setAttribute('uv', new T.BufferAttribute(new Float32Array(b.U0), 2)); ge.setAttribute('uv1', new T.BufferAttribute(new Float32Array(b.U1), 2)); ge.computeVertexNormals();
        // the paint system's own material (the plan's colour over its detail picture, laid by the world's x / y / z); '~p' = this copy's own
        var m = window.WMPaint.materialFor(id + '~p'); m.side = T.DoubleSide;
        if (ltex) { m.lightMap = ltex; m.lightMapIntensity = lm.scale * lm.exposure; m.envMapIntensity = 0; if ('specularIntensity' in m) m.specularIntensity = 0; } m.needsUpdate = true;
        var o = new T.Mesh(ge, m); o.name = 'dress-ground:' + cat + ':' + id; o.userData.notPack = true; o.userData.dressPlan = true; o.frustumCulled = false; o.matrixAutoUpdate = false; o.matrix.copy(mesh.matrixWorld); WM.scene.add(o);
        out.made.push({ cat: cat, finish: id, tris: b.P.length / 9 }); });
      mesh.visible = false; mesh.userData.dressHidden = true;       // the copy is shown in its place (a switch, never a change of the pack)
    });
    // THE GENERATED GROUND (2026-11-24, helsinki 16 - a model with NO terrain at all: its two basements stood bare over an empty
    // world). plan.ground.plane = { y, box: [x0, z0, x1, z1], rects: [{ finish, rect }], finish }: one flat plane at street level.
    // Each rect takes its finish where no EARLIER rect lies (first match wins - the entrance path before the garden it crosses);
    // the rest of the box takes 'finish'. Exact rectangles, never a grid: the edges are the plan's (read from the site plan).
    // Lit by the same baked picture as a terrain (bake_any.py bakes the same plane as 'GroundPlane'). Asked 'ground_finish' too.
    if (G.plane) { var GP = G.plane, gy = GP.y, regs = [], done = [];
      var sub = function (a, b) { if (b[0] >= a[2] || b[2] <= a[0] || b[1] >= a[3] || b[3] <= a[1]) return [a]; var r = [];
        if (b[1] > a[1]) r.push([a[0], a[1], a[2], b[1]]); if (b[3] < a[3]) r.push([a[0], b[3], a[2], a[3]]);
        var za = Math.max(a[1], b[1]), zb = Math.min(a[3], b[3]); if (b[0] > a[0]) r.push([a[0], za, b[0], zb]); if (b[2] < a[2]) r.push([b[2], za, a[2], zb]); return r; };
      var clip = function (a) { return [Math.max(Math.min(a[0], a[2]), GP.box[0]), Math.max(Math.min(a[1], a[3]), GP.box[1]), Math.min(Math.max(a[0], a[2]), GP.box[2]), Math.min(Math.max(a[1], a[3]), GP.box[3])]; };
      (GP.rects || []).concat([{ finish: GP.finish, rect: GP.box }]).forEach(function (r) { var parts = [clip(r.rect)];
        done.forEach(function (d) { var nx = []; parts.forEach(function (p) { nx = nx.concat(sub(p, d)); }); parts = nx; });
        // a rect with NO finish is a hole (the plot: its own Revit floors - lawns, decks, the parking ramp - are the ground there)
        parts.forEach(function (p) { if (r.finish && p[2] - p[0] > 1e-3 && p[3] - p[1] > 1e-3) regs.push({ finish: r.finish, rect: p, lift: r.lift || 0 }); }); done.push(clip(r.rect)); });
      if (Q) { var rg = Q.ask('ground_finish', { given: { has_ground: regs.length * 2, has_light: !!lm }, all: true }, {});
        if (!rg.ok) { Q.refuse('the generated ground', 'ground_finish', 'the site', 1, {}, rg); out.refused = rg.failed; return out; } Q.record('the generated ground', 'the site', rg, [0, gy, 0]); }
      var byF = {}; regs.forEach(function (R) { var b = byF[R.finish] || (byF[R.finish] = { P: [], U0: [], U1: [] }), p = R.rect, yy = gy + R.lift;
        [[p[0], p[1]], [p[0], p[3]], [p[2], p[3]], [p[0], p[1]], [p[2], p[3]], [p[2], p[1]]].forEach(function (c, ci) {
          b.P.push(c[0], yy, c[1]); b.U0.push(c[0] / 2, c[1] / 2); if (lm) b.U1.push((c[0] - lm.box[0]) / (lm.box[2] - lm.box[0]), (c[1] - lm.box[1]) / (lm.box[3] - lm.box[1])); else b.U1.push(0.5, 0.5);
          if (ci % 3 === 2) { var o9 = b.P.length - 9; for (var k = 0; k < 9; k++) H.push(b.P[o9 + k]); HF.push(R.finish); } }); });
      Object.keys(byF).forEach(function (id) { var b = byF[id], pm = (PLAN.materials || []).filter(function (m) { return m.id === id; })[0] || {}, ge = new T.BufferGeometry();
        ge.setAttribute('position', new T.BufferAttribute(new Float32Array(b.P), 3)); ge.setAttribute('uv', new T.BufferAttribute(new Float32Array(b.U0), 2)); ge.setAttribute('uv1', new T.BufferAttribute(new Float32Array(b.U1), 2)); ge.computeVertexNormals();
        var m = window.WMPaint.materialFor(id + '~p'); m.side = T.DoubleSide; if (pm.tint) m.color.set(pm.tint);
        if (ltex) { m.lightMap = ltex; m.lightMapIntensity = lm.scale * lm.exposure; m.envMapIntensity = 0; if ('specularIntensity' in m) m.specularIntensity = 0; } m.needsUpdate = true;
        var o = new T.Mesh(ge, m); o.name = 'dress-ground:plane:' + id; o.userData.notPack = true; o.userData.dressPlan = true; o.frustumCulled = false; o.receiveShadow = true; WM.scene.add(o);
        out.made.push({ cat: 'plane', finish: id, tris: b.P.length / 9 }); }); }
    // THE SITE'S OWN FLOORS (plan.ground.site): a Revit model draws its lawn, parking, pavements and flower beds as FLOOR elements
    // and names them (type 'lawn - parking', material 'Site - Grass' ...). Each takes the finish of the first rule its type or
    // material names match - painted by the viewer's own paint (it keeps the element's baked light) - and its upward faces join
    // the ground a plant can stand on.
    if (G.site && G.site.length) { var fmesh = WM.pack.meshes.get('Floors'), fpos = fmesh && fmesh.geometry.getAttribute('position'), fidx = fmesh && fmesh.geometry.getIndex(), groups = {}; out.site = {};
      if (fpos) WM.pack.elements.forEach(function (el) { if (el.mesh !== 'Floors') return; var key = (el.type || '') + ' | ' + (el.mats || []).map(function (r) { return (MATS[r[1]] || {}).name || ''; }).join(' | '), rule = null;
        for (var i = 0; i < G.site.length && !rule; i++) if (new RegExp(G.site[i].match, 'i').test(key)) rule = G.site[i]; if (!rule) return;
        (groups[rule.finish] = groups[rule.finish] || []).push(el.id); out.site[rule.finish] = (out.site[rule.finish] || 0) + 1;
        for (var t = el.triStart; t < el.triStart + el.triCount; t++) { var v = [0, 1, 2].map(function (k) { var vi = fidx ? fidx.getX(t * 3 + k) : t * 3 + k; return [fpos.getX(vi), fpos.getY(vi), fpos.getZ(vi)]; });
          var n0 = (v[1][1] - v[0][1]) * (v[2][2] - v[0][2]) - (v[1][2] - v[0][2]) * (v[2][1] - v[0][1]), n1 = (v[1][2] - v[0][2]) * (v[2][0] - v[0][0]) - (v[1][0] - v[0][0]) * (v[2][2] - v[0][2]), n2 = (v[1][0] - v[0][0]) * (v[2][1] - v[0][1]) - (v[1][1] - v[0][1]) * (v[2][0] - v[0][0]);
          if (n1 / (Math.hypot(n0, n1, n2) || 1) < 0.7) continue;                               // its top faces only
          H.push(v[0][0], v[0][1], v[0][2], v[1][0], v[1][1], v[1][2], v[2][0], v[2][1], v[2][2]); HF.push(rule.finish); } });
      // a finish with a 'tint' (2026-11-24, the WS house's lawn): the paint system draws a detail picture on WHITE - the lawn read
      // grey (measured: colour ffffff under the grass picture); the tint is the colour under the picture
      Object.keys(groups).forEach(function (id) { var pmt = (PLAN.materials || []).filter(function (m) { return m.id === id; })[0]; if (pmt && pmt.tint) { var mt = window.WMPaint.materialFor(id + '~f'); if (mt) mt.color.set(pmt.tint); }
        try { WM.applyOp({ type: 'material.set', elementIds: groups[id], materialId: id + '~f' }); } catch (e) { console.error('[dress] site finish failed', id, e); } }); }
    // the ground under a point: the highest ground triangle there
    var HB = new Float32Array(H), nT = HB.length / 9, cells = {}, big = [], CS = 4;
    for (var t = 0; t < nT; t++) { var o9 = t * 9, x0 = Math.min(HB[o9], HB[o9 + 3], HB[o9 + 6]), x1 = Math.max(HB[o9], HB[o9 + 3], HB[o9 + 6]), z0 = Math.min(HB[o9 + 2], HB[o9 + 5], HB[o9 + 8]), z1 = Math.max(HB[o9 + 2], HB[o9 + 5], HB[o9 + 8]);
      if (x1 - x0 > 400 || z1 - z0 > 400) { big.push(t); continue; }
      for (var gi = Math.floor(x0 / CS); gi <= Math.floor(x1 / CS); gi++) for (var gk = Math.floor(z0 / CS); gk <= Math.floor(z1 / CS); gk++) { var key = gi + ',' + gk; (cells[key] = cells[key] || []).push(t); } }
    function tryTri(ti, x, z, best) { var o = ti * 9, ax = HB[o], az = HB[o + 2], bx = HB[o + 3], bz = HB[o + 5], cx = HB[o + 6], cz = HB[o + 8], den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (den > -1e-12 && den < 1e-12) return best;
      var l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / den, l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / den, l3 = 1 - l1 - l2; if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) return best;
      var y = l1 * HB[o + 1] + l2 * HB[o + 4] + l3 * HB[o + 7]; if (best && y <= best.y) return best;
      var e1y = HB[o + 4] - HB[o + 1], e2y = HB[o + 7] - HB[o + 1], n0 = e1y * (cz - az) - (bz - az) * e2y, n1 = (bz - az) * (cx - ax) - (bx - ax) * (cz - az), n2 = (bx - ax) * e2y - e1y * (cx - ax), ln = Math.hypot(n0, n1, n2) || 1;
      return { y: y, slope: Math.acos(Math.min(1, Math.abs(n1) / ln)) * 180 / Math.PI, tri: ti, finish: HF[ti] }; }
    window.__dressGroundAt = function (x, z) { var best = null, list = cells[Math.floor(x / CS) + ',' + Math.floor(z / CS)], i;
      if (list) for (i = 0; i < list.length; i++) best = tryTri(list[i], x, z, best); for (i = 0; i < big.length; i++) best = tryTri(big[i], x, z, best); return best; };
    window.__dressGroundBox = lm ? lm.box : null; window.__dressGroundTris = HB;
    // where one finish lies (the box of its triangles): a plant that grows on that finish only is tried there
    window.__dressGroundFinishBox = function (fins) { var b = null; for (var t = 0; t < nT; t++) { if (fins.indexOf(HF[t]) < 0) continue; for (var k = 0; k < 3; k++) { var px = HB[t * 9 + k * 3], pz = HB[t * 9 + k * 3 + 2];
      if (!b) b = [px, pz, px, pz]; else { if (px < b[0]) b[0] = px; if (pz < b[1]) b[1] = pz; if (px > b[2]) b[2] = px; if (pz > b[3]) b[3] = pz; } } } return b; };
    console.log('[dress] ground: ' + JSON.stringify(out));
    return out;
  };

  window.__dressOutdoor = function (PLAN) {
    var WM = window.WM, Q = window.__dressQ, S = window.__dressShared, GA = window.__dressGroundAt, list = PLAN.outdoor, log = { placed: {}, refused: {} }, out = [];
    if (!list || !Q || !S || !GA) { console.error('[dress] outdoor: no ground / no question engine - by law D1 nothing is planted'); return null; }
    var SIZES = S.SIZES, G = PLAN.ground || {}, GC = G.cats || ['Topography'], LB = window.__dressGroundBox, A = PLAN.outdoorSite || (LB ? { box: LB.map(function (v, i) { return v + (i < 2 ? 2 : -2); }) } : { cat: 'Floors', pad: 14 });   // the site = where the ground's light was baked
    // THE SITE: the footprint of the building's floors + a margin (the plan may give a box instead)
    var site = A.box; if (!site) { var fm = WM.pack.meshes.get(A.cat), fp = fm && fm.geometry.getAttribute('position'); if (!fp) return null; site = [1e9, 1e9, -1e9, -1e9];
      for (var i = 0; i < fp.count; i++) { var fx = fp.getX(i), fz = fp.getZ(i); if (fx < site[0]) site[0] = fx; if (fx > site[2]) site[2] = fx; if (fz < site[1]) site[1] = fz; if (fz > site[3]) site[3] = fz; }
      site = [site[0] - A.pad, site[1] - A.pad, site[2] + A.pad, site[3] + A.pad]; }
    // THE OBSTACLE MAP: every model triangle that is above the ground (not the terrain itself, not what lies under it) marks the
    // 0.5 m cells it stands over; then the distance of every cell to the nearest marked one.
    var C = 0.5, nx = Math.ceil((site[2] - site[0]) / C), nz = Math.ceil((site[3] - site[1]) / C), occ = new Uint8Array(nx * nz), t0 = performance.now(), nMark = 0;
    function mark(x, z) { var ci = Math.floor((x - site[0]) / C), ck = Math.floor((z - site[1]) / C); if (ci >= 0 && ck >= 0 && ci < nx && ck < nz) occ[ck * nx + ci] = 1; }
    WM.pack.meshes.forEach(function (mesh, cat) { if (GC.indexOf(cat) >= 0 || !mesh.geometry) return; var pos = mesh.geometry.getAttribute('position'), idx = mesh.geometry.getIndex(); if (!pos) return;
      var n = idx ? idx.count / 3 : pos.count / 3, v = [0, 0, 0, 0, 0, 0, 0, 0, 0];
      for (var t = 0; t < n; t++) { for (var k = 0; k < 3; k++) { var vi = idx ? idx.getX(t * 3 + k) : t * 3 + k; v[k * 3] = pos.getX(vi); v[k * 3 + 1] = pos.getY(vi); v[k * 3 + 2] = pos.getZ(vi); }
        var x0 = Math.min(v[0], v[3], v[6]), x1 = Math.max(v[0], v[3], v[6]), z0 = Math.min(v[2], v[5], v[8]), z1 = Math.max(v[2], v[5], v[8]); if (x1 < site[0] || x0 > site[2] || z1 < site[1] || z0 > site[3]) continue;
        var g = GA((v[0] + v[3] + v[6]) / 3, (v[2] + v[5] + v[8]) / 3), top = Math.max(v[1], v[4], v[7]); if (g && top < g.y + 0.08) continue;      // under the ground (a basement) or lying on it: not in a plant's way
        nMark++;
        for (var e = 0; e < 3; e++) { var a = e * 3, b = ((e + 1) % 3) * 3, len = Math.hypot(v[b] - v[a], v[b + 2] - v[a + 2]), st = Math.max(1, Math.ceil(len / (C * 0.5)));
          for (var s = 0; s <= st; s++) mark(v[a] + (v[b] - v[a]) * s / st, v[a + 2] + (v[b + 2] - v[a + 2]) * s / st); }
        if (x1 - x0 > C || z1 - z0 > C) { var den = (v[5] - v[8]) * (v[0] - v[6]) + (v[6] - v[3]) * (v[2] - v[8]); if (den > -1e-9 && den < 1e-9) continue;
          for (var px = Math.floor((x0 - site[0]) / C); px <= Math.floor((x1 - site[0]) / C); px++) for (var pz = Math.floor((z0 - site[1]) / C); pz <= Math.floor((z1 - site[1]) / C); pz++) {
            var cx = site[0] + (px + 0.5) * C, cz = site[1] + (pz + 0.5) * C, l1 = ((v[5] - v[8]) * (cx - v[6]) + (v[6] - v[3]) * (cz - v[8])) / den, l2 = ((v[8] - v[2]) * (cx - v[6]) + (v[0] - v[6]) * (cz - v[8])) / den;
            if (l1 >= 0 && l2 >= 0 && l1 + l2 <= 1) mark(cx, cz); } } } });
    var D = new Float32Array(nx * nz), INF = 1e6, x, z, d;
    for (i = 0; i < nx * nz; i++) D[i] = occ[i] ? 0 : INF;
    for (z = 0; z < nz; z++) for (x = 0; x < nx; x++) { i = z * nx + x; d = D[i]; if (x > 0) d = Math.min(d, D[i - 1] + 1); if (z > 0) { d = Math.min(d, D[i - nx] + 1); if (x > 0) d = Math.min(d, D[i - nx - 1] + 1.414); if (x < nx - 1) d = Math.min(d, D[i - nx + 1] + 1.414); } D[i] = d; }
    for (z = nz - 1; z >= 0; z--) for (x = nx - 1; x >= 0; x--) { i = z * nx + x; d = D[i]; if (x < nx - 1) d = Math.min(d, D[i + 1] + 1); if (z < nz - 1) { d = Math.min(d, D[i + nx] + 1); if (x < nx - 1) d = Math.min(d, D[i + nx + 1] + 1.414); if (x > 0) d = Math.min(d, D[i + nx - 1] + 1.414); } D[i] = d; }
    function clearAt(px, pz) { var ci = Math.floor((px - site[0]) / C), ck = Math.floor((pz - site[1]) / C); return ci >= 0 && ck >= 0 && ci < nx && ck < nz ? D[ck * nx + ci] * C : null; }
    var mapMs = Math.round(performance.now() - t0), placed = [], grows = (G.finishes || []).length ? G.finishes[G.finishes.length - 1].finish : null;
    function ok(it) { log.placed[it] = (log.placed[it] || 0) + 1; } function no(it, why) { var k = it + ': ' + why; log.refused[k] = (log.refused[k] || 0) + 1; }
    list.forEach(function (o, oi) { var s = SIZES[o.item], nodes = o.nodes || (o.node ? [o.node] : [null]), on = o.on || [grows], fb = o.on && window.__dressGroundFinishBox ? window.__dressGroundFinishBox(on) : null;
      var bx = o.box || (fb ? [Math.max(fb[0], site[0]), Math.max(fb[1], site[1]), Math.min(fb[2], site[2]), Math.min(fb[3], site[3])] : site);
      if (!s) { Q.refuse(o.item, 'ground_item', 'the site', 0, { no_model: 1 }); return no(o.item, 'no such model'); }
      // o.at (2026-11-24, helsinki 16): the architect's own points (his 2D tree symbols) - each point is tried where it is drawn, then
      // nudged up to 1.2 m by the same fixed rule; every try is asked the same list. No point = the scattered spots as before.
      for (var n = 0; n < (o.at ? o.at.length : (o.count || 1)); n++) { var done = false, tally = {}, last = null, tried = 0, node = nodes[(n + (o.seed || 0)) % nodes.length], ss = node && s.nodes && s.nodes[node] ? s.nodes[node] : s;
        for (var tr = 0; tr < 40 && !done; tr++) { var seed = (oi + 1) * 100003 + n * 61 + tr * 7 + (o.seed || 0) * 13, px = bx[0] + h01(seed, 1) * (bx[2] - bx[0]), pz = bx[1] + h01(seed, 2) * (bx[3] - bx[1]);
          if (o.at) { var rr = tr === 0 ? 0 : 0.25 + 0.95 * h01(seed, 5), aa = h01(seed, 6) * Math.PI * 2; px = o.at[n][0] + rr * Math.cos(aa); pz = o.at[n][1] + rr * Math.sin(aa); }
          var sc = (o.scaleMin || o.scale || 1) + h01(seed, 3) * ((o.scaleMax || o.scale || 1) - (o.scaleMin || o.scale || 1)), rad = Math.max(ss.max[0] - ss.min[0], ss.max[2] - ss.min[2]) / 2 * sc * (o.foot || 0.6), hgt = (ss.max[1] - ss.min[1]) * sc;
          var g = GA(px, pz), cl = clearAt(px, pz), gap = 99; placed.forEach(function (q) { var dd = Math.hypot(q.x - px, q.z - pz) - q.r - rad; if (dd < gap) gap = dd; });
          var res = Q.ask('ground_item', { given: { on_ground: !!g, its_ground: !!g && on.indexOf(g.finish) >= 0, not_steep: g ? +g.slope.toFixed(1) : null, clear: cl != null && cl - rad >= (o.keep || 0.5),
            near_enough: o.within == null ? true : (cl != null && cl <= o.within), apart: +(gap - (o.apart || 0)).toFixed(2), in_light: !LB || (px > LB[0] + 1 && px < LB[2] - 1 && pz > LB[1] + 1 && pz < LB[3] - 1) }, all: true }, {});
          tried++; last = res; if (!res.ok) { tally[res.failed] = (tally[res.failed] || 0) + 1; continue; }
          var it = { file: o.item + '/' + o.item + '.gltf', pos: [px, g.y - (o.sink || 0) * hgt + 0.01, pz], quat: S.yawQ(o.yaw != null ? o.yaw * Math.PI / 180 : h01(seed, 4) * Math.PI * 2), scale: [sc, sc, sc], outdoor: true };   // o.yaw: a bench faces the street if (node) it.node = node;
          out.push(it); placed.push({ x: px, z: pz, r: rad }); Q.record(o.item, 'the site', res, [px, g.y, pz]); ok(o.item); done = true; }
        if (!done) { Q.refuse(o.item, 'ground_item', 'the site', tried, tally, last); no(o.item, 'no spot passes: ' + Object.keys(tally).sort(function (a, b) { return tally[b] - tally[a]; })[0]); } } });
    S.load(out); window.__dressOutdoorItems = out;      // what was planted (2026-11-24: the trees are baked into the ground's light from this list)
    var rep = { site: site.map(function (v) { return +v.toFixed(1); }), cells: nx * nz, marked: nMark, mapMs: mapMs, placed: log.placed, refused: log.refused };
    window.__dressOutdoorMap = { site: site, C: C, nx: nx, nz: nz, occ: occ, dist: D, placed: placed };
    console.log('[dress] outdoor: ' + JSON.stringify(rep));
    return rep;
  };
  // THE SHELL BY REVIT NAMES (plan.shell, 2026-11-19 - his words: "the external walls along the cafeteria are a stone wall ...
  // railing is glass"): a wall, a railing or any element of the building takes a finish when its Revit TYPE NAME matches the
  // rule (a wall type 'block wall clad in stone'), or when enough of its triangles carry a Revit MATERIAL that matches
  // ('stone cladding' on 699 of 703). Painted by the viewer's own paint: the element keeps its baked light.
  // finish = a plan material; paint = an entry of the viewer's library as it is (clear glass).
  window.__dressShell = function (PLAN) { var WM = window.WM, MATS = (WM.pack.manifest && WM.pack.manifest.materials) || [], out = [];
    (PLAN.shell || []).forEach(function (r) { var ids = [], tm = r.typeMatch ? new RegExp(r.typeMatch, 'i') : null, mm = r.matMatch ? new RegExp(r.matMatch, 'i') : null, byType = 0, byMat = 0;
      WM.pack.elements.forEach(function (el) { if (el.cat !== r.cat && el.mesh !== r.cat) return; var ok = !!tm && tm.test(el.type || el.name || ''); if (ok) byType++;
        if (!ok && mm && el.mats && el.mats.length) { var hit = 0, all = 0; el.mats.forEach(function (run) { all += run[0]; if (run[1] >= 0 && mm.test((MATS[run[1]] || {}).name || '')) hit += run[0]; }); ok = all > 0 && hit / all >= (r.share || 0.5); if (ok) byMat++; }
        if (ok) ids.push(el.id); });
      var id = r.paint || (r.finish + '~f'); if (ids.length) { try { WM.applyOp({ type: 'material.set', elementIds: ids, materialId: id }); } catch (e) { console.error('[dress] shell finish failed', id, e); } }
      out.push({ cat: r.cat, finish: r.paint || r.finish, elements: ids.length, byType: byType, byMaterial: byMat }); });
    console.log('[dress] shell: ' + JSON.stringify(out)); return out; };
})();
