import { createContext, useContext, type ComponentProps, type ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer, DefaultTheme, createNavigationContainerRef, getFocusedRouteNameFromRoute, type RouteProp } from '@react-navigation/native';
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
import { CertificatesScreen } from '../screens/CertificatesScreen';
import { CourseGradesScreen } from '../screens/CourseGradesScreen';
import { EvolutionScreen } from '../screens/EvolutionScreen';
import { ResourceViewerScreen } from '../screens/ResourceViewerScreen';
import { AgendaScreen } from '../screens/AgendaScreen';
import { ComposeScreen } from '../screens/ComposeScreen';
import { MessagesScreen } from '../screens/MessagesScreen';
import { ThreadScreen } from '../screens/ThreadScreen';
import { TodayScreen } from '../screens/TodayScreen';
import { AnnouncementScreen } from '../screens/teacher/AnnouncementScreen';
import { GradingQueueScreen } from '../screens/teacher/GradingQueueScreen';
import { TeacherCoursesScreen } from '../screens/teacher/TeacherCoursesScreen';
import { TeacherStudentScreen } from '../screens/teacher/TeacherStudentScreen';
import { TeacherStudentsScreen } from '../screens/teacher/TeacherStudentsScreen';
import { TeacherTodayScreen } from '../screens/teacher/TeacherTodayScreen';
import { PushPreferences, PushPrompt } from '../components/PushSettings';
import type { Destination } from '../notifications/route';
import { openWithSystem } from '../viewer/files';
import { colors, spacing } from '../theme';
import type { InternalLink, StudentHome } from '../types';
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
  /** Funciones que el servidor declara (0.5.0; 0.6.0 suma buzón, agenda, Hoy y avisos al teléfono). */
  features: { grades: boolean; certificates: boolean; messages: boolean; agenda: boolean; today: boolean; push: boolean; teacher: boolean; grading: boolean };
  /** Contador único de no leídos (mensajes y avisos), 0.6.0. */
  unreadMessages: number;
  /** Cursos con una nota liberada que el estudiante todavía no vio. */
  newGradeCourses: number[];
  refreshGradeBadges: () => void;
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
  Resource: { title: string; localUri: string; kind: 'pdf' | 'image' | 'html'; mime?: string };
  CourseGrades: { courseId: number; title: string };
  /** 0.6.0: buzón. */
  Thread: { threadId?: number; title?: string; recipient?: { id: number; name: string; courseId?: number } };
  Compose: undefined;
  /** 0.7.0: docente. */
  TeacherStudents: { courseId: number; title: string; sections: { id: number; title: string }[] };
  TeacherStudent: { studentId: number; courseId: number; name: string };
  Announcement: { courseId: number; title: string; sections: { id: number; title: string }[] };
};

/** 0.6.0: para abrir la pantalla de una notificación desde fuera del árbol. */
export const navigationRef = createNavigationContainerRef<Record<string, object | undefined>>();

/** Abre lo que anuncia una notificación (pestaña y pantalla). */
export function openDestination(destination: Destination): void {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate(destination.tab, destination.screen === 'Root' ? { screen: 'Root' } : { screen: destination.screen, params: destination.params, initial: false });
}

type LearningProps<T extends keyof LearningStackParams> = NativeStackScreenProps<LearningStackParams, T>;

/** Enlace interno (aviso, agenda, Hoy) dentro de la misma pila. */
function openLink(navigation: LearningProps<keyof LearningStackParams>['navigation'], link: InternalLink): void {
  if (link.type === 'assignment') navigation.push('Assignment', { lessonId: link.id });
  else if (link.type === 'quiz') navigation.push('Quiz', { lessonId: link.id });
  else if (link.type === 'lesson') navigation.push('Lesson', { lessonId: link.id });
  else navigation.push('Course', { courseId: link.id });
}

function ThreadRoute({ route, navigation }: LearningProps<'Thread'>) {
  const { token } = useAppSession();
  return (
    <ThreadScreen
      token={token}
      threadId={route.params.threadId}
      title={route.params.title}
      recipient={route.params.recipient}
      onBack={() => navigation.goBack()}
      onOpenLink={(link) => openLink(navigation, link)}
      onThreadCreated={(threadId) => navigation.replace('Thread', { threadId, title: route.params.recipient?.name })}
    />
  );
}

function ComposeRoute({ navigation }: LearningProps<'Compose'>) {
  const { token } = useAppSession();
  return <ComposeScreen token={token} onBack={() => navigation.goBack()} onPick={(recipient) => navigation.replace('Thread', { recipient })} />;
}

function MessagesRoot({ navigation }: LearningProps<'Root'>) {
  const { token, mode, features } = useAppSession();
  if (!features.messages) {
    return <ComingSoonScreen title="Mensajes" description="Actualiza ATORA LMS a la 6.30.0 para usar el buzón en la app." />;
  }
  return (
    <MessagesScreen
      token={token}
      canCompose={mode === 'student'}
      onOpenThread={(thread) => navigation.push('Thread', { threadId: thread.id, title: thread.title })}
      onCompose={() => navigation.push('Compose')}
      pushPrompt={features.push ? <PushPrompt token={token} compact /> : null}
    />
  );
}

function AgendaRoot({ navigation }: LearningProps<'Root'>) {
  const { token, features } = useAppSession();
  if (!features.agenda) {
    return <ComingSoonScreen title="Agenda" description="Actualiza ATORA LMS a la 6.30.0 para ver tus fechas en la app." />;
  }
  return <AgendaScreen token={token} onOpenLink={(link) => openLink(navigation, link)} />;
}

function CourseRoute({ route, navigation }: LearningProps<'Course'>) {
  const { token, mode, features, newGradeCourses } = useAppSession();
  const { courseId } = route.params;
  return (
    <CourseScreen
      courseId={courseId}
      token={token}
      onBack={() => navigation.goBack()}
      onOpenLesson={(lessonId) => navigation.push('Lesson', { lessonId })}
      hasNewGrade={newGradeCourses.includes(courseId)}
      onOpenQuiz={mode === 'student' ? (lessonId) => navigation.push('Quiz', { lessonId }) : undefined}
      onOpenGrades={features.grades && mode === 'student' ? (title) => navigation.push('CourseGrades', { courseId, title }) : undefined}
    />
  );
}

function CourseGradesRoute({ route, navigation }: LearningProps<'CourseGrades'>) {
  const { token, refreshGradeBadges } = useAppSession();
  return (
    <CourseGradesScreen
      courseId={route.params.courseId}
      title={route.params.title}
      token={token}
      onBack={() => navigation.goBack()}
      onOpenAssignment={(lessonId) => navigation.push('Assignment', { lessonId })}
      onOpenLesson={(lessonId) => navigation.push('Lesson', { lessonId })}
      onSeen={refreshGradeBadges}
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

function TeacherStudentsRoute({ route, navigation }: LearningProps<'TeacherStudents'>) {
  const { token } = useAppSession();
  const { courseId, title, sections } = route.params;
  return (
    <TeacherStudentsScreen
      token={token}
      courseId={courseId}
      title={title}
      onBack={() => navigation.goBack()}
      onOpenStudent={(student) => navigation.push('TeacherStudent', { studentId: student.id, courseId, name: student.name })}
      onAnnounce={() => navigation.push('Announcement', { courseId, title, sections })}
    />
  );
}

function TeacherStudentRoute({ route, navigation }: LearningProps<'TeacherStudent'>) {
  const { token } = useAppSession();
  return (
    <TeacherStudentScreen
      token={token}
      studentId={route.params.studentId}
      courseId={route.params.courseId}
      name={route.params.name}
      onBack={() => navigation.goBack()}
      onWrite={(recipient) => navigation.push('Thread', { recipient, title: recipient.name })}
    />
  );
}

function AnnouncementRoute({ route, navigation }: LearningProps<'Announcement'>) {
  const { token } = useAppSession();
  return <AnnouncementScreen token={token} courseId={route.params.courseId} title={route.params.title} sections={route.params.sections} onBack={() => navigation.goBack()} />;
}

function TodayRoot({ navigation }: LearningProps<'Root'>) {
  const { token, dashboard, loading, refresh, mode } = useAppSession();
  const today = useAppSession();
  if (today.mode === 'teacher' && today.features.teacher) {
    return (
      <TeacherTodayScreen
        token={today.token}
        name={today.dashboard?.user.display_name ?? ''}
        onOpenGrading={() => navigation.getParent()?.navigate('Grading')}
        onOpenStudent={(studentId, courseId, name) => navigation.push('TeacherStudent', { studentId, courseId, name })}
        onOpenMessages={() => navigation.getParent()?.navigate('Messages')}
      />
    );
  }
  if (today.mode === 'student' && today.features.today) {
    return (
      <TodayScreen
        token={today.token}
        name={today.dashboard?.user.display_name ?? ''}
        newGradeCourses={today.newGradeCourses}
        onOpenLesson={(lessonId) => navigation.push('Lesson', { lessonId })}
        onOpenQuiz={(lessonId) => navigation.push('Quiz', { lessonId })}
        onOpenLink={(link) => openLink(navigation, link)}
        onOpenMessages={() => navigation.getParent()?.navigate('Messages')}
        onOpenCourseGrades={(courseId, title) => navigation.push('CourseGrades', { courseId, title })}
      />
    );
  }
  return (
    <HomeScreen
      data={dashboard}
      loading={loading}
      token={token}
      onRefresh={refresh}
      onOpenCourse={(courseId) => navigation.push('Course', { courseId })}
      onOpenLesson={(lessonId) => navigation.push('Lesson', { lessonId })}
      onOpenProgram={(programId) => navigation.push('Program', { programId })}
      onOpenQuiz={mode === 'student' ? (lessonId) => navigation.push('Quiz', { lessonId }) : undefined}
    />
  );
}

function CoursesRoot({ navigation }: LearningProps<'Root'>) {
  const { token, dashboard, loading, refresh, mode, features } = useAppSession();
  if (mode === 'teacher' && features.teacher) {
    return (
      <TeacherCoursesScreen
        token={token}
        onOpenCourse={(course) => navigation.push('TeacherStudents', { courseId: course.id, title: course.title, sections: course.sections.map(({ id, title }) => ({ id, title })) })}
      />
    );
  }
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

type ProfileStackParams = {
  Root: undefined;
  Downloads: undefined;
  Evolution: undefined;
  Certificates: undefined;
  CourseGrades: { courseId: number; title: string };
  Resource: LearningStackParams['Resource'];
};
type ProfileProps<T extends keyof ProfileStackParams> = NativeStackScreenProps<ProfileStackParams, T>;

function ProfileRoot({ navigation }: ProfileProps<'Root'>) {
  const { token, dashboard, logout, mode, canSwitchMode, switchMode, features, newGradeCourses } = useAppSession();
  const student = mode === 'student';
  return (
    <ProfileScreen
      displayName={dashboard?.user.display_name || 'Perfil'}
      email={dashboard?.user.email}
      onLogout={logout}
      mode={mode}
      onSwitchMode={canSwitchMode ? switchMode : undefined}
      onOpenDownloads={() => navigation.push('Downloads')}
      onOpenEvolution={features.grades && student ? () => navigation.push('Evolution') : undefined}
      newGrades={newGradeCourses.length}
      onOpenCertificates={features.certificates && student ? () => navigation.push('Certificates') : undefined}
      notificationSettings={features.push ? <PushPreferences token={token} /> : undefined}
    />
  );
}

function EvolutionRoute({ navigation }: ProfileProps<'Evolution'>) {
  const { token, newGradeCourses, refreshGradeBadges } = useAppSession();
  return (
    <EvolutionScreen
      token={token}
      newGradeCourses={newGradeCourses}
      onBack={() => navigation.goBack()}
      onOpenCourseGrades={(courseId, title) => navigation.push('CourseGrades', { courseId, title })}
      onSeen={refreshGradeBadges}
    />
  );
}

function ProfileCourseGradesRoute({ route, navigation }: ProfileProps<'CourseGrades'>) {
  const { token, refreshGradeBadges } = useAppSession();
  // Desde Yo, la tarea o la lección se abren en la pestaña Cursos (allí vive su pila).
  const openInCourses = (screen: 'Assignment' | 'Lesson', lessonId: number) =>
    navigation.getParent()?.navigate('Courses', { screen, params: { lessonId }, initial: false });
  return (
    <CourseGradesScreen
      courseId={route.params.courseId}
      title={route.params.title}
      token={token}
      onBack={() => navigation.goBack()}
      onOpenAssignment={(lessonId) => openInCourses('Assignment', lessonId)}
      onOpenLesson={(lessonId) => openInCourses('Lesson', lessonId)}
      onSeen={refreshGradeBadges}
    />
  );
}

function CertificatesRoute({ navigation }: ProfileProps<'Certificates'>) {
  const { token } = useAppSession();
  return (
    <CertificatesScreen
      token={token}
      onBack={() => navigation.goBack()}
      onOpen={(title, localUri) => navigation.push('Resource', { title, localUri, kind: 'html', mime: 'text/html' })}
    />
  );
}

function ProfileResourceRoute({ route, navigation }: ProfileProps<'Resource'>) {
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

function DownloadsRoute({ navigation }: ProfileProps<'Downloads'>) {
  const { dashboard } = useAppSession();
  return <DownloadsScreen courses={dashboard?.courses ?? []} onBack={() => navigation.goBack()} />;
}

const ProfileNav = createNativeStackNavigator<ProfileStackParams>();
function ProfileStack() {
  return (
    <ProfileNav.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
      <ProfileNav.Screen name="Root" component={ProfileRoot} />
      <ProfileNav.Screen name="Downloads" component={DownloadsRoute} />
      <ProfileNav.Screen name="Evolution" component={EvolutionRoute} />
      <ProfileNav.Screen name="CourseGrades" component={ProfileCourseGradesRoute} />
      <ProfileNav.Screen name="Certificates" component={CertificatesRoute} />
      <ProfileNav.Screen name="Resource" component={ProfileResourceRoute} />
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
        <Stack.Screen name="CourseGrades" component={CourseGradesRoute} />
        <Stack.Screen name="Thread" component={ThreadRoute} />
        <Stack.Screen name="Compose" component={ComposeRoute} />
        <Stack.Screen name="TeacherStudents" component={TeacherStudentsRoute} />
        <Stack.Screen name="TeacherStudent" component={TeacherStudentRoute} />
        <Stack.Screen name="Announcement" component={AnnouncementRoute} />
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

const AgendaStack = learningStack(AgendaRoot);
const MessagesStack = learningStack(MessagesRoot);
function GradingRoot() {
  const { token, features } = useAppSession();
  if (!features.teacher) {
    return <ComingSoonScreen title="Calificar" description="Actualiza ATORA LMS a la 6.31.0 para ver la cola de entregas en la app. Por ahora, califica desde la web." />;
  }
  // 0.7.0: cola de consulta; calificar llega en 0.8.0.
  return <GradingQueueScreen token={token} />;
}
const GradingStack = learningStack(GradingRoot);

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
  return focused === 'Quiz' || focused === 'Resource' || focused === 'Thread';
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
  const meBadge = session.mode === 'student' && session.newGradeCourses.length ? session.newGradeCourses.length : undefined;
  return (
    <AppSessionContext.Provider value={session}>
      <NavigationContainer ref={navigationRef} theme={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.background, primary: colors.primary } }}>
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
                tabBarBadge: tab.name === 'Me' ? meBadge : tab.name === 'Messages' && session.unreadMessages > 0 ? (session.unreadMessages > 99 ? '99+' : session.unreadMessages) : undefined,
                tabBarBadgeStyle: { backgroundColor: colors.mustard, color: colors.navy, fontWeight: '900' },
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
