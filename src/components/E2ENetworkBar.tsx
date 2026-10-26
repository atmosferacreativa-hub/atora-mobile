import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NetworkState } from '../hooks/useNetworkState';
import { listOutbox, subscribeOutbox } from '../offline/outbox/runtime';
import { t } from '../i18n/core';

type Props = {
  network: NetworkState;
};

const SCORM_COMMIT = 'scorm.commit';

type OutboxSummary = {
  pending: number;
  failed: number;
  scormLastError: string;
};

export function E2ENetworkBar({ network }: Props) {
  const label = network.offline ? 'OFFLINE' : network.isWifi ? 'WIFI' : 'CELL';
  const [outbox, setOutbox] = useState<OutboxSummary>({ pending: 0, failed: 0, scormLastError: '' });

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void listOutbox()
        .then(({ pending, failed }) => {
          if (!active) return;
          const all = [...failed, ...pending];
          const scorm = all
            .filter((e) => e.type === SCORM_COMMIT && e.lastError)
            .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))[0];
          setOutbox({
            pending: pending.length,
            failed: failed.length,
            scormLastError: scorm?.lastError ?? '',
          });
        })
        .catch(() => undefined);
    };
    refresh();
    const unsub = subscribeOutbox(refresh);
    return () => {
      active = false;
      unsub();
    };
  }, []);

  return (
    <View pointerEvents="none" style={styles.root}>
      <Text style={styles.text}>{t('NET:{label}', { label })}</Text>
      <Text style={styles.text}>{t('OUTBOX:{pending}/{failed}', { pending: outbox.pending, failed: outbox.failed })}</Text>
      {outbox.scormLastError ? <Text style={styles.text} numberOfLines={1}>{t('SCORM_ERR:{error}', { error: outbox.scormLastError })}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    left: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    position: 'absolute',
    top: 0,
    zIndex: 9999,
  },
  text: { color: 'white', fontSize: 12, fontWeight: '700' },
});

