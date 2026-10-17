/**
 * Image compression helper using native browser HTML5 Canvas.
 * Compresses an image file down to a lightweight JPEG Data URL (~10-15KB).
 *
 * @param {File} file
 * @param {number} maxWidth
 * @param {number} maxHeight
 * @param {number} quality
 * @returns {Promise<string>} Data URL (JPEG)
 */
export const compressImageFile = (file, maxWidth = 200, maxHeight = 200, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('Pilih berkas gambar terlebih dahulu.'));
    if (!file.type || !file.type.startsWith('image/')) {
      return reject(new Error('Format berkas harus berupa gambar (JPEG, PNG, dsb).'));
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca berkas gambar.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Gagal memproses gambar.'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round(height * (maxWidth / width));
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round(width * (maxHeight / height));
            height = maxHeight;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};
