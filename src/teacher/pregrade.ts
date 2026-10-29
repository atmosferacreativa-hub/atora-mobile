/**
 * 1.4.0 (plugin 6.41.0): pre-calificación del instructor asistente. Módulo puro, para Jest.
 *
 * El asistente califica como el instructor, pero «publicar» la envía al instructor: el estudiante no la ve hasta que
 * el instructor la valida (publicándola) o la devuelve con un comentario.
 */
import type { Pregrade, SubmissionDetail } from './types';
import { t, tk } from '../i18n/core';

export type SavedKind = 'draft' | 'published' | 'pregrade';

/** ¿Quien mira solo pre-califica? (servidor viejo sin el campo: publica como siempre). */
export function onlyPregrades(detail: Pick<SubmissionDetail, 'can_publish'>): boolean {
  return detail.can_publish === false;
}

export function publishLabel(detail: Pick<SubmissionDetail, 'can_publish'>): string {
  return onlyPregrades(detail) ? t('Enviar al instructor') : t('Publicar');
}

export function confirmText(detail: Pick<SubmissionDetail, 'can_publish' | 'group'>): { title: string; body: string } {
  if (onlyPregrades(detail)) {
    return { title: t('¿Enviar al instructor?'), body: t('Queda como pre-calificación: el instructor la revisa y la publica. El estudiante todavía no la ve.') };
  }
  return {
    title: t('¿Publicar la calificación?'),
    body: detail.group
      ? t('El estudiante verá la nota y recibirá un aviso. La nota se aplica a todos los integrantes del grupo.')
      : t('El estudiante verá la nota y los comentarios, y recibirá un aviso.'),
  };
}

/** Qué quedó después de guardar, según lo que respondió el servidor. */
export function savedKind(publish: boolean, after: Pick<SubmissionDetail, 'pregrade' | 'status'>): SavedKind {
  if (!publish) return 'draft';
  return after.pregrade?.pending ? 'pregrade' : 'published';
}

const SAVED_MESSAGES: Record<SavedKind, string> = {
  draft: tk('Borrador guardado: el estudiante todavía no la ve'),
  published: tk('Calificación publicada'),
  pregrade: tk('Enviada al instructor: el estudiante todavía no la ve'),
};

export function savedMessage(kind: SavedKind): string {
  return t(SAVED_MESSAGES[kind]);
}

/** Aviso arriba de la entrega. */
export function pregradeBanner(pregrade: Pregrade | null | undefined, viewerPublishes: boolean): string | null {
  if (!pregrade) return null;
  if (pregrade.pending) {
    const name = pregrade.by?.name ?? '';
    return viewerPublishes
      ? t('Pre-calificación de {name}. Revísala: al publicar queda validada; también puedes devolverla.', { name })
      : t('Enviada al instructor: está por validar.');
  }
  if (pregrade.returned) {
    return t('{name} devolvió la pre-calificación: {comment}', { name: pregrade.returned.by, comment: pregrade.returned.comment });
  }
  return null;
}

/** El instructor puede devolver al asistente cuando hay una pre-calificación pendiente. */
export function canReturn(detail: Pick<SubmissionDetail, 'pregrade' | 'can_publish'>): boolean {
  return !onlyPregrades(detail) && Boolean(detail.pregrade?.pending);
}
