import { announcementDedupeKey, cleanAnnouncement, pendingFor } from '../announcements';

describe('aviso al grupo (0.7.0)', () => {
  it('limpia el texto y no envía un aviso vacío', () => {
    expect(cleanAnnouncement('  Mañana  ', '  Nos vemos el jueves.  ')).toEqual({ title: 'Mañana', body: 'Nos vemos el jueves.' });
    expect(cleanAnnouncement('Solo título', '   ')).toBeNull();
    expect(cleanAnnouncement('x'.repeat(200), 'y')?.title).toHaveLength(120);
  });

  it('cada envío tiene su propia clave en la cola (no se fusionan dos avisos)', () => {
    expect(announcementDedupeKey('a')).not.toBe(announcementDedupeKey('b'));
  });

  it('muestra solo los pendientes de ese curso, el más nuevo arriba', () => {
    const event = (id: string, courseId: number, createdAt: string) => ({ id, payload: { courseId, title: id, body: 'b', createdAt } });
    const list = pendingFor([event('a', 1, '2026-10-06T10:00:00Z'), event('b', 2, '2026-10-06T11:00:00Z'), event('c', 1, '2026-10-06T12:00:00Z')], 1);
    expect(list.map((item) => item.id)).toEqual(['c', 'a']);
  });
});
