import { samples } from './samples.mjs';

const presetIds = new Set(samples.map(({ id }) => id));
const photoUrls = new Map();

export function albumPlaces(savedPlaces, edits) {
  const ordered = [
    ...samples.map((place) => savedPlaces.get(place.id) ?? place),
    ...[...savedPlaces.values()].filter(({ id }) => !presetIds.has(id)),
  ];
  return ordered.map((place) => ({
    ...place,
    photos: place.photos.map((photo) => edits.has(photo.id) ? { ...photo, edit: edits.get(photo.id) } : photo),
  }));
}

export function photoNote(photo) {
  return photo.edit?.note ?? photo.note ?? '';
}

export function photoUrl(photo) {
  const blob = photo.edit?.blob ?? photo.blob;
  const cached = photoUrls.get(photo.id);
  if (cached && cached.blob === blob) return cached.url;
  if (cached) {
    URL.revokeObjectURL(cached.url);
    photoUrls.delete(photo.id);
  }
  if (!blob) return photo.src;
  const url = URL.createObjectURL(blob);
  photoUrls.set(photo.id, { blob, url });
  return url;
}

export function photoImage(photo, alt = '') {
  const image = document.createElement('img');
  image.alt = alt;
  image.src = photoUrl(photo);
  image.loading = 'lazy';
  image.decoding = 'async';
  return image;
}
