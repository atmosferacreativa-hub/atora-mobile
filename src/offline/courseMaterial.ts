import { cachedLesson, fetchLesson } from '../api/courses';
import { resourceKey } from './downloadsMath';
import { downloadResource, listResourceDownloads } from './mediaDownloads';
import type { LessonDetail, LessonResource } from '../types';
import { t } from '../i18n/core';

/**
 * "Descargar material del curso" (0.4.0): todo el material descargable de las
 * lecciones del curso que aún no está en el teléfono. Sin videos.
 */
export type CourseMaterialPlan = {
  items: { lesson: LessonDetail; resource: LessonResource }[];
  totalBytes: number;
  /** Archivos cuyo tamaño el servidor no conoce. */
  unknownSize: number;
};

export async function planCourseMaterial(lessonIds: number[], token: string): Promise<CourseMaterialPlan> {
  const plan: CourseMaterialPlan = { items: [], totalBytes: 0, unknownSize: 0 };
  for (const lessonId of lessonIds) {
    const lesson = (await cachedLesson(lessonId)) ?? (await fetchLesson(lessonId, token).catch(() => null));
    if (!lesson) continue;
    const saved = new Set((await listResourceDownloads(lesson.id)).map((record) => record.resourceKey));
    for (const resource of lesson.resources ?? []) {
      if (!resource.downloadable || saved.has(resourceKey(lesson.id, resource))) continue;
      plan.items.push({ lesson, resource });
      if (resource.bytes) plan.totalBytes += resource.bytes;
      else plan.unknownSize += 1;
    }
  }
  return plan;
}

/** Descarga en serie; devuelve cuántos se guardaron y el primer error, si hubo. */
export async function downloadCourseMaterial(
  plan: CourseMaterialPlan,
  onProgress: (done: number, total: number) => void,
): Promise<{ saved: number; error: string }> {
  let saved = 0;
  let error = '';
  for (const [index, { lesson, resource }] of plan.items.entries()) {
    onProgress(index, plan.items.length);
    try {
      await downloadResource(lesson, resource);
      saved += 1;
    } catch (reason) {
      error ||= reason instanceof Error ? reason.message : t('No se pudo descargar un archivo.');
      // Sin red o sin Wi-Fi: no tiene sentido seguir intentando el resto.
      if (/conexión|Wi-Fi|espacio/i.test(error)) break;
    }
  }
  onProgress(plan.items.length, plan.items.length);
  return { saved, error };
}
