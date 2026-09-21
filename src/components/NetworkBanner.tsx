import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Network from 'expo-network';
import { colors, spacing } from '../theme';

type State = { isConnected: boolean; isInternetReachable: boolean | null };

export function NetworkBanner() {
  const [state, setState] = useState<State>({ isConnected: true, isInternetReachable: null });

  useEffect(() => {
    let active = true;

    const poll = async () => {
      try {
        const info = await Network.getNetworkStateAsync();
        if (!active) return;
        setState({
          isConnected: Boolean(info.isConnected),
          isInternetReachable: info.isInternetReachable ?? null,
        });
      } catch {
        // Si falla, no bloqueamos la UI.
      }
    };

    void poll();
    const id = setInterval(() => void poll(), 4000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const offline = !state.isConnected || state.isInternetReachable === false;
  if (!offline) return null;

  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.title}>Sin conexión</Text>
      <Text style={styles.text}>Tu progreso se guardará y se sincronizará cuando vuelvas a estar en línea.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: colors.navy, borderBottomColor: colors.mustard, borderBottomWidth: 2, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  title: { color: colors.mustard, fontSize: 12, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  text: { color: colors.white, fontSize: 12, marginTop: 2 },
});

