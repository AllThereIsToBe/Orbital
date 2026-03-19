const DB_NAME = "orbital-materials";
const STORE_NAME = "files";

interface StoredMaterialFile {
  materialId: string;
  name: string;
  type: string;
  blob: Blob;
}

const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, 1);

    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "materialId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });

export const saveMaterialFile = async (materialId: string, file: File) => {
  const db = await openDb();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const payload: StoredMaterialFile = {
      materialId,
      name: file.name,
      type: file.type,
      blob: file
    };

    store.put(payload);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });

  db.close();
};

export const readMaterialFile = async (materialId: string) => {
  const db = await openDb();

  const record = await new Promise<StoredMaterialFile | undefined>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(materialId);

    request.onsuccess = () => resolve(request.result as StoredMaterialFile | undefined);
    request.onerror = () => reject(request.error);
  });

  db.close();

  if (!record) {
    return undefined;
  }

  return new File([record.blob], record.name, { type: record.type });
};

export const extractTextPreview = async (file: File) => {
  const lowerName = file.name.toLowerCase();
  const isTextual =
    file.type.startsWith("text/") ||
    lowerName.endsWith(".md") ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".json") ||
    lowerName.endsWith(".csv");

  if (!isTextual) {
    return undefined;
  }

  const raw = await file.text();
  return raw.slice(0, 4_000);
};
