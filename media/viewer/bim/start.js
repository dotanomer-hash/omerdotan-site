// oYmer BIM Viewer on omerdotan.com - the site's own additions (2026-11-07).
//
// index.html beside this file = Candidate F, the DecisionMaker edition, copied BYTE FOR BYTE from
// oYmer BIM Viewer (c)/Pins/CANDIDATE-F-DEMO-2026-09-13/oYmer-DecisionMaker.F.html (md5 7bb326092bea0f8e1f999631f2ee21a5)
// plus ONE line at its foot that loads this file. This file only ASKS the viewer (window.WM); no viewer code changes.
//
// 1. THE START = THE OLD VIEWER MOVIE'S SPOT (his ask 2026-11-07: "the start point as the old viewer - in the
//    second floor where there is sun"): the ground floor (the level above the basement), in the glass corridor
//    along the patio, looking along it toward the glass partition, the sunlit patio glass on the right. Desktop
//    and VR start on the same spot, facing the same way, in Walk mode.
// 4. THE LOADING SCREEN (his ask 2026-11-07: "i prefer to wait 5 sec and then see at once all ... the same loading
//    screen of the splatter"): #siteSplash (in index.html, right after <body>) covers everything from the first
//    paint and lifts only when the model is in, the baked light and the paint are on, he stands at the start spot
//    and nothing has loaded for 1 s - so the far view and the room being built are never seen.
// 2. THE DM KEYS ARE LIT: the build asks the suite server for a licence (/dm/licence); the site has no server, so
//    every DM key would be grey. His call: "lets them push the buttons, no revit anyhow".
// 3. WRITE TO REVIT never leaves the browser here: it says so instead of calling a server that is not there.
(function () {
  'use strict';
  // BIM pack metres (three.js, Y up). Found by the patio's curtain panels (glass line z = 0.6, x = -24.4 .. -10.4).
  var START = { x: -7.6, z: 2.0 };
  var LOOK  = { x: -24.0, z: 1.2 };                      // along the corridor, west
  var FLOOR_FALLBACK = 574.55;                           // the ground floor, measured by the viewer's floor grid

  // ---------- the loading screen ----------
  var splash = document.getElementById('siteSplash');
  var pctEl = document.getElementById('siteSplashPct'), fillEl = document.getElementById('siteSplashFill');
  var statEl = document.getElementById('siteSplashStat');
  var shown = 0, t0 = performance.now(), lifted = false;
  function progress(p, text) {
    shown = Math.max(shown, Math.min(100, Math.round(p)));
    if (pctEl) pctEl.textContent = shown + '%';
    if (fillEl) fillEl.style.width = shown + '%';
    if (text && statEl) statEl.textContent = text;
  }
  function lift() {
    if (lifted || !splash) return;
    lifted = true; progress(100, 'Ready');
    setTimeout(function () { splash.classList.add('hide'); }, 250);
    setTimeout(function () { splash.remove(); }, 1300);
  }
  setTimeout(lift, 30000);                               // never trap a visitor: 30 s and it lifts whatever the state

  var WM = window.WM;
  if (!WM || !WM.on) { console.error('[site-start] viewer core missing'); lift(); return; }

  // what "everything is built" means, each read from the viewer's own state
  function shellLit() {                                  // the baked light is on the walls
    var m = WM.pack && WM.pack.meshes.get('Walls'); if (!m) return false;
    return [].concat(m.material).some(function (x) { return x && x.lightMap; });
  }
  function painted() {                                   // the load-time auto-paint has run
    var m = WM.pack && WM.pack.meshes.get('Walls');
    return !!(m && m.userData.assign && m.userData.assign.size);
  }
  function loads() { return performance.getEntriesByType('resource').length; }
  var lastLoads = -1, quietSince = 0;
  (function watch() {
    if (lifted) return;
    var now = performance.now();
    // the model download has no progress events we can read, so the bar creeps toward 55% while it comes in
    if (!WM.pack) progress(Math.min(55, (now - t0) / 120), 'Loading the model (25 MB)...');
    else if (!shellLit()) progress(65, 'Baking the light...');
    else if (!painted()) progress(78, 'Painting the finishes...');
    else if (!placed) progress(88, 'Placing you in the building...');
    else {
      var n = loads();
      if (n !== lastLoads) { lastLoads = n; quietSince = now; }
      progress(92 + Math.min(7, (now - quietSince) / 150), 'Almost there...');
      // nothing new has loaded for 1 s (the glass, the furniture light, the textures are all in): show it all at once
      if (now - quietSince > 1000) {
        // two drawn frames, so the first picture is the finished one; a background tab draws none, so a timer backs it
        requestAnimationFrame(function () { requestAnimationFrame(lift); });
        setTimeout(lift, 300);
        return;
      }
    }
    setTimeout(watch, 100);
  })();

  function licenceOn() {
    if (!WM.dm) WM.dm = {};
    WM.dm.licensed = true; WM.dm.checked = true; WM.dm.holder = 'omerdotan.com';
    if (window.__wmMenuRebuild) window.__wmMenuRebuild();
  }

  function noRevit() {
    WM.writeToRevit = function () {
      WM.setStatus && WM.setStatus('Write to Revit runs in the office, next to Revit - not on the website');
    };
  }

  var dx = LOOK.x - START.x, dz = LOOK.z - START.z;
  var placed = false;
  function place(tries) {
    if (placed || WM.renderer.xr.isPresenting) return;
    var f = WM.floorYat ? WM.floorYat(START.x, START.z, FLOOR_FALLBACK + 1) : null;
    // the floor grid may still be building: walk mode needs a floor under the spot, or it falls back to the pivot
    if (f == null && tries < 50) { setTimeout(function () { place(tries + 1); }, 200); return; }
    if (f == null) f = FLOOR_FALLBACK;
    placed = true;
    // VR: the viewer's own spawn reads manifest.rooms[0].pos (the floor under you). The room list is read by
    // nothing else at runtime, so the start goes FIRST and every Revit room stays in the list behind it.
    var rooms = WM.pack.manifest.rooms || (WM.pack.manifest.rooms = []);
    rooms.unshift({ name: 'Start - the old viewer spot', number: '', level: '', pos: [START.x, f, START.z] });
    // desktop
    var eye = (WM._move && WM._move.eye) || 1.6;
    var cam = WM.camera;
    cam.position.set(START.x, f + eye, START.z);
    cam.lookAt(LOOK.x, f + eye, LOOK.z);
    cam.updateMatrixWorld(true);
    WM.setMoveMode('walk');
    console.log('[site-start] at the old viewer spot, floor ' + f.toFixed(2));
  }

  function onReady() {
    licenceOn(); noRevit();
    setTimeout(licenceOn, 3000);                         // after the build's own licence ask has failed
    setTimeout(function () { place(0); }, 50);
  }
  if (WM.pack) onReady(); else WM.on('ready', onReady);

  // VR: before the viewer's own teleport (300 ms after the session starts) turn the rig to face along the corridor.
  // A rig at yaw t looks along (-sin t, 0, -cos t).
  WM.on('xrstart', function () {
    if (WM.rig) WM.rig.rotation.y = Math.atan2(-dx, -dz);
  });
})();
