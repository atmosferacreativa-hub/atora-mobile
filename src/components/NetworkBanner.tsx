import { useNetworkState } from '../hooks/useNetworkState';
import { OfflineNotice } from './ui';
import { t } from '../i18n';

export function NetworkBanner() {
  const { offline } = useNetworkState();
  if (!offline) return null;
  return <OfflineNotice message={t('Tu progreso y tus entregas se guardan y se enviarán cuando vuelvas a tener conexión.')} />;
}
