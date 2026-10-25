import StaticServer from '@dr.pogodin/react-native-static-server';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';

type LocalScormServer = {
  /** URL base del server, sin el token (p.ej. http://127.0.0.1:12345) */
  origin: string;
  /** Token aleatorio de sesión, requerido en la ruta (/{token}/...) */
  token: string;
  /** Carpeta raíz servida por HTTP (solo esta sesión). */
  sessionRootDir: string;
  stop: () => Promise<void>;
};

function pathFromFileUri(fileUri: string): string {
  const raw = String(fileUri || '');
  return raw.startsWith('file://') ? raw.slice('file://'.length) : raw;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
}

async function ensureEmptyDir(dirUri: string): Promise<void> {
  await FileSystem.deleteAsync(dirUri, { idempotent: true }).catch(() => undefined);
  await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true });
}

async function copyDirRecursive(srcDirUri: string, destDirUri: string): Promise<void> {
  await FileSystem.makeDirectoryAsync(destDirUri, { intermediates: true });
  const entries = await FileSystem.readDirectoryAsync(srcDirUri);
  for (const name of entries) {
    const src = `${srcDirUri}${name}`;
    const dest = `${destDirUri}${name}`;
    const info = await FileSystem.getInfoAsync(src);
    if (info.isDirectory) {
      await copyDirRecursive(`${src}/`, `${dest}/`);
      continue;
    }
    await FileSystem.copyAsync({ from: src, to: dest });
  }
}

let activeServer: LocalScormServer | null = null;

/**
 * Inicia un servidor HTTP local para un paquete SCORM.
 *
 * - Sirve solo los archivos del paquete abierto (copiados a una carpeta temporal por sesión).
 * - Requiere token aleatorio (16+ bytes) como primer segmento de la ruta: /{token}/...
 * - Garantiza un solo servidor a la vez: iniciar uno nuevo detiene el anterior.
 */
export async function startLocalScormServer(packageDirFileUri: string): Promise<LocalScormServer> {
  if (activeServer) await activeServer.stop().catch(() => undefined);

  const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!baseDir) throw new Error('No hay directorio de caché disponible.');

  const tokenBytes = await Crypto.getRandomBytesAsync(16);
  const token = bytesToHex(tokenBytes);

  // Raíz aislada por sesión. Dentro, creamos otra carpeta con el mismo nombre
  // para que el token esté presente en la URL (/token/index.html), sin exponer
  // una carpeta padre compartida entre paquetes.
  const sessionRootDir = `${baseDir}atora-scorm-server/${token}/`;
  const servedPackageDir = `${sessionRootDir}${token}/`;

  await ensureEmptyDir(sessionRootDir);
  await copyDirRecursive(packageDirFileUri, servedPackageDir);

  const server = new StaticServer({
    port: 0,
    hostname: '127.0.0.1',
    fileDir: pathFromFileUri(sessionRootDir),
    extraConfig: `
      # No listar directorios: evita que / responda 200.
      dir-listing.activate = "disable"
    `,
  });

  const origin = await server.start();

  const stop = async () => {
    try {
      await server.stop();
    } catch {
      // Idempotente.
    }
    await FileSystem.deleteAsync(sessionRootDir, { idempotent: true }).catch(() => undefined);
    if (activeServer && activeServer.sessionRootDir === sessionRootDir) activeServer = null;
  };

  const local: LocalScormServer = { origin, token, sessionRootDir, stop };
  activeServer = local;
  return local;
}

