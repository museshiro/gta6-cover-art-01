// cover.js — draws a Vice Cover Studio poster onto a canvas.
//
// A poster is three photo frames (one hero, two side frames) plus a bold
// caption across the hero frame, finished with a warm colour grade. The
// same function paints the live preview and the exported PNG, so the two
// always match: preview and export can never drift apart.
//
// A frame's photo is positioned with cover-fit plus a pan/zoom:
//   zoom  — 1 to 2.5, multiplies the cover-fit scale
//   dx, dy — pan, each -1 to 1, as a fraction of the photo's overflow
//            past the frame (0 is centred).

export const SIZES = {
  square: { w: 1080, h: 1080, label: 'Square 1080 x 1080' },
  portrait: { w: 1080, h: 1350, label: 'Portrait 1080 x 1350' },
  wide: { w: 1920, h: 1080, label: 'Wide 1920 x 1080' },
};

// A grade is a vertical wash over the whole poster plus a vignette.
// The wash is drawn on the canvas here and the preview uses this same
// canvas, so the grade you see is the grade you export.
export const GRADES = {
  sunset: {
    stops: [
      [0, 'rgba(255, 190, 90, 0.05)'],
      [0.5, 'rgba(255, 120, 70, 0.08)'],
      [1, 'rgba(255, 70, 120, 0.20)'],
    ],
    warm: 'rgba(255, 150, 60, 0.05)',
  },
  neon: {
    stops: [
      [0, 'rgba(0, 220, 255, 0.06)'],
      [0.5, 'rgba(140, 60, 255, 0.08)'],
      [1, 'rgba(255, 40, 160, 0.22)'],
    ],
    warm: 'rgba(255, 60, 200, 0.04)',
  },
  dusk: {
    stops: [
      [0, 'rgba(60, 40, 120, 0.12)'],
      [0.5, 'rgba(30, 20, 70, 0.16)'],
      [1, 'rgba(8, 8, 40, 0.32)'],
    ],
    warm: 'rgba(90, 60, 160, 0.05)',
  },
};

// Frame rectangles for a poster of width w and height h.
// Square and wide: hero on the left, two side frames stacked on the right.
// Portrait: hero on top, two side frames side by side underneath.
export function frameRects(w, h) {
  const square = w === h;
  const portrait = h > w;
  if (portrait) {
    const heroH = Math.round(h * 0.62);
    return [
      { x: 0, y: 0, w, h: heroH },
      { x: 0, y: heroH, w: Math.round(w / 2), h: h - heroH },
      { x: Math.round(w / 2), y: heroH, w: w - Math.round(w / 2), h: h - heroH },
    ];
  }
  const heroW = Math.round(w * (square ? 0.66 : 0.62));
  return [
    { x: 0, y: 0, w: heroW, h },
    { x: heroW, y: 0, w: w - heroW, h: Math.round(h / 2) },
    { x: heroW, y: Math.round(h / 2), w: w - heroW, h: h - Math.round(h / 2) },
  ];
}

// Draw one photo into its frame with cover-fit, pan and zoom.
// The photo is boosted slightly (saturation + contrast) so the poster
// keeps its punchy sunset look at any size.
function paintPhoto(ctx, img, rect, frame) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (!img) {
    const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    g.addColorStop(0, '#2a1745');
    g.addColorStop(1, '#160a26');
    ctx.fillStyle = g;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = 'rgba(245, 238, 252, 0.55)';
    ctx.font = `600 ${Math.max(14, Math.round(rect.w * 0.045))}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Add a photo', rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.restore();
    return;
  }
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const scale = base * frame.zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const slackX = Math.max(0, (dw - rect.w) / 2);
  const slackY = Math.max(0, (dh - rect.h) / 2);
  const x = rect.x + (rect.w - dw) / 2 + frame.dx * slackX;
  const y = rect.y + (rect.h - dh) / 2 + frame.dy * slackY;
  ctx.filter = 'saturate(1.22) contrast(1.07)';
  ctx.drawImage(img, x, y, dw, dh);
  ctx.restore();
}

// The colour wash + vignette for the chosen grade.
function paintGrade(ctx, w, h, gradeName) {
  const grade = GRADES[gradeName] || GRADES.sunset;
  const wash = ctx.createLinearGradient(0, 0, 0, h);
  for (const [at, colour] of grade.stops) wash.addColorStop(at, colour);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = grade.warm;
  ctx.fillRect(0, 0, w, h);
  const vig = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.35,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  );
  vig.addColorStop(0, 'rgba(5, 0, 20, 0)');
  vig.addColorStop(1, 'rgba(5, 0, 20, 0.28)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

// Thin white poster borders around every frame and the whole poster.
function paintBorders(ctx, w, h, rects) {
  const lw = Math.max(2, Math.round(w / 270));
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.lineWidth = lw;
  for (const r of rects) ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.strokeRect(0, 0, w, h);
}

// Split the caption into lines that fit the hero frame.
function wrapCaption(ctx, text, maxW) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width <= maxW || !line) line = test;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// The caption: Anton, white with a dark outline and a soft shadow,
// over a dark scrim so it stays readable on any photo.
function paintCaption(ctx, hero, text, position) {
  const clean = (text || '').trim();
  if (!clean) return;
  const pad = Math.round(hero.w * 0.045);
  const size = Math.max(24, Math.round(hero.w * 0.115));
  ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const lines = wrapCaption(ctx, clean.toUpperCase(), hero.w - pad * 2);
  const lineH = Math.round(size * 1.04);
  const blockH = lines.length * lineH;
  const top = position === 'top'
    ? hero.y + pad
    : hero.y + hero.h - pad - blockH;
  // Scrim behind the caption band.
  const scrim = ctx.createLinearGradient(0, top - pad * 0.7, 0, top + blockH + pad * 0.7);
  scrim.addColorStop(0, 'rgba(0, 0, 0, 0)');
  scrim.addColorStop(0.5, 'rgba(0, 0, 0, 0.42)');
  scrim.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = scrim;
  ctx.fillRect(hero.x, top - pad * 0.7, hero.w, blockH + pad * 1.4);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = Math.max(3, Math.round(size / 7));
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = Math.round(size * 0.12);
  ctx.shadowOffsetY = Math.round(size * 0.03);
  lines.forEach((line, i) => {
    const y = top + (i + 1) * lineH - Math.round(size * 0.18);
    ctx.strokeText(line, hero.x + pad, y);
    ctx.fillText(line, hero.x + pad, y);
  });
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

// Render the whole poster onto canvas (sized to w x h first).
// state: { size, grade, caption, captionAt, frames: [{img, zoom, dx, dy} x3] }
export function renderCover(canvas, state) {
  const dims = SIZES[state.size] || SIZES.square;
  canvas.width = dims.w;
  canvas.height = dims.h;
  const ctx = canvas.getContext('2d');
  const rects = frameRects(dims.w, dims.h);
  ctx.clearRect(0, 0, dims.w, dims.h);
  rects.forEach((rect, i) => paintPhoto(ctx, state.frames[i].img, rect, state.frames[i]));
  paintGrade(ctx, dims.w, dims.h, state.grade);
  paintBorders(ctx, dims.w, dims.h, rects);
  paintCaption(ctx, rects[0], state.caption, state.captionAt);
  return canvas;
}

// Which frame contains the point (px, py) on a canvas of this size?
export function frameAt(px, py, w, h) {
  const rects = frameRects(w, h);
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) return i;
  }
  return 0;
}
