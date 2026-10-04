import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import './src/api/courses';
import './src/api/assignments';
import './src/api/positions';
import { loadServerCapabilities } from './src/api/discovery';
import { ApiError, isRetriableError } from './src/api/client';
import { loadDashboard, login, logout, restoreAccessToken } from './src/api/session';
import { purgeCurrentUserDownloads } from './src/offline/mediaDownloads';
import { migrateLegacyStorage } from './src/offline/legacyMigration';
import { flushOutbox } from './src/offline/outbox/runtime';
import { runSync } from './src/offline/sync/runtime';
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
      await flushOutbox(accessToken).catch(() => null);
      const data = await loadDashboard(accessToken);
      setDashboard(data);
      setMode(await resolveMode(data));
      setDashboardError('');
      // 0.4.0: al abrir (y al refrescar), traer solo lo que cambió desde la última vez.
      void runSync(accessToken).catch(() => undefined);
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
      // Antes de restaurar la sesión: si el token ya no sirve, la restauración purga el almacenamiento.
      await migrateLegacyStorage().catch(() => undefined);
      void loadServerCapabilities();
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
      void flushOutbox(token).catch(() => undefined).then(() => runSync(token)).catch(() => undefined);
    }
  }, [network.offline, token]);

  // Adjuntos que esperaban Wi-Fi y reintentos cuya espera ya venció.
  const prevWifi = useRef<boolean>(network.isWifi);
  useEffect(() => {
    if (!token) return;
    const becameWifi = !prevWifi.current && network.isWifi;
    prevWifi.current = network.isWifi;
    if (becameWifi && !network.offline) void flushOutbox(token).catch(() => undefined);
  }, [network.isWifi, network.offline, token]);

  useEffect(() => {
    if (!token || network.offline) return;
    const id = setInterval(() => void flushOutbox(token).catch(() => undefined), 30_000);
    return () => clearInterval(id);
  }, [network.offline, token]);

  const handleLogin = async (loginValue: string, password: string) => {
    const response = await login(loginValue, password);
    // La academia pudo cambiar en la pantalla de inicio: capacidades de la nueva.
    await loadServerCapabilities().catch(() => undefined);
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
    // Último intento de enviar lo pendiente: al cerrar sesión la base local se borra.
    try {
      if (token) await flushOutbox(token).catch(() => null);
      await purgeCurrentUserDownloads().catch(() => undefined);
      if (token) await logout(token);
    } finally {
      // 0.4.1: la pantalla vuelve al inicio de sesión pase lo que pase (por ejemplo, sin red).
      setToken(null);
      setDashboard(null);
      setMode('student');
    }
  };

  const switchMode = (next: AppMode) => {
    setMode(next);
    if (dashboard) void saveMode(dashboard.user.id, next);
  };

  if (starting) {
    return (
      <View style={styles.starting}>
        <Text style={styles.startingBrand}>ATORA</Text>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!token) {
    return (
      <SafeAreaView edges={['top']} style={styles.loginSafe}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <LoginScreen onLogin={handleLogin} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
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
  starting: { alignItems: 'center', backgroundColor: colors.background, flex: 1, gap: spacing.lg, justifyContent: 'center' },
  startingBrand: { color: colors.primary, fontSize: 34, fontWeight: '900', letterSpacing: 3 },
  safe: { backgroundColor: colors.surface, flex: 1 },
  loginSafe: { backgroundColor: colors.background, flex: 1 },
});
