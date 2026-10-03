import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StudentHome } from '../types';

export type AppMode = 'student' | 'teacher';

/** Roles de WordPress / ATORA LMS que abren el árbol docente. */
const TEACHER_ROLES = ['lms_instructor', 'lms_instructor_assistant', 'lms_coordinator', 'administrator'];

export function isTeacher(roles: string[] | undefined): boolean {
  return (roles ?? []).some((role) => TEACHER_ROLES.includes(role));
}

/** Un docente con matrículas propias puede alternar al modo estudiante. */
export function canSwitchMode(dashboard: StudentHome | null): boolean {
  return isTeacher(dashboard?.user.roles) && (dashboard?.courses.length ?? 0) > 0;
}

// Prefijo atora.cache.: se purga al cerrar sesión junto con el resto de cachés del usuario.
const modeKey = (userId: number) => `atora.cache.u${userId}.mode.v1`;

export async function resolveMode(dashboard: StudentHome | null): Promise<AppMode> {
  if (!dashboard || !isTeacher(dashboard.user.roles)) return 'student';
  if (!canSwitchMode(dashboard)) return 'teacher';
  const stored = await AsyncStorage.getItem(modeKey(dashboard.user.id)).catch(() => null);
  return stored === 'student' ? 'student' : 'teacher';
}

export async function saveMode(userId: number, mode: AppMode): Promise<void> {
  await AsyncStorage.setItem(modeKey(userId), mode).catch(() => undefined);
}
