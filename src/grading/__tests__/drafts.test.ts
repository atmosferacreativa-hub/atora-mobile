import { discardDraft, hasContent, recoverDraft, saveDraft, type GradingDraft, type GradingDraftStore } from '../drafts';

function memoryStore(): GradingDraftStore & { data: Map<string, GradingDraft> } {
  const data = new Map<string, GradingDraft>();
  return {
    data,
    get: async (u, s) => data.get(`${u}:${s}`) ?? null,
    set: async (u, s, d) => { data.set(`${u}:${s}`, d); },
    remove: async (u, s) => { data.delete(`${u}:${s}`); },
  };
}

const draft = (overrides: Partial<GradingDraft> = {}): GradingDraft => ({
  submissionId: 7,
  revision: 2,
  attempt: 1,
  scores: { 0: { score: '8,5', feedback: 'Claro' } },
  feedback: '',
  grade: '',
  savedAt: 0,
  ...overrides,
});

describe('borrador local de calificación (0.8.0)', () => {
  it('se guarda y se recupera tal cual (también con la app cerrada)', async () => {
    const store = memoryStore();
    await saveDraft(store, 1, draft(), 1000);
    const recovered = await recoverDraft(store, 1, 7, 2);
    expect(recovered).toEqual({ draft: { ...draft(), savedAt: 1000 }, staleRevision: false });
  });

  it('es por usuario y por entrega', async () => {
    const store = memoryStore();
    await saveDraft(store, 1, draft());
    expect(await recoverDraft(store, 2, 7, 2)).toBeNull();
    expect(await recoverDraft(store, 1, 8, 2)).toBeNull();
  });

  it('avisa si otro docente guardó después de empezarlo', async () => {
    const store = memoryStore();
    await saveDraft(store, 1, draft({ revision: 2 }));
    expect((await recoverDraft(store, 1, 7, 3))?.staleRevision).toBe(true);
  });

  it('se descarta al guardar en el servidor (publicar o borrador)', async () => {
    const store = memoryStore();
    await saveDraft(store, 1, draft());
    await discardDraft(store, 1, 7);
    expect(await recoverDraft(store, 1, 7, 2)).toBeNull();
  });

  it('vacío no se guarda: borrar todo lo escrito borra el borrador', async () => {
    const store = memoryStore();
    await saveDraft(store, 1, draft());
    await saveDraft(store, 1, draft({ scores: { 0: { score: ' ', feedback: '' } } }));
    expect(store.data.size).toBe(0);
    expect(hasContent(draft({ scores: {}, feedback: '', grade: '79' }))).toBe(true);
  });
});
