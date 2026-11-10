function hasCoordinates(position) {
  return Number.isFinite(position?.lat) && Math.abs(position.lat) <= 90
    && Number.isFinite(position?.lon) && Math.abs(position.lon) <= 180;
}

function coordinateKey({ lat, lon }) {
  const roundedLat = Number(lat.toFixed(6));
  const roundedLon = Number(lon.toFixed(6));
  return [roundedLat, roundedLon === 180 ? -180 : roundedLon].join(',');
}

export function buildAlbums(places) {
  const groupedPlaces = new Map();
  for (const place of places) {
    const id = place.city?.id || place.id;
    const group = groupedPlaces.get(id) || [];
    group.push(place);
    groupedPlaces.set(id, group);
  }

  const albums = new Map();
  for (const [id, group] of groupedPlaces) {
    const canonical = group.find((place) => place.id === id && !place.demo)
      || group.find((place) => place.id === id);
    const city = group.find((place) => place.city?.id === id)?.city;
    const descriptor = city || canonical || group[0];
    const { name, region = '', lat, lon } = descriptor;
    const base = canonical || { id, name, region, lat, lon };

    const realPlaces = group.filter((place) => !place.demo && place.photos?.length);
    const sources = realPlaces.length ? realPlaces : group.filter((place) => place.demo);
    const entries = sources
      .flatMap((place) => (place.photos || []).map((photo) => ({ place, photo })))
      .sort((a, b) => (a.photo.addedAt ?? 0) - (b.photo.addedAt ?? 0)
        || (a.photo.position ?? 0) - (b.photo.position ?? 0));
    if (!entries.length) continue;

    const points = new Map();
    for (const { place, photo } of entries) {
      const exact = place.exact === true || place.id.startsWith('pin-');
      const location = hasCoordinates(photo.location) ? photo.location : exact && place;
      if (!hasCoordinates(location)) continue;
      const key = coordinateKey(location);
      if (!points.has(key)) {
        points.set(key, {
          id: id + ':point:' + key,
          name: location.label?.trim() || (exact ? place.name : '拍摄点 ' + (points.size + 1)),
          lat: location.lat,
          lon: location.lon,
          count: 0,
          photos: [],
          detail: true,
        });
      }
      const point = points.get(key);
      point.photos.push(photo);
      point.count = point.photos.length;
    }

    albums.set(id, {
      id,
      name,
      region,
      lat,
      lon,
      base,
      photos: entries.map(({ photo }) => photo),
      points: [...points.values()],
      demo: !realPlaces.length && entries.length > 0,
    });
  }
  return albums;
}
