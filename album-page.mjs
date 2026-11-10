import { buildAlbums } from './albums.mjs';
import { albumPlaces, photoImage, photoNote, photoUrl } from './album-library.mjs';
import { mapHref, readAlbumContext, returnToken } from './album-navigation.mjs';
import { openPhotoEditor } from './photo-editor.mjs';
import { loadPhotoEdits, loadPlaces, savePhotoEdit } from './storage.mjs';

const $ = (id) => document.getElementById(id);
const viewer = $('album-viewer');
const frame = $('viewer-frame');
const back = $('album-back');
const token = returnToken();
const context = readAlbumContext(token);
const id = new URLSearchParams(location.search).get('id');
let album;
let photos = [];
let index = 0;
let gesture = null;
let toastTimer;

back.href = mapHref(context ? token : null);
$('album-back-label').textContent = context?.view === 'journey' ? '返回旅程' : '返回地图';

function status(message) {
  $('album-status').textContent = message;
  $('album-status').hidden = !message;
}

function creditLine({ name, credit }) {
  const line = document.createElement('p');
  line.textContent = [name, credit.author].filter(Boolean).join(' · ');
  for (const [label, url] of [['照片来源', credit.source], [credit.license, credit.licenseUrl], [credit.changes]]) {
    if (!label) continue;
    const value = document.createElement(url ? 'a' : 'span');
    if (url) {
      value.href = url;
      value.target = '_blank';
      value.rel = 'noopener';
    }
    value.textContent = label;
    line.append(' · ', value);
  }
  return line;
}

function paintCollection() {
  $('album-page-cover').replaceChildren(photoImage(photos[0]));
  $('album-page-grid').replaceChildren(...photos.map((photo, photoIndex) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'album-photo';
    const name = photo.name || '旅行照片';
    card.setAttribute('aria-label', '查看 ' + name);
    const copy = document.createElement('span');
    copy.className = 'album-photo-copy';
    copy.textContent = name;
    if (photo.date || photo.edit) {
      const details = document.createElement('small');
      details.textContent = [photo.date, photo.edit ? '已编辑' : ''].filter(Boolean).join(' · ');
      copy.append(details);
    }
    card.append(photoImage(photo), copy);
    card.addEventListener('click', () => openViewer(photoIndex));
    return card;
  }));
}

function paintViewer() {
  const photo = photos[index];
  const image = $('viewer-image');
  image.src = photoUrl(photo);
  image.alt = photo.name || '旅行照片';
  $('viewer-count').textContent = (index + 1) + ' / ' + photos.length;
  $('viewer-caption').textContent = [photo.name, photo.date].filter(Boolean).join(' · ');
  $('viewer-note').textContent = photoNote(photo);
  $('viewer-note').hidden = !photoNote(photo);
  $('viewer-credit').hidden = !photo.credit;
  $('viewer-credit').replaceChildren(...(photo.credit ? [creditLine(photo)] : []));
  $('viewer-edited').hidden = !photo.edit;
  $('viewer-prev').hidden = photos.length < 2;
  $('viewer-next').hidden = photos.length < 2;
}

function openViewer(photoIndex) {
  index = photoIndex;
  paintViewer();
  viewer.showModal();
  $('viewer-close').focus();
}

function step(direction) {
  if (photos.length < 2) return;
  index = (index + direction + photos.length) % photos.length;
  paintViewer();
}

async function applyEdit(photoIndex, edit) {
  const original = photos[photoIndex];
  await savePhotoEdit(original.id, edit);
  const updated = { ...original };
  if (edit === null) delete updated.edit;
  else updated.edit = edit;
  photos[photoIndex] = updated;
  paintCollection();
  paintViewer();
  const toast = $('album-toast');
  toast.textContent = edit === null ? '已恢复原图和原备注' : '已保存编辑';
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3600);
}

$('album-page-cover').addEventListener('click', () => openViewer(0));
$('viewer-close').addEventListener('click', () => viewer.close());
$('viewer-prev').addEventListener('click', () => step(-1));
$('viewer-next').addEventListener('click', () => step(1));
$('edit-photo').addEventListener('click', () => {
  const photoIndex = index;
  openPhotoEditor(photos[photoIndex], { onSave: (edit) => applyEdit(photoIndex, edit) });
});
viewer.addEventListener('close', () => $('album-page-grid').children[index]?.focus({ preventScroll: true }));
viewer.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  step(event.key === 'ArrowLeft' ? -1 : 1);
});
frame.addEventListener('pointerdown', (event) => {
  if (event.pointerType !== 'touch' || event.target.closest('button')) return;
  gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
  frame.setPointerCapture(event.pointerId);
});
frame.addEventListener('pointerup', (event) => {
  if (gesture?.id !== event.pointerId) return;
  const dx = event.clientX - gesture.x;
  const dy = event.clientY - gesture.y;
  gesture = null;
  if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.3) step(dx < 0 ? 1 : -1);
});
frame.addEventListener('pointercancel', () => { gesture = null; });

let saved = [];
let edits = new Map();
let storageError = false;
try {
  [saved, edits] = await Promise.all([loadPlaces(), loadPhotoEdits()]);
} catch {
  storageError = true;
}
album = buildAlbums(albumPlaces(new Map(saved.map((place) => [place.id, place])), edits)).get(id);
if (album) {
  photos = [...album.photos];
  document.title = album.name + ' · 贝Ki-Map';
  $('album-page-title').textContent = album.name;
  $('album-page-meta').textContent = [album.region, photos.length + ' 张照片'].filter(Boolean).join(' · ');
  $('album-example').hidden = !album.demo;
  $('album-hero').hidden = false;
  $('album-collection').hidden = false;
  paintCollection();
  const credits = photos.filter(({ credit }) => credit).map(creditLine);
  $('album-credits').replaceChildren(...credits);
  $('album-credits').hidden = !credits.length;
  status(storageError ? '当前浏览器无法访问本地存储。请检查站点权限或关闭其他贝Ki-Map 标签页。' : '');
} else {
  status(storageError ? '无法读取本地影集。请检查浏览器存储权限。' : '当前浏览器中找不到这本影集。请从地图或旅程选择一个地点。');
}
