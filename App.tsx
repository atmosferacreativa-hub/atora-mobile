import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { flushPendingCompletions } from './src/api/courses';
import { loadDashboard, login, logout, restoreAccessToken } from './src/api/session';
import { SectionButton } from './src/components/SectionButton';
import { CourseScreen } from './src/screens/CourseScreen';
import { CoursesScreen } from './src/screens/CoursesScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { LessonScreen } from './src/screens/LessonScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { QuizScreen } from './src/screens/QuizScreen';
import { colors, spacing } from './src/theme';
import type { AppSection, StudentHome } from './src/types';

const labels: Record<AppSection, string> = {
  home: 'Inicio',
  courses: 'Cursos',
  grades: 'Notas',
  profile: 'Perfil',
};

export default function App() {
  const [section, setSection] = useState<AppSection>('home');
  const [token, setToken] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<StudentHome | null>(null);
  const [starting, setStarting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [courseId, setCourseId] = useState<number | null>(null);
  const [lessonId, setLessonId] = useState<number | null>(null);
  const [quizOpen, setQuizOpen] = useState(false);

  const fetchDashboard = useCallback(async (accessToken: string) => {
    setLoading(true);
    try {
      await flushPendingCompletions(accessToken);
      setDashboard(await loadDashboard(accessToken));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const restored = await restoreAccessToken();
      if (!active) return;
      setToken(restored);
      if (restored) {
        try {
          await fetchDashboard(restored);
        } catch {
          setToken(null);
        }
      }
      if (active) setStarting(false);
    })();
    return () => { active = false; };
  }, [fetchDashboard]);

  const handleLogin = async (loginValue: string, password: string) => {
    const response = await login(loginValue, password);
    setToken(response.session.access_token);
    await fetchDashboard(response.session.access_token);
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
      onOpenQuiz={() => setQuizOpen(true)}
    />
  ) : lessonId ? (
    <LessonScreen
      lessonId={lessonId}
      token={token}
      onBack={() => setLessonId(null)}
      onCompleted={() => void fetchDashboard(token)}
    />
  ) : courseId ? (
    <CourseScreen
      courseId={courseId}
      token={token}
      onBack={() => setCourseId(null)}
      onOpenLesson={setLessonId}
    />
  ) : section === 'home' ? (
    <HomeScreen data={dashboard} loading={loading} onRefresh={() => void fetchDashboard(token)} />
  ) : section === 'courses' ? (
    <CoursesScreen courses={dashboard?.courses ?? []} onOpen={setCourseId} />
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
      <View style={styles.header}>
        <Text style={styles.brand}>ATORA</Text>
        <Text style={styles.product}>Aprendizaje móvil</Text>
      </View>
      <View style={styles.main}>{content}</View>
      <View style={styles.navigation}>
        {(Object.keys(labels) as AppSection[]).map((item) => (
          <SectionButton key={item} label={labels[item]} section={item} active={section === item} onPress={changeSection} />
        ))}
      </View>
    </SafeAreaView>
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
  placeholder: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: spacing.xl },
  placeholderTitle: { color: colors.navy, fontSize: 28, fontWeight: '800', textAlign: 'center' },
  placeholderText: { color: colors.muted, fontSize: 16, marginTop: spacing.sm, textAlign: 'center' },
});
