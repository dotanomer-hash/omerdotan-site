// LOCAL ONLY (night 2026-11-13): MORE THINGS, EACH WHERE IT BELONGS. Called by dress-plan.js after the floors.
// His words: "much more objects but where need to be", "the patio floor should be external stone with plants, like japanese
// garden", "add 5 more peoples, 2 are walking".
// The plan says WHAT goes with WHAT in words (plan.more): "a side table beside every second armchair", "a pillow on every third
// armchair", "a desk lamp on every desk", "three rocks in the middle of the gravel bed". This machinery proposes the spots from
// the model and - LAW D1 - asks every spot the question list of its kind before anything is placed. It shares the placer's
// map, its taken places and its loader (window.__dressShared), so nothing here can stand inside what was placed before.
// Ways of placing (how):
//   onTopOf  - on the flat top of a kind of furniture (by family name / category / room), also one part of a kit, also a
//              small group standing together ('with')
//   beside   - on the floor at the side of a kind of furniture, turned as the furniture is turned
//   onSeat   - on the seat of an empty armchair, against its back
//   at       - at a point the planner names (the balcony), asked the same floor questions
//   bed      - composed inside a planting bed of a floor (the patio garden): scattered by a fixed rule, never by chance
//   walk     - a person walking a route the free-floor map proves walkable
(function () {
  'use strict';
  function hash(a, b) { var h = (Math.imul(a | 0, 2654435761) ^ Math.imul((b | 0) + 7, 40503)) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; }
  window.__dressMore = function (PLAN) {
    var S = window.__dressShared, WM = window.WM, Q = window.__dressQ, out = [], log = { placed: {}, refused: {} }; if (!S || !Q || !PLAN.more) return null;
    var SIZES = S.SIZES, E = WM.pack.elements, y0 = S.y0, map = S.map, ctx = S.ctx;
    function ok(it) { log.placed[it] = (log.placed[it] || 0) + 1; }
    function no(it, why) { var k = it + ': ' + why; log.refused[k] = (log.refused[k] || 0) + 1; }
    // the true size of a model, or of one part of a kit, times the plan's scale: [half width, height, half depth]
    function size(o) { var s = SIZES[o.item], k = o.scale || 1; if (!s) return [0.2 * k, 0.3 * k, 0.2 * k]; if (o.node && s.nodes && s.nodes[o.node]) s = s.nodes[o.node];
      return [(s.max[0] - s.min[0]) / 2 * k, (s.max[1] - s.min[1]) * k, (s.max[2] - s.min[2]) / 2 * k]; }
    function fileOf(o) { return o.item + '/' + o.item + '.gltf'; }
    function put(o, x, y, z, yaw, extra) { var it = { file: fileOf(o), pos: [x, y, z], quat: S.yawQ(yaw || 0), scale: [o.scale || 1, o.scale || 1, o.scale || 1] }; if (o.node) it.node = o.node; if (extra) Object.keys(extra).forEach(function (k) { it[k] = extra[k]; }); out.push(it); return it; }
    // the small things that stand WITH an item (fruit in a bowl, a plant in a planter): placed with it, turned with it
    function withs(o, x, y, z, yaw, topH) { (o.with || []).forEach(function (w) { var c = Math.cos(yaw || 0), s = Math.sin(yaw || 0), dx = (w.dx || 0), dz = (w.dz || 0);
      put(w, x + dx * c + dz * s, y + (w.onTop ? topH : 0) + (w.dy || 0), z - dx * s + dz * c, (yaw || 0) + (w.yaw || 0) * Math.PI / 180); }); }
    function matches(el, of, level) { if (String(el.level || '').indexOf(level || PLAN.level) < 0) return false; if (of.cat && el.cat !== of.cat) return false;
      if (of.names && of.names.indexOf(el.name) < 0) return false; if (of.match != null && String(el.name || '').indexOf(of.match) < 0) return false;
      if (of.zones && of.zones.indexOf(S.zoneOf(el).id) < 0) return false;
      if (of.rooms) { var b = el.bbox, x = (b.min[0] + b.max[0]) / 2, z = (b.min[2] + b.max[2]) / 2; if (!of.rooms.some(function (n) { var r = S.rooms[n]; return r && Math.hypot(r.pos[0] - x, r.pos[2] - z) < (of.within || 6) && map.lineFree(r.pos[0], r.pos[2], x, z); })) return false; }
      return true; }
    function each(o, fn) { var seen = 0, n = 0; E.forEach(function (el, ei) { if (!el.bbox || !matches(el, o.of, o.level)) return; var i = seen++; if (i < (o.start || 0) || (i - (o.start || 0)) % (o.every || 1) !== 0 || (o.max && n >= o.max)) return;
      // of.skipIds (2026-11-24): these elements get nothing - asked AFTER the counting, so every other element keeps what it had
      if (o.of.skipIds && o.of.skipIds.indexOf(el.id) >= 0) return; if (fn(el, ei) !== false) n++; }); return n; }
    function tally(res) { var t = {}; res.answers.forEach(function (a) { if (!a.pass) t[a.id] = a.value; }); return t; }
    PLAN.__moreOne = function (o) { one(o); };
    PLAN.more.forEach(one);
    function one(o) {
      var hs = size(o), name = o.item + (o.node ? ':' + o.node.replace(o.item + '_', '') : '');
      if (o.how === 'onTopOf') {
        // the flat top of the furniture: its highest surface, the same height (2 cm) under the item's whole base
        each(o, function (el, ei) { var b = el.bbox, where = el.name + ' #' + el.id, tried = 0, tl = {}, last = null, top = -1e9, G = o.grid || 5;
          var pts = [[0.5, 0.5]]; for (var gz = 0; gz < G; gz++) for (var gx = 0; gx < G; gx++) pts.push([(gx + 0.5) / G, (gz + 0.5) / G]);
          // ⛔ MEASURED 2026-11-13: (1) the 9 'Desk' elements are a slab from 0.50 to 0.70 m - their box does not start at the floor,
          // so the top's height is taken from the FLOOR. (2) the highest surface of a table set is a chair back: 'part' names the
          // Revit part that is the top.
          var mesh = WM.pack.meshes.get(el.mesh), ptris = o.of.part ? S.partTris(el, o.of.part, S.MATS) : null, fl0 = map.floorAt((b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2); if (fl0 == null) fl0 = y0;
          function surf(x, z) { if (ptris) { var yy = S.topUnder(mesh, ptris, x, z); return yy > -1e8 ? yy : null; } return Q.surfaceUnder(ei, x, z, b.max[1] + 0.01); }
          var ys = pts.map(function (p) { var y = surf(b.min[0] + (b.max[0] - b.min[0]) * p[0], b.min[2] + (b.max[2] - b.min[2]) * p[1]); if (y != null && y > top) top = y; return y; });
          if (top < fl0 + (o.minTop || 0.35) || top > fl0 + (o.maxTop || 1.3)) { Q.refuse(name, 'table_top_item', where, 0, { top_found: 1 }); no(name, 'no top at a hand height on ' + el.name); return false; }
          for (var i = (o.skipCentre ? 1 : 0); i < pts.length; i++) { if (ys[i] == null || ys[i] < top - 0.02) continue;
            var x = b.min[0] + (b.max[0] - b.min[0]) * pts[i][0], z = b.min[2] + (b.max[2] - b.min[2]) * pts[i][1], ex = hs[0] * 0.85, ez = hs[2] * 0.85, dev = 0;
            [[ex, ez], [-ex, ez], [ex, -ez], [-ex, -ez]].forEach(function (c) { var y = surf(x + c[0], z + c[1]), dd = y == null ? 9 : Math.abs(y - top); if (dd > dev) dev = dd; });
            var bl = [x - ex, top + 0.01, z - ez], bh = [x + ex, top + hs[1], z + ez];
            var res = Q.ask('table_top_item', { map: map, x: x, z: z, hx: ex, hz: ez, skipEl: ei, box: [[x - ex, top + 0.02, z - ez], [x + ex, top + Math.max(0.05, hs[1]), z + ez]], given: { top_found: true, top_flat: dev, apart: S.mineFree(bl, bh) } }, ctx);
            tried++; last = res; if (!res.ok) { tl[res.failed] = (tl[res.failed] || 0) + 1; continue; }
            // turned as the furniture is turned (its own axis), plus the plan's own turn
            var ax = S.axisOf([[b.min[0], b.min[2]], [b.max[0], b.max[2]]]), yaw = (o.yaw || 0) * Math.PI / 180;
            S.placedBoxes.push([bl, bh]); put(o, x, top, z, yaw, { on: el.id }); withs(o, x, top, z, yaw, hs[1]); Q.record(name, where, res, [x, top, z]); ok(name); return true; }
          Q.refuse(name, 'table_top_item', where, tried, tl, last); no(name, 'no spot on ' + el.name + ' passes the questions'); return false; });
      } else if (o.how === 'beside' || o.how === 'onSeat') {
        each(o, function (el, ei) { var b = el.bbox, where = el.name + ' #' + el.id, ch = S.chairsOf(el)[0]; if (!ch) { no(name, 'no facing found for ' + el.name); return false; }
          var fx = ch.fx, fz = ch.fz, rx = -fz, rz = fx, cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2, yawF = Math.atan2(fx, fz);
          if (o.how === 'onSeat') {
            var seat = Q.surfaceUnder(ei, cx + fx * 0.05, cz + fz * 0.05, b.min[1] + 0.7), key = el.id + ':0';
            var rs = Q.ask('seat_item', { given: { seat_found: seat != null, seat_height: seat == null ? null : +(seat - b.min[1]).toFixed(3), chair_free: S.seated.indexOf(key) < 0 && S.seated.indexOf(el.id + ':seat') < 0 }, all: true }, ctx);
            if (!rs.ok) { Q.refuse(name, 'seat_item', where, 1, tally(rs), rs); no(name, 'the seat fails'); return false; }
            S.seated.push(el.id + ':seat'); var px = cx - fx * (o.back != null ? o.back : 0.08), pz = cz - fz * (o.back != null ? o.back : 0.08);
            put(o, px, seat + (o.dy || 0), pz, yawF + (o.yaw || 0) * Math.PI / 180, { on: el.id }); Q.record(name, where, rs, [px, seat, pz]); ok(name); return true; }
          // beside: the chair's own half width along its right, then a gap, then the item; right side first, then left
          var pts = S.ptsOf(WM.pack.meshes.get(el.mesh), (function () { var a = []; for (var t = el.triStart; t < el.triStart + el.triCount; t++) a.push(t); return a; })()), hw = 0, hd = 0;
          pts.forEach(function (p) { hw = Math.max(hw, Math.abs((p[0] - cx) * rx + (p[1] - cz) * rz)); hd = Math.max(hd, Math.abs((p[0] - cx) * fx + (p[1] - cz) * fz)); });
          var tl = {}, last = null, tried = 0;
          for (var sd = 0; sd < 2; sd++) { var sg = sd ? -1 : 1, d = hw + (o.gap || 0.08) + hs[0], x = cx + rx * sg * d, z = cz + rz * sg * d, rad = Math.max(hs[0], hs[2]);
            var inr = Math.min(hs[0], hs[2]) * 0.8;                      // the floor is asked under the item's inner footprint; its true turned box is asked against the real surfaces
            var res = Q.ask('free_floor_item', { map: map, x: x, z: z, hx: inr, hz: inr, r: rad, reachR: rad + 0.5, turn: { x: x, z: z, ux: rx, uz: rz }, box: [[-hs[0], y0 + 0.05, -hs[2]], [hs[0], y0 + Math.max(0.2, hs[1]), hs[2]]] }, ctx);
            tried++; last = res; if (!res.ok) { tl[res.failed] = (tl[res.failed] || 0) + 1; continue; }
            S.spots.push({ x: x, z: z, r: rad }); S.placedBoxes.push([[x - rad, y0 + 0.05, z - rad], [x + rad, y0 + hs[1], z + rad]]);
            put(o, x, y0, z, yawF, { by: el.id }); withs(o, x, y0, z, yawF, hs[1]); Q.record(name, 'beside ' + where, res, [x, y0, z]); ok(name); return true; }
          Q.refuse(name, 'free_floor_item', 'beside ' + where, tried, tl, last); no(name, 'no free side by ' + el.name); return false; });
      } else if (o.how === 'at' && o.atAny && !o.__one) {
        // o.atAny (2026-11-24, helsinki 16): a row of proposals (along a balcony's railing) - each is asked the same list, in order; the
        // first that passes is the place. Nothing passes = refused, with the last answers.
        var got = false; for (var ai = 0; ai < o.atAny.length && !got; ai++) { var o1 = Object.assign({}, o, { at: o.atAny[ai], __one: true, __quiet: ai < o.atAny.length - 1 }), before = out.length;
          PLAN.__moreOne(o1); got = out.length > before; }
        if (!got) no(name, 'none of ' + o.atAny.length + ' points along the edge passes');
      } else if (o.how === 'at') {
        var M = o.level ? Q.map(o.level) : map, fy = M.floorAt(o.at[0], o.at[1]), yaw = (o.yaw || 0) * Math.PI / 180, rad = Math.max(hs[0], hs[2]), where = 'the point ' + o.at.join(', ');
        if (fy == null) { Q.refuse(name, 'free_floor_item', where, 0, { floor_under: 0 }); return no(name, 'no floor at ' + where); }
        var ux = Math.cos(yaw), uz = -Math.sin(yaw);
        // o.drawn (2026-11-24): the ARCHITECT drew it there (a chair of his dining table, his living set) - where it stands is his call, so it
        // is asked 'drawn_item': floor, flat, its space empty, clear of everything but its own group. A proposal of ours asks the full list.
        var res = Q.ask(o.drawn ? 'drawn_item' : 'free_floor_item', { map: M, x: o.at[0], z: o.at[1], hx: Math.min(hs[0], hs[2]) * 0.8, hz: Math.min(hs[0], hs[2]) * 0.8, r: rad, reachR: rad + 0.5, all: true, group: o.group, turn: { x: o.at[0], z: o.at[1], ux: ux, uz: uz }, box: [[-hs[0], fy + 0.05, -hs[2]], [hs[0], fy + Math.max(0.2, hs[1]), hs[2]]] }, ctx);
        if (!res.ok) { if (o.__quiet) return; Q.refuse(name, o.drawn ? 'drawn_item' : 'free_floor_item', where, 1, tally(res), res); return no(name, where + ' fails ' + JSON.stringify(tally(res))); }
        S.spots.push({ x: o.at[0], z: o.at[1], r: rad, group: o.group }); put(o, o.at[0], fy + 0.004, o.at[1], yaw, {}); withs(o, o.at[0], fy + 0.004, o.at[1], yaw, hs[1]); Q.record(name, where, res, [o.at[0], fy, o.at[1]]); ok(name);
      } else if (o.how === 'bed') {
        // THE GARDEN: in a planting bed of a floor (plan.floors[..].beds). The spots come from a fixed rule (a hash of the
        // bed and the piece), the same on every load; each is asked 'garden_item'. gspots = what already stands in the garden.
        var fl = (PLAN.floors || []).filter(function (f) { return f.id === o.floor; })[0], bed = fl && fl.beds && fl.beds[o.bed]; if (!bed) return no(name, 'no such bed');
        var Mg = Q.map(fl.level || PLAN.levelY || 574.55), gs = Mg.__garden || (Mg.__garden = []), cs = Math.cos(bed.rot || 0), sn = Math.sin(bed.rot || 0), nodes = o.nodes || [o.node], placed = 0;
        for (var n = 0; n < (o.count || 1); n++) { var done = false, tl2 = {}, last2 = null, tried2 = 0;
          for (var tr = 0; tr < 40 && !done; tr++) { var seed = o.bed * 1000 + n * 50 + tr + (o.seed || 0), a = hash(seed, 1) * Math.PI * 2, r0 = hash(seed, 2), r = o.zone === 'centre' ? r0 * 0.45 : o.zone === 'edge' ? 0.62 + r0 * 0.3 : Math.sqrt(r0) * 0.85;
            var sc = (o.scaleMin || o.scale || 1) + hash(seed, 3) * ((o.scaleMax || o.scale || 1) - (o.scaleMin || o.scale || 1)), oo = { item: o.item, node: nodes[(n + (o.seed || 0)) % nodes.length], scale: sc }, h2 = size(oo), rad2 = Math.max(h2[0], h2[2]) * (o.foot || 0.7);
            var u = Math.cos(a) * r * bed.rx, v = Math.sin(a) * r * bed.rz, x = bed.x + u * cs - v * sn, z = bed.z + u * sn + v * cs, fy2 = Mg.floorAt(x, z);
            var inBed = Math.hypot((Math.abs(u) + rad2 * (o.over != null ? o.over : 0.6)) / bed.rx, (Math.abs(v) + rad2 * (o.over != null ? o.over : 0.6)) / bed.rz) <= 1;
            var gap = 99; gs.forEach(function (q) { var d = Math.hypot(q.x - x, q.z - z) - q.r - rad2; if (d < gap) gap = d; });
            var res2 = Q.ask('garden_item', { map: Mg, x: x, z: z, hx: Math.min(rad2, 0.3), hz: Math.min(rad2, 0.3), r: rad2, box: fy2 == null ? null : [[x - rad2 * 0.5, fy2 + 0.15, z - rad2 * 0.5], [x + rad2 * 0.5, fy2 + Math.max(0.3, h2[1] * 0.8), z + rad2 * 0.5]],
              given: { in_bed: inBed, apart: +gap.toFixed(2) } }, ctx);
            tried2++; last2 = res2; if (!res2.ok) { tl2[res2.failed] = (tl2[res2.failed] || 0) + 1; continue; }
            gs.push({ x: x, z: z, r: rad2 }); put(oo, x, fy2 + 0.012 - (o.sink || 0) * h2[1], z, hash(seed, 4) * Math.PI * 2, { garden: true });
            Q.record(name, 'bed ' + o.bed + ' of ' + o.floor, res2, [x, fy2, z]); ok(name); placed++; done = true; }
          if (!done) { Q.refuse(name, 'garden_item', 'bed ' + o.bed + ' of ' + o.floor, tried2, tl2, last2); no(name, 'no spot in bed ' + o.bed); } }
      } else if (o.how === 'walk') {
        // A WALKING PERSON: the route's points are the planner's; the map must prove every 25 cm of it is floor a person can
        // walk on, with a free line of sight along each leg (a closed door or a glass wall on the way = refused).
        // The plan's route is a PROPOSAL: the same route is also tried moved sideways (15 cm steps, up to 0.6 m each way) and the
        // first one that passes every question is walked - a plant by the wall decides the lane, not the planner's guess.
        var base = o.route, dxr = base[1][0] - base[0][0], dzr = base[1][1] - base[0][1], lr = Math.hypot(dxr, dzr) || 1, px = -dzr / lr, pz = dxr / lr, okW = null, lastW = null, triedW = 0;
        [0, 0.15, -0.15, 0.3, -0.3, 0.45, -0.45, 0.6, -0.6].forEach(function (off) { if (okW) return;
          var pts = base.map(function (q) { return [+(q[0] + px * off).toFixed(2), +(q[1] + pz * off).toFixed(2)]; }), len = 0, onFloor = 0, total = 0, free = true, near = 99;
          for (var k = 1; k < pts.length; k++) { var A = pts[k - 1], B = pts[k], l = Math.hypot(B[0] - A[0], B[1] - A[1]); len += l; if (!map.lineFree(A[0], A[1], B[0], B[1])) free = false;
            for (var d = 0; d <= l; d += 0.25) { var x = A[0] + (B[0] - A[0]) * d / l, z = A[1] + (B[1] - A[1]) * d / l, c = map.cell(x, z); total++; if (c >= 0 && map.walk[c]) onFloor++;
              S.spots.forEach(function (q) { var dd = Math.hypot(q.x - x, q.z - z) - q.r - 0.25; if (dd < near) near = dd; }); } }
          var rw = Q.ask('walking_person', { given: { route_long: +len.toFixed(1), route_on_floor: +(onFloor / total).toFixed(3), route_free: free, apart: +near.toFixed(2) }, all: true }, ctx);
          triedW++; lastW = rw; if (rw.ok) okW = { pts: pts, res: rw, off: off }; });
        var whereW = 'route ' + JSON.stringify(base);
        if (!okW) { Q.refuse(o.who, 'walking_person', whereW, triedW, tally(lastW), lastW); return no(o.who, 'no lane of the route passes ' + JSON.stringify(tally(lastW))); }
        var fyW = map.floorAt(okW.pts[0][0], okW.pts[0][1]); if (fyW == null) fyW = y0;
        out.push({ file: '../people/' + o.who + '.glb', pos: [okW.pts[0][0], fyW, okW.pts[0][1]], quat: S.yawQ(0), scale: [1, 1, 1], person: true, walk: { pts: okW.pts, speed: o.speed || 0.6 } });
        S.spots.push({ x: okW.pts[0][0], z: okW.pts[0][1], r: 0.25, person: true });
        Q.record(o.who, whereW + (okW.off ? ' moved ' + okW.off + ' m sideways' : ''), okW.res, [okW.pts[0][0], fyW, okW.pts[0][1]]); ok(o.who);
      }
    }
    S.load(out);
    if (window.__dressPlan) window.__dressPlan.placed = (window.__dressPlan.placed || []).concat(out);
    window.__dressAnswers = Q.answers();
    console.log('[dress] more: ' + JSON.stringify(log));
    return log;
  };
})();
