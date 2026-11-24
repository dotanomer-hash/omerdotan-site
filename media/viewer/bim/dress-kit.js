// LOCAL ONLY (2026-11-24, helsinki 16 - the fourth building): FURNITURE BUILT FROM THE ARCHITECT'S 2D SYMBOLS.
// His words: "stage the outside and inside ground floor only (apartments and public areas)". The model's furniture is 2D plan
// symbols ('OR 2d bed150-200', 'aron2-dyn wardrobe', 'K_marble' counters, 'Ashpa 1100L' bins): they say WHERE and HOW BIG, but
// have no 3D body, and no free model library has a modern bed, a built-in wardrobe or a kitchen run. So each symbol is built
// here as simple solid parts at its own rectangle: a bed (frame, mattress, duvet, pillows, headboard), a wardrobe (body, door
// seams, handles), a kitchen run (cabinets, worktop, cooktop, wall cabinets), a table, a bin, a wall of mailboxes, a rug.
// plan.kit = [{ kind, rect: [x0, z0, x1, z1], y, name, finishes: {part: material id} }] - read from Revit (bldg/q_site.py).
// LAW D1 - every piece is asked the list 'kit_piece' before it is built:
//   on_floor      - is there a floor under it, at its level (the symbol's own level)?
//   back_to_wall  - a bed's head, a wardrobe's or a counter's back: is a wall there (the gap, measured by rays)?
//   free          - does its body stand clear of the model's walls, doors and columns (the real triangles in its box)?
// Its BACK is never guessed: rays from the middle of each candidate side, outward, at 1.2 m; the side nearest a wall wins.
// The pieces are registered with the placer (window.__dressPlacedBoxes / __dressKitSpots), so nothing placed later stands in them.
(function () {
  'use strict';
  window.__dressKit = function (PLAN) {
    var WM = window.WM, T = WM.THREE, Q = window.__dressQ, out = { built: {}, refused: {} }, list = PLAN.kit || []; if (!list.length) return out;
    var walls = ['Walls', 'Curtain Panels', 'Windows', 'Doors', 'Structural Columns'].map(function (c) { return WM.pack.meshes.get(c); }).filter(Boolean);
    var rc = new T.Raycaster(); rc.far = 3;
    function gap(x, y, z, dx, dz) { rc.set(new T.Vector3(x, y, z), new T.Vector3(dx, 0, dz)); var h = rc.intersectObjects(walls, false); return h.length ? h[0].distance : 9; }
    var MATS = {}; function mat(id) { if (MATS[id]) return MATS[id]; var pm = (PLAN.materials || []).filter(function (m) { return m.id === id; })[0] || { color: id && id[0] === '#' ? id : '#cccccc', rough: 0.7 };
      // MEASURED (helsinki 16, pictures): this viewer's lights are all at 0 - a lit material is lit by the sky picture alone and every top
      // turned blue. The pieces carry their own soft daylight instead: each face its shade by where it looks (up 1.0, sides 0.86 / 0.78,
      // down 0.55), times the room's light level - the same on every load, no light needed
      var m = new T.MeshBasicMaterial({ color: new T.Color(pm.color).multiplyScalar(PLAN.kitLight || 0.9), vertexColors: true }); return (MATS[id] = m); }
    var root = new T.Group(); root.name = 'dress-kit'; root.userData.notPack = true; root.userData.dressPlan = true; WM.scene.add(root);
    function no(k, why) { out.refused[k + ': ' + why] = (out.refused[k + ': ' + why] || 0) + 1; }
    list.forEach(function (it, ii) {
      var r = it.rect, x0 = Math.min(r[0], r[2]), x1 = Math.max(r[0], r[2]), z0 = Math.min(r[1], r[3]), z1 = Math.max(r[1], r[3]), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, y = it.y;
      var name = it.kind + ' ' + (it.name || ii), F = it.finishes || {};
      // the sides it may turn its back to: a bed its two short ends, a wardrobe / counter its two long sides, a table none
      var longX = (x1 - x0) >= (z1 - z0), sides = [];
      var S4 = { '-x': [-1, 0, x0, cz], '+x': [1, 0, x1, cz], '-z': [0, -1, cx, z0], '+z': [0, 1, cx, z1] };
      if (it.kind === 'bed') sides = longX ? ['-x', '+x'] : ['-z', '+z']; else if (/wardrobe|counter|mailbox/.test(it.kind)) sides = longX ? ['-z', '+z'] : ['-x', '+x'];
      // a sofa or a chair is turned by the plan (it.back = the side its back is on: away from its table, its living set's open side);
      // it needs no wall behind it. A bed, a wardrobe or a counter with it.back is still measured on that side.
      var freeBack = /sofa|chair/.test(it.kind); if (it.back) sides = freeBack ? [] : [it.back];
      var best = null; sides.forEach(function (s) { var d = S4[s], g = 9, off = [-0.25, 0, 0.25]; off.forEach(function (f) { var ex = d[0] ? d[2] : d[2] + f * (x1 - x0), ez = d[1] ? d[3] : d[3] + f * (z1 - z0);
          g = Math.min(g, gap(ex - d[0] * 0.05, y + 1.2, ez - d[1] * 0.05, d[0], d[1])); }); if (!best || g < best.g) best = { s: s, g: +(Math.max(0, g - 0.05)).toFixed(2) }; });
      // the floor under it is MEASURED; a symbol drawn on level 0 over a sunk floor (the bin room, 22 cm down) stands on that floor
      var M = Q && Q.map ? Q.map(y) : null, fy = M ? M.floorAt(cx, cz) : y;
      if ((fy == null || Math.abs(fy - y) > 0.08) && Q && Q.map) [-0.22, 0.22].forEach(function (dy) { if (fy != null && Math.abs(fy - y) <= 0.08) return; var f2 = Q.map(+(y + dy).toFixed(2)).floorAt(cx, cz); if (f2 != null && Math.abs(f2 - (y + dy)) < 0.1) fy = f2; });
      if (fy != null && Math.abs(fy - y) < 0.3) y = fy;
      var inset = 0.03, res = Q ? Q.ask('kit_piece', { given: { on_floor: fy != null && Math.abs(fy - y) < 0.08, back_to_wall: best ? best.g : 0, free: null },
        box: [[x0 + inset, y + 0.05, z0 + inset], [x1 - inset, y + Math.min(it.h || 0.9, 2.0), z1 - inset]], all: true }, {}) : { ok: true };
      if (!res.ok) { if (Q) Q.refuse(name, 'kit_piece', 'symbol ' + (it.id || ii), 1, {}, res); return no(it.kind, res.failed + (res.failed === 'back_to_wall' ? ' (gap ' + best.g + ' at ' + best.s + ', symbol ' + it.id + ')' : '')); }
      if (Q) Q.record(name, 'symbol ' + (it.id || ii), res, [cx, y, cz]);
      // a piece's own frame: u = along its width, v = from its back (0) to its front (D); w = height
      var bs = freeBack && it.back ? it.back : best ? best.s : (longX ? '-z' : '-x'), bx = S4[bs][0], bz = S4[bs][1], W = bx ? (z1 - z0) : (x1 - x0), D = bx ? (x1 - x0) : (z1 - z0);
      function box(u0, u1, v0, v1, w0, w1, m) { var U0 = Math.min(u0, u1), U1 = Math.max(u0, u1), V0 = Math.min(v0, v1), V1 = Math.max(v0, v1), a, b, c, e;
        if (bx) { var xb = bx < 0 ? x0 : x1; a = xb - bx * V0; b = xb - bx * V1; c = z0 + U0; e = z0 + U1; } else { var zb = bz < 0 ? z0 : z1; c = zb - bz * V0; e = zb - bz * V1; a = x0 + U0; b = x0 + U1; }
        var g = new T.BoxGeometry(Math.abs(b - a), w1 - w0, Math.abs(e - c)), nr = g.getAttribute('normal'), cl = new Float32Array(nr.count * 3);
        for (var vi = 0; vi < nr.count; vi++) { var ny = nr.getY(vi), sh = ny > 0.5 ? 1.0 : ny < -0.5 ? 0.55 : Math.abs(nr.getX(vi)) > 0.5 ? 0.86 : 0.78; cl[vi * 3] = cl[vi * 3 + 1] = cl[vi * 3 + 2] = sh; }
        g.setAttribute('color', new T.BufferAttribute(cl, 3)); var o = new T.Mesh(g, mat(m)); o.position.set((a + b) / 2, y + (w0 + w1) / 2, (c + e) / 2);
        o.castShadow = o.receiveShadow = true; o.userData.notPack = true; root.add(o); return o; }
      var k = it.kind;
      if (k === 'bed') {          // the head is the back: a bed's 'width' is W, its length is D
        box(0, W, 0, D, 0, 0.28, F.frame || '#6f4a2e');
        box(0.03, W - 0.03, 0.06, D - 0.03, 0.28, 0.48, F.mattress || '#f3f1ec');
        box(-0.02, W + 0.02, D * 0.32, D + 0.02, 0.36, 0.52, F.duvet || '#d8cdb8');
        box(0.03, W - 0.03, D * 0.26, D * 0.36, 0.47, 0.55, F.duvet || '#d8cdb8');           // the fold at the top of the duvet
        var np = W > 1.2 ? 2 : 1, pw = np === 2 ? W / 2 - 0.12 : W - 0.25; for (var p = 0; p < np; p++) { var pu = 0.08 + p * (pw + 0.08) + (np === 1 ? 0.04 : 0); box(pu, pu + pw, 0.1, 0.46, 0.48, 0.62, F.pillow || '#f3f1ec'); }
        box(-0.02, W + 0.02, 0, 0.07, 0, 1.05, F.head || '#c4c0b6');
      } else if (k === 'wardrobe') {
        var H = it.h || 2.4; box(0, W, 0, D, 0, H, F.body || '#f2efe8'); var nd = Math.max(1, Math.round(W / 0.5));
        for (var i = 1; i < nd; i++) box(i * W / nd - 0.004, i * W / nd + 0.004, D, D + 0.004, 0.02, H - 0.02, F.seam || '#8a8780');
        for (i = 0; i < nd; i++) { var hu = (i % 2 ? i * W / nd + 0.06 : (i + 1) * W / nd - 0.06); box(hu - 0.008, hu + 0.008, D, D + 0.025, 0.95, 1.25, F.handle || '#2b2c2e'); }
      } else if (k === 'counter') {
        box(0, W, 0.02, D - 0.03, 0.1, 0.86, F.body || '#f2efe8'); box(0, W, 0.02, D - 0.08, 0, 0.1, F.plinth || '#3c3d40');
        box(0, W, 0, D + 0.02, 0.86, 0.9, F.top || '#e9e6df');
        var nd2 = Math.max(1, Math.round(W / 0.6)); for (i = 1; i < nd2; i++) box(i * W / nd2 - 0.003, i * W / nd2 + 0.003, D - 0.03, D - 0.026, 0.12, 0.84, F.seam || '#8a8780');
        if (it.cooktop) box(it.cooktop * W - 0.3, it.cooktop * W + 0.3, 0.06, 0.56, 0.9, 0.905, '#1d1e20');
        if (it.sink) box(it.sink * W - 0.3, it.sink * W + 0.3, 0.08, 0.5, 0.899, 0.902, '#9ea3a6');
        if (best && best.g < 0.2 && it.upper !== false) box(0, W, 0, 0.35, 1.5, 2.2, F.upper || F.body || '#f2efe8');
      } else if (k === 'table') {
        var TH = it.h || 0.75; box(0, W, 0, D, TH - 0.04, TH, F.top || '#c9a06a');
        [[0.06, 0.06], [W - 0.11, 0.06], [0.06, D - 0.11], [W - 0.11, D - 0.11]].forEach(function (q) { box(q[0], q[0] + 0.05, q[1], q[1] + 0.05, 0, TH - 0.04, F.legs || '#2b2c2e'); });
      } else if (k === 'bin') {
        var BH = it.h || 1.25; box(0.03, W - 0.03, 0.03, D - 0.03, 0.12, BH - 0.06, F.body || '#e0782a'); box(0, W, 0, D, BH - 0.06, BH, F.lid || '#3c3d40');
        [[0.05, 0.05], [W - 0.15, D - 0.15]].forEach(function (q) { box(q[0], q[0] + 0.1, q[1], q[1] + 0.1, 0, 0.12, '#1d1e20'); });
      } else if (k === 'mailbox') {
        box(0, W, 0, D, 0.7, 1.9, F.body || '#b9bdc0'); var cols = Math.max(1, Math.round(W / 0.3)), rows = 4;
        for (i = 1; i < cols; i++) box(i * W / cols - 0.003, i * W / cols + 0.003, D, D + 0.004, 0.7, 1.9, '#4a4c4f');
        for (var j = 1; j < rows; j++) box(0, W, D, D + 0.004, 0.7 + j * 1.2 / rows - 0.003, 0.7 + j * 1.2 / rows + 0.003, '#4a4c4f');
      } else if (k === 'sofa') {           // a modern box sofa: legs, a base, seat and back cushions, two arms (W = its length, D = its depth)
        var AW = 0.16, na = Math.max(1, Math.round((W - 2 * AW) / 0.75)), cw = (W - 2 * AW) / na;
        [[0.05, 0.05], [W - 0.09, 0.05], [0.05, D - 0.09], [W - 0.09, D - 0.09]].forEach(function (q) { box(q[0], q[0] + 0.04, q[1], q[1] + 0.04, 0, 0.08, F.legs || '#2b2c2e'); });
        box(0, W, 0, D, 0.08, 0.38, F.body || '#d8cdb8'); box(0, AW, 0, D, 0.38, 0.6, F.body || '#d8cdb8'); box(W - AW, W, 0, D, 0.38, 0.6, F.body || '#d8cdb8');
        for (i = 0; i < na; i++) { var u0 = AW + i * cw + 0.008, u1 = AW + (i + 1) * cw - 0.008; box(u0, u1, 0.2, D - 0.02, 0.38, 0.48, F.seat || F.body || '#d8cdb8'); box(u0, u1, 0.02, 0.24, 0.38, 0.82, F.seat || F.body || '#d8cdb8'); }
        if (F.pillow) { box(AW + 0.06, AW + 0.48, 0.2, 0.34, 0.48, 0.86, F.pillow); box(W - AW - 0.48, W - AW - 0.06, 0.2, 0.34, 0.48, 0.86, F.pillow); }
      } else if (k === 'chair') {          // a dining chair: an oak seat and back on four black steel legs
        [[0.03, 0.03], [W - 0.055, 0.03], [0.03, D - 0.055], [W - 0.055, D - 0.055]].forEach(function (q) { box(q[0], q[0] + 0.025, q[1], q[1] + 0.025, 0, 0.44, F.legs || '#2b2c2e'); });
        box(0, W, 0, D, 0.44, 0.47, F.seat || '#c9a06a'); box(0.02, W - 0.02, 0, 0.03, 0.47, 0.86, F.back || F.seat || '#c9a06a');
        box(0.03, 0.055, 0, 0.025, 0.47, 0.86, F.legs || '#2b2c2e'); box(W - 0.055, W - 0.03, 0, 0.025, 0.47, 0.86, F.legs || '#2b2c2e');
      } else if (k === 'rug') { box(0, W, 0, D, 0.002, 0.012, F.body || '#c4c0b6'); }
      else { box(0, W, 0, D, 0, it.h || 0.9, F.body || '#cccccc'); }
      // a rug lies flat: things stand on it, so it is no obstacle. A table's spot carries its group: its own chairs may come close
      if (k !== 'rug') { (window.__dressPlacedBoxes || []).push([[x0, y + 0.05, z0], [x1, y + (it.h || 0.9), z1]]);
        var ks = window.__dressKitSpots = window.__dressKitSpots || {}, key = y.toFixed(2); (ks[key] = ks[key] || []).push({ x: cx, z: cz, r: Math.min(x1 - x0, z1 - z0) / 2 + 0.05, group: it.group }); }
      out.built[k] = (out.built[k] || 0) + 1;
    });
    console.log('[dress] kit: ' + JSON.stringify(out));
    return out;
  };
})();
