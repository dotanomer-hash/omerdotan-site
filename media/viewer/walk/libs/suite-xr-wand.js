// Suite-XR-Wand.js - THE WAND, both hands. Shared by the suite.
// oYmer BIM VR Suite / Shared. NEW 2026-08-17.
//
// ⭐⭐ WHY (Omer, 2026-08-17): "i want to try the wands for both hands. on the left wand attach the
//     menu to the orange ring of the wand." The wand already existed and he already approved it -
//     it is what a client holds in every oYmer VR TOUR. This file is that exact wand, lifted whole
//     from oYmer VR Tours ©/Tours-Editor.html (lines 6547-6880: WAND_STYLE, makeRegularWand, the
//     _w* noise/holo helpers, makeWandWoodTextures, makeGnarledWand).
//
// ⛔ LIFTED VERBATIM, NOT REWRITTEN. Every number in it is one he tuned in a headset over several
//    sessions - the ring moved back toward the handle at his request, the wand flipped 180 deg on
//    2026-06-27 because the narrow tip was pointing at the user, the holo left unstyled because
//    Quest rendered it near-black. Re-typing any of that would lose it.
// ⛔ HONEST STATE: the TOURS editor still holds the original copy. VR Tours is deliberately a
//    separate product (architecture-map.md), so this is not folded - the two are the same code in
//    two places TODAY, and a fix here must be repeated there until someone decides otherwise.
// ⛔ The only change from the original is one line: the holo ring is NAMED, so the menu can be
//    strapped to it. Marked below with "SUITE:".
(function () {
if (typeof window === "undefined" || typeof THREE === "undefined") return;
  var WAND_STYLE = 'gnarled';

  function makeControllerModel() {
    return WAND_STYLE === 'regular' ? makeRegularWand() : makeGnarledWand();
  }

  // ---- the original simple wand (kept for the switch) ----
  function makeRegularWand() {
    const group = new THREE.Group();
    const RO = 9999;
    const dt = false; // depthTest off so it renders over panorama

    // --- Wand shaft (tapered cylinder, dark wood) ---
    const shaftGeo = new THREE.CylinderGeometry(0.006, 0.012, 0.28, 12);
    const shaftMat = new THREE.MeshBasicMaterial({ color: 0x3E2315, depthTest: dt });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.renderOrder = RO;
    shaft.rotation.x = Math.PI / 2; // point forward along Z
    shaft.position.set(0, 0, 0.10); // extend forward from hand
    group.add(shaft);

    // --- Handle grip (thicker bulge near hand, slightly lighter wood) ---
    const gripGeo = new THREE.CylinderGeometry(0.014, 0.016, 0.08, 12);
    const gripMat = new THREE.MeshBasicMaterial({ color: 0x5C3A1E, depthTest: dt });
    const grip = new THREE.Mesh(gripGeo, gripMat);
    grip.renderOrder = RO;
    grip.rotation.x = Math.PI / 2;
    grip.position.set(0, 0, -0.01);
    group.add(grip);

    // --- Handle pommel (round knob at bottom) ---
    const pommelGeo = new THREE.SphereGeometry(0.017, 10, 8);
    const pommelMat = new THREE.MeshBasicMaterial({ color: 0x5C3A1E, depthTest: dt });
    const pommel = new THREE.Mesh(pommelGeo, pommelMat);
    pommel.renderOrder = RO;
    pommel.position.set(0, 0, -0.05);
    group.add(pommel);

    // --- Gold ring where handle meets shaft ---
    const ringGeo = new THREE.TorusGeometry(0.013, 0.003, 8, 16);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xDAA520, depthTest: dt });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.renderOrder = RO + 1;
    ring.position.set(0, 0, 0.03);
    group.add(ring);

    // --- Glowing orange tip ---
    const tipGeo = new THREE.SphereGeometry(0.009, 10, 8);
    const tipMat = new THREE.MeshBasicMaterial({ color: 0xff7a00, depthTest: dt });
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.renderOrder = RO + 1;
    tip.position.set(0, 0, 0.24);
    group.add(tip);

    // --- Faint orange glow halo around tip ---
    const glowGeo = new THREE.SphereGeometry(0.02, 10, 8);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xff7a00, transparent: true, opacity: 0.25, depthTest: dt });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.renderOrder = RO;
    glow.position.set(0, 0, 0.24);
    group.add(glow);

    group.renderOrder = RO;
    return group;
  }

  // ---- procedural carved-wood wand (built + tuned in wand-mesh.html lab) ----
  // Single tube on an organic spine: burl handle -> node band -> long taper to a
  // needle tip. Wood shading is baked into vertex colours so it stays unlit and
  // always draws over the panorama, like the regular wand.
  function _wHash3(x, y, z) { var n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return n - Math.floor(n); }
  function _wVnoise(x, y, z) {
    var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    var xf = x - xi, yf = y - yi, zf = z - zi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    function L(a, b, t) { return a + (b - a) * t; }
    var c000 = _wHash3(xi, yi, zi), c100 = _wHash3(xi + 1, yi, zi),
        c010 = _wHash3(xi, yi + 1, zi), c110 = _wHash3(xi + 1, yi + 1, zi),
        c001 = _wHash3(xi, yi, zi + 1), c101 = _wHash3(xi + 1, yi, zi + 1),
        c011 = _wHash3(xi, yi + 1, zi + 1), c111 = _wHash3(xi + 1, yi + 1, zi + 1);
    return L(L(L(c000, c100, u), L(c010, c110, u), v), L(L(c001, c101, u), L(c011, c111, u), v), w);
  }
  function _wFbm(x, y, z) { var a = 0, amp = 0.5, f = 1, k; for (k = 0; k < 4; k++) { a += amp * (_wVnoise(x * f, y * f, z * f) * 2 - 1); f *= 2; amp *= 0.5; } return a; }
  function _wSmooth(a, b, x) { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); }
  function _wLerp(a, b, t) { return a + (b - a) * t; }

  function _wHoloTex(color) {
    var S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S;
    var x = cv.getContext('2d'); x.clearRect(0, 0, S, S); x.translate(S / 2, S / 2);
    x.strokeStyle = color; x.fillStyle = color; x.shadowColor = color; x.lineCap = 'round';
    var i;
    function rg(r, w, a, blur) { x.globalAlpha = a; x.lineWidth = w; x.shadowBlur = blur || 0; x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.stroke(); }
    rg(S * 0.46, 3, 0.9, 8); rg(S * 0.40, 1.5, 0.45, 4); rg(S * 0.30, 2, 0.8, 6); rg(S * 0.205, 1, 0.4, 3);
    x.globalAlpha = 0.85; x.lineWidth = 5; x.shadowBlur = 8;
    for (i = 0; i < 24; i++) { if (i % 3 === 0) { var a0 = i / 24 * Math.PI * 2; x.beginPath(); x.arc(0, 0, S * 0.43, a0, a0 + 0.12); x.stroke(); } }
    x.lineWidth = 2; x.globalAlpha = 0.7; x.shadowBlur = 4;
    for (i = 0; i < 72; i++) { var a = i / 72 * Math.PI * 2, lng = (i % 6 === 0), r0 = S * 0.30, r1 = S * (lng ? 0.37 : 0.34);
      x.beginPath(); x.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); x.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); x.stroke(); }
    x.globalAlpha = 0.95; x.lineWidth = 6; x.shadowBlur = 10; x.beginPath(); x.arc(0, 0, S * 0.355, -0.6, 0.5); x.stroke();
    x.shadowBlur = 8; var tp = S * 0.48; x.beginPath(); x.moveTo(0, -tp); x.lineTo(-S * 0.022, -tp + S * 0.045); x.lineTo(S * 0.022, -tp + S * 0.045); x.closePath(); x.fill();
    x.globalAlpha = 0.6; x.lineWidth = 2; x.shadowBlur = 3;
    for (i = 0; i < 16; i++) { if (i % 2) { var a2 = i / 16 * Math.PI * 2; x.beginPath(); x.arc(0, 0, S * 0.245, a2, a2 + 0.18); x.stroke(); } }
    x.setTransform(1, 0, 0, 1, 0, 0);
    var t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  function _wGlowTex(color) {
    var S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S; var x = cv.getContext('2d'); var c = S / 2;
    var col = new THREE.Color(color), rgb = ((col.r * 255) | 0) + ',' + ((col.g * 255) | 0) + ',' + ((col.b * 255) | 0);
    var g = x.createRadialGradient(c, c, c * 0.28, c, c, c);
    g.addColorStop(0, 'rgba(' + rgb + ',0)'); g.addColorStop(0.5, 'rgba(' + rgb + ',0.5)');
    g.addColorStop(0.72, 'rgba(' + rgb + ',0.12)'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    return new THREE.CanvasTexture(cv);
  }
  function _wMakeHoloRing() {
    var COLOR = '#ff7a00'; // ring matches the beam (both brand orange) — Omer 2026-06-28
    var holo = new THREE.Group();
    holo.name = "wand-ring";   // SUITE: so the menu can be strapped to it
    var ringMat = new THREE.MeshBasicMaterial({ map: _wHoloTex(COLOR), transparent: true, depthTest: false, side: THREE.DoubleSide, blending: THREE.NormalBlending });
    var ringMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), ringMat);
    var glowMat = new THREE.MeshBasicMaterial({ map: _wGlowTex(COLOR), transparent: true, depthTest: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, opacity: 0.30 });
    var glowMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), glowMat);
    glowMesh.renderOrder = 9999; ringMesh.renderOrder = 10000;
    holo.add(glowMesh); holo.add(ringMesh);
    ringMesh.onBeforeRender = function () { this.rotation.z = performance.now() * 0.0004; }; // slow holo spin
    return holo;
  }

  // #1 (Omer 2026-06-28): procedural wood texture (albedo + roughness map) — ported from the wand lab
  // (Media Assets/wand-mesh.html makeWoodTextures), which reads as photoreal carved wood. The viewer wand
  // previously used only a flat vertex-colour gradient, so on Quest it looked flat/plastic. No backticks /
  // template-literals / regex (getViewerTemplate constraint) — all string concatenation.
  function makeWandWoodTextures(light, dark) {
    var W = 256, H = 1024;
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var x = cv.getContext('2d');
    var ro = document.createElement('canvas'); ro.width = W; ro.height = H;
    var rx = ro.getContext('2d');
    var lc = new THREE.Color(light), dc = new THREE.Color(dark);
    var mix = function (t) { var c = dc.clone().lerp(lc, t); return 'rgb(' + (c.r * 255 | 0) + ',' + (c.g * 255 | 0) + ',' + (c.b * 255 | 0) + ')'; };
    x.fillStyle = mix(0.5); x.fillRect(0, 0, W, H);
    rx.fillStyle = 'rgb(170,170,170)'; rx.fillRect(0, 0, W, H);
    var i, y;
    for (i = 0; i < 150; i++) {                          // lengthwise grain streaks
      var cx = Math.random() * W;
      var tone = 0.25 + Math.random() * 0.6;
      var wdt = 0.6 + Math.random() * 2.2;
      x.strokeStyle = mix(tone); x.globalAlpha = 0.5; x.lineWidth = wdt;
      rx.strokeStyle = 'rgb(' + ((120 + tone * 90) | 0) + ',0,0)'; rx.globalAlpha = 0.4; rx.lineWidth = wdt;
      x.beginPath(); rx.beginPath();
      for (y = 0; y <= H; y += 16) {
        var xx = cx + Math.sin(y * 0.012 + i) * 3 + Math.sin(y * 0.05 + i * 2) * 1.2;
        if (y === 0) { x.moveTo(xx, y); rx.moveTo(xx, y); } else { x.lineTo(xx, y); rx.lineTo(xx, y); }
      }
      x.stroke(); rx.stroke();
    }
    x.globalAlpha = 1; rx.globalAlpha = 1;
    for (i = 0; i < 8; i++) {                            // a few dark knots toward the handle
      var kx = Math.random() * W, ky = Math.random() * H * 0.6 + H * 0.05;
      var rr = 3 + Math.random() * 7;
      var grd = x.createRadialGradient(kx, ky, 0, kx, ky, rr);
      grd.addColorStop(0, mix(0.08)); grd.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = grd; x.beginPath(); x.ellipse(kx, ky, rr * 0.7, rr, 0, 0, 7); x.fill();
    }
    var map = new THREE.CanvasTexture(cv);
    var rgh = new THREE.CanvasTexture(ro);
    var arr = [map, rgh], k;
    for (k = 0; k < arr.length; k++) { arr[k].wrapS = THREE.RepeatWrapping; arr[k].wrapT = THREE.RepeatWrapping; arr[k].repeat.set(1.6, 2.4); }
    map.colorSpace = THREE.SRGBColorSpace;
    return { map: map, rgh: rgh };
  }
  function makeGnarledWand() {
    var grp = new THREE.Group();
    var RO = 9999;
    // tunables settled in the lab
    var LEN = 0.24, HF = 0.18, HR = 2.1, SR = 0.0095, TR = 0.0012, NR = 0.0020;
    var BEND = 0.35, GRAIN = 0.10, BURL = 0.45, POMMEL_Z = -0.05;
    var TUB = 180, RAD = 20;
    var DARK = new THREE.Color(0x3a2616), LITE = new THREE.Color(0x9a6e44);

    // organic spine along +Z (pommel near the hand, tip forward) — matches the regular wand
    var pts = [], i, j;
    var NP = 9;
    for (i = 0; i < NP; i++) {
      var ti = i / (NP - 1);
      // #1b LASER FIX (Omer 2026-06-28): fade the sway to 0 over the last 20% so the NEEDLE TIP lands
      // exactly on the -Z axis = the laser's origin (0,0,-0.19) and the dot centre (0,0,-500). The beam
      // then emanates from the CENTRE of the wand tip straight to the CENTRE of the end circle.
      var _tipFade = ti < 0.8 ? 1 : Math.max(0, 1 - (ti - 0.8) / 0.2);
      var sway = BEND * LEN * 0.05 * _wSmooth(0.05, 0.6, ti) * _tipFade;
      var sx = Math.sin(ti * 3.1 + 0.5) * sway + Math.sin(ti * 7.0) * sway * 0.3;
      var sy = Math.cos(ti * 2.4 + 1.2) * sway * 0.8;
      pts.push(new THREE.Vector3(sx, sy, POMMEL_Z + ti * LEN));
    }
    var curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    var frames = curve.computeFrenetFrames(TUB, false);
    var tNode = HF;
    function profile(t) {
      var r;
      if (t < HF) { r = _wLerp(SR, SR * HR, _wSmooth(HF, HF * 0.35, t)); }
      else { var u = (t - HF) / (1 - HF); r = TR + (SR - TR) * Math.pow(1 - u, 1.25); }
      r += NR * Math.exp(-Math.pow((t - tNode) / 0.03, 2));
      return r;
    }
    var Lx = 0.4, Ly = 0.8, Lz = 0.5, Ln = Math.sqrt(Lx * Lx + Ly * Ly + Lz * Lz); Lx /= Ln; Ly /= Ln; Lz /= Ln;
    var pos = [], col = [], uv = [], idx = [];
    for (i = 0; i <= TUB; i++) {
      var t2 = i / TUB;
      var c = curve.getPointAt(t2);
      var N = frames.normals[i], B = frames.binormals[i];
      var baseR = profile(t2);
      var handleMask = _wSmooth(HF * 1.2, HF * 0.2, t2);
      var thin = Math.min(1, baseR / SR);
      for (j = 0; j <= RAD; j++) {
        var th = j / RAD * Math.PI * 2, cs = Math.cos(th), sn = Math.sin(th);
        var grain = _wFbm(cs * 2.0, sn * 2.0, t2 * 26.0);
        var burl = _wFbm(cs * 2.3 + 10, sn * 2.3 + 10, t2 * 7.0 + 5);
        var disp = grain * GRAIN * thin + burl * BURL * handleMask;
        var r = Math.max(0.0003, baseR * (1 + disp));
        var nx = cs * N.x + sn * B.x, ny = cs * N.y + sn * B.y, nz = cs * N.z + sn * B.z;
        pos.push(c.x + nx * r, c.y + ny * r, c.z + nz * r);
        var tone = 0.4 + 0.5 * (grain * 0.5 + 0.5);
        // #12 (Omer): vertex colours are now pure ALBEDO — the old fake directional "shade" is dropped so
        // the real UI lights + envMap (via __styleUiMesh below) do the shading, so the wand is LIT on Quest
        // (not flat). nx/ny/nz are still used for the vertex position above.
        col.push(DARK.r + (LITE.r - DARK.r) * tone,
                 DARK.g + (LITE.g - DARK.g) * tone,
                 DARK.b + (LITE.b - DARK.b) * tone);
        uv.push(j / RAD, t2); // #1: UVs for the wood texture (u around, v along the wand)
      }
    }
    for (i = 0; i < TUB; i++) {
      for (j = 0; j < RAD; j++) {
        var a = i * (RAD + 1) + j, b = a + RAD + 1;
        idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    // caps (winding verified outward in the lab)
    var p0 = curve.getPointAt(0), tg0 = curve.getTangentAt(0), pomI = pos.length / 3;
    pos.push(p0.x - tg0.x * profile(0) * 0.7, p0.y - tg0.y * profile(0) * 0.7, p0.z - tg0.z * profile(0) * 0.7);
    col.push(DARK.r * 0.5, DARK.g * 0.5, DARK.b * 0.5); uv.push(0.5, 0);
    for (j = 0; j < RAD; j++) idx.push(pomI, j + 1, j);
    var p1 = curve.getPointAt(1), tg1 = curve.getTangentAt(1), tipI = pos.length / 3;
    pos.push(p1.x + tg1.x * TR, p1.y + tg1.y * TR, p1.z + tg1.z * TR);
    col.push(LITE.r * 0.7, LITE.g * 0.7, LITE.b * 0.7); uv.push(0.5, 1);
    var baseRing = TUB * (RAD + 1);
    for (j = 0; j < RAD; j++) idx.push(tipI, baseRing + j, baseRing + j + 1);

    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals(); // lit material needs normals to shade
    // #1 FIX (Omer 2026-06-28): use the LAB wand's photoreal WOOD TEXTURE (albedo + roughness map on the
    // UVs above) instead of the flat vertex-colour gradient that read as plastic on Quest. Same
    // MeshStandardMaterial params as Media Assets/wand-mesh.html (roughness 0.62, envMapIntensity 0.85).
    var _wt = makeWandWoodTextures(LITE, DARK);
    var wood = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: _wt.map, roughnessMap: _wt.rgh, roughness: 0.62, metalness: 0.0, envMapIntensity: 0.85 }));
    wood.renderOrder = RO;
    grp.add(wood);

    // small holographic ring up the shaft toward the narrow part
    var ring = _wMakeHoloRing();
    var rt = 0.26, rp = curve.getPointAt(rt), rtan = curve.getTangentAt(rt).normalize(); // ring moved back toward the handle (Omer)
    ring.position.copy(rp);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), rtan);
    ring.scale.setScalar(0.045);
    grp.add(ring);

    // Omer 2026-06-27: the wand was reversed — the narrow tip pointed back at the user and the wide
    // burl faced forward. The controller laser fires along -Z, so flip 180° about Y: narrow tip now
    // points down the laser (forward) and the wide handle sits at the hand. Rigid rotation = winding
    // preserved (no see-through skin).
    grp.rotation.y = Math.PI;
    grp.renderOrder = RO;
    // #12: give the wand the SAME PBR lighting as the film-tutorial controller — envMap (__uiEnv) + the
    // UI lights, and draw-over-pano (depthTest off, renderOrder 9999). Fixes "flat on Quest".
    // #1c FIX (Omer 2026-06-28): apply the UI env to the WOOD ONLY. Applied to the whole group it also set
    // an envMap on the holo RING's MeshBasicMaterial, which MULTIPLIES the texture by the dark gradient env
    // → the orange holo rendered near-BLACK on Quest (and you couldn't see it spin = "static"). The ring +
    // glow already draw over the pano via depthTest:false + renderOrder 10000/9999, so they need no styling.
    if (window.__styleUiMesh) window.__styleUiMesh(wood, true);
    return grp;
  }
/* what the suite needs from the wand: one to hold, and the orange ring to hang a menu on. */
window.SuiteWand = {
  make: function () { return makeControllerModel(); },
  /* the wand's own wood, as a material - so a companion tool (the menu stick) can be cut from
     the same tree instead of a flat brown that reads as plastic beside it. */
  woodMaterial: function () {
    var t = makeWandWoodTextures('#8a5a2b', '#3E2315');
    return new THREE.MeshStandardMaterial({ map: t.map, roughnessMap: t.rgh, roughness: 0.75 });
  },
  style: function (s) { if (s) WAND_STYLE = s; return WAND_STYLE; },
  /* ⛔ the ring is a GROUP (holo + glow), named at build time. Returns null rather than guessing at
     a child index - a wrong guess would strap the menu to the glow sprite and look almost right. */
  ringOf: function (wand) { return wand ? (wand.getObjectByName("wand-ring") || null) : null; }
};
})();
