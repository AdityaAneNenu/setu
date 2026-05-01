import * as FileSystem from "expo-file-system/legacy";

const ROOT = `${FileSystem.documentDirectory}setu_offline`;

const ensureDir = async (dir) => {
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
};

const pickExt = (uri, fallback = "jpg") => {
  const clean = String(uri || "").split("?")[0];
  const last = clean.split(".").pop()?.toLowerCase();
  if (!last || last.includes("/")) {
    return fallback;
  }
  return last;
};

export const persistCaptureFile = async ({ sourceUri, bucket, localId, fallbackExt }) => {
  if (!sourceUri) {
    throw new Error("Missing source file URI");
  }

  const bucketDir = `${ROOT}/${bucket}`;
  await ensureDir(ROOT);
  await ensureDir(bucketDir);

  const sourceInfo = await FileSystem.getInfoAsync(sourceUri);
  if (!sourceInfo.exists) {
    throw new Error("Captured file is no longer available. Please capture it again.");
  }

  const ext = pickExt(sourceUri, fallbackExt || "jpg");
  const destination = `${bucketDir}/${localId}.${ext}`;

  if (sourceUri === destination) {
    const info = await FileSystem.getInfoAsync(destination, { md5: true });
    return {
      uri: destination,
      md5: info?.md5 || null,
      size: info?.size || null,
    };
  }

  const existing = await FileSystem.getInfoAsync(destination);
  if (existing.exists) {
    await FileSystem.deleteAsync(destination, { idempotent: true });
  }

  await FileSystem.copyAsync({ from: sourceUri, to: destination });
  const info = await FileSystem.getInfoAsync(destination, { md5: true });

  return {
    uri: destination,
    md5: info?.md5 || null,
    size: info?.size || null,
  };
};

export const deleteOfflineFile = async (uri) => {
  if (!uri || !String(uri).startsWith(ROOT)) return;
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch((error) => {
    console.warn("Failed to delete offline file:", uri, error?.message || error);
  });
};

const collectFiles = async (dir) => {
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists || !info.isDirectory) return [];

  const names = await FileSystem.readDirectoryAsync(dir);
  const nested = await Promise.all(
    names.map(async (name) => {
      const child = `${dir}/${name}`;
      const childInfo = await FileSystem.getInfoAsync(child);
      if (childInfo.isDirectory) {
        return collectFiles(child);
      }
      return [child];
    }),
  );
  return nested.flat();
};

export const cleanupOfflineFiles = async (retainedUris = []) => {
  const retained = new Set(retainedUris.filter(Boolean));
  const files = await collectFiles(ROOT);
  await Promise.all(
    files.map(async (uri) => {
      if (!retained.has(uri)) {
        await deleteOfflineFile(uri);
      }
    }),
  );
};

export default {
  persistCaptureFile,
  deleteOfflineFile,
  cleanupOfflineFiles,
};
