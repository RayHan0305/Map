import { samples } from './samples.mjs';
import { mergeBackupRecords, readBackupRecords } from './storage.mjs';

const format = 'beiki-map-photo-backup';
const version = 1;
const samplePhotoIds = new Set(samples.flatMap(({ photos }) => photos.map(({ id }) => id)));

function invalid() {
  return new Error('备份文件格式有误或内容不完整。请选择由贝Ki-Map 导出的备份文件。');
}

function objectValue(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  return value;
}

function textValue(value, required = false) {
  if (typeof value !== 'string' || (required && !value.trim())) throw invalid();
  return value;
}

function coordinates(value) {
  const { lat, lon } = objectValue(value);
  if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lon) || Math.abs(lon) > 180) {
    throw invalid();
  }
  return { lat, lon };
}

function locationRecord(value) {
  const { id, name, region = '' } = objectValue(value);
  return { id: textValue(id, true), name: textValue(name, true), region: textValue(region), ...coordinates(value) };
}

function placeRecord(value) {
  const place = locationRecord(value);
  if (value.city !== undefined) place.city = locationRecord(value.city);
  if (value.exact !== undefined) {
    if (typeof value.exact !== 'boolean') throw invalid();
    place.exact = value.exact;
  }
  return place;
}

function blobValue(value, name) {
  const { type, base64, lastModified } = objectValue(value);
  if (typeof type !== 'string' || (type && !/^image\//.test(type))
    || typeof base64 !== 'string' || !base64 || base64.length % 4 !== 0 || /\s/.test(base64)) throw invalid();
  try {
    const bytes = Uint8Array.fromBase64
      ? Uint8Array.fromBase64(base64, { lastChunkHandling: 'strict' })
      : Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    if (lastModified !== undefined) {
      if (!name || !Number.isSafeInteger(lastModified)) throw invalid();
      return new File([bytes], name, { type, lastModified });
    }
    return new Blob([bytes], { type });
  } catch {
    throw invalid();
  }
}

function photoRecord(value) {
  const { id, placeId, name, date = '', note = '', addedAt, position, blob, location } = objectValue(value);
  if (!Number.isFinite(addedAt) || !Number.isSafeInteger(position) || position < 0) throw invalid();
  const photo = {
    id: textValue(id, true), placeId: textValue(placeId, true),
    name: textValue(name, true), date: textValue(date), note: textValue(note),
    addedAt, position, blob: blobValue(blob, name),
  };
  if (location !== undefined) {
    photo.location = coordinates(location);
    if (location.label !== undefined) photo.location.label = textValue(location.label);
  }
  return photo;
}

function cropValue(value) {
  if (value === null) return null;
  const { x, y, width, height } = objectValue(value);
  if (![x, y, width, height].every(Number.isFinite)
    || x < 0 || y < 0 || width <= 0 || height <= 0
    || x + width > 1.000001 || y + height > 1.000001) throw invalid();
  return { x, y, width, height };
}

function editRecord(value) {
  const { id, rotation, crop, note, blob } = objectValue(value);
  if (![0, 90, 180, 270].includes(rotation)) throw invalid();
  const edit = { id: textValue(id, true), rotation, crop: cropValue(crop), note: textValue(note) };
  if (blob !== undefined) edit.blob = blobValue(blob);
  if ((rotation || edit.crop) && !edit.blob) throw invalid();
  return edit;
}

function checkedRecords(list, readRecord) {
  if (!Array.isArray(list)) throw invalid();
  const ids = new Set();
  const records = list.map((value) => {
    const record = readRecord(value);
    if (ids.has(record.id)) throw invalid();
    ids.add(record.id);
    return record;
  });
  return { ids, records };
}

async function encodeBlob(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let base64;
  if (bytes.toBase64) base64 = bytes.toBase64();
  else {
    const pieces = [];
    const length = 12288; // A multiple of three avoids padding between pieces.
    for (let offset = 0; offset < bytes.length; offset += length) {
      pieces.push(btoa(String.fromCharCode(...bytes.subarray(offset, offset + length))));
    }
    base64 = pieces.join('');
  }
  return { type: blob.type, base64, ...(blob instanceof File && { lastModified: blob.lastModified }) };
}

async function writeRecords(parts, records) {
  parts.push('[');
  for (const [index, record] of records.entries()) {
    if (index) parts.push(',');
    const value = record.blob ? { ...record, blob: await encodeBlob(record.blob) } : record;
    parts.push(JSON.stringify(value));
  }
  parts.push(']');
}

export async function exportBackup() {
  try {
    const { places, photos, edits } = await readBackupRecords();
    const manifest = JSON.stringify({ format, version, places });
    const parts = [manifest.slice(0, -1), ',"photos":'];
    await writeRecords(parts, photos);
    parts.push(',"edits":');
    await writeRecords(parts, edits);
    parts.push('}');
    return new Blob(parts, { type: 'application/json' });
  } catch {
    throw new Error('无法导出相册备份。请检查浏览器是否允许访问本地相册，再试一次。');
  }
}

export async function importBackup(file) {
  let value;
  try {
    value = JSON.parse(await file.text());
  } catch {
    throw invalid();
  }
  const backup = objectValue(value);
  if (backup.format !== format) throw invalid();
  if (backup.version !== version) throw new Error('当前版本无法读取这份备份。请用更新的贝Ki-Map 打开。');

  const { ids: placeIds, records: places } = checkedRecords(backup.places, placeRecord);
  const { ids: photoIds, records: photos } = checkedRecords(backup.photos, photoRecord);
  const { records: edits } = checkedRecords(backup.edits, editRecord);
  if (photos.some(({ id, placeId }) => !placeIds.has(placeId) || samplePhotoIds.has(id))
    || edits.some(({ id }) => !photoIds.has(id) && !samplePhotoIds.has(id))) throw invalid();

  try {
    return await mergeBackupRecords({ places, photos, edits });
  } catch (error) {
    if (error?.name === 'QuotaExceededError') {
      throw new Error('浏览器存储空间不足，导入没有保存。请释放一些空间后重试。');
    }
    throw new Error('导入没有保存。请检查浏览器是否允许访问本地相册，再试一次。');
  }
}
