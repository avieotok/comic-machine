(() => {
"use strict";
const $ = id => document.getElementById(id);
const canvas = $("comicCanvas"), ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;
const SAMPLE = window.SAMPLE_IMAGE; // מוגדר ב־js/sample.js

/* ================= מצב ================= */
let sourceImg = null, basePage = null, comicPage = null, showOriginal = false;
let style = "classic", layout = "single";
const items = { b1: { x: 330, y: 150 }, b2: { x: 850, y: 720 }, sfx: { x: 960, y: 230 } };

const STYLES = [
  { id: "classic", name: "קלאסי אמריקאי" },
  { id: "pop",     name: "פופ־ארט" },
  { id: "manga",   name: "מנגה" },
  { id: "noir",    name: "נואר אדום" },
  { id: "vintage", name: "וינטג' שנות ה־50" },
  { id: "cel",     name: "אנימה" },
  { id: "sketch",  name: "סקיצה בעיפרון" },
  { id: "kids",    name: "צבעוני לילדים" },
];
const LAYOUTS = [
  { id: "single", name: "תמונה אחת", svg: '<rect x="3" y="3" width="48" height="34" />' },
  { id: "strip",  name: "רצועה",     svg: '<rect x="3" y="3" width="14" height="34"/><rect x="20" y="3" width="14" height="34"/><rect x="37" y="3" width="14" height="34"/>' },
  { id: "grid",   name: "4 משבצות",  svg: '<rect x="3" y="3" width="22" height="16"/><rect x="29" y="3" width="22" height="16"/><rect x="3" y="21" width="22" height="16"/><rect x="29" y="21" width="22" height="16"/>' },
  { id: "hero",   name: "גיבור",      svg: '<rect x="3" y="3" width="48" height="20"/><rect x="3" y="26" width="22" height="11"/><rect x="29" y="26" width="22" height="11"/>' },
];

/* ================= ממשק: גלריה ופריסות ================= */
const gallery = $("gallery"), thumbs = {};
STYLES.forEach(s => {
  const b = document.createElement("button");
  b.type = "button"; b.className = "style-card" + (s.id === style ? " active" : "");
  b.dataset.id = s.id; b.setAttribute("aria-pressed", s.id === style);
  const c = document.createElement("canvas"); c.width = 240; c.height = 180;
  const t = document.createElement("span"); t.textContent = s.name;
  b.append(c, t); gallery.appendChild(b); thumbs[s.id] = c;
  b.addEventListener("click", () => { style = s.id; markActive(gallery, s.id); render(); });
});
const layoutsEl = $("layouts");
LAYOUTS.forEach(l => {
  const b = document.createElement("button");
  b.type = "button"; b.className = "layout-btn" + (l.id === layout ? " active" : ""); b.dataset.id = l.id;
  b.innerHTML = `<svg viewBox="0 0 54 40" fill="#fff" stroke="#111" stroke-width="2.5">${l.svg}</svg>${l.name}`;
  layoutsEl.appendChild(b);
  b.addEventListener("click", () => { layout = l.id; markActive(layoutsEl, l.id); buildBase(); render(); });
});
function markActive(parent, id) {
  [...parent.children].forEach(el => { const on = el.dataset.id === id; el.classList.toggle("active", on); el.setAttribute("aria-pressed", on); });
}

/* ================= העלאת תמונה ================= */
const fileInput = $("fileInput"), dropZone = $("dropZone"), thumb = $("miniThumb");
$("selectFileBtn").addEventListener("click", e => { e.stopPropagation(); fileInput.click(); });
$("sampleBtn").addEventListener("click", e => { e.stopPropagation(); loadSrc(SAMPLE); });
dropZone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => { if (fileInput.files[0]) loadFile(fileInput.files[0]); fileInput.value = ""; });
["dragenter", "dragover"].forEach(ev => dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.add("dragover"); }));
["dragleave", "drop"].forEach(ev => dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.remove("dragover"); }));
dropZone.addEventListener("drop", e => { const f = e.dataTransfer && e.dataTransfer.files[0]; if (f) loadFile(f); });
document.addEventListener("paste", e => {
  const it = [...(e.clipboardData ? e.clipboardData.items : [])].find(i => i.type.startsWith("image/"));
  if (it) loadFile(it.getAsFile());
});
function loadFile(f) {
  if (!f || !f.type.startsWith("image/")) { hint("הקובץ שנבחר אינו תמונה. נסו JPG או PNG."); return; }
  const r = new FileReader();
  r.onload = () => loadSrc(r.result);
  r.onerror = () => hint("שגיאה בקריאת הקובץ.");
  r.readAsDataURL(f);
}
function loadSrc(src) {
  const img = new Image();
  img.onload = () => {
    sourceImg = img; thumb.src = src;
    buildBase(); renderThumbs(); render();
  };
  img.onerror = () => hint("לא הצלחתי לפתוח את התמונה. נסו קובץ אחר.");
  img.src = src;
}
const hint = t => { $("hintText").textContent = t; };

/* ================= פריסת דף ================= */
const GUT = 18, MARG = 14;
// כל משבצת: מלבן על הדף + מרכז וזום של החיתוך מהתמונה
function panelsFor(id) {
  const iw = W - 2 * MARG, ih = H - 2 * MARG;
  if (id === "strip") {
    const w = (iw - 2 * GUT) / 3;
    // מימין לשמאל, כמו בעברית
    return [
      { x: MARG + 2 * (w + GUT), y: MARG, w, h: ih, cx: .5, cy: .5, z: 1 },
      { x: MARG + (w + GUT), y: MARG, w, h: ih, cx: .38, cy: .42, z: 1.6 },
      { x: MARG, y: MARG, w, h: ih, cx: .6, cy: .38, z: 2.3 },
    ];
  }
  if (id === "grid") {
    const w = (iw - GUT) / 2, h = (ih - GUT) / 2;
    return [
      { x: MARG + w + GUT, y: MARG, w, h, cx: .5, cy: .5, z: 1 },
      { x: MARG, y: MARG, w, h, cx: .35, cy: .42, z: 1.8 },
      { x: MARG + w + GUT, y: MARG + h + GUT, w, h, cx: .65, cy: .42, z: 1.8 },
      { x: MARG, y: MARG + h + GUT, w, h, cx: .5, cy: .38, z: 2.8 },
    ];
  }
  if (id === "hero") {
    const h1 = ih * .6, h2 = ih - h1 - GUT, w = (iw - GUT) / 2;
    return [
      { x: MARG, y: MARG, w: iw, h: h1, cx: .5, cy: .5, z: 1 },
      { x: MARG + w + GUT, y: MARG + h1 + GUT, w, h: h2, cx: .38, cy: .4, z: 2.2 },
      { x: MARG, y: MARG + h1 + GUT, w, h: h2, cx: .62, cy: .4, z: 2.2 },
    ];
  }
  return [{ x: 0, y: 0, w: W, h: H, cx: .5, cy: .5, z: 1, full: true }];
}
function drawCrop(g, img, p) {
  const IW = img.naturalWidth, IH = img.naturalHeight, ar = p.w / p.h;
  let sw = IW, sh = IW / ar;
  if (sh > IH) { sh = IH; sw = IH * ar; }
  sw /= p.z; sh /= p.z;
  const sx = Math.min(Math.max(p.cx * IW - sw / 2, 0), IW - sw);
  const sy = Math.min(Math.max(p.cy * IH - sh / 2, 0), IH - sh);
  g.drawImage(img, sx, sy, sw, sh, p.x, p.y, p.w, p.h);
}
function buildBase() {
  if (!sourceImg) return;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
  panelsFor(layout).forEach(p => drawCrop(g, sourceImg, p));
  basePage = c;
}

/* ================= מנוע הקומיקס ================= */
function params(scale) {
  return {
    edge: +$("edgeRange").value / 100,
    smooth: +$("smoothRange").value / 100,
    color: +$("colorRange").value / 100,
    s: scale
  };
}

// טשטוש גאוסיאני נפרד (אופקי ואנכי)
function gauss(src, w, h, sigma) {
  if (sigma < .3) return src.slice();
  const r = Math.ceil(sigma * 2.5), k = new Float32Array(2 * r + 1); let ks = 0;
  for (let i = -r; i <= r; i++) { k[i + r] = Math.exp(-i * i / (2 * sigma * sigma)); ks += k[i + r]; }
  for (let i = 0; i < k.length; i++) k[i] /= ks;
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) { const o = y * w;
    for (let x = 0; x < w; x++) { let s = 0;
      for (let i = -r; i <= r; i++) { let xx = x + i; xx = xx < 0 ? 0 : xx >= w ? w - 1 : xx; s += src[o + xx] * k[i + r]; }
      tmp[o + x] = s; } }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0;
    for (let i = -r; i <= r; i++) { let yy = y + i; yy = yy < 0 ? 0 : yy >= h ? h - 1 : yy; s += tmp[yy * w + x] * k[i + r]; }
    out[y * w + x] = s; }
  return out;
}

// מסנן Kuwahara: משטח צבעים ושומר על קצוות חדים - נותן מראה מצויר
function kuwahara(R, G, B, w, h, rad) {
  if (rad < 1) return [R, G, B];
  const W1 = w + 1, n = W1 * (h + 1);
  const iR = new Float64Array(n), iG = new Float64Array(n), iB = new Float64Array(n), iL = new Float64Array(n), iL2 = new Float64Array(n);
  for (let y = 0; y < h; y++) {
    let sr = 0, sg = 0, sb = 0, sl = 0, sl2 = 0;
    for (let x = 0; x < w; x++) {
      const i = y * w + x, l = .299 * R[i] + .587 * G[i] + .114 * B[i];
      sr += R[i]; sg += G[i]; sb += B[i]; sl += l; sl2 += l * l;
      const j = (y + 1) * W1 + x + 1, up = y * W1 + x + 1;
      iR[j] = iR[up] + sr; iG[j] = iG[up] + sg; iB[j] = iB[up] + sb; iL[j] = iL[up] + sl; iL2[j] = iL2[up] + sl2;
    }
  }
  const box = (a, x0, y0, x1, y1) => a[y1 * W1 + x1] - a[y0 * W1 + x1] - a[y1 * W1 + x0] + a[y0 * W1 + x0];
  const oR = new Float32Array(w * h), oG = new Float32Array(w * h), oB = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let best = 1e9, bx0 = 0, by0 = 0, bx1 = 0, by1 = 0, bn = 1;
    for (let q = 0; q < 4; q++) {
      const x0 = Math.max(0, q & 1 ? x : x - rad), x1 = Math.min(w, (q & 1 ? x + rad : x) + 1);
      const y0 = Math.max(0, q & 2 ? y : y - rad), y1 = Math.min(h, (q & 2 ? y + rad : y) + 1);
      const cnt = (x1 - x0) * (y1 - y0), m = box(iL, x0, y0, x1, y1) / cnt;
      const v = box(iL2, x0, y0, x1, y1) / cnt - m * m;
      if (v < best) { best = v; bx0 = x0; by0 = y0; bx1 = x1; by1 = y1; bn = cnt; }
    }
    const i = y * w + x;
    oR[i] = box(iR, bx0, by0, bx1, by1) / bn; oG[i] = box(iG, bx0, by0, bx1, by1) / bn; oB[i] = box(iB, bx0, by0, bx1, by1) / bn;
  }
  return [oR, oG, oB];
}

// נקודת רסטר: האם הפיקסל בתוך נקודה בגודל שמתאים לכיסוי (0..1)
function dot(x, y, cell, ang, cover) {
  if (cover <= 0) return false; if (cover >= 1) return true;
  const c = Math.cos(ang), s = Math.sin(ang);
  const u = (x * c + y * s) / cell, v = (-x * s + y * c) / cell;
  const fu = u - Math.floor(u) - .5, fv = v - Math.floor(v) - .5;
  const rr = Math.sqrt(cover / Math.PI);
  return fu * fu + fv * fv < rr * rr;
}
// קווי הצללה (קרוס־האצ'ינג)
function hatch(x, y, ang, gap, width) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const t = (x * c + y * s) / gap; const f = t - Math.floor(t);
  return f < width / gap;
}
const cl = v => v < 0 ? 0 : v > 1 ? 1 : v;
const smoothstep = (a, b, v) => { const t = cl((v - a) / (b - a)); return t * t * (3 - 2 * t); };

function comicify(srcCanvas, st, P) {
  const w = srcCanvas.width, h = srcCanvas.height, N = w * h, s = P.s;
  const sctx = srcCanvas.getContext("2d");
  const id = sctx.getImageData(0, 0, w, h), d = id.data;
  let R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N);
  for (let i = 0, j = 0; i < N; i++, j += 4) { R[i] = d[j] / 255; G[i] = d[j + 1] / 255; B[i] = d[j + 2] / 255; }

  // 1. החלקה מצוירת
  const rad = Math.round((1 + P.smooth * 6) * s);
  [R, G, B] = kuwahara(R, G, B, w, h, P.smooth < .05 ? 0 : rad);
  if (P.smooth > .5) [R, G, B] = kuwahara(R, G, B, w, h, Math.max(1, Math.round(rad * .6)));
  const L = new Float32Array(N);
  for (let i = 0; i < N; i++) L[i] = .299 * R[i] + .587 * G[i] + .114 * B[i];

  // 2. קווי דיו (הפרש גאוסיאנים - XDoG)
  const lineBoost = { pop: 1.35, kids: 1.5, noir: 1.2, manga: 1, sketch: .9, cel: .75, classic: 1, vintage: 1 }[st];
  const sig = (0.7 + P.edge * 1.6) * s * lineBoost;
  const g1 = gauss(L, w, h, sig), g2 = gauss(L, w, h, sig * 1.6);
  const ink = new Float32Array(N);
  const thr = .0025 + (1 - P.edge) * .008;
  for (let i = 0; i < N; i++) {
    const D = g1[i] - g2[i];
    ink[i] = P.edge < .02 ? 0 : smoothstep(thr, thr * 2.4, -D);
  }

  // 3. צבע לפי סגנון
  const sat = 0.6 + P.color * 1.2;
  const cell = Math.max(3.5, 9 * s);
  const out = sctx.createImageData(w, h), o = out.data;
  const PAL = [[0,0,0],[1,1,1],[1,.84,.04],[.9,.16,.2],[.16,.42,.9],[.98,.8,.68],[.62,.82,1],[.15,.65,.45]];
  const meanL = L.reduce((a, b) => a + b, 0) / N;

  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    let r = R[i], g = G[i], b = B[i], l = L[i];
    let lineCol = 0.05;
    if (st === "classic" || st === "kids") {
      const k = st === "kids" ? sat * 1.35 : sat;
      r = l + (r - l) * k; g = l + (g - l) * k; b = l + (b - l) * k;
      const lv = st === "kids" ? 4 : 5;
      let q = Math.round(cl(l) * (lv - 1)) / (lv - 1);
      q = st === "kids" ? .3 + q * .7 : .1 + q * .9;
      const f = (q + .03) / (l + .03); r *= f; g *= f; b *= f;
      if (st === "kids") { r = r * .9 + .1; g = g * .9 + .1; b = b * .9 + .1; }
      if (st === "classic" && l < .42 && dot(x, y, cell, .785, (.42 - l) * 1.6)) { r *= .45; g *= .45; b *= .5; }
    } else if (st === "pop") {
      r = l + (r - l) * sat * 1.3; g = l + (g - l) * sat * 1.3; b = l + (b - l) * sat * 1.3;
      let bi = 0, bd = 1e9;
      for (let k = 0; k < PAL.length; k++) { const p = PAL[k]; const dd = (r - p[0]) ** 2 * 1.2 + (g - p[1]) ** 2 * 1.5 + (b - p[2]) ** 2; if (dd < bd) { bd = dd; bi = k; } }
      if (bi === 5) { // עור = נקודות אדומות על לבן, כמו ליכטנשטיין
        const on = dot(x, y, cell * 1.1, .785, .38); [r, g, b] = on ? [.92, .3, .3] : [1, .95, .9];
      } else if (bi === 6) {
        const on = dot(x, y, cell * 1.1, .785, .45); [r, g, b] = on ? [.16, .42, .9] : [1, 1, 1];
      } else [r, g, b] = PAL[bi];
    } else if (st === "manga") {
      const v = cl((l - meanL) * 1.3 + .5);
      let t;
      if (v < .2) t = .05;
      else if (v < .42) t = dot(x, y, cell * .75, .785, .6) ? .08 : .97;
      else if (v < .66) t = dot(x, y, cell * .75, .785, .22) ? .1 : .98;
      else t = .99;
      r = g = b = t;
    } else if (st === "noir") {
      const isRed = r > .35 && r > g * 1.7 && r > b * 1.7;
      const v = l > meanL * .95 ? .96 : .04;
      if (isRed && P.color > .05) { r = .85; g = .06; b = .1; } else r = g = b = v;
      if (v > .5 && l < meanL * 1.25 && hatch(x, y, .785, 5 * s, 1.2 * s)) { r *= .2; g *= .2; b *= .2; }
    } else if (st === "vintage") {
      r = l + (r - l) * sat * .8; g = l + (g - l) * sat * .8; b = l + (b - l) * sat * .8;
      const C = cl(1 - r), M = cl(1 - g), Y = cl(1 - b), K = Math.min(C, M, Y) * .7;
      let pr = .97, pg = .91, pb = .76; // נייר מצהיב
      const c2 = cell * .9;
      if (dot(x + 1.5 * s, y, c2, .26, (C - K) * .9)) { pr *= .15; pg *= .72; pb *= .92; }
      if (dot(x, y - 1.2 * s, c2, 1.31, (M - K) * .9)) { pr *= .94; pg *= .22; pb *= .55; }
      if (dot(x, y, c2, 0, (Y - K) * .9)) { pr *= 1; pg *= .93; pb *= .12; }
      if (dot(x, y, c2, .785, K * 1.1)) { pr *= .2; pg *= .2; pb *= .22; }
      r = pr; g = pg; b = pb; lineCol = .12;
    } else if (st === "cel") {
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      let hh = 0; const dl = mx - mn;
      if (dl > 1e-5) { if (mx === r) hh = ((g - b) / dl) % 6; else if (mx === g) hh = (b - r) / dl + 2; else hh = (r - g) / dl + 4; }
      hh = (hh * 60 + 360) % 360;
      let ss = mx > 0 ? dl / mx : 0; ss = cl(ss * sat * 1.1);
      let vv = mx < .3 ? .32 : mx < .66 ? .68 : .97;
      if (mx < .12) vv = .14;
      const cc = vv * ss, xx = cc * (1 - Math.abs((hh / 60) % 2 - 1)), m = vv - cc;
      const sector = Math.floor(hh / 60);
      [r, g, b] = [[cc,xx,0],[xx,cc,0],[0,cc,xx],[0,xx,cc],[xx,0,cc],[cc,0,xx]][sector % 6].map(v => v + m);
    } else if (st === "sketch") {
      let pr = .98, pg = .96, pb = .91;
      const t = l;
      let dark = 1;
      if (t < .7 && hatch(x, y, .785, 6 * s, 1.1 * s)) dark *= .55;
      if (t < .48 && hatch(x, y, -.785, 6 * s, 1.1 * s)) dark *= .55;
      if (t < .28 && hatch(x, y, 0, 4.5 * s, 1.1 * s)) dark *= .5;
      const tint = P.color * .25;
      r = (pr * (1 - tint) + R[i] * tint) * dark; g = (pg * (1 - tint) + G[i] * tint) * dark; b = (pb * (1 - tint) + B[i] * tint) * dark;
      lineCol = .22;
    }
    const k = ink[i];
    r = r * (1 - k) + lineCol * k; g = g * (1 - k) + lineCol * k; b = b * (1 - k) + lineCol * k;
    const j = i * 4;
    o[j] = cl(r) * 255; o[j + 1] = cl(g) * 255; o[j + 2] = cl(b) * 255; o[j + 3] = 255;
  }
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  c.getContext("2d").putImageData(out, 0, 0);
  return c;
}

/* ================= רינדור ================= */
let renderTimer = null;
function render() {
  if (!sourceImg) return;
  $("busy").classList.add("show");
  const btn = $("applyBtn"); btn.disabled = true; btn.textContent = "⏳ מצייר...";
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    comicPage = comicify(basePage, style, params(1));
    showOriginal = false;
    draw();
    $("busy").classList.remove("show");
    btn.disabled = false; btn.textContent = "✨ החל אפקט קומיקס";
    const nm = STYLES.find(s => s.id === style).name;
    hint(`סגנון: ${nm}. אפשר לגרור את הבועות ואת האפקט, ולשנות סגנון בלחיצה על דוגמה.`);
  }, 30);
}
function renderThumbs() {
  // תצוגה מקדימה קטנה של כל סגנון על התמונה שלך
  const small = document.createElement("canvas"); small.width = 240; small.height = 180;
  const g = small.getContext("2d");
  drawCrop(g, sourceImg, { x: 0, y: 0, w: 240, h: 180, cx: .5, cy: .5, z: 1 });
  let i = 0;
  const next = () => {
    if (i >= STYLES.length) return;
    const st = STYLES[i++].id;
    const tmp = document.createElement("canvas"); tmp.width = 240; tmp.height = 180;
    tmp.getContext("2d").drawImage(small, 0, 0);
    const res = comicify(tmp, st, { edge: .5, smooth: .5, color: .5, s: .32 });
    thumbs[st].getContext("2d").drawImage(res, 0, 0);
    setTimeout(next, 0);
  };
  next();
}

const boxes = {};
function draw() {
  const pic = showOriginal ? basePage : comicPage;
  if (!pic) return;
  ctx.drawImage(pic, 0, 0);
  // מסגרות משבצות
  const panels = panelsFor(layout);
  if (!panels[0].full) {
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.rect(0, 0, W, H);
    panels.forEach(p => ctx.rect(p.x + p.w, p.y, -p.w, p.h));
    ctx.fill("evenodd");
  }
  ctx.lineWidth = 8; ctx.strokeStyle = "#111";
  panels.forEach(p => ctx.strokeRect(p.x + 4, p.y + 4, p.w - 8, p.h - 8));
  if (showOriginal) return;
  drawCaption($("captionText").value.trim(), panels[0]);
  boxes.b1 = drawBubble($("bubble1").value.trim(), items.b1, $("kind1").value, 1);
  boxes.b2 = drawBubble($("bubble2").value.trim(), items.b2, $("kind2").value, -1);
  boxes.sfx = drawSfx($("sfxText").value.trim(), items.sfx);
}

function wrap(text, maxW) {
  const words = text.split(/\s+/).filter(Boolean), lines = []; let cur = "";
  for (const w of words) { const t = cur ? cur + " " + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur);
  return lines;
}
function drawCaption(text, p) {
  if (!text) return;
  ctx.save();
  ctx.font = "700 32px 'Secular One', Rubik, sans-serif"; ctx.direction = "rtl";
  const w = Math.min(ctx.measureText(text).width, p.w * .7) + 40, h = 60;
  const x = p.x + p.w - w - 18, y = p.y + 18;
  ctx.fillStyle = "#111"; ctx.fillRect(x + 6, y + 6, w, h);
  ctx.fillStyle = "#ffd60a"; ctx.fillRect(x, y, w, h);
  ctx.lineWidth = 4; ctx.strokeStyle = "#111"; ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = "#111"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, x + w / 2, y + h / 2 + 2, w - 28);
  ctx.restore();
}
function drawBubble(text, pos, kind, dir) {
  if (!text) return null;
  ctx.save();
  const shout = kind === "shout";
  ctx.font = `${shout ? 900 : 700} ${shout ? 44 : 38}px 'Secular One', Rubik, sans-serif`; ctx.direction = "rtl";
  const lines = wrap(text, 360), lh = shout ? 50 : 44;
  const tw = Math.max(...lines.map(l => ctx.measureText(l).width));
  const rx = tw / 2 * 1.2 + 30, ry = lines.length * lh / 2 * 1.3 + 24;
  const cx = pos.x, cy = pos.y;
  const tail = [[cx + dir * rx * .12, cy + dir * ry * .55], [cx + dir * rx * .75, cy + dir * (ry + 80)], [cx + dir * rx * .45, cy + dir * ry * .45]];
  const shape = () => {
    ctx.beginPath();
    if (shout) {
      const n = 20;
      for (let i = 0; i <= n * 2; i++) { const a = i / (n * 2) * Math.PI * 2, k = i % 2 ? 1 : 1.25;
        const px = cx + Math.cos(a) * rx * k, py = cy + Math.sin(a) * ry * k; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.closePath();
    } else if (kind === "thought") {
      const n = 11;
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, px = cx + Math.cos(a) * rx * .85, py = cy + Math.sin(a) * ry * .85, r = Math.min(rx, ry) * .45;
        ctx.moveTo(px + r, py); ctx.arc(px, py, r, 0, Math.PI * 2); }
      ctx.moveTo(cx + rx * .9, cy); ctx.ellipse(cx, cy, rx * .9, ry * .9, 0, 0, Math.PI * 2);
    } else ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  };
  const tailPath = () => { ctx.beginPath(); ctx.moveTo(...tail[0]); ctx.lineTo(...tail[1]); ctx.lineTo(...tail[2]); ctx.closePath(); };
  const fill = shout ? "#fff3a3" : "#fff";
  // צל
  ctx.save(); ctx.translate(7, 7); ctx.fillStyle = "#111"; shape(); ctx.fill(); if (kind !== "thought") { tailPath(); ctx.fill(); } ctx.restore();
  ctx.lineWidth = 5; ctx.strokeStyle = "#111"; ctx.fillStyle = fill; ctx.lineJoin = "round";
  if (kind === "thought") {
    shape(); ctx.stroke(); shape(); ctx.fill();
    [[.95, 16], [1.25, 11], [1.5, 7]].forEach(([t, r]) => {
      const px = cx + dir * rx * .55 * t, py = cy + dir * (ry * t + 6);
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill(); ctx.lineWidth = 4; ctx.stroke();
    });
  } else { shape(); ctx.stroke(); tailPath(); ctx.stroke(); shape(); ctx.fill(); tailPath(); ctx.fill(); }
  ctx.fillStyle = "#111"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  lines.forEach((l, i) => ctx.fillText(l, cx, cy - lines.length * lh / 2 + lh * (i + .5) + 2));
  ctx.restore();
  const k = shout ? 1.25 : 1;
  return { x: cx - rx * k, y: cy - ry * k, w: rx * 2 * k, h: ry * 2 * k };
}
function drawSfx(text, pos) {
  if (!text) return null;
  ctx.save();
  let size = 150; const F = s => `700 ${s}px Karantina, 'Secular One', Rubik, sans-serif`;
  ctx.font = F(size); ctx.direction = "rtl";
  while (ctx.measureText(text).width > W * .45 && size > 60) { size -= 8; ctx.font = F(size); }
  const w = ctx.measureText(text).width;
  ctx.translate(pos.x, pos.y); ctx.rotate(-.14);
  const R = w / 2 + 55, r2 = size * .62, n = 18;
  const burst = (k) => { ctx.beginPath();
    for (let i = 0; i <= n * 2; i++) { const a = i / (n * 2) * Math.PI * 2, f = (i % 2 ? .7 : 1) * k;
      const px = Math.cos(a) * R * f, py = Math.sin(a) * r2 * 1.2 * f; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.closePath(); };
  ctx.fillStyle = "#111"; ctx.save(); ctx.translate(8, 8); burst(1); ctx.fill(); ctx.restore();
  ctx.fillStyle = "#e63946"; burst(1); ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = "#111"; ctx.stroke();
  ctx.fillStyle = "#ffd60a"; burst(.72); ctx.fill();
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
  ctx.lineWidth = size * .14; ctx.strokeStyle = "#111"; ctx.strokeText(text, 4, 8); ctx.fillStyle = "#111"; ctx.fillText(text, 4, 8);
  ctx.strokeText(text, 0, 4); ctx.fillStyle = "#fff"; ctx.fillText(text, 0, 4);
  ctx.lineWidth = size * .03; ctx.strokeStyle = "#e63946"; ctx.strokeText(text, 0, 4);
  ctx.restore();
  return { x: pos.x - R, y: pos.y - r2 * 1.2, w: R * 2, h: r2 * 2.4 };
}

/* ================= גרירה ================= */
let dragging = null, offX = 0, offY = 0;
const toCanvas = e => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; };
canvas.addEventListener("pointerdown", e => {
  if (!sourceImg) { fileInput.click(); return; }
  const p = toCanvas(e);
  for (const key of ["sfx", "b2", "b1"]) {
    const b = boxes[key];
    if (b && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
      dragging = key; offX = p.x - items[key].x; offY = p.y - items[key].y;
      canvas.setPointerCapture(e.pointerId); e.preventDefault(); return;
    }
  }
});
canvas.addEventListener("pointermove", e => {
  if (!dragging) return;
  const p = toCanvas(e);
  items[dragging].x = Math.max(0, Math.min(W, p.x - offX));
  items[dragging].y = Math.max(0, Math.min(H, p.y - offY));
  draw();
});
["pointerup", "pointercancel"].forEach(ev => canvas.addEventListener(ev, () => { dragging = null; }));

/* ================= פקדים ================= */
["bubble1", "bubble2", "sfxText", "captionText", "kind1", "kind2"].forEach(id => $(id).addEventListener("input", draw));
["edgeRange", "smoothRange", "colorRange"].forEach(id => $(id).addEventListener("change", render));
$("applyBtn").addEventListener("click", () => sourceImg ? render() : fileInput.click());

const cmp = $("compareBtn");
const showSrc = on => { if (!basePage) return; showOriginal = on; draw(); };
cmp.addEventListener("pointerdown", () => showSrc(true));
["pointerup", "pointerleave", "pointercancel"].forEach(ev => cmp.addEventListener(ev, () => showSrc(false)));

/* ================= מצלמה ================= */
const camModal = $("camModal"), video = $("camVideo"), camMsg = $("camMsg");
let stream = null, facing = "user", counting = false;
const captureInput = $("captureInput");
captureInput.addEventListener("change", () => { if (captureInput.files[0]) loadFile(captureInput.files[0]); captureInput.value = ""; });

$("cameraBtn").addEventListener("click", e => { e.stopPropagation(); openCamera(); });
async function openCamera() {
  // אין תמיכה במצלמה חיה (למשל דפדפן ישן או דף שלא ב־https): פותחים את אפליקציית המצלמה של הטלפון
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { captureInput.click(); return; }
  camModal.hidden = false; camMsg.textContent = "מבקש גישה למצלמה...";
  await startStream();
}
async function startStream() {
  stopStream();
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
    video.srcObject = stream;
    video.classList.toggle("mirror", facing === "user");
    await video.play().catch(() => {});
    camMsg.textContent = "כוונו ולחצו \"צלם\". בטלפון אפשר להחליף בין מצלמה קדמית לאחורית.";
    $("snapBtn").focus();
  } catch (err) {
    const denied = err && (err.name === "NotAllowedError" || err.name === "SecurityError");
    camMsg.textContent = denied
      ? "אין הרשאה למצלמה. אשרו גישה בהגדרות הדפדפן, או לחצו כאן על \"ביטול\" והעלו תמונה."
      : "לא נמצאה מצלמה. אפשר להעלות תמונה במקום.";
    if (!denied && /Android|iPhone|iPad/i.test(navigator.userAgent)) { closeCamera(); captureInput.click(); }
  }
}
function stopStream() { if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } }
function closeCamera() { stopStream(); camModal.hidden = true; counting = false; $("camCount").textContent = ""; }
$("camClose").addEventListener("click", closeCamera);
camModal.addEventListener("click", e => { if (e.target === camModal) closeCamera(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !camModal.hidden) closeCamera(); });
$("flipBtn").addEventListener("click", () => { facing = facing === "user" ? "environment" : "user"; startStream(); });

function snap() {
  if (!stream || !video.videoWidth) return;
  const c = document.createElement("canvas"); c.width = video.videoWidth; c.height = video.videoHeight;
  const g = c.getContext("2d");
  if (facing === "user") { g.translate(c.width, 0); g.scale(-1, 1); } // תמונת סלפי לא הפוכה
  g.drawImage(video, 0, 0);
  const fl = $("camFlash"); fl.classList.add("on"); requestAnimationFrame(() => requestAnimationFrame(() => fl.classList.remove("on")));
  const src = c.toDataURL("image/jpeg", .92);
  setTimeout(() => { closeCamera(); loadSrc(src); }, 250);
}
$("snapBtn").addEventListener("click", snap);
$("timerBtn").addEventListener("click", () => {
  if (counting || !stream) return;
  counting = true; let n = 3; const el = $("camCount");
  const tick = () => {
    if (!counting) return;
    if (n === 0) { el.textContent = ""; counting = false; snap(); return; }
    el.textContent = n--; setTimeout(tick, 1000);
  };
  tick();
});

$("downloadBtn").addEventListener("click", () => {
  if (!comicPage) { hint("קודם צריך להעלות תמונה."); return; }
  canvas.toBlob(blob => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `comic-${style}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }, "image/png");
});

// מתחילים עם תמונת דוגמה כדי שהגלריה תציג מיד את כל הסגנונות
const start = () => loadSrc(SAMPLE);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(start); else start();
})();
