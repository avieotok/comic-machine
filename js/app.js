const canvas = document.getElementById('comicCanvas');
const ctx = canvas.getContext('2d');
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const selectFileBtn = document.getElementById('selectFileBtn');
const miniThumb = document.getElementById('miniThumb');

const styleMode = document.getElementById('styleMode');
const edgeSlider = document.getElementById('edgeSlider');
const colorSlider = document.getElementById('colorSlider');
const dotsSlider = document.getElementById('dotsSlider');
const speechText = document.getElementById('speechText');
const thoughtIcon = document.getElementById('thoughtIcon');
const applyBtn = document.getElementById('applyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const clearStickersBtn = document.getElementById('clearStickersBtn');

let sourceImage = new Image();
let processedOffscreen = document.createElement('canvas');
processedOffscreen.width = canvas.width;
processedOffscreen.height = canvas.height;

const speechBubble = { x: 185, y: 150, rx: 120, ry: 68 };
const thoughtBubble = { x: 640, y: 135, r: 62 };
const stickers = [];
let draggingTarget = null;
let dragOffset = { x: 0, y: 0 };

function createDefaultImage() {
  const temp = document.createElement('canvas');
  temp.width = 800;
  temp.height = 600;
  const tctx = temp.getContext('2d');

  const grad = tctx.createLinearGradient(0, 0, 800, 600);
  grad.addColorStop(0, '#00b4d8');
  grad.addColorStop(0.5, '#ffd166');
  grad.addColorStop(1, '#ef476f');
  tctx.fillStyle = grad;
  tctx.fillRect(0, 0, 800, 600);

  tctx.save();
  tctx.translate(400, 320);
  for (let i = 0; i < 24; i++) {
    tctx.rotate(Math.PI / 12);
    tctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.06)';
    tctx.beginPath();
    tctx.moveTo(0, 0);
    tctx.lineTo(600, -40);
    tctx.lineTo(600, 40);
    tctx.closePath();
    tctx.fill();
  }
  tctx.restore();

  tctx.fillStyle = '#ffcdb2';
  tctx.beginPath();
  tctx.arc(400, 290, 95, 0, Math.PI * 2);
  tctx.fill();

  tctx.fillStyle = '#6d4c41';
  tctx.beginPath();
  tctx.arc(400, 275, 108, Math.PI, Math.PI * 2);
  tctx.fillRect(292, 275, 35, 170);
  tctx.fillRect(473, 275, 35, 170);
  tctx.fill();

  tctx.fillStyle = '#3a86ff';
  tctx.beginPath();
  tctx.roundRect(275, 400, 250, 200, 40);
  tctx.fill();

  tctx.fillStyle = '#111';
  tctx.beginPath();
  tctx.arc(368, 280, 9, 0, Math.PI * 2);
  tctx.arc(432, 280, 9, 0, Math.PI * 2);
  tctx.fill();

  tctx.strokeStyle = '#111';
  tctx.lineWidth = 6;
  tctx.beginPath();
  tctx.arc(400, 305, 38, 0.15 * Math.PI, 0.85 * Math.PI);
  tctx.stroke();

  sourceImage.onload = () => {
    miniThumb.src = temp.toDataURL();
    processComicImage();
  };
  sourceImage.src = temp.toDataURL();
}

function handleFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    sourceImage = new Image();
    sourceImage.onload = () => {
      miniThumb.src = e.target.result;
      processComicImage();
    };
    sourceImage.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

selectFileBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput.click();
});
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  handleFile(e.dataTransfer.files[0]);
});

function processComicImage() {
  const w = processedOffscreen.width;
  const h = processedOffscreen.height;
  const octx = processedOffscreen.getContext('2d');

  const imgRatio = sourceImage.width / sourceImage.height;
  const canvasRatio = w / h;
  let drawW, drawH, offsetX, offsetY;

  if (imgRatio > canvasRatio) {
    drawH = h;
    drawW = h * imgRatio;
    offsetX = (w - drawW) / 2;
    offsetY = 0;
  } else {
    drawW = w;
    drawH = w / imgRatio;
    offsetX = 0;
    offsetY = (h - drawH) / 2;
  }

  octx.clearRect(0, 0, w, h);
  octx.drawImage(sourceImage, offsetX, offsetY, drawW, drawH);

  const imgData = octx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const copy = new Uint8ClampedArray(data);

  const mode = styleMode.value;
  const levels = parseInt(colorSlider.value, 10);
  const edgeThreshold = 135 - parseInt(edgeSlider.value, 10);
  const step = 255 / levels;

  for (let i = 0; i < data.length; i += 4) {
    let r = copy[i];
    let g = copy[i + 1];
    let b = copy[i + 2];

    const contrast = mode === 'pop' ? 1.55 : 1.25;
    r = Math.min(255, Math.max(0, (r - 128) * contrast + 128));
    g = Math.min(255, Math.max(0, (g - 128) * contrast + 128));
    b = Math.min(255, Math.max(0, (b - 128) * contrast + 128));

    r = Math.round(r / step) * step;
    g = Math.round(g / step) * step;
    b = Math.round(b / step) * step;

    if (mode === 'bw') {
      const gray = r * 0.3 + g * 0.59 + b * 0.11;
      r = g = b = gray > 120 ? 245 : gray > 70 ? 150 : 35;
    } else if (mode === 'vintage') {
      r = Math.min(255, r * 1.08 + 18);
      g = Math.min(255, g * 1.02 + 10);
      b = Math.max(0, b * 0.82);
    } else if (mode === 'pop') {
      r = Math.min(255, r * 1.22);
      g = Math.min(255, g * 1.15);
      b = Math.min(255, b * 1.25);
    }

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }

  const grayAt = (x, y) => {
    const idx = (y * w + x) * 4;
    return copy[idx] * 0.3 + copy[idx + 1] * 0.59 + copy[idx + 2] * 0.11;
  };

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const gx =
        -grayAt(x - 1, y - 1) + grayAt(x + 1, y - 1) +
        -2 * grayAt(x - 1, y) + 2 * grayAt(x + 1, y) +
        -grayAt(x - 1, y + 1) + grayAt(x + 1, y + 1);

      const gy =
        -grayAt(x - 1, y - 1) - 2 * grayAt(x, y - 1) - grayAt(x + 1, y - 1) +
         grayAt(x - 1, y + 1) + 2 * grayAt(x, y + 1) + grayAt(x + 1, y + 1);

      const mag = Math.sqrt(gx * gx + gy * gy);
      if (mag > edgeThreshold) {
        const idx = (y * w + x) * 4;
        data[idx] = 17;
        data[idx + 1] = 17;
        data[idx + 2] = 17;
      }
    }
  }

  octx.putImageData(imgData, 0, 0);

  const dotOpacity = parseInt(dotsSlider.value, 10) / 260;
  if (dotOpacity > 0) {
    octx.fillStyle = `rgba(17, 17, 17, ${dotOpacity})`;
    const spacing = 8;
    for (let y = 0; y < h; y += spacing) {
      for (let x = (y % (spacing * 2) === 0 ? 0 : spacing / 2); x < w; x += spacing) {
        octx.beginPath();
        octx.arc(x, y, 1.4, 0, Math.PI * 2);
        octx.fill();
      }
    }
  }

  renderScene();
}

function renderScene() {
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(processedOffscreen, 0, 0);

  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 14;
  ctx.strokeRect(0, 0, w, h);

  stickers.forEach((st) => drawSticker(st));

  if (thoughtIcon.value !== 'none') {
    drawThoughtBubble(thoughtBubble.x, thoughtBubble.y, thoughtBubble.r, thoughtIcon.value);
  }

  const text = speechText.value.trim();
  if (text.length > 0) {
    drawSpeechBubble(speechBubble.x, speechBubble.y, speechBubble.rx, speechBubble.ry, text);
  }
}

function drawSticker(st) {
  ctx.save();
  ctx.translate(st.x, st.y);
  ctx.rotate(st.angle);
  if (st.label === 'BOOM!' || st.label === 'WOW!') {
    ctx.fillStyle = st.label === 'BOOM!' ? '#ffd60a' : '#4cc9f0';
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, 0, 64, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#e63946';
    ctx.font = '900 24px Rubik, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(st.label, 0, 2);
  } else {
    ctx.font = '48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(st.label, 0, 2);
  }
  ctx.restore();
}

function drawSpeechBubble(cx, cy, rx, ry, text) {
  ctx.save();
  ctx.fillStyle = '#111111';
  ctx.beginPath();
  ctx.ellipse(cx + 6, cy + 6, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(cx + 25, cy + ry - 8);
  ctx.lineTo(cx + 75, cy + ry + 34);
  ctx.lineTo(cx + 55, cy + ry - 18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx + 27, cy + ry - 9);
  ctx.lineTo(cx + 53, cy + ry - 17);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 7;
  ctx.stroke();

  ctx.fillStyle = '#111111';
  ctx.font = '900 28px Rubik, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const words = text.split(' ');
  if (words.length > 2 && text.length > 14) {
    const mid = Math.ceil(words.length / 2);
    const line1 = words.slice(0, mid).join(' ');
    const line2 = words.slice(mid).join(' ');
    ctx.fillText(line1, cx, cy - 16);
    ctx.fillText(line2, cx, cy + 18);
  } else {
    ctx.fillText(text, cx, cy);
  }
  ctx.restore();
}

function drawThoughtBubble(cx, cy, r, icon) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 4;

  ctx.beginPath();
  ctx.arc(cx - r - 18, cy + r - 10, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx - r - 38, cy + r + 8, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const puffs = [
    [0, 0, r * 0.72],
    [-r * 0.55, 5, r * 0.48],
    [r * 0.55, 5, r * 0.48],
    [0, -r * 0.45, r * 0.52],
    [0, r * 0.45, r * 0.48]
  ];

  ctx.beginPath();
  puffs.forEach(([dx, dy, pr]) => {
    ctx.moveTo(cx + dx + pr, cy + dy);
    ctx.arc(cx + dx, cy + dy, pr, 0, Math.PI * 2);
  });
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.65, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = '44px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(icon, cx, cy + 3);
  ctx.restore();
}

document.querySelectorAll('.sticker-chip[data-sticker]').forEach((btn) => {
  btn.addEventListener('click', () => {
    stickers.push({
      label: btn.dataset.sticker,
      x: 360 + ((stickers.length * 45) % 180),
      y: 260 + ((stickers.length * 40) % 160),
      angle: (stickers.length % 2 === 0 ? -1 : 1) * 0.14,
      r: 42
    });
    renderScene();
  });
});

clearStickersBtn.addEventListener('click', () => {
  stickers.length = 0;
  renderScene();
});

function getCanvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: ((clientX - rect.left) / rect.width) * canvas.width,
    y: ((clientY - rect.top) / rect.height) * canvas.height
  };
}

function onPointerDown(e) {
  const pos = getCanvasCoords(e);
  if (Math.hypot(pos.x - speechBubble.x, pos.y - speechBubble.y) < speechBubble.rx) {
    draggingTarget = speechBubble;
    dragOffset = { x: pos.x - speechBubble.x, y: pos.y - speechBubble.y };
    return;
  }
  if (thoughtIcon.value !== 'none' && Math.hypot(pos.x - thoughtBubble.x, pos.y - thoughtBubble.y) < thoughtBubble.r + 20) {
    draggingTarget = thoughtBubble;
    dragOffset = { x: pos.x - thoughtBubble.x, y: pos.y - thoughtBubble.y };
    return;
  }
  for (let i = stickers.length - 1; i >= 0; i--) {
    const st = stickers[i];
    if (Math.hypot(pos.x - st.x, pos.y - st.y) < st.r + 12) {
      draggingTarget = st;
      dragOffset = { x: pos.x - st.x, y: pos.y - st.y };
      return;
    }
  }
}

function onPointerMove(e) {
  if (!draggingTarget) return;
  e.preventDefault();
  const pos = getCanvasCoords(e);
  draggingTarget.x = Math.max(60, Math.min(canvas.width - 60, pos.x - dragOffset.x));
  draggingTarget.y = Math.max(50, Math.min(canvas.height - 50, pos.y - dragOffset.y));
  renderScene();
}

function onPointerUp() {
  draggingTarget = null;
}

canvas.addEventListener('mousedown', onPointerDown);
window.addEventListener('mousemove', onPointerMove);
window.addEventListener('mouseup', onPointerUp);
canvas.addEventListener('touchstart', onPointerDown, { passive: false });
window.addEventListener('touchmove', onPointerMove, { passive: false });
window.addEventListener('touchend', onPointerUp);

[styleMode, edgeSlider, colorSlider, dotsSlider].forEach((el) => {
  el.addEventListener('input', processComicImage);
});
[speechText, thoughtIcon].forEach((el) => {
  el.addEventListener('input', renderScene);
});
applyBtn.addEventListener('click', processComicImage);

downloadBtn.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'my-comic-creation.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});

createDefaultImage();
