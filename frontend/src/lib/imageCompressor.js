/**
 * Utility untuk kompresi dan normalisasi foto struk client-side di mobile & desktop.
 * Mencegah OOM crash pada Chrome Android dan timeout upload pada Safari/iOS.
 */

export async function compressReceiptImage(file, options = {}) {
  const {
    maxLongSide = 2400,
    minShortSide = 1000,
    quality = 0.88,
  } = options;

  if (!file) return null;

  const originalFallback = {
    file,
    preview: URL.createObjectURL(file),
  };

  return new Promise((resolve) => {
    try {
      const blobUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        try {
          let origW = img.naturalWidth || img.width;
          let origH = img.naturalHeight || img.height;

          if (!origW || !origH) {
            return resolve(originalFallback);
          }

          // Hitung dimensi target proporsional
          let targetW = origW;
          let targetH = origH;
          const longSide = Math.max(origW, origH);

          if (longSide > maxLongSide) {
            const scale = maxLongSide / longSide;
            targetW = Math.round(origW * scale);
            targetH = Math.round(origH * scale);
          }

          // Untuk struk vertikal panjang: pastikan lebar minimal cukup terbaca jelas (minShortSide)
          if (origW < origH && targetW < minShortSide && origW >= minShortSide) {
            targetW = minShortSide;
            targetH = Math.min(Math.round(origH * (minShortSide / origW)), 4000);
          }

          const canvas = document.createElement("canvas");
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext("2d");

          if (!ctx) {
            return resolve(originalFallback);
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, targetW, targetH);

          canvas.toBlob(
            (blob) => {
              // Revoke URL sementara
              try { URL.revokeObjectURL(blobUrl); } catch {}

              if (!blob) {
                return resolve(originalFallback);
              }

              const cleanName = (file.name || "struk.jpg").replace(/\.[^/.]+$/, "") + ".jpg";
              const optimizedFile = new File([blob], cleanName, {
                type: "image/jpeg",
                lastModified: Date.now(),
              });

              resolve({
                file: optimizedFile,
                preview: URL.createObjectURL(blob),
                width: targetW,
                height: targetH,
                sizeKb: Math.round(blob.size / 1024),
              });
            },
            "image/jpeg",
            quality
          );
        } catch {
          try { URL.revokeObjectURL(blobUrl); } catch {}
          resolve(originalFallback);
        }
      };

      img.onerror = () => {
        // Jangan gagal keras jika format tertentu tidak bisa didecode langsung canvas: kembalikan file asli
        resolve(originalFallback);
      };

      img.src = blobUrl;
    } catch {
      resolve(originalFallback);
    }
  });
}

/**
 * Putar foto struk 90 derajat searah jarum jam secara cepat dan hemat memori
 */
export async function rotateImageBlob(fileOrBlob, currentPreview) {
  if (!currentPreview) return { file: fileOrBlob, preview: currentPreview };

  return new Promise((resolve) => {
    try {
      const img = new Image();
      // JANGAN gunakan crossOrigin = "anonymous" pada blob: URL karena Safari/Chrome akan melempar security/CORS error
      img.onload = () => {
        try {
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;

          const canvas = document.createElement("canvas");
          // Swap width and height for 90 degree rotation
          canvas.width = h;
          canvas.height = w;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            return resolve({ file: fileOrBlob, preview: currentPreview });
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate((90 * Math.PI) / 180);
          ctx.drawImage(img, -w / 2, -h / 2);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                return resolve({ file: fileOrBlob, preview: currentPreview });
              }
              const rotatedFile = new File([blob], (fileOrBlob.name || "struk.jpg"), {
                type: "image/jpeg",
                lastModified: Date.now(),
              });
              resolve({
                file: rotatedFile,
                preview: URL.createObjectURL(blob),
              });
            },
            "image/jpeg",
            0.90
          );
        } catch {
          resolve({ file: fileOrBlob, preview: currentPreview });
        }
      };

      img.onerror = () => {
        resolve({ file: fileOrBlob, preview: currentPreview });
      };

      img.src = currentPreview;
    } catch {
      resolve({ file: fileOrBlob, preview: currentPreview });
    }
  });
}
