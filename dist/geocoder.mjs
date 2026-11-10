// komoot's Photon demo accepts low-volume project traffic. This module is
// called when a visitor submits a location search.
const photonEndpoint = 'https://photon.komoot.io/api/';
const searchCache = new Map();
const coordinatePair = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*[,、;\s]\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))$/u;

function validCoordinates(lat, lon) {
  return Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lon) && Math.abs(lon) <= 180;
}

export function parseCoordinates(query) {
  const match = query.normalize('NFKC').trim().replace(/−/g, '-').match(coordinatePair);
  if (!match) return null;

  const lat = Number(match[1]);
  const lon = Number(match[2]);
  return validCoordinates(lat, lon) ? { lat, lon } : null;
}

function coordinateKey(lat, lon) {
  const wrappedLongitude = lon === 180 ? -180 : lon;
  return [lat, wrappedLongitude].map((value) => Math.round(value * 1e6)).join(':');
}

function photonPlace(feature) {
  const [lon, lat] = feature.geometry?.coordinates ?? [];
  if (!validCoordinates(lat, lon)) return null;

  const properties = feature.properties ?? {};
  const { osm_type: osmType, osm_id: osmId, name: label, street, housenumber, type } = properties;
  const address = [street, housenumber].filter(Boolean).join(' ');
  const name = label || address || properties.postcode || properties.city;
  if (!name) return null;

  const area = [properties.district, properties.city, properties.county, properties.state,
    properties.postcode, properties.country || properties.countrycode];
  const region = Array.from(new Set([address, ...area].filter((part) => part && part !== name))).join(' · ');
  const id = osmType && osmId != null ? `${osmType}-${osmId}` : coordinateKey(lat, lon);
  const house = type === 'house' && housenumber ? `-${housenumber}` : '';
  const isCity = ['city', 'town', 'village', 'hamlet'].includes(type);
  const exact = Boolean(type && !isCity && !['country', 'state', 'county', 'district', 'postcode'].includes(type));
  const cityName = isCity ? name : properties.city;
  const cityArea = [properties.state, properties.country || properties.countrycode].filter(Boolean).join(' · ');
  return {
    id: `osm-${id}${house}`, name, region, lat, lon, exact, isCity, isCountry: type === 'country',
    ...(cityName && { cityHint: { name: cityName, region: cityArea } }),
  };
}

export async function searchGlobalPlaces(query, { signal } = {}) {
  signal?.throwIfAborted();
  const term = query.trim().replace(/\s+/g, ' ');
  const coordinates = parseCoordinates(term);
  if (coordinates) {
    const { lat, lon } = coordinates;
    return [{ id: `coordinates-${coordinateKey(lat, lon)}`, name: `${lat}, ${lon}`, region: '自定义坐标', lat, lon }];
  }
  if (term.length < 2) return [];

  const cacheKey = term.normalize('NFC').toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached) return cached.map((place) => ({ ...place }));

  const url = new URL(photonEndpoint);
  url.search = new URLSearchParams({ q: term, limit: '8' });
  const timeout = AbortSignal.timeout(7500);
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });
  if (!response.ok) throw new Error(`地点搜索服务返回 ${response.status}。`);

  const { features } = await response.json();
  if (!Array.isArray(features)) throw new Error('地点搜索服务返回了无法读取的结果。');
  const places = new Map();
  for (const feature of features) {
    const place = photonPlace(feature);
    if (place && !places.has(place.id)) places.set(place.id, place);
  }
  const results = Array.from(places.values());
  if (searchCache.size >= 64) searchCache.delete(searchCache.keys().next().value);
  searchCache.set(cacheKey, results);
  return results.map((place) => ({ ...place }));
}
