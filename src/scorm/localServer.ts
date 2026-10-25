import Server, { getActiveServer } from '@dr.pogodin/react-native-static-server';
import * as Crypto from 'expo-crypto';

type LocalScormServer = {
  origin: string;
  token: string;
  stop: () => Promise<void>;
};

export async function startLocalScormServer(fileDir: string): Promise<LocalScormServer> {
  const token = Crypto.randomUUID();
  const active = getActiveServer();
  if (active) {
    try {
      await active.stop();
    } catch {
      // Si algo dejó un server colgado, preferimos seguir sin romper la pantalla.
    }
  }

  const extraConfig = [
    'server.modules += ("mod_rewrite")',
    // Token en la ruta: /<token>/... → /...
    `url.rewrite-once = ("^/${token}/(.*)$" => "/$1")`,
  ].join('\n');

  const server = new Server({ fileDir, port: 0, extraConfig });
  const origin = await server.start();
  return {
    origin,
    token,
    stop: async () => {
      try {
        await server.stop();
      } catch {
        // Idempotente.
      }
    },
  };
}

