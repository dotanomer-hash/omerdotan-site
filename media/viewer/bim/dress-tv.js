// LOCAL ONLY (2026-11-11): LIVE SCREENS (his words "maybe the tv to be alive"; his choice: BOTH - the day board in the day
// rooms and dining halls, his own reel in the lobbies). Called by dress-plan.js.
// The screen is the Revit part of the TV family ('תמונת טלויזיה'). Its biggest face that looks into the room (the side with
// more free space in front of it) gets a picture 3 mm in front: a canvas redrawn every second, a video, or a desktop for the
// office monitors. Unlit (a screen gives light, it does not take it). Never the pack's geometry.
(function () {
  'use strict';
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  window.__dressTVs = function (PLAN, MATS) {
    var WM = window.WM, THREE = WM.THREE, S = PLAN.screens; if (!S) return null;
    var rooms = (WM.pack.manifest.rooms || []).filter(function (r) { return String(r.level || '').indexOf(PLAN.level) >= 0; });
    var out = { board: 0, reel: 0, desktop: 0, refused: [], reels: {} };
    // the day board: one canvas for every board screen, redrawn once a second
    var cv = document.createElement('canvas'); cv.width = 1024; cv.height = 576; var cx = cv.getContext('2d');
    var boardTex = new THREE.CanvasTexture(cv); boardTex.colorSpace = THREE.SRGBColorSpace;
    function drawBoard() {
      var d = new Date(), hh = d.getHours(), mm = d.getMinutes();
      var g = cx.createLinearGradient(0, 0, 0, 576); g.addColorStop(0, '#1f3a5f'); g.addColorStop(1, '#14263f'); cx.fillStyle = g; cx.fillRect(0, 0, 1024, 576);
      cx.fillStyle = '#f4e9d0'; cx.font = 'bold 64px Arial'; cx.fillText(DAYS[d.getDay()], 56, 110);
      cx.font = '40px Arial'; cx.fillStyle = '#c9d6e6'; cx.fillText(d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(), 56, 170);
      cx.font = 'bold 150px Arial'; cx.fillStyle = '#ffffff'; cx.fillText((hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm, 56, 340);
      cx.font = 'bold 34px Arial'; cx.fillStyle = '#f2c46d'; cx.fillText('Today', 620, 110);
      cx.font = '32px Arial';
      (S.activities || []).forEach(function (a, i) { var past = (a[0] < hh * 100 + mm); cx.fillStyle = past ? '#7f93ab' : '#ffffff';
        cx.fillText(String(a[0]).replace(/(\d\d)$/, ':$1').padStart(5, '0') + '  ' + a[1], 620, 170 + i * 52); });
      cx.fillStyle = '#f2c46d'; cx.fillRect(56, 400, 480, 6);
      cx.font = '34px Arial'; cx.fillStyle = '#c9d6e6'; cx.fillText(S.greeting || 'Good day', 56, 470);
      boardTex.needsUpdate = true;
    }
    drawBoard(); setInterval(drawBoard, 1000);
    // THE VIDEOS (his words 2026-11-13: "show the site hero instead in some and the prepared video ... (soldiers club) for the
    // others"): S.reels = the list; the video screens take them in turn, so neighbours never show the same film.
    var REELS = (S.reels || [S.reel]).map(function (src) { var v = document.createElement('video'); v.src = src; v.muted = true; v.loop = true; v.playsInline = true; v.crossOrigin = 'anonymous';
      var tx = new THREE.VideoTexture(v); tx.colorSpace = THREE.SRGBColorSpace; return { src: src, vid: v, tex: tx, on: false }; }), reelN = 0, started = false;
    function startReel() { if (started) return; started = true; REELS.forEach(function (r) { if (r.on) r.vid.play().catch(function () { started = false; }); }); }
    // the office desktop: a still picture
    var dc = document.createElement('canvas'); dc.width = 512; dc.height = 288; var dx = dc.getContext('2d');
    var dg = dx.createLinearGradient(0, 0, 512, 288); dg.addColorStop(0, '#2b6c8f'); dg.addColorStop(1, '#7fb3c8'); dx.fillStyle = dg; dx.fillRect(0, 0, 512, 288);
    dx.fillStyle = 'rgba(255,255,255,0.9)'; dx.fillRect(40, 40, 260, 180); dx.fillStyle = '#1f3a5f'; dx.fillRect(40, 40, 260, 24);
    dx.fillStyle = '#9fb3c4'; for (var l = 0; l < 6; l++) dx.fillRect(56, 82 + l * 22, 200 - (l % 3) * 40, 8);
    dx.fillStyle = 'rgba(20,30,40,0.75)'; dx.fillRect(0, 266, 512, 22);
    var deskTex = new THREE.CanvasTexture(dc); deskTex.colorSpace = THREE.SRGBColorSpace;
    var RC = new THREE.Raycaster(), WALLS = WM.pack.meshes.get('Walls');
    function nearestRoom(x, z) { var best = null, bd = 1e9; rooms.forEach(function (r) { var d = Math.hypot(r.pos[0] - x, r.pos[2] - z); if (d < bd) { bd = d; best = r; } }); return best; }
    WM.pack.elements.forEach(function (el) {
      if (el.cat !== 'Furniture' || String(el.level || '').indexOf(PLAN.level) < 0 || !el.mats || !el.mats.length) return;
      var kind = el.name === S.wallTV ? 'tv' : el.name === S.monitor ? 'monitor' : null; if (!kind) return;
      var mesh = WM.pack.meshes.get(el.mesh), pos = mesh.geometry.getAttribute('position'), idx = mesh.geometry.getIndex(), t = el.triStart, tris = [];
      el.mats.forEach(function (r) { var nm = r[1] >= 0 ? (MATS[r[1]] || {}).name : '(none)'; if (nm === S.screenPart) for (var j = 0; j < r[0]; j++) tris.push(t + j); t += r[0]; });
      if (!tris.length) { out.refused.push(el.id + ': no screen part'); return; }
      // the screen's faces, grouped by normal; the biggest pair of opposite faces is the screen's front and back
      var faces = {};
      tris.forEach(function (tt) { var v = [0, 1, 2].map(function (k) { var i = idx.getX(tt * 3 + k); return new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)); });
        var n = new THREE.Vector3().subVectors(v[1], v[0]).cross(new THREE.Vector3().subVectors(v[2], v[0])), a = n.length() / 2; if (a < 1e-6) return; n.normalize();
        var key = [Math.round(n.x * 10), Math.round(n.y * 10), Math.round(n.z * 10)].join(','), f = faces[key] || (faces[key] = { n: n, area: 0, pts: [] }); f.area += a; f.pts.push(v[0], v[1], v[2]); });
      var list = Object.keys(faces).map(function (k) { return faces[k]; }).filter(function (f) { return Math.abs(f.n.y) < 0.3; }).sort(function (a, b) { return b.area - a.area; });
      if (!list.length) { out.refused.push(el.id + ': no upright screen face'); return; }
      // front = the big face whose normal points to the room point (the back faces the wall)
      var c0 = new THREE.Vector3(); list[0].pts.forEach(function (p) { c0.add(p); }); c0.multiplyScalar(1 / list[0].pts.length);
      // the BACK is the side with a wall right behind it (seen: two TVs back to back on one wall both faced the same room)
      var room = nearestRoom(c0.x, c0.z), F = list[0];
      if (list[1] && list[1].n.dot(list[0].n) < -0.9) {
        var free = function (nn) { RC.set(c0.clone().addScaledVector(nn, 0.06), nn); RC.far = 3; var h = RC.intersectObject(WALLS, false); return h.length ? h[0].distance : 3; };
        if (free(list[1].n) > free(list[0].n)) F = list[1];
        var c1 = new THREE.Vector3(); F.pts.forEach(function (p) { c1.add(p); }); c1.multiplyScalar(1 / F.pts.length); room = nearestRoom(c1.x + F.n.x, c1.z + F.n.z);
      }
      var n = F.n.clone(), c = new THREE.Vector3(); F.pts.forEach(function (p) { c.add(p); }); c.multiplyScalar(1 / F.pts.length);
      var right = new THREE.Vector3(0, 1, 0).cross(n).normalize(), up = n.clone().cross(right).normalize(), w = 0, h = 0;
      F.pts.forEach(function (p) { var d = p.clone().sub(c); w = Math.max(w, Math.abs(d.dot(right))); h = Math.max(h, Math.abs(d.dot(up))); });
      var type = kind === 'monitor' ? 'desktop' : (room && S.reelRooms && S.reelRooms.some(function (s) { return String(room.name).indexOf(s) >= 0; }) ? 'reel' : 'board');
      var reel = type === 'reel' ? REELS[reelN++ % REELS.length] : null; if (reel) { reel.on = true; out.reels[reel.src] = (out.reels[reel.src] || 0) + 1; }
      var tex = reel ? reel.tex : type === 'desktop' ? deskTex : boardTex;
      var g = new THREE.PlaneGeometry(w * 2 * 0.96, h * 2 * 0.96), m = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(S.glow || 0.9, S.glow || 0.9, S.glow || 0.9) });
      var o = new THREE.Mesh(g, m); o.position.copy(c).addScaledVector(n, 0.003);
      o.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, n)); o.name = 'dress-screen:' + type + ':' + el.id; o.userData.notPack = true; o.userData.dressPlan = true;
      WM.scene.add(o); out[type]++;
      if (type === 'reel') { started = false; startReel(); }
    });
    addEventListener('pointerdown', startReel, { once: true });            // a browser may hold a video until the first click
    console.log('[dress] screens: ' + JSON.stringify(out));
    return out;
  };
})();
