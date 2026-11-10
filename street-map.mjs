const tileSize = 256;
const degrees = 180 / Math.PI;
const maximumLatitude = Math.atan(Math.sinh(Math.PI)) * degrees;
const tileOrigin = 'https://tile.openstreetmap.org';
const keyboardOffsets = {
  ArrowUp: [0, -56], ArrowDown: [0, 56], ArrowLeft: [-56, 0], ArrowRight: [56, 0],
};

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const wrap = (value, period) => ((value % period) + period) % period;

function project({ lat, lon }) {
  const radians = clamp(lat, -maximumLatitude, maximumLatitude) / degrees;
  return {
    x: wrap((lon + 180) / 360, 1),
    y: clamp((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2, 0, 1),
  };
}

function unproject({ x, y }) {
  return {
    lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * clamp(y, 0, 1)))) * degrees,
    lon: wrap(x, 1) * 360 - 180,
  };
}

export class StreetMap {
  constructor(container, { onMove = () => {}, onStatus = () => {} } = {}) {
    this.container = container;
    this.onMove = onMove;
    this.onStatus = onStatus;
    this.center = { lat: 0, lon: 0 };
    this.level = 13;
    this.tiles = new Map();
    this.frame = null;
    this.active = false;
    this.drag = null;
    this.lastWheel = -Infinity;
    this.resizeObserver = new ResizeObserver(() => this.schedule());

    container.addEventListener('pointerdown', (event) => this.pointerDown(event));
    container.addEventListener('pointermove', (event) => this.pointerMove(event));
    container.addEventListener('pointerup', (event) => this.pointerUp(event));
    container.addEventListener('pointercancel', (event) => this.endDrag(event.pointerId));
    container.addEventListener('lostpointercapture', (event) => this.endDrag(event.pointerId));
    container.addEventListener('wheel', (event) => this.wheel(event), { passive: false });
    container.addEventListener('keydown', (event) => this.keyDown(event));
  }

  open(point, zoom = 13) {
    this.active = true;
    this.level = clamp(Math.round(zoom), 0, 19);
    this.lastWheel = -Infinity;
    this.resizeObserver.observe(this.container);
    this.locate(point);
    this.schedule();
  }

  close() {
    this.active = false;
    if (this.drag) this.endDrag(this.drag.id);
    this.resizeObserver.disconnect();
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    for (const [key, tile] of this.tiles) this.removeTile(key, tile);
    this.setStatus('');
  }

  locate({ lat, lon }) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    this.center = { lat: clamp(lat, -90, 90), lon: clamp(lon, -180, 180) };
    this.onMove(this.getCenter());
    this.schedule();
  }

  zoom(delta) {
    this.level = clamp(Math.round(this.level + delta), 0, 19);
    this.schedule();
  }

  getCenter() {
    return { ...this.center };
  }

  moveBy(horizontal, vertical, center = project(this.center)) {
    const width = tileSize * 2 ** this.level;
    this.locate(unproject({ x: center.x + horizontal / width, y: center.y + vertical / width }));
  }

  pointerDown(event) {
    if (!this.active || event.button !== 0 || this.drag) return;
    this.container.focus({ preventScroll: true });
    this.container.setPointerCapture(event.pointerId);
    this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, center: project(this.center), moved: false };
  }

  pointerMove(event) {
    if (this.drag?.id !== event.pointerId) return;
    const horizontal = event.clientX - this.drag.x;
    const vertical = event.clientY - this.drag.y;
    if (!this.drag.moved && Math.hypot(horizontal, vertical) < 4) return;
    this.drag.moved = true;
    this.container.classList.add('is-dragging');
    this.moveBy(-horizontal, -vertical, this.drag.center);
  }

  pointerUp(event) {
    if (this.drag?.id !== event.pointerId) return;
    const { left, top, width, height } = this.container.getBoundingClientRect();
    const x = event.clientX - left;
    const y = event.clientY - top;
    if (!this.drag.moved && x >= 0 && y >= 0 && x < width && y < height) {
      this.moveBy(x - width / 2, y - height / 2);
    }
    this.endDrag(event.pointerId);
  }

  endDrag(pointerId) {
    if (this.drag?.id !== pointerId) return;
    this.drag = null;
    this.container.classList.remove('is-dragging');
    if (this.container.hasPointerCapture(pointerId)) this.container.releasePointerCapture(pointerId);
  }

  wheel(event) {
    if (!this.active || !event.deltaY) return;
    event.preventDefault();
    if (event.timeStamp - this.lastWheel < 170) return;
    this.lastWheel = event.timeStamp;
    this.zoom(-Math.sign(event.deltaY));
  }

  keyDown(event) {
    if (!this.active) return;
    if (Object.hasOwn(keyboardOffsets, event.key)) {
      event.preventDefault();
      this.moveBy(...keyboardOffsets[event.key]);
    } else if (event.key === '+' || event.key === '=' || event.key === '-') {
      event.preventDefault();
      this.zoom(event.key === '-' ? -1 : 1);
    }
  }

  schedule() {
    if (!this.active || this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.render();
    });
  }

  render() {
    const { clientWidth: width, clientHeight: height } = this.container;
    if (!this.active || width === 0 || height === 0) return;

    const center = project(this.center);
    const count = 2 ** this.level;
    const left = center.x * count * tileSize - width / 2;
    const top = center.y * count * tileSize - height / 2;
    const firstX = Math.floor(left / tileSize);
    const lastX = Math.ceil((left + width) / tileSize) - 1;
    const firstY = Math.max(0, Math.floor(top / tileSize));
    const lastY = Math.min(count - 1, Math.ceil((top + height) / tileSize) - 1);
    const visible = new Set();

    for (let x = firstX; x <= lastX; x++) {
      for (let y = firstY; y <= lastY; y++) {
        const key = `${this.level}/${x}/${y}`;
        visible.add(key);
        const tile = this.tiles.get(key) ?? this.addTile(key, wrap(x, count), y);
        const offsetX = Math.round(x * tileSize - left);
        const offsetY = Math.round(y * tileSize - top);
        tile.image.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
      }
    }
    for (const [key, tile] of this.tiles) {
      if (!visible.has(key)) this.removeTile(key, tile);
    }
    this.updateStatus();
  }

  addTile(key, x, y) {
    const image = this.container.ownerDocument.createElement('img');
    image.className = 'street-tile';
    image.alt = '';
    image.draggable = false;
    image.decoding = 'async';
    image.width = tileSize;
    image.height = tileSize;
    const tile = { image, state: 'loading' };
    image.onload = () => {
      tile.state = 'ready';
      this.updateStatus();
    };
    image.onerror = () => {
      tile.state = 'error';
      image.hidden = true;
      this.updateStatus();
    };
    this.tiles.set(key, tile);
    this.container.append(image);
    image.src = `${tileOrigin}/${this.level}/${x}/${y}.png`;
    return tile;
  }

  removeTile(key, { image }) {
    this.tiles.delete(key);
    image.onload = null;
    image.onerror = null;
    image.removeAttribute('src');
    image.remove();
  }

  updateStatus() {
    if (!this.active) return;
    if (Math.abs(this.center.lat) > maximumLatitude) {
      this.setStatus('此坐标超出街道地图范围，仍可按经纬度选定。');
      return;
    }
    const tiles = Array.from(this.tiles.values());
    const ready = tiles.some((tile) => tile.state === 'ready');
    const loading = tiles.some((tile) => tile.state === 'loading');
    const failed = tiles.some((tile) => tile.state === 'error');
    if (!ready && loading) this.setStatus('正在加载街道地图…');
    else if (!ready) this.setStatus('街道地图暂时无法加载，仍可输入经纬度选点。');
    else if (failed) this.setStatus('部分地图图块暂时无法加载。');
    else this.setStatus('');
  }

  setStatus(message) {
    if (this.status === message) return;
    this.status = message;
    this.onStatus(message);
  }
}
