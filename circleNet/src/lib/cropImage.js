// src/lib/cropImage.js
export const getCroppedImg = (imageSrc, crop, zoom) => {
  return new Promise((resolve, reject) => {
    if (!crop || crop.width === 0 || crop.height === 0) {
      resolve(imageSrc);
      return;
    }

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = imageSrc;

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const scaleX = image.naturalWidth / 100;
        const scaleY = image.naturalHeight / 100;
        const cropWidth = crop.width * scaleX;
        const cropHeight = crop.height * scaleY;
        const cropX = crop.x * scaleX;
        const cropY = crop.y * scaleY;

        if (cropWidth < 1 || cropHeight < 1) {
          resolve(imageSrc);
          return;
        }

        canvas.width = Math.round(cropWidth);
        canvas.height = Math.round(cropHeight);

        ctx.drawImage(
          image,
          cropX, cropY, cropWidth, cropHeight,
          0, 0, canvas.width, canvas.height
        );

        canvas.toBlob((blob) => {
          if (!blob) {
            resolve(imageSrc);
            return;
          }
          // Return a File directly (instead of a blob URL)
          const file = new File([blob], 'cropped-image.png', { type: 'image/png' });
          resolve(file);
        }, 'image/png');
      } catch (err) {
        resolve(imageSrc);
      }
    };

    image.onerror = () => {
      resolve(imageSrc);
    };
  });
};