import { landRings } from './globe-map.mjs';

const RAD = Math.PI / 180;
const START = { lat: 25, lon: 105 };
const TEXTURE_WIDTH = 1440;
const TEXTURE_HEIGHT = 720;
const TAU = Math.PI * 2;
const MARKER_COLORS = {
  saved: { halo: '#ffda7c20', dot: '#f8cc73', rim: '#fff0b99e', badge: '#151d35db', border: '#8ea5d545', text: '#e1e7fa' },
  active: { halo: '#ffda7c32', ring: '#ffda7c78', dot: '#ffe5a4', rim: '#fff0b99e', badge: '#242c48', border: '#e2b76990', text: '#ffe6b1' },
  draft: { halo: '#f06b9940', ring: '#f88ab8aa', dot: '#f06b99', rim: '#ffe0ec', badge: '#3c2947', border: '#f06b9999', text: '#ffe0ec' },
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const longitude = (value) => ((value + 180) % 360 + 360) % 360 - 180;

function makeTexture() {
  const texture = document.createElement('canvas');
  texture.width = TEXTURE_WIDTH;
  texture.height = TEXTURE_HEIGHT;
  const context = texture.getContext('2d', { willReadFrequently: true });
  context.fillStyle = '#5b72a5';
  context.strokeStyle = '#8498c9';
  context.lineWidth = 1.5;
  for (const ring of landRings) {
    for (const offset of [-360, 0, 360]) {
      context.beginPath();
      ring.forEach(([lon, lat], index) => {
        const x = (lon + offset + 180) * 4;
        const y = (90 - lat) * 4;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.closePath();
      context.fill();
      context.stroke();
    }
  }
  context.globalCompositeOperation = 'source-atop';
  context.fillStyle = '#a3b4dc4d';
  for (let y = 1; y < TEXTURE_HEIGHT; y += 5) {
    for (let x = 1 + y % 2 * 2.5; x < TEXTURE_WIDTH; x += 5) context.fillRect(x, y, 1.5, 1.5);
  }
  context.globalCompositeOperation = 'destination-over';
  context.fillStyle = '#38497f';
  context.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
  context.globalCompositeOperation = 'source-over';
  context.beginPath();
  for (let lon = 0; lon < TEXTURE_WIDTH; lon += 60) {
    context.moveTo(lon, 0);
    context.lineTo(lon, TEXTURE_HEIGHT);
  }
  for (let lat = 60; lat < TEXTURE_HEIGHT; lat += 60) {
    context.moveTo(0, lat);
    context.lineTo(TEXTURE_WIDTH, lat);
  }
  context.strokeStyle = '#9cb9f52b';
  context.lineWidth = 1.35;
  context.stroke();
  return context.getImageData(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT).data;
}

export class TravelGlobe {
  constructor(canvas, { onSelect, onPick, onInteract }) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.onSelect = onSelect;
    this.onPick = onPick;
    this.onInteract = onInteract;
    this.angles = { ...START };
    this.scale = 1;
    this.places = [];
    this.markers = [];
    this.pointers = new Map();
    this.motion = matchMedia('(prefers-reduced-motion: reduce)');
    this.autoRotate = !this.motion.matches;
    this.motion.addEventListener('change', () => {
      if (this.motion.matches) this.setAutoRotate(false);
    });
    this.texture = makeTexture();
    this.sphere = document.createElement('canvas');
    this.sphereContext = this.sphere.getContext('2d');
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.bindInput();
    this.resize();
  }

  setPlaces(places) {
    this.places = places;
    this.invalidate();
  }

  setActive(id) {
    this.active = id;
    this.invalidate();
  }

  setPicking(enabled) {
    this.picking = enabled;
    if (enabled) this.setAutoRotate(false);
    this.invalidate();
  }

  // Returns the point in canvas-local CSS pixels, even when it is on the far side.
  project(lat, lon) {
    if (!this.radius || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90) return null;
    const viewLat = this.angles.lat * RAD;
    const pointLat = lat * RAD;
    const deltaLon = (lon - this.angles.lon) * RAD;
    const sinLat = Math.sin(pointLat);
    const cosLat = Math.cos(pointLat);
    const baseZ = cosLat * Math.cos(deltaLon);
    const depth = sinLat * Math.sin(viewLat) + baseZ * Math.cos(viewLat);
    const x = this.cx + cosLat * Math.sin(deltaLon) * this.radius;
    const y = this.cy - (sinLat * Math.cos(viewLat) - baseZ * Math.sin(viewLat)) * this.radius;
    const visible = depth >= 0 && x >= 0 && y >= 0 && x <= this.width && y <= this.height;
    return { x, y, depth, visible };
  }

  // Inverts project() on the visible globe surface, in the same pixel space.
  unproject(x, y) {
    if (!this.radius || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (x < 0 || y < 0 || x > this.width || y > this.height) return null;
    const screenX = (x - this.cx) / this.radius;
    const screenY = (this.cy - y) / this.radius;
    const remaining = 1 - screenX * screenX - screenY * screenY;
    if (remaining < -1e-12) return null;
    const z = Math.sqrt(Math.max(0, remaining));
    const viewLat = this.angles.lat * RAD;
    const cosLat = Math.cos(viewLat);
    const sinLat = Math.sin(viewLat);
    const lat = Math.asin(clamp(screenY * cosLat + z * sinLat, -1, 1)) / RAD;
    const lon = this.angles.lon + Math.atan2(screenX, z * cosLat - screenY * sinLat) / RAD;
    return { lat, lon: longitude(lon) };
  }

  pickCenter() {
    if (!this.picking || !this.radius) return;
    this.flight = null;
    this.onPick?.(this.getCenter());
  }

  getCenter() {
    return { lat: this.angles.lat, lon: longitude(this.angles.lon) };
  }

  setAutoRotate(enabled) {
    this.autoRotate = enabled;
    this.lastFrame = undefined;
    this.invalidate();
  }

  focus(lat, lon) {
    this.setAutoRotate(false);
    if (this.motion.matches) {
      this.angles = { lat, lon };
      this.flight = null;
    } else {
      this.flight = { start: performance.now(), from: { ...this.angles }, lat, lon };
    }
    this.invalidate();
  }

  zoom(factor) {
    this.scale = clamp(this.scale * factor, 0.65, 2.15);
    this.resize();
  }

  reset() {
    this.scale = 1;
    this.resize();
    this.focus(START.lat, START.lon);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.width = rect.width;
    this.height = rect.height;
    this.ratio = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * this.ratio);
    this.canvas.height = Math.round(this.height * this.ratio);
    this.cx = this.width / 2;
    this.cy = this.height / 2;
    const shortEdge = Math.min(this.width, this.height);
    const margin = clamp(shortEdge * 0.035, 10, 24);
    this.radius = Math.max(1, shortEdge / 2 - margin) * this.scale;
    const size = Math.max(1, Math.min(560, Math.round(this.radius * 2 * this.ratio)));
    if (this.sphere.width !== size || this.sphere.height !== size || !this.spherePixels) {
      this.sphere.width = this.sphere.height = size;
      this.spherePixels = this.sphereContext.createImageData(size, size);
      this.rays = new Float32Array(size * size * 3);
      for (let row = 0; row < size; row += 1) {
        for (let column = 0; column < size; column += 1) {
          const x = (column + 0.5) * 2 / size - 1;
          const y = 1 - (row + 0.5) * 2 / size;
          const distance = 1 - x * x - y * y;
          const index = (row * size + column) * 3;
          this.rays[index] = x;
          this.rays[index + 1] = y;
          this.rays[index + 2] = distance > 0 ? Math.sqrt(distance) : -1;
        }
      }
    }
    this.invalidate();
  }

  invalidate() {
    if (!this.frame) this.frame = requestAnimationFrame((now) => this.draw(now));
  }

  draw(now) {
    this.frame = 0;
    if (!this.radius) return;
    if (this.flight) {
      const { from, lat, lon, start } = this.flight;
      const progress = clamp((now - start) / 620, 0, 1);
      const ease = (1 - Math.cos(Math.PI * progress)) / 2;
      this.angles = { lat: from.lat + (lat - from.lat) * ease, lon: longitude(from.lon + longitude(lon - from.lon) * ease) };
      if (progress === 1) this.flight = null;
    } else if (this.autoRotate && this.lastFrame !== undefined) {
      const elapsed = Math.min(50, now - this.lastFrame);
      this.angles.lon = longitude(this.angles.lon + elapsed * 0.003);
    }
    this.lastFrame = now;

    const { context, width, height, cx, cy, radius, ratio } = this;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    const halo = context.createRadialGradient(cx, cy, radius * 0.83, cx, cy, radius * 1.22);
    halo.addColorStop(0, '#778eff00');
    halo.addColorStop(0.43, '#788df340');
    halo.addColorStop(0.69, '#748cff17');
    halo.addColorStop(1, '#748cff00');
    context.fillStyle = halo;
    context.fillRect(cx - radius * 1.22, cy - radius * 1.22, radius * 2.44, radius * 2.44);

    const cosLat = Math.cos(this.angles.lat * RAD);
    const sinLat = Math.sin(this.angles.lat * RAD);
    const viewLon = this.angles.lon * RAD;
    const pixels = this.spherePixels.data;
    for (let ray = 0, pixel = 0; ray < this.rays.length; ray += 3, pixel += 4) {
      const z = this.rays[ray + 2];
      if (z < 0) continue;
      const x = this.rays[ray];
      const y = this.rays[ray + 1];
      const lat = Math.asin(clamp(y * cosLat + z * sinLat, -1, 1));
      const lon = viewLon + Math.atan2(x, z * cosLat - y * sinLat);
      const u = (Math.floor((lon / TAU + 1.5) * TEXTURE_WIDTH)) % TEXTURE_WIDTH;
      const v = Math.min(TEXTURE_HEIGHT - 1, Math.floor((0.5 - lat / Math.PI) * TEXTURE_HEIGHT));
      const texel = (v * TEXTURE_WIDTH + u) * 4;
      const light = Math.max(0, z * 0.85 - x * 0.37 + y * 0.38);
      const limb = Math.pow(1 - z, 4) * (0.5 + Math.max(0, -x + y) * 0.48);
      const shade = 0.44 + light * 0.72;
      pixels[pixel] = this.texture[texel] * shade + limb * 41;
      pixels[pixel + 1] = this.texture[texel + 1] * shade + limb * 58;
      pixels[pixel + 2] = this.texture[texel + 2] * shade + limb * 105;
      pixels[pixel + 3] = 255;
    }
    this.sphereContext.putImageData(this.spherePixels, 0, 0);
    context.save();
    context.beginPath();
    context.arc(cx, cy, radius, 0, TAU);
    context.clip();
    context.drawImage(this.sphere, cx - radius, cy - radius, 2 * radius, 2 * radius);
    context.restore();

    const rim = context.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
    rim.addColorStop(0, '#adc7ffcf');
    rim.addColorStop(0.55, '#7a9afa80');
    rim.addColorStop(1, '#5d6dae39');
    context.strokeStyle = rim;
    context.lineWidth = 1.2;
    context.beginPath();
    context.arc(cx, cy, radius, 0, TAU);
    context.stroke();
    this.drawPlaces();
    if (this.picking) this.drawReticle();
    if (this.flight || this.autoRotate) this.invalidate();
  }

  drawReticle() {
    const { context, cx, cy } = this;
    context.save();
    context.translate(cx, cy);
    context.beginPath();
    context.arc(0, 0, 10, 0, TAU);
    context.moveTo(-16, 0);
    context.lineTo(-7, 0);
    context.moveTo(7, 0);
    context.lineTo(16, 0);
    context.moveTo(0, -16);
    context.lineTo(0, -7);
    context.moveTo(0, 7);
    context.lineTo(0, 16);
    context.strokeStyle = '#11192b';
    context.lineWidth = 3.5;
    context.stroke();
    context.strokeStyle = '#ffe6a6';
    context.lineWidth = 1.25;
    context.stroke();
    context.fillStyle = '#ffe6a6';
    context.beginPath();
    context.arc(0, 0, 1.65, 0, TAU);
    context.fill();
    context.restore();
  }

  drawPlaces() {
    const { context, width } = this;
    this.markers = this.places.flatMap((place) => {
      const point = this.project(place.lat, place.lon);
      if (!point?.visible || point.depth < 0.025) return [];
      const active = place.id === this.active;
      const colors = place.draft ? MARKER_COLORS.draft : active ? MARKER_COLORS.active : MARKER_COLORS.saved;
      return [{ ...place, ...point, emphasized: Boolean(active || place.draft), colors }];
    }).sort((a, b) => Number(a.emphasized) - Number(b.emphasized) || a.depth - b.depth);

    const drawnLabels = [];
    for (const marker of this.markers) {
      const { x, y, emphasized, colors } = marker;
      context.beginPath();
      context.arc(x, y, emphasized ? 17 : 10, 0, TAU);
      context.fillStyle = colors.halo;
      context.fill();
      if (colors.ring) {
        context.strokeStyle = colors.ring;
        context.lineWidth = 1;
        context.stroke();
      }
      context.beginPath();
      context.arc(x, y, emphasized ? 5.5 : 4, 0, TAU);
      context.fillStyle = colors.dot;
      context.fill();
      context.strokeStyle = colors.rim;
      context.lineWidth = 0.9;
      context.stroke();
    }
    for (const marker of [...this.markers].reverse()) {
      const { x, y, emphasized, colors } = marker;
      if (!emphasized && (this.picking || marker.depth < 0.32)) continue;
      context.font = `${emphasized ? '600 12px' : '500 11px'} system-ui, sans-serif`;
      const name = Array.from(marker.name);
      const shortName = name.length > 12 ? `${name.slice(0, 11).join('')}…` : marker.name;
      const label = marker.draft ? shortName : `${shortName}  ·  ${marker.count}`;
      const labelWidth = Math.ceil(context.measureText(label).width) + 15;
      const left = x + labelWidth + 15 > width ? x - labelWidth - 12 : x + 12;
      const top = y - 11;
      const overlaps = drawnLabels.some((item) => left < item.left + item.width + 4 && left + labelWidth > item.left - 4 && Math.abs(top - item.top) < 24);
      if (overlaps) continue;
      marker.label = { left, top, width: labelWidth };
      drawnLabels.push(marker.label);
      context.beginPath();
      context.roundRect(left, top, labelWidth, 22, 8);
      context.fillStyle = colors.badge;
      context.fill();
      context.strokeStyle = colors.border;
      context.stroke();
      context.fillStyle = colors.text;
      context.textBaseline = 'middle';
      context.fillText(label, left + 7, y + 0.3);
    }
  }

  interact() {
    this.flight = null;
    this.setAutoRotate(false);
    this.onInteract?.();
  }

  choose(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (this.picking) {
      const coordinates = this.unproject(x, y);
      if (coordinates) this.onPick?.(coordinates);
      return;
    }
    let nearest;
    let distance = 19;
    for (const marker of [...this.markers].reverse()) {
      if (marker.draft) continue;
      const nextDistance = Math.hypot(marker.x - x, marker.y - y);
      if (nextDistance < distance) {
        nearest = marker;
        distance = nextDistance;
      }
    }
    const labeled = nearest || this.markers.find(({ draft, label }) => !draft && label &&
      x >= label.left && x <= label.left + label.width && y >= label.top && y <= label.top + 22);
    if (labeled) this.onSelect?.(labeled.id);
  }

  bindInput() {
    const { canvas } = this;
    canvas.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      this.interact();
      canvas.setPointerCapture(event.pointerId);
      if (!this.pointers.size) this.dragged = false;
      else this.dragged = true;
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY });
    });
    canvas.addEventListener('pointermove', (event) => {
      const pointer = this.pointers.get(event.pointerId);
      if (!pointer) return;
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      if (this.pointers.size > 1) {
        const other = [...this.pointers.entries()].find(([id]) => id !== event.pointerId)?.[1];
        const before = Math.hypot(pointer.x - other.x, pointer.y - other.y);
        const after = Math.hypot(event.clientX - other.x, event.clientY - other.y);
        if (before > 5 && after > 5) this.zoom(after / before);
      } else if (this.dragged || Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 4) {
        this.dragged = true;
        const degreesPerPixel = 54 / this.radius;
        this.angles.lon = longitude(this.angles.lon - dx * degreesPerPixel);
        this.angles.lat = clamp(this.angles.lat + dy * degreesPerPixel, -89.8, 89.8);
        this.invalidate();
      }
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    });
    canvas.addEventListener('pointerup', (event) => this.pointers.delete(event.pointerId));
    canvas.addEventListener('pointercancel', (event) => this.pointers.delete(event.pointerId));
    canvas.addEventListener('lostpointercapture', (event) => this.pointers.delete(event.pointerId));
    canvas.addEventListener('click', (event) => {
      // Handle the click before opening a panel so a touch tap cannot hit the new UI.
      if (!this.dragged && !this.pointers.size) this.choose(event.clientX, event.clientY);
    });
    canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      this.interact();
      this.zoom(Math.exp(clamp(-event.deltaY * 0.0013, -0.3, 0.3)));
    }, { passive: false });
    canvas.addEventListener('keydown', (event) => {
      const actions = {
        ArrowLeft: () => this.angles.lon = longitude(this.angles.lon + 10),
        ArrowRight: () => this.angles.lon = longitude(this.angles.lon - 10),
        ArrowUp: () => this.angles.lat = clamp(this.angles.lat - 10, -89.8, 89.8),
        ArrowDown: () => this.angles.lat = clamp(this.angles.lat + 10, -89.8, 89.8),
        '+': () => this.zoom(1.2),
        '-': () => this.zoom(1 / 1.2),
        Home: () => this.reset(),
        Enter: () => {
          if (this.picking) return this.pickCenter();
          const rect = canvas.getBoundingClientRect();
          this.choose(rect.left + this.cx, rect.top + this.cy);
        }
      };
      const action = actions[event.key];
      if (!action) return;
      event.preventDefault();
      this.interact();
      action();
      this.invalidate();
    });
  }
}
