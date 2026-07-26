/** Compresse une image côté client avant upload (JPEG). */

const MAX_EDGE = 2000;
const QUALITY = 0.82;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Impossible de lire l'image"));
    };
    img.src = url;
  });
}

export async function compressImageFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Fichier non image");
  }
  // HEIC / formats non décodables par canvas : on envoie tel quel
  if (file.type === "image/heic" || file.type === "image/heif") {
    return file;
  }

  const img = await loadImage(file);
  let { width, height } = img;
  if (width <= 0 || height <= 0) return file;

  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALITY),
  );
  if (!blob) return file;

  const base = file.name.replace(/\.[^.]+$/, "") || "inspiration";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}
