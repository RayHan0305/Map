import { DETAIL_ZOOM, TravelGlobe } from './globe.mjs';
import { nearestCity, searchCities } from './cities.mjs';
import { loadPlaces, savePhotos } from './storage.mjs';
import { parseCoordinates, searchGlobalPlaces } from './geocoder.mjs';
import { StreetMap } from './street-map.mjs';
import { showIntro } from './intro.mjs';
import { buildAlbums } from './albums.mjs';
import { readPhotoCoordinates } from './photo-gps.mjs';
import { findCountry, searchCountries } from './countries.mjs';
import { buildJourney } from './journey.mjs';

showIntro();

const $ = (id) => document.getElementById(id);
const canvas = $('globe');
const stage = $('stage');
const album = $('album');
const countryPanel = $('country-panel');
const upload = $('upload-dialog');
const form = $('upload-form');
const lightbox = $('lightbox');
const recordQuery = $('record-query');
const recordResults = $('record-results');
const cityQuery = $('city-query');
const streetDialog = $('street-dialog');
const streetCoordinates = $('street-coords');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const samples = [
  ['city-kyoto', '京都', '日本', 35.0116, 135.7681, 'kyoto', '东山暮色', '2025-04-12', { lat: 34.99486, lon: 135.78505, label: '清水寺附近' }],
  ['city-shanghai', '上海', '中国', 31.2304, 121.4737, 'shanghai', '外滩的夜', '2025-08-23', { lat: 31.24011, lon: 121.49009, label: '外滩' }],
  ['city-reykjavik', '雷克雅未克', '冰岛', 64.1466, -21.9426, 'reykjavik', '北方的光', '2026-02-18', { lat: 64.15529, lon: -21.97599, label: '海湾附近' }],
].map(([id, name, region, lat, lon, image, title, date, location]) => ({
  id, name, region, lat, lon, demo: true,
  photos: [{ id: image, src: './demo-' + image + '.svg', name: title, date, note: '旅行插画 · 示例', location }],
}));

const places = new Map();
const photoUrls = new Map();
let albums = new Map();
let albumCountries = new Map();
let activeCountry = null;
let currentView = 'map';
let journeySelection = null;
let focusedAlbumId = null;
let activePoint = null;
let activePlace = null;
let rotation = !reducedMotion.matches;
let choosingPoint = null;
let streetMode = 'browse';
let point = null;
let selected = null;
let editingPhoto = null;
let defaultPhotoLocation = null;
let previews = [];
let busy = false;
let toastTimeout;
let lightboxPhotos = [];
let photoIndex = 0;

const globe = new TravelGlobe(canvas, {
  findCountry,
  onCountry: (country) => showCountry(country),
  onStreetZoom: (location) => openStreetMap('browse', null, location),
  onSelect: (id) => openAlbum(id),
  onPick: (position) => {
    const mode = choosingPoint;
    endPicking();
    choosePoint(position, mode);
  },
  onInteract: () => setRotation(false),
});

const streetMap = new StreetMap($('street-map'), {
  onMove: setStreetCoordinates,
  onStatus: (message) => {
    $('street-status').textContent = message;
    $('street-status').hidden = !message;
  },
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
  return (lat < 0 ? '南纬 ' : '北纬 ') + Math.abs(lat).toFixed(5) + '° · ' +
    (lon < 0 ? '西经 ' : '东经 ') + Math.abs(lon).toFixed(5) + '°';
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
    button.append(icon(place.isCountry ? 'map' : 'pin'), info);
  }
  return button;
}

function renderPlaces() {
  albums = buildAlbums(knownPlaces());
  const all = [...albums.values()];
  albumCountries = new Map(all.map((place) => [place.id, countryFor(place)]));
  $('place-total').textContent = all.filter(({ demo }) => !demo).length;
  $('photo-total').textContent = [...places.values()].reduce((sum, place) => sum + place.photos.length, 0);
  $('place-list-count').textContent = all.length + ' 个地点';
  $('place-list').replaceChildren(...all.map((place) => placeOption(place, ({ id }) => openAlbum(id), true)));
  renderMarkers();
  if (!countryPanel.hidden && activeCountry) renderCountry();
  if (currentView === 'journey') renderJourney();
}

function countryFor(place) {
  return findCountry(place.lat, place.lon) ?? searchCountries(place.region ?? '').find(({ name }) => name === place.region);
}

function renderMapPath() {
  const city = albums.get(focusedAlbumId) ?? activePlace;
  $('map-path').hidden = !activeCountry && !city;
  $('map-country').hidden = !activeCountry;
  $('map-country').textContent = activeCountry?.name ?? '';
  $('map-city').hidden = !city;
  $('map-city').textContent = city?.name ?? '';
  $('map-point').hidden = !activePoint;
  $('map-point').textContent = activePoint?.name ?? '';
}

function renderCountry() {
  const cities = [...albums.values()].filter(({ id }) => albumCountries.get(id)?.id === activeCountry.id);
  $('country-title').textContent = activeCountry.name;
  $('country-meta').textContent = cities.length ? cities.length + ' 个已记录地点' : '从地图上选择拍摄地点';
  $('country-cities').replaceChildren(...(cities.length
    ? cities.map((place) => placeOption(place, ({ id }) => openAlbum(id), true))
    : [element('p', 'country-empty', '在这里添加一张照片，开始记录旅行足迹。')]));
}

function showCountry(country) {
  if (!country) return;
  if (choosingPoint) endPicking();
  setView('map');
  activeCountry = country;
  focusedAlbumId = null;
  closeAlbum();
  setRotation(false);
  globe.focus(country.lat, country.lon, { scale: 1.24 });
  recordResults.hidden = true;
  renderCountry();
  countryPanel.hidden = false;
  countryPanel.scrollTop = 0;
  $('close-country').focus({ preventScroll: true });
}

function resetOverview() {
  activeCountry = null;
  focusedAlbumId = null;
  countryPanel.hidden = true;
  closeAlbum();
  setRotation(false);
  globe.reset();
}

function renderMarkers() {
  const pins = [...albums.values()].map(({ id, name, lat, lon, photos, demo }) => ({ id, name, lat, lon, count: photos.length, demo }));
  const points = albums.get(focusedAlbumId)?.points ?? [];
  for (const { id, name, lat, lon, count } of points) pins.push({ id, name, lat, lon, count, detail: true });
  if (activePlace?.draft) pins.push({ ...activePlace, count: 0 });
  globe.setPlaces(pins);
}

function setCurrentRow(id) {
  for (const button of $('place-list').children) {
    if (button.dataset.place === id) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  }
}

function openAlbum(id) {
  const focused = albums.get(focusedAlbumId);
  const detail = focused?.points.find((entry) => entry.id === id);
  if (detail) {
    showPlace(focused, detail);
    return;
  }
  const place = placeById(id);
  const result = albums.get(id) ?? albums.get(place?.city?.id);
  if (result) {
    const detail = place?.city ? result.points.find((entry) => entry.photos.some((photo) => photo.placeId === id)) : null;
    showPlace(result, detail);
  }
}

function showPlace(place, detail = null, keepCamera = false) {
  if (choosingPoint) endPicking();
  setView('map');
  countryPanel.hidden = true;
  activePlace = place;
  const { id, draft } = place;
  focusedAlbumId = draft ? null : id;
  activePoint = detail;
  activeCountry = albumCountries.get(id) ?? countryFor(place);
  renderMapPath();
  setRotation(false);
  renderMarkers();
  globe.setActive(detail?.id ?? id);
  if (detail) globe.focus(detail.lat, detail.lon, { scale: Math.max(DETAIL_ZOOM + .15, globe.getZoom()) });
  else if (!keepCamera) globe.focus(place.lat, place.lon, { scale: 1.55 });
  setCurrentRow(id);
  recordResults.hidden = true;
  $('album-title').textContent = place.name;
  const allPhotos = place.photos ?? [];
  const photos = detail?.photos ?? allPhotos;
  const details = [place.region, draft ? '待添加照片' : allPhotos.length + ' 张照片'].filter(Boolean);
  $('album-meta').replaceChildren(element('span', '', details.join(' · ')));
  $('album-coords').textContent = formatCoordinates(detail ?? place);
  $('album-point-name').textContent = detail?.name ?? '';
  $('album-point-name').hidden = !detail;
  $('show-album-points').hidden = draft || !place.points?.length || Boolean(detail);
  $('show-album-points').querySelector('span').textContent = '查看 ' + (place.points?.length ?? 0) + ' 个拍摄点';
  $('show-all-photos').hidden = !detail;
  $('show-album-in-journey').hidden = draft;
  $('refine-place').hidden = !draft;
  if (place.demo) $('album-meta').append(element('span', 'example', '示例'));
  const cover = $('album-cover');
  cover.hidden = !photos.length;
  cover.replaceChildren(...(photos.length ? [photoImage(photos[0], '')] : []));
  cover.onclick = photos.length ? () => openLightbox(photos, 0) : null;
  $('album-grid').replaceChildren(...photos.map((photo, index) => {
    const button = element('button', 'thumbnail');
    button.type = 'button';
    button.setAttribute('aria-label', '查看第 ' + (index + 1) + ' 张照片');
    button.append(photoImage(photo, photo.name || ''));
    button.addEventListener('click', () => openLightbox(photos, index));
    return button;
  }));
  album.hidden = false;
  album.scrollTop = 0;
  $('close-album').focus({ preventScroll: true });
}

function closeAlbum(restoreFocus = false) {
  const row = [...$('place-list').children].find((button) => button.dataset.place === activePlace?.id);
  activePlace = null;
  activePoint = null;
  album.hidden = true;
  globe.setActive(null);
  renderMarkers();
  renderMapPath();
  setCurrentRow(null);
  if (restoreFocus) (row || canvas).focus({ preventScroll: true });
}

function localMatches(query, includeCountries = false) {
  const cities = searchCities(query);
  const ids = new Set(cities.map(({ id }) => id));
  const recorded = [...albums.values(), ...knownPlaces()].filter(({ id, name, region }) =>
    !query || (name + ' ' + region).toLocaleLowerCase().includes(query) || ids.has(id));
  const countries = includeCountries && query ? searchCountries(query).map((country) => ({ ...country, isCountry: true })) : [];
  return uniquePlaces([...countries, ...recorded, ...cities]).slice(0, 8);
}

function setView(view, selection = null) {
  if (currentView !== view) {
    currentView = view;
    $('map-view').hidden = view !== 'map';
    $('journey-view').hidden = view !== 'journey';
    for (const name of ['map', 'journey']) {
      const tab = $('tab-' + name);
      if (name === view) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    }
    window.scrollTo(0, 0);
  }
  if (view === 'journey') {
    if (choosingPoint) endPicking();
    setRotation(false);
    journeySelection = selection;
    renderJourney();
  }
}

function openJourneyPhoto(entry) {
  const city = albums.get(entry.albumId);
  if (!city) return;
  const detail = city.points.find(({ id }) => id === entry.pointId);
  showPlace(city, detail);
}

function renderJourney() {
  const days = buildJourney(albums);
  const count = days.reduce((sum, day) => sum + day.entries.length, 0);
  $('journey-count').textContent = days.length + ' 个日期分组 · ' + count + ' 张照片';
  let target = null;
  const groups = days.map(({ date, entries }) => {
    const day = element('section', 'journey-day');
    const label = element(date ? 'time' : 'span', '', date || '日期未填写');
    if (date) label.dateTime = date;
    const heading = element('h2');
    heading.append(label);
    const cities = new Map();
    for (const entry of entries) {
      if (!cities.has(entry.albumId)) cities.set(entry.albumId, []);
      cities.get(entry.albumId).push(entry);
    }
    const list = element('div', 'journey-cities');
    for (const [albumId, photos] of cities) {
      const city = albums.get(albumId);
      if (!city) continue;
      const card = element('article', 'journey-city');
      card.dataset.album = albumId;
      card.tabIndex = -1;
      if (journeySelection?.albumId === albumId) {
        card.setAttribute('aria-current', 'true');
        target ??= card;
      }
      const head = element('div', 'journey-city-top');
      const title = element('div');
      title.append(element('h3', '', city.name), element('small', '', [city.region, city.demo ? '示例' : '', photos.length + ' 张'].filter(Boolean).join(' · ')));
      const mapButton = element('button', 'button secondary', '打开城市');
      mapButton.type = 'button';
      mapButton.addEventListener('click', () => openAlbum(albumId));
      head.append(title, mapButton);
      const media = element('div', 'journey-entries');
      for (const entry of photos) {
        const row = element('button', 'journey-entry');
        row.type = 'button';
        row.dataset.photo = entry.photo.id;
        row.setAttribute('aria-label', (entry.pointId ? '定位拍摄点 · ' : '打开城市 · ') + entry.photo.name);
        const caption = element('span', '', entry.photo.name || '旅行照片');
        if (entry.photo.note) caption.append(element('small', '', entry.photo.note));
        if (journeySelection?.pointId && journeySelection.pointId === entry.pointId) {
          row.setAttribute('aria-current', 'true');
          if (target?.className !== 'journey-entry') target = row;
        }
        row.append(photoImage(entry.photo, ''), caption, icon(entry.pointId ? 'pin' : 'next'));
        row.addEventListener('click', () => openJourneyPhoto(entry));
        media.append(row);
      }
      card.append(head, media);
      list.append(card);
    }
    day.append(heading, list);
    return day;
  });
  $('journey-days').replaceChildren(...groups);
  if (target) {
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'nearest' });
  }
}

function uniquePlaces(options) {
  const byId = new Map();
  for (const place of options) if (!byId.has(place.id)) byId.set(place.id, place);
  return [...byId.values()];
}

function manualPlace(position) {
  const { lat, lon } = position;
  const wrappedLon = lon === 180 ? -180 : lon;
  const id = 'pin-' + lat.toFixed(6) + '_' + wrappedLon.toFixed(6);
  const legacy = 'pin-' + lat.toFixed(4) + '_' + lon.toFixed(4);
  return placeById(id) || placeById(legacy) || { id, lat, lon: wrappedLon, name: '自定义地点', region: '', unnamed: true, exact: true };
}

function withCity(place) {
  if (place.city || !place.cityHint) return place;
  const { name, region } = place.cityHint;
  const key = (region + ':' + name).normalize('NFKC').toLocaleLowerCase();
  const city = nearestCity(place, 35, name) ?? { id: 'city-group-' + key, name, region, lat: place.lat, lon: place.lon };
  return { ...place, city };
}

function choosePoint(position, mode) {
  const place = manualPlace(position);
  if (mode === 'upload') {
    openUploadDialog();
    if (place.unnamed) showManualLocation(place);
    else selectLocation(place);
  } else {
    if (place.photos) openAlbum(place.id);
    else showPlace({ ...place, draft: true });
  }
}

function showManualLocation(position) {
  point = position;
  showUploadStep('manual');
  $('place-name').value = '';
  $('manual-coords').textContent = formatCoordinates(position);
  $('place-name').focus();
}

function setupSearch(input, results, submit, choose, popup = false) {
  let request = null;
  let lastQuery = null;
  let lastResults = [];
  const attribution = element('a', 'map-credit', '© OpenStreetMap contributors');
  attribution.href = 'https://www.openstreetmap.org/copyright';
  attribution.target = '_blank';
  attribution.rel = 'noopener';

  function render(options, message, credit = false) {
    results.replaceChildren(...options.map((place) => placeOption(place, choose)));
    if (message) results.append(element('p', 'empty-results', message));
    if (credit) results.append(attribution);
  }

  function suggestions() {
    request?.abort();
    request = null;
    const query = input.value.trim().toLocaleLowerCase();
    const coords = parseCoordinates(query);
    if (popup) results.hidden = false;
    if (coords) render([manualPlace(coords)], '经纬度按「纬度, 经度」输入。');
    else if (query && query === lastQuery) render(lastResults, '', true);
    else render(query || popup ? localMatches(query, popup) : [], query
      ? '按回车或点搜索，查找全球地点。'
      : '可输入地点、地址或纬度和经度。');
  }

  async function worldwide() {
    const query = input.value.trim();
    const coords = parseCoordinates(query);
    if (coords) { choose(manualPlace(coords)); return; }
    suggestions();
    const local = localMatches(query.toLocaleLowerCase(), popup);
    if (query.length < 2) {
      render(local, '请输入至少两个字符，或输入纬度和经度。');
      return;
    }
    const controller = new AbortController();
    request = controller;
    render(local, '正在查找全球地点…');
    try {
      const remote = await searchGlobalPlaces(query, { signal: controller.signal });
      if (request !== controller) return;
      // Prefer the already-used ID for an equivalent catalog city.
      const normalized = (name) => name.normalize('NFKC').toLocaleLowerCase();
      const remotePlaces = remote.map((place) => local.find((city) =>
        city.id.startsWith('city-') && (place.isCity || (!place.exact && normalized(city.name) === normalized(place.name))) &&
        Math.hypot(city.lat - place.lat, city.lon - place.lon) < .12) || place);
      lastQuery = query.toLocaleLowerCase();
      lastResults = uniquePlaces([...remotePlaces, ...local]).slice(0, 10);
      render(lastResults, lastResults.length ? '' : '没有匹配地点。试试更完整的地址，或直接在地图上选点。', true);
    } catch {
      if (request === controller) render(local, '全球搜索暂时不可用。你仍可用本地候选、地图或经纬度选点。');
    } finally {
      if (request === controller) request = null;
    }
  }

  input.addEventListener('input', suggestions);
  input.addEventListener('keydown', (event) => {
    if (event.isComposing) return;
    if (event.key === 'ArrowDown' || event.key === 'Enter') {
      event.preventDefault();
      if (event.key === 'Enter') void worldwide();
      else results.querySelector('button')?.focus();
    }
  });
  submit.addEventListener('click', worldwide);
  if (popup) {
    input.addEventListener('focus', suggestions);
    input.addEventListener('click', () => { if (results.hidden) suggestions(); });
  }
  return suggestions;
}

function showUploadStep(step) {
  $('choose-location').hidden = step !== 'search';
  $('manual-location').hidden = step !== 'manual';
  $('chosen-location').hidden = step !== 'photos';
  $('photo-fields').hidden = step === 'manual';
  $('upload-actions').hidden = step === 'manual';
  updateSaveButton();
  showError('');
}

function selectLocation(place) {
  if (place.unnamed) {
    showManualLocation(place);
    return;
  }
  selected = withCity(place.base ?? place);
  const location = element('span', '', [place.name, defaultPhotoLocation?.label].filter(Boolean).join(' · '));
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
  renderGpsActions();
  if (upload.open) $('files').focus({ preventScroll: true });
}

function openUploadDialog() {
  if (!upload.open) upload.showModal();
}

function startUpload(place, detail) {
  if (choosingPoint) endPicking();
  setRotation(false);
  clearPreviews();
  form.reset();
  point = null;
  selected = null;
  defaultPhotoLocation = detail ? { lat: detail.lat, lon: detail.lon, label: detail.name } : null;
  if (place?.unnamed) showManualLocation(place);
  else if (place) selectLocation(place);
  else {
    showUploadStep('search');
    renderCitySearch();
  }
  renderGpsActions();
  openUploadDialog();
  (place?.unnamed ? $('place-name') : place ? $('files') : cityQuery).focus({ preventScroll: true });
}

function beginPicking(mode) {
  point = null;
  setView('map');
  setRotation(false);
  countryPanel.hidden = true;
  closeAlbum();
  if (upload.open) upload.close();
  choosingPoint = mode;
  globe.setPicking(true);
  stage.classList.add('is-picking');
  $('picking-banner').hidden = false;
  stage.scrollIntoView({ block: 'nearest', behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  canvas.focus({ preventScroll: true });
}

function endPicking() {
  choosingPoint = null;
  globe.setPicking(false);
  stage.classList.remove('is-picking');
  $('picking-banner').hidden = true;
}

function cancelPicking() {
  const mode = choosingPoint;
  endPicking();
  if (mode === 'upload') {
    showUploadStep('search');
    openUploadDialog();
    cityQuery.focus();
  } else {
    $('pick-on-globe').focus({ preventScroll: true });
  }
}

function confirmManualLocation() {
  const name = $('place-name').value.trim();
  if (!name) {
    showError('请为这个地点填写一个名称。');
    $('place-name').focus();
    return;
  }
  if (!point) return;
  const place = manualPlace(point);
  selectLocation(place.unnamed ? { ...place, name, unnamed: false } : place);
}

function setStreetCoordinates({ lat, lon }) {
  $('street-lat').value = Number(lat.toFixed(6));
  $('street-lon').value = Number(lon.toFixed(6));
}

function enteredStreetCoordinates() {
  if (!streetCoordinates.reportValidity()) return null;
  return { lat: $('street-lat').valueAsNumber, lon: $('street-lon').valueAsNumber };
}

function openStreetMap(mode, photo = null, streetPosition = null) {
  if (streetDialog.open) return;
  if (choosingPoint) endPicking();
  streetMode = mode;
  editingPhoto = photo;
  setRotation(false);
  const location = streetPosition ?? (photo ? photo.location || photo.gps || selected
    : mode === 'upload' ? point || selected : activePoint || activePlace);
  const position = location || globe.getCenter();
  $('street-help').textContent = streetPosition
    ? '已到达街道视图。继续滚轮缩放，或点击地图精确选点。关闭窗口可返回地球。'
    : '拖动或点按地图移动中心，也可以输入精确经纬度。';
  streetDialog.showModal();
  streetMap.open(position, location ? 15 : 6);
  setStreetCoordinates(position);
}

function showError(message) {
  $('upload-error').textContent = message;
  $('upload-error').hidden = !message;
}

function addFiles(files) {
  if (busy) return;
  let unsupported = false;
  const added = [];
  for (const file of files) {
    if (!file.size || (!file.type.startsWith('image/') && !(!file.type && /\.(avif|gif|jpe?g|png|webp|tiff?|bmp|svg)$/i.test(file.name)))) {
      unsupported = true;
      continue;
    }
    added.push({ file, url: URL.createObjectURL(file), pending: true, gps: null, location: defaultPhotoLocation });
  }
  previews.push(...added);
  showError(unsupported ? '已跳过无法读取的文件。请选择图片。' : '');
  renderFilePreviews();
  void Promise.all(added.map(async (entry) => {
    try {
      entry.gps = await readPhotoCoordinates(entry.file);
    } catch {
      entry.gps = null;
    }
    entry.pending = false;
  })).then(() => { if (added.some((entry) => previews.includes(entry))) renderFilePreviews(); });
}

function clearPreviews() {
  for (const { url } of previews) URL.revokeObjectURL(url);
  previews = [];
  renderFilePreviews();
}

function renderFilePreviews() {
  $('file-preview').replaceChildren(...previews.map((entry, index) => {
    const { file, url, pending, gps, location } = entry;
    const tile = element('div', 'file-tile');
    const thumb = element('div', 'file-thumb');
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
    thumb.append(image, remove);
    const caption = element('p', 'file-name', file.name);
    caption.title = file.name;
    const status = location ? '已确认 · ' + formatCoordinates(location)
      : gps ? '照片 GPS · ' + formatCoordinates(gps)
        : pending ? '正在读取位置…' : '使用所选地点';
    const actions = element('div', 'file-actions');
    if (gps && !location) {
      const accept = element('button', 'file-action', '采用 GPS');
      accept.type = 'button';
      accept.addEventListener('click', () => {
        entry.location = gps;
        renderFilePreviews();
      });
      actions.append(accept);
    }
    const adjust = element('button', 'file-action', '调整位置');
    adjust.type = 'button';
    adjust.addEventListener('click', () => openStreetMap('photo', entry));
    actions.append(adjust);
    if (location) {
      const clear = element('button', 'file-action', '用相册地点');
      clear.type = 'button';
      clear.addEventListener('click', () => {
        entry.location = null;
        renderFilePreviews();
      });
      actions.append(clear);
    }
    tile.append(thumb, caption, element('p', 'file-location', status), actions);
    return tile;
  }));
  renderGpsActions();
  updateSaveButton();
}

function renderGpsActions() {
  const action = $('use-photo-positions');
  const detected = previews.filter(({ gps, location }) => gps && !location).length;
  const anyPosition = previews.some(({ gps, location }) => gps || location);
  action.hidden = selected ? detected === 0 : !anyPosition;
  action.textContent = selected ? '采用 ' + detected + ' 张照片的 GPS' : '按照片位置选相册';
}

function confirmPhotoPositions() {
  const first = previews.find(({ gps, location }) => gps || location);
  if (!first) return;
  for (const entry of previews) {
    if (!entry.location && entry.gps) entry.location = entry.gps;
  }
  if (!selected) {
    const position = first.location;
    selectLocation(nearestCity(position) ?? manualPlace(position));
  }
  renderFilePreviews();
}

function updateSaveButton() {
  $('save-photos').disabled = busy || !selected || !previews.length || previews.some(({ pending }) => pending);
}

function setBusy(value) {
  busy = value;
  for (const node of form.querySelectorAll('input, button')) node.disabled = value;
  updateSaveButton();
  $('save-photos').querySelector('span').textContent = value ? '正在保存…' : '保存照片';
}

async function submitPhotos(event) {
  event.preventDefault();
  if ($('save-photos').disabled) return;
  const files = previews.map(({ file }) => file);
  const locations = previews.map(({ location }) => location);
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
    const updated = await savePhotos(selected, files, { date, note, locations });
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
$('tab-map').addEventListener('click', () => setView('map'));
$('tab-journey').addEventListener('click', () => {
  setView('journey');
  $('journey-title').focus({ preventScroll: true });
});
$('map-world').addEventListener('click', resetOverview);
$('map-country').addEventListener('click', () => showCountry(activeCountry));
$('map-city').addEventListener('click', () => {
  if (activePlace?.draft) showPlace(activePlace);
  else if (focusedAlbumId) openAlbum(focusedAlbumId);
});
$('close-country').addEventListener('click', () => {
  countryPanel.hidden = true;
  canvas.focus({ preventScroll: true });
});
$('country-add').addEventListener('click', () => {
  startUpload();
  cityQuery.value = activeCountry?.name ?? '';
  renderCitySearch();
});
$('add-to-album').addEventListener('click', () => startUpload(activePlace, activePoint));
$('show-album-in-journey').addEventListener('click', () => {
  if (activePlace && !activePlace.draft) setView('journey', { albumId: activePlace.id, pointId: activePoint?.id });
});
$('show-album-points').addEventListener('click', () => {
  const first = activePlace?.points?.[0];
  if (first) {
    globe.focus(first.lat, first.lon, { scale: Math.max(DETAIL_ZOOM + .15, globe.getZoom()) });
    if (matchMedia('(max-width: 800px)').matches) closeAlbum();
    canvas.focus({ preventScroll: true });
  }
});
$('show-all-photos').addEventListener('click', () => {
  if (activePlace) showPlace(activePlace, null, true);
});
$('use-photo-positions').addEventListener('click', confirmPhotoPositions);
$('close-album').addEventListener('click', () => closeAlbum(true));
$('close-upload').addEventListener('click', () => { if (!busy) upload.close(); });
upload.addEventListener('cancel', (event) => { if (busy) event.preventDefault(); });
form.addEventListener('submit', submitPhotos);
const renderCitySearch = setupSearch(cityQuery, $('city-results'), $('search-world-upload'), selectLocation);
setupSearch(recordQuery, recordResults, $('search-world'), (place) => {
  recordQuery.value = place.unnamed ? '' : place.name;
  if (place.isCountry) showCountry(countryFor(place) ?? place);
  else if (placeById(place.id) || albums.has(place.id)) openAlbum(place.id);
  else showPlace({ ...place, draft: true });
}, true);
$('pick-on-globe').addEventListener('click', () => beginPicking('browse'));
$('start-picking').addEventListener('click', () => beginPicking('upload'));
$('repick-location').addEventListener('click', () => beginPicking('upload'));
$('cancel-picking').addEventListener('click', cancelPicking);
$('open-detail-map').addEventListener('click', () => openStreetMap('browse'));
$('refine-place').addEventListener('click', () => openStreetMap('browse'));
$('upload-detail-map').addEventListener('click', () => openStreetMap('upload'));
$('close-street').addEventListener('click', () => streetDialog.close());
streetDialog.addEventListener('close', () => { if (!streetDialog.open) streetMap.close(); });
$('street-zoom-in').addEventListener('click', () => streetMap.zoom(1));
$('street-zoom-out').addEventListener('click', () => streetMap.zoom(-1));
streetCoordinates.addEventListener('submit', (event) => {
  event.preventDefault();
  const position = enteredStreetCoordinates();
  if (position) streetMap.locate(position);
});
$('street-confirm').addEventListener('click', () => {
  const position = enteredStreetCoordinates();
  if (!position) return;
  streetDialog.close();
  if (editingPhoto) {
    editingPhoto.location = position;
    editingPhoto = null;
    renderFilePreviews();
  } else {
    choosePoint(position, streetMode);
  }
});
$('confirm-location').addEventListener('click', confirmManualLocation);
$('place-name').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.isComposing) {
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

document.addEventListener('pointerdown', (event) => {
  if (!event.target.closest('.record-search')) recordResults.hidden = true;
});
document.querySelector('.record-search').addEventListener('focusout', (event) => {
  if (!event.currentTarget.contains(event.relatedTarget)) recordResults.hidden = true;
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || upload.open || lightbox.open || streetDialog.open) return;
  if (choosingPoint) cancelPicking();
  else if (!recordResults.hidden) recordResults.hidden = true;
  else if (!album.hidden) closeAlbum(true);
  else if (!countryPanel.hidden) $('close-country').click();
});

$('zoom-in').addEventListener('click', () => { setRotation(false); globe.zoom(1.2); });
$('zoom-out').addEventListener('click', () => { setRotation(false); globe.zoom(1 / 1.2); });
$('reset-globe').addEventListener('click', resetOverview);
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
