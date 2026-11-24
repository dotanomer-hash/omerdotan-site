// LOCAL ONLY (2026-11-11): THE PLAN'S DECORATIONS, placed by MEASURING the model. Called by dress-plan.js.
// The plan only says WHAT and WHERE in words ("a tea set on every second dining table", "a clock on a wall of room 117").
// This machinery finds the exact spot from the geometry and REFUSES a spot that fails its checks (the paper gate for
// objects): a top must be flat and big enough under the whole item; a wall spot must be the same flat wall under 5 rays
// and free of doors, windows, TVs and furniture; a floor spot must keep 0.9 m clear of every door.
// LAW D1 (2026-11-12): the searches below only PROPOSE spots. Every spot is asked the question list of its kind
// (bakelib/dress_questions.json) and each answer is MEASURED by dress-questions.js; one failed or unanswered question = refused.
// Nothing here is the pack's geometry: the items are separate models (bakelib/dress/, Poly Haven CC0).
// ⚠ An item placed here has NO shadow and no baked light until a bake night runs with the plan inside.
(function () {
  'use strict';
  var WT = null;
  function wallTris() {                                   // the Walls triangles as plain numbers (41k: a direct loop is fast enough)
    if (WT) return WT;
    // plan.wallCats (2026-11-24, helsinki 16): a balcony's edge is its RAILING - a planter stands against it as against a wall.
    // Default: the Walls only, as before.
    var cats = window.__dressWallCats || ['Walls'], all = [];
    cats.forEach(function (c) { var W = window.WM.pack.meshes.get(c); if (!W) return; var pos = W.geometry.getAttribute('position'), idx = W.geometry.getIndex(), n = idx ? idx.count : pos.count;
      for (var i = 0; i < n; i++) { var v = idx ? idx.getX(i) : i; all.push(pos.getX(v), pos.getY(v), pos.getZ(v)); } });
    WT = new Float32Array(all); return WT;
  }
  function rayWall(ox, oy, oz, dx, dz, far) {             // a horizontal ray -> { d, align } on the nearest wall face (both sides count)
    var T = wallTris(), best = far, al = 0, bnx = 0, bnz = 0;
    for (var i = 0; i < T.length; i += 9) {
      var e1x = T[i + 3] - T[i], e1y = T[i + 4] - T[i + 1], e1z = T[i + 5] - T[i + 2], e2x = T[i + 6] - T[i], e2y = T[i + 7] - T[i + 1], e2z = T[i + 8] - T[i + 2];
      var px = -dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y, det = e1x * px + e1y * py + e1z * pz;      // d x e2, d = (dx, 0, dz)
      if (det > -1e-9 && det < 1e-9) continue; var inv = 1 / det, tx = ox - T[i], ty = oy - T[i + 1], tz = oz - T[i + 2];
      var u = (tx * px + ty * py + tz * pz) * inv; if (u < 0 || u > 1) continue;
      var qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, v = (dx * qx + dz * qz) * inv; if (v < 0 || u + v > 1) continue;
      var t = (e2x * qx + e2y * qy + e2z * qz) * inv; if (t < 0.05 || t >= best) continue;
      var nx = e1y * e2z - e1z * e2y, nz = e1x * e2y - e1y * e2x, ny = e1z * e2x - e1x * e2z, ln = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      best = t; al = Math.abs((nx * dx + nz * dz) / ln); bnx = nx; bnz = nz;
    }
    var hl = Math.hypot(bnx, bnz) || 1;
    return best < far ? { d: best, align: al, nx: bnx / hl, nz: bnz / hl } : null;
  }
  // (the old element-BOX test 'boxFree' is gone: law D1's questions measure the real triangles - dress-questions.js hitBox)
  var placedBoxes = [];
  window.__dressPlacedBoxes = placedBoxes;      // dress-kit.js (2026-11-24) adds the pieces it built from 2D symbols: nothing is placed into them
  function mineFree(lo, hi) { for (var i = 0; i < placedBoxes.length; i++) { var b = placedBoxes[i];
    if (b[0][0] < hi[0] && b[1][0] > lo[0] && b[0][1] < hi[1] && b[1][1] > lo[1] && b[0][2] < hi[2] && b[1][2] > lo[2]) return false; } return true; }
  function topUnder(mesh, tris, x, z) {                    // the highest surface of these triangles under (x, z)
    var pos = mesh.geometry.getAttribute('position'), idx = mesh.geometry.getIndex(), best = -Infinity;
    for (var i = 0; i < tris.length; i++) { var a = idx.getX(tris[i] * 3), b = idx.getX(tris[i] * 3 + 1), c = idx.getX(tris[i] * 3 + 2);
      var ax = pos.getX(a), az = pos.getZ(a), bx = pos.getX(b), bz = pos.getZ(b), cx = pos.getX(c), cz = pos.getZ(c), den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (den > -1e-12 && den < 1e-12) continue; var l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / den, l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / den, l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue; var y = l1 * pos.getY(a) + l2 * pos.getY(b) + l3 * pos.getY(c); if (y > best) best = y; }
    return best;
  }
  function partTris(el, part, MATS) {
    var out = [], t = el.triStart, k;
    if (part && el.mats && el.mats.length) el.mats.forEach(function (r) { var nm = r[1] >= 0 ? (MATS[r[1]] || {}).name : '(none)'; if (nm === part) for (var j = 0; j < r[0]; j++) out.push(t + j); t += r[0]; });
    else for (k = 0; k < el.triCount; k++) out.push(el.triStart + k);
    return out;
  }
  function yawQ(y) { return [0, Math.sin(y / 2), 0, Math.cos(y / 2)]; }
  // ⛔ MEASURED 2026-11-12 (law D1 refused all 11 laid tables): the dining hall's tables are turned ~26 degrees and every
  // direction here was snapped to the building's axes - plates and saucers hung over the edges. A piece of furniture has
  // its OWN axes: the turn of the smallest rectangle around its points. round = it has none (a round table).
  function axisOf(pts) {
    var bestA = 0, bestS = 1e18, worst = 0;
    for (var dg = 0; dg < 90; dg += 0.5) { var a = dg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), mnu = 1e9, mxu = -1e9, mnv = 1e9, mxv = -1e9;
      for (var i = 0; i < pts.length; i++) { var u = pts[i][0] * c + pts[i][1] * s, v = -pts[i][0] * s + pts[i][1] * c; if (u < mnu) mnu = u; if (u > mxu) mxu = u; if (v < mnv) mnv = v; if (v > mxv) mxv = v; }
      var S = (mxu - mnu) * (mxv - mnv); if (S < bestS) { bestS = S; bestA = a; } if (S > worst) worst = S; }
    return { a: bestA, round: bestS / (worst || 1) > 0.85 };
  }
  // the one of the furniture's 4 directions nearest to (vx, vz); a round piece: (vx, vz) itself
  function face(ax, vx, vz) { var l = Math.hypot(vx, vz) || 1; vx /= l; vz /= l; if (ax.round) return [vx, vz];
    var best = null, bd = -2; for (var k = 0; k < 4; k++) { var a = ax.a + k * Math.PI / 2, c = Math.cos(a), s = Math.sin(a), dt = c * vx + s * vz; if (dt > bd) { bd = dt; best = [c, s]; } } return best; }
  function ptsOf(mesh, tris) { var pos = mesh.geometry.getAttribute('position'), idx = mesh.geometry.getIndex(), P = []; tris.forEach(function (t) { for (var k = 0; k < 3; k++) { var v = idx.getX(t * 3 + k); P.push([pos.getX(v), pos.getZ(v)]); } }); return P; }
  window.__dressPlaceObjects = function (PLAN, SIZES, zoneOf) {
    var WM = window.WM, MATS = (WM.pack.manifest && WM.pack.manifest.materials) || [], out = [], log = { placed: {}, refused: {} };
    function ok(it) { log.placed[it] = (log.placed[it] || 0) + 1; }
    function no(it, why) { var k = it + ': ' + why; log.refused[k] = (log.refused[k] || 0) + 1; }
    function half(it) { var s = SIZES[it]; return s ? [(s.max[0] - s.min[0]) / 2, s.max[1] - s.min[1], (s.max[2] - s.min[2]) / 2] : [0.3, 0.5, 0.3]; }
    var rooms = {}; (WM.pack.manifest.rooms || []).forEach(function (r) { if (String(r.level || '').indexOf(PLAN.level) >= 0) rooms[r.number] = r; });
    // NOBODY FLOATS (his words 2026-11-11 "this man is floating"): a spot on the floor needs a real floor under it at the room's
    // level - the viewer's own walk floor (floorYat). The patio of the ground floor is a void over the courtyard: refused there.
    // ⛔ MEASURED 2026-11-12: the viewer's walk floor (floorYat) is made of element BOXES - it says "floor" over the whole patio
    // void (room 140) and outside the diagonal wing: wrong in 11.5% of 4,180 sampled cells. The free-floor map reads the real
    // floor triangles instead. floorOK is no longer asked.
    // LAW D1 (signed 2026-11-12): nothing is placed before its question list is answered by measurement (dress-questions.js).
    var Q = window.__dressQ; if (!Q) { console.error('[dress] no question engine (dress-questions.js): by law D1 nothing is placed'); return { placed: [], log: log, answers: [] }; }
    if (!PLAN.__keepQ) Q.reset();                      // several levels in one plan: the record is kept from level to level
    var rk = Object.keys(rooms), y0 = rk.length ? rooms[rk[0]].pos[1] : (PLAN.levelY || 0);
    // THE LEVEL'S REAL FLOOR IS MEASURED (2026-11-19, the second building: its rooms say level 0 and stand on a floor 2 m lower -
    // every spot was refused 'no floor'). The floor is read under the rooms; the model's level number is only the first guess.
    // Five rays per room; the heights are grouped (0.3 m). The group with the most rays is the floor - unless a group near the
    // model's own level (0.5 m) holds a third of the rays: then the model is believed (a room over a void has few rays on its own floor).
    (function () { var fmesh = WM.pack.meshes.get('Floors'), T3 = WM.THREE, hits = []; if (!fmesh) return;
      rk.forEach(function (k) { var r = rooms[k]; [[0, 0], [0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]].forEach(function (o) { var rc = new T3.Raycaster(new T3.Vector3(r.pos[0] + o[0], r.pos[1] + 1.4, r.pos[2] + o[1]), new T3.Vector3(0, -1, 0)); rc.far = 6;
        var h = rc.intersectObject(fmesh, false).filter(function (x) { return x.face && x.face.normal.y > 0.5; }); if (h.length) hits.push(h[0].point.y); }); });
      if (!hits.length) return; var groups = []; hits.sort(function (a, b) { return a - b; }).forEach(function (y) { var g = groups[groups.length - 1]; if (g && y - g.max <= 0.3) { g.n++; g.sum += y; g.max = y; } else groups.push({ n: 1, sum: y, max: y, min: y }); });
      var most = groups.slice().sort(function (a, b) { return b.n - a.n; })[0], near = groups.filter(function (g) { return Math.abs(g.sum / g.n - y0) <= 0.5; }).sort(function (a, b) { return b.n - a.n; })[0];
      var pick = near && near.n >= hits.length / 3 ? near : most, y = Math.round(pick.sum / pick.n * 100) / 100;
      if (Math.abs(y - y0) > 0.02) { console.log('[dress] level ' + PLAN.level + ': the rooms say ' + y0 + ', the floor under them is at ' + y + ' (' + pick.n + ' of ' + hits.length + ' rays) - the measured floor is used'); y0 = y; } })();
    // two level plans on ONE floor (rooms of one Revit level, furniture of another): the second knows what the first placed
    var sameFloor = PLAN.__keepQ && window.__dressShared && Math.abs(window.__dressShared.y0 - y0) < 0.3;
    // the pieces dress-kit.js built on this floor are spots too (2026-11-24): a plant or a person keeps clear of a bed or a counter
    var kitSpots = []; Object.keys(window.__dressKitSpots || {}).forEach(function (k) { if (Math.abs(+k - y0) < 0.3) kitSpots = kitSpots.concat(window.__dressKitSpots[k]); });
    var map = Q.map(y0), spots = sameFloor ? window.__dressShared.spots : kitSpots, ctx = { plan: PLAN, spots: spots };
    function elIndex(el) { return WM.pack.elements.indexOf(el); }
    var OPENING = { 'Doors': 1, 'Windows': 1, 'Curtain Panels': 1 };
    function openFree(lo, hi, pad) {                          // no door, window or glass panel box inside this box
      var E = WM.pack.elements; for (var i = 0; i < E.length; i++) { var e = E[i], b = e.bbox; if (!b || !OPENING[e.cat]) continue;
        if (b.min[0] - pad < hi[0] && b.max[0] + pad > lo[0] && b.min[1] < hi[1] && b.max[1] > lo[1] && b.min[2] - pad < hi[2] && b.max[2] + pad > lo[2]) return false; }
      return true; }
    var usedDir = {}, DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    // a free flat wall of this room for an item w2 half-wide. floorOff = 0: on the wall; > 0: on the floor, that far from it
    // LAW D1: the searches only PROPOSE spots. Every proposed spot is then ASKED the whole question list of its kind.
    // A WALL ITEM (a clock, a painting): a wall ahead of the room point, in the 4 building directions and 0.7 m steps to each
    // side. A wall met at an angle (the diagonal wing is turned 26 degrees) is looked at again STRAIGHT ON, along its own normal.
    function wallSpot(room, it, h, w2, hh) {
      var kind = 'wall_item', where = 'room ' + room, tally = {}, tried = 0, last = null;
      var r = rooms[room]; if (!r) { no(it, 'no room ' + room); Q.refuse(it, kind, where, 0, { no_room: 1 }); return null; }
      var oy = r.pos[1] + h, used = usedDir[room] || (usedDir[room] = {});
      var SL = [0, 0.7, -0.7, 1.4, -1.4, 2.1, -2.1, 2.8, -2.8];
      for (var kk = 0; kk < 4 * SL.length; kk++) { var k = Math.floor(kk / SL.length), sl = SL[kk % SL.length]; if (used[k]) continue;
        var dx = DIRS[k][0], dz = DIRS[k][1], sx = -dz, sz = dx;
        if (sl) { var side = rayWall(r.pos[0], oy, r.pos[2], sx * Math.sign(sl), sz * Math.sign(sl), 9); if (side && side.d < Math.abs(sl) + w2 + 0.25) continue; }
        // 4.5 m at most: a longer ray has gone through a doorway into the next room (seen: rooms 101 and 108)
        var px = r.pos[0] + sx * sl, pz = r.pos[2] + sz * sl, c = rayWall(px, oy, pz, dx, dz, 4.5);
        if (!c) continue;                                     // no wall ahead of this point: not a spot to ask about
        if (c.align < 0.97 && c.align > 0.3) {                // met at an angle: turn to face this wall
          var sg = (c.nx * dx + c.nz * dz) > 0 ? 1 : -1; dx = c.nx * sg; dz = c.nz * sg; sx = -dz; sz = dx; c = rayWall(px, oy, pz, dx, dz, 4.5); if (!c) continue; }
        var dev = 0; [[w2 + 0.15, 0], [-w2 - 0.15, 0], [0, hh], [0, -hh]].forEach(function (o) { var q = rayWall(px + sx * o[0], oy + o[1], pz + sz * o[0], dx, dz, 4.6), dd = q ? Math.abs(q.d - c.d) : 9; if (dd > dev) dev = dd; });
        var hx = px + dx * c.d, hz = pz + dz * c.d, cx = hx - dx * 0.02, cz = hz - dz * 0.02;
        var e2x = Math.abs(sx) * (w2 + 0.1) + Math.abs(dx) * 0.3, e2z = Math.abs(sz) * (w2 + 0.1) + Math.abs(dz) * 0.3;
        var lo = [cx - e2x, oy - hh - 0.1, cz - e2z], hi = [cx + e2x, oy + hh + 0.1, cz + e2z];
        // the 25 cm in front of the wall (from 3 cm off it), over the item's own width and height, in the WALL's own axes
        var res = Q.ask(kind, { map: map, x: cx, z: cz, hx: w2, hz: w2, turn: { x: hx, z: hz, ux: sx, uz: sz }, box: [[-w2, oy - hh, 0.03], [w2, oy + hh, 0.25]],
          given: { height: h, wall_found: true, wall_square: c.align, wall_flat: dev, not_on_opening: openFree(lo, hi, 0.15), apart: mineFree(lo, hi) } }, ctx);
        tried++; last = res;
        if (!res.ok) { tally[res.failed] = (tally[res.failed] || 0) + 1; continue; }
        used[k] = 1; placedBoxes.push([lo, hi]);
        return { x: cx, y: oy, z: cz, dx: dx, dz: dz, floor: r.pos[1], res: res }; }
      if (!tried) tally.wall_found = 1;
      Q.refuse(it, kind, where, tried, tally, last); no(it, 'no spot in room ' + room + ' passes the questions'); return null;
    }
    // A FLOOR ITEM (a plant, a basket, a wheelchair): proposed FROM THE FREE-FLOOR MAP - every free cell in sight of the room
    // point that stands about one item-depth from something wall-high (1 - 2 m), nearest first. The wall behind is then
    // measured by rays: its own direction (any angle), flat over the item's width. hs = [half width, height, half depth].
    function floorItemSpot(room, it, hs, off) {
      var kind = 'floor_item', where = 'room ' + room, tally = {}, tried = 0, last = null, at = [];
      var r = rooms[room]; if (!r) { no(it, 'no room ' + room); Q.refuse(it, kind, where, 0, { no_room: 1 }); return null; }
      var al = hs[0] + 0.02, dp = hs[2] + 0.02, back = Math.max(off || 0, dp + 0.05), rad = Math.max(al, dp), cands = [];
      for (var gz = -5; gz <= 5.001; gz += 0.2) for (var gx = -5; gx <= 5.001; gx += 0.2) { var x = r.pos[0] + gx, z = r.pos[2] + gz, cl = map.clearAt(x, z);
        if (cl < Math.min(al, dp) || cl > back + 0.35 || map.floorAt(x, z) == null) continue;
        var bd = 9, ba = 0; for (var a = 0; a < 32; a++) { var op = map.openAhead(x, z, a * Math.PI / 16); if (op < bd) { bd = op; ba = a * Math.PI / 16; } }
        if (bd > back + 0.45 || !map.lineFree(r.pos[0], r.pos[2], x, z)) continue;   // the near thing is not wall-high, or the cell is not in sight (another room)
        cands.push({ x: x, z: z, a: ba, d: Math.hypot(gx, gz) }); }
      cands.sort(function (p, q) { return p.d - q.d; });
      for (var i = 0; i < cands.length && tried < 40; i++) { var cd = cands[i], dx = Math.sin(cd.a), dz = Math.cos(cd.a);
        var c = rayWall(cd.x, y0 + 1.0, cd.z, dx, dz, 2); if (!c) continue;        // the wall-high thing is glass or a column, not a wall: not proposed
        if (c.align < 0.999) { var sg = (c.nx * dx + c.nz * dz) > 0 ? 1 : -1; dx = c.nx * sg; dz = c.nz * sg; c = rayWall(cd.x, y0 + 1.0, cd.z, dx, dz, 2); if (!c) continue; }
        var sx = -dz, sz = dx, hx = cd.x + dx * c.d, hz = cd.z + dz * c.d, cx = hx - dx * back, cz = hz - dz * back, dev = 0;
        if (at.some(function (q) { return Math.hypot(q[0] - cx, q[1] - cz) < 0.45; })) continue; at.push([cx, cz]);   // this piece of wall was already asked about
        [al, -al].forEach(function (o) { var q = rayWall(cd.x + sx * o, y0 + 1.0, cd.z + sz * o, dx, dz, 2.2), dd = q ? Math.abs(q.d - c.d) : 9; if (dd > dev) dev = dd; });
        // ⛔ MEASURED 2026-11-13: 'a floor under the whole item' was asked for a SQUARE around the item along the building's axes;
        // against a wall turned 26 degrees the square's corner lies in the wall, so every floor item of the turned wing was refused
        // (floor_under 0.94 - 0.99). The floor is now asked under the item's inner footprint; its true turned box is asked against
        // the real surfaces by 'space_free'.
        var inr = Math.min(al, dp) * 0.8;
        var res = Q.ask(kind, { map: map, x: cx, z: cz, hx: inr, hz: inr, r: rad, sizeMax: 2 * Math.max(hs[0], hs[2]), reachR: rad + 0.5,
          turn: { x: cx, z: cz, ux: sx, uz: sz }, box: [[-al, y0 + 0.05, -dp], [al, y0 + Math.max(0.3, hs[1]), dp]], given: { wall_found: c.align >= 0.97 && dev <= 0.03 } }, ctx);
        tried++; last = res;
        if (!res.ok) { tally[res.failed] = (tally[res.failed] || 0) + 1; continue; }
        spots.push({ x: cx, z: cz, r: rad }); placedBoxes.push([[cx - rad, y0 + 0.05, cz - rad], [cx + rad, y0 + Math.max(0.3, hs[1]), cz + rad]]);
        return { x: cx, z: cz, dx: dx, dz: dz, floor: y0, res: res }; }
      if (!tried) tally.wall_found = 1;
      Q.refuse(it, kind, where, tried, tally, last); no(it, 'no spot in room ' + room + ' passes the questions'); return null;
    }
    (PLAN.objects || []).forEach(function (o) {
      var hs = half(o.item), file = o.item + '/' + o.item + '.gltf';
      if (o.how === 'onTop') {
        var n = 0, seen = 0;
        WM.pack.elements.forEach(function (el) {
          if (el.name !== o.of.name || String(el.level || '').indexOf(PLAN.level) < 0) return;
          if (o.zones && o.zones.indexOf(zoneOf(el).id) < 0) return;
          var i = seen++; if (i < (o.start || 0) || (i - (o.start || 0)) % (o.every || 1) !== 0 || (o.max && n >= o.max)) return;
          var mesh = WM.pack.meshes.get(el.mesh), tris = partTris(el, o.of.part, MATS), where = el.name + ' #' + el.id, ei = elIndex(el), tally = {}, tried = 0, last = null;
          if (!tris.length) { Q.refuse(o.item, 'table_top_item', where, 0, { top_found: 1 }); return no(o.item, 'no such part on ' + el.name); }
          var pos = mesh.geometry.getAttribute('position'), idx = mesh.geometry.getIndex(), lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
          tris.forEach(function (t) { for (var k = 0; k < 3; k++) { var v = idx.getX(t * 3 + k), P = [pos.getX(v), pos.getY(v), pos.getZ(v)]; for (var a = 0; a < 3; a++) { if (P[a] < lo[a]) lo[a] = P[a]; if (P[a] > hi[a]) hi[a] = P[a]; } } });
          var done = false;
          for (var gi = 0; gi < 26 && !done; gi++) {         // the centre first, then a 5 x 5 grid over the top
            var g = gi - 1, fx = gi === 0 ? 0.5 : (g % 5 + 0.5) / 5, fz = gi === 0 ? 0.5 : (Math.floor(g / 5) + 0.5) / 5, x = lo[0] + (hi[0] - lo[0]) * fx, z = lo[2] + (hi[2] - lo[2]) * fz;
            var y = topUnder(mesh, tris, x, z); if (y < hi[1] - 0.03) continue;
            for (var yw = 0; yw < 2 && !done; yw++) { var ex = (yw ? hs[2] : hs[0]) * 0.85, ez = (yw ? hs[0] : hs[2]) * 0.85, dev = 0;   // the base = 85% of the item's box (leaves reach wider than the pot)
              [[ex, ez], [-ex, ez], [ex, -ez], [-ex, -ez]].forEach(function (c) { var dd = Math.abs(topUnder(mesh, tris, x + c[0], z + c[1]) - y); if (!(dd < 9)) dd = 9; if (dd > dev) dev = dd; });
              var bl = [x - ex, y + 0.01, z - ez], bh = [x + ex, y + hs[1], z + ez];
              var res = Q.ask('table_top_item', { map: map, x: x, z: z, hx: ex, hz: ez, skipEl: ei, box: [[x - ex, y + 0.02, z - ez], [x + ex, y + Math.max(0.05, hs[1]), z + ez]],
                given: { top_found: true, top_flat: dev, apart: mineFree(bl, bh) } }, ctx);
              tried++; last = res; if (!res.ok) { tally[res.failed] = (tally[res.failed] || 0) + 1; continue; }
              placedBoxes.push([bl, bh]); out.push({ file: file, pos: [x, y, z], quat: yawQ(yw ? Math.PI / 2 : 0), scale: [1, 1, 1], on: el.id }); Q.record(o.item, where, res, [x, y, z]); ok(o.item); n++; done = true; }
          }
          if (!done) { Q.refuse(o.item, 'table_top_item', where, tried, tally, last); no(o.item, 'no spot on ' + el.name + ' passes the questions'); }
        });
      } else if (o.how === 'laySettings') {
        // A TABLE LAID LIKE A RESTAURANT (his words "the plates are not ordered as table in restaurant"): in front of EVERY chair
        // a plate, and to the sitter's right a saucer with a cup; the teapot and the sugar bowl in the middle. The pieces are
        // single nodes of one model (o.pieces). Every piece must stand on the table top, or it is refused.
        // LAW D1: the whole table is planned first (every piece as a shape of its real size, read from the model file), then the
        // table is ASKED its questions - a setting for every chair, every piece fully on the top, no piece inside another.
        // A table that fails one question gets NO pieces (a half-laid table is a wrong table).
        var P = o.pieces, nT = 0;
        function psz(node) { return Q.pieceSize(file, node) || { hx: 0.1, hz: 0.1, h: 0.05 }; }
        WM.pack.elements.forEach(function (el) {
          if (o.of.names.indexOf(el.name) < 0 || String(el.level || '').indexOf(PLAN.level) < 0) return;
          if (o.zones && o.zones.indexOf(zoneOf(el).id) < 0) return;
          var where = el.name + ' #' + el.id, ei = elIndex(el);
          var mesh = WM.pack.meshes.get(el.mesh), top = partTris(el, o.of.part, MATS);
          if (!top.length) { Q.refuse('table setting', 'table_setting', where, 0, { top_found: 1 }); return no('table setting', 'no top on ' + el.name); }
          var pos = mesh.geometry.getAttribute('position'), idx = mesh.geometry.getIndex(), hiY = -1e9, cx = 0, cz = 0, cn = 0;
          top.forEach(function (t) { for (var k = 0; k < 3; k++) { var v = idx.getX(t * 3 + k); if (pos.getY(v) > hiY) hiY = pos.getY(v); cx += pos.getX(v); cz += pos.getZ(v); cn++; } });
          cx /= cn; cz /= cn;
          function onTop(x, z) { return topUnder(mesh, top, x, z) >= hiY - 0.03; }
          function put(node, x, z, yaw, dy) { out.push({ file: file, node: node, pos: [x, hiY + (dy || 0), z], quat: yawQ(yaw), scale: [1, 1, 1], on: el.id }); }
          var chairs = chairsOf(el), noReach = 0, settings = 0, todo = [], shapes = [];
          // stack = true: the piece sits ON the piece before it (a cup on its saucer, a lid on its pot) - not a shape of its own
          // a piece turned by yaw: its own x axis lies along (cos yaw, -sin yaw), its z axis along (sin yaw, cos yaw)
          function piece(node, x, z, yaw, dy, stack) { var s = psz(node); todo.push([node, x, z, yaw, dy]);
            if (!stack) shapes.push({ x: x, z: z, hx: s.hx, hz: s.hz, ux: Math.cos(yaw), uz: -Math.sin(yaw), vx: Math.sin(yaw), vz: Math.cos(yaw), round: Math.abs(s.hx - s.hz) < 0.01 }); }
          var tax2 = axisOf(ptsOf(mesh, top)), ta = tax2.round ? 0 : tax2.a, tux = Math.cos(ta), tuz = Math.sin(ta);
          chairs.forEach(function (c) {
            var fx = c.fx, fz = c.fz, rx = -fz, rz = fx, yaw = Math.atan2(-fx, -fz), d, x = 0, z = 0;
            for (d = 0; d <= 0.9; d += 0.02) { x = c.x + fx * d; z = c.z + fz * d; if (onTop(x, z) && onTop(x + fx * 0.12, z + fz * 0.12)) break; }   // the table EDGE in front of the chair (seen: plates bunched in the middle)
            if (d > 0.9) { noReach++; return; }
            x += fx * 0.15; z += fz * 0.15;                           // the plate's centre 0.15 m in from the edge
            piece(P.plate, x, z, yaw, 0); piece(P.saucer, x + rx * 0.22, z + rz * 0.22, yaw, 0); piece(P.cup, x + rx * 0.22, z + rz * 0.22, yaw, 0.012, true); settings++;
          });
          piece(P.teapot, cx - 0.12 * tux, cz - 0.12 * tuz, -ta, 0); piece(P.teapotLid, cx - 0.12 * tux, cz - 0.12 * tuz, -ta, 0.002, true);   // along the table's own axis
          piece(P.sugar, cx + 0.14 * tux, cz + 0.14 * tuz, -ta, 0); piece(P.sugarLid, cx + 0.14 * tux, cz + 0.14 * tuz, -ta, 0, true);
          var off = 0, ov = 0;
          shapes.forEach(function (a, i) {
            var pts = a.round ? [[a.hx, 0], [-a.hx, 0], [0, a.hz], [0, -a.hz]] : [[a.hx, a.hz], [-a.hx, a.hz], [a.hx, -a.hz], [-a.hx, -a.hz]];
            a.off = !pts.every(function (p) { return onTop(a.x + a.ux * p[0] + a.vx * p[1], a.z + a.uz * p[0] + a.vz * p[1]); }); if (a.off) off++;
            for (var j = i + 1; j < shapes.length; j++) { var b = shapes[j], R = a.round ? b : a, Cc = a.round ? a : b, ddx = Cc.x - R.x, ddz = Cc.z - R.z, hit;
              if (a.round && b.round) hit = Math.hypot(ddx, ddz) < a.hx + b.hx - 0.005;
              else if (!a.round && !b.round) hit = Math.hypot(ddx, ddz) < Math.max(a.hx, a.hz) + Math.max(b.hx, b.hz) - 0.005;
              else hit = Math.abs(ddx * R.ux + ddz * R.uz) < R.hx + Cc.hx - 0.005 && Math.abs(ddx * R.vx + ddz * R.vz) < R.hz + Cc.hx - 0.005;   // a round piece against a long one, in the long one's own axes
              if (hit) ov++; } });
          var res = Q.ask('table_setting', { map: map, x: cx, z: cz, hx: 0.3, hz: 0.3, skipEl: ei, all: true, box: [[cx - 0.3, hiY + 0.02, cz - 0.3], [cx + 0.3, hiY + 0.3, cz + 0.3]],
            given: { chairs_found: chairs.length, every_chair_reaches: noReach, setting_per_chair: chairs.length > 0 && settings === chairs.length, pieces_on_top: off, pieces_overlap: ov } }, ctx);
          res.answers.push({ id: 'detail', value: JSON.stringify({ centre: [+cx.toFixed(2), +cz.toFixed(2)], chairs: chairs.map(function (c) { return [+(c.x - cx).toFixed(2), +(c.z - cz).toFixed(2), c.fx, c.fz]; }), shapes: shapes.map(function (s) { return [+(s.x - cx).toFixed(2), +(s.z - cz).toFixed(2), +s.hx.toFixed(3), +s.hz.toFixed(3), s.off ? 'OFF' : 'on']; }) }), pass: true });
          if (!res.ok) { var tl = {}; tl[res.failed] = 1; Q.refuse('table setting', 'table_setting', where, 1, tl, res); return no('table setting', el.name + ': ' + res.failed); }
          todo.forEach(function (p) { put(p[0], p[1], p[2], p[3], p[4]); });
          Q.record('table setting', where, res, [cx, hiY, cz]); ok('table setting'); nT++;
        });
      } else if (o.how === 'painting') {
        // PAINTINGS WITH FRAMES (his words "i want paintings with frames on the walls"; his OK for 12 public-domain paintings,
        // Art Institute of Chicago CC0). Our own frame (4 wooden bars + the canvas), sized from the picture's own proportions,
        // hung on a free flat wall by the same checks as the clock.
        var x = new XMLHttpRequest(); x.open('GET', 'bakelib/paintings/paintings.json?v=' + Date.now(), false); x.send();
        var PL = JSON.parse(x.responseText), pi = 0;
        (o.rooms || []).forEach(function (room) {
          var pc = PL[pi % PL.length], ar = pc.w / pc.h, W = ar >= 1 ? o.maxW : o.maxH * ar, Hh = ar >= 1 ? o.maxW / ar : o.maxH;
          if (Hh > o.maxH) { Hh = o.maxH; W = Hh * ar; }
          var s = wallSpot(room, 'painting', o.height || 1.5, W / 2 + o.border, Hh / 2 + o.border, 0); if (!s) return;
          out.push({ build: 'painting', pic: pc, W: W, H: Hh, border: o.border, frame: o.frameColor, pos: [s.x + s.dx * 0.01, s.y, s.z + s.dz * 0.01], quat: yawQ(Math.atan2(-s.dx, -s.dz)), scale: [1, 1, 1], room: room });
          Q.record('painting', 'room ' + room, s.res, [s.x, s.y, s.z]); ok('painting'); pi++;
        });
      } else if (o.how === 'onWall') {
        (o.rooms || []).forEach(function (room) { var s = wallSpot(room, o.item, o.height || 1.5, hs[0], hs[1] / 2, 0); if (!s) return;
          out.push({ file: file, pos: [s.x + s.dx * 0.015, s.y, s.z + s.dz * 0.015], quat: yawQ(Math.atan2(-s.dx, -s.dz)), scale: [1, 1, 1], room: room }); Q.record(o.item, 'room ' + room, s.res, [s.x, s.y, s.z]); ok(o.item); });
      } else if (o.how === 'byWall') {
        (o.rooms || []).forEach(function (room) { var s = floorItemSpot(room, o.item, hs, o.off || 0.45); if (!s) return;
          out.push({ file: file, pos: [s.x, s.floor, s.z], quat: yawQ(Math.atan2(-s.dx, -s.dz)), scale: [1, 1, 1], room: room }); Q.record(o.item, 'room ' + room, s.res, [s.x, s.floor, s.z]); ok(o.item); });
      }
    });
    // ---- PEOPLE (posed models in bakelib/people/, Microsoft Rocketbox MIT): on the model's OWN chairs, or standing in a room ----
    // A posed model faces +Z and its origin is under the pelvis. The plan says who sits at which table set and chair.
    function centroidXZ(mesh, tris) { var pos = mesh.geometry.getAttribute('position'), idx = mesh.geometry.getIndex(), x = 0, z = 0, n = 0;
      tris.forEach(function (t) { for (var k = 0; k < 3; k++) { var v = idx.getX(t * 3 + k); x += pos.getX(v); z += pos.getZ(v); n++; } }); return n ? [x / n, z / n] : null; }
    function islandsOf(mesh, tris) {                         // groups of triangles that share vertices
      var idx = mesh.geometry.getIndex(), n = tris.length, parent = new Int32Array(n), vert = {}, i, k;
      for (i = 0; i < n; i++) parent[i] = i;
      function find(a) { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; }
      for (i = 0; i < n; i++) for (k = 0; k < 3; k++) { var v = idx.getX(tris[i] * 3 + k), p = vert[v]; if (p === undefined) vert[v] = i; else { var ra = find(i), rb = find(p); if (ra !== rb) parent[ra] = rb; } }
      var g = {}; for (i = 0; i < n; i++) { var r = find(i); (g[r] || (g[r] = [])).push(tris[i]); }
      return Object.keys(g).map(function (q) { return g[q]; });
    }
    function chairsOf(el) {                                 // [{ x, z, fx, fz }]: where a sitter's pelvis goes and the way they face
      var mesh = WM.pack.meshes.get(el.mesh), pos = mesh.geometry.getAttribute('position'), idx = mesh.geometry.getIndex();
      var top = partTris(el, 'Glass table top', MATS), isSet = el.mats && el.mats.length && top.length && top.length < el.triCount;
      if (!isSet) {                                          // a single chair: the backrest is what stands above 65% of its height
        var b = el.bbox, cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2, yb = b.min[1] + 0.65 * (b.max[1] - b.min[1]), sx = 0, sz = 0, n = 0;
        for (var t = el.triStart * 3; t < (el.triStart + el.triCount) * 3; t++) { var v = idx.getX(t); if (pos.getY(v) > yb) { sx += pos.getX(v); sz += pos.getZ(v); n++; } }
        if (!n) return []; var all = []; for (var t2 = el.triStart; t2 < el.triStart + el.triCount; t2++) all.push(t2);
        var f = face(axisOf(ptsOf(mesh, all)), cx - sx / n, cz - sz / n); return [{ x: cx, z: cz, fx: f[0], fz: f[1] }];
      }
      // a table set: the seats and backs are the triangles with no Revit material; islands within 0.4 m are one chair
      var tc = centroidXZ(mesh, top), cl = [], tax = axisOf(ptsOf(mesh, top));
      islandsOf(mesh, partTris(el, '(none)', MATS)).forEach(function (isl) { var c = centroidXZ(mesh, isl), hit = null;
        cl.forEach(function (q) { if (!hit && Math.hypot(q.x - c[0], q.z - c[1]) < 0.4) hit = q; });
        if (hit) { var w = isl.length / (hit.n + isl.length); hit.x += (c[0] - hit.x) * w; hit.z += (c[1] - hit.z) * w; hit.n += isl.length; } else cl.push({ x: c[0], z: c[1], n: isl.length }); });
      // counted AROUND the table (by angle), so chair k and chair k + half are opposite each other
      cl.sort(function (p, q) { return Math.atan2(p.z - tc[1], p.x - tc[0]) - Math.atan2(q.z - tc[1], q.x - tc[0]); });
      // the centre of seat + back lies behind the seat's own centre: the sitter goes 0.10 m forward of it (seen in the render)
      return cl.map(function (q) { var f = face(tax, tc[0] - q.x, tc[1] - q.z); return { x: q.x + f[0] * 0.10, z: q.z + f[1] * 0.10, fx: f[0], fz: f[1], ax: tax }; });
    }
    var seated = [];
    (PLAN.people || []).forEach(function (p) {
      var file = '../people/' + p.who + (PLAN.peopleMove ? '__anim' : '') + '.glb';   // '__anim' = skeleton + an idle loop (people2anim.py)
      if (p.how === 'sitAt') {
        var sets = WM.pack.elements.filter(function (el) { return el.name === p.of.name && String(el.level || '').indexOf(PLAN.level) >= 0 && (!p.zones || p.zones.indexOf(zoneOf(el).id) >= 0); });
        // LAW D1: a seated person is asked the 'seated_person' list - a real chair, free, standing on the floor, a seat at
        // sitting height under the body (measured on the chair's own surfaces), nobody too near, nothing through the upper body.
        var el = sets[p.set || 0], wh = (p.of.name || '') + ' set ' + (p.set || 0) + ' chair ' + (p.chair || 0);
        var ch = el ? chairsOf(el) : [], c = ch[p.chair || 0];
        if (!el || !c) { Q.refuse(p.who, 'seated_person', wh, 0, { chair_found: 1 }); return no(p.who, !el ? 'no such table set / chair' : 'no chair ' + (p.chair || 0) + ' (found ' + ch.length + ') on ' + el.name); }
        var key = el.id + ':' + (p.chair || 0), ei = elIndex(el), fy = map.floorAt(c.x, c.z), seat = Q.surfaceUnder(ei, c.x, c.z, el.bbox.min[1] + 0.7);
        var rs = Q.ask('seated_person', { map: map, x: c.x, z: c.z, hx: 0.2, hz: 0.2, r: 0.2, skipEl: ei, all: true, box: [[c.x - 0.2, el.bbox.min[1] + 0.8, c.z - 0.2], [c.x + 0.2, el.bbox.min[1] + 1.25, c.z + 0.2]],
          given: { chair_found: true, chair_free: seated.indexOf(key) < 0, chair_on_floor: fy == null ? null : Math.abs(el.bbox.min[1] - fy), seat_height: seat == null ? null : seat - el.bbox.min[1] } }, ctx);
        if (!rs.ok) { var ts = {}; ts[rs.failed] = 1; Q.refuse(p.who, 'seated_person', wh, 1, ts, rs); return no(p.who, 'the chair fails the question ' + rs.failed); }
        seated.push(key); spots.push({ x: c.x, z: c.z, r: 0.2, person: true });
        out.push({ file: file, pos: [c.x, el.bbox.min[1], c.z], quat: yawQ(Math.atan2(c.fx, c.fz)), scale: [1, 1, 1], on: el.id, person: true }); Q.record(p.who, wh, rs, [c.x, el.bbox.min[1], c.z]); ok(p.who);
      } else if (p.how === 'standAt') {
        // LAW D1: the rings around the room point only PROPOSE spots. Every spot is asked the whole 'standing_person' list
        // (the room fits the person, a floor under both feet, flat, 0.45 m of elbow room, clear of doors, reachable from a
        // door, apart from others, the way stays open, faces a person or open space, the body's space is empty).
        var r = rooms[p.room]; if (!r) { Q.refuse(p.who, 'standing_person', 'room ' + p.room, 0, { no_room: 1 }); return no(p.who, 'no room ' + p.room); }
        // A SPOT THE PLAN NAMES (2026-11-23, his words "add a receptionist on the reception desk"): p.at = [x, z] is the first
        // proposal and small rings (15 cm) around it the next ones; p.face = [x, z] is where the person looks. The spot is asked
        // the same 'standing_person' list - naming a spot never skips a question.
        var C = p.at ? [p.at[0], p.at[1]] : [r.pos[0], r.pos[2]], STEP = p.at ? 0.15 : 0.5, FAR = p.at ? 0.61 : 4.01;
        var OFF = [[0, 0]], done = false, tally = {}, tried = 0, last = null;   // rings 0.5 m apart out to 4 m (a named spot: 15 cm, out to 0.6 m), 12 directions each
        for (var rr = STEP; rr <= FAR; rr += STEP) for (var aa = 0; aa < 12; aa++) OFF.push([rr * Math.cos(aa * Math.PI / 6), rr * Math.sin(aa * Math.PI / 6)]);
        for (var i = 0; i < OFF.length && !done; i++) { var x = C[0] + OFF[i][0], z = C[1] + OFF[i][1], lo = [x - 0.3, y0 + 0.1, z - 0.3], hi = [x + 0.3, y0 + 1.8, z + 0.3];
          if (i && (function () { var d = Math.hypot(OFF[i][0], OFF[i][1]), w = rayWall(C[0], r.pos[1] + 1.0, C[1], OFF[i][0] / d, OFF[i][1] / d, 9); return w && w.d < d + 0.4; })()) continue;   // never through a wall
          // the person faces the nearest person in sight (5 m), else the most open direction
          var best = null; spots.forEach(function (q) { if (!q.person) return; var d = Math.hypot(q.x - x, q.z - z); if (d < 5 && (!best || d < best.d) && map.lineFree(x, z, q.x, q.z)) best = { d: d, x: q.x, z: q.z }; });
          var yaw = p.face ? Math.atan2(p.face[0] - x, p.face[1] - z) : best ? Math.atan2(best.x - x, best.z - z) : map.mostOpen(x, z);
          var rp = Q.ask('standing_person', { map: map, x: x, z: z, hx: 0.25, hz: 0.25, r: 0.25, yaw: yaw, facesPerson: !!best || !!p.face, role: p.role, roomName: r.name, box: [lo, hi] }, ctx);
          tried++; last = rp; if (!rp.ok) { tally[rp.failed] = (tally[rp.failed] || 0) + 1; continue; }
          spots.push({ x: x, z: z, r: 0.25, person: true }); placedBoxes.push([lo, hi]);
          // ⛔ SEEN IN THE NUMBERS 2026-11-13: the balcony floor lies 6 cm under the rooms' level; the gardener was put at the level
          // itself = 6 cm in the air. A standing person's feet go on the floor the map measured under the spot.
          var fyS = map.floorAt(x, z); if (fyS == null) fyS = y0;
          out.push({ file: file, pos: [x, fyS, z], quat: yawQ(yaw), scale: [1, 1, 1], room: p.room, person: true }); Q.record(p.who, 'room ' + p.room, rp, [x, fyS, z]); ok(p.who); done = true; }
        if (!done) { Q.refuse(p.who, 'standing_person', 'room ' + p.room, tried, tally, last); no(p.who, 'no spot in room ' + p.room + ' passes the questions'); }
      }
    });
    var cache = {}, MIXERS = [], WALKERS = [];
    WM.on('frame', function (dt) { for (var i = 0; i < MIXERS.length; i++) MIXERS[i].update(dt);
      for (var w = 0; w < WALKERS.length; w++) { var W = WALKERS[w], P = W.pts, L = 0, seg = []; for (var q = 1; q < P.length; q++) { var l = Math.hypot(P[q][0] - P[q - 1][0], P[q][1] - P[q - 1][1]); seg.push(l); L += l; }
        W.s += W.dir * W.speed * Math.min(dt, 0.1); if (W.s > L) { W.s = L; W.dir = -1; } if (W.s < 0) { W.s = 0; W.dir = 1; }
        var acc = 0; for (var q2 = 0; q2 < seg.length; q2++) { if (W.s <= acc + seg[q2] || q2 === seg.length - 1) { var t = seg[q2] ? (W.s - acc) / seg[q2] : 0, a = P[q2], b = P[q2 + 1];
            W.root.position.set(a[0] + (b[0] - a[0]) * t, W.y, a[1] + (b[1] - a[1]) * t); var yw = Math.atan2((b[0] - a[0]) * W.dir, (b[1] - a[1]) * W.dir), cur = W.root.rotation.y, df = Math.atan2(Math.sin(yw - cur), Math.cos(yw - cur));
            W.root.rotation.set(0, cur + df * Math.min(1, dt * 4), 0); break; } acc += seg[q2]; } } });
    function buildPainting(it) {
      var T = WM.THREE, g = new T.Group(), b = it.border, d = 0.035, fm = new T.MeshStandardMaterial({ color: it.frame, roughness: 0.6, metalness: 0 });
      var tex = new T.TextureLoader().load('bakelib/paintings/' + it.pic.file); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 8;
      var cv = new T.Mesh(new T.PlaneGeometry(it.W, it.H), new T.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0 })); cv.position.z = d * 0.6; g.add(cv);
      [[0, it.H / 2 + b / 2, it.W + 2 * b, b], [0, -it.H / 2 - b / 2, it.W + 2 * b, b], [it.W / 2 + b / 2, 0, b, it.H], [-it.W / 2 - b / 2, 0, b, it.H]].forEach(function (r) {
        var m = new T.Mesh(new T.BoxGeometry(r[2], r[3], d), fm); m.position.set(r[0], r[1], d / 2); g.add(m); });
      g.position.fromArray(it.pos); g.quaternion.fromArray(it.quat); g.userData.notPack = true; g.userData.dressPlan = true; g.name = 'dress-painting:' + it.pic.file;
      g.traverse(function (m) { m.userData.notPack = true; }); WM.scene.add(g);
    }
    function load(list) { list.forEach(function (it) {
      if (it.build === 'painting') return buildPainting(it);
      function add(scene) { var src = scene;
        // ONE PART OF A KIT (a rock of a rock set, a shrub of a shrub set): the part keeps its own turn and size inside a holder,
        // only its place in the kit is dropped; the holder takes the spot, the turn and the scale of the plan.
        if (it.node) { src = scene.getObjectByName(it.node); if (!src) return console.error('[dress] no node', it.node, 'in', it.file);
          src = src.clone(true); src.position.set(0, 0, 0); var holder = new WM.THREE.Group(); holder.add(src); src = holder; }
        // a person is used once and keeps its own skeleton: a plain clone would leave the skin on the original's bones
        var root = (it.person || it.node) ? src : src.clone(true); root.position.fromArray(it.pos); root.quaternion.fromArray(it.quat); root.scale.fromArray(it.scale);
        root.userData.notPack = true; root.userData.dressPlan = true; root.traverse(function (m) { if (!m.isMesh) return; m.userData.notPack = true;
          if (it.person && m.material) { var mt = m.material; mt.metalness = 0;                       // hair and lashes are cut-out pictures: cut, do not blend
            if (mt.transparent || mt.alphaTest) { mt.transparent = false; mt.alphaTest = 0.5; mt.depthWrite = true; mt.side = WM.THREE.DoubleSide; } mt.needsUpdate = true; } });
        WM.scene.add(root);
        // PEOPLE THAT MOVE (his question "why the people not animated like the woman?"): the idle loop, played forward then
        // back (no seam), each person from another moment so they do not breathe in step
        var clip = c.anims && (c.anims.filter(function (x) { return x.name === (it.walk ? 'walk' : 'idle'); })[0] || c.anims.filter(function (x) { return x.name === 'idle'; })[0] || null);   // 'idle' = the retargeted loop; any other clip is a leftover of the animation file (a T-pose)
        if (it.person && clip) { var mx = new WM.THREE.AnimationMixer(root), ac = mx.clipAction(clip);
          ac.setLoop(it.walk ? WM.THREE.LoopRepeat : WM.THREE.LoopPingPong, Infinity); ac.play(); mx.setTime((MIXERS.length * 1.7) % clip.duration); MIXERS.push(mx); }
        // A PERSON WHO WALKS (his words 2026-11-13: "add 5 more peoples, 2 are walking"): along the points of a route the
        // free-floor map proved walkable, at the walk clip's own pace, turning round at each end.
        if (it.person && it.walk) WALKERS.push({ root: root, pts: it.walk.pts, speed: it.walk.speed || 0.7, s: 0, dir: 1, y: it.pos[1] }); }
      var c = cache[it.file]; if (c && c.scene) return add(c.scene); if (c) return c.wait.push(add);
      c = cache[it.file] = { wait: [add] };
      new window.GLTFLoader().load('bakelib/dress/' + it.file, function (g) { c.scene = g.scene; c.anims = g.animations; c.wait.forEach(function (f) { f(g.scene); }); }, undefined, function (e) { console.error('[dress] model', it.file, e); });
    }); }
    load(out);
    // what the night's additions (dress-more.js) share with this placer: the same map, the same taken places, the same loader
    window.__dressShared = { PLAN: PLAN, SIZES: SIZES, zoneOf: zoneOf, map: map, y0: y0, rooms: rooms, spots: spots, ctx: ctx, placedBoxes: placedBoxes, mineFree: mineFree, out: out, log: log, ok: ok, no: no,
      half: half, yawQ: yawQ, rayWall: rayWall, axisOf: axisOf, face: face, ptsOf: ptsOf, topUnder: topUnder, partTris: partTris, floorItemSpot: floorItemSpot, wallSpot: wallSpot, chairsOf: chairsOf, elIndex: elIndex, seated: seated, load: load, MATS: MATS };
    console.log('[dress] objects: ' + JSON.stringify(log));
    window.__dressAnswers = Q.answers();                     // law D1: every question and its measured answer, per item
    return { placed: out, log: log, answers: Q.answers() };
  };
})();
