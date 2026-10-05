import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getSessionUserId } from '../api/session';
import { pendingQuizzes, type PendingQuiz } from '../offline/quizDrafts';
import { listQuizDrafts } from '../offline/quizDraftStore';

/**
 * Intentos de quiz guardados sin entregar (0.5.2). Se relee al volver a la
 * pantalla y el tiempo restante se actualiza cada 15 s.
 */
export function usePendingQuizzes(): PendingQuiz[] {
  const [drafts, setDrafts] = useState<Awaited<ReturnType<typeof listQuizDrafts>>>([]);
  const [now, setNow] = useState(Date.now());

  useFocusEffect(useCallback(() => {
    let active = true;
    void (async () => {
      const userId = await getSessionUserId();
      const list = userId ? await listQuizDrafts(userId).catch(() => []) : [];
      if (active) {
        setDrafts(list);
        setNow(Date.now());
      }
    })();
    return () => { active = false; };
  }, []));

  useEffect(() => {
    if (!drafts.some((draft) => draft.quiz?.remaining_seconds > 0)) return;
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [drafts]);

  return pendingQuizzes(drafts, now);
}
