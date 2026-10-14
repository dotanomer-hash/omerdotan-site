/* build-en.js - makes the English twin of every Hebrew page.

   The Hebrew page is the source. The English page is GENERATED from it, never edited by hand:
     1. dir="rtl" -> dir="ltr", lang="en"
     2. the layout is mirrored: every left/right class, CSS rule and inline style is swapped
        (a block or element that is already LTR - dir="ltr" / direction:ltr - is left alone)
     3. every Hebrew text is replaced by its English line from i18n/en/<page>.json or
        i18n/en/_shared.json (header, footer, the JS menus)
     4. the JS files the page loads get an English copy the same way
     5. the page is REFUSED (not written) while any Hebrew text is left in it - the missing lines
        are written to i18n/en/_missing-<page>.json for translation

   The Hebrew page gets only the HE/EN button and the hreflang tags.

   Usage:
     node tools/build-en.js --out lang-mockup index        mockup: Hebrew copy + English, outside the site
     node tools/build-en.js index About                    real: Hebrew in place, English in en/
*/
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const I18N = path.join(ROOT, "i18n", "en");
const SITE = "https://omerdotan.com/";
const HEB = /[֐-׿]/;

// ---------- args ----------
const argv = process.argv.slice(2);
let outDir = ".";
const pages = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--out") outDir = argv[++i];
  else pages.push(argv[i].replace(/\.html$/, ""));
}
if (!pages.length) { console.error("usage: node tools/build-en.js [--out dir] page [page ...]"); process.exit(2); }
const MOCK = outDir !== ".";
const OUT_HE = path.join(ROOT, outDir);             // Hebrew page lands here
const OUT_EN = path.join(OUT_HE, "en");             // English page lands here
const BUILT = new Set(pages.map((p) => p.toLowerCase() + ".html"));
// every page that will have an English twin (the full site list) - used for full omerdotan.com addresses
const ALL_PAGES = new Set("index VRImplementation GuidedTours PreRecordedTours ExistingBuildings bimsuite suite-decisionmaker suite-viewer suite-familycreator suite-typestudio suite-vrtours suite-vrlab FAQ About Contact ClientStories ThankYou Blog BlogPost-1 BlogPost-2 BlogPost-3 BlogPost-4 BlogPost-5 BlogPost-6 BlogPost-7 BlogPost-8".split(" ").map((p) => p.toLowerCase() + ".html"));

const read = (p) => fs.readFileSync(p, "utf8");
const readJson = (p) => (fs.existsSync(p) ? JSON.parse(read(p)) : {});

// ---------- paths ----------
// prefix from an output folder back to the site root
const rel = (fromDir) => {
  const r = path.relative(fromDir, ROOT).split(path.sep).join("/");
  return r ? r + "/" : "";
};
const isLocal = (u) => u && !/^([a-z]+:|\/\/|#|\/|data:|javascript:)/i.test(u);
const PAGE_RE = /^([\w\-]+\.html)([?#].*)?$/i;

// lang: "he" | "en". A link to a page built in this run stays a sibling; anything else goes back
// to the site root (the Hebrew page, or the shared media).
function fixUrl(u, lang) {
  if (!isLocal(u)) return u;
  const m = u.match(PAGE_RE);
  if (m && BUILT.has(m[1].toLowerCase())) return u;
  const prefix = rel(lang === "en" ? OUT_EN : OUT_HE);
  return prefix + u;
}

// ---------- mirroring ----------
const ARROW = { "&larr;": "&rarr;", "&rarr;": "&larr;", "&#8592;": "&#8594;", "&#8594;": "&#8592;", "←": "→", "→": "←" };
const ARROW_RE = /&larr;|&rarr;|&#8592;|&#8594;|←|→/g;
const SWAP = { left: "right", right: "left", l: "r", r: "l", tl: "tr", tr: "tl", bl: "br", br: "bl" };

function mirrorClass(c, all) {
  const i = c.lastIndexOf(":");
  const variant = i >= 0 ? c.slice(0, i + 1) : "";
  let core = i >= 0 ? c.slice(i + 1) : c;
  const neg = core.startsWith("-") ? "-" : "";
  if (neg) core = core.slice(1);
  let m;
  const centred = all.some((x) => /(^|:)-?translate-x-1\/2$/.test(x));
  if ((m = core.match(/^(left|right)-(.+)$/))) {
    if (m[2] === "1/2" && centred) return c;                     // left-1/2 -translate-x-1/2 = centred
    core = SWAP[m[1]] + "-" + m[2];
  } else if ((m = core.match(/^(m|p|scroll-m|scroll-p)(l|r)-(.+)$/))) core = m[1] + SWAP[m[2]] + "-" + m[3];
  else if ((m = core.match(/^(border|rounded)-(l|r|tl|tr|bl|br)(-.+)?$/))) core = m[1] + "-" + SWAP[m[2]] + (m[3] || "");
  else if ((m = core.match(/^text-(left|right)$/))) core = "text-" + SWAP[m[1]];
  else if ((m = core.match(/^(float|clear)-(left|right)$/))) core = m[1] + "-" + SWAP[m[2]];
  else if ((m = core.match(/^bg-gradient-to-(l|r|tl|tr|bl|br)$/))) core = "bg-gradient-to-" + SWAP[m[1]];
  else if ((m = core.match(/^origin-(.*)(left|right)$/))) core = "origin-" + m[1] + SWAP[m[2]];
  else return c;
  return variant + neg + core;
}

// a transform seen in a mirror: the x of every move and the angle of every turn change sign.
// Measured 10-13: `left:50%;transform:translate(-50%,-50%) rotate(-135deg)` became right:50% with
// the same transform - the DecisionMaker bolt sat 255px (its own width) off centre, aimed wrong.
const negLen = (x) => {
  x = x.trim();
  if (/^-?0+(\.0+)?[a-z%]*$/i.test(x)) return x;
  if (x.startsWith("-")) return x.slice(1);
  if (/^calc\(/i.test(x)) return "calc(-1 * " + x.slice(4);
  return "-" + x;
};
function mirrorTransform(val) {
  return val.replace(/\b(translate|translate3d|translateX|rotate|rotateZ|skew|skewX|matrix)\(([^()]*(?:\([^()]*\)[^()]*)*)\)/gi, (all, fn, args) => {
    const a = args.split(",");
    const f = fn.toLowerCase();
    if (f === "translate" || f === "translate3d" || f === "translatex" || f === "rotate" || f === "rotatez" || f === "skewx") a[0] = negLen(a[0]);
    else if (f === "skew") { a[0] = negLen(a[0]); if (a[1] !== undefined) a[1] = negLen(a[1]); }
    else if (f === "matrix" && a.length === 6) { a[1] = negLen(a[1]); a[2] = negLen(a[2]); a[4] = negLen(a[4]); }
    return fn + "(" + a.map((s) => s.trim()).join(",") + ")";
  });
}

// svgs that draw a direction: lucide arrows/chevrons and the suite's arw / bolt arrows
function isArrowSvg(a) {
  const c = (a.match(/\bclass\s*=\s*"([^"]*)"/) || [])[1] || "";
  return /\blucide-(arrow|chevron)-(left|right)\b|(^|[\s-])arw(\s|$|-(?!_))|\barrow\b|\bbolt\b/.test(c);
}
// the x that flips the drawing inside its own viewBox: minX*2 + width
function svgFlipX(a) {
  const vb = (a.match(/\bviewBox\s*=\s*"([^"]*)"/i) || [])[1];
  if (!vb) return 24;
  const [x, , w] = vb.trim().split(/[\s,]+/).map(Number);
  return 2 * x + w;
}

// one CSS declaration list "a:b;c:d" -> mirrored
function mirrorDecls(css) {
  if (/direction\s*:\s*ltr/i.test(css)) return css;              // already LTR content: leave it
  return css.replace(/([\w-]+)(\s*:\s*)([^;{}]*)/g, (all, prop, colon, val) => {
    const p = prop.toLowerCase();
    let np = p
      .replace(/^(margin|padding|border|scroll-margin|scroll-padding|inset)-(left|right)/, (x, a, b) => a + "-" + SWAP[b])
      .replace(/^border-(top|bottom)-(left|right)-radius$/, (x, a, b) => "border-" + a + "-" + SWAP[b] + "-radius");
    if (p === "left" || p === "right") np = SWAP[p];
    let v = val;
    if (p === "direction") v = val.replace(/rtl/i, "ltr");
    else if (p === "text-align" || p === "float" || p === "clear" || p === "text-align-last") v = val.replace(/\b(left|right)\b/g, (x) => SWAP[x]);
    else if (/gradient/.test(val)) v = val.replace(/\bto (left|right)\b/g, (x, s) => "to " + SWAP[s]);
    else if ((p === "margin" || p === "padding" || p === "inset") && val.trim().split(/\s+/).length === 4) {
      const q = val.trim().split(/\s+/); v = val.replace(val.trim(), [q[0], q[3], q[2], q[1]].join(" "));
    } else if (p === "border-radius" && !val.includes("/") && val.trim().split(/\s+/).length === 4) {
      const q = val.trim().split(/\s+/); v = val.replace(val.trim(), [q[1], q[0], q[3], q[2]].join(" "));
    } else if (p === "background-position" || p === "transform-origin") v = val.replace(/\b(left|right)\b/g, (x) => SWAP[x]);
    else if (p === "transform") v = mirrorTransform(val);
    return (np === p ? prop : np) + colon + v;
  });
}

// a whole stylesheet: mirror each rule body, keep selectors / at-rules / keyframes
function mirrorCss(css) {
  return css.replace(/\{([^{}]*)\}/g, (all, body) => {
    if (/^\s*(from|to|\d+%)/.test(body)) return all;
    return "{" + mirrorDecls(body) + "}";
  });
}

function fixCssUrls(css, lang) {
  return css.replace(/url\((['"]?)([^'")]+)\1\)/g, (a, q, u) => "url(" + q + fixUrl(u, lang) + q + ")");
}

// ---------- translation ----------
const missing = new Map();          // key -> where
let dict = {};
function tr(text, where) {
  const t = text.trim();
  if (!t || !HEB.test(t)) return text;
  if (Object.prototype.hasOwnProperty.call(dict, t) && dict[t] !== "") {
    return text.replace(t, dict[t]);
  }
  if (!missing.has(t)) missing.set(t, where);
  return text;
}

// ---------- HTML walker ----------
const VOID = new Set("area base br col embed hr img input link meta source track wbr path circle rect line polyline polygon ellipse stop".split(" "));
const ATTR_RE = /([^\s=\/>]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g;
const TEXT_ATTRS = new Set(["alt", "title", "aria-label", "placeholder", "content", "value", "label", "data-tip"]);
const URL_ATTRS = new Set(["href", "src", "poster", "action", "data-src"]);

// a page whose <html> is already dir="ltr" is English on the Hebrew site (the Family Creator page)
function isLtrPage(html) {
  return /<html\b[^>]*\bdir\s*=\s*["']?ltr/i.test(html);
}

function transformHtml(html, lang, page) {
  const EN = lang === "en";
  // a caption split into one <b> per word (<b>פגישת</b> <b>אישור</b> ...) is ONE phrase:
  // English word order differs, so it is translated whole and split again
  if (EN) html = html.replace(/>(\s*<b>[^<]*<\/b>(?:\s+<b>[^<]*<\/b>)+\s*)</g, (all, inner) => {
    const words = inner.match(/<b>([^<]*)<\/b>/g).map((w) => w.slice(3, -4));
    const phrase = words.join(" ");
    if (!HEB.test(phrase)) return all;
    const t = tr(phrase, page + " <b>-phrase");
    if (t === phrase) return all;
    return ">" + t.split(/\s+/).map((w) => "<b>" + w + "</b>").join(" ") + "<";
  });
  let out = "";
  let pos = 0;
  const pageLtr = isLtrPage(html);  // an English page on the Hebrew site: its own CSS is already LTR
  const stack = [];                 // {tag, dir, keep}
  // mirror only where the HEBREW page is right-to-left: the nearest dir= decides, the default is rtl
  const ctxRtl = () => { for (let i = stack.length - 1; i >= 0; i--) if (stack[i].dir) return stack[i].dir === "rtl"; return true; };
  const inLtr = () => !ctxRtl();
  const inKeep = () => stack.some((s) => s.keep);
  const tagRe = /<!--[\s\S]*?-->|<(script|style)\b([^>]*)>([\s\S]*?)<\/\1\s*>|<\/?([a-zA-Z][\w:-]*)([^>]*)>/g;
  let m;
  while ((m = tagRe.exec(html))) {
    out += text(html.slice(pos, m.index));
    pos = tagRe.lastIndex;
    const raw = m[0];
    if (raw.startsWith("<!--")) { out += raw; continue; }
    if (m[1]) {                                                  // <script> / <style> with body
      const kind = m[1].toLowerCase();
      const open = "<" + m[1] + attrs(m[2], m[1], false, false) + ">";
      let body = m[3];
      if (kind === "style") { body = fixCssUrls(body, lang); if (EN && !pageLtr) body = mirrorCss(body); }
      else if (EN && body.trim()) { mirrorJs = !pageLtr; body = transformJs(body, page + " <script>"); mirrorJs = true; }
      out += open + body + "</" + m[1] + ">";
      continue;
    }
    const tag = m[4].toLowerCase();
    if (raw.startsWith("</")) {
      for (let i = stack.length - 1; i >= 0; i--) if (stack[i].tag === tag) {
        if (stack[i].flipG) out += "</g>";
        stack.length = i; break;
      }
      out += raw;
      continue;
    }
    const a = m[5];
    const selfClose = /\/\s*$/.test(a);
    const dirM = a.match(/\bdir\s*=\s*["']?(ltr|rtl)/i);
    const dir = dirM ? dirM[1].toLowerCase() : null;
    const keep = /\bdata-i18n-keep\b/.test(a);
    // an arrow / bolt drawing points the reading way: its CONTENT is flipped inside the svg, so
    // the CSS transform that places and turns the element (rotate, translate) is left to the mirror
    const flipG = EN && tag === "svg" && !selfClose && isArrowSvg(a) && (dir ? dir === "rtl" : !inLtr());
    out += "<" + m[4] + attrs(a, tag, keep, dir) + ">";
    if (flipG) out += `<g transform="matrix(-1 0 0 1 ${svgFlipX(a)} 0)">`;
    if (!VOID.has(tag) && !selfClose) stack.push({ tag, dir, keep, flipG });
  }
  out += text(html.slice(pos));
  return out;

  function text(s) {
    if (!EN || inKeep()) return s;
    if (!inLtr() && !HEB.test(s)) s = s.replace(ARROW_RE, (x) => ARROW[x]);   // "Learn more <-" points the reading way
    if (!HEB.test(s)) return s;
    return tr(s, page);
  }

  function attrs(a, tag, selfKeep, selfLtr) {
    const ltrHere = selfLtr ? selfLtr === "ltr" : inLtr();
    const list = [];
    let m2;
    ATTR_RE.lastIndex = 0;
    while ((m2 = ATTR_RE.exec(a))) list.push({ name: m2[1], val: m2[2] });
    const classes = (list.find((x) => x.name === "class") || {}).val;
    const classList = classes ? classes.replace(/^["']|["']$/g, "").split(/\s+/) : [];
    let res = a.replace(ATTR_RE, (all, name, val) => {
      if (val === undefined) return all;
      const q = /^["']/.test(val) ? val[0] : "";
      let v = q ? val.slice(1, -1) : val;
      const n = name.toLowerCase();
      if (URL_ATTRS.has(n) && !selfKeep) v = fixUrl(v, lang);
      if (n === "srcset") v = v.split(",").map((s) => s.trim().replace(/^\S+/, (u) => fixUrl(u, lang))).join(", ");
      if (EN) {
        // dir="rtl" is DROPPED, not flipped: the element inherits ltr from <html dir="ltr">.
        // Flipping it would add new dir="ltr" elements, and oymer.js finds the OMER DOTAN
        // wordmark by div[dir="ltr"] - it squeezed the whole page into the wordmark's box.
        if (n === "dir" && /rtl/i.test(v)) return "";
        // the HE/EN button names the language it LEADS to (lang="he" on an English page) - left as is
        if (n === "lang" && /^he/i.test(v) && !selfKeep) v = "en";
        // a full address of a page with a twin goes to the twin (the contact form's _next ->
        // en/ThankYou.html). The hreflang tags name both languages on purpose - left alone.
        if (!/\bhreflang=/.test(a)) v = v.replace(/^(https:\/\/omerdotan\.com\/)([\w\-]+\.html)$/, (x, site, f) => (ALL_PAGES.has(f.toLowerCase()) ? site + "en/" + f : x));
        if (n === "class" && !ltrHere) v = classList.map((c) => mirrorClass(c, classList)).join(" ");
        if (n === "style" && !ltrHere) v = mirrorDecls(v);
        if (TEXT_ATTRS.has(n) && !inKeep() && !selfKeep) v = tr(v, page + " @" + n);
        // a form field's name is the label in the email formsubmit sends
        if (n === "name" && /^(input|textarea|select)$/.test(tag)) v = tr(v, page + " @name");
      }
      if (n === "style") v = fixCssUrls(v, lang);
      return name + "=" + q + v + q;
    });
    return res;
  }
}

// ---------- JS ----------
// translate the Hebrew inside string literals; comments are left as they are
function transformJs(js, where) {
  let out = "", i = 0;
  const n = js.length;
  while (i < n) {
    const c = js[i], d = js[i + 1];
    if (c === "/" && d === "/") { const e = js.indexOf("\n", i); const j = e < 0 ? n : e; out += js.slice(i, j); i = j; continue; }
    if (c === "/" && d === "*") { const e = js.indexOf("*/", i + 2); const j = e < 0 ? n : e + 2; out += js.slice(i, j); i = j; continue; }
    if (c === "/" && /(^|[(,=:\[!&|?{};+\-*%<>~^]|\breturn)\s*$/.test(out.slice(-12))) {   // a regex literal
      let j = i + 1, inClass = false;
      while (j < n && (js[j] !== "/" || inClass)) {
        if (js[j] === "\\") j++;
        else if (js[j] === "[") inClass = true;
        else if (js[j] === "]") inClass = false;
        j++;
      }
      out += "/" + jsString(js.slice(i + 1, j), where, "/") + "/";
      i = j + 1;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < n && js[j] !== c) { if (js[j] === "\\") j++; j++; }
      const body = js.slice(i + 1, j);
      out += c + jsString(body, where, c) + c;
      i = j + 1;
      continue;
    }
    out += c; i++;
  }
  return out;
}
// a literal may hold HTML ('<h4>נגישות</h4>') or a selector ('button[aria-label="פתח תפריט"]'):
// the text between tags is one key, an attribute value is one key, the rest is one key.
// Escaped quotes (נדל\"ן) are part of the text, not a split.
const CSS_PROP = /(^|[;{"'\s])(left|right|margin-(left|right)|padding-(left|right)|border-(left|right)[\w-]*|text-align|float|direction|border-(top|bottom)-(left|right)-radius)\s*:/;
let mirrorJs = true;   // off only for the inline scripts of an LTR page
function jsString(body, where, q) {
  if (mirrorJs && body === "rtl") return "ltr";
  // arrows flip only in pieces with no Hebrew - a translated line carries its own English arrow
  // CSS may be split across string pieces ('.x{right:24px;background:' + SKY + ';...}'), so a
  // piece is cut at { and }: a part followed by { is a selector, every other part is declarations
  if (mirrorJs && CSS_PROP.test(body)) {
    const parts = body.split(/([{}])/);
    body = parts.map((p, k) => (p === "{" || p === "}" || parts[k + 1] === "{" ? p : mirrorDecls(p))).join("");
  }
  if (!HEB.test(body)) return body.replace(ARROW_RE, (x) => ARROW[x]);
  return body.replace(/<[^>]*>|[^<>]+/g, (piece) => {
    if (!HEB.test(piece)) return piece.replace(ARROW_RE, (x) => ARROW[x]);
    if (/=\s*\\?["']/.test(piece))
      return piece.replace(/(=\s*)(\\?["'])(.*?)\2/g, (a, eq, qq, v) => eq + qq + jsText(v, where, q) + qq);
    if (piece.startsWith("<")) return piece;
    return jsText(piece, where, q);
  });
}
function jsText(s, where, q) {
  const raw = s.replace(/\\(["'`])/g, "$1");
  const t = tr(raw, where);
  if (t === raw) return s;
  return q ? t.split(q).join("\\" + q) : t;
}

function jsHasHebrew(js) {
  return HEB.test(transformJs(js, "check").replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ""));
}

// ---------- the HE/EN button + hreflang ----------
const LANG_CSS =
  '<style id="oymer-lang-css">.oymer-lang-group{display:flex;align-items:center;gap:.6rem}' +
  ".oymer-lang{display:inline-flex;align-items:center;justify-content:center;min-width:2.6rem;height:2.25rem;padding:0 .7rem;" +
  'border:1px solid #cbd5e1;border-radius:.65rem;font:600 .85rem/1 "Rubik","Heebo",sans-serif;letter-spacing:.04em;' +
  "color:#334155;background:#fff;text-decoration:none;transition:background .2s,border-color .2s}" +
  ".oymer-lang:hover{background:#f1f5f9;border-color:#94a3b8}" +
  // a phone has 30px free beside the wordmark: the switch moves into the burger menu instead
  "@media(max-width:479px){.oymer-lang-group>.oymer-lang{display:none}}" +
  ".oymer-lang-row{display:block;padding:11px 8px;color:#0369a1;font-size:16px;font-weight:700;text-decoration:none;border-bottom:1px solid #f1f5f9}</style>" +
  // (the script that follows the style is langScript(), per page)
  "";

// The script that rides with the button (Omer, 2026-10-14). It holds no text of its own.
//  1. REMEMBERS THE VISITOR'S CLICK: EN saves "en", the Hebrew button saves "he" (localStorage, one
//     word, never sent anywhere). Never a guess from the browser's language - many Hebrew speakers
//     run an English browser, Omer included.
//  2. A HEBREW page whose visitor chose English moves to its English twin before it draws, keeping
//     ?query and #hash. An ENGLISH page never moves - an English link someone sent opens in English.
//  3. Copies the header button into the phone's burger menu as its first row (href + its name).
function langScript(lang, twin) {
  return "<script>(function(){var HERE='" + lang + "',TWIN='" + twin + "',KEY='oymer-lang';" +
    "try{if(HERE==='he'&&localStorage.getItem(KEY)==='en'){location.replace(TWIN+location.search+location.hash);return}}catch(e){}" +
    "document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('.oymer-lang,.oymer-lang-row');" +
    "if(a){try{localStorage.setItem(KEY,a.lang)}catch(x){}}},true);" +
    "function add(){var m=document.querySelector('.oymer-mobile'),b=document.querySelector('.oymer-lang');" +
    "if(!m||!b||m.querySelector('.oymer-lang-row'))return;var a=document.createElement('a');a.className='oymer-lang-row';" +
    "a.href=b.getAttribute('href');a.lang=b.lang;a.textContent=b.getAttribute('aria-label');m.insertBefore(a,m.firstChild)}" +
    "document.addEventListener('DOMContentLoaded',function(){setTimeout(add,0)})})();</script>";
}

// exactly what addLangSwitch adds, taken off again
function stripLangSwitch(html) {
  if (!html.includes('<div class="oymer-lang-group">')) return html;   // a clean page: nothing to take off
  return html
    .replace(/<link rel="alternate" hreflang="[^"]*" href="[^"]*">/g, "")
    .replace(/<style id="oymer-lang-css">[\s\S]*?<\/script>/, "")
    .replace(/<div class="oymer-lang-group"><a class="oymer-lang"[^>]*>[^<]*<\/a>/, "")
    .replace("</button></div></div></div></header>", "</button></div></div></header>");
}

function addLangSwitch(html, lang, page) {
  const file = page + ".html";
  const other = lang === "he" ? "en/" + file : "../" + file;
  const label = lang === "he" ? "EN" : "עב";
  const btnLang = lang === "he" ? "en" : "he";
  const aria = lang === "he" ? "English" : "עברית";
  const btn = `<a class="oymer-lang" href="${other}" hreflang="${btnLang}" lang="${btnLang}" aria-label="${aria}" data-i18n-keep>${label}</a>`;
  const ctaAt = html.indexOf('<div class="hidden lg:block">');
  const endAt = html.indexOf("</button></div></div></header>");
  if (ctaAt < 0 || endAt < 0 || endAt < ctaAt) throw new Error(page + ": header shape not found - the button has nowhere to go");
  const close = endAt + "</button>".length;
  html = html.slice(0, ctaAt) + '<div class="oymer-lang-group">' + btn + html.slice(ctaAt, close) + "</div>" + html.slice(close);
  // tags for Google: the two twins point at each other
  const heUrl = SITE + (page === "index" ? "" : file);
  const enUrl = SITE + "en/" + (page === "index" ? "" : file);
  const tags = `<link rel="alternate" hreflang="he" href="${heUrl}"><link rel="alternate" hreflang="en" href="${enUrl}"><link rel="alternate" hreflang="x-default" href="${heUrl}">`;
  html = html.replace("</head>", tags + LANG_CSS + langScript(lang, lang === "he" ? (page === "index" ? "en/" : "en/" + file) : other) + "</head>");
  return html;
}

// ---------- missing Tailwind rules ----------
// a mirrored class (rounded-r-xl) may not exist in base44.css, which only holds the classes the
// Hebrew site uses. Its rule is made from the source class's rule, mirrored.
const esc = (c) => c.replace(/[:\/.\[\]%]/g, (x) => "\\" + x);
function missingTailwind(htmlHe, htmlEn) {
  const css = read(path.join(ROOT, "base44.css"));
  const classesOf = (h) => {
    const out = [];
    h.replace(/\sclass="([^"]*)"/g, (a, v) => { out.push(v.split(/\s+/)); return a; });
    return out;
  };
  const he = classesOf(htmlHe), en = classesOf(htmlEn);
  const pairs = new Map();
  for (let k = 0; k < he.length && k < en.length; k++)
    he[k].forEach((c, j) => { if (en[k][j] && en[k][j] !== c) pairs.set(en[k][j], c); });
  let extra = "";
  for (const [to, from] of pairs) {
    if (css.includes("." + esc(to) + "{") || css.includes("." + esc(to) + ":") || css.includes("." + esc(to) + ",")) continue;
    const sel = "." + esc(from);
    // plain rules and rules inside @media blocks
    const re = new RegExp("(@media[^{]*\\{)?([^{}]*" + sel.replace(/[\\.$^*+?()|]/g, (x) => "\\" + x) + "(?![\\w-])[^{}]*)\\{([^{}]*)\\}", "g");
    let mm;
    while ((mm = re.exec(css))) {
      const selector = mm[2].trim().replace(/\}$/, "").split(",").filter((s) => s.includes(sel)).map((s) => s.replace(sel, "." + esc(to))).join(",");
      if (!selector) continue;
      const rule = selector + "{" + mirrorDecls(mm[3]) + "}";
      extra += mm[1] ? mm[1].trim() + rule + "}\n" : rule + "\n";
    }
  }
  return extra;
}

// ---------- build ----------
fs.mkdirSync(OUT_EN, { recursive: true });
const shared = readJson(path.join(I18N, "_shared.json"));
// a line translated on one page is the answer on every page: the same Hebrew always gets the
// same English, and nothing is translated twice. The page's own file still wins.
const everyPage = {};
for (const f of fs.existsSync(I18N) ? fs.readdirSync(I18N) : [])
  if (f.endsWith(".json") && !f.startsWith("_")) Object.assign(everyPage, readJson(path.join(I18N, f)));
const jsDone = new Set();
const cssDone = new Set();
let failed = 0;

for (const page of pages) {
  const src = path.join(ROOT, page + ".html");
  // the Hebrew page may already carry the switch from an earlier build: take it off first, so a
  // second run gives the same files instead of a second button
  const he = stripLangSwitch(read(src));
  dict = Object.assign({}, everyPage, shared, readJson(path.join(I18N, page + ".json")));
  missing.clear();

  // Hebrew: the button, the hreflang tags, nothing else
  let heOut = addLangSwitch(he, "he", page);
  if (MOCK) heOut = transformHtml(heOut, "he", page);          // only the paths move

  // English
  const enSrc = addLangSwitch(he, "en", page);
  let en = transformHtml(enSrc, "en", page);
  en = en.replace(/<html\b([^>]*)>/i, (a, at) => "<html" + at.replace(/\slang="[^"]*"/, "") + ' lang="en" dir="ltr">');
  en = en.replace(/<link href="https:\/\/omerdotan\.com\/[^"]*" rel="canonical">/, `<link href="${SITE}en/${page === "index" ? "" : page + ".html"}" rel="canonical">`);
  // the JS files: EVERY local script the page loads gets an English copy next to the page -
  // translated, and with the CSS inside its strings mirrored (the mobile menu, the chat)
  en = en.replace(/<script src="(?:\.\.\/)*((?:[\w\-]+\/)*[\w\-]+\.js)(\?[^"]*)?"/g, (a, js, q) => {
    const srcJs = path.join(ROOT, js);
    if (!fs.existsSync(srcJs)) return a;
    if (!jsDone.has(js)) {
      const t = transformJs(read(srcJs), js);
      fs.mkdirSync(path.dirname(path.join(OUT_EN, js)), { recursive: true });
      fs.writeFileSync(path.join(OUT_EN, js), rewriteJsPaths(t, "en"));
      jsDone.add(js);
    }
    return `<script src="${js}${q || ""}"`;
  });
  // the page's own stylesheets: a mirrored copy next to the English page. base44.css is NOT
  // mirrored - it is Tailwind utilities, and those are swapped on the elements instead.
  en = en.replace(/<link href="(?:\.\.\/)*([\w\-]+\.css)(\?[^"]*)?" rel="stylesheet">/g, (a, css, q) => {
    if (css === "base44.css" || isLtrPage(he)) return a;   // an LTR page keeps its CSS as written
    const srcCss = path.join(ROOT, css);
    if (!fs.existsSync(srcCss)) return a;
    if (!cssDone.has(css)) {
      fs.writeFileSync(path.join(OUT_EN, css), fixCssUrls(mirrorCss(read(srcCss)), "en"));
      cssDone.add(css);
    }
    return `<link href="${css}${q || ""}" rel="stylesheet">`;
  });
  const extra = missingTailwind(enSrc, en);
  if (extra) en = en.replace("</head>", "<style id=\"oymer-ltr-extra\">\n" + extra + "</style></head>");

  // the refusal: no Hebrew may be left (comments, the HE button and the brand skip the check)
  const visible = en.replace(/<!--[\s\S]*?-->/g, "").replace(/<script\b[^>]*>([\s\S]*?)<\/script>/g, (a, b) => (jsHasHebrew(b) ? "א" : ""))
    .replace(/<a class="oymer-lang"[^>]*>[^<]*<\/a>/g, "").replace(/aria-label="עברית"/g, "");
  // ...and no script may come from outside the English folder (it would be the Hebrew one)
  const foreign = (en.match(/<script src="(\.\.\/[^"]+)"/g) || []);
  if (foreign.length) { console.log(`REFUSED ${page}: loads a Hebrew-side script: ${foreign.join(" ")}`); failed++; continue; }
  if (missing.size || HEB.test(visible)) {
    failed++;
    const file = path.join(I18N, "_missing-" + page + ".json");
    const obj = {};
    for (const [k] of missing) obj[k] = "";
    fs.mkdirSync(I18N, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n");
    console.log(`REFUSED ${page}: ${missing.size} Hebrew line(s) with no English -> ${path.relative(ROOT, file)}`);
    if (!missing.size) {   // Hebrew the walker never saw: say where it is
      const at = visible.search(HEB);
      console.log("   Hebrew left at: " + JSON.stringify(visible.slice(Math.max(0, at - 160), at + 60)));
    }
    continue;
  }
  const stale = path.join(I18N, "_missing-" + page + ".json");
  if (fs.existsSync(stale)) fs.unlinkSync(stale);
  fs.writeFileSync(path.join(OUT_HE, page + ".html"), heOut);
  fs.writeFileSync(path.join(OUT_EN, page + ".html"), en);
  console.log(`built ${page}: ${path.relative(ROOT, path.join(OUT_HE, page + ".html"))} + ${path.relative(ROOT, path.join(OUT_EN, page + ".html"))}`);
}

// page names inside a translated JS file follow the same rule as the page's links
function rewriteJsPaths(js, lang) {
  // page names and media paths ('media/x.mp4') resolve against the PAGE, which moved into en/
  return js.replace(/(["'])((?:[\w\-]+\/)*[\w\-.]+\.(?:html|jpe?g|png|gif|webp|svg|mp4|webm|glb|json))\1/g, (a, q, f) => q + fixUrl(f, lang) + q);
}

// the JS copies must also pass the check
for (const js of jsDone) {
  if (jsHasHebrew(read(path.join(OUT_EN, js)))) { console.log(`REFUSED ${js}: Hebrew left in a string`); failed++; }
}
// the sitemap is written by the build, from the full site list, so it can never fall behind the
// pages: every page in both languages, each naming its twin (Google's hreflang pairs)
if (!MOCK && !failed) {
  const loc = (lang, p) => SITE + (lang === "en" ? "en/" : "") + (p === "index.html" ? "" : p);
  const names = [...ALL_PAGES].map((f) => fs.readdirSync(ROOT).find((x) => x.toLowerCase() === f)).filter(Boolean);
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';
  for (const f of names) for (const lang of ["he", "en"]) {
    xml += `  <url><loc>${loc(lang, f)}</loc>` +
      `<xhtml:link rel="alternate" hreflang="he" href="${loc("he", f)}"/>` +
      `<xhtml:link rel="alternate" hreflang="en" href="${loc("en", f)}"/></url>\n`;
  }
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), xml + "</urlset>\n");
  console.log("sitemap.xml: " + names.length * 2 + " addresses");
}

process.exit(failed ? 1 : 0);
