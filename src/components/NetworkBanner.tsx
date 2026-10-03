import { useNetworkState } from '../hooks/useNetworkState';
import { OfflineNotice } from './ui';

export function NetworkBanner() {
  const { offline } = useNetworkState();
  if (!offline) return null;
  return <OfflineNotice message="Tu progreso y tus entregas se guardan y se enviarán cuando vuelvas a tener conexión." />;
}
