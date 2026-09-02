/**
 * Reduce una foto antes de subirla.
 *
 * Lo mismo que hace `ImagePicker` en la app (`maxWidth`/`maxHeight` 1024 y
 * calidad 85), y aquí hace más falta todavía: desde un ordenador se elige el
 * original de la cámara y son diez o quince megas para pintar un círculo de
 * 56 px. Se hace en el navegador, así que ni sale de la máquina.
 *
 * Si algo falla —un formato que el navegador no sabe decodificar, un HEIC de
 * iPhone— devuelve el fichero **tal cual**: que la foto llegue grande es mejor
 * que no poder cambiarla.
 */
export async function shrinkImage(file: File, maxSide = 1024, quality = 0.85): Promise<File> {
  if (!file.type.startsWith('image/')) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));

    // Ya cabe: reencodificarla solo la empeoraría.
    if (scale >= 1) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      return file;
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
    if (!blob) {
      return file;
    }

    // El nombre se rehace con la extensión nueva: el servidor mira el tipo,
    // pero un `.png` que por dentro es JPEG confunde a quien lo audite.
    const name = file.name.replace(/\.[^.]+$/, '') || 'foto';
    return new File([blob], `${name}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
