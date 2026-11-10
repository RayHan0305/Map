const databaseName = 'travel-globe';
const placesStore = 'places';
const photosStore = 'photos';
const editsStore = 'photo-edits';
const byPlaceIndex = 'byPlace';

let connection;

function openDatabase() {
  connection ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 2);
    let blocked = false;
    request.onupgradeneeded = ({ oldVersion }) => {
      const database = request.result;
      if (oldVersion < 1) {
        database.createObjectStore(placesStore, { keyPath: 'id' });
        database.createObjectStore(photosStore, { keyPath: 'id' })
          .createIndex(byPlaceIndex, 'placeId');
      }
      database.createObjectStore(editsStore, { keyPath: 'id' });
    };
    request.onblocked = () => {
      blocked = true;
      reject(new Error('请关闭其他贝Ki-Map 标签页，再刷新以升级相册。'));
    };
    request.onsuccess = () => {
      const database = request.result;
      if (blocked) {
        database.close();
        return;
      }
      database.onversionchange = () => {
        database.close();
        connection = undefined;
      };
      resolve(database);
    };
    request.onerror = () => reject(request.error);
  }).catch((error) => {
    connection = undefined;
    throw error;
  });
  return connection;
}

function resultOf(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('照片保存已中止。'));
  });
}

function sortedPhotos(photos) {
  return photos.sort((first, second) => first.addedAt - second.addedAt || first.position - second.position);
}

export async function loadPlaces() {
  const database = await openDatabase();
  const transaction = database.transaction([placesStore, photosStore], 'readonly');
  const [places, photos] = await Promise.all([
    resultOf(transaction.objectStore(placesStore).getAll()),
    resultOf(transaction.objectStore(photosStore).getAll()),
    transactionDone(transaction),
  ]);

  const albums = new Map(places.map((place) => [place.id, { ...place, photos: [] }]));
  for (const photo of sortedPhotos(photos)) {
    albums.get(photo.placeId)?.photos.push(photo);
  }
  return Array.from(albums.values());
}

export async function loadPhotoEdits() {
  const database = await openDatabase();
  const transaction = database.transaction(editsStore, 'readonly');
  const [entries] = await Promise.all([
    resultOf(transaction.objectStore(editsStore).getAll()),
    transactionDone(transaction),
  ]);
  return new Map(entries.map(({ id, ...edit }) => [id, edit]));
}

export async function savePhotoEdit(id, edit) {
  const database = await openDatabase();
  const transaction = database.transaction(editsStore, 'readwrite');
  const store = transaction.objectStore(editsStore);
  await Promise.all([
    resultOf(edit === null ? store.delete(id) : store.put({ ...edit, id })),
    transactionDone(transaction),
  ]);
}

export async function savePhotos(place, files, { date = '', note = '', locations = [] } = {}) {
  const { id, name, region = '', lat, lon, city, exact } = place;
  if (!id || !name?.trim() || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error('请先选择一个有效地点。');
  }

  const addedAt = Date.now();
  const records = Array.from(files, (file, position) => ({
    id: globalThis.crypto?.randomUUID?.() ?? `${addedAt}-${position}-${Math.random().toString(36).slice(2)}`,
    placeId: id,
    blob: file,
    name: file.name ?? `照片 ${position + 1}`,
    date,
    note,
    addedAt,
    position,
    ...(locations[position] && { location: locations[position] }),
  }));
  if (!records.length) throw new Error('请至少选择一张照片。');

  const database = await openDatabase();
  const transaction = database.transaction([placesStore, photosStore], 'readwrite');
  const places = transaction.objectStore(placesStore);
  const photos = transaction.objectStore(photosStore);
  const storedPlace = { id, name: name.trim(), region, lat, lon, ...(city && { city }), ...(exact && { exact }) };

  // One transaction commits the place and the whole batch together. The keyed place
  // record is shared across uploads, while each photo has its own independent key.
  const requests = [resultOf(places.put(storedPlace))];
  for (const record of records) requests.push(resultOf(photos.add(record)));
  const [album] = await Promise.all([
    resultOf(photos.index(byPlaceIndex).getAll(id)),
    transactionDone(transaction),
    ...requests,
  ]);
  return { ...storedPlace, photos: sortedPhotos(album) };
}
