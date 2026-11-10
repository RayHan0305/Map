// Exif GPS IFD tags use TIFF byte order and unsigned rational DMS values.
const gpsDirectoryTag = 0x8825;
const maximumDirectoryEntries = 512;
const maximumHeaders = 512;

async function readView(blob, offset, length) {
  if (offset < 0 || length <= 0 || offset + length > blob.size) return null;
  return new DataView(await blob.slice(offset, offset + length).arrayBuffer());
}

async function readDirectory(blob, offset, littleEndian) {
  if (offset < 8) return null;
  const header = await readView(blob, offset, 2);
  const count = header?.getUint16(0, littleEndian);
  if (!count || count > maximumDirectoryEntries) return null;
  // The directory also ends in a four-byte next-directory pointer.
  return readView(blob, offset + 2, count * 12 + 4);
}

function findField(directory, tag, type, littleEndian) {
  for (let offset = 0; offset + 12 <= directory.byteLength; offset += 12) {
    if (directory.getUint16(offset, littleEndian) !== tag || directory.getUint16(offset + 2, littleEndian) !== type) continue;
    return { count: directory.getUint32(offset + 4, littleEndian), value: offset + 8 };
  }
  return null;
}

async function readAngle(blob, directory, refTag, rationalTag, littleEndian, positive, negative, limit) {
  const ref = findField(directory, refTag, 2, littleEndian);
  const angle = findField(directory, rationalTag, 5, littleEndian);
  if (!ref || ref.count < 1 || ref.count > 2 || angle?.count !== 3) return null;
  if (ref.count === 2 && directory.getUint8(ref.value + 1) !== 0) return null;

  const direction = String.fromCharCode(directory.getUint8(ref.value)).toUpperCase();
  if (direction !== positive && direction !== negative) return null;
  const offset = directory.getUint32(angle.value, littleEndian);
  if (offset < 8) return null;
  const rationals = await readView(blob, offset, 24);
  if (!rationals) return null;

  const components = [];
  for (let index = 0; index < 24; index += 8) {
    const denominator = rationals.getUint32(index + 4, littleEndian);
    if (denominator === 0) return null;
    components.push(rationals.getUint32(index, littleEndian) / denominator);
  }
  const [degrees, minutes, seconds] = components;
  const decimal = degrees + minutes / 60 + seconds / 3600;
  if (minutes >= 60 || seconds >= 60 || decimal > limit) return null;
  return direction === negative && decimal !== 0 ? -decimal : decimal;
}

async function readTiffGps(blob) {
  const header = await readView(blob, 0, 8);
  if (!header) return null;
  const byteOrder = header.getUint16(0);
  if (byteOrder !== 0x4949 && byteOrder !== 0x4d4d) return null;
  const littleEndian = byteOrder === 0x4949;
  if (header.getUint16(2, littleEndian) !== 42) return null;

  const imageDirectory = await readDirectory(blob, header.getUint32(4, littleEndian), littleEndian);
  if (!imageDirectory) return null;
  const gps = findField(imageDirectory, gpsDirectoryTag, 4, littleEndian);
  if (gps?.count !== 1) return null;
  const directory = await readDirectory(blob, imageDirectory.getUint32(gps.value, littleEndian), littleEndian);
  if (!directory) return null;

  const [lat, lon] = await Promise.all([
    readAngle(blob, directory, 1, 2, littleEndian, 'N', 'S', 90),
    readAngle(blob, directory, 3, 4, littleEndian, 'E', 'W', 180),
  ]);
  return lat === null || lon === null ? null : { lat, lon };
}

function hasExifPrefix(view) {
  return view && view.getUint32(0) === 0x45786966 && view.getUint16(4) === 0; // Exif\0\0
}

async function readJpegGps(blob) {
  let offset = 2;
  for (let step = 0; step < maximumHeaders; step++) {
    const header = await readView(blob, offset, 4);
    if (!header || header.getUint8(0) !== 0xff) break;
    const marker = header.getUint8(1);
    if (marker === 0xda || marker === 0xd9 || marker === 0) break;
    if (marker === 0xff) {
      offset++;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }

    const length = header.getUint16(2);
    const end = offset + 2 + length;
    if (length < 2 || end > blob.size) break;
    const payload = offset + 4;
    if (marker === 0xe1 && length >= 16 && hasExifPrefix(await readView(blob, payload, 6))) {
      const coordinates = await readTiffGps(blob.slice(payload + 6, end));
      if (coordinates) return coordinates;
    }
    offset = end;
  }
  return null;
}

async function readChunkedGps(blob, initialHeader, webp) {
  const limit = webp ? initialHeader.getUint32(4, true) + 8 : blob.size;
  if (limit > blob.size) return null;
  let offset = webp ? 12 : 8;
  for (let step = 0; step < maximumHeaders && offset + 8 <= limit; step++) {
    const header = await readView(blob, offset, 8);
    const type = header.getUint32(webp ? 0 : 4);
    const length = header.getUint32(webp ? 4 : 0, webp);
    const payload = offset + 8;
    const end = payload + length;
    const next = end + (webp ? length % 2 : 4); // RIFF pad byte or PNG CRC
    if (next > limit || (!webp && type === 0x49454e44)) break; // PNG IEND
    if (type === (webp ? 0x45584946 : 0x65584966)) { // EXIF / eXIf
      const prefix = length >= 6 && hasExifPrefix(await readView(blob, payload, 6));
      return readTiffGps(blob.slice(payload + (prefix ? 6 : 0), end));
    }
    offset = next;
  }
  return null;
}

/** Reads embedded GPS coordinates without reading or decoding the image pixels. */
export async function readPhotoCoordinates(file) {
  try {
    const header = await readView(file, 0, Math.min(file.size, 12));
    if (!header || header.byteLength < 2) return null;
    const start = header.getUint16(0);
    if (start === 0xffd8) return await readJpegGps(file);
    if (start === 0x4949 || start === 0x4d4d) return await readTiffGps(file);
    if (header.byteLength >= 8 && header.getUint32(0) === 0x89504e47 && header.getUint32(4) === 0x0d0a1a0a) {
      return await readChunkedGps(file, header, false);
    }
    if (header.byteLength >= 12 && header.getUint32(0) === 0x52494646 && header.getUint32(8) === 0x57454250) {
      return await readChunkedGps(file, header, true);
    }
    return null;
  } catch {
    // Unsupported or damaged metadata should leave the photo available for manual placement.
    return null;
  }
}
