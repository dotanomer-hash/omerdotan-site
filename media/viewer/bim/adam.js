// LOCAL ONLY - Adam walking in the regular oYmer BIM Viewer (his ask 2026-11-07: "on the regular viewer add adam.
// put it on the other session local host not on the real site"). Loaded only by adam.html; both files are listed in
// .git/info/exclude, so git never sees them and no push can carry them to omerdotan.com.
//
// Adam = the splat walk page's walker (media/viewer/walk/, setupPeople), ported to the viewer's own scene:
//   adam_turn.glb = Adam (Mixamo Ch08) + his own "Walk Start Turn 180", floor travel flattened (turns on the spot)
//   walk_anim.glb = a seamless walk cycle (Remy's skeleton), moved onto Adam by bone name THROUGH THE REST POSES
//   (q_adam = rest_adam * rest_remy^-1 * q_remy), only the hips' position copied, Remy's bob scaled by hips height.
//   Every clip starts at time 0 (tracks share time arrays - each array shifted once). He hangs in a pivot under his
//   body's centre. 0.90 m/s at 1.78 m tall (feet do not slide). A -> B, stop, his own 180 turn once, back.
// Here he is IN the viewer's scene, so the real BIM walls hide him by plain depth testing and the viewer's sun,
// sky and shadows light him. The page opens at the viewer's own start (the patio corridor) and he walks there.
(function () {
  'use strict';
  var WM = window.WM;
  if (!WM || !WM.on) return;
  var THREE = WM.THREE;
  var WALK = '../walk/';                                 // the walk page's own files, read only
  // THE PAGE OPENS AT THE VIEWER'S OWN START (his pick 2026-11-07: the old viewer movie's spot - the sunny glass
  // corridor by the patio, ground floor - start.js in a7bf193, desktop and VR), and Adam walks THERE, in front of you.
  // HIS ROUTE (his ask 2026-11-07: "can you walk him through the right corridors as well?"), every turn to HIS right,
  // read off the viewer's own floor grid + colliders (mapped 2026-11-07):
  //   leg 0  the start corridor, from the glass partition's door (x -12.2) to the corner at the east corridor
  //   leg 1  the east corridor along the patio glass, south to the wide hall (z about -10.75)
  //   leg 2  the hall, east to the splat walk's corridor 139 (x about -3.05)
  //   leg 3  corridor 139, north (the splat walk's own corridor)
  // Each leg runs on ITS corridor's middle line (median of rays across it); a corner is where two lines meet. At either
  // end he plays his own 180 turn and walks the whole route back. He starts 2 m in front of the camera on leg 0,
  // walking away toward the partition.
  // a page may give its own route (WALK_03 = the splat walk's route in corridor 139)
  var LEGS = window.ADAM_LEGS || [
    { along: 'x', from: -12.2, to: -9.25, at: 2.0 },
    { along: 'z', from: 1.8, to: -10.75, at: -9.25 },
    { along: 'x', from: -9.25, to: -3.05, at: -10.75 },
    { along: 'z', from: -10.75, to: 3.0, at: -3.05 }
  ];
  var HEIGHT = 1.78, SPEED = 0.90, TURN_RATE = 3.0;   // SPEED: Adam measured; a character with her own clip gets hers measured (gaitOf)      // rad/s round a corner (90 deg in about 0.5 s, walking)

  // ---------- Adam ----------
  function fromZero(clip) {
    var t0 = Infinity, seen = new Set();
    clip.tracks.forEach(function (t) { t0 = Math.min(t0, t.times[0]); });
    clip.tracks.forEach(function (t) { if (seen.has(t.times)) return; seen.add(t.times); for (var i = 0; i < t.times.length; i++) t.times[i] -= t0; });
    clip.resetDuration(); return clip;
  }
  function load(url) { return new Promise(function (ok, bad) { new window.GLTFLoader().load(url, ok, undefined, bad); }); }
  function hipsOf(root) { var h = null; root.traverse(function (o) { if (!h && /Hips$/.test(o.name)) h = o; }); return h; }
  function restOf(root) { var m = {}; root.traverse(function (o) { if (/Hips$|mixamorig/.test(o.name)) m[o.name.replace(/^mixamorig\d*/, '')] = o.quaternion.clone(); }); return m; }

  var walker = null, mixer = null, walkA = null, turnA = null, mode = 'walk';
  var turnYaw0 = 0;
  var route = null, cum = null, total = 0, d = 0, dir = -1, yaw = 0;

  // a leg's middle line: rays to both sides every 0.5 m along it (and 4 m past its ends - by a corner or a side
  // opening one side is open, so no pair spans the corridor there), the MEDIAN middle taken (a ray through a door
  // pulls one sample sideways - measured 1.1 m off once). Sides = walls, the patio's glass, doors, windows.
  function middleOf(leg) {
    var sides = ['Walls', 'Curtain Panels', 'Doors', 'Windows'].map(function (c) { return WM.pack.meshes.get(c); }).filter(Boolean);
    var rc = new THREE.Raycaster(), mids = [], lo = Math.min(leg.from, leg.to) - 4, hi = Math.max(leg.from, leg.to) + 4;
    for (var u = lo; u <= hi; u += 0.5) {
      var x = leg.along === 'x' ? u : leg.at, z = leg.along === 'x' ? leg.at : u;
      var f = WM.floorYat(x, z, 575.5); if (f == null || Math.abs(f - 574.55) > 0.3) continue;
      var o = new THREE.Vector3(x, f + 1.0, z), dd = {};
      [-1, 1].forEach(function (sg) {
        rc.set(o, leg.along === 'x' ? new THREE.Vector3(0, 0, sg) : new THREE.Vector3(sg, 0, 0)); rc.far = 4;
        var hit = rc.intersectObjects(sides, false)[0]; dd[sg] = hit ? hit.distance : null;
      });
      if (dd[-1] != null && dd[1] != null && dd[-1] + dd[1] < 3.5) mids.push(leg.at + (dd[1] - dd[-1]) / 2);
    }
    mids.sort(function (a, b) { return a - b; });
    return mids.length ? mids[mids.length >> 1] : leg.at;
  }
  // the route: the first leg's start, each corner (where a leg's line meets the next one's), the last leg's end
  function makeRoute() {
    var lines = LEGS.map(middleOf), pts = [];
    function P(x, z) { return new THREE.Vector3(x, 574.55, z); }
    var L0 = LEGS[0];
    pts.push(L0.along === 'x' ? P(L0.from, lines[0]) : P(lines[0], L0.from));
    for (var i = 0; i < LEGS.length - 1; i++) {
      var a = LEGS[i], la = lines[i], lb = lines[i + 1];
      pts.push(a.along === 'x' ? P(lb, la) : P(la, lb));
    }
    var Ln = LEGS[LEGS.length - 1], ln = lines[lines.length - 1];
    pts.push(Ln.along === 'x' ? P(Ln.to, ln) : P(ln, Ln.to));
    // ⛔ A CLOSED DOOR ACROSS HIS WAY ENDS THE ROUTE (measured 2026-11-07: the colliders carve every door opening
    // open, so the body test alone let him walk THROUGH two closed leaves - in the east corridor and in the hall).
    // A ray along each leg at knee, waist and head height finds the first door leaf, glass or furniture across it;
    // the route stops 0.6 m before it and he turns there. No door is hidden or moved.
    var block = ['Doors', 'Curtain Panels', 'Windows', 'Walls', 'Furniture', 'Generic Models', 'Casework', 'Specialty Equipment']
      .map(function (c) { return WM.pack.meshes.get(c); }).filter(Boolean), rc = new THREE.Raycaster();
    window.__adamStoppedBy = null;
    for (var j = 1; j < pts.length; j++) {
      var a0 = pts[j - 1], dv = pts[j].clone().sub(a0), L = dv.length(); dv.normalize();
      var first = null;
      [0.3, 1.0, 1.7].forEach(function (h) {
        rc.set(new THREE.Vector3(a0.x, 574.55 + h, a0.z), dv); rc.far = L;
        var hit = rc.intersectObjects(block, false)[0];
        if (hit && (!first || hit.distance < first.distance)) first = hit;
      });
      if (first) {
        var keep = Math.max(0, first.distance - 0.6);
        pts.length = j; pts.push(a0.clone().addScaledVector(dv, keep));
        window.__adamStoppedBy = { leg: j - 1, cat: first.object.userData.cat, at_m: +first.distance.toFixed(2) };
        break;
      }
    }
    cum = [0]; for (var k = 1; k < pts.length; k++) cum.push(cum[k - 1] + pts[k].distanceTo(pts[k - 1]));
    total = cum[cum.length - 1];
    return pts;
  }
  function at(dist, out) {                              // a point on the route + the way the route runs there
    var k = 1; while (k < cum.length - 1 && dist > cum[k]) k++;
    var a = route[k - 1], b = route[k], t = (dist - cum[k - 1]) / Math.max(1e-6, cum[k] - cum[k - 1]);
    out.copy(a).lerp(b, Math.max(0, Math.min(1, t)));
    return Math.atan2(b.x - a.x, b.z - a.z);
  }
  // the whole route, stepped every 0.25 m against the viewer's own colliders and floors (the same body test the
  // visitor's walk uses) - so a leg that cuts a wall or leaves the floor shows up as a number, not a guess
  function checkRoute() {
    var p = new THREE.Vector3(), worst = 0, worstAt = null, noFloor = 0;
    for (var s2 = 0; s2 <= total; s2 += 0.25) {
      at(s2, p); var f = WM.floorYat(p.x, p.z, 575.5);
      if (f == null) { noFloor++; continue; }
      var pen = WM.__penetrationAt ? WM.__penetrationAt(p.x, p.z, f + 1.6) : 0;
      if (pen > worst) { worst = pen; worstAt = [+p.x.toFixed(2), +p.z.toFixed(2)]; }
    }
    return { worstPenetration_m: +worst.toFixed(3), at: worstAt, noFloorSteps: noFloor };
  }

  // WHO WALKS (his pick 2026-11-07: "the man is not good ... one young woman" -> Rocketbox Female_Adult_07, MIT
  // licence, github.com/microsoft/Microsoft-Rocketbox). She carries her OWN clips on her own skeleton - Rocketbox's
  // f_walk_neutral (motion-extracted, walks on the spot) and f_turn_left_180 - so nothing is copied from another body.
  // ?who=adam brings Adam back (the Mixamo man + Remy's walk, moved across through the rest poses).
  var WHO = new URLSearchParams(location.search).get('who') || 'woman07';
  function loadCharacter() {
    if (WHO !== 'adam') return load('adamlib/woman07.glb?v=2').then(function (g) {
      var by = {}; g.animations.forEach(function (c) { by[c.name] = c; });
      if (!by.walk || !by.turn) throw new Error('woman07.glb: clips ' + Object.keys(by).join(','));
      return { body: g.scene, walk: fromZero(by.walk), turn: fromZero(by.turn), own: true };
    });
    return adamCharacter();
  }
  function adamCharacter() {
    return Promise.all([load(WALK + 'adam_turn.glb?v=1'), load(WALK + 'walk_anim.glb?v=1')]).then(function (r) {
      var ga = r[0], gw = r[1], body = ga.scene;
      var aH = hipsOf(body), wH = hipsOf(gw.scene), aP = aH.name.replace(/Hips$/, ''), wP = wH.name.replace(/Hips$/, '');
      var rA = restOf(body), rW = restOf(gw.scene), qa = new THREE.Quaternion(), qd = new THREE.Quaternion();
      var wc = fromZero(gw.animations[0]), tracks = [];
      wc.tracks.forEach(function (t) {
        var dot = t.name.lastIndexOf('.'), bone = t.name.slice(0, dot), prop = t.name.slice(dot + 1);
        var nb = aP + bone.slice(wP.length), c, v, i;
        if (prop === 'quaternion') {
          c = t.clone(); c.name = nb + '.quaternion';
          var key = bone.replace(/^mixamorig\d*/, '');
          if (rA[key] && rW[key]) { qd.copy(rW[key]).invert().premultiply(rA[key]); v = c.values;
            for (i = 0; i < v.length; i += 4) qa.fromArray(v, i).premultiply(qd).toArray(v, i); }
          tracks.push(c);
        } else if (prop === 'position' && bone === wH.name) {
          c = t.clone(); c.name = nb + '.position'; v = c.values;
          var k = aH.position.y / wH.position.y, x0 = v[0], z0 = v[2];
          for (i = 0; i < v.length; i += 3) { v[i] = aH.position.x + (v[i] - x0) * k; v[i + 1] = v[i + 1] * k; v[i + 2] = aH.position.z + (v[i + 2] - z0) * k; }
          tracks.push(c);
        }
      });
      return { body: body, walk: new THREE.AnimationClip('walk', wc.duration, tracks), turn: fromZero(ga.animations[0]), own: false };
    });
  }

  // her clip's own walking speed and facing, MEASURED from the clip: Rocketbox's walk is NOT on the spot - its pelvis
  // travels forward through the cycle (1.53 m, measured) and jumps back at the loop (a planted-foot reading caught
  // that jump and gave 3.58 m/s). So the pelvis's straight-line travel per cycle is taken OUT of the clip (the bob and
  // sway stay), and that travel / the cycle time is her speed: the page moves her exactly as far as her steps cover,
  // so her feet do not slide. Facing = the way that travel pointed. Same idea as Adam's turn file (turn2glb.py).
  function rootPosTrack(clip) {
    return clip.tracks.find(function (t) { return /(Pelvis|Hips)\.position$/i.test(t.name); }) || null;
  }
  function flattenTravel(body, clip) {
    var tr = rootPosTrack(clip); if (!tr) return null;
    var root = null, nm = tr.name.slice(0, tr.name.lastIndexOf('.'));
    body.traverse(function (o) { if (!root && o.name === nm) root = o; });
    var n = tr.times.length, t0 = tr.times[0], t1 = tr.times[n - 1], v = tr.values;
    // the travel in WORLD terms (for her facing): the pelvis at the first and the last key, before flattening
    var m2 = new THREE.AnimationMixer(body), act = m2.clipAction(clip); act.play();
    var a = new THREE.Vector3(), b = new THREE.Vector3();
    m2.setTime(t0); body.updateMatrixWorld(true); root.getWorldPosition(a);
    m2.setTime(t1 - 1e-4); body.updateMatrixWorld(true); root.getWorldPosition(b);
    m2.stopAllAction(); m2.uncacheRoot(body);
    var dw = b.sub(a); dw.y = 0;
    // flatten in the track's own (local) space: subtract the straight line from the first key to the last
    var dx = v[(n - 1) * 3] - v[0], dy = v[(n - 1) * 3 + 1] - v[1], dz = v[(n - 1) * 3 + 2] - v[2];
    for (var i = 0; i < n; i++) {
      var k = (tr.times[i] - t0) / Math.max(1e-6, t1 - t0);
      v[i * 3] -= dx * k; v[i * 3 + 1] -= dy * k; v[i * 3 + 2] -= dz * k;
    }
    return { dist: dw.length(), time: t1 - t0, facing: Math.atan2(dw.x, dw.z) };
  }
  function gaitOf(body, clip) {
    var f = flattenTravel(body, clip); if (!f || f.dist < 0.2) return null;
    return { speed: f.dist / f.time, facing: f.facing, strideM: +f.dist.toFixed(3) };
  }
  // how far a clip turns the body about the vertical (her turn clip: does it turn her itself, or only step?)
  function yawTurnOf(body, clip) {
    var root = null; body.traverse(function (o) { if (!root && /Pelvis$|Hips$/i.test(o.name)) root = o; });
    if (!root) return 0;
    var m2 = new THREE.AnimationMixer(body), act = m2.clipAction(clip); act.play();
    var q = new THREE.Quaternion(), f = new THREE.Vector3(), yaws = [];
    [0, clip.duration - 1e-3].forEach(function (t) {
      m2.setTime(t); body.updateMatrixWorld(true); root.getWorldQuaternion(q);
      f.set(0, 0, 1).applyQuaternion(q); f.y = 0; yaws.push(Math.atan2(f.x, f.z));
    });
    m2.stopAllAction(); m2.uncacheRoot(body);
    return Math.atan2(Math.sin(yaws[1] - yaws[0]), Math.cos(yaws[1] - yaws[0]));
  }

  var TURN_ROT = 0;                                      // rotation the page adds during the turn (0 = the clip turns her)
  function build() {
    loadCharacter().then(function (c) {
      var body = c.body;
      var gait = c.own ? gaitOf(body, c.walk) : null, clipTurn = c.own ? yawTurnOf(body, c.turn) : Math.PI;
      var turnDrift = c.own ? flattenTravel(body, c.turn) : null;   // her turn on the SPOT: any pelvis travel taken out
      if (gait) SPEED = gait.speed;
      // a turn clip that only steps (motion extracted about all axes) gets the 180 from the page, spread over the clip
      TURN_ROT = Math.abs(clipTurn) < Math.PI / 2 ? Math.PI : 0;
      mixer = new THREE.AnimationMixer(body);
      walkA = mixer.clipAction(c.walk);
      turnA = mixer.clipAction(c.turn); turnA.setLoop(THREE.LoopOnce, 1); turnA.clampWhenFinished = true;
      walkA.play(); mixer.update(0); body.updateMatrixWorld(true);
      var box = new THREE.Box3().setFromObject(body, true), h = box.max.y - box.min.y, mid = box.getCenter(new THREE.Vector3());
      // her own size when it is already a person's size in metres; otherwise scaled to one
      var k2 = c.own ? ((h > 1.4 && h < 2.0) ? 1 : 1.65 / h) : HEIGHT / h;
      if (gait) SPEED = gait.speed * k2;
      body.scale.setScalar(k2); body.position.set(-mid.x * k2, -box.min.y * k2, -mid.z * k2);
      var wc = c.walk, tracks = c.walk.tracks;
      // his file says metalness 0.5 on every part (the Mixamo export); under the viewer's sky reflections that made his
      // clothes read silver-white (measured) - cloth and skin are not metal, so 0, and his own textures show
      body.traverse(function (o) {
        if (!o.isMesh) return;
        o.frustumCulled = false; o.userData.notPack = true;
        [].concat(o.material).forEach(function (m) { if (m && 'metalness' in m) { m.metalness = 0; m.needsUpdate = true; } });
      });
      // her clip's forward (measured) turned to the page's forward (+Z), in a group between the walker and the body
      var face = new THREE.Group(); face.rotation.y = gait ? -gait.facing : 0; face.add(body);
      walker = new THREE.Group(); walker.name = 'adam'; walker.add(face);
      window.__gait = gait ? { speed: +SPEED.toFixed(3), facingDeg: +(gait.facing * 180 / Math.PI).toFixed(1), strideM: gait.strideM,
                               turnDriftM: turnDrift ? +turnDrift.dist.toFixed(3) : null,
                               clipTurnDeg: +(clipTurn * 180 / Math.PI).toFixed(1), pageTurnDeg: TURN_ROT ? 180 : 0, scale: k2 } : null;
      route = makeRoute();
      // 2 m in front of the camera on leg 0, walking away (dir -1). __adamReset = back to that moment (the preview
      // clip is recorded from it)
      window.__adamReset = function () {
        d = Math.max(0, cum[1] - 0.3); dir = -1; mode = 'walk'; swapClip(turnA, walkA);
        yaw = at(d, walker.position) + Math.PI;
      };
      window.__adamReset();
      WM.scene.add(walker);
      window.__adam = { h: +h.toFixed(3), walk: +wc.duration.toFixed(3), turn: +turnA.getClip().duration.toFixed(3), tracks: tracks.length,
                        route: route.map(function (v) { return [+v.x.toFixed(2), +v.z.toFixed(2)]; }), length_m: +total.toFixed(2),
                        check: checkRoute() };
      console.log('[adam] walking', JSON.stringify(window.__adam));
    }).catch(function (e) { window.__adamErr = String(e && e.stack || e); console.error('[adam]', e); });
  }

  // ⛔ START THE NEXT CLIP BEFORE STOPPING THE OLD ONE (his eye 2026-11-07: 'when turning there is a split second when her
  // arms are in T position'). three.js puts a bone back to its REST pose the moment no playing clip uses it - stopping
  // first left every bone unused for one frame, and her rest pose is the T-pose. Playing the new clip first keeps
  // every bone in use, and mixer.update(0) applies its first frame at once.
  function swapClip(from, to) { to.reset().play(); from.stop(); mixer.update(0); }
  WM.on('frame', function (dt) {
    if (!walker) return;
    dt = Math.min(0.05, dt || 0);
    mixer.update(dt);
    var target;
    if (mode === 'walk') {
      d += dir * SPEED * dt;
      if (d >= total || d <= 0) { d = Math.min(total, Math.max(0, d)); mode = 'turn'; turnYaw0 = yaw; swapClip(walkA, turnA); }   // the 180, on the spot
      target = at(d, walker.position) + (dir < 0 ? Math.PI : 0);
      // round a corner: his heading eases toward the new leg at TURN_RATE while he keeps walking
      var diff = Math.atan2(Math.sin(target - yaw), Math.cos(target - yaw)), stepA = TURN_RATE * dt;
      yaw += Math.abs(diff) <= stepA ? diff : Math.sign(diff) * stepA;
    } else if (!turnA.isRunning()) {                    // the 180 clip has turned him: face the way back at once
      dir = -dir; mode = 'walk'; swapClip(turnA, walkA);
      yaw = at(d, walker.position) + (dir < 0 ? Math.PI : 0);
    } else if (TURN_ROT) {                              // a turn clip that only steps: the page turns her, left, over the clip
      yaw = turnYaw0 + TURN_ROT * Math.min(1, turnA.time / turnA.getClip().duration);
    }
    var f = WM.floorYat(walker.position.x, walker.position.z, 575.5);
    walker.position.y = f == null ? 574.55 : f;           // his feet on the BIM floor, every step
    walker.rotation.y = yaw;
  });

  if (WM.pack) build(); else WM.on('ready', build);

  // ================= FRAMES PER SECOND IN VR + THE PERSON SWITCH (his ask 2026-11-07, the same as the splat page) =============
  // B / Y (or Tab on a PC in VR) shows / hides a small fps plate low in front of him - starts HIDDEN. A / X hides / shows the
  // person, so the same view can be read with and without her (is the cost HER, or the view?).
  (function () {
    var cv = document.createElement('canvas'); cv.width = 384; cv.height = 96;
    var tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
    var plate = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.045), new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
    plate.renderOrder = 999; plate.visible = false; plate.userData.notPack = true; WM.scene.add(plate);
    var on = false, bWas = false, aWas = false, next = 0, ms = [], last = 0, hp = new THREE.Vector3(), hd = new THREE.Vector3();
    function paint(fps) {
      var g = cv.getContext('2d'), w = cv.width, h = cv.height; g.clearRect(0, 0, w, h);
      g.fillStyle = 'rgba(10,12,16,.78)'; g.beginPath(); g.roundRect(2, 2, w - 4, h - 4, h / 2 - 2); g.fill();
      g.fillStyle = fps >= 60 ? '#5ee07a' : fps >= 40 ? '#ffb066' : '#ff5a5a'; g.font = '700 ' + Math.round(h * 0.5) + 'px sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(fps + ' fps  BIM' + (walker && !walker.visible ? '  no person' : ''), w / 2, h / 2 + 1);
      tx.needsUpdate = true;
    }
    function toggle() { on = !on; plate.visible = on && WM.renderer.xr.isPresenting; next = 0; }
    addEventListener('keydown', function (e) { if (e.code === 'Tab' && WM.renderer.xr.isPresenting) { e.preventDefault(); e.stopImmediatePropagation(); toggle(); } }, true);
    WM.on('frame', function () {
      var xr = WM.renderer.xr; if (!xr.isPresenting) { plate.visible = false; last = 0; return; }
      var now = performance.now(); if (last) { ms.push(now - last); if (ms.length > 30) ms.shift(); } last = now;
      var C = WM.controllers || {}, pads = [C.left, C.right].map(function (c) { return c && c.userData && c.userData.gamepad; });
      var pressed = function (i) { return pads.some(function (p) { return p && p.buttons && p.buttons[i] && p.buttons[i].pressed; }); };
      var b = pressed(5); if (b && !bWas) toggle(); bWas = b;
      var a = pressed(4); if (a && !aWas && walker) { walker.visible = !walker.visible; next = 0; } aWas = a;
      plate.visible = on; if (!on) return;
      WM.camera.getWorldPosition(hp); WM.camera.getWorldDirection(hd); hd.y = 0; hd.normalize();
      var yaw = Math.atan2(-hd.x, -hd.z);
      plate.position.set(hp.x + hd.x * 0.9, hp.y - 0.45, hp.z + hd.z * 0.9); plate.rotation.set(-0.45, yaw, 0, 'YXZ');
      if (now > next && ms.length > 5) { next = now + 500; var avg = ms.reduce(function (s, v) { return s + v; }, 0) / ms.length; paint(Math.round(1000 / Math.max(1, avg))); }
    });
  })();

  // ================= THE SPLAT'S MATERIALS ON THE WALLS, CEILINGS AND DOORS (his ask 2026-11-07: "dress the walls
  // and ceilings and doors with the same materials as the splatter") =================
  // The rules are COPIED from the splat's one file, Splats/DirElAsad_BIM-splat_offline_2026-11-05/pipeline/pt.html
  // (pick(), M, SIZE with ?tm=1): per TRIANGLE, from its element's type and its own Revit material.
  //   Walls: a face whose Revit material is ARM_Stone -> his Twinmotion stone, every other face -> white paint over
  //          the plaster scan (WEAR 0.22). Ceilings: type 'למלות' -> his lamella wood, 'גבס' -> gypsum, else the
  //          acoustic 60/60 (Poly Haven ceiling_interior, 2 m). Doors: Steel/Alumin material -> the frame, else the
  //          leaf; glass faces keep the viewer's glass.
  // HOW, in the viewer: the pack's OWN geometry gets per-triangle material groups. Each new material is a copy of
  // the material that face already had (so the BAKED LIGHTMAP on uv1 stays - an overlay copy of the triangles would
  // lose it), with the splat's colour/texture, mapped by WORLD POSITION at the splat's real sizes in metres (the same
  // axis choice as pt.html). No vertex is moved. ⛔ Local only. A paint press on a dressed category afterwards
  // rebuilds that category's groups the viewer's way, so the dressing on that category goes until a reload.
  var LIB = 'adamlib/', TMS = null, texL = new THREE.TextureLoader();
  function tex(file) { var t = texL.load(LIB + file); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, WM.renderer.capabilities.getMaxAnisotropy()); return t; }
  function paintTex() {                                  // pt.html paintTex(): white paint, the plaster scan as grime only
    var S = 1024, cv = document.createElement('canvas'); cv.width = cv.height = S; var g = cv.getContext('2d');
    g.fillStyle = '#f1ede6'; g.fillRect(0, 0, S, S);
    var t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    var img = new Image(); img.onload = function () {
      g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.22; g.filter = 'brightness(1.7) saturate(0.3)'; g.drawImage(img, 0, 0, S, S);
      g.filter = 'none'; g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; t.needsUpdate = true; };
    img.src = LIB + 'mat_white_plaster_02_Diffuse.jpg'; return t;
  }
  // tri-planar by world position: the face's own flat normal (the pack has no vertex normals) picks the plane
  function worldMapped(m, wM, hM, key) {
    m.onBeforeCompile = function (sh) {
      sh.uniforms.uTile = { value: new THREE.Vector2(wM, hM) };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vDrWp;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDrWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vDrWp;\nuniform vec2 uTile;')
        .replace('#include <map_fragment>',
          'vec3 drN = abs(normalize(cross(dFdx(vDrWp), dFdy(vDrWp))));\n' +
          'vec2 drUv = drN.y > max(drN.x, drN.z) ? vDrWp.xz : (drN.x > drN.z ? vDrWp.zy : vDrWp.xy);\n' +
          'diffuseColor *= texture2D(map, drUv / uTile);');
    };
    m.customProgramCacheKey = function () { return 'dress-' + key; };
    return m;
  }
  // one dressed material per (key, the material the face had) - the copy keeps that face's lightmap and light
  var made = new Map();
  function dressed(key, base) {
    var id = key + '|' + base.uuid; if (made.has(id)) return made.get(id);
    var m = base.clone(); m.onBeforeCompile = function () {}; m.customProgramCacheKey = function () { return 'dress-' + key + '-plain'; };
    m.vertexColors = base.vertexColors; m.map = null; m.metalness = 0; m.color.set(0xffffff);
    if (key === 'wall')      { m.map = paintTex(); m.roughness = 0.9; worldMapped(m, 1.0, 1.0, key); }
    if (key === 'stone')     { m.map = tex('tm_stone.jpg'); m.roughness = 0.85; worldMapped(m, TMS.stone.w_m, TMS.stone.h_m, key); }
    if (key === 'lamella')   { m.map = tex('tm_lamella.jpg'); m.roughness = 0.55; worldMapped(m, TMS.lamella.w_m, TMS.lamella.h_m, key); }
    if (key === 'ceiling')   { m.map = tex('mat_ceiling_interior_Diffuse.jpg'); m.roughness = 0.9; worldMapped(m, 2.0, 2.0, key); }
    if (key === 'gypsum')    { m.color.set(0xf4f2ee); m.roughness = 0.9; }
    if (key === 'door')      { m.color.set(0xebeae6); m.roughness = 0.35; m.metalness = 0.25; }
    if (key === 'doorframe') { m.color.set(0x8e9194); m.roughness = 0.4; m.metalness = 0.55; }
    // a door's glass panel (RvZ_Glass): the viewer's load-time paint had painted the WHOLE door wood, glass
    // included, so the panel read brown (measured on the patio partition door). The splat draws it as glass: the
    // viewer's own clear glass recipe (wm-paint, transmission >= 0.95): b6bfc6, opacity 0.3, rough 0.05.
    if (key === 'doorglass') { m.color.set(0xb6bfc6); m.roughness = 0.05; m.metalness = 0; m.transparent = true;
                               m.opacity = 0.3; m.depthWrite = false; m.side = THREE.DoubleSide; }
    if ('clearcoat' in m) m.clearcoat = 0;
    m.needsUpdate = true; made.set(id, m); return m;
  }
  // pt.html pick(), for the three categories he named (null = keep what the viewer drew there)
  function pick(cat, type, mat) {
    if (/Glass/i.test(mat || '')) return cat === 'Doors' ? 'doorglass' : null;
    if (cat === 'Walls') return /ARM_Stone/.test(mat || '') ? 'stone' : 'wall';
    if (cat === 'Doors') return /Steel|Alumin/i.test(mat || '') ? 'doorframe' : 'door';
    if (cat === 'Ceilings') return /למלות/.test(type || '') ? 'lamella' : /גבס/.test(type || '') ? 'gypsum' : 'ceiling';
    return null;
  }
  function dressMesh(cat) {
    var mesh = WM.pack.meshes.get(cat); if (!mesh) return null;
    var g = mesh.geometry, mats = [].concat(mesh.material), names = WM.pack.manifest.materials || [];
    var nTri = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    var cur = new Int32Array(nTri);                       // each triangle's material index today
    if (g.groups.length) g.groups.forEach(function (gr) { for (var t = gr.start / 3; t < (gr.start + gr.count) / 3; t++) cur[t] = gr.materialIndex; });
    var out = mats.slice(), idxOf = new Map(), per = new Int32Array(nTri), counts = {};
    for (var t = 0; t < nTri; t++) per[t] = cur[t];
    mesh.userData.elements.forEach(function (e) {
      var at = e.triStart;
      (e.mats && e.mats.length ? e.mats : [[e.triCount, -1]]).forEach(function (run) {
        var nm = run[1] >= 0 && names[run[1]] ? names[run[1]].name : '', key = pick(cat, e.type, nm);
        for (var i = 0; i < run[0]; i++, at++) {
          var base = mats[cur[at]];
          if (!key || !base || base.visible === false || base.isMeshBasicMaterial) continue;   // hidden / removed stay so
          var m = dressed(key, base), mi = idxOf.get(m);
          if (mi == null) { mi = out.length; out.push(m); idxOf.set(m, mi); }
          per[at] = mi; counts[key] = (counts[key] || 0) + 1;
        }
      });
    });
    g.clearGroups();
    var start = 0;
    for (var u = 1; u <= nTri; u++) if (u === nTri || per[u] !== per[start]) { g.addGroup(start * 3, (u - start) * 3, per[start]); start = u; }
    mesh.material = out;
    return counts;
  }
  function wallsReady() {
    var m = WM.pack && WM.pack.meshes.get('Walls'); if (!m || !m.userData.assign || !m.userData.assign.size) return false;
    return [].concat(m.material).some(function (x) { return x && x.lightMap; });
  }
  (function dressWhenReady(tries) {
    if (!wallsReady() || !TMS) { if (tries < 400) setTimeout(function () { dressWhenReady(tries + 1); }, 100); return; }
    setTimeout(function () {                             // a beat after the load-time paint and light have settled
      var res = {};
      ['Walls', 'Ceilings', 'Doors'].forEach(function (c) { res[c] = dressMesh(c); });
      window.__dress = res; console.log('[adam] dressed like the splat', JSON.stringify(res));
    }, 600);
  })(0);
  fetch(LIB + 'tm_sizes.json').then(function (r) { return r.json(); }).then(function (j) { TMS = j; })
    .catch(function (e) { console.error('[adam] tm_sizes', e); });
  // leaving VR tells the site page, which then leaves full screen (his ask 2026-11-07)
  WM.on('xrend', function () { try { if (parent !== window) parent.postMessage({ oymer: 'xr-end' }, '*'); } catch (e) {} });
})();
