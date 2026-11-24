// LOCAL ONLY (2026-11-12): LAW D1, signed by Omer - NOTHING IS PLACED BEFORE ITS QUESTIONS ARE ANSWERED BY MEASUREMENT.
// His words: "you are intelligent! why cant you ask the same question i would ask? ask 100 questions before placing".
// The QUESTIONS are text (bakelib/dress_questions.json): per KIND of item, what a person walking in would ask about it.
// This file is the machinery that ANSWERS them. Every answer is a number measured on the model, never a belief:
//   - THE FREE-FLOOR MAP (10 cm cells, one per level): is there a floor under the cell; is the cell empty from the floor
//     to 2 m against the REAL triangles of every mesh (not element boxes); how far is the nearest obstacle; which cells a
//     person can walk between; which walk regions reach a door;
//   - hitBox: the exact number of triangles that cross a box (a body, a plant, the space in front of a wall);
//   - ask(kind, candidate): runs the whole list in its order. A question with no measurement, or with no answer, FAILS:
//     the item is refused (a refused item is invisible, a wrong one is a failure).
// Every answer is kept (answers()), so the report shows, per item, each question and its number.
// Nothing here draws or changes the pack: it only reads positions.
(function () {
  'use strict';
  var C = 0.1, BIG = 1e9, TR = null, MAPS = {}, LISTS = null, ANS = [], SIZES = {};

  // ---- every pack triangle as plain numbers: corners, box, and the element it belongs to ----
  function tris() {
    if (TR) return TR; TR = []; var P = window.WM.pack, by = {};
    P.meshes.forEach(function (m, name) {
      var pos = m.geometry.getAttribute('position'), ix = m.geometry.getIndex(), n = (ix ? ix.count : pos.count) / 3;
      var V = new Float32Array(n * 9), bb = new Float32Array(n * 6), el = new Int32Array(n).fill(-1);
      for (var t = 0; t < n; t++) { var o = t * 9, b = t * 6; bb[b] = bb[b + 1] = bb[b + 2] = BIG; bb[b + 3] = bb[b + 4] = bb[b + 5] = -BIG;
        for (var k = 0; k < 3; k++) { var v = ix ? ix.getX(t * 3 + k) : t * 3 + k, x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
          V[o + k * 3] = x; V[o + k * 3 + 1] = y; V[o + k * 3 + 2] = z;
          if (x < bb[b]) bb[b] = x; if (y < bb[b + 1]) bb[b + 1] = y; if (z < bb[b + 2]) bb[b + 2] = z; if (x > bb[b + 3]) bb[b + 3] = x; if (y > bb[b + 4]) bb[b + 4] = y; if (z > bb[b + 5]) bb[b + 5] = z; } }
      by[name] = { name: name, V: V, bb: bb, el: el, n: n }; TR.push(by[name]);
    });
    P.elements.forEach(function (e, i) { var M = by[e.mesh]; if (!M) return; for (var t = e.triStart; t < e.triStart + e.triCount && t < M.n; t++) M.el[t] = i; });
    TR.by = by; return TR;
  }
  // a polygon cut by one plane (keep the side where the coordinate a is >= lim, or <= lim)
  function cut(poly, a, lim, less) {
    var out = [], n = poly.length;
    for (var i = 0; i < n; i++) { var p = poly[i], q = poly[(i + 1) % n], dp = less ? lim - p[a] : p[a] - lim, dq = less ? lim - q[a] : q[a] - lim;
      if (dp >= 0) out.push(p);
      if ((dp > 0 && dq < 0) || (dp < 0 && dq > 0)) { var s = dp / (dp - dq); out.push([p[0] + (q[0] - p[0]) * s, p[1] + (q[1] - p[1]) * s, p[2] + (q[2] - p[2]) * s]); } }
    return out;
  }
  function triPoly(V, o) { return [[V[o], V[o + 1], V[o + 2]], [V[o + 3], V[o + 4], V[o + 5]], [V[o + 6], V[o + 7], V[o + 8]]]; }
  // THE EXACT TEST: how many triangles truly cross this box (touching a face from outside does not count)
  // turn = { x, z, ux, uz }: the box is turned about the point (x, z) so that its own x axis lies along (ux, uz) in plan
  // (a painting on a wall of the diagonal wing); lo / hi are then given in the box's own axes, around that point.
  function hitBox(lo, hi, skipEl, turn) {
    var T = tris(), E = window.WM.pack.elements, n = 0, who = {}, glo = lo, ghi = hi;
    if (turn) { var rr = Math.hypot(Math.max(Math.abs(lo[0]), Math.abs(hi[0])), Math.max(Math.abs(lo[2]), Math.abs(hi[2]))); glo = [turn.x - rr, lo[1], turn.z - rr]; ghi = [turn.x + rr, hi[1], turn.z + rr]; }
    for (var m = 0; m < T.length; m++) { var M = T[m], bb = M.bb, V = M.V;
      for (var t = 0; t < M.n; t++) { var b = t * 6;
        if (bb[b] >= ghi[0] || bb[b + 3] <= glo[0] || bb[b + 1] >= ghi[1] || bb[b + 4] <= glo[1] || bb[b + 2] >= ghi[2] || bb[b + 5] <= glo[2]) continue;
        if (skipEl != null && skipEl >= 0 && M.el[t] === skipEl) continue;
        var poly = triPoly(V, t * 9), a;
        if (turn) poly = poly.map(function (p) { var px = p[0] - turn.x, pz = p[2] - turn.z; return [px * turn.ux + pz * turn.uz, p[1], -px * turn.uz + pz * turn.ux]; });
        for (a = 0; a < 3 && poly.length; a++) { poly = cut(poly, a, lo[a], false); if (poly.length) poly = cut(poly, a, hi[a], true); }
        if (poly.length < 2) continue; var inside = true;
        for (a = 0; a < 3 && inside; a++) { var mn = BIG, mx = -BIG; for (var i = 0; i < poly.length; i++) { if (poly[i][a] < mn) mn = poly[i][a]; if (poly[i][a] > mx) mx = poly[i][a]; }
          if (mx <= lo[a] + 0.002 || mn >= hi[a] - 0.002) inside = false; }
        if (!inside) continue; n++; var e = E[M.el[t]], nm = e ? e.cat + ' / ' + e.name : M.name; who[nm] = (who[nm] || 0) + 1; } }
    return { n: n, who: who };
  }
  // the highest surface of ONE element under a point, not above maxY (a seat under a sitter)
  function surfaceUnder(elIndex, x, z, maxY) {
    var e = window.WM.pack.elements[elIndex], M = tris().by[e.mesh], V = M.V, best = null;
    for (var t = e.triStart; t < e.triStart + e.triCount; t++) { var o = t * 9, ax = V[o], az = V[o + 2], bx = V[o + 3], bz = V[o + 5], cx = V[o + 6], cz = V[o + 8];
      var den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (den > -1e-12 && den < 1e-12) continue;
      var l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / den, l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / den, l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue; var y = l1 * V[o + 1] + l2 * V[o + 4] + l3 * V[o + 7]; if (y <= maxY && (best == null || y > best)) best = y; }
    return best;
  }

  // ---- THE FREE-FLOOR MAP of one level ----
  function buildMap(y0) {
    var T = tris(), F = T.by.Floors, t, o, i, k, x0 = BIG, x1 = -BIG, z0 = BIG, z1 = -BIG, ft = [];
    for (t = 0; t < F.n; t++) { o = t * 9; if (Math.abs(F.V[o + 1] - y0) > 0.15 || Math.abs(F.V[o + 4] - y0) > 0.15 || Math.abs(F.V[o + 7] - y0) > 0.15) continue; ft.push(t);
      var b = t * 6; if (F.bb[b] < x0) x0 = F.bb[b]; if (F.bb[b + 3] > x1) x1 = F.bb[b + 3]; if (F.bb[b + 2] < z0) z0 = F.bb[b + 2]; if (F.bb[b + 5] > z1) z1 = F.bb[b + 5]; }
    x0 -= 1; z0 -= 1; x1 += 1; z1 += 1;
    var nx = Math.ceil((x1 - x0) / C), nz = Math.ceil((z1 - z0) / C), n = nx * nz;
    var M = { y0: y0, x0: x0, z0: z0, nx: nx, nz: nz, floor: new Float32Array(n).fill(-BIG), low: new Uint8Array(n), high: new Uint8Array(n) };
    // 1. the floor: every cell whose centre lies under a floor triangle of this level (15 cm), with the floor's height there
    ft.forEach(function (t) { var V = F.V, o = t * 9, ax = V[o], az = V[o + 2], bx = V[o + 3], bz = V[o + 5], cx = V[o + 6], cz = V[o + 8], b = t * 6;
      var den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (den > -1e-12 && den < 1e-12) return;
      var i0 = Math.max(0, Math.floor((F.bb[b] - x0) / C)), i1 = Math.min(nx - 1, Math.floor((F.bb[b + 3] - x0) / C)), k0 = Math.max(0, Math.floor((F.bb[b + 2] - z0) / C)), k1 = Math.min(nz - 1, Math.floor((F.bb[b + 5] - z0) / C));
      for (var k = k0; k <= k1; k++) for (var i = i0; i <= i1; i++) { var x = x0 + (i + 0.5) * C, z = z0 + (k + 0.5) * C;
        var l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / den, l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / den, l3 = 1 - l1 - l2;
        if (l1 < -1e-4 || l2 < -1e-4 || l3 < -1e-4) continue; var y = l1 * V[o + 1] + l2 * V[o + 4] + l3 * V[o + 7]; if (y > M.floor[k * nx + i]) M.floor[k * nx + i] = y; } });
    // 2. the obstacles: EVERY triangle of EVERY mesh, cut to two height bands above this floor (5 cm - 1 m, 1 m - 2 m)
    function mark(g, x, z) { var i = Math.floor((x - x0) / C), k = Math.floor((z - z0) / C); if (i >= 0 && k >= 0 && i < nx && k < nz) g[k * nx + i] = 1; }
    function raster(poly, g) {
      var m = poly.length, i, a2 = 0, mnx = BIG, mxx = -BIG, mnz = BIG, mxz = -BIG; if (m < 2) return;
      for (i = 0; i < m; i++) { var p = poly[i], q = poly[(i + 1) % m], L = Math.hypot(q[0] - p[0], q[2] - p[2]), st = Math.max(1, Math.ceil(L / (C * 0.45)));
        for (var s = 0; s <= st; s++) mark(g, p[0] + (q[0] - p[0]) * s / st, p[2] + (q[2] - p[2]) * s / st);
        a2 += p[0] * q[2] - q[0] * p[2]; if (p[0] < mnx) mnx = p[0]; if (p[0] > mxx) mxx = p[0]; if (p[2] < mnz) mnz = p[2]; if (p[2] > mxz) mxz = p[2]; }
      if (Math.abs(a2) < C * C) return; var sg = a2 > 0 ? 1 : -1;   // the inside of a (convex) polygon that covers whole cells
      var i0 = Math.max(0, Math.floor((mnx - x0) / C)), i1 = Math.min(nx - 1, Math.floor((mxx - x0) / C)), k0 = Math.max(0, Math.floor((mnz - z0) / C)), k1 = Math.min(nz - 1, Math.floor((mxz - z0) / C));
      for (var k = k0; k <= k1; k++) for (i = i0; i <= i1; i++) { var x = x0 + (i + 0.5) * C, z = z0 + (k + 0.5) * C, inn = true;
        for (var e = 0; e < m && inn; e++) { var pp = poly[e], qq = poly[(e + 1) % m]; if (((qq[0] - pp[0]) * (z - pp[2]) - (qq[2] - pp[2]) * (x - pp[0])) * sg < 0) inn = false; }
        if (inn) g[k * nx + i] = 1; }
    }
    var lo1 = y0 + 0.05, mid = y0 + 1.0, hi1 = y0 + 2.0;
    T.forEach(function (m) { var bb = m.bb, V = m.V;
      for (var t = 0; t < m.n; t++) { var b = t * 6; if (bb[b + 4] <= lo1 || bb[b + 1] >= hi1 || bb[b + 3] < x0 || bb[b] > x1 || bb[b + 5] < z0 || bb[b + 2] > z1) continue;
        var tri = triPoly(V, t * 9);
        if (bb[b + 1] < mid) raster(cut(cut(tri, 1, lo1, false), 1, mid, true), M.low);
        if (bb[b + 4] > mid) raster(cut(cut(tri, 1, mid, false), 1, hi1, true), M.high); } });
    // 3. the distance from every cell to the nearest obstacle (two passes over the grid)
    var d = new Float32Array(n), D1 = C, D2 = C * 1.4142;
    for (i = 0; i < n; i++) d[i] = (M.low[i] || M.high[i]) ? 0 : BIG;
    for (k = 0; k < nz; k++) for (i = 0; i < nx; i++) { var c = k * nx + i, v = d[c];
      if (i > 0 && d[c - 1] + D1 < v) v = d[c - 1] + D1; if (k > 0) { if (d[c - nx] + D1 < v) v = d[c - nx] + D1; if (i > 0 && d[c - nx - 1] + D2 < v) v = d[c - nx - 1] + D2; if (i < nx - 1 && d[c - nx + 1] + D2 < v) v = d[c - nx + 1] + D2; } d[c] = v; }
    for (k = nz - 1; k >= 0; k--) for (i = nx - 1; i >= 0; i--) { c = k * nx + i; v = d[c];
      if (i < nx - 1 && d[c + 1] + D1 < v) v = d[c + 1] + D1; if (k < nz - 1) { if (d[c + nx] + D1 < v) v = d[c + nx] + D1; if (i < nx - 1 && d[c + nx + 1] + D2 < v) v = d[c + nx + 1] + D2; if (i > 0 && d[c + nx - 1] + D2 < v) v = d[c + nx - 1] + D2; } d[c] = v; }
    M.clear = d;
    // 4. where a person can walk (a floor, and 0.3 m from every obstacle), joined into regions
    var walk = M.walk = new Uint8Array(n), comp = M.comp = new Int32Array(n).fill(-1), sizes = M.compSize = [];
    for (i = 0; i < n; i++) walk[i] = (Math.abs(M.floor[i] - y0) <= 0.15 && d[i] >= 0.3) ? 1 : 0;
    for (i = 0; i < n; i++) { if (!walk[i] || comp[i] >= 0) continue; var id = sizes.length, st = [i], cnt = 0; comp[i] = id;
      while (st.length) { var c0 = st.pop(), ii = c0 % nx; cnt++;
        if (ii > 0 && walk[c0 - 1] && comp[c0 - 1] < 0) { comp[c0 - 1] = id; st.push(c0 - 1); } if (ii < nx - 1 && walk[c0 + 1] && comp[c0 + 1] < 0) { comp[c0 + 1] = id; st.push(c0 + 1); }
        if (c0 >= nx && walk[c0 - nx] && comp[c0 - nx] < 0) { comp[c0 - nx] = id; st.push(c0 - nx); } if (c0 < n - nx && walk[c0 + nx] && comp[c0 + nx] < 0) { comp[c0 + nx] = id; st.push(c0 + nx); } }
      sizes.push(cnt); }
    // 5. the doors of this level, and the walk regions that touch one (0.6 m around the door's box)
    M.doors = []; M.doorComp = {};
    window.WM.pack.elements.forEach(function (e) { if (e.cat !== 'Doors' || !e.bbox || e.bbox.min[1] > y0 + 1.5 || e.bbox.max[1] < y0 + 0.5) return; var b = e.bbox;
      M.doors.push([b.min[0], b.min[2], b.max[0], b.max[2]]);
      var i0 = Math.max(0, Math.floor((b.min[0] - 0.6 - x0) / C)), i1 = Math.min(nx - 1, Math.floor((b.max[0] + 0.6 - x0) / C)), k0 = Math.max(0, Math.floor((b.min[2] - 0.6 - z0) / C)), k1 = Math.min(nz - 1, Math.floor((b.max[2] + 0.6 - z0) / C));
      for (var k = k0; k <= k1; k++) for (var i = i0; i <= i1; i++) { var c = comp[k * nx + i]; if (c >= 0) M.doorComp[c] = 1; } });
    // A STAIR IS AN ENTRANCE TOO (2026-11-24, the WS house: its basement and its upper room have no door - you arrive by the
    // stair, and every item there was refused 'reach'). With plan.stairsEnter, a stair whose box arrives at this floor (its top or
    // its foot within 0.25 m of it) marks the walk regions around its box (0.6 m) as reached from an entrance, like a door.
    if (window.__dressStairsEnter) window.WM.pack.elements.forEach(function (e) { if (e.cat !== 'Stairs' || !e.bbox) return; var b = e.bbox;
      if (Math.abs(b.max[1] - y0) > 0.25 && Math.abs(b.min[1] - y0) > 0.25) return; M.doors.push([b.min[0], b.min[2], b.max[0], b.max[2]]);
      var i0 = Math.max(0, Math.floor((b.min[0] - 0.6 - x0) / C)), i1 = Math.min(nx - 1, Math.floor((b.max[0] + 0.6 - x0) / C)), k0 = Math.max(0, Math.floor((b.min[2] - 0.6 - z0) / C)), k1 = Math.min(nz - 1, Math.floor((b.max[2] + 0.6 - z0) / C));
      for (var k = k0; k <= k1; k++) for (var i = i0; i <= i1; i++) { var c = comp[k * nx + i]; if (c >= 0) M.doorComp[c] = 1; } });

    // A WINDOW THAT REACHES THE FLOOR IS A DOOR (2026-11-24, helsinki 16: every balcony and private deck opens through a tall sliding
    // glass door that Revit files under Windows / Curtain Panels - every balcony item was refused 'reach'). With plan.floorWindowsEnter,
    // a window or glass panel whose foot is within 0.15 m of this floor and that stands 1.8 m tall marks the walk regions around it.
    if (window.__dressFloorWindowsEnter) window.WM.pack.elements.forEach(function (e) { if ((e.cat !== 'Windows' && e.cat !== 'Curtain Panels') || !e.bbox) return; var b = e.bbox;
      if (Math.abs(b.min[1] - y0) > 0.15 || b.max[1] - b.min[1] < 1.8) return; M.doors.push([b.min[0], b.min[2], b.max[0], b.max[2]]);
      var i0 = Math.max(0, Math.floor((b.min[0] - 0.6 - x0) / C)), i1 = Math.min(nx - 1, Math.floor((b.max[0] + 0.6 - x0) / C)), k0 = Math.max(0, Math.floor((b.min[2] - 0.6 - z0) / C)), k1 = Math.min(nz - 1, Math.floor((b.max[2] + 0.6 - z0) / C));
      for (var k = k0; k <= k1; k++) for (var i = i0; i <= i1; i++) { var c = comp[k * nx + i]; if (c >= 0) M.doorComp[c] = 1; } });

    // ---- what the questions ask of the map ----
    function cell(x, z) { var i = Math.floor((x - x0) / C), k = Math.floor((z - z0) / C); return (i < 0 || k < 0 || i >= nx || k >= nz) ? -1 : k * nx + i; }
    M.cell = cell;
    M.floorAt = function (x, z) { var c = cell(x, z); return c < 0 || M.floor[c] < -1e8 ? null : M.floor[c]; };
    // the footprint (half sizes hx, hz): which part of it has a floor of this level under it, and that floor's lowest / highest point
    M.cover = function (x, z, hx, hz) { var tot = 0, has = 0, mn = BIG, mx = -BIG;
      for (var zz = z - hz; zz <= z + hz + 1e-6; zz += C / 2) for (var xx = x - hx; xx <= x + hx + 1e-6; xx += C / 2) { tot++; var c = cell(xx, zz), f = c < 0 ? -BIG : M.floor[c];
        if (Math.abs(f - y0) <= 0.15) { has++; if (f < mn) mn = f; if (f > mx) mx = f; } }
      return { frac: tot ? has / tot : 0, n: has, min: mn, max: mx }; };
    M.clearAt = function (x, z) { var c = cell(x, z); return c < 0 ? 0 : Math.min(M.clear[c], 9); };
    M.doorDist = function (x, z) { var best = 99; for (var i = 0; i < M.doors.length; i++) { var D = M.doors[i], dx = Math.max(D[0] - x, 0, x - D[2]), dz = Math.max(D[1] - z, 0, z - D[3]), dd = Math.hypot(dx, dz); if (dd < best) best = dd; } return best; };
    // can a person walk from a door to this spot (R = 0), or to within R of it (an item by a wall)
    M.reach = function (x, z, R) { var r = Math.ceil((R || 0) / C);
      for (var dk = -r; dk <= r; dk++) for (var di = -r; di <= r; di++) { if (di * di + dk * dk > r * r) continue; var c = cell(x + di * C, z + dk * C); if (c >= 0 && comp[c] >= 0 && M.doorComp[comp[c]]) return true; }
      return false; };
    // does a body of radius R at this spot cut the walking area around it (5 m) into more pieces than before
    // ⛔ SEEN IN MY OWN PICTURE (2026-11-13, the patio corridor): a side table on one side and a plant on the other left 0.5 m to
    // pass - each alone cut nothing, because the map knows only the model. 'others' = what is ALREADY PLACED ({x, z, r}): each
    // blocks its own radius + 'pass' (0.45 m = half a wheelchair's way), before and after, so the question is asked about
    // the room as it now stands. Two things across a corridor must leave 0.9 m between them.
    M.splits = function (x, z, R, others, pass) { var W = 50, ci = Math.floor((x - x0) / C), ck = Math.floor((z - z0) / C), S = 2 * W + 1, near = [];
      (others || []).forEach(function (s) { var a = (s.x - x) / C, b = (s.z - z) / C, r = (s.r + (pass || 0.45)) / C; if (Math.abs(a) < W + r && Math.abs(b) < W + r && (a * a + b * b > 0.01)) near.push([a, b, r * r]); });
      function pieces(blockR) { var seen = new Uint8Array(S * S), cnt = 0, br2 = blockR * blockR / (C * C);
        function okc(a, b) { var i = ci + a, k = ck + b; if (i < 0 || k < 0 || i >= nx || k >= nz || !walk[k * nx + i]) return false;
          for (var q = 0; q < near.length; q++) { var da = a - near[q][0], db = b - near[q][1]; if (da * da + db * db <= near[q][2]) return false; }
          return !(blockR > 0 && a * a + b * b <= br2); }
        for (var b = -W; b <= W; b++) for (var a = -W; a <= W; a++) { var s0 = (b + W) * S + a + W; if (seen[s0] || !okc(a, b)) continue; var st = [[a, b]], size = 0; seen[s0] = 1;
          while (st.length) { var p = st.pop(); size++; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (dd) { var aa = p[0] + dd[0], bb2 = p[1] + dd[1]; if (aa < -W || bb2 < -W || aa > W || bb2 > W) return; var s1 = (bb2 + W) * S + aa + W; if (!seen[s1] && okc(aa, bb2)) { seen[s1] = 1; st.push([aa, bb2]); } }); }
          if (size >= 40) cnt++; }
        return cnt; }
      return pieces(R) - pieces(0); };
    // how far a person sees ahead before a wall, a column or glass at head height (the 1 m - 2 m band); yaw 0 = +z
    M.openAhead = function (x, z, yaw) { var dx = Math.sin(yaw), dz = Math.cos(yaw); for (var s = C; s <= 8; s += C / 2) { var c = cell(x + dx * s, z + dz * s); if (c < 0 || M.high[c]) return s; } return 8; };
    M.lineFree = function (xa, za, xb, zb) { var L = Math.hypot(xb - xa, zb - za), st = Math.ceil(L / (C / 2)); for (var s = 1; s < st; s++) { var c = cell(xa + (xb - xa) * s / st, za + (zb - za) * s / st); if (c < 0 || M.high[c]) return false; } return true; };
    // how far the nearest FURNITURE is (an obstacle below 1 m that is not wall-high: a chair, a table, a counter), up to 2 m
    M.furnitureDist = function (x, z) { var r = 20, best = 2;
      for (var dk = -r; dk <= r; dk++) for (var di = -r; di <= r; di++) { var c = cell(x + di * C, z + dk * C); if (c >= 0 && M.low[c] && !M.high[c]) { var dd = Math.hypot(di, dk) * C; if (dd < best) best = dd; } }
      return best; };
    M.mostOpen = function (x, z) { var best = 0, by = 0; for (var a = 0; a < 16; a++) { var y = a * Math.PI / 8, o = M.openAhead(x, z, y); if (o > best) { best = o; by = y; } } return by; };
    var wk = 0, fl = 0, bl = 0; for (i = 0; i < n; i++) { wk += walk[i]; if (Math.abs(M.floor[i] - y0) <= 0.15) fl++; if (M.low[i] || M.high[i]) bl++; }
    M.stats = { cells: n, size: [+(nx * C).toFixed(1), +(nz * C).toFixed(1)], floor_m2: +(fl * C * C).toFixed(0), obstacle_m2: +(bl * C * C).toFixed(0), walk_m2: +(wk * C * C).toFixed(0), regions: sizes.length, doors: M.doors.length };
    return M;
  }
  function map(y0) { var k = y0.toFixed(2); if (!MAPS[k]) { var t0 = performance.now(); MAPS[k] = buildMap(y0); MAPS[k].stats.ms = Math.round(performance.now() - t0); console.log('[dress] free-floor map ' + JSON.stringify(MAPS[k].stats)); } return MAPS[k]; }

  // ---- the size of ONE piece (node) of a model, read from the model file itself (a plate, a cup) ----
  function pieceSize(file, node) {
    if (!SIZES[file]) { var x = new XMLHttpRequest(); x.open('GET', 'bakelib/dress/' + file + '?v=' + Date.now(), false); x.send(); SIZES[file] = JSON.parse(x.responseText); }
    var g = SIZES[file], nd = (g.nodes || []).filter(function (q) { return q.name === node; })[0]; if (!nd || nd.mesh == null) return null;
    var a = g.accessors[g.meshes[nd.mesh].primitives[0].attributes.POSITION], s = nd.scale || [1, 1, 1];
    return { hx: (a.max[0] - a.min[0]) / 2 * s[0], h: (a.max[1] - a.min[1]) * s[1], hz: (a.max[2] - a.min[2]) / 2 * s[2] };
  }

  // ---- the MEASUREMENTS a question may name. Each returns a number / true / false, or null = no answer ----
  var MEASURE = {
    given: function (c, ctx, q) { var v = c.given ? c.given[q.id] : null; return v === undefined ? null : v; },   // measured by the placer while it searched
    floor_cover: function (c) { return c.map.cover(c.x, c.z, c.hx, c.hz).frac; },
    floor_spread: function (c) { var f = c.map.cover(c.x, c.z, c.hx, c.hz); return f.n ? f.max - f.min : null; },
    clear: function (c) { return c.map.clearAt(c.x, c.z); },
    hits: function (c) { if (!c.box) return null; var h = hitBox(c.box[0], c.box[1], c.skipEl, c.turn); return { value: h.n, note: h.n ? Object.keys(h.who).slice(0, 3).join('; ') : undefined }; },
    door_dist: function (c) { return c.map.doorDist(c.x, c.z) - Math.max(c.hx, c.hz); },
    reach: function (c) { return c.map.reach(c.x, c.z, c.reachR || 0); },
    // c.group (2026-11-24): a chair is not 'too close' to its own table, nor a sofa to its own living set - the group was drawn together
    apart: function (c, ctx) { var best = 99; (ctx.spots || []).forEach(function (s) { if (c.group && s.group === c.group) return; var d = Math.hypot(s.x - c.x, s.z - c.z) - s.r - (c.r || 0); if (d < best) best = d; }); return best; },
    way_split: function (c, ctx) { return c.map.splits(c.x, c.z, (c.r || Math.max(c.hx, c.hz)) + 0.45, ctx.spots); },
    open_ahead: function (c) { return c.facesPerson ? { value: 99, note: 'faces a person' } : c.map.openAhead(c.x, c.z, c.yaw); },
    room_fit: function (c, ctx) { var w = ctx.plan && ctx.plan.roles && ctx.plan.roles[c.role]; if (!w || !c.roomName) return null;
      return { value: w.some(function (k) { return c.roomName.indexOf(k) >= 0; }), note: c.role + ' in "' + c.roomName.replace(/[‎‏]/g, '') + '"' }; },
    furniture_gap: function (c) { return c.map.furnitureDist(c.x, c.z) - (c.r || 0); },
    size_max: function (c) { return c.sizeMax == null ? null : c.sizeMax; }
  };
  function lists() { if (!LISTS) { var x = new XMLHttpRequest(); x.open('GET', 'bakelib/dress_questions.json?v=' + Date.now(), false); x.send(); LISTS = JSON.parse(x.responseText); } return LISTS; }
  // ASK: the whole list of this kind, in its order. Stops at the first failed question (c.all = true answers them all).
  function ask(kind, c, ctx) {
    var L = lists().kinds[kind], out = { kind: kind, ok: true, answers: [] };
    if (!L) { out.ok = false; out.failed = 'no_list'; out.answers.push({ id: 'no_list', value: null, pass: false }); return out; }
    for (var i = 0; i < L.length; i++) { var q = L[i]; if (q.stage === 'after') continue;      // 'after' = for the eye, once there is a picture
      var f = MEASURE[q.measure], v = null, note = undefined;   // (a bare 'var note' kept the note of the question before)
      try { if (f) { v = f(c, ctx || {}, q); if (v && typeof v === 'object') { note = v.note; v = v.value; } } else note = 'no measurement named ' + q.measure; } catch (e) { v = null; note = String(e); }
      var pass = v != null && (q.min == null || v >= q.min) && (q.max == null || v <= q.max) && (q.is == null || v === q.is);
      var a = { id: q.id, value: typeof v === 'number' ? +v.toFixed(3) : v, pass: pass }; if (note) a.note = note; out.answers.push(a);
      if (!pass) { out.ok = false; if (!out.failed) out.failed = q.id; if (!c.all) break; } }
    return out;
  }
  function record(item, where, res, pos) { ANS.push({ item: item, kind: res.kind, where: where, ok: true, pos: pos.map(function (v) { return +v.toFixed(3); }), answers: res.answers }); }
  function refuse(item, kind, where, tried, tally, last) { ANS.push({ item: item, kind: kind, where: where, ok: false, tried: tried, failed: tally, last: last ? last.answers : undefined }); }

  window.__dressQ = { map: map, hitBox: hitBox, surfaceUnder: surfaceUnder, pieceSize: pieceSize, ask: ask, record: record, refuse: refuse, lists: lists,
    answers: function () { return ANS; }, reset: function () { ANS = []; }, MEASURE: MEASURE };
})();
