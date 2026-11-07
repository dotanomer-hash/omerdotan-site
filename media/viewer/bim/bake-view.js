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
  var dress = [];
  function dressUp() {
    fetch(LIB + 'dress.json?v=' + Date.now()).then(function (r) { return r.json(); }).then(function (list) {
      list.forEach(function (it) {
        new window.GLTFLoader().load(LIB + 'dress/' + it.file, function (g) {
          var root = g.scene; root.position.fromArray(it.pos); root.quaternion.fromArray(it.quat); root.scale.fromArray(it.scale);
          root.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.notPack = true; } });
          root.userData.notPack = true; root.visible = on; WM.scene.add(root); dress.push(root);
        }, undefined, function (e) { console.error('[bake] dress item', it.file, e); });
      });
    }).catch(function (e) { console.error('[bake] no dress.json', e); });
  }
  addEventListener('keydown', function (e) { if (e.code === 'KeyB' && mesh) { on = !on; mesh.visible = on; dress.forEach(function (d) { d.visible = on; }); } });
  window.__bakeToggle = function (v) { on = v; if (mesh) mesh.visible = v; dress.forEach(function (d) { d.visible = v; }); };
  function ready() { build(); dressUp(); setTimeout(function () { place(0); }, 900); }   // after start.js has placed its own spot
  if (WM.pack) ready(); else WM.on('ready', ready);
})();
