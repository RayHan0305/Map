import { countryBorders, countryLabels, cityLabels } from './geography-data.mjs';

const continents = [
  ['亚洲', 51, 105, 0], ['欧洲', 55, 17, 0], ['非洲', 1, 21, 0],
  ['北美洲', 54, -102, 0], ['南美洲', -16, -62, 0], ['大洋洲', -24, 143, 0],
  ['南极洲', -79, 0, 0],
];

const fontFamily = 'system-ui, "Microsoft YaHei", "PingFang SC", sans-serif';
const labelWidths = new Map();

function drawBorders(context, globe) {
  context.beginPath();
  for (const line of countryBorders) {
    let previous = null;
    for (const [lon, lat] of line) {
      const point = globe.project(lat, lon);
      if (!point) continue;
      if (!previous || previous.depth < 0) {
        if (point.depth >= 0) {
          if (previous) {
            const fraction = previous.depth / (previous.depth - point.depth);
            context.moveTo(previous.x + (point.x - previous.x) * fraction, previous.y + (point.y - previous.y) * fraction);
            context.lineTo(point.x, point.y);
          } else {
            context.moveTo(point.x, point.y);
          }
        }
      } else if (point.depth >= 0) {
        context.lineTo(point.x, point.y);
      } else {
        const fraction = previous.depth / (previous.depth - point.depth);
        context.lineTo(previous.x + (point.x - previous.x) * fraction, previous.y + (point.y - previous.y) * fraction);
      }
      previous = point;
    }
  }
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.strokeStyle = 'rgba(17, 35, 54, 0.55)';
  context.lineWidth = globe.scale >= 1.4 ? 1.75 : 1.45;
  context.stroke();
  context.strokeStyle = 'rgba(231, 246, 255, 0.59)';
  context.lineWidth = globe.scale >= 1.4 ? 0.95 : 0.75;
  context.stroke();
}

function labelWidth(context, name) {
  const key = `${context.font}:${name}`;
  if (!labelWidths.has(key)) labelWidths.set(key, context.measureText(name).width);
  return labelWidths.get(key);
}

function overlaps(first, second) {
  return first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top;
}

function drawLabels(context, globe, occupied, labels, { rank, limit, size, weight, color, dot = false }) {
  if (!limit) return;
  context.font = `${weight} ${size}px ${fontFamily}`;
  context.textAlign = dot ? 'left' : 'center';
  context.textBaseline = 'middle';
  context.strokeStyle = 'rgba(8, 22, 38, 0.94)';
  context.fillStyle = color;
  context.lineWidth = dot ? 2.5 : 3.2;
  let shown = 0;

  const candidates = [];
  for (const [name, lat, lon, priority] of labels) {
    if (priority > rank) continue;
    const point = globe.project(lat, lon);
    if (point?.visible && point.depth > 0.26) candidates.push({ name, point, priority });
  }
  candidates.sort((first, second) => first.priority - second.priority || second.point.depth - first.point.depth);

  for (const { name, point } of candidates) {
    const { x, y } = point;
    const width = labelWidth(context, name);
    const textX = dot ? x + 6 : x;
    const box = {
      left: dot ? x - 5 : x - width / 2 - 5,
      right: dot ? textX + width + 5 : x + width / 2 + 5,
      top: y - size / 2 - 4,
      bottom: y + size / 2 + 4,
    };
    if (box.left < 5 || box.right > globe.width - 5 || box.top < 5 || box.bottom > globe.height - 5) continue;
    const outerX = Math.max(Math.abs(box.left - globe.cx), Math.abs(box.right - globe.cx));
    const outerY = Math.max(Math.abs(box.top - globe.cy), Math.abs(box.bottom - globe.cy));
    if (Math.hypot(outerX, outerY) > globe.radius - 4 || occupied.some((other) => overlaps(box, other))) continue;

    occupied.push(box);
    if (dot) {
      context.beginPath();
      context.arc(x, y, 1.5, 0, 2 * Math.PI);
      context.fill();
    }
    context.strokeText(name, textX, y);
    context.fillText(name, textX, y);
    shown++;
    if (shown === limit) break;
  }
}

export function drawGeography(context, globe) {
  if (!globe.radius) return;

  context.save();
  drawBorders(context, globe);
  const compact = globe.width < 490;
  const zoomed = globe.scale >= 1.4;
  const occupied = [];
  for (const { lat, lon } of globe.places ?? []) {
    const point = globe.project(lat, lon);
    if (!point?.visible) continue;
    occupied.push({ left: point.x - 13, right: point.x + 47, top: point.y - 12, bottom: point.y + 12 });
  }

  if (globe.scale < 1.85) {
    drawLabels(context, globe, occupied, continents, {
      rank: 0, limit: compact ? 2 : 3, size: compact ? 13 : 15, weight: 800, color: '#eafff7',
    });
  }
  drawLabels(context, globe, occupied, countryLabels, {
    rank: zoomed ? 8 : 4, limit: compact ? 6 : 10, size: compact ? 11 : 12, weight: 750, color: '#fff6d7',
  });
  drawLabels(context, globe, occupied, cityLabels, {
    rank: zoomed ? 7 : 2, limit: globe.scale < 0.9 ? 0 : compact ? (zoomed ? 7 : 3) : (zoomed ? 12 : 5),
    size: compact ? 9 : 10, weight: 650, color: '#dceeff', dot: true,
  });
  context.restore();
}
