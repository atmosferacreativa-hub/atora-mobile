import StaticServer from 'react-native-static-server';

type LocalScormServer = {
  origin: string;
  stop: () => Promise<void>;
};

function pathFromFileUri(fileUri: string): string {
  const raw = String(fileUri || '');
  return raw.startsWith('file://') ? raw.slice('file://'.length) : raw;
}

export async function startLocalScormServer(serverRootDirFileUri: string): Promise<LocalScormServer> {
  const root = pathFromFileUri(serverRootDirFileUri);
  const server = new StaticServer(0, root, { localOnly: true });
  const origin = await server.start();
  return {
    origin,
    stop: async () => {
      try {
        await server.stop();
      } catch {
        // Idempotente.
      }
    },
  };
}

