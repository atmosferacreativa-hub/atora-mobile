import { File } from 'expo-file-system';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { getSessionUserId } from '../api/session';
import { cacheGet, cacheSet } from './localCache';
import { thumbnailsDir } from './thumbnailFiles';

/**
 * Miniaturas generadas en el teléfono para MP4 propios sin miniatura en el servidor
 * (primer segundo del video). Se guardan por usuario y se borran al cerrar sesión.
 */
export async function getLocalThumbnail(lessonId: number): Promise<string | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const uri = await cacheGet<string>(userId, 'video_thumb', lessonId).catch(() => null);
  return uri && new File(uri).exists ? uri : null;
}

export async function ensureLocalThumbnail(lessonId: number, videoUri: string): Promise<string | null> {
  const existing = await getLocalThumbnail(lessonId);
  if (existing) return existing;
  const userId = await getSessionUserId();
  if (!userId || !videoUri) return null;
  try {
    const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, { time: 1000, quality: 0.7 });
    const folder = thumbnailsDir();
    folder.create({ intermediates: true, idempotent: true });
    const target = new File(folder, `u${userId}-lesson-${lessonId}.jpg`);
    if (target.exists) target.delete();
    new File(uri).move(target);
    await cacheSet(userId, 'video_thumb', lessonId, target.uri);
    return target.uri;
  } catch {
    return null;
  }
}

/**
 * El servidor no puede sacar miniatura de un MP4 propio: devuelve la portada del curso
 * (o nada). En ese caso conviene generar una local.
 */
export async function needsLocalThumbnail(lesson: { course_id: number; video_provider?: string; video_thumbnail_url?: string }): Promise<boolean> {
  if (lesson.video_provider !== 'direct') return false;
  if (!lesson.video_thumbnail_url) return true;
  const userId = await getSessionUserId();
  if (!userId) return false;
  const course = await cacheGet<{ course?: { thumbnail_url?: string } }>(userId, 'course', lesson.course_id).catch(() => null);
  return Boolean(course?.course?.thumbnail_url) && course?.course?.thumbnail_url === lesson.video_thumbnail_url;
}
