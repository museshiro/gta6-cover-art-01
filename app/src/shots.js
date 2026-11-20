// Vice Cover Studio — screenshot mode (ES module).
// ?shot=cover shows one exported cover filling the viewport.
// ?shot=editor shows the editor with a photo loaded.
// Both set window.__shotReady once fonts and photos have painted,
// so a screenshot tool knows when the scene is ready.

import { SIZES, renderPoster } from './cover.js';

const SHOT_SAMPLES = ['samples/hero.jpg', 'samples/sunset.jpg', 'samples/car.jpg'];

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function ready() {
  window.__shotReady = true;
  document.body.classList.add('shot-ready');
}

async function paintCoverShot() {
  document.body.classList.add('shot-mode');
  const canvas = document.getElementById('stage');
  const params = new URLSearchParams(location.search);
  const size = SIZES[params.get('size')] ? params.get('size') : 'square';
  const grade = params.get('grade') || 'sunset';
  const caption = params.get('caption') || 'VICE CITY NIGHTS';
  const captionPos = params.get('pos') === 'top' ? 'top' : 'bottom';
  const dims = SIZES[size];
  canvas.width = dims.w;
  canvas.height = dims.h;
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.objectFit = 'contain';
  const frames = [];
  for (let i = 0; i < 3; i++) {
    try {
      frames.push({ img: await loadImage(SHOT_SAMPLES[i]), zoom: 1, panX: 0, panY: 0 });
    } catch {
      frames.push({ img: null, zoom: 1, panX: 0, panY: 0 });
    }
  }
  const poster = { size, grade, caption, captionPos, frames };
  await document.fonts.load('64px Anton').catch(() => {});
  renderPoster(canvas.getContext('2d'), poster, dims.w, dims.h);
  await new Promise((r) => requestAnimationFrame(r));
  ready();
}

async function paintEditorShot() {
  // The normal editor boots in main.js; here we wait for it to have a
  // photo, load samples into the other two frames so the editor shows
  // a full poster, then signal readiness.
  const stage = document.getElementById('stage');
  const status = document.getElementById('status');
  const started = Date.now();
  while (Date.now() - started < 15000) {
    await new Promise((r) => setTimeout(r, 200));
    if (stage.width > 0 && /photo loaded/.test(status.textContent || '')) break;
  }
  const second = document.querySelector('[data-frame="1"] [data-sample="samples/sunset.jpg"]');
  const third = document.querySelector('[data-frame="2"] [data-sample="samples/car.jpg"]');
  if (second) second.click();
  if (third) third.click();
  const loadedAt = Date.now();
  while (Date.now() - loadedAt < 10000) {
    await new Promise((r) => setTimeout(r, 200));
    if (((status.textContent || '').match(/photo loaded/g) || []).length >= 3) break;
  }
  await document.fonts.ready.catch(() => {});
  await new Promise((r) => requestAnimationFrame(r));
  ready();
}

const mode = new URLSearchParams(location.search).get('shot');
if (mode === 'cover') {
  // Tell the editor (main.js, loaded after this module) to stay out:
  // the cover shot owns the canvas.
  window.__coverShot = true;
  paintCoverShot();
} else if (mode === 'editor') {
  paintEditorShot();
}
