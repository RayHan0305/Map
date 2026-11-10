import { landRings } from './globe-map.mjs';

const RAD = Math.PI / 180;
const START = { lat: 25, lon: 105 };
const TEXTURE_WIDTH = 1440;
const TEXTURE_HEIGHT = 720;
const TAU = Math.PI * 2;
const MIN_ZOOM = 0.65;
const MAX_ZOOM = 3.4;
const STREET_SCROLL_DISTANCE = 90;
const STREET_SCROLL_WINDOW = 300;
const STREET_SCROLL_COOLDOWN = 650;
export const DETAIL_ZOOM = 1.85;
const MARKER_COLORS = {
  saved: { halo: '#ffda7c20', dot: '#f8cc73', rim: '#fff0b99e', badge: '#151d35db', border: '#8ea5d545', text: '#e1e7fa' },
  active: { halo: '#ffda7c32', ring: '#ffda7c78', dot: '#ffe5a4', rim: '#fff0b99e', badge: '#242c48', border: '#e2b76990', text: '#ffe6b1' },
  detail: { halo: '#a3f1d432', ring: '#a3f1d497', dot: '#b6f7dd', rim: '#e4fff2', badge: '#193b3e', border: '#a3f1d47c', text: '#d9fff1' },
  draft: { halo: '#f06b9940', ring: '#f88ab8aa', dot: '#f06b99', rim: '#ffe0ec', badge: '#3c2947', border: '#f06b9999', text: '#ffe0ec' },
};
const DETAIL_OFFSETS = [16, 32, 48].flatMap((distance) => Array.from({ length: 8 }, (_, index) => {
  const angle = index * TAU / 8;
  return [distance * Math.cos(angle), distance * Math.sin(angle)];
}));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const longitude = (value) => ((value + 180) % 360 + 360) % 360 - 180;
const DAY_GAMMA = 0.78;
const DAY_TONES = Array.from({ length: 256 }, (_, value) => 255 * Math.pow(value / 255, DAY_GAMMA));

const VERTEX_SHADER = `
  #if __VERSION__ >= 300
    in vec2 a_position;
  #else
    attribute vec2 a_position;
  #endif
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const EARTH_SHADER = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
  #else
    precision mediump float;
  #endif
  #if __VERSION__ >= 300
    out vec4 earthColor;
    #define SAMPLE_EARTH texture
    #define OUTPUT_EARTH earthColor
  #else
    #define SAMPLE_EARTH texture2D
    #define OUTPUT_EARTH gl_FragColor
  #endif
  uniform sampler2D u_earth;
  uniform vec2 u_center;
  uniform float u_radius;
  uniform vec3 u_view;

  void main() {
    vec2 surface = (gl_FragCoord.xy - u_center) / u_radius;
    float squared = dot(surface, surface);
    if (squared > 1.0) discard;
    float z = sqrt(1.0 - squared);
    float lat = asin(clamp(surface.y * u_view.x + z * u_view.y, -1.0, 1.0));
    float lon = u_view.z + atan(surface.x, z * u_view.x - surface.y * u_view.y);
    vec2 uv = vec2(lon / 6.28318530718 + 0.5, 0.5 - lat / 3.14159265359);
    vec3 ground = pow(SAMPLE_EARTH(u_earth, uv).rgb, vec3(${DAY_GAMMA})) + vec3(0.014, 0.026, 0.045);
    float light = max(0.0, z * 0.85 - surface.x * 0.37 + surface.y * 0.38);
    float limb = pow(1.0 - z, 4.0) * (0.5 + max(0.0, -surface.x + surface.y) * 0.48);
    vec3 color = ground * (0.64 + 0.47 * light) + limb * vec3(0.17, 0.26, 0.43);
    float edge = clamp((1.0 - sqrt(squared)) * u_radius + 0.5, 0.0, 1.0);
    OUTPUT_EARTH = vec4(color, edge);
  }
`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
}

function textureCanvas(image, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);
  return canvas;
}

function createEarthRenderer(invalidate) {
  const canvas = document.createElement('canvas');
  const options = { alpha: true, depth: false, antialias: false, premultipliedAlpha: false };
  const webgl2 = canvas.getContext('webgl2', options);
  const gl = webgl2 || canvas.getContext('webgl', options);
  if (!gl) return null;
  const version = webgl2 ? '#version 300 es\n' : '';
  let uniforms;
  let source;

  function upload(image) {
    source = image;
    if (gl.isContextLost()) return false;
    const vertex = compileShader(gl, gl.VERTEX_SHADER, version + VERTEX_SHADER);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, version + EARTH_SHADER);
    if (!vertex || !fragment) return false;
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;

    gl.useProgram(program);
    const vertices = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const deviceLimit = matchMedia('(max-width: 700px)').matches ? 4096 : 8192;
    const sizeLimit = Math.min(image.naturalWidth, gl.getParameter(gl.MAX_TEXTURE_SIZE), deviceLimit);
    const width = webgl2 ? sizeLimit - sizeLimit % 2 : 2 ** Math.floor(Math.log2(sizeLimit));
    const height = width / 2;
    const map = width === image.naturalWidth && height === image.naturalHeight ? image : textureCanvas(image, width, height);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, map);
    gl.generateMipmap(gl.TEXTURE_2D);
    if (gl.getError() !== gl.NO_ERROR) {
      gl.deleteTexture(texture);
      gl.deleteBuffer(vertices);
      gl.deleteProgram(program);
      return false;
    }

    uniforms = {
      center: gl.getUniformLocation(program, 'u_center'),
      radius: gl.getUniformLocation(program, 'u_radius'),
      view: gl.getUniformLocation(program, 'u_view'),
    };
    return true;
  }

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    uniforms = null;
    invalidate();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    try {
      if (source) upload(source);
    } catch {
      uniforms = null;
    }
    invalidate();
  });

  return {
    upload,
    draw(globe) {
      if (!uniforms || gl.isContextLost()) return null;
      const { width, height } = globe.canvas;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const { cx, cy, ratio, radius, angles } = globe;
      const lat = angles.lat * RAD;
      gl.viewport(0, 0, width, height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uniforms.center, cx * ratio, height - cy * ratio);
      gl.uniform1f(uniforms.radius, radius * ratio);
      gl.uniform3f(uniforms.view, Math.cos(lat), Math.sin(lat), angles.lon * RAD);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return canvas;
    },
  };
}

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
  return { pixels: context.getImageData(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT).data, width: TEXTURE_WIDTH, height: TEXTURE_HEIGHT };
}

export class TravelGlobe {
  constructor(canvas, { onSelect, onPick, onInteract, findCountry, onCountry, onStreetZoom }) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.onSelect = onSelect;
    this.onPick = onPick;
    this.onInteract = onInteract;
    this.findCountry = findCountry;
    this.onCountry = onCountry;
    this.onStreetZoom = onStreetZoom;
    this.streetScroll = { distance: 0, lastAt: -Infinity, readyAt: 0 };
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
    this.loadEarth();
    import('./geography.mjs').then(({ drawGeography }) => {
      this.drawGeography = drawGeography;
      this.invalidate();
    }).catch(() => {});
  }

  loadEarth() {
    if (typeof Image !== 'function') return;
    try {
      this.earth = createEarthRenderer(() => this.invalidate());
    } catch {
      this.earth = null;
    }
    const image = new Image();
    image.onload = () => {
      let uploaded = false;
      try {
        uploaded = this.earth?.upload(image);
      } catch {
        this.earth = null;
      }
      if (!uploaded) {
        try {
          const width = Math.min(image.naturalWidth, 2048);
          const height = Math.round(width / 2);
          const canvas = textureCanvas(image, width, height);
          const pixels = canvas.getContext('2d').getImageData(0, 0, width, height).data;
          for (let pixel = 0; pixel < pixels.length; pixel += 4) {
            pixels[pixel] = DAY_TONES[pixels[pixel]] + 4;
            pixels[pixel + 1] = DAY_TONES[pixels[pixel + 1]] + 7;
            pixels[pixel + 2] = DAY_TONES[pixels[pixel + 2]] + 11;
          }
          this.texture = { pixels, width, height, daylight: true };
        } catch {
          // The vector texture remains available if the raster cannot be decoded.
        }
      }
      this.invalidate();
    };
    image.src = new URL('./earth-day.jpg', import.meta.url).href;
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

  getZoom() {
    return this.scale;
  }

  setAutoRotate(enabled) {
    this.autoRotate = enabled;
    this.lastFrame = undefined;
    this.invalidate();
  }

  focus(lat, lon, { scale = this.scale } = {}) {
    this.setAutoRotate(false);
    const targetScale = Number.isFinite(scale) ? clamp(scale, MIN_ZOOM, MAX_ZOOM) : this.scale;
    if (this.motion.matches) {
      this.angles = { lat, lon };
      this.applyZoom(targetScale);
      this.flight = null;
    } else {
      this.flight = { start: performance.now(), from: { ...this.angles, scale: this.scale }, lat, lon, scale: targetScale };
    }
    this.invalidate();
  }

  zoom(factor) {
    if (!Number.isFinite(factor) || factor <= 0) return;
    if (this.flight) {
      const { lat, lon, scale } = this.flight;
      this.focus(lat, lon, { scale: scale * factor });
      return;
    }
    this.applyZoom(clamp(this.scale * factor, MIN_ZOOM, MAX_ZOOM));
    this.invalidate();
  }

  applyZoom(scale) {
    this.scale = scale;
    this.radius = this.fitRadius * scale;
  }

  reset() {
    this.applyZoom(1);
    this.focus(START.lat, START.lon);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.width = rect.width;
    this.height = rect.height;
    this.ratio = Math.min(devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(this.width * this.ratio);
    const pixelHeight = Math.round(this.height * this.ratio);
    if (this.canvas.width !== pixelWidth) this.canvas.width = pixelWidth;
    if (this.canvas.height !== pixelHeight) this.canvas.height = pixelHeight;
    this.cx = this.width / 2;
    this.cy = this.height / 2;
    const shortEdge = Math.min(this.width, this.height);
    const margin = clamp(shortEdge * 0.035, 10, 24);
    this.fitRadius = Math.max(1, shortEdge / 2 - margin);
    this.applyZoom(this.scale);
    this.invalidate();
  }

  prepareSoftwareSurface() {
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
  }

  invalidate() {
    if (!this.frame) this.frame = requestAnimationFrame((now) => this.draw(now));
  }

  draw(now) {
    this.frame = 0;
    if (!this.radius) return;
    if (this.flight) {
      const { from, lat, lon, start, scale } = this.flight;
      const progress = clamp((now - start) / 620, 0, 1);
      const ease = (1 - Math.cos(Math.PI * progress)) / 2;
      this.angles = { lat: from.lat + (lat - from.lat) * ease, lon: longitude(from.lon + longitude(lon - from.lon) * ease) };
      this.applyZoom(progress === 1 ? scale : from.scale * (scale / from.scale) ** ease);
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

    const earth = this.earth?.draw(this);
    if (earth) context.drawImage(earth, 0, 0, width, height);
    else this.drawSoftware();

    const rim = context.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
    rim.addColorStop(0, '#adc7ffcf');
    rim.addColorStop(0.55, '#7a9afa80');
    rim.addColorStop(1, '#5d6dae39');
    context.strokeStyle = rim;
    context.lineWidth = 1.2;
    context.beginPath();
    context.arc(cx, cy, radius, 0, TAU);
    context.stroke();
    this.drawGeography?.(context, this);
    this.drawPlaces();
    if (this.picking) this.drawReticle();
    if (this.flight || this.autoRotate) this.invalidate();
  }

  drawSoftware() {
    this.prepareSoftwareSurface();
    const { context, cx, cy, radius } = this;
    const cosLat = Math.cos(this.angles.lat * RAD);
    const sinLat = Math.sin(this.angles.lat * RAD);
    const viewLon = this.angles.lon * RAD;
    const { pixels: texture, width, height, daylight } = this.texture;
    const pixels = this.spherePixels.data;
    for (let ray = 0, pixel = 0; ray < this.rays.length; ray += 3, pixel += 4) {
      const z = this.rays[ray + 2];
      if (z < 0) continue;
      const x = this.rays[ray];
      const y = this.rays[ray + 1];
      const lat = Math.asin(clamp(y * cosLat + z * sinLat, -1, 1));
      const lon = viewLon + Math.atan2(x, z * cosLat - y * sinLat);
      const u = Math.floor((lon / TAU + 1.5) * width) % width;
      const v = Math.min(height - 1, Math.floor((0.5 - lat / Math.PI) * height));
      const texel = (v * width + u) * 4;
      const light = Math.max(0, z * 0.85 - x * 0.37 + y * 0.38);
      const limb = Math.pow(1 - z, 4) * (0.5 + Math.max(0, -x + y) * 0.48);
      const shade = daylight ? 0.64 + light * 0.47 : 0.44 + light * 0.72;
      pixels[pixel] = texture[texel] * shade + limb * 41;
      pixels[pixel + 1] = texture[texel + 1] * shade + limb * 58;
      pixels[pixel + 2] = texture[texel + 2] * shade + limb * 105;
      pixels[pixel + 3] = 255;
    }
    this.sphereContext.putImageData(this.spherePixels, 0, 0);
    context.save();
    context.beginPath();
    context.arc(cx, cy, radius, 0, TAU);
    context.clip();
    context.drawImage(this.sphere, cx - radius, cy - radius, 2 * radius, 2 * radius);
    context.restore();
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
    const { context, width, height } = this;
    const details = [];
    this.markers = this.places.flatMap((place) => {
      if (place.detail && this.scale < DETAIL_ZOOM) return [];
      const point = this.project(place.lat, place.lon);
      if (!point?.visible || point.depth < 0.025) return [];
      const active = place.id === this.active;
      const style = place.draft ? 'draft' : place.detail ? 'detail' : active ? 'active' : 'saved';
      const marker = { ...place, ...point, emphasized: Boolean(active || place.draft), colors: MARKER_COLORS[style] };
      if (place.detail) {
        const clearsDetails = (x, y) => details.every((other) => Math.hypot(other.x - x, other.y - y) >= 14);
        if (!clearsDetails(point.x, point.y)) {
          // Separate coincident display pins while preserving their geographic anchor.
          const offset = DETAIL_OFFSETS.find(([dx, dy]) => {
            const x = point.x + dx;
            const y = point.y + dy;
            return x >= 8 && y >= 8 && x <= width - 8 && y <= height - 8 &&
              Math.hypot(x - this.cx, y - this.cy) <= this.radius - 5 && clearsDetails(x, y);
          });
          if (offset) {
            marker.anchor = point;
            marker.x += offset[0];
            marker.y += offset[1];
          }
        }
        details.push(marker);
      }
      return [marker];
    }).sort((a, b) => Number(Boolean(a.detail)) - Number(Boolean(b.detail)) ||
      Number(a.emphasized) - Number(b.emphasized) || a.depth - b.depth);

    const drawnLabels = [];
    for (const marker of this.markers) {
      const { x, y, emphasized, colors, anchor } = marker;
      if (anchor) {
        context.beginPath();
        context.moveTo(anchor.x, anchor.y);
        context.lineTo(x, y);
        context.strokeStyle = colors.ring;
        context.lineWidth = 1;
        context.stroke();
      }
      context.beginPath();
      context.arc(x, y, emphasized ? 17 : 10, 0, TAU);
      context.fillStyle = colors.halo;
      context.fill();
      const overlappingDetail = !marker.detail && details.some((detail) => Math.hypot(detail.x - x, detail.y - y) < 8);
      const ring = colors.ring || (overlappingDetail ? '#ffda7c94' : null);
      if (ring) {
        context.strokeStyle = ring;
        context.lineWidth = 1;
        context.stroke();
      }
      const dot = emphasized ? 5.5 : 4;
      context.beginPath();
      if (marker.detail) {
        context.moveTo(x, y - dot - 1);
        context.lineTo(x + dot + 1, y);
        context.lineTo(x, y + dot + 1);
        context.lineTo(x - dot - 1, y);
        context.closePath();
      } else {
        context.arc(x, y, dot, 0, TAU);
      }
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
      const right = x + 12;
      const leftOfPin = x - labelWidth - 12;
      const rightFits = right + labelWidth <= width - 2;
      const firstSide = rightFits && !(details.length && !marker.detail && emphasized) ? right : leftOfPin;
      const otherSide = firstSide === right ? leftOfPin : right;
      const positions = details.length ? [y - 11, y + 13, y - 35].flatMap((top) =>
        [firstSide, otherSide].map((left) => ({ left, top }))) : [{ left: firstSide, top: y - 11 }];
      const position = positions.find(({ left, top }) => {
        if (left < 0 || top < 0 || left + labelWidth > width || top + 22 > height) return false;
        const overlaps = drawnLabels.some((item) => left < item.left + item.width + 4 && left + labelWidth > item.left - 4 && Math.abs(top - item.top) < 24);
        const coversPin = details.length && this.markers.some((other) => other.x >= left - 5 && other.x <= left + labelWidth + 5 &&
          other.y >= top - 5 && other.y <= top + 27);
        return !overlaps && !coversPin;
      });
      if (!position) continue;
      const { left, top } = position;
      marker.label = { ...position, width: labelWidth };
      drawnLabels.push(marker.label);
      context.beginPath();
      context.roundRect(left, top, labelWidth, 22, 8);
      context.fillStyle = colors.badge;
      context.fill();
      context.strokeStyle = colors.border;
      context.stroke();
      context.fillStyle = colors.text;
      context.textBaseline = 'middle';
      context.fillText(label, left + 7, top + 11.3);
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
    let labelHit;
    let distance = 19;
    for (const marker of [...this.markers].reverse()) {
      if (marker.draft || (marker.detail && this.scale < DETAIL_ZOOM)) continue;
      const { label } = marker;
      if (label && x >= label.left && x <= label.left + label.width && y >= label.top && y <= label.top + 22) {
        labelHit = marker;
      }
      const nextDistance = Math.hypot(marker.x - x, marker.y - y);
      const score = nextDistance - (marker.detail ? 3 : 0);
      if (nextDistance < 19 && score < distance) {
        nearest = marker;
        distance = score;
      }
    }
    const selected = this.scale >= DETAIL_ZOOM ? labelHit || nearest : nearest || labelHit;
    if (selected) {
      this.onSelect?.(selected.id);
      return;
    }
    if (this.onCountry && this.findCountry) {
      const coordinates = this.unproject(x, y);
      if (!coordinates) return;
      const country = this.findCountry(coordinates.lat, coordinates.lon);
      if (country) this.onCountry(country);
    }
  }

  handleWheel(event) {
    event.preventDefault();
    this.interact();
    const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.height : 1;
    const delta = event.deltaY * units;
    const scroll = this.streetScroll;
    if (delta >= 0 || this.scale < MAX_ZOOM || this.picking || !this.onStreetZoom) {
      scroll.distance = 0;
      this.zoom(Math.exp(clamp(-delta * 0.0013, -0.3, 0.3)));
      return;
    }

    const now = performance.now();
    if (now < scroll.readyAt) return;
    if (now - scroll.lastAt > STREET_SCROLL_WINDOW) scroll.distance = 0;
    scroll.lastAt = now;
    scroll.distance -= delta;
    if (scroll.distance < STREET_SCROLL_DISTANCE) return;

    scroll.distance = 0;
    scroll.readyAt = now + STREET_SCROLL_COOLDOWN;
    const rect = this.canvas.getBoundingClientRect();
    const coordinates = this.unproject(event.clientX - rect.left, event.clientY - rect.top);
    this.onStreetZoom(coordinates || this.getCenter());
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
    canvas.addEventListener('wheel', (event) => this.handleWheel(event), { passive: false });
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
