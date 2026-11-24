// LOCAL ONLY (2026-11-11): A FLOOR FINISH PER ROOM. Called by dress-plan.js.
// The ground floor is ONE floor element under every room, so a room's floor is found, not read: the free-floor map's 10 cm
// grid is filled until it meets a wall, glass, a mullion, a door, a column or a railing (cut at knee and at chest height).
// The filled cells become a layer ON TOP of the floor (never the pack's geometry) that carries the floor's own baked light
// (its uv1, read from the floor triangle under each cell) and the plan's finish, 4 mm above the floor.
//
// NIGHT 2026-11-13 (his words: "the same tiles should be on all the floors (except dining - wood) and the tiles need to be
// aligned to one of the walls - calculate first tile"):
//   - plan.floorDefault = ONE finish for EVERY room of a level. The rooms are found by the machinery: every closed piece of
//     floor between walls and doors that has a ceiling above it and reaches a door.
//   - A finish with a picture of its own ('tex' in the plan's material) is LAID OUT, not sprayed over the world axes:
//       direction  = the direction most of the room's own walls run (measured from the wall faces, any angle);
//       first tile = a joint lies exactly on the face of the room's longest straight wall, and on that wall's own end;
//       one grid   = every room that runs the same direction shares the grid of the largest one, so the joints run
//                    straight through the doors (the way a tiler sets out a whole floor from the main space).
//   - 'beds' = shapes inside one floor that take a second finish (the gravel beds of the patio garden).
(function () {
  'use strict';
  var BAR = ['Walls', 'Curtain Panels', 'Curtain Wall Mullions', 'Windows', 'Doors', 'Structural Columns', 'Railings'];
  var C = 0.1, D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  // THE BORDERS OF A WHOLE LEVEL, once per height, in the free-floor map's own grid: 1 = a wall, glass, a mullion, a column
  // or a railing, 2 = a door. Every border triangle is cut by the planes at knee and chest height -> a segment.
  // The wall and glass segments at chest height are KEPT: they are the wall faces the tiles are laid from.
  var GRID = {};
  function levelGrid(WM, M, y0) {
    var key = y0.toFixed(2); if (GRID[key]) return GRID[key];
    var nx = M.nx, nz = M.nz, x0 = M.x0, z0 = M.z0, x1 = x0 + nx * C, z1 = z0 + nz * C, wall = new Uint8Array(nx * nz), segs = [];
    BAR.forEach(function (name) {
      var Ms = WM.pack.meshes.get(name); if (!Ms) return; var v = name === 'Doors' ? 2 : 1, keep = name === 'Walls' || name === 'Curtain Panels';
      function mark(x, z) { var i = Math.floor((x - x0) / C), k = Math.floor((z - z0) / C); if (i >= 0 && k >= 0 && i < nx && k < nz && (v === 2 || !wall[k * nx + i])) wall[k * nx + i] = v; }
      var p = Ms.geometry.getAttribute('position'), ix = Ms.geometry.getIndex(), n = ix ? ix.count / 3 : p.count / 3;
      [0.35, 1.1].forEach(function (hh) {
        var Y = y0 + hh;
        for (var t = 0; t < n; t++) {
          var a = ix ? ix.getX(t * 3) : t * 3, b = ix ? ix.getX(t * 3 + 1) : t * 3 + 1, c = ix ? ix.getX(t * 3 + 2) : t * 3 + 2;
          var ay = p.getY(a) - Y, by = p.getY(b) - Y, cy = p.getY(c) - Y;
          if ((ay > 0 && by > 0 && cy > 0) || (ay < 0 && by < 0 && cy < 0)) continue;
          var ax = p.getX(a), az = p.getZ(a), bxx = p.getX(b), bz = p.getZ(b), cx = p.getX(c), cz = p.getZ(c);
          if (Math.max(ax, bxx, cx) < x0 || Math.min(ax, bxx, cx) > x1 || Math.max(az, bz, cz) < z0 || Math.min(az, bz, cz) > z1) continue;
          var pts = [];
          [[ax, ay, az, bxx, by, bz], [bxx, by, bz, cx, cy, cz], [cx, cy, cz, ax, ay, az]].forEach(function (e) {
            if ((e[1] > 0) !== (e[4] > 0) && e[1] !== e[4]) { var s = e[1] / (e[1] - e[4]); pts.push([e[0] + (e[3] - e[0]) * s, e[2] + (e[5] - e[2]) * s]); } });
          if (pts.length < 2) continue;
          var Ln = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]), st = Math.max(1, Math.ceil(Ln / (C * 0.4)));
          for (var q = 0; q <= st; q++) mark(pts[0][0] + (pts[1][0] - pts[0][0]) * q / st, pts[0][1] + (pts[1][1] - pts[0][1]) * q / st);
          if (keep && hh > 1 && Ln > 0.05) segs.push(pts[0][0], pts[0][1], pts[1][0], pts[1][1]);
        }
      });
    });
    return (GRID[key] = { wall: wall, segs: segs });
  }
  // PER LEVEL, once: the floor triangle under every cell centre (the top one within 15 cm of the level), and whether the
  // cell has a ceiling or a slab above it (2 - 8 m up) = it is indoors or under a roof.
  var LEVEL = {};
  function levelData(WM, M) {
    var key = M.y0.toFixed(2); if (LEVEL[key]) return LEVEL[key];
    var nx = M.nx, nz = M.nz, x0 = M.x0, z0 = M.z0, y0 = M.y0, triAt = new Int32Array(nx * nz).fill(-1), triY = new Float32Array(nx * nz).fill(-1e9), cover = new Uint8Array(nx * nz);
    function raster(name, fn) { var Ms = WM.pack.meshes.get(name); if (!Ms) return; var p = Ms.geometry.getAttribute('position'), ix = Ms.geometry.getIndex(), n = ix ? ix.count / 3 : p.count / 3;
      for (var t = 0; t < n; t++) { var a = ix ? ix.getX(t * 3) : t * 3, b = ix ? ix.getX(t * 3 + 1) : t * 3 + 1, c = ix ? ix.getX(t * 3 + 2) : t * 3 + 2;
        var ya = p.getY(a), yb = p.getY(b), yc = p.getY(c), kind = fn(ya, yb, yc); if (!kind) continue;
        var ax = p.getX(a), az = p.getZ(a), bx = p.getX(b), bz = p.getZ(b), cx = p.getX(c), cz = p.getZ(c);
        var den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(den) < 1e-10) continue;
        var i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - x0) / C)), i1 = Math.min(nx - 1, Math.floor((Math.max(ax, bx, cx) - x0) / C)), k0 = Math.max(0, Math.floor((Math.min(az, bz, cz) - z0) / C)), k1 = Math.min(nz - 1, Math.floor((Math.max(az, bz, cz) - z0) / C));
        for (var k = k0; k <= k1; k++) for (var i = i0; i <= i1; i++) { var x = x0 + (i + 0.5) * C, z = z0 + (k + 0.5) * C;
          var l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / den, l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / den, l3 = 1 - l1 - l2;
          if (l1 < -1e-4 || l2 < -1e-4 || l3 < -1e-4) continue; var cc = k * nx + i;
          if (kind === 2) cover[cc] = 1; else { var y = l1 * ya + l2 * yb + l3 * yc; if (y > triY[cc]) { triY[cc] = y; triAt[cc] = t; } } } } }
    raster('Floors', function (a, b, c) { if (Math.abs(a - y0) <= 0.15 && Math.abs(b - y0) <= 0.15 && Math.abs(c - y0) <= 0.15) return 1; return 0; });
    // (2026-11-24, the WS house: no ceilings at all - the sloped roof is the ceiling, so its living room counted as outdoors)
    // plan.roofCovers: a roof over the cell covers it too
    ['Floors', 'Ceilings'].concat(window.__dressRoofCovers ? ['Roofs'] : []).forEach(function (nm) { raster(nm, function (a, b, c) { var m = Math.min(a, b, c) - y0; return m > 2.0 && m < 8.0 ? 2 : 0; }); });
    return (LEVEL[key] = { triAt: triAt, triY: triY, cover: cover, taken: new Int16Array(nx * nz) });
  }
  // the finish as a material. A plan material with 'tex' gets its picture laid by the layer's own uv (so it can be turned
  // and started at a wall); one without is the catalogue's world-axes material, as before.
  var MAT = {};
  function floorMat(PLAN, id, own) {
    if (MAT[id]) return MAT[id];
    var WM = window.WM, THREE = WM.THREE, pm = (PLAN.materials || []).filter(function (x) { return x.id === id; })[0] || {}, m;
    if (pm.tex) { var t = new THREE.TextureLoader().load(pm.tex + '?v=' + (pm.texV || 1)); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, WM.renderer.capabilities.getMaxAnisotropy());
      m = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(pm.tint || '#ffffff'), map: t, roughness: pm.rough != null ? pm.rough : 0.8, metalness: 0, side: THREE.DoubleSide, flatShading: true });
      m.userData.texM = pm.texM || 1; m.userData.tileM = pm.tileM || 0; }
    else { m = window.WMPaint.materialFor(id + '~f'); if (pm.tint) m.color.set(pm.tint); }   // the texture darkened / warmed (the paint system draws a texture white)
    if (own) { m.lightMap = own.lightMap; m.lightMapIntensity = own.lightMapIntensity; m.envMapIntensity = own.envMapIntensity; if ('specularIntensity' in m) m.specularIntensity = 0; }
    m.polygonOffset = true; m.polygonOffsetFactor = 0; m.polygonOffsetUnits = -8; m.needsUpdate = true;
    if (pm.mirror && window.__blMirror) window.__blMirror.patch(m, pm.mirror === true ? 1 : +pm.mirror);                          // the same floor mirror the TM tiles carry
    return (MAT[id] = m);
  }
  window.__dressFloors = function (PLAN) {
    var WM = window.WM, THREE = WM.THREE, Q = window.__dressQ, out = { made: [], refused: [], grids: [] };
    var F = WM.pack.meshes.get('Floors'); if (!F || !Q) return out;
    var fg = F.geometry, fpos = fg.getAttribute('position'), fidx = fg.getIndex(), fuv = fg.getAttribute('uv1') || fg.getAttribute('uv2');
    var own = (Array.isArray(F.material) ? F.material : [F.material]).filter(function (m) { return m && m.lightMap; })[0];
    // a TILED light pack (helsinki 16) joins its tiles AFTER the dressing has run: the floor layers were made without light and the sky
    // alone lit them - every floor read blue (measured: lightMap false). They take the slab's light as soon as it is there (20 s at most)
    if (!own) (function late(n) { var o2 = (Array.isArray(F.material) ? F.material : [F.material]).filter(function (m) { return m && m.lightMap; })[0];
      if (!o2) { if (n < 40) setTimeout(function () { late(n + 1); }, 500); return; }
      Object.keys(MAT).forEach(function (k) { var m = MAT[k]; m.lightMap = o2.lightMap; m.lightMapIntensity = o2.lightMapIntensity; m.envMapIntensity = o2.envMapIntensity; if ('specularIntensity' in m) m.specularIntensity = 0; m.needsUpdate = true; });
      console.log('[dress] floors: the light came ' + (n * 0.5) + ' s late - ' + Object.keys(MAT).length + ' floor finishes lit'); })(0);
    var kind = 'floor_finish', regions = [];
    // A BREAK LINE (plan.floorBreaks): where one open space holds two directions of walls (a corridor that opens into a turned
    // lobby, no door between them) the planner draws the line a tiler would put a threshold strip on. It works as a door does:
    // the finish ends there, each side is laid out from its own walls.
    function brk(G, M) { if (G.breaks) return G; G.breaks = 1; (PLAN.floorBreaks || []).forEach(function (b) { var a = b.at, n = Math.ceil(Math.hypot(a[2] - a[0], a[3] - a[1]) / 0.04);
        for (var q = 0; q <= n; q++) { var c = M.cell(a[0] + (a[2] - a[0]) * q / n, a[1] + (a[3] - a[1]) * q / n); if (c >= 0 && !G.wall[c]) G.wall[c] = 2; } }); return G; }
    // ---- 1. THE REGIONS. A region = { fl (the plan line), M, L, wall, reg (cells), rb (cell bounds), cnt, edges } ----
    function fill(fl, M, L, G, y0, start, needCover) {
      var nx = M.nx, nz = M.nz, x0 = M.x0, z0 = M.z0, wall = G.wall, bx = fl.box || null;
      function open(c, i, k) { if (wall[c] || L.taken[c] || Math.abs(L.triY[c] - y0) > 0.12) return false;
        if (bx) { var x = x0 + (i + 0.5) * C, z = z0 + (k + 0.5) * C; if (x < bx[0] || x > bx[1] || z < bx[2] || z > bx[3]) return false; } return true; }
      var reg = new Uint8Array(nx * nz), stack = [start], cnt = 0, rb = [1e9, -1e9, 1e9, -1e9], cov = 0; reg[start] = 1;
      var lit = 0;
      while (stack.length) { var c0 = stack.pop(), i0 = c0 % nx, k0 = (c0 - i0) / nx; cnt++; if (L.cover[c0]) cov++; if (L.triAt[c0] >= 0) lit++;
        if (i0 < rb[0]) rb[0] = i0; if (i0 > rb[1]) rb[1] = i0; if (k0 < rb[2]) rb[2] = k0; if (k0 > rb[3]) rb[3] = k0;
        for (var d = 0; d < 4; d++) { var i = i0 + D4[d][0], k = k0 + D4[d][1]; if (i < 0 || k < 0 || i >= nx || k >= nz) continue; var c = k * nx + i; if (!reg[c] && open(c, i, k)) { reg[c] = 1; stack.push(c); } } }
      // WHERE THE FINISH ENDS: every edge cell is named by what lies beyond it - a door, a wall (or the end of the floor
      // itself, or another finish), or nothing: open floor of the same level that this finish did not take
      var eWall = 0, eDoor = 0, eOpen = 0;
      for (var k2 = rb[2]; k2 <= rb[3]; k2++) for (var i2 = rb[0]; i2 <= rb[1]; i2++) { if (!reg[k2 * nx + i2]) continue; var worst = 0;
        for (var d2 = 0; d2 < 4; d2++) { var i3 = i2 + D4[d2][0], k3 = k2 + D4[d2][1], inside = i3 >= 0 && k3 >= 0 && i3 < nx && k3 < nz, c3 = k3 * nx + i3;
          if (inside && reg[c3]) continue; var w = inside ? wall[c3] : 1, kd = w === 2 ? 2 : (w === 1 || L.taken[c3] || Math.abs(L.triY[c3] - y0) > 0.12) ? 1 : 3; if (kd > worst) worst = kd; }
        if (worst === 1) eWall++; else if (worst === 2) eDoor++; else if (worst === 3) eOpen++; }
      return { fl: fl, M: M, L: L, G: G, y0: y0, reg: reg, rb: rb, cnt: cnt, area: cnt * C * C, cover: cov / cnt, light: +(lit / cnt).toFixed(3), eWall: eWall * C, eDoor: eDoor * C, eOpen: eOpen * C };
    }
    function claim(R) {                                           // the region's cells are taken; then the door cells that touch it
      var nx = R.M.nx, nz = R.M.nz, n = regions.length + 1, rb = R.rb, wall = R.G.wall, L = R.L, under = [];
      for (var k = rb[2]; k <= rb[3]; k++) for (var i = rb[0]; i <= rb[1]; i++) { var c = k * nx + i; if (!R.reg[c]) continue; L.taken[c] = n;
        for (var d = 0; d < 4; d++) { var i5 = i + D4[d][0], k5 = k + D4[d][1]; if (i5 < 0 || k5 < 0 || i5 >= nx || k5 >= nz) continue; var c5 = k5 * nx + i5; if (wall[c5] === 2 && !R.reg[c5] && !L.taken[c5]) under.push(c5); } }
      // UNDER THE DOOR LEAF: the fill stops one cell before a door, which left up to 10 cm of the old floor in front of the leaf.
      // The finish takes the door cells that touch it, so the change of floor lies under the leaf. One ring only, and a door
      // cell another finish already took stays with that finish (two layers at one height would fight).
      under.forEach(function (c5) { if (L.taken[c5]) return; L.taken[c5] = n; R.reg[c5] = 1; R.cnt++; var i5 = c5 % nx, k5 = (c5 - i5) / nx; if (i5 < rb[0]) rb[0] = i5; if (i5 > rb[1]) rb[1] = i5; if (k5 < rb[2]) rb[2] = k5; if (k5 > rb[3]) rb[3] = k5; });
      R.n = n; regions.push(R);
    }
    function ask(R, given, where) { var res = Q.ask(kind, { given: given, all: true }, {}); R.res = res;
      if (!res.ok) { var tally = {}; res.answers.forEach(function (an) { if (!an.pass) tally[an.id] = an.value; }); Q.refuse('floor ' + R.fl.id, kind, where, 1, tally, res); return tally; } return null; }
    // 1a. the floors the plan names (a seed inside the room)
    (PLAN.floors || []).forEach(function (fl) {
      var M = Q.map(fl.level || PLAN.levelY || 574.55), L = levelData(WM, M), where = 'seed ' + fl.seed.join(', '), sc = M.cell(fl.seed[0], fl.seed[1]);
      var y0 = sc >= 0 && L.triY[sc] > -1e8 ? L.triY[sc] : null, G = y0 == null ? null : brk(levelGrid(WM, M, y0), M);
      if (y0 == null || G.wall[sc]) { var bad = { fl: fl }; ask(bad, { seed_on_floor: false }, where); out.refused.push(fl.id + (y0 == null ? ': no floor under the seed' : ': the seed lies on a wall')); return; }
      var R = fill(fl, M, L, G, y0, sc); R.where = where; R.named = true;
      var t = ask(R, { seed_on_floor: true, ends_at_walls_and_doors: +R.eOpen.toFixed(1), door_found: fl.noDoor ? 9 : +R.eDoor.toFixed(1), no_leak: !fl.maxArea || R.area <= fl.maxArea, light_under: R.light }, where);
      if (t && !fl.asIs) { out.refused.push(fl.id + ': ' + JSON.stringify(t) + ' (' + R.area.toFixed(0) + ' m2)'); return; }
      claim(R);
    });
    // 1b. EVERY OTHER ROOM of the default levels: each closed piece of floor that is under a roof and reaches a door
    var FD = PLAN.floorDefault;
    if (FD) (FD.levels || [PLAN.levelY || 574.55]).forEach(function (lv) {
      var M = Q.map(lv), L = levelData(WM, M), G = brk(levelGrid(WM, M, lv), M), nx = M.nx, nz = M.nz, rooms = (WM.pack.manifest.rooms || []).filter(function (r) { return Math.abs(r.pos[1] - lv) < 0.3; }), skipped = { small: 0, outdoors: 0, noDoor: 0 };
      for (var c = 0; c < nx * nz; c++) { if (G.wall[c] || L.taken[c] || Math.abs(L.triY[c] - lv) > 0.12) continue;
        var names = [], fl = { id: '', finish: FD.finish, level: lv, auto: true }, R = fill(fl, M, L, G, lv, c);
        rooms.forEach(function (r) { var rc = M.cell(r.pos[0], r.pos[2]); if (rc >= 0 && R.reg[rc]) names.push(r.number); });
        fl.id = names.length ? 'room-' + names.slice(0, 4).join('+') + (names.length > 4 ? '+' + (names.length - 4) + ' more' : '') : 'floor-at-' + (M.x0 + (c % nx) * C).toFixed(0) + ',' + (M.z0 + Math.floor(c / nx) * C).toFixed(0);
        R.where = fl.id; var why = R.area < (FD.minArea || 1.5) ? 'small' : R.cover < 0.7 ? 'outdoors' : R.eDoor < 0.6 && !names.length ? 'noDoor' : null;
        if (why) { skipped[why]++; var rb = R.rb; for (var k = rb[2]; k <= rb[3]; k++) for (var i = rb[0]; i <= rb[1]; i++) if (R.reg[k * nx + i]) L.taken[k * nx + i] = -1; continue; }   // looked at, not finished
        var t = ask(R, { seed_on_floor: true, ends_at_walls_and_doors: +R.eOpen.toFixed(1), door_found: Math.max(+R.eDoor.toFixed(1), names.length ? 0.6 : 0), no_leak: true, light_under: R.light }, fl.id);
        if (t) { out.refused.push(fl.id + ': ' + JSON.stringify(t)); continue; }
        claim(R);
      }
      out.skipped = skipped;
    });
    // ---- 2. THE LAYOUT: direction, main wall and first tile of every region whose finish is laid out ----
    // every kept wall segment is given to the regions it touches (its middle lies in or beside one of their cells)
    regions.forEach(function (R) { R.mat = floorMat(PLAN, R.fl.finish, own); R.segs = []; });
    var byLevel = {}; regions.forEach(function (R) { var k = R.y0.toFixed(2) + '@' + R.M.y0.toFixed(2); (byLevel[k] = byLevel[k] || []).push(R); });
    Object.keys(byLevel).forEach(function (k) { var Rs = byLevel[k], G = Rs[0].G, M = Rs[0].M, L = Rs[0].L, nx = M.nx, nz = M.nz, S = G.segs, byN = {}; Rs.forEach(function (R) { byN[R.n] = R; });
      for (var s = 0; s < S.length; s += 4) { var mx = (S[s] + S[s + 2]) / 2, mz = (S[s + 1] + S[s + 3]) / 2, i = Math.floor((mx - M.x0) / C), kk = Math.floor((mz - M.z0) / C), seen = {};
        for (var dk = -1; dk <= 1; dk++) for (var di = -1; di <= 1; di++) { var ii = i + di, k2 = kk + dk; if (ii < 0 || k2 < 0 || ii >= nx || k2 >= nz) continue; var n = L.taken[k2 * nx + ii];
          if (n > 0 && byN[n] && !seen[n]) { seen[n] = 1; byN[n].segs.push(s); } } }
      Rs.forEach(function (R) { R.S = S; }); });
    function layout(R) {
      var S = R.S, H = new Float32Array(180), tot = 0;
      R.segs.forEach(function (s) { var dx = S[s + 2] - S[s], dz = S[s + 3] - S[s + 1], len = Math.hypot(dx, dz), a = Math.atan2(dz, dx) * 180 / Math.PI; a = ((a % 90) + 90) % 90; H[Math.floor(a * 2) % 180] += len; tot += len; });
      if (tot < 1.5) return null;
      var best = 0, bv = -1; for (var b = 0; b < 180; b++) { var v = H[b] + H[(b + 1) % 180] + H[(b + 179) % 180]; if (v > bv) { bv = v; best = b; } }
      // the exact direction: the length-weighted mean of the segments within 1.5 degrees of the best bin (mod 90)
      var c0 = (best + 0.5) / 2, sw = 0, sa = 0;
      R.segs.forEach(function (s) { var dx = S[s + 2] - S[s], dz = S[s + 3] - S[s + 1], len = Math.hypot(dx, dz), a = Math.atan2(dz, dx) * 180 / Math.PI; a = ((a % 90) + 90) % 90; var d = a - c0; if (d > 45) d -= 90; if (d < -45) d += 90; if (Math.abs(d) <= 1.5) { sw += len; sa += d * len; } });
      var ang = (c0 + sa / sw) * Math.PI / 180, ax = Math.cos(ang), az = Math.sin(ang);          // a = along, b = across (a turned 90 degrees)
      // the longest straight wall face: the segments along a, or along b, binned by their distance across (2 cm bins)
      var bins = {};
      R.segs.forEach(function (s) { var dx = S[s + 2] - S[s], dz = S[s + 3] - S[s + 1], len = Math.hypot(dx, dz), al = Math.abs(dx * ax + dz * az) / len, fam = al > 0.9995 ? 0 : al < 0.03 ? 1 : -1; if (fam < 0) return;
        var ux = fam ? -az : ax, uz = fam ? ax : az, vx = -uz, vz = ux, mx = (S[s] + S[s + 2]) / 2, mz = (S[s + 1] + S[s + 3]) / 2, d = mx * vx + mz * vz, key = fam + ':' + Math.round(d / 0.02);
        var B = bins[key] || (bins[key] = { fam: fam, len: 0, sd: 0, lo: 1e9, hi: -1e9 }); B.len += len; B.sd += d * len; var t1 = S[s] * ux + S[s + 1] * uz, t2 = S[s + 2] * ux + S[s + 3] * uz; B.lo = Math.min(B.lo, t1, t2); B.hi = Math.max(B.hi, t1, t2); });
      var W = null; Object.keys(bins).forEach(function (k) { if (!W || bins[k].len > W.len) W = bins[k]; }); if (!W) return null;
      var ux = W.fam ? -az : ax, uz = W.fam ? ax : az, vx = -uz, vz = ux, d0 = W.sd / W.len;
      // the first tile: its corner = the wall face (across) and the wall's own end (along)
      return { deg: +(ang * 180 / Math.PI).toFixed(2), ux: ux, uz: uz, vx: vx, vz: vz, ox: vx * d0 + ux * W.lo, oz: vz * d0 + uz * W.lo, wallLen: +(W.hi - W.lo).toFixed(2), align: +(sw / tot).toFixed(2) };
    }
    var groups = [];
    regions.slice().sort(function (a, b) { return b.area - a.area; }).forEach(function (R) {
      if (!R.mat.userData.texM || R.fl.align === false) return;                       // a world-axes finish
      var Ly = layout(R); R.own = Ly; if (!Ly) return;
      var g = null; if (!R.fl.ownGrid) groups.forEach(function (q) { var d = Math.abs(q.deg - Ly.deg); d = Math.min(d, 90 - d); if (!g && q.finish === R.fl.finish && q.level === R.M.y0 && d < 1.5) g = q; });
      if (!g) { g = { n: groups.length + 1, finish: R.fl.finish, level: R.M.y0, deg: Ly.deg, L: Ly, first: R.fl.id, rooms: 0, area: 0 }; groups.push(g);
        // LAW D1, the layout is asked too: a wall long enough to lay from, the grid parallel to it, a joint on its face
        var tile = R.mat.userData.tileM, res = Q.ask('floor_grid', { given: { main_wall_length: Ly.wallLen, walls_agree: Ly.align, joint_on_wall: 0 }, all: true }, {});
        g.ok = res.ok; if (res.ok) Q.record('tile grid ' + g.n + ' (' + R.fl.finish + ')', 'laid from the longest wall of ' + R.fl.id + ', ' + Ly.deg + ' deg', res, [Ly.ox, R.y0, Ly.oz]);
        else Q.refuse('tile grid ' + g.n, 'floor_grid', R.fl.id, 1, {}, res); }
      R.grid = g; g.rooms++; g.area += R.area;
      // how wide is the cut tile at this room's own longest wall (0 = a whole tile starts there)
      var tm = R.mat.userData.tileM; if (tm) { var dd = ((Ly.ox - g.L.ox) * g.L.vx + (Ly.oz - g.L.oz) * g.L.vz), d2 = ((Ly.ox - g.L.ox) * g.L.ux + (Ly.oz - g.L.oz) * g.L.uz); var across = Math.abs(Ly.vx * g.L.vx + Ly.vz * g.L.vz) > 0.5 ? dd : d2; R.cut = +((((across % tm) + tm) % tm)).toFixed(3); }
    });
    groups.forEach(function (g) { out.grids.push({ grid: g.n, finish: g.finish, level: g.level, deg: g.deg, firstTileAt: [+g.L.ox.toFixed(3), +g.L.oz.toFixed(3)], laidFrom: g.first, mainWall_m: g.L.wallLen, rooms: g.rooms, area: +g.area.toFixed(0), ok: g.ok }); });
    // ---- 3. THE LAYERS ----
    function inBed(fl, x, z) { var B = fl.beds; if (!B) return false; for (var i = 0; i < B.length; i++) { var b = B[i], dx = x - b.x, dz = z - b.z, cs = Math.cos(b.rot || 0), sn = Math.sin(b.rot || 0), u = (dx * cs + dz * sn) / b.rx, v = (-dx * sn + dz * cs) / b.rz;
        // a soft, uneven outline: the ellipse pushed in and out by two slow waves around it
        var a = Math.atan2(v, u), r = 1 + 0.10 * Math.sin(3 * a + i) + 0.06 * Math.sin(5 * a + 2 * i); if (u * u + v * v <= r * r) return true; } return false; }
    regions.forEach(function (R) {
      var fl = R.fl, M = R.M, L = R.L, nx = M.nx, x0 = M.x0, z0 = M.z0, rb = R.rb, g = R.grid && R.grid.ok !== false ? R.grid.L : null;
      var mats = [R.mat]; if (fl.beds && fl.bedFinish) mats.push(floorMat(PLAN, fl.bedFinish, own));
      var P = [[], []], U1 = [[], []], U0 = [[], []], miss = 0, cells = 0;
      function uvOn(t, x, z) {                                 // the triangle's own plane, also a little outside it: light uv + height
        var a = fidx.getX(t * 3), b = fidx.getX(t * 3 + 1), c = fidx.getX(t * 3 + 2), ax = fpos.getX(a), az = fpos.getZ(a), bxx = fpos.getX(b), bz = fpos.getZ(b), cx = fpos.getX(c), cz = fpos.getZ(c);
        var den = (bz - cz) * (ax - cx) + (cx - bxx) * (az - cz), l1 = ((bz - cz) * (x - cx) + (cx - bxx) * (z - cz)) / den, l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / den, l3 = 1 - l1 - l2;
        return [l1 * fuv.getX(a) + l2 * fuv.getX(b) + l3 * fuv.getX(c), l1 * fuv.getY(a) + l2 * fuv.getY(b) + l3 * fuv.getY(c), l1 * fpos.getY(a) + l2 * fpos.getY(b) + l3 * fpos.getY(c)];
      }
      // ⛔ SEEN IN HIS VIEWER (2026-11-11, bands of wrong light): every cell takes its light from the ONE floor triangle under its
      // centre, and a strip only joins cells over the same triangle (never interpolate the light map across two triangles).
      for (var k = rb[2]; k <= rb[3]; k++) for (var i = rb[0]; i <= rb[1]; ) {
        var c = k * nx + i; if (!R.reg[c]) { i++; continue; } var t0 = L.triAt[c]; cells++; if (t0 < 0 || Math.abs(L.triY[c] - R.y0) > 0.12) { miss++; i++; continue; }
        var bed0 = 0, j = i + 1;                               // (the beds are drawn below, as smooth shapes on top)
        while (j <= rb[1] && R.reg[k * nx + j] && L.triAt[k * nx + j] === t0) { j++; cells++; }
        var xa = x0 + i * C, xb = x0 + j * C, za = z0 + k * C, zb = za + C, q = [[xa, za], [xb, za], [xb, zb], [xa, zb]], mt = mats[bed0], tm = mt.userData.texM, lift = bed0 ? 0.012 : 0.004;
        // ⛔ SEEN IN HIS CHROME (2026-11-12, oak in strips): the layer sits 4 mm ABOVE the floor (it wins by real depth on every
        // graphics card). Corner order 0-2-1 / 0-3-2 = the face looks UP. A bed lies 8 mm higher still.
        [0, 2, 1, 0, 3, 2].forEach(function (n2) { var x = q[n2][0], z = q[n2][1], u = uvOn(t0, x, z); P[bed0].push(x, u[2] + lift, z); U1[bed0].push(u[0], u[1]);
          if (tm && g && !bed0) U0[bed0].push(((x - g.ox) * g.ux + (z - g.oz) * g.uz) / tm, ((x - g.ox) * g.vx + (z - g.oz) * g.vz) / tm);
          else if (tm) U0[bed0].push(x / tm, z / tm); else U0[bed0].push(u[0], u[1]); });
        i = j;
      }
      // THE BEDS (a second finish inside the floor: the gravel of the patio garden), as SMOOTH shapes 12 mm above the floor.
      // ⛔ SEEN IN MY OWN PICTURE (2026-11-13, from the corridor above): beds cut from the 10 cm cells had stair-step edges.
      // A smooth shape spans several floor triangles, which is allowed ONLY where the baked light is laid out as one flat sheet
      // there: every corner's light place, read from the triangle under it, must agree with the bed centre's triangle carried
      // out to that corner (within a third of a light texel). A bed that fails this falls back to the cells.
      (fl.beds || []).forEach(function (b, bi) { if (mats.length < 2) return; var N = 96, cs = Math.cos(b.rot || 0), sn = Math.sin(b.rot || 0), tm = mats[1].userData.texM || 1, cc = M.cell(b.x, b.z), tc = cc >= 0 ? L.triAt[cc] : -1, ok = tc >= 0, pts = [];
        for (var s = 0; s < N && ok; s++) { var a = s / N * Math.PI * 2, r = 1 + 0.10 * Math.sin(3 * a + bi) + 0.06 * Math.sin(5 * a + 2 * bi), u = Math.cos(a) * r * b.rx, v = Math.sin(a) * r * b.rz, x = b.x + u * cs - v * sn, z = b.z + u * sn + v * cs, c = M.cell(x, z);
          if (c < 0 || !R.reg[c] || L.triAt[c] < 0) { ok = false; break; } var own = uvOn(L.triAt[c], x, z), far = uvOn(tc, x, z); if (Math.abs(own[0] - far[0]) > 2e-5 || Math.abs(own[1] - far[1]) > 2e-5) ok = false; pts.push([x, z, far[0], far[1], own[2]]); }
        if (!ok) { out.refused.push(fl.id + ': bed ' + bi + ' could not be drawn smooth (it leaves the floor, or the light is not one sheet there)'); return; }
        var c0 = uvOn(tc, b.x, b.z);
        for (var s2 = 0; s2 < N; s2++) { var A = pts[s2], B = pts[(s2 + 1) % N]; [[b.x, b.z, c0[0], c0[1], c0[2]], B, A].forEach(function (q) { P[1].push(q[0], q[4] + 0.012, q[1]); U1[1].push(q[2], q[3]); U0[1].push(q[0] / tm, q[1] / tm); }); } });
      if (!P[0].length && !P[1].length) { out.refused.push(fl.id + ': no floor triangles found under the region'); return; }
      mats.forEach(function (mt, b) { if (!P[b].length) return;
        var ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P[b]), 3));
        ge.setAttribute('uv1', new THREE.BufferAttribute(new Float32Array(U1[b]), 2)); ge.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(U0[b]), 2)); ge.computeVertexNormals();
        var o = new THREE.Mesh(ge, mt); o.name = 'dress-floor:' + fl.id + (b ? ':bed' : ''); o.userData.notPack = true; o.userData.dressPlan = true; o.frustumCulled = false;
        o.matrixAutoUpdate = false; o.matrix.copy(F.matrixWorld); WM.scene.add(o); });
      if (R.res && R.res.ok) Q.record('floor ' + fl.id, R.where, R.res, [x0 + (rb[0] + rb[1]) / 2 * C, R.y0, z0 + (rb[2] + rb[3]) / 2 * C]);
      out.made.push({ id: fl.id, finish: fl.finish, area: +R.area.toFixed(1), tris: (P[0].length + P[1].length) / 9, cellsWithoutLight: miss, edge: { wall_m: +R.eWall.toFixed(1), door_m: +R.eDoor.toFixed(1), open_m: +R.eOpen.toFixed(1) },
        passes: !!(R.res && R.res.ok), asIs: R.res && R.res.ok ? undefined : fl.asIs, grid: R.grid ? R.grid.n : undefined, ownWallDeg: R.own ? R.own.deg : undefined, cutAtOwnWall_m: R.cut });
    });
    // THE GUIDANCE STRIP (the tactile path for the blind, 'tm-access'): it is part of the floor the finish now covers, so a
    // copy of it is lifted 7 mm - above the new finish, exactly its own shape.
    var acc = window.__tmOverlays && window.__tmOverlays['tm:Floors:tm-access'];
    if (acc && regions.length && !acc.userData.lifted) { acc.userData.lifted = true; var up = new THREE.Mesh(acc.geometry, acc.material); up.name = 'dress-floor:guidance-strip'; up.userData.notPack = true; up.userData.dressPlan = true; up.frustumCulled = false;
      up.matrixAutoUpdate = false; up.matrix.copy(acc.matrix); up.matrix.elements[13] += 0.007; WM.scene.add(up); out.strip = true; }
    window.__dressFloorRegions = regions;                       // for night_tests/nfloors.eval.js (the layout as a drawing)
    console.log('[dress] floors: ' + JSON.stringify(out));
    return out;
  };
})();
