import { createContext, useContext, type ComponentProps, type ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer, DefaultTheme, getFocusedRouteNameFromRoute, type RouteProp } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import { NetworkBanner } from '../components/NetworkBanner';
import { AssignmentScreen } from '../screens/AssignmentScreen';
import { ComingSoonScreen } from '../screens/ComingSoonScreen';
import { CourseScreen } from '../screens/CourseScreen';
import { CoursesScreen } from '../screens/CoursesScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LessonScreen } from '../screens/LessonScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ProgramScreen } from '../screens/ProgramScreen';
import { QuizScreen } from '../screens/QuizScreen';
import { DownloadsScreen } from '../screens/DownloadsScreen';
import { ResourceViewerScreen } from '../screens/ResourceViewerScreen';
import { openWithSystem } from '../viewer/files';
import { colors, spacing } from '../theme';
import type { StudentHome } from '../types';
import type { AppMode } from './roles';

export type AppSessionValue = {
  token: string;
  dashboard: StudentHome | null;
  loading: boolean;
  dashboardError: string;
  mode: AppMode;
  canSwitchMode: boolean;
  refresh: () => void;
  logout: () => void;
  switchMode: (mode: AppMode) => void;
};

const AppSessionContext = createContext<AppSessionValue | null>(null);

export function useAppSession(): AppSessionValue {
  const value = useContext(AppSessionContext);
  if (!value) throw new Error('useAppSession fuera de AppNavigator');
  return value;
}

/** Pila compartida por las pestañas que abren cursos, programas y lecciones. */
export type LearningStackParams = {
  Root: undefined;
  Course: { courseId: number };
  Program: { programId: number };
  Lesson: { lessonId: number };
  Quiz: { lessonId: number };
  Assignment: { lessonId: number };
  Resource: { title: string; localUri: string; kind: 'pdf' | 'image'; mime?: string };
};

type LearningProps<T extends keyof LearningStackParams> = NativeStackScreenProps<LearningStackParams, T>;

function CourseRoute({ route, navigation }: LearningProps<'Course'>) {
  const { token } = useAppSession();
  return (
    <CourseScreen
      courseId={route.params.courseId}
      token={token}
      onBack={() => navigation.goBack()}
      onOpenLesson={(lessonId) => navigation.push('Lesson', { lessonId })}
    />
  );
}

function ProgramRoute({ route, navigation }: LearningProps<'Program'>) {
  const { token } = useAppSession();
  return (
    <ProgramScreen
      programId={route.params.programId}
      token={token}
      onBack={() => navigation.goBack()}
      onOpenCourse={(courseId) => navigation.push('Course', { courseId })}
      onOpenLesson={(lessonId) => navigation.push('Lesson', { lessonId })}
    />
  );
}

function LessonRoute({ route, navigation }: LearningProps<'Lesson'>) {
  const { token, refresh } = useAppSession();
  return (
    <LessonScreen
      lessonId={route.params.lessonId}
      token={token}
      onBack={() => navigation.goBack()}
      onCompleted={refresh}
      onOpenQuiz={() => navigation.push('Quiz', { lessonId: route.params.lessonId })}
      onOpenAssignment={() => navigation.push('Assignment', { lessonId: route.params.lessonId })}
      onOpenResource={(params) => navigation.push('Resource', params)}
    />
  );
}

function QuizRoute({ route, navigation }: LearningProps<'Quiz'>) {
  const { token, refresh } = useAppSession();
  return <QuizScreen lessonId={route.params.lessonId} token={token} onBack={() => navigation.goBack()} onCompleted={refresh} />;
}

function AssignmentRoute({ route, navigation }: LearningProps<'Assignment'>) {
  const { token } = useAppSession();
  return <AssignmentScreen lessonId={route.params.lessonId} token={token} onBack={() => navigation.goBack()} />;
}

function ResourceRoute({ route, navigation }: LearningProps<'Resource'>) {
  const { title, localUri, kind, mime } = route.params;
  return (
    <ResourceViewerScreen
      title={title}
      localUri={localUri}
      kind={kind}
      onBack={() => navigation.goBack()}
      onOpenWithSystem={() => void openWithSystem(localUri, mime).catch(() => undefined)}
    />
  );
}

function TodayRoot({ navigation }: LearningProps<'Root'>) {
  const { token, dashboard, loading, refresh } = useAppSession();
  return (
    <HomeScreen
      data={dashboard}
      loading={loading}
      token={token}
      onRefresh={refresh}
      onOpenCourse={(courseId) => navigation.push('Course', { courseId })}
      onOpenLesson={(lessonId) => navigation.push('Lesson', { lessonId })}
      onOpenProgram={(programId) => navigation.push('Program', { programId })}
    />
  );
}

function CoursesRoot({ navigation }: LearningProps<'Root'>) {
  const { token, dashboard, loading, refresh } = useAppSession();
  return (
    <CoursesScreen
      courses={dashboard?.courses ?? []}
      token={token}
      refreshing={loading}
      onRefresh={refresh}
      onOpenCourse={(courseId) => navigation.push('Course', { courseId })}
      onOpenLesson={(lessonId) => navigation.push('Lesson', { lessonId })}
      onOpenProgram={(programId) => navigation.push('Program', { programId })}
    />
  );
}

type ProfileStackParams = { Root: undefined; Downloads: undefined };

function ProfileRoot({ navigation }: NativeStackScreenProps<ProfileStackParams, 'Root'>) {
  const { dashboard, logout, mode, canSwitchMode, switchMode } = useAppSession();
  return (
    <ProfileScreen
      displayName={dashboard?.user.display_name || 'Perfil'}
      email={dashboard?.user.email}
      onLogout={logout}
      mode={mode}
      onSwitchMode={canSwitchMode ? switchMode : undefined}
      onOpenDownloads={() => navigation.push('Downloads')}
    />
  );
}

function DownloadsRoute({ navigation }: NativeStackScreenProps<ProfileStackParams, 'Downloads'>) {
  const { dashboard } = useAppSession();
  return <DownloadsScreen courses={dashboard?.courses ?? []} onBack={() => navigation.goBack()} />;
}

const ProfileNav = createNativeStackNavigator<ProfileStackParams>();
function ProfileStack() {
  return (
    <ProfileNav.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
      <ProfileNav.Screen name="Root" component={ProfileRoot} />
      <ProfileNav.Screen name="Downloads" component={DownloadsRoute} />
    </ProfileNav.Navigator>
  );
}

const Stack = createNativeStackNavigator<LearningStackParams>();

function learningStack(Root: (props: LearningProps<'Root'>) => ReactElement) {
  return function LearningStack() {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
        <Stack.Screen name="Root" component={Root} />
        <Stack.Screen name="Course" component={CourseRoute} />
        <Stack.Screen name="Program" component={ProgramRoute} />
        <Stack.Screen name="Lesson" component={LessonRoute} />
        <Stack.Screen name="Quiz" component={QuizRoute} />
        <Stack.Screen name="Assignment" component={AssignmentRoute} />
        <Stack.Screen name="Resource" component={ResourceRoute} />
      </Stack.Navigator>
    );
  };
}

const TodayStack = learningStack(TodayRoot);
const CoursesStack = learningStack(CoursesRoot);

const SingleStack = createNativeStackNavigator<{ Root: undefined }>();
function singleStack(Screen: () => ReactElement) {
  return function Single() {
    return (
      <SingleStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
        <SingleStack.Screen name="Root" component={Screen} />
      </SingleStack.Navigator>
    );
  };
}

const AgendaStack = singleStack(() => (
  <ComingSoonScreen title="Agenda" description="Tus clases, entregas y fechas importantes aparecerán aquí." />
));
const MessagesStack = singleStack(() => (
  <ComingSoonScreen title="Mensajes" description="Las conversaciones con tus docentes y compañeros llegarán en una próxima versión." />
));
const GradingStack = singleStack(() => (
  <ComingSoonScreen title="Calificar" description="La revisión de entregas desde el teléfono llegará en una próxima versión. Por ahora, califica desde la web." />
));

type IconName = ComponentProps<typeof Ionicons>['name'];
type TabSpec = { name: string; label: string; icon: IconName; component: () => ReactElement };

const STUDENT_TABS: TabSpec[] = [
  { name: 'Today', label: 'Hoy', icon: 'today-outline', component: TodayStack },
  { name: 'Courses', label: 'Cursos', icon: 'book-outline', component: CoursesStack },
  { name: 'Agenda', label: 'Agenda', icon: 'calendar-outline', component: AgendaStack },
  { name: 'Messages', label: 'Mensajes', icon: 'chatbubbles-outline', component: MessagesStack },
  { name: 'Me', label: 'Yo', icon: 'person-circle-outline', component: ProfileStack },
];

const TEACHER_TABS: TabSpec[] = [
  { name: 'Today', label: 'Hoy', icon: 'today-outline', component: TodayStack },
  { name: 'Courses', label: 'Cursos', icon: 'book-outline', component: CoursesStack },
  { name: 'Grading', label: 'Calificar', icon: 'checkmark-done-outline', component: GradingStack },
  { name: 'Messages', label: 'Mensajes', icon: 'chatbubbles-outline', component: MessagesStack },
  { name: 'Me', label: 'Yo', icon: 'person-circle-outline', component: ProfileStack },
];

const Tabs = createBottomTabNavigator();

/** Rutas a pantalla completa: sin cabecera de marca ni barra inferior. */
function isImmersive(route: RouteProp<Record<string, object | undefined>, string>): boolean {
  const focused = getFocusedRouteNameFromRoute(route);
  return focused === 'Quiz' || focused === 'Resource';
}

function BrandHeader() {
  const { dashboardError, refresh, mode } = useAppSession();
  return (
    <View style={styles.headerWrap}>
      <View style={styles.header}>
        <Text style={styles.brand}>ATORA</Text>
        <Text style={styles.product}>{mode === 'teacher' ? 'Docente' : 'Aprendizaje móvil'}</Text>
      </View>
      <NetworkBanner />
      {dashboardError ? (
        <View style={styles.dashboardError}>
          <Text accessibilityRole="alert" style={styles.dashboardErrorText}>{dashboardError}</Text>
          <Pressable accessibilityRole="button" onPress={refresh} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export function AppNavigator({ session }: { session: AppSessionValue }) {
  const tabs = session.mode === 'teacher' ? TEACHER_TABS : STUDENT_TABS;
  return (
    <AppSessionContext.Provider value={session}>
      <NavigationContainer theme={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.background, primary: colors.primary } }}>
        <Tabs.Navigator
          // La clave fuerza un árbol nuevo al cambiar de modo: cada rol arranca en Hoy.
          key={session.mode}
          screenOptions={({ route }) => ({
            header: () => <BrandHeader />,
            headerShown: !isImmersive(route),
            tabBarActiveTintColor: colors.blue,
            tabBarInactiveTintColor: colors.muted,
            tabBarStyle: isImmersive(route) ? { display: 'none' } : { borderTopColor: colors.border },
            tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
          })}
        >
          {tabs.map((tab) => (
            <Tabs.Screen
              key={tab.name}
              name={tab.name}
              component={tab.component}
              options={{
                title: tab.label,
                tabBarIcon: ({ color, size }) => <Ionicons name={tab.icon} color={color} size={size} />,
              }}
            />
          ))}
        </Tabs.Navigator>
      </NavigationContainer>
    </AppSessionContext.Provider>
  );
}

const styles = StyleSheet.create({
  headerWrap: { backgroundColor: colors.surface, borderBottomColor: colors.line, borderBottomWidth: 1 },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  brand: { color: colors.primary, fontSize: 22, fontWeight: '900', letterSpacing: 2 },
  product: { color: colors.accentText, fontSize: 12, fontWeight: '700' },
  dashboardError: { alignItems: 'center', backgroundColor: colors.dangerSoft, borderBottomColor: colors.red, borderBottomWidth: 1, flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  dashboardErrorText: { color: colors.red, flex: 1, fontSize: 14 },
  retryButton: { backgroundColor: colors.red, borderRadius: 8, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  retryButtonText: { color: colors.white, fontSize: 13, fontWeight: '800' },
});
