import { useEffect, useState } from 'react';
import * as Network from 'expo-network';

export type NetworkState = {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  offline: boolean;
};

export function useNetworkState(pollMs = 4000): NetworkState {
  const [state, setState] = useState<NetworkState>({
    isConnected: true,
    isInternetReachable: null,
    offline: false,
  });

  useEffect(() => {
    let active = true;

    const poll = async () => {
      try {
        const info = await Network.getNetworkStateAsync();
        if (!active) return;
        const isConnected = Boolean(info.isConnected);
        const isInternetReachable = info.isInternetReachable ?? null;
        setState({
          isConnected,
          isInternetReachable,
          offline: !isConnected || isInternetReachable === false,
        });
      } catch {
        // No bloqueamos la UI si falla.
      }
    };

    void poll();
    const id = setInterval(() => void poll(), pollMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [pollMs]);

  return state;
}

