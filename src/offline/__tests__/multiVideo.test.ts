import { enqueue } from '../outbox/engine';
import type { OutboxEvent, OutboxStore } from '../outbox/types';
import { isSameVideo, type DownloadRecord } from '../downloadsMath';
import { pickResume, positionDedupeKey } from '../videoPositions';

class MemoryStore implements OutboxStore {
  events = new Map<string, OutboxEvent>();
  async insert(event: OutboxEvent) {
    if (await this.findByDedupe(event.userId, event.dedupeKey)) return false;
    this.events.set(event.id, { ...event });
    return true;
  }
  async findByDedupe(userId: number, dedupeKey: string) {
    return [...this.events.values()].find((e) => e.userId === userId && e.dedupeKey === dedupeKey) ?? null;
  }
  async list(userId: number) {
    return [...this.events.values()].filter((e) => e.userId === userId);
  }
  async update() {}
  async remove(id: string) {
    this.events.delete(id);
  }
}

const video = (over: Partial<DownloadRecord>): DownloadRecord => ({
  lessonId: 7, sourceUrl: 'https://a.test/v.mp4', localUri: 'file:///x', size: 1, downloadedAt: 0, lastAccessedAt: 0, kind: 'video', ...over,
});

describe('varios videos por lección', () => {
  it('descargar el video 2 no reemplaza al video 1', () => {
    const first = video({ videoKey: 'aaaaaaaaaaaa', localUri: 'file:///1' });
    const replacedBy2 = [first].filter((record) => isSameVideo(record, 7, 'bbbbbbbbbbbb', false));
    expect(replacedBy2).toEqual([]);
    expect([first].filter((record) => isSameVideo(record, 7, 'aaaaaaaaaaaa', true))).toEqual([first]);
  });

  it('una descarga de 0.4.0 (sin clave) es del primer video', () => {
    const legacy = video({ localUri: 'file:///viejo' });
    expect(isSameVideo(legacy, 7, 'aaaaaaaaaaaa', true)).toBe(true);
    expect(isSameVideo(legacy, 7, 'bbbbbbbbbbbb', false)).toBe(false);
    expect(isSameVideo({ ...legacy, kind: 'resource' }, 7, 'aaaaaaaaaaaa', true)).toBe(false);
  });

  it('el evento de posición del video 2 no reemplaza al del video 1', async () => {
    const store = new MemoryStore();
    const put = (id: string, key: string, seconds: number) => enqueue(store, {
      id, userId: 1, type: 'playback_position', dedupeKey: positionDedupeKey(7, key), replace: true,
      payload: { lessonId: 7, videoKey: key, positionSeconds: seconds, durationSeconds: 600, recordedAt: '2026-01-01T10:00:00Z' },
    }, 0);
    await put('p1', 'aaaaaaaaaaaa', 100);
    await put('p2', 'bbbbbbbbbbbb', 200);
    await put('p3', 'bbbbbbbbbbbb', 250);
    expect([...store.events.keys()].sort()).toEqual(['p1', 'p3']);
  });

  it('una posición pendiente de 0.4.0 (sin clave) se ofrece en el primer video', () => {
    const pending = [
      { dedupeKey: positionDedupeKey(7), payload: { lessonId: 7, positionSeconds: 90, durationSeconds: 600, recordedAt: '2026-01-01T10:00:00Z' } },
      { dedupeKey: positionDedupeKey(7, 'bbbbbbbbbbbb'), payload: { lessonId: 7, videoKey: 'bbbbbbbbbbbb', positionSeconds: 40, durationSeconds: 600, recordedAt: '2026-01-01T10:01:00Z' } },
    ];
    expect(pickResume(pending, 7, 'aaaaaaaaaaaa', true, 0)).toBe(90);
    expect(pickResume(pending, 7, 'bbbbbbbbbbbb', false, 0)).toBe(40);
    expect(pickResume(pending, 7, 'cccccccccccc', false, 12)).toBe(12);
  });
});
