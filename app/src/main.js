// Vice Cover Studio — wires the editor: photo slots, caption, grade, size,
// drag-to-pan and zoom, live preview and PNG export. A `?shot=` query sets up
// a fixed scene for a screenshot instead (./shots.js).
import { drawCover, panelAt, layoutFor, SIZES, GRADES } from './cover.js';
import { runShot } from './shots.js';

const preview = document.getElementById('preview');
const pctx = preview.getContext('2d');
const captionInput = document.getElementById('caption');
const status = document.getElementById('status');

const state = {
  size: 'square',
  caption: 'VICE CITY NIGHTS',
  captionPos: 'bottom',
  grade: 'sunset',
  selected: 0,
  panels: [
    { photo: null, zoom: 1, dx: 0, dy: 0 },
    { photo: null, zoom: 1, dx: 0, dy: 0 },
    { photo: null, zoom: 1, dx: 0, dy: 0 },
  ],
};

const PANEL_NAMES = ['Hero', 'Panel 2', 'Panel 3'];
const SAMPLES = ['hero', 'sunset', 'car'];

// The preview canvas is a scaled copy of the export size, so one draw
// function serves both. Its longest side is 720 px on screen.
function previewSize() {
  const { w, h } = SIZES[state.size];
  const s = 720 / Math.max(w, h);
  return { w: Math.round(w * s), h: Math.round(h * s) };
}

function redraw() {
  const { w, h } = previewSize();
  if (preview.width !== w || preview.height !== h) {
    preview.width = w;
    preview.height = h;
  }
  pctx.clearRect(0, 0, w, h);
  drawCover(pctx, state, w, h);
  syncPanelRows();
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

async function setPanelPhoto(i, url) {
  state.panels[i].photo = await loadImage(url);
  state.panels[i].zoom = 1;
  state.panels[i].dx = 0;
  state.panels[i].dy = 0;
  state.selected = i;
  redraw();
}

// One row of controls per panel: file picker, sample buttons, zoom slider.
function buildPanelRows() {
  const host = document.getElementById('panels');
  state.panels.forEach((panel, i) => {
    const row = document.createElement('div');
    row.className = 'panel-row';
    row.dataset.index = i;
    row.innerHTML = `
      <div class="panel-head">
        <span class="panel-name">${PANEL_NAMES[i]}</span>
        <span class="panel-tag"></span>
      </div>
      <label class="file-label">Choose photo
        <input type="file" accept="image/*" data-panel="${i}">
      </label>
      <div class="sample-buttons"></div>
      <label class="zoom-label">Zoom
        <input type="range" min="1" max="2.5" step="0.05" value="1" data-zoom="${i}">
      </label>
      <p class="panel-hint">Drag the photo on the preview to move it.</p>`;
    const samples = row.querySelector('.sample-buttons');
    for (const name of SAMPLES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = name;
      b.addEventListener('click', () => {
        setPanelPhoto(i, `samples/${name}.jpg`).catch((e) => {
          status.textContent = e.message;
        });
      });
      samples.appendChild(b);
    }
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.textContent = 'clear';
    clear.addEventListener('click', () => {
      state.panels[i].photo = null;
      state.selected = i;
      redraw();
    });
    samples.appendChild(clear);
    row.querySelector('input[type="file"]').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        state.panels[i].photo = await loadImage(URL.createObjectURL(file));
        state.panels[i].zoom = 1;
        state.panels[i].dx = 0;
        state.panels[i].dy = 0;
        state.selected = i;
        redraw();
      } catch (err) {
        status.textContent = err.message;
      }
    });
    row.querySelector('input[type="range"]').addEventListener('input', (e) => {
      state.panels[i].zoom = Number(e.target.value);
      state.selected = i;
      redraw();
    });
    row.addEventListener('click', () => {
      state.selected = i;
      redraw();
    });
    host.appendChild(row);
  });
}

function syncPanelRows() {
  document.querySelectorAll('.panel-row').forEach((row) => {
    const i = Number(row.dataset.index);
    row.classList.toggle('selected', state.selected === i);
    row.querySelector('.panel-tag').textContent = state.panels[i].photo
      ? 'photo loaded'
      : 'empty';
    row.querySelector('input[type="range"]').value = state.panels[i].zoom;
  });
}

// Drag on the preview pans the photo in the panel under the pointer;
// the wheel zooms it. Pointer coordinates are scaled to cover space.
let drag = null;
preview.addEventListener('pointerdown', (e) => {
  const rect = preview.getBoundingClientRect();
  const { w, h } = previewSize();
  const px = ((e.clientX - rect.left) / rect.width) * w;
  const py = ((e.clientY - rect.top) / rect.height) * h;
  const hit = panelAt(state.size, w, h, px, py);
  if (hit < 0) return;
  state.selected = hit;
  drag = { panel: hit, x: px, y: py };
  preview.setPointerCapture(e.pointerId);
  redraw();
});
preview.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const rect = preview.getBoundingClientRect();
  const { w, h } = previewSize();
  const px = ((e.clientX - rect.left) / rect.width) * w;
  const py = ((e.clientY - rect.top) / rect.height) * h;
  const panel = state.panels[drag.panel];
  const layout = layoutFor(state.size, w, h)[drag.panel];
  panel.dx = clamp(panel.dx + (px - drag.x) / layout.w, -0.5, 0.5);
  panel.dy = clamp(panel.dy + (py - drag.y) / layout.h, -0.5, 0.5);
  drag.x = px;
  drag.y = py;
  redraw();
});
preview.addEventListener('pointerup', () => { drag = null; });
preview.addEventListener('wheel', (e) => {
  e.preventDefault();
  const panel = state.panels[state.selected];
  panel.zoom = clamp(panel.zoom * (e.deltaY < 0 ? 1.08 : 0.93), 1, 2.5);
  redraw();
}, { passive: false });

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

// Caption, position, grade and size controls.
captionInput.addEventListener('input', () => {
  state.caption = captionInput.value;
  redraw();
});
document.getElementById('caption-pos').addEventListener('change', (e) => {
  state.captionPos = e.target.value;
  redraw();
});
const gradeSelect = document.getElementById('grade');
for (const [key, g] of Object.entries(GRADES)) {
  const o = document.createElement('option');
  o.value = key;
  o.textContent = g.label;
  gradeSelect.appendChild(o);
}
gradeSelect.addEventListener('change', (e) => {
  state.grade = e.target.value;
  redraw();
});
const sizeHost = document.getElementById('sizes');
for (const [key, s] of Object.entries(SIZES)) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = s.label;
  b.dataset.size = key;
  b.addEventListener('click', () => {
    state.size = key;
    document.querySelectorAll('#sizes button').forEach((x) => {
      x.classList.toggle('active', x.dataset.size === key);
    });
    redraw();
  });
  sizeHost.appendChild(b);
}

// Export: render the same state at full size on an offscreen canvas.
function renderExport(sizeName) {
  const { w, h } = SIZES[sizeName];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  drawCover(canvas.getContext('2d'), { ...state, size: sizeName }, w, h);
  return canvas;
}

// Test hook used by screenshots: returns the exported PNG as a data URL.
window.__exportDataURL = (sizeName) => new Promise((resolve) => {
  renderExport(sizeName).toBlob((blob) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  }, 'image/png');
});

document.getElementById('export').addEventListener('click', () => {
  const { w, h } = SIZES[state.size];
  renderExport(state.size).toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-cover-${w}x${h}.png`;
    a.click();
    status.textContent = `Saved vice-cover-${w}x${h}.png`;
  }, 'image/png');
});

async function init() {
  buildPanelRows();
  document.querySelector('#sizes button').classList.add('active');
  try {
    await document.fonts.load('80px Anton');
    await document.fonts.ready;
  } catch {
    // The caption falls back to a narrow sans-serif; the cover still draws.
  }
  const query = new URLSearchParams(location.search);
  const shot = query.get('shot');
  if (shot) {
    await runShot(shot, query, state, setPanelPhoto, redraw);
  } else {
    await setPanelPhoto(0, 'samples/hero.jpg').catch(() => {});
    await setPanelPhoto(1, 'samples/sunset.jpg').catch(() => {});
    await setPanelPhoto(2, 'samples/car.jpg').catch(() => {});
    state.selected = 0;
  }
  redraw();
}

init();
