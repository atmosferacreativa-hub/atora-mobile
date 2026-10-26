import { StyleSheet, Text, View } from 'react-native';
import type { NetworkState } from '../hooks/useNetworkState';
import { t } from '../i18n/core';

type Props = {
  network: NetworkState;
};

export function E2ENetworkBar({ network }: Props) {
  const label = network.offline ? 'OFFLINE' : network.isWifi ? 'WIFI' : 'CELL';
  return (
    <View pointerEvents="none" style={styles.root}>
      <Text style={styles.text}>{t('NET:{label}', { label })}</Text>
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

