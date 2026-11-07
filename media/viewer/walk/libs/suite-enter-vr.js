// Suite-EnterVR.js - THE Enter VR button. ONE button for every product in the suite.
// oYmer BIM VR Suite (c). 2026-08-24, his call: "i want it to be one button for all products".
//
// WHY THIS FILE EXISTS. The BIM Viewer had #wmEnterVr (bottom centre, blue when a headset answers,
// grey when none does) and the Type Studio panel had its own #btn_vr (top right, orange). Two
// buttons, two looks, two copies of the same WebXR probe - the shape this project calls a second
// implementation. This is the one, and its look is the VIEWER'S, measured off
// oYmer BIM Viewer (c)/Viewer-Template.html lines 35-38 and copied exactly:
//   bottom:16px; left:50%; translateX(-50%); padding:9px 22px; radius:20px; 15px/600
//   no headset -> #3a3d46 on #9a9eab, cursor default   |   headset -> #2f7ee6 on #fff, pointer
// His 2026-08-23 words, which is why it is at the bottom centre and not on a ribbon:
//   "put the enter vr button center" - "bottom of window not ribbon".
//
// AVAILABILITY IS MEASURED, NEVER ASSUMED: navigator.xr plus a real isSessionSupported answer.
// A desktop Chrome with the Immersive Web Emulator installed reports true and the button lights,
// which is correct - that IS a headset for our purposes.
//
// A BUTTON THAT CANNOT WORK IS GREY AND SAYS WHY, never missing and never silently dead. That is
// the suite's locked-key rule (the DecisionMaker key is the same shape).

(function (root) {
  'use strict';

  var CSS = [
    '.suiteEnterVr{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:12;',
    ' display:block;padding:9px 22px;background:#3a3d46;color:#9a9eab;border:0;border-radius:20px;',
    // width/height AUTO, stated out loud. MEASURED 2026-08-24: the Type Studio panel sets
    // button{width:100%} on EVERY button (Studio-Panel-Desktop.html:91) for its card rows, and a
    // shared button that declares no width simply inherits it - fixed at left:50% it then stretched
    // across the whole window. His words: "the viewer is a small button, the studio still very long".
    // A component that lands in someone else's page states its own box; it never assumes the host's.
    ' width:auto;height:auto;min-width:0;max-width:none;box-sizing:content-box;line-height:normal;',
    ' margin:0;letter-spacing:normal;text-transform:none;',
    ' font:600 15px -apple-system,Segoe UI,Roboto,sans-serif;cursor:default;',
    ' overflow:hidden;position:fixed;}',
    '.suiteEnterVr.ok{background:#2f7ee6;color:#fff;cursor:pointer;}',
    '.suiteEnterVr.ok:hover{filter:brightness(1.08);}',
    '.suiteEnterVr .q3{width:35px;height:22px;vertical-align:-6px;margin-right:9px;}',

    // THE FLASH (his ask 2026-08-24: "nicer with animation of a flash every 10 sec").
    // A sheen that sweeps across the face, not a blink - a blink on a page someone is working on
    // reads as an error light. 10s cycle, and the sweep occupies only the first ~9% of it, so it
    // is a glint you catch out of the corner of your eye and then it is gone.
    // It rides an ::after overlay so the button's own background is never touched.
    '.suiteEnterVr::after{content:"";position:absolute;top:0;bottom:0;left:-60%;width:45%;',
    ' background:linear-gradient(100deg,transparent,rgba(255,255,255,.55),transparent);',
    ' transform:skewX(-18deg);pointer-events:none;opacity:0;}',
    // ONLY WHEN IT CAN ACTUALLY BE PRESSED. Flashing a dead button promises something that is
    // not there - the opposite of what the grey state is for.
    '.suiteEnterVr.ok::after{animation:suiteEnterVrFlash 10s ease-in-out infinite;}',
    '@keyframes suiteEnterVrFlash{',
    ' 0%{left:-60%;opacity:0;} 1%{opacity:1;} 8%{left:115%;opacity:1;}',
    ' 9%{left:115%;opacity:0;} 100%{left:-60%;opacity:0;}}',

    // A person who has asked not to see motion does not get a flashing button.
    '@media (prefers-reduced-motion: reduce){.suiteEnterVr.ok::after{animation:none;}}'
  ].join('');


  // THE ICON IS HIS OWN QUEST 3 PHOTO (his call 2026-08-24: "implement the image itself, just
  // scale it down" / "without the background"). Source: Media Assets/images (1).jpeg.
  //
  // THE BACKGROUND WAS CUT ON SATURATION, NOT COLOUR. That photo's background is a magenta-to-
  // orange GRADIENT, so there is no single key colour to match - but the headset is white and grey
  // (near-zero saturation) and every background pixel is saturated. One threshold separates them
  // whatever the gradient does. MEASURED at 318x200: a plain threshold left magenta fringing along
  // the visor edge and the strap - blended half-plastic half-gradient pixels that pass any
  // threshold loose enough to keep the white - so the mask is eroded a pixel before it is used.
  // Script kept at scratchpad/cutout_quest3.py.
  //
  // A DATA URI, not a file: a built viewer is ONE html he can double-click offline, and an
  // <img src="..."> pointing at a folder would be a broken box the moment it travels.
  // Rendered at 70x44 - 2x the on-screen 35x22 - so it stays sharp on a high-DPI screen.
  var QUEST3 = '<img class="q3" alt="" src="data:image/png;base64,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">';

  var API = {};

  // mount(opt) -> the button element.
  //   id      - the element id. Defaults to 'suiteEnterVr'. A product that ALREADY has a button
  //             passes its own: the BIM Viewer must stay '#wmEnterVr' because its core binds that
  //             id in three places AND the headset simulator enters VR *through that button*
  //             (Tools-Sim/Viewer-Sim-Headset.js). Changing it would break VR testing.
  //   probe   - false = LOOK ONLY. Mount the styled button and stop: no WebXR probe, no click
  //             handler, no .ok toggling. That is how a product with proven, headset-approved
  //             behaviour of its own adopts the shared LOOK without any of its behaviour moving.
  //   onEnter - what a real press does. The button never decides where to go; the product does.
  //   label   - the words beside the icon.
  //   modes   - which XR session types count as "a headset here". Both, by default.
  API.mount = function (opt) {
    opt = opt || {};
    var doc = root.document;
    if (!doc) return null;

    var id = opt.id || 'suiteEnterVr';

    if (!doc.getElementById('suiteEnterVrCss')) {
      var st = doc.createElement('style');
      st.id = 'suiteEnterVrCss';
      st.textContent = CSS;
      doc.head.appendChild(st);
    }

    // ADOPT an existing button rather than adding a second one. A product whose markup already
    // carries the button keeps its element, its id and its listeners - it only gains the look.
    var b = doc.getElementById(id);
    if (!b) {
      b = doc.createElement('button');
      b.id = id;
      doc.body.appendChild(b);
    }
    b.classList.add('suiteEnterVr');
    b.innerHTML = QUEST3 + (opt.label || 'Enter VR');

    function offer(why) { b.classList.remove('ok'); b.disabled = true; b.title = why; }
    function ready(why) { b.classList.add('ok'); b.disabled = false; b.title = why; }

    API.el = b;
    API.offer = offer;
    API.ready = ready;

    // LOOK ONLY. The product owns the probe and the press.
    if (opt.probe === false) return b;

    offer('checking for a headset…');

    var modes = opt.modes || ['immersive-vr', 'immersive-ar'];
    if (!root.navigator || !root.navigator.xr) {
      offer('No WebXR in this browser - open this page in the headset, or install the Immersive Web Emulator');
    } else {
      // ⭐⭐ IT KEEPS LOOKING (Omer, 2026-08-25: "i cannot tell the user to restart chrome for
      //    entering VR"). A headset is not there when the page loads and there ten seconds
      //    later - he starts Virtual Desktop, or SteamVR, or plugs the link cable, AFTER the
      //    page is already open. Probing once at load turned that into "restart the browser",
      //    which is not an instruction a product may give.
      //
      // Three ways of noticing, because no single one is reliable:
      //   devicechange - the spec's own event, when the browser has it;
      //   focus/visibility - he alt-tabs back from the VD or SteamVR window, which is the
      //     exact gesture that follows starting a runtime;
      //   a slow poll - the backstop for a runtime that arrives while the tab already has
      //     focus. It STOPS the moment a headset answers, so a working page polls nothing.
      // ⛔ One probe in flight at a time, and the poll is 4s - isSessionSupported can touch
      //    the runtime, and hammering it is how a compositor starts stuttering.
      var probing = false, timer = null;
      var probe = function () {
        if (probing) return;
        probing = true;
        Promise.all(modes.map(function (m) {
          return root.navigator.xr.isSessionSupported(m).catch(function () { return false; });
        })).then(function (ok) {
          probing = false;
          var any = ok.some(function (v) { return v; });
          if (!any) {
            offer('No headset detected yet - start Virtual Desktop or SteamVR and it lights by itself');
            return;
          }
          if (timer) { clearInterval(timer); timer = null; }
          var ar = ok[modes.indexOf('immersive-ar')];
          ready('Open this in VR / MR' + (ar ? ' (passthrough available)' : ''));
        }, function () { probing = false; });
      };
      probe();
      timer = setInterval(probe, 4000);
      try { root.navigator.xr.addEventListener('devicechange', probe); } catch (e) {}
      root.addEventListener('focus', probe);
      if (root.document) root.document.addEventListener('visibilitychange', function () {
        if (!root.document.hidden) probe();
      });
      API.probe = probe;          // a product may ask for a fresh look at any time
    }

    b.addEventListener('click', function () {
      if (b.disabled) return;
      if (typeof opt.onEnter === 'function') opt.onEnter();
    });

    return b;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.SuiteEnterVR = API;
})(typeof window !== 'undefined' ? window : globalThis);
