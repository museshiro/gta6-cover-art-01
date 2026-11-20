// shots.js — screenshot scenes for the maker.
//
//   ?shot=cover&photo=<hero|sunset|car>&caption=<text>&size=<square|portrait|wide>&grade=<sunset|neon|dusk>
//       renders the cover alone, filling the viewport.
//   ?shot=editor&photo=<hero|sunset|car>&caption=<text>
//       shows the editor with that photo loaded and the caption filled in.
// Both set window.__shotReady once the cover is painted, so a screenshot
// script can wait for it instead of guessing a delay.

import { SIZES, renderCover } from './cover.js';

const SAMPLES = {
  hero: 'samples/hero.jpg',
  sunset: 'samples/sunset.jpg',
  car: 'samples/car.jpg',
};

const OTHERS = {
  hero: ['sunset', 'car'],
  sunset: ['car', 'hero'],
  car: ['hero', 'sunset'],
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('could not load ' + src));
    img.src = src;
  });
}

async function readyFonts() {
  try {
    await document.fonts.load('80px Anton');
    await document.fonts.ready;
  } catch {
    // System sans fallback; the scene still paints.
  }
}

function markReady() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.__shotReady = true;
    });
  });
}

// Cover scene: hide the editor chrome, paint the poster at the chosen
// size, and scale it to fill the viewport without changing its aspect.
async function coverScene(params) {
  const photo = SAMPLES[params.get('photo')] ? params.get('photo') : 'hero';
  const caption = params.get('caption') || 'VICE CITY NIGHTS';
  const size = SIZES[params.get('size')] ? params.get('size') : 'square';
  const grade = params.get('grade') || 'sunset';
  document.body.classList.add('shot-cover');
  const stage = document.querySelector('.stage');
  stage.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.id = 'shot-canvas';
  stage.appendChild(canvas);
  await readyFonts();
  const names = [photo, ...OTHERS[photo]];
  const frames = [];
  for (const name of names) {
    try {
      frames.push({ img: await loadImage(SAMPLES[name]), zoom: 1, dx: 0, dy: 0 });
    } catch {
      frames.push({ img: null, zoom: 1, dx: 0, dy: 0 });
    }
  }
  renderCover(canvas, {
    size, grade, caption, captionAt: 'bottom', frames,
  });
  const dims = SIZES[size];
  const fit = Math.min(window.innerWidth / dims.w, window.innerHeight / dims.h);
  canvas.style.width = `${Math.round(dims.w * fit)}px`;
  canvas.style.height = `${Math.round(dims.h * fit)}px`;
  markReady();
}

// Editor scene: run the normal editor, then swap the hero photo and the
// caption to the requested ones and repaint.
async function editorScene(params) {
  const photo = SAMPLES[params.get('photo')] ? params.get('photo') : 'hero';
  const caption = params.get('caption');
  // The editor module boots itself; wait for it, then override.
  const wait = setInterval(() => {
    if (!window.__editorReady) return;
    clearInterval(wait);
    if (caption !== null) {
      const input = document.getElementById('caption-input');
      input.value = caption;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const btn = document.querySelector(`[data-sample="${photo}"][data-frame="0"]`);
    if (btn) btn.click();
    markReady();
  }, 50);
}

const params = new URLSearchParams(window.location.search);
if (params.get('shot') === 'cover') coverScene(params);
else if (params.get('shot') === 'editor') editorScene(params);
