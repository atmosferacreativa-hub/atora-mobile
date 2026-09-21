import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { flushPendingCompletions } from './src/api/courses';
import { ApiError, isRetriableError } from './src/api/client';
import { loadDashboard, login, logout, restoreAccessToken } from './src/api/session';
import { NetworkBanner } from './src/components/NetworkBanner';
import { SectionButton } from './src/components/SectionButton';
import { useNetworkState } from './src/hooks/useNetworkState';
import { CourseScreen } from './src/screens/CourseScreen';
import { CoursesScreen } from './src/screens/CoursesScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { LessonScreen } from './src/screens/LessonScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { ProgramScreen } from './src/screens/ProgramScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { QuizScreen } from './src/screens/QuizScreen';
import { initRuntimeConfig } from './src/runtimeConfig';
import { colors, spacing } from './src/theme';
import type { AppSection, StudentHome } from './src/types';

const labels: Record<AppSection, string> = {
  home: 'Inicio',
  courses: 'Cursos',
  grades: 'Notas',
  profile: 'Perfil',
};

function AppShell() {
  const [section, setSection] = useState<AppSection>('home');
  const [token, setToken] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<StudentHome | null>(null);
  const [starting, setStarting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState('');
  const [courseId, setCourseId] = useState<number | null>(null);
  const [lessonId, setLessonId] = useState<number | null>(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const [programId, setProgramId] = useState<number | null>(null);
  const insets = useSafeAreaInsets();
  const network = useNetworkState();
  const prevOffline = useRef<boolean>(network.offline);

  const fetchDashboard = useCallback(async (accessToken: string) => {
    setLoading(true);
    try {
      await flushPendingCompletions(accessToken);
      setDashboard(await loadDashboard(accessToken));
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
    if (token) await logout(token);
    setToken(null);
    setDashboard(null);
    setSection('home');
    setCourseId(null);
    setLessonId(null);
    setQuizOpen(false);
  };

  const changeSection = (next: AppSection) => {
    setSection(next);
    setCourseId(null);
    setLessonId(null);
    setQuizOpen(false);
    setProgramId(null);
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

  const content = lessonId && quizOpen ? (
    <QuizScreen
      lessonId={lessonId}
      token={token}
      onBack={() => setQuizOpen(false)}
      onCompleted={() => void fetchDashboard(token)}
    />
  ) : lessonId ? (
    <LessonScreen
      lessonId={lessonId}
      token={token}
      onBack={() => setLessonId(null)}
      onCompleted={() => void fetchDashboard(token)}
      onOpenQuiz={() => setQuizOpen(true)}
    />
  ) : courseId ? (
    <CourseScreen
      courseId={courseId}
      token={token}
      onBack={() => setCourseId(null)}
      onOpenLesson={setLessonId}
    />
  ) : programId ? (
    <ProgramScreen
      programId={programId}
      token={token}
      onBack={() => setProgramId(null)}
      onOpenCourse={setCourseId}
      onOpenLesson={setLessonId}
    />
  ) : section === 'home' ? (
    <HomeScreen
      data={dashboard}
      loading={loading}
      token={token}
      onOpenCourse={setCourseId}
      onOpenLesson={setLessonId}
      onOpenProgram={setProgramId}
      onRefresh={() => void fetchDashboard(token)}
    />
  ) : section === 'courses' ? (
    <CoursesScreen
      courses={dashboard?.courses ?? []}
      token={token}
      onOpenCourse={setCourseId}
      onOpenLesson={setLessonId}
      onOpenProgram={setProgramId}
      onRefresh={() => void fetchDashboard(token)}
      refreshing={loading}
    />
  ) : section === 'profile' ? (
    <ProfileScreen
      displayName={dashboard?.user.display_name || 'Perfil'}
      email={dashboard?.user.email}
      onLogout={() => void handleLogout()}
    />
  ) : (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderTitle}>{labels[section]}</Text>
      <Text style={styles.placeholderText}>Esta sección continuará en la siguiente fase del MVP.</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.navy} />
      {!quizOpen ? (
        <Pressable onPress={() => changeSection('home')} style={styles.header}>
          <Text style={styles.brand}>ATORA</Text>
          <Text style={styles.product}>Aprendizaje móvil</Text>
        </Pressable>
      ) : null}
      {!quizOpen ? <NetworkBanner /> : null}
      <View style={styles.main}>
        {dashboardError ? (
          <View style={styles.dashboardError}>
            <Text accessibilityRole="alert" style={styles.dashboardErrorText}>{dashboardError}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void fetchDashboard(token).catch(() => undefined)}
              style={styles.retryButton}
            >
              <Text style={styles.retryButtonText}>Reintentar</Text>
            </Pressable>
          </View>
        ) : null}
        {content}
      </View>
      {!quizOpen ? (
        <View style={[styles.navigation, { paddingBottom: Math.max(8, insets.bottom) }]}>
          {(Object.keys(labels) as AppSection[]).map((item) => (
            <SectionButton key={item} label={labels[item]} section={item} active={section === item} onPress={changeSection} />
          ))}
        </View>
      ) : null}
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
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  brand: { color: colors.white, fontSize: 22, fontWeight: '900', letterSpacing: 2 },
  product: { color: colors.mustard, fontSize: 12, fontWeight: '700' },
  main: { backgroundColor: colors.paper, flex: 1 },
  navigation: { backgroundColor: colors.white, borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row' },
  dashboardError: { alignItems: 'center', backgroundColor: '#FFF1F0', borderBottomColor: colors.red, borderBottomWidth: 1, flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  dashboardErrorText: { color: colors.red, flex: 1, fontSize: 14 },
  retryButton: { backgroundColor: colors.red, borderRadius: 8, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  retryButtonText: { color: colors.white, fontSize: 13, fontWeight: '800' },
  placeholder: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: spacing.xl },
  placeholderTitle: { color: colors.navy, fontSize: 28, fontWeight: '800', textAlign: 'center' },
  placeholderText: { color: colors.muted, fontSize: 16, marginTop: spacing.sm, textAlign: 'center' },
});
