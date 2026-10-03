import { Directory, Paths } from 'expo-file-system';

/** Carpeta de miniaturas generadas en el teléfono (sin dependencias de sesión). */
export const thumbnailsDir = () => new Directory(Paths.document, 'atora-thumbs');

export function purgeLocalThumbnails(): void {
  const folder = thumbnailsDir();
  if (folder.exists) folder.delete();
}
