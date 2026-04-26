import * as FileSystem from "expo-file-system";

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

  const ext = pickExt(sourceUri, fallbackExt || "jpg");
  const destination = `${bucketDir}/${localId}.${ext}`;

  await FileSystem.copyAsync({ from: sourceUri, to: destination });
  const info = await FileSystem.getInfoAsync(destination, { md5: true });

  return {
    uri: destination,
    md5: info?.md5 || null,
    size: info?.size || null,
  };
};

export default {
  persistCaptureFile,
};
