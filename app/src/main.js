// Vice Cover Studio — editor wiring (ES module).
// One poster state, a live canvas preview, per-frame photo pickers,
// drag-to-pan / wheel-zoom / zoom sliders, caption + grade + size,
// and PNG export at the three poster sizes.

import { SIZES, GRADES, renderPoster, posterCanvas } from './cover.js';

const SAMPLES = [
  { file: 'samples/hero.jpg', label: 'Neon street' },
  { file: 'samples/sunset.jpg', label: 'City sunset' },
  { file: 'samples/car.jpg', label: 'Sports car' },
];

const FRAME_NAMES = ['Hero photo', 'Second photo', 'Third photo'];

// The poster the editor works on.
const poster = {
  size: 'square',
  grade: 'sunset',
  caption: 'VICE CITY NIGHTS',
  captionPos: 'bottom',
  frames: FRAME_NAMES.map(() => ({ img: null, zoom: 1, panX: 0, panY: 0 })),
};

let active = 0; // which frame the canvas gestures act on
let repaintQueued = false;

const stage = document.getElementById('stage');
const stageCtx = stage.getContext('2d');
const statusLine = document.getElementById('status');

function frameLabel(i) {
  const f = poster.frames[i];
  return f.img ? `${FRAME_NAMES[i]} · photo loaded` : `${FRAME_NAMES[i]} · empty`;
}

function refreshStatus() {
  statusLine.textContent = poster.frames.map((_, i) => frameLabel(i)).join('  ·  ');
}

function repaint() {
  if (repaintQueued) return;
  repaintQueued = true;
  requestAnimationFrame(() => {
    repaintQueued = false;
    const dims = SIZES[poster.size];
    const scale = Math.min(760 / dims.w, 560 / dims.h);
    stage.width = Math.round(dims.w * scale);
    stage.height = Math.round(dims.h * scale);
    renderPoster(stageCtx, poster, stage.width, stage.height);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function setFramePhoto(i, img) {
  poster.frames[i] = { img, zoom: 1, panX: 0, panY: 0 };
  const slider = document.querySelector(`[data-zoom="${i}"]`);
  if (slider) slider.value = '1';
  refreshStatus();
  repaint();
}

function wireFrameCard(i) {
  const card = document.querySelector(`[data-frame="${i}"]`);
  const picker = card.querySelector('input[type="file"]');
  picker.addEventListener('change', () => {
    const file = picker.files && picker.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        setFramePhoto(i, await loadImage(reader.result));
      } catch {
        statusLine.textContent = 'That file could not be read as a photo.';
      }
    };
    reader.readAsDataURL(file);
  });
  card.querySelectorAll('[data-sample]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        setFramePhoto(i, await loadImage(btn.dataset.sample));
      } catch {
        statusLine.textContent = 'Sample photo failed to load.';
      }
    });
  });
  const slider = card.querySelector(`[data-zoom="${i}"]`);
  slider.addEventListener('input', () => {
    poster.frames[i].zoom = parseFloat(slider.value);
    repaint();
  });
  card.addEventListener('click', () => {
    active = i;
    document.querySelectorAll('.frame-card').forEach((el) => el.classList.remove('active'));
    card.classList.add('active');
  });
}

// Canvas gestures: drag pans the active frame, wheel zooms it.
function canvasPoint(ev) {
  const r = stage.getBoundingClientRect();
  return { x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.height };
}

let dragging = null;
stage.addEventListener('pointerdown', (ev) => {
  dragging = canvasPoint(ev);
  stage.setPointerCapture(ev.pointerId);
});
stage.addEventListener('pointermove', (ev) => {
  if (!dragging) return;
  const p = canvasPoint(ev);
  const f = poster.frames[active];
  f.panX = Math.max(-1, Math.min(1, f.panX + (p.x - dragging.x) * 2));
  f.panY = Math.max(-1, Math.min(1, f.panY + (p.y - dragging.y) * 2));
  dragging = p;
  repaint();
});
stage.addEventListener('pointerup', () => { dragging = null; });
stage.addEventListener('wheel', (ev) => {
  ev.preventDefault();
  const f = poster.frames[active];
  f.zoom = Math.max(1, Math.min(2.5, f.zoom * (ev.deltaY < 0 ? 1.08 : 0.92)));
  const slider = document.querySelector(`[data-zoom="${active}"]`);
  if (slider) slider.value = String(f.zoom);
  repaint();
}, { passive: false });

function wireControls() {
  const captionInput = document.getElementById('caption');
  captionInput.addEventListener('input', () => {
    poster.caption = captionInput.value;
    repaint();
  });
  document.querySelectorAll('[data-pos]').forEach((btn) => {
    btn.addEventListener('click', () => {
      poster.captionPos = btn.dataset.pos;
      document.querySelectorAll('[data-pos]').forEach((b) => b.classList.toggle('on', b === btn));
      repaint();
    });
  });
  document.querySelectorAll('[data-grade]').forEach((btn) => {
    btn.addEventListener('click', () => {
      poster.grade = btn.dataset.grade;
      document.querySelectorAll('[data-grade]').forEach((b) => b.classList.toggle('on', b === btn));
      repaint();
    });
  });
  document.querySelectorAll('[data-size]').forEach((btn) => {
    btn.addEventListener('click', () => {
      poster.size = btn.dataset.size;
      document.querySelectorAll('[data-size]').forEach((b) => b.classList.toggle('on', b === btn));
      repaint();
    });
  });
}

function wireExports() {
  document.querySelectorAll('[data-export]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dims = SIZES[btn.dataset.export];
      const canvas = posterCanvas(poster, dims.w, dims.h);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `vice-cover-${btn.dataset.export}-${dims.w}x${dims.h}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        statusLine.textContent = `Exported ${dims.w} × ${dims.h} PNG.`;
      }, 'image/png');
    });
  });
}

async function boot() {
  // In ?shot=cover mode the shot module owns the canvas; the editor
  // must not boot and repaint over it.
  if (window.__coverShot) return;
  wireControls();
  wireExports();
  for (let i = 0; i < 3; i++) wireFrameCard(i);
  document.querySelector('.frame-card').classList.add('active');
  // Start with the hero sample in the hero frame so the poster is alive.
  try {
    poster.frames[0].img = await loadImage(SAMPLES[0].file);
  } catch {
    statusLine.textContent = 'Sample photo failed to load.';
  }
  await document.fonts.load('64px Anton').catch(() => {});
  refreshStatus();
  repaint();
}

boot();
