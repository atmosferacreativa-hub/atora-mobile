import { AUTO_UPDATE_MAX_BYTES, planMaintenance, resourceKey, shouldAutoUpdate, summarize, type DownloadRecord } from '../downloadsMath';

const MB = 1024 * 1024;
const DAY = 24 * 60 * 60 * 1000;
const settings = { wifiOnly: true, lowDataMode: true, maxBytes: 100 * MB, retentionDays: 30 };

const rec = (over: Partial<DownloadRecord>): DownloadRecord => ({
  lessonId: 1,
  sourceUrl: 'https://a.test/x',
  localUri: `file:///${Math.random()}`,
  size: MB,
  downloadedAt: 0,
  lastAccessedAt: 0,
  ...over,
});

describe('cuota compartida de video y material', () => {
  it('video y material suman a la misma cuota; se libera lo menos usado', () => {
    const now = 10 * DAY;
    const video = rec({ kind: 'video', size: 80 * MB, lastAccessedAt: now - 3 * DAY });
    const pdf = rec({ kind: 'resource', size: 15 * MB, lastAccessedAt: now - 1 * DAY });
    const image = rec({ kind: 'resource', size: 10 * MB, lastAccessedAt: now });
    const { keep, evict } = planMaintenance([video, pdf, image], settings, now);
    expect(evict).toEqual([video]);
    expect(keep.reduce((sum, r) => sum + r.size, 0)).toBe(25 * MB);
  });

  it('lo vencido sale primero, sea video o material', () => {
    const now = 40 * DAY;
    const old = rec({ kind: 'resource', lastAccessedAt: now - 31 * DAY });
    const fresh = rec({ kind: 'video', lastAccessedAt: now - DAY });
    expect(planMaintenance([old, fresh], settings, now).evict).toEqual([old]);
  });

  it('registros de 0.3.x sin tipo cuentan como video', () => {
    const legacy = rec({ size: 2 * MB });
    expect(summarize([legacy]).courses[0]).toMatchObject({ courseId: 0, bytes: 2 * MB });
  });

  it('agrupa por curso y lección, y el total baja lo mismo que pesa el curso borrado', () => {
    const records = [
      rec({ courseId: 3, lessonId: 10, kind: 'video', size: 50 * MB, title: 'Clase 1' }),
      rec({ courseId: 3, lessonId: 10, kind: 'resource', size: 2 * MB }),
      rec({ courseId: 3, lessonId: 11, kind: 'resource', size: 3 * MB }),
      rec({ courseId: 8, lessonId: 20, kind: 'resource', size: 4 * MB }),
    ];
    const usage = summarize(records);
    expect(usage.usedBytes).toBe(59 * MB);
    const course3 = usage.courses.find((c) => c.courseId === 3)!;
    expect(course3.bytes).toBe(55 * MB);
    expect(course3.lessons.find((l) => l.lessonId === 10)).toMatchObject({ bytes: 52 * MB, title: 'Clase 1' });
    const after = summarize(records.filter((r) => r.courseId !== 3));
    expect(usage.usedBytes - after.usedBytes).toBe(course3.bytes);
  });
});

describe('actualización automática de material', () => {
  it('solo si pesa menos de 5 MB y hay Wi-Fi (o la preferencia lo permite)', () => {
    expect(shouldAutoUpdate(MB, true, { wifiOnly: true })).toBe(true);
    expect(shouldAutoUpdate(MB, false, { wifiOnly: true })).toBe(false);
    expect(shouldAutoUpdate(MB, false, { wifiOnly: false })).toBe(true);
    expect(shouldAutoUpdate(AUTO_UPDATE_MAX_BYTES, true, { wifiOnly: false })).toBe(false);
    expect(shouldAutoUpdate(null, true, { wifiOnly: false })).toBe(false);
  });

  it('clave estable por adjunto o por URL', () => {
    expect(resourceKey(7, { file_id: 42, url: 'https://a/x.pdf' })).toBe('7:f42');
    expect(resourceKey(7, { url: 'https://a/x.pdf' })).toBe('7:https://a/x.pdf');
  });
});
