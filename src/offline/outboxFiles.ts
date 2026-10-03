import { Directory, File, Paths } from 'expo-file-system';

/**
 * Copia privada de los adjuntos de una entrega en cola: vive en el almacenamiento
 * de documentos de la app (no en la caché, que el sistema puede vaciar) hasta que
 * la entrega llega al servidor.
 */
const root = () => new Directory(Paths.document, 'atora-outbox');

export function copyAttachment(eventId: string, index: number, sourceUri: string, name: string): { uri: string; size: number } {
  const dir = new Directory(root(), eventId);
  dir.create({ intermediates: true, idempotent: true });
  const safeName = name.replace(/[^A-Za-z0-9._-]+/g, '-').slice(-120) || `archivo-${index}`;
  const target = new File(dir, `${index}-${safeName}`);
  if (target.exists) target.delete();
  new File(sourceUri).copy(target);
  return { uri: target.uri, size: target.size ?? 0 };
}

export function readRange(uri: string, start: number, length: number): Uint8Array {
  const handle = new File(uri).open();
  try {
    handle.offset = start;
    return handle.readBytes(length);
  } finally {
    handle.close();
  }
}

export function fileExists(uri: string): boolean {
  return new File(uri).exists;
}

export function deleteEventFiles(eventId: string): void {
  const dir = new Directory(root(), eventId);
  if (dir.exists) dir.delete();
}

/** Al cerrar sesión no queda ningún adjunto del usuario anterior. */
export function purgeOutboxFiles(): void {
  const dir = root();
  if (dir.exists) dir.delete();
}
