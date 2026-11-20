// Vice Cover Studio — the cover renderer.
// One function, drawCover, paints the whole poster onto any 2D context at any
// size: a hero panel plus two side panels, each holding its own photo with a
// per-panel zoom and pan, thin poster borders, a sunset/neon colour grade and
// a bold Anton caption. The live preview and the exported PNG both call it,
// so what you see is exactly what you download.

export const SIZES = {
  square: { w: 1080, h: 1080, label: 'Square 1080 x 1080' },
  portrait: { w: 1080, h: 1350, label: 'Portrait 1080 x 1350' },
  wide: { w: 1920, h: 1080, label: 'Wide 1920 x 1080' },
};

export const GRADES = {
  sunset: {
    label: 'Sunset',
    filter: 'saturate(1.28) contrast(1.08)',
    stops: [
      [0.0, 'rgba(255, 170, 60, 0.10)'],
      [0.45, 'rgba(255, 110, 60, 0.00)'],
      [1.0, 'rgba(190, 30, 120, 0.42)'],
    ],
  },
  neon: {
    label: 'Neon',
    filter: 'saturate(1.45) contrast(1.05)',
    stops: [
      [0.0, 'rgba(255, 40, 160, 0.22)'],
      [0.5, 'rgba(120, 40, 200, 0.00)'],
      [1.0, 'rgba(0, 210, 190, 0.28)'],
    ],
  },
  dusk: {
    label: 'Dusk',
    filter: 'saturate(1.15) contrast(1.12)',
    stops: [
      [0.0, 'rgba(60, 40, 160, 0.28)'],
      [0.55, 'rgba(90, 30, 140, 0.05)'],
      [1.0, 'rgba(20, 10, 60, 0.45)'],
    ],
  },
};

// Panel rectangles as fractions of the cover, per size. Panel 0 is the hero.
export function layoutFor(sizeName, w, h) {
  if (sizeName === 'portrait') {
    return [
      { x: 0, y: 0, w, h: h * 0.62 },
      { x: 0, y: h * 0.62, w: w * 0.5, h: h * 0.38 },
      { x: w * 0.5, y: h * 0.62, w: w * 0.5, h: h * 0.38 },
    ];
  }
  // square and wide: hero on the left, two stacked panels on the right.
  const heroW = sizeName === 'wide' ? w * 0.6 : w * 0.62;
  return [
    { x: 0, y: 0, w: heroW, h },
    { x: heroW, y: 0, w: w - heroW, h: h * 0.5 },
    { x: heroW, y: h * 0.5, w: w - heroW, h: h * 0.5 },
  ];
}

// Which panel, if any, holds point (px, py) in a cover of size w x h.
export function panelAt(sizeName, w, h, px, py) {
  const panels = layoutFor(sizeName, w, h);
  for (let i = panels.length - 1; i >= 0; i -= 1) {
    const p = panels[i];
    if (px >= p.x && px < p.x + p.w && py >= p.y && py < p.y + p.h) return i;
  }
  return -1;
}

function drawPhoto(ctx, photo, panel, zoom, dx, dy, filter) {
  const { x, y, w, h } = panel;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (!photo) {
    // Empty panel: a dark placeholder with a diagonal sheen.
    ctx.fillStyle = '#241a33';
    ctx.fillRect(x, y, w, h);
    const sheen = ctx.createLinearGradient(x, y, x + w, y + h);
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0.10)');
    sheen.addColorStop(0.5, 'rgba(255, 255, 255, 0.00)');
    sheen.addColorStop(1, 'rgba(255, 255, 255, 0.06)');
    ctx.fillStyle = sheen;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
    return;
  }
  const base = Math.max(w / photo.naturalWidth, h / photo.naturalHeight);
  const scale = base * zoom;
  const pw = photo.naturalWidth * scale;
  const ph = photo.naturalHeight * scale;
  const cx = x + w / 2 + dx * w;
  const cy = y + h / 2 + dy * h;
  ctx.filter = filter;
  ctx.drawImage(photo, cx - pw / 2, cy - ph / 2, pw, ph);
  ctx.filter = 'none';
  ctx.restore();
}

function drawGrade(ctx, grade, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  for (const [stop, color] of grade.stops) g.addColorStop(stop, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawCaption(ctx, text, hero, w, h, position) {
  const words = text.trim().toUpperCase();
  if (!words) return;
  let size = Math.min(hero.w * 0.16, w * 0.11);
  ctx.font = `${size}px Anton, "Arial Narrow", sans-serif`;
  while (ctx.measureText(words).width > hero.w * 0.92 && size > 14) {
    size -= 2;
    ctx.font = `${size}px Anton, "Arial Narrow", sans-serif`;
  }
  const cx = hero.x + hero.w / 2;
  const cy = position === 'top'
    ? hero.y + size * 1.15
    : hero.y + hero.h - size * 0.55;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(4, size / 9);
  ctx.strokeStyle = 'rgba(10, 5, 20, 0.9)';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = size * 0.16;
  ctx.shadowOffsetY = size * 0.05;
  ctx.strokeText(words, cx, cy);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(words, cx, cy);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

// state: { size, caption, captionPos, grade, panels: [{ photo, zoom, dx, dy }] }
export function drawCover(ctx, state, w, h) {
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  const panels = layoutFor(state.size, w, h);
  const gap = Math.max(3, Math.round(w / 180));
  ctx.fillStyle = '#0d0a14';
  ctx.fillRect(0, 0, w, h);
  state.panels.forEach((panel, i) => {
    const r = panels[i];
    const inset = {
      x: r.x + gap / 2,
      y: r.y + gap / 2,
      w: r.w - gap,
      h: r.h - gap,
    };
    drawPhoto(ctx, panel.photo, inset, panel.zoom, panel.dx, panel.dy, grade.filter);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = Math.max(2, gap / 2);
    ctx.strokeRect(inset.x, inset.y, inset.w, inset.h);
  });
  drawGrade(ctx, grade, w, h);
  drawCaption(ctx, state.caption, panels[0], w, h, state.captionPos);
}
