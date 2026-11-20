// Vice Cover Studio — poster renderer (ES module).
// One function draws the whole poster; the live preview and the PNG
// export both call it, so what you see is exactly what you get.

export const SIZES = {
  square: { w: 1080, h: 1080, label: 'Square · 1080 × 1080' },
  portrait: { w: 1080, h: 1350, label: 'Portrait · 1080 × 1350' },
  wide: { w: 1920, h: 1080, label: 'Wide · 1920 × 1080' },
};

export const GRADES = {
  sunset: { label: 'Sunset', wash: ['rgba(255,140,40,0.20)', 'rgba(255,60,120,0.16)'] },
  neon: { label: 'Neon', wash: ['rgba(255,0,180,0.22)', 'rgba(80,0,255,0.20)'] },
  dusk: { label: 'Dusk', wash: ['rgba(20,30,90,0.28)', 'rgba(120,40,160,0.18)'] },
};

// Frame rectangles, in fractions of the poster, for each poster shape.
// Square and wide: big hero on the left, two stacked frames on the right.
// Portrait: big hero on top, two frames side by side below it.
export function layoutFrames(size) {
  if (size === 'portrait') {
    return [
      { x: 0, y: 0, w: 1, h: 0.62 },
      { x: 0, y: 0.62, w: 0.5, h: 0.38 },
      { x: 0.5, y: 0.62, w: 0.5, h: 0.38 },
    ];
  }
  return [
    { x: 0, y: 0, w: 0.62, h: 1 },
    { x: 0.62, y: 0, w: 0.38, h: 0.5 },
    { x: 0.62, y: 0.5, w: 0.38, h: 0.5 },
  ];
}

// Paint one photo into a frame with cover-fit, zoom and pan.
// panX / panY are -1..1 and shift the photo within its overflow.
function paintPhoto(ctx, img, fx, fy, fw, fh, zoom, panX, panY) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const s = Math.max(fw / iw, fh / ih) * zoom;
  const dw = iw * s;
  const dh = ih * s;
  const ox = Math.max(0, (dw - fw) / 2);
  const oy = Math.max(0, (dh - fh) / 2);
  const dx = fx + (fw - dw) / 2 - panX * ox;
  const dy = fy + (fh - dh) / 2 - panY * oy;
  ctx.save();
  ctx.beginPath();
  ctx.rect(fx, fy, fw, fh);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

// A colour wash + vignette that gives the poster its grade.
function paintGrade(ctx, grade, W, H) {
  const g = GRADES[grade] || GRADES.sunset;
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, g.wash[0]);
  grad.addColorStop(1, g.wash[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  const vig = ctx.createRadialGradient(
    W / 2, H / 2, Math.min(W, H) * 0.35,
    W / 2, H / 2, Math.max(W, H) * 0.75,
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
}

// Split a caption into lines that fit maxW at the given font.
function wrapLines(ctx, text, maxW) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const word of words) {
    const test = cur ? cur + ' ' + word : word;
    if (ctx.measureText(test).width <= maxW || !cur) {
      cur = test;
    } else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

// Draw the caption in Anton with a dark scrim, outline and shadow.
function paintCaption(ctx, text, pos, W, H) {
  const clean = String(text || '').trim();
  if (!clean) return;
  const size = Math.round(H * 0.082);
  ctx.font = `${size}px Anton, Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const padX = Math.round(W * 0.05);
  const lines = wrapLines(ctx, clean.toUpperCase(), W - padX * 2);
  const lineH = size * 1.08;
  const blockH = lines.length * lineH + size * 0.5;
  const top = pos === 'top'
    ? Math.round(H * 0.03)
    : H - Math.round(H * 0.03) - blockH;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, top, W, blockH);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0,0,0,0.9)';
  ctx.lineWidth = Math.max(2, size / 14);
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = size / 6;
  ctx.shadowOffsetY = size / 14;
  lines.forEach((line, i) => {
    const y = top + size * 0.25 + lineH * (i + 0.5);
    ctx.strokeText(line, W / 2, y);
    ctx.fillText(line, W / 2, y);
  });
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

// Draw the full poster onto ctx at W x H from a poster state:
// { size, grade, caption, captionPos, frames: [{img, zoom, panX, panY}] }
export function renderPoster(ctx, poster, W, H) {
  const gutter = Math.max(4, Math.round(Math.min(W, H) * 0.008));
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  const rects = layoutFrames(poster.size);
  poster.frames.forEach((frame, i) => {
    const r = rects[i];
    const fx = r.x * W + gutter;
    const fy = r.y * H + gutter;
    const fw = r.w * W - gutter * 2;
    const fh = r.h * H - gutter * 2;
    if (frame.img) {
      paintPhoto(ctx, frame.img, fx, fy, fw, fh, frame.zoom || 1, frame.panX || 0, frame.panY || 0);
    } else {
      ctx.fillStyle = '#2a1a2e';
      ctx.fillRect(fx, fy, fw, fh);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = `${Math.round(Math.min(fw, fh) * 0.07)}px Anton, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ADD A PHOTO', fx + fw / 2, fy + fh / 2);
    }
  });
  paintGrade(ctx, poster.grade, W, H);
  paintCaption(ctx, poster.caption, poster.captionPos, W, H);
}

// Render a poster to a fresh canvas at the given pixel size.
export function posterCanvas(poster, W, H) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  renderPoster(c.getContext('2d'), poster, W, H);
  return c;
}
