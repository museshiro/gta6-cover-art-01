// Fixed scenes for screenshots: ?shot=editor shows the editor with photos
// loaded; ?shot=cover shows the cover alone at its export size. `photo`
// picks the hero sample (samples/<photo>.jpg), `caption` the words, `size`
// the export size (square, portrait or wide) and `grade` the colour grade.
// window.__shotReady is set once the cover is painted.
export async function runShot(shot, query, state, setPanelPhoto, redraw) {
  const photo = query.get('photo') ?? 'hero';
  const caption = query.get('caption') ?? 'VICE CITY NIGHTS';
  const size = query.get('size') ?? 'square';
  const grade = query.get('grade') ?? 'sunset';
  const captionPos = query.get('captionPos') ?? 'bottom';

  state.caption = caption;
  state.captionPos = captionPos;
  if (['square', 'portrait', 'wide'].includes(size)) state.size = size;
  if (['sunset', 'neon', 'dusk'].includes(grade)) state.grade = grade;
  const captionInput = document.getElementById('caption');
  if (captionInput) captionInput.value = caption;
  const gradeSelect = document.getElementById('grade');
  if (gradeSelect) gradeSelect.value = state.grade;
  const posSelect = document.getElementById('caption-pos');
  if (posSelect) posSelect.value = state.captionPos;
  document.querySelectorAll('#sizes button').forEach((b) => {
    b.classList.toggle('active', b.dataset.size === state.size);
  });

  if (shot === 'cover') document.body.classList.add('shot-cover');
  await setPanelPhoto(0, `samples/${photo}.jpg`);
  await setPanelPhoto(1, 'samples/sunset.jpg');
  await setPanelPhoto(2, 'samples/car.jpg');
  state.selected = 0;
  redraw();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
  }));
}
