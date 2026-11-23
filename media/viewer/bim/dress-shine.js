// LOCAL ONLY (2026-11-19): SHINY MATERIALS REFLECT THE ROOM. His question after the floor fix: "maybe other materials were
// also blocked like this floor?" Measured (night_tests/shine.eval.js, 244 materials): every material that carries baked
// light has its reflection switched off (so the outdoor sky does not light the rooms twice). 16 of them are shiny in the
// plan - steel, copper, screens, sanitary ware, the window frames, mirrors - and drew like matte paint.
// THE RULE (plan.shine): a material with baked light that is shiny (roughness <= maxRough, or a metal) reflects one
// 360-degree picture of the building's inside - the same picture the metal doors use (dress-doors.js), or one taken here.
// Only the REFLECTION is added: the picture's share of plain light is left out, because the baked light already holds it
// (twice would wash a white basin out). Values are locked like the doors' - the viewer's own loop re-sets material values
// every 2.5 s. The mirror floors and the doors are not touched (they have their own reflection).
// THE GLASS (his words the same night: "and why glass can't have those reflections? will be great!"). Measured
// (night_tests/glassmat.eval.js): on this page a pane is a plain see-through material, 22% opaque, with no picture of the
// room at all - it reflected the outdoor sky, at a fifth. plan.shine.glassRoom: the pane shows the room picture by viewing
// angle (a little face on, most at a flat angle, as glass does) and is that much less see-through there (a reflection hides
// what is behind it). The pane's normal is read from its own surface (the model's glass carries no normals).
(function () {
  'use strict';
  // A METAL NEEDS BRIGHT THINGS TO REFLECT (his words 2026-11-19: "other metals like door frames are matte"). Measured in a
  // picture: leaves, frames and window frames read as flat paint - the room picture had no lamps in it (the bake's lamps exist
  // only in the bake), so a metal mirrored soft white walls. While the room picture is taken, a bright disc hangs at every lamp
  // of the bake (plan.shine.lamps, or the light repair's lamp list); the discs are removed right after.
  window.__dressLampGlints = function (PLAN) { var WM = window.WM, T = WM.THREE, S = PLAN.shine || {}, src = S.lamps || (PLAN.lightFill && PLAN.lightFill.lamps), g = new T.Group(); if (!src || S.glint === 0) return null;
    try { var x = new XMLHttpRequest(); x.open('GET', src + '?v=1', false); x.send(); var L = JSON.parse(x.responseText).lamps || [], pw = S.glint || 30, geo = new T.CircleGeometry(S.glintRadius || 0.16, 16), mat = new T.MeshBasicMaterial({ side: T.DoubleSide, toneMapped: false, fog: false });
      mat.color.setRGB(pw, pw * 0.95, pw * 0.86); L.forEach(function (l) { var m = new T.Mesh(geo, mat); m.position.set(l.pos[0], l.pos[1] - 0.01, l.pos[2]); m.rotation.x = Math.PI / 2; g.add(m); });
      g.userData.notPack = true; WM.scene.add(g); g.updateMatrixWorld(true); return { n: L.length, group: g, remove: function () { WM.scene.remove(g); geo.dispose(); mat.dispose(); } }; } catch (e) { console.error('[dress] lamp glints failed', e); return null; } };
  window.__dressShine = function (PLAN) {
    var WM = window.WM, T = WM.THREE, P = PLAN.shine, out = { shined: 0, kinds: {}, cut: true, glassPanes: 0 }; if (!P) return out;
    var gq = parseFloat((location.search.match(/[?&]glassroom=([0-9.]+)/) || [])[1]); if (gq >= 0) P.glassRoom = gq;      // &glassroom=<0..1> in the address: try another strength (0 = the glass as it was)
    var CH = T.ShaderChunk.envmap_physical_pars_fragment || '', LINE = 'return PI * envMapColor.rgb * envMapIntensity;';
    if (CH.indexOf(LINE) < 0) out.cut = false;                 // another three.js: the plain-light share cannot be cut here - reported, not hidden
    function probe() { if (window.__dressRoomEnvTex) return window.__dressRoomEnvTex;
      var R = WM.renderer, rt = new T.WebGLCubeRenderTarget(P.probeSize || 512, { type: T.HalfFloatType }), cam = new T.CubeCamera(0.1, 200, rt);
      cam.position.fromArray(P.probe); WM.scene.add(cam); var xr = R.xr.enabled, gl = window.__dressLampGlints(PLAN); R.xr.enabled = false; cam.update(R, WM.scene); R.xr.enabled = xr; WM.scene.remove(cam); if (gl) gl.remove(); out.glints = gl ? gl.n : 0;
      var pm = new T.PMREMGenerator(R), env = pm.fromCubemap(rt.texture).texture; pm.dispose(); return (window.__dressRoomEnvTex = env); }
    function lock(m, vals) { Object.keys(vals).forEach(function (k) { Object.defineProperty(m, k, { get: function () { return vals[k]; }, set: function () {}, configurable: true }); }); }
    function run() { var env; try { env = probe(); } catch (e) { return console.error('[dress] shine: no room picture', e); }
      WM.scene.traverse(function (o) { if (!o.isMesh) return; (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) {
        if (!m || m.userData.shine || m.userData.metalLock || m.userData.blMirror || !m.lightMap || m.roughness == null || m.transparent || m.transmission > 0 || m.envMapIntensity > 0) return;
        var metal = m.metalness >= 0.3; if (!metal && !(m.roughness <= P.maxRough)) return;
        m.userData.shine = true; m.envMap = env; var vals = { envMapIntensity: metal ? P.metalEnv : P.env }; if (metal && P.metalRough != null) vals.roughness = Math.min(m.roughness, P.metalRough);   /* a polished metal: real things show in it */ if ('specularIntensity' in m && !(m.specularIntensity > 0)) vals.specularIntensity = 1;
        lock(m, vals);
        if (out.cut) { var prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
          m.onBeforeCompile = function (sh, r) { if (prev) prev.call(this, sh, r);
            sh.fragmentShader = sh.fragmentShader.replace('#include <envmap_physical_pars_fragment>', CH.replace(LINE, 'return vec3( 0.0 );')); };
          m.customProgramCacheKey = function () { return (prevKey ? prevKey.call(this) : '') + 'shine'; }; }
        m.needsUpdate = true; out.shined++; var k = (o.name || 'mesh').split(':').slice(0, 3).join(':'); out.kinds[k] = (out.kinds[k] || 0) + 1; }); });
      // the true mirror of the nearest glass wall (dress-glass.js): its picture and its plane reach the panes through GU
      var GMo = window.__glassMirrorInit ? window.__glassMirrorInit(PLAN) : null, GU = GMo ? GMo.U : { uGM: { value: null }, uGMM: { value: new T.Matrix4() }, uGMN: { value: new T.Vector3(1, 0, 0) }, uGMD: { value: 1e9 }, uGMK: { value: 0 }, uGMF: { value: 0 } };
      out.glassWalls = GMo ? GMo.planes.length : 0;
      if (P.glassRoom > 0 && WM.pack) WM.pack.meshes.forEach(function (mesh, cat) { if (!/^(Windows|Curtain[ _]Panels|Doors|Railings)$/.test(cat)) return;                 // + a glass railing
        (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(function (m) { if (!m || m.userData.roomGlass || !m.transparent || !(m.opacity < 1)) return; m.userData.roomGlass = true;
          var prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey, K = (+P.glassRoom).toFixed(2);
          lock(m, { envMap: env, envMapIntensity: 1 });                                       // the pane's own picture is the room (the viewer's loop would take it off)
          m.onBeforeCompile = function (sh, r) { if (prev) prev.call(this, sh, r); Object.assign(sh.uniforms, GU);
            sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGlassW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlassW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
            sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vGlassW; uniform sampler2D uGM; uniform mat4 uGMM; uniform vec3 uGMN; uniform float uGMD; uniform float uGMK; uniform float uGMF;').replace('#include <opaque_fragment>', ['#ifdef ENVMAP_TYPE_CUBE_UV',
              '{ vec3 gN = normalize(cross(dFdx(vGlassW), dFdy(vGlassW))); vec3 gV = normalize(cameraPosition - vGlassW); if (dot(gN, gV) < 0.0) gN = -gN;',
              '  float gF = pow(1.0 - clamp(dot(gN, gV), 0.0, 1.0), 5.0); float gR = ' + K + ' * (0.06 + 0.94 * gF); vec3 gRoom = textureCubeUV( envMap, reflect(-gV, gN), 0.04 ).rgb;',
              // a pane of the wall whose true mirror was drawn this frame shows that mirror; every other pane keeps the soft picture
              '  if (uGMK > 0.0 && abs(dot(vGlassW, uGMN) - uGMD) < 0.06) { vec4 gp = uGMM * vec4(vGlassW, 1.0); vec2 gu = gp.xy / gp.w; if (gp.w > 0.0 && gu.x > 0.0 && gu.x < 1.0 && gu.y > 0.0 && gu.y < 1.0) { gRoom = texture2D(uGM, gu).rgb; gR = uGMK * (uGMF + (1.0 - uGMF) * gF); } }',
              '  float gA = diffuseColor.a; float gA2 = 1.0 - (1.0 - gA) * (1.0 - gR); outgoingLight = (outgoingLight * gA * (1.0 - gR) + gRoom * gR) / max(gA2, 0.001); diffuseColor.a = gA2; }',
              '#endif', '#include <opaque_fragment>'].join('\n')); };
          m.customProgramCacheKey = function () { return (prevKey ? prevKey.call(this) : '') + 'room' + K + 'gm'; }; m.needsUpdate = true; out.glassPanes++; }); });
      console.log('[dress] shine: ' + JSON.stringify(out)); }
    if (window.__dressWhenQuiet) { window.__dressWhenQuiet(run, 0); window.__dressWhenQuiet(run, 1500); }   // a page behind a loading screen: when nothing loads any more (dress-plan.js)
    else { setTimeout(run, P.delay || 7500); setTimeout(run, (P.delay || 7500) + 6000); }       // once more: some paint materials are made a little later
    return out;
  };
})();
