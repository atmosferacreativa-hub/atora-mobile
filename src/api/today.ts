import { cachedRequest, type Synced } from './cached';
import type { TodayStaff, TodayStudent } from '../types';

/** Hoy (0.6.0, plugin 6.30.0): bloques según el rol, con respaldo sin conexión. */
export function fetchToday(token: string, role: 'student' | 'staff' = 'student'): Promise<Synced<TodayStudent | TodayStaff>> {
  return cachedRequest<TodayStudent | TodayStaff>(role === 'student' ? 'today?role=student' : 'today', 'today', role === 'student' ? 0 : 1, token);
}
