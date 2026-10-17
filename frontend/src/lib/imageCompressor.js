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

  return new Promise((resolve, reject) => {
    // 1. Baca file sebagai Image
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file foto"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Format foto tidak didukung atau rusak"));
      img.onload = () => {
        try {
          let origW = img.naturalWidth || img.width;
          let origH = img.naturalHeight || img.height;

          if (!origW || !origH) {
            origW = 1200;
            origH = 1600;
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
            // Fallback jika konteks canvas gagal: kembalikan file asli jika type valid
            return resolve({
              file,
              preview: URL.createObjectURL(file),
              width: origW,
              height: origH,
            });
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, targetW, targetH);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                return resolve({
                  file,
                  preview: URL.createObjectURL(file),
                  width: targetW,
                  height: targetH,
                });
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
        } catch (err) {
          reject(err);
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Putar foto struk 90 derajat searah jarum jam secara cepat dan hemat memori
 */
export async function rotateImageBlob(fileOrBlob, currentPreview) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onerror = () => reject(new Error("Gagal memuat foto untuk diputar"));
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;

        const canvas = document.createElement("canvas");
        // Swap width and height for 90 degree rotation
        canvas.width = h;
        canvas.height = w;

        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Gagal menginisialisasi canvas"));

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((90 * Math.PI) / 180);
        ctx.drawImage(img, -w / 2, -h / 2);

        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("Gagal mengekspor foto yang diputar"));
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
      } catch (e) {
        reject(e);
      }
    };
    img.src = currentPreview;
  });
}
