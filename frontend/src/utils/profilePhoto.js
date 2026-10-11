// Store a small, browser-decoded image rather than the original camera file.
export async function prepareProfilePhoto(file) {
  if (file.size > 25_000_000) {
    throw new Error("La foto supera los 25 MB. Selecciona una más pequeña.");
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("No se pudo abrir esta foto. Prueba con una imagen JPG, PNG o WebP; si es HEIC, conviértela a JPG."));
      image.src = url;
    });
    const scale = Math.min(1, 800 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se pudo preparar la foto. Inténtalo nuevamente.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL("image/jpeg", 0.85);
    if (!result.startsWith("data:image/jpeg;") || result.length > 2_500_000) {
      throw new Error("No se pudo preparar la foto. Prueba con otra imagen.");
    }
    return result;
  } finally {
    URL.revokeObjectURL(url);
  }
}
