// WALK_03 on omerdotan.com (his call 2026-11-08: "the bim viewer is better, much sharper. put it as a 3 in the real site").
// Loaded by baked.html = the WALK_01 viewer page + this script.
// THE BAKE FROM OUR PICTURES on the viewer's own model: corridor 139's walls, floors, ceilings and columns are covered by
// a layer 3 mm in front of each BIM face, coloured from the 732 path-traced night pictures (the SAME pictures the splat
// was trained on - pipeline/bake.html). Unlit: the light is in the texture. Texels no camera saw are cut (alpha) and
// the viewer's own surface shows there. The page opens where the splat walk opens (camera D000, looking up the corridor).
//   ?bake=0 hides the layer (the plain viewer, same spot) - the A/B.   B key toggles it live.
(function () {
  'use strict';
  var WM = window.WM; if (!WM || !WM.on) return;
  var THREE = WM.THREE, LIB = 'bakelib/';
  var START = { x: -1.952, z: -11.17 }, LOOK = { x: -1.952, z: 0 };   // the splat walk's first camera, looking up corridor 139 (+Z)
  var on = !/[?&]bake=0/.test(location.search), mesh = null;
  // JOB 1 (2026-11-10): the Blender light (?set=bl) was baked WITH the plants and the bench, so their shadows are in it -
  // the dressing shows with that light always, whatever ?bake= says (without them: black shadows on an empty wall).
  var BL = /[?&]set=bl\w*(&|$)/.test(location.search);   // every Blender set: bl (52 mm), bl12 (13 mm)...
  function dressShown() { return on || BL; }
  function build() {
    Promise.all([fetch(LIB + 'bake_mesh.bin?v=' + Date.now()).then(function (r) { return r.arrayBuffer(); }),
      fetch(LIB + 'bake_meta.json?v=' + Date.now()).then(function (r) { return r.json(); }),
      new Promise(function (ok, bad) { new THREE.TextureLoader().load(LIB + 'bake_atlas.png?v=' + Date.now(), ok, undefined, bad); })])
    .then(function (a) {
      var buf = a[0], meta = a[1], tex = a[2], n = meta.vertices, f = new Float32Array(buf);
      var P = f.subarray(0, n * 3), UV = f.subarray(n * 3, n * 5), N = f.subarray(n * 5, n * 8), pos = new Float32Array(n * 3);
      for (var i = 0; i < n * 3; i++) pos[i] = P[i] + N[i] * 0.003;            // 3 mm in front of the BIM face: no flicker
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(UV), 2));
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = WM.renderer.capabilities.getMaxAnisotropy();
      var m = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.FrontSide, toneMapped: false });
      mesh = new THREE.Mesh(g, m); mesh.name = 'BakedFromPictures'; mesh.userData.notPack = true; mesh.visible = on; mesh.frustumCulled = false;
      WM.scene.add(mesh);
      window.__bakeView = { meta: meta, mesh: mesh };
      console.log('[bake] ' + n + ' vertices, texel ' + meta.texel_mm + ' mm, from the ' + meta.pictures + ' pictures');
    }).catch(function (e) { console.error('[bake] could not load', e); });
  }
  function place(tries) {
    if (WM.renderer.xr.isPresenting) return;
    // ANOTHER BUILDING (2026-11-19, his words: "soldiers is upside down"): the spot below is the first building's corridor 139. On
    // any other model the start comes from that building's dressing plan (plan.start = where the eye stands, looking +Z);
    // with no plan, from its first room. Placed twice: start.js sets its own spot a little later.
    var pkName = decodeURIComponent((location.search.match(/[?&]pack=([^&]+)/) || [])[1] || '');
    if (pkName && !/^MKD_/.test(pkName)) { var S0 = window.__dressStart, rm = (WM.pack.manifest.rooms || []).filter(function (r) { return r.level; })[0];
      if (!S0 && tries < 25 && /[?&]dressplan=1/.test(location.search)) { setTimeout(function () { place(tries + 1); }, 200); return; }
      if (!S0 && rm) S0 = { pos: [rm.pos[0], rm.pos[1] + 1.6, rm.pos[2]], floor: rm.pos[1] }; if (!S0) return;
      var put0 = function () { if (WM.renderer.xr.isPresenting) return; var c0 = WM.camera; c0.up.set(0, 1, 0); c0.position.fromArray(S0.pos); c0.lookAt(S0.pos[0], S0.pos[1], S0.pos[2] + 10); c0.updateMatrixWorld(true);
        var rs = WM.pack.manifest.rooms || (WM.pack.manifest.rooms = []), sp = [S0.pos[0], S0.floor != null ? S0.floor : S0.pos[1] - 1.6, S0.pos[2]];   // a headset starts on the first entry of this list
        if (rs[0] && /^Start/.test(rs[0].name)) rs[0].pos = sp; else rs.unshift({ name: 'Start', number: '', level: '', pos: sp });
        // WALK mode holds the view level. Without it the page stays in its orbit view, which keeps looking at the middle of the
        // model's box - here 54 m up (the tall neighbours), so the eye looked at the sky: his "upside down".
        if (WM.setMoveMode) WM.setMoveMode(S0.mode === 'fly' ? 'fly' : 'walk'); c0.position.fromArray(S0.pos);   // plan.start.mode 'fly' (2026-11-24, the apartment building: his ask); none = walk as before
        // plan.start.look = [x, z] (2026-11-24, the WS house: the start looks AT the house, not +Z); none = +Z as before
        var LK = S0.look ? [S0.look[0], S0.look[1]] : [S0.pos[0], S0.pos[2] + 10]; c0.lookAt(LK[0], S0.pos[1], LK[1]); c0.updateMatrixWorld(true);
        if (WM._move) { WM._move.yaw = Math.atan2(LK[0] - S0.pos[0], LK[1] - S0.pos[2]); WM._move.pitch = 0; } };
      put0(); setTimeout(put0, 1500); setTimeout(put0, 4000);
      // start.js (the first building's start, a file of the live site - not edited here) gives up looking for its floor after
      // 10 s and then moves the eye to ITS spot, 576 m up. For 25 s: an eye that is suddenly far from this start is put back.
      var t0 = Date.now(), iv = setInterval(function () { if (Date.now() - t0 > 25000) return clearInterval(iv); var c1 = WM.camera.position; if (Math.hypot(c1.x - S0.pos[0], c1.y - S0.pos[1], c1.z - S0.pos[2]) > 150) put0(); }, 250);
      return; }
    if (window.__siteStart) return;   // the page names its own start (dressed.html, 2026-11-23): start.js puts the eye there
    var f = WM.floorYat ? WM.floorYat(START.x, START.z, 575.55) : null;
    if (f == null && tries < 50) { setTimeout(function () { place(tries + 1); }, 200); return; }
    if (f == null) f = 574.55;
    var rooms = WM.pack.manifest.rooms || (WM.pack.manifest.rooms = []);
    if (rooms[0] && /old viewer spot/.test(rooms[0].name)) rooms[0].pos = [START.x, f, START.z];
    var eye = (WM._move && WM._move.eye) || 1.6, cam = WM.camera;
    cam.position.set(START.x, f + eye, START.z); cam.lookAt(LOOK.x, f + eye, LOOK.z); cam.updateMatrixWorld(true);
    if (WM._move) { WM._move.yaw = 0; WM._move.pitch = 0; }   // the walk keeps its own yaw: 0 = +Z, up corridor 139 (measured)
  }
  // THE SAME DRESSING as the splat: the plants and the bench at the exact spots the path tracer measured for them
  // (pt.html window.__dressT -> bakelib/dress.json). Without them the baked light keeps their shadows on an empty floor.
  // TWO LISTS (2026-11-23, WALK_04 goes live): dress.json = the 3 pieces the live corridor 139 bake (WALK_03, set=final) was baked
  // with; dress_bl.json = the 9 the Blender sets (bl, bl12, bl13, bl13s) were baked with (+6 on the patio, night 11-11).
  var dress = [];
  function dressUp() {
    fetch(LIB + (BL ? 'dress_bl.json' : 'dress.json') + '?v=' + Date.now()).then(function (r) { return r.json(); }).then(function (list) {
      list.forEach(function (it) {
        new window.GLTFLoader().load(LIB + 'dress/' + it.file, function (g) {
          var root = g.scene; root.position.fromArray(it.pos); root.quaternion.fromArray(it.quat); root.scale.fromArray(it.scale);
          root.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.notPack = true; } });
          root.userData.notPack = true; root.visible = dressShown(); WM.scene.add(root); dress.push(root);
        }, undefined, function (e) { console.error('[bake] dress item', it.file, e); });
      });
    }).catch(function (e) { console.error('[bake] no dress.json', e); });
  }
  addEventListener('keydown', function (e) { if (e.code === 'KeyB' && mesh) { on = !on; mesh.visible = on; dress.forEach(function (d) { d.visible = dressShown(); }); } });
  window.__bakeToggle = function (v) { on = v; if (mesh) mesh.visible = v; dress.forEach(function (d) { d.visible = dressShown(); }); };
  // the baked corridor and its plants are the FIRST building's (2026-11-19: on the Soldiers Club they floated 576 m up, and the
  // old start dropped him among them - "going back to dir el asad"): on another pack they are not built
  function ready() { if (/^MKD_/.test(decodeURIComponent((location.search.match(/[?&]pack=([^&]+)/) || [])[1] || 'MKD_'))) { build(); dressUp(); } setTimeout(function () { place(0); }, 900); }   // after start.js has placed its own spot
  if (WM.pack) ready(); else WM.on('ready', ready);
})();
