import { TravelGlobe } from './globe.mjs';
import { searchCities } from './cities.mjs';
import { loadPlaces, savePhotos } from './storage.mjs';

const $ = (id) => document.getElementById(id);
const canvas = $('globe');
const stage = $('stage');
const album = $('album');
const upload = $('upload-dialog');
const form = $('upload-form');
const lightbox = $('lightbox');
const recordQuery = $('record-query');
const recordResults = $('record-results');
const cityQuery = $('city-query');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const samples = [
  ['city-kyoto', '京都', '日本', 35.0116, 135.7681, 'kyoto', '东山暮色'],
  ['city-shanghai', '上海', '中国', 31.2304, 121.4737, 'shanghai', '外滩的夜'],
  ['city-reykjavik', '雷克雅未克', '冰岛', 64.1466, -21.9426, 'reykjavik', '北方的光'],
].map(([id, name, region, lat, lon, image, title]) => ({
  id, name, region, lat, lon, demo: true,
  photos: [{ id: image, src: './demo-' + image + '.svg', name: title, note: '旅行插画 · 示例' }],
}));

const places = new Map();
const photoUrls = new Map();
let activePlace = null;
let rotation = !reducedMotion.matches;
let choosingPoint = false;
let point = null;
let selected = null;
let previews = [];
let busy = false;
let toastTimeout;
let lightboxPhotos = [];
let photoIndex = 0;

const globe = new TravelGlobe(canvas, {
  onSelect: (id) => openAlbum(id),
  onPick: (position) => {
    point = position;
    endPicking();
    openUploadDialog();
    showUploadStep('manual');
    $('manual-coords').textContent = formatCoordinates(position);
    $('place-name').focus();
  },
  onInteract: () => setRotation(false),
});

function element(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

function icon(name, className) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  svg.setAttribute('class', className ? 'icon ' + className : 'icon');
  svg.setAttribute('aria-hidden', 'true');
  use.setAttribute('href', '#i-' + name);
  svg.append(use);
  return svg;
}

function photoUrl(photo) {
  if (photo.src) return photo.src;
  if (!photoUrls.has(photo.id)) photoUrls.set(photo.id, URL.createObjectURL(photo.blob));
  return photoUrls.get(photo.id);
}

function photoImage(photo, alt) {
  const image = element('img');
  image.alt = alt;
  image.src = photoUrl(photo);
  image.loading = 'lazy';
  image.decoding = 'async';
  return image;
}

function setRotation(enabled) {
  rotation = enabled;
  globe.setAutoRotate(enabled);
  const toggle = $('toggle-rotation');
  const label = enabled ? '暂停自转' : '开始自转';
  toggle.setAttribute('aria-label', label);
  toggle.title = label;
  toggle.replaceChildren(icon(enabled ? 'pause' : 'play'));
}

function knownPlaces() {
  return [...places.values(), ...samples.filter(({ id }) => !places.has(id))];
}

function placeById(id) {
  return places.get(id) || samples.find((sample) => sample.id === id);
}

function formatCoordinates({ lat, lon }) {
  return (lat < 0 ? '南纬 ' : '北纬 ') + Math.abs(lat).toFixed(3) + '° · ' +
    (lon < 0 ? '西经 ' : '东经 ') + Math.abs(lon).toFixed(3) + '°';
}

function placeOption(place, choose, withPhoto = false) {
  const button = element('button', withPhoto ? 'place-row' : 'city-option');
  button.type = 'button';
  button.dataset.place = place.id;
  button.addEventListener('click', () => choose(place));
  const info = element('span', 'place-copy');
  const name = element('span', 'place-name');
  name.append(element('span', '', place.name));
  if (place.demo) name.append(element('span', 'example', '示例'));
  info.append(name, element('small', '', place.region || formatCoordinates(place)));
  if (withPhoto) {
    const cover = photoImage(place.photos[0], '');
    cover.className = 'place-cover';
    button.append(cover, info, element('span', 'place-count', place.photos.length + ' 张'), icon('next', 'row-arrow'));
    if (place.id === activePlace?.id) button.setAttribute('aria-current', 'true');
  } else {
    button.append(icon('pin'), info);
  }
  return button;
}

function renderPlaces() {
  const all = knownPlaces();
  $('place-total').textContent = places.size;
  $('photo-total').textContent = [...places.values()].reduce((sum, place) => sum + place.photos.length, 0);
  $('place-list-count').textContent = all.length + ' 个地点';
  $('place-list').replaceChildren(...all.map((place) => placeOption(place, ({ id }) => openAlbum(id), true)));
  globe.setPlaces(all.map(({ id, name, lat, lon, photos, demo }) => ({ id, name, lat, lon, count: photos.length, demo })));
}

function setCurrentRow(id) {
  for (const button of $('place-list').children) {
    if (button.dataset.place === id) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  }
}

function openAlbum(id) {
  const place = placeById(id);
  if (!place) return;
  activePlace = place;
  setRotation(false);
  globe.setActive(id);
  globe.focus(place.lat, place.lon);
  setCurrentRow(id);
  recordResults.hidden = true;
  $('album-title').textContent = place.name;
  $('album-meta').replaceChildren(element('span', '', (place.region || formatCoordinates(place)) + ' · ' + place.photos.length + ' 张照片'));
  if (place.demo) $('album-meta').append(element('span', 'example', '示例'));
  $('album-grid').replaceChildren(...place.photos.map((photo, index) => {
    const button = element('button', 'thumbnail');
    button.type = 'button';
    button.setAttribute('aria-label', '查看第 ' + (index + 1) + ' 张照片');
    button.append(photoImage(photo, photo.name || ''));
    button.addEventListener('click', () => openLightbox(place.photos, index));
    return button;
  }));
  album.hidden = false;
  album.scrollTop = 0;
  $('close-album').focus({ preventScroll: true });
}

function closeAlbum(restoreFocus = false) {
  const row = [...$('place-list').children].find((button) => button.dataset.place === activePlace?.id);
  activePlace = null;
  album.hidden = true;
  globe.setActive(null);
  setCurrentRow(null);
  if (restoreFocus) (row || canvas).focus({ preventScroll: true });
}

function renderRecordSearch() {
  const query = recordQuery.value.trim().toLocaleLowerCase();
  const cityMatches = new Set(query ? searchCities(query).map(({ id }) => id) : []);
  const options = knownPlaces().filter(({ id, name, region }) =>
    !query || (name + ' ' + region).toLocaleLowerCase().includes(query) || cityMatches.has(id));
  recordResults.replaceChildren(...options.map((place) => placeOption(place, ({ id, name }) => {
    recordQuery.value = name;
    openAlbum(id);
  })));
  if (!options.length) recordResults.append(element('p', 'empty-results', '没有找到已记录的地点。'));
  recordResults.hidden = false;
}

function renderCitySearch() {
  const query = cityQuery.value.trim().toLocaleLowerCase();
  const matches = searchCities(query);
  const ids = new Set(matches.map(({ id }) => id));
  const local = [...places.values()].filter(({ id, name, region }) =>
    !ids.has(id) && (!query || (name + ' ' + region).toLocaleLowerCase().includes(query)));
  const options = [...local, ...matches].slice(0, 8);
  $('city-results').replaceChildren(...options.map((place) => placeOption(place, selectLocation)));
  if (!options.length && query) $('city-results').append(element('p', 'empty-results', '没有找到这个城市。你可以在地球上手动选点。'));
}

function showUploadStep(step) {
  $('choose-location').hidden = step !== 'search';
  $('manual-location').hidden = step !== 'manual';
  $('chosen-location').hidden = step !== 'photos';
  $('photo-fields').hidden = step !== 'photos';
  $('upload-actions').hidden = step !== 'photos';
  showError('');
}

function selectLocation(place) {
  selected = { id: place.id, name: place.name, region: place.region, lat: place.lat, lon: place.lon };
  const location = element('span', '', place.name);
  location.append(element('small', '', place.region || formatCoordinates(place)));
  const change = element('button', 'button quiet', '更改');
  change.type = 'button';
  change.addEventListener('click', () => {
    selected = null;
    showUploadStep('search');
    renderCitySearch();
    cityQuery.focus();
  });
  $('chosen-location').replaceChildren(icon('pin'), location, change);
  showUploadStep('photos');
  $('save-photos').disabled = !previews.length;
  if (upload.open) $('files').focus({ preventScroll: true });
}

function openUploadDialog() {
  if (!upload.open) upload.showModal();
}

function startUpload(place) {
  setRotation(false);
  clearPreviews();
  form.reset();
  point = null;
  selected = null;
  if (place) selectLocation(place);
  else {
    showUploadStep('search');
    renderCitySearch();
  }
  openUploadDialog();
  (place ? $('files') : cityQuery).focus({ preventScroll: true });
}

function beginPicking() {
  point = null;
  setRotation(false);
  closeAlbum();
  upload.close();
  choosingPoint = true;
  globe.setPicking(true);
  stage.classList.add('is-picking');
  $('picking-banner').hidden = false;
  stage.scrollIntoView({ block: 'nearest', behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  canvas.focus({ preventScroll: true });
}

function endPicking() {
  choosingPoint = false;
  globe.setPicking(false);
  stage.classList.remove('is-picking');
  $('picking-banner').hidden = true;
}

function cancelPicking() {
  endPicking();
  showUploadStep('search');
  openUploadDialog();
  cityQuery.focus();
}

function confirmManualLocation() {
  const name = $('place-name').value.trim();
  if (!name) {
    showError('请为这个地点填写一个名称。');
    $('place-name').focus();
    return;
  }
  if (!point) return;
  const id = 'pin-' + point.lat.toFixed(4) + '_' + point.lon.toFixed(4);
  selectLocation(placeById(id) || { id, name, region: '', ...point });
}

function showError(message) {
  $('upload-error').textContent = message;
  $('upload-error').hidden = !message;
}

function addFiles(files) {
  if (busy) return;
  let unsupported = false;
  for (const file of files) {
    if (!file.size || (!file.type.startsWith('image/') && !(!file.type && /\.(avif|gif|jpe?g|png|webp|bmp|svg)$/i.test(file.name)))) {
      unsupported = true;
      continue;
    }
    previews.push({ file, url: URL.createObjectURL(file) });
  }
  showError(unsupported ? '已跳过无法读取的文件。请选择图片。' : '');
  renderFilePreviews();
}

function clearPreviews() {
  for (const { url } of previews) URL.revokeObjectURL(url);
  previews = [];
  renderFilePreviews();
}

function renderFilePreviews() {
  $('file-preview').replaceChildren(...previews.map(({ file, url }, index) => {
    const tile = element('div', 'file-tile');
    const image = element('img');
    image.src = url;
    image.alt = file.name;
    const remove = element('button', 'icon-button');
    remove.type = 'button';
    remove.setAttribute('aria-label', '移除 ' + file.name);
    remove.append(icon('close'));
    remove.addEventListener('click', () => {
      URL.revokeObjectURL(url);
      previews.splice(index, 1);
      renderFilePreviews();
      showError('');
    });
    tile.append(image, remove);
    return tile;
  }));
  $('save-photos').disabled = busy || !previews.length;
}

function setBusy(value) {
  busy = value;
  for (const node of form.querySelectorAll('input, button')) node.disabled = value;
  $('save-photos').disabled = value || !previews.length;
  $('save-photos').querySelector('span').textContent = value ? '正在保存…' : '保存照片';
}

async function submitPhotos(event) {
  event.preventDefault();
  if (busy || !selected || !previews.length) return;
  const files = previews.map(({ file }) => file);
  const date = $('date').value;
  const note = $('note').value.trim();
  setBusy(true);
  showError('');
  try {
    const checks = await Promise.allSettled(previews.map(({ url }) => {
      const image = new Image();
      image.src = url;
      return image.decode();
    }));
    const unreadable = checks.findIndex(({ status }) => status === 'rejected');
    if (unreadable !== -1) {
      showError('浏览器无法打开「' + files[unreadable].name + '」。请移除这张照片，或换成 JPG、PNG 或 WebP。');
      return;
    }
    const updated = await savePhotos(selected, files, { date, note });
    places.set(updated.id, updated);
    clearPreviews();
    upload.close();
    renderPlaces();
    openAlbum(updated.id);
    toast('已添加 ' + files.length + ' 张照片到「' + updated.name + '」');
  } catch (error) {
    showError(error.name === 'QuotaExceededError'
      ? '浏览器空间不足。请减少照片大小或分批重试。'
      : '照片保存失败。请检查浏览器是否允许此网站使用存储，然后重试。');
    console.error(error);
  } finally {
    setBusy(false);
  }
}

function toast(message) {
  const node = $('toast');
  clearTimeout(toastTimeout);
  node.textContent = message;
  node.hidden = false;
  toastTimeout = setTimeout(() => { node.hidden = true; }, 4200);
}

function renderLightbox() {
  const photo = lightboxPhotos[photoIndex];
  $('large-photo').src = photoUrl(photo);
  $('large-photo').alt = photo.name || '旅行照片';
  $('photo-caption').textContent = [photo.name, photo.date, photo.note, (photoIndex + 1) + ' / ' + lightboxPhotos.length].filter(Boolean).join(' · ');
  $('previous-photo').hidden = lightboxPhotos.length < 2;
  $('next-photo').hidden = lightboxPhotos.length < 2;
}

function openLightbox(photos, index) {
  lightboxPhotos = photos;
  photoIndex = index;
  renderLightbox();
  lightbox.showModal();
  $('close-lightbox').focus();
}

function shiftPhoto(delta) {
  photoIndex = (photoIndex + delta + lightboxPhotos.length) % lightboxPhotos.length;
  renderLightbox();
}

$('add-main').addEventListener('click', () => startUpload());
$('add-to-album').addEventListener('click', () => startUpload(activePlace));
$('close-album').addEventListener('click', () => closeAlbum(true));
$('close-upload').addEventListener('click', () => { if (!busy) upload.close(); });
upload.addEventListener('cancel', (event) => { if (busy) event.preventDefault(); });
form.addEventListener('submit', submitPhotos);
cityQuery.addEventListener('input', renderCitySearch);
cityQuery.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown' || event.key === 'Enter') {
    event.preventDefault();
    const first = $('city-results').querySelector('button');
    if (event.key === 'Enter') first?.click();
    else first?.focus();
  }
});
$('start-picking').addEventListener('click', beginPicking);
$('repick-location').addEventListener('click', beginPicking);
$('cancel-picking').addEventListener('click', cancelPicking);
$('confirm-location').addEventListener('click', confirmManualLocation);
$('place-name').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    confirmManualLocation();
  }
});
$('files').addEventListener('change', (event) => {
  addFiles(event.target.files);
  event.target.value = '';
});
const dropzone = $('dropzone');
dropzone.addEventListener('dragover', (event) => {
  event.preventDefault();
  if (!busy) dropzone.classList.add('dragging');
});
dropzone.addEventListener('dragleave', (event) => {
  if (!dropzone.contains(event.relatedTarget)) dropzone.classList.remove('dragging');
});
dropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropzone.classList.remove('dragging');
  addFiles(event.dataTransfer.files);
});

recordQuery.addEventListener('focus', renderRecordSearch);
recordQuery.addEventListener('click', () => { if (recordResults.hidden) renderRecordSearch(); });
recordQuery.addEventListener('input', renderRecordSearch);
recordQuery.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    recordResults.querySelector('button')?.focus();
  } else if (event.key === 'Enter' && !recordResults.hidden) {
    recordResults.querySelector('button')?.click();
  }
});
document.addEventListener('pointerdown', (event) => {
  if (!event.target.closest('.record-search')) recordResults.hidden = true;
});
document.querySelector('.record-search').addEventListener('focusout', (event) => {
  if (!event.currentTarget.contains(event.relatedTarget)) recordResults.hidden = true;
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || upload.open || lightbox.open) return;
  if (choosingPoint) cancelPicking();
  else if (!recordResults.hidden) recordResults.hidden = true;
  else if (!album.hidden) closeAlbum(true);
});

$('zoom-in').addEventListener('click', () => { setRotation(false); globe.zoom(1.2); });
$('zoom-out').addEventListener('click', () => { setRotation(false); globe.zoom(1 / 1.2); });
$('reset-globe').addEventListener('click', () => { setRotation(false); globe.reset(); });
$('toggle-rotation').addEventListener('click', () => setRotation(!rotation));
reducedMotion.addEventListener('change', ({ matches }) => { if (matches) setRotation(false); });
$('close-lightbox').addEventListener('click', () => lightbox.close());
$('previous-photo').addEventListener('click', () => shiftPhoto(-1));
$('next-photo').addEventListener('click', () => shiftPhoto(1));
lightbox.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') shiftPhoto(-1);
  if (event.key === 'ArrowRight') shiftPhoto(1);
});
lightbox.addEventListener('click', (event) => {
  if (event.target === lightbox) {
    const bounds = lightbox.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) lightbox.close();
  }
});

setRotation(rotation);
renderPlaces();
try {
  for (const place of await loadPlaces()) places.set(place.id, place);
  renderPlaces();
} catch (error) {
  toast('当前浏览器无法读取本地相册。请检查网站存储权限。');
  console.error(error);
}
