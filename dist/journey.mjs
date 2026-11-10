const dayPattern = /^\d{4}-\d{2}-\d{2}$/;

function photoDay({ date, addedAt }) {
  if (dayPattern.test(date ?? '')) {
    const calendarDay = new Date(date + 'T00:00:00Z');
    if (Number.isFinite(calendarDay.getTime()) && calendarDay.toISOString().slice(0, 10) === date) return date;
  }
  if (!Number.isFinite(addedAt)) return null;
  const added = new Date(addedAt);
  if (!Number.isFinite(added.getTime())) return null;
  const year = String(added.getFullYear()).padStart(4, '0');
  const month = String(added.getMonth() + 1).padStart(2, '0');
  const day = String(added.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

export function buildJourney(albums) {
  const days = new Map();
  const source = albums instanceof Map ? albums.values() : albums;
  for (const album of source) {
    const pointByPhoto = new Map();
    for (const point of album.points ?? []) {
      for (const photo of point.photos) pointByPhoto.set(photo.id ?? photo, point);
    }
    for (const photo of album.photos ?? []) {
      const date = photoDay(photo);
      if (!days.has(date)) days.set(date, { date, entries: [] });
      const point = pointByPhoto.get(photo.id ?? photo);
      days.get(date).entries.push({
        albumId: album.id,
        city: album.name,
        region: album.region ?? '',
        lat: point?.lat ?? album.lat,
        lon: point?.lon ?? album.lon,
        pointId: point?.id ?? null,
        photo,
        demo: Boolean(album.demo),
      });
    }
  }

  return [...days.values()].sort((first, second) => (second.date ?? '').localeCompare(first.date ?? '')).map(({ date, entries }) => ({
    date,
    entries: entries.sort((first, second) => (second.photo.addedAt ?? 0) - (first.photo.addedAt ?? 0)
      || (first.photo.position ?? 0) - (second.photo.position ?? 0)),
  }));
}
