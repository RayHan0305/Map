import { coordinateScale, countryRecords } from './country-rings.mjs';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const normalize = (text) => text.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]/gu, '');

const countries = countryRecords.map(([code, name, lat, lon, region, aliases, bounds, paths]) => ({
  place: { id: 'country-' + code, name, lat, lon, region },
  names: [code, name, ...aliases].map(normalize),
  bounds,
  paths,
  rings: null,
}));
const byId = new Map(countries.map(({ place }) => [place.id, place]));

export function countryById(id) {
  const place = byId.get(id);
  return place ? { ...place } : null;
}

function matchScore(names, query) {
  if (names.includes(query)) return 0;
  if (names.some((name) => name.startsWith(query))) return 1;
  return names.some((name) => name.includes(query)) ? 2 : Infinity;
}

export function searchCountries(value) {
  const query = normalize(value ?? '');
  if (!query) return [];
  return countries.map(({ place, names }) => ({ place, score: matchScore(names, query) }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((first, second) => first.score - second.score)
    .slice(0, 6)
    .map(({ place }) => ({ ...place }));
}

function unpackRing(path) {
  // Coordinate deltas are zigzag-signed varints with five payload bits per character.
  const coordinates = [];
  const axes = [0, 0];
  let axis = 0;
  let partial = 0;
  let shift = 0;
  for (const character of path) {
    const value = alphabet.indexOf(character);
    partial += (value & 31) * 2 ** shift;
    if (value & 32) {
      shift += 5;
      continue;
    }
    const delta = partial % 2 ? -(partial + 1) / 2 : partial / 2;
    axes[axis] += delta;
    coordinates.push(axes[axis]);
    axis = 1 - axis;
    partial = shift = 0;
  }

  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  for (let index = 0; index < coordinates.length; index += 2) {
    const x = coordinates[index];
    const y = coordinates[index + 1];
    bounds[0] = Math.min(bounds[0], x);
    bounds[1] = Math.min(bounds[1], y);
    bounds[2] = Math.max(bounds[2], x);
    bounds[3] = Math.max(bounds[3], y);
  }
  return { coordinates, bounds };
}

function includesPoint([left, bottom, right, top], x, y) {
  return x >= left && x <= right && y >= bottom && y <= top;
}

function ringHit({ coordinates, bounds }, x, y) {
  if (!includesPoint(bounds, x, y)) return 0;
  let inside = false;
  for (let index = 0, prior = coordinates.length - 2; index < coordinates.length; prior = index, index += 2) {
    const ax = coordinates[prior];
    const ay = coordinates[prior + 1];
    const bx = coordinates[index];
    const by = coordinates[index + 1];
    if (x >= Math.min(ax, bx) && x <= Math.max(ax, bx) && y >= Math.min(ay, by) && y <= Math.max(ay, by)
      && Math.abs((x - ax) * (by - ay) - (y - ay) * (bx - ax)) < 1e-7) return 2;
    if ((ay > y) !== (by > y) && x < ax + (y - ay) * (bx - ax) / (by - ay)) inside = !inside;
  }
  return inside ? 1 : 0;
}

function countryAt(x, y) {
  for (const country of countries) {
    if (!includesPoint(country.bounds, x, y)) continue;
    country.rings ??= country.paths.map(unpackRing);
    // Even/odd parity handles exterior rings, islands and interior holes together.
    let inside = false;
    for (const ring of country.rings) {
      const hit = ringHit(ring, x, y);
      if (hit === 2) return country.place;
      if (hit === 1) inside = !inside;
    }
    if (inside) return country.place;
  }
  return null;
}

export function findCountry(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const x = lon * coordinateScale;
  const y = lat * coordinateScale;
  const place = countryAt(x, y) ?? (Math.abs(lon) === 180 ? countryAt(-x, y) : null);
  return place ? { ...place } : null;
}
