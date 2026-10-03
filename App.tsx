import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { flushPendingCompletions } from './src/api/courses';
import { ApiError, isRetriableError } from './src/api/client';
import { loadDashboard, login, logout, restoreAccessToken } from './src/api/session';
import { purgeCurrentUserDownloads } from './src/offline/mediaDownloads';
import { useNetworkState } from './src/hooks/useNetworkState';
import { AppNavigator } from './src/navigation/AppNavigator';
import { canSwitchMode, resolveMode, saveMode, type AppMode } from './src/navigation/roles';
import { LoginScreen } from './src/screens/LoginScreen';
import { initRuntimeConfig } from './src/runtimeConfig';
import { colors, spacing } from './src/theme';
import type { StudentHome } from './src/types';

function AppShell() {
  const [token, setToken] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<StudentHome | null>(null);
  const [mode, setMode] = useState<AppMode>('student');
  const [starting, setStarting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState('');
  const network = useNetworkState();
  const prevOffline = useRef<boolean>(network.offline);

  const fetchDashboard = useCallback(async (accessToken: string) => {
    setLoading(true);
    try {
      await flushPendingCompletions(accessToken);
      const data = await loadDashboard(accessToken);
      setDashboard(data);
      setMode(await resolveMode(data));
      setDashboardError('');
    } catch (reason) {
      setDashboardError(
        reason instanceof ApiError
          ? reason.message
          : 'Iniciaste sesión, pero no pudimos cargar tu panel.',
      );
      throw reason;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      await initRuntimeConfig();
      const restored = await restoreAccessToken();
      if (!active) return;
      setToken(restored);
      if (restored) {
        try {
          await fetchDashboard(restored);
        } catch (reason) {
          if (isRetriableError(reason)) {
            // Mantener sesión local para permitir caché/offline.
          } else {
            setToken(null);
          }
        }
      }
      if (active) setStarting(false);
    })();
    return () => { active = false; };
  }, [fetchDashboard]);

  useEffect(() => {
    if (!token) return;
    const wasOffline = prevOffline.current;
    const isOffline = network.offline;
    prevOffline.current = isOffline;
    if (wasOffline && !isOffline) {
      void flushPendingCompletions(token).catch(() => undefined);
    }
  }, [network.offline, token]);

  const handleLogin = async (loginValue: string, password: string) => {
    const response = await login(loginValue, password);
    setToken(response.session.access_token);
    try {
      await fetchDashboard(response.session.access_token);
    } catch {
      // La sesión es válida: el panel muestra su propio error y permite reintentar.
    }
  };

  const handleLogout = async () => {
    // Purga las descargas offline del usuario saliente ANTES de cerrar la
    // sesión: purgeCurrentUserDownloads() necesita leer el user_id todavía
    // activo para resolver el manifiesto correcto a borrar. Si esto fallara
    // (por ejemplo, sin espacio para reescribir el manifiesto vacío) no debe
    // impedir el logout en sí.
    await purgeCurrentUserDownloads().catch(() => undefined);
    if (token) await logout(token);
    setToken(null);
    setDashboard(null);
    setMode('student');
  };

  const switchMode = (next: AppMode) => {
    setMode(next);
    if (dashboard) void saveMode(dashboard.user.id, next);
  };

  if (starting) {
    return (
      <View style={styles.starting}>
        <Text style={styles.startingBrand}>ATORA</Text>
        <ActivityIndicator color={colors.mustard} />
      </View>
    );
  }

  if (!token) return <LoginScreen onLogin={handleLogin} />;

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.navy} />
      <AppNavigator
        session={{
          token,
          dashboard,
          loading,
          dashboardError,
          mode,
          canSwitchMode: canSwitchMode(dashboard),
          refresh: () => void fetchDashboard(token).catch(() => undefined),
          logout: () => void handleLogout(),
          switchMode,
        }}
      />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppShell />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  starting: { alignItems: 'center', backgroundColor: colors.navy, flex: 1, gap: spacing.lg, justifyContent: 'center' },
  startingBrand: { color: colors.white, fontSize: 34, fontWeight: '900', letterSpacing: 3 },
  safe: { backgroundColor: colors.navy, flex: 1 },
});
