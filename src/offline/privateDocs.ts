import { Directory, Paths } from 'expo-file-system';

/**
 * Documentos privados del estudiante guardados en el teléfono (sin dependencias de sesión para poder borrarlos al
 * cerrar sesión): historial académico (1.4.0) y certificados (su índice ya se borraba con la base local, pero los
 * archivos quedaban en el teléfono para la cuenta siguiente).
 */
export const historyDir = () => new Directory(Paths.document, 'atora-history');
export const certificatesDir = () => new Directory(Paths.document, 'atora-certificates');

export function purgePrivateDocuments(): void {
  for (const folder of [historyDir(), certificatesDir()]) {
    if (folder.exists) folder.delete();
  }
}
