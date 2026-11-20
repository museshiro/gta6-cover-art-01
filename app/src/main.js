// main.js — wires the Vice Cover Studio editor.
//
// The editor keeps one poster state and repaints the preview canvas on
// every change. Photos are read on the user's own machine (FileReader or
// the built-in samples) and never uploaded anywhere.

import { SIZES, renderCover, frameAt } from './cover.js';

const SAMPLES = {
  hero: 'samples/hero.jpg',
  sunset: 'samples/sunset.jpg',
  car: 'samples/car.jpg',
};

const FRAME_TITLES = ['Hero', 'Frame 2', 'Frame 3'];

// Poster state: one entry per frame, plus the caption, grade and size.
const poster = {
  size: 'square',
  grade: 'sunset',
  caption: 'VICE CITY NIGHTS',
  captionAt: 'bottom',
  active: 0,
  frames: [
    { img: null, src: '', zoom: 1, dx: 0, dy: 0 },
    { img: null, src: '', zoom: 1, dx: 0, dy: 0 },
    { img: null, src: '', zoom: 1, dx: 0, dy: 0 },
  ],
};

const preview = document.getElementById('preview');
const imageCache = new Map();
let paintQueued = false;

// Load an image (cached by source) and resolve with the element.
function fetchImage(src) {
  if (imageCache.has(src)) return imageCache.get(src);
  const done = new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('could not load ' + src));
    el.src = src;
  });
  imageCache.set(src, done);
  return done;
}

// Repaint the preview canvas from the current poster state.
// The preview is drawn at a modest size; export reuses renderCover at
// full size, so what you see is what you download.
function repaint() {
  const dims = SIZES[poster.size];
  const shortSide = 720;
  const scale = shortSide / Math.max(dims.w, dims.h);
  preview.width = Math.round(dims.w * scale);
  preview.height = Math.round(dims.h * scale);
  renderCover(preview, poster);
  syncCards();
}

function queueRepaint() {
  if (paintQueued) return;
  paintQueued = true;
  requestAnimationFrame(() => {
    paintQueued = false;
    repaint();
  });
}

// Keep each frame card's status line, zoom slider and highlight in sync.
function syncCards() {
  poster.frames.forEach((frame, i) => {
    const status = document.getElementById(`status-${i}`);
    if (status) status.textContent = frame.img ? 'photo loaded' : 'no photo yet';
    const zoom = document.getElementById(`zoom-${i}`);
    if (zoom && Number(zoom.value) !== frame.zoom) zoom.value = String(frame.zoom);
    const card = document.getElementById(`card-${i}`);
    if (card) card.classList.toggle('is-active', poster.active === i);
  });
}

function selectFrame(i) {
  poster.active = i;
  syncCards();
}

// Put a photo (by URL or data URL) into frame i and repaint.
async function setPhoto(i, src) {
  try {
    const img = await fetchImage(src);
    const frame = poster.frames[i];
    frame.img = img;
    frame.src = src;
    frame.zoom = 1;
    frame.dx = 0;
    frame.dy = 0;
    selectFrame(i);
    queueRepaint();
  } catch {
    const status = document.getElementById(`status-${i}`);
    if (status) status.textContent = 'could not load photo';
  }
}

function clearPhoto(i) {
  const frame = poster.frames[i];
  frame.img = null;
  frame.src = '';
  frame.zoom = 1;
  frame.dx = 0;
  frame.dy = 0;
  queueRepaint();
}

// Convert a pointer position on the preview into poster coordinates.
function posterPoint(event) {
  const box = preview.getBoundingClientRect();
  return {
    x: (event.clientX - box.left) * (preview.width / box.width),
    y: (event.clientY - box.top) * (preview.height / box.height),
  };
}

// Drag pans the active frame's photo; the wheel zooms it.
let dragging = null;
preview.addEventListener('pointerdown', (event) => {
  const p = posterPoint(event);
  const hit = frameAt(p.x, p.y, preview.width, preview.height);
  selectFrame(hit);
  dragging = { x: p.x, y: p.y, frame: poster.frames[hit] };
  preview.setPointerCapture(event.pointerId);
});
preview.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  const p = posterPoint(event);
  const dims = SIZES[poster.size];
  const frame = dragging.frame;
  // A drag across the whole frame sweeps the pan from -1 to 1.
  frame.dx = clamp(frame.dx + ((p.x - dragging.x) / preview.width) * 2, -1, 1);
  frame.dy = clamp(frame.dy + ((p.y - dragging.y) / preview.height) * 2, -1, 1);
  dragging.x = p.x;
  dragging.y = p.y;
  queueRepaint();
});
preview.addEventListener('pointerup', () => { dragging = null; });
preview.addEventListener('pointercancel', () => { dragging = null; });
preview.addEventListener('wheel', (event) => {
  event.preventDefault();
  const frame = poster.frames[poster.active];
  frame.zoom = clamp(frame.zoom * Math.exp(-event.deltaY * 0.0012), 1, 2.5);
  queueRepaint();
}, { passive: false });

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

// Wire the three frame cards: file picker, sample buttons, clear, zoom.
poster.frames.forEach((frame, i) => {
  const fileInput = document.getElementById(`file-${i}`);
  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(i, String(reader.result));
    reader.readAsDataURL(file);
    fileInput.value = '';
  });
  document.querySelectorAll(`[data-sample][data-frame="${i}"]`).forEach((btn) => {
    btn.addEventListener('click', () => setPhoto(i, SAMPLES[btn.dataset.sample]));
  });
  const clearBtn = document.querySelector(`[data-clear="${i}"]`);
  if (clearBtn) clearBtn.addEventListener('click', () => clearPhoto(i));
  const zoom = document.getElementById(`zoom-${i}`);
  zoom.addEventListener('input', () => {
    frame.zoom = Number(zoom.value);
    queueRepaint();
  });
  const card = document.getElementById(`card-${i}`);
  card.addEventListener('click', (event) => {
    if (event.target.closest('button, label, input, select')) return;
    selectFrame(i);
  });
});

// Caption text, position and grade.
const captionInput = document.getElementById('caption-input');
captionInput.addEventListener('input', () => {
  poster.caption = captionInput.value;
  queueRepaint();
});
document.getElementById('caption-pos').addEventListener('change', (event) => {
  poster.captionAt = event.target.value;
  queueRepaint();
});
document.getElementById('grade-select').addEventListener('change', (event) => {
  poster.grade = event.target.value;
  queueRepaint();
});

// Size buttons.
document.querySelectorAll('[data-size]').forEach((btn) => {
  btn.addEventListener('click', () => {
    poster.size = btn.dataset.size;
    document.querySelectorAll('[data-size]').forEach((b) => {
      b.classList.toggle('is-on', b === btn);
    });
    queueRepaint();
  });
});

// Export: render at full size and download the PNG.
document.getElementById('export-btn').addEventListener('click', () => {
  const dims = SIZES[poster.size];
  const out = document.createElement('canvas');
  renderCover(out, poster);
  out.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vice-cover-${dims.w}x${dims.h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, 'image/png');
});

// Make sure the Anton caption font is ready before the first paint,
// then load the three samples into their frames.
async function boot() {
  try {
    await document.fonts.load('80px Anton');
    await document.fonts.ready;
  } catch {
    // Fall back to the system sans if the font cannot load; the poster
    // still renders, just without the condensed lettering.
  }
  await Promise.all([
    setPhoto(0, SAMPLES.hero),
    setPhoto(1, SAMPLES.sunset),
    setPhoto(2, SAMPLES.car),
  ]);
  poster.active = 0;
  repaint();
  window.__editorReady = true;
}

boot();
