import { addConfirmed, cleanBody, mergeOutgoing, type OutgoingEvent } from '../outgoing';
import type { InboxMessage } from '../../types';

const server = (id: number, eventId: string | null, body: string): InboxMessage => ({
  id, thread_id: 9, kind: 'message', author: { id: 2, name: 'Docente' }, mine: eventId !== null, title: '', body,
  link: null, client_event_id: eventId, created_at: '2026-10-05T10:00:00Z', read: true,
});
const event = (id: string, status: 'pending' | 'failed' = 'pending', at = '2026-10-05T11:00:00Z'): OutgoingEvent => ({
  id, status, lastError: status === 'failed' ? 'No puedes escribir a esta persona.' : '', payload: { threadId: 9, body: `texto ${id}`, createdAt: at },
});

describe('cola de mensajes', () => {
  it('un mensaje escrito sin conexión se ve pendiente arriba de lo recibido', () => {
    const list = mergeOutgoing([server(1, null, 'Hola')], [event('e1')], 9);
    expect(list.map((m) => [m.body, m.state])).toEqual([['texto e1', 'pending'], ['Hola', 'sent']]);
  });

  it('pendiente → enviado: cuando el servidor devuelve el mismo client_event_id, no se repite', () => {
    const confirmed = server(5, 'e1', 'texto e1');
    const list = mergeOutgoing([confirmed, server(1, null, 'Hola')], [event('e1')], 9);
    expect(list.filter((m) => m.client_event_id === 'e1')).toHaveLength(1);
    expect(list[0]!.state).toBe('sent');
  });

  it('error definitivo: se ve "no se envió" con el motivo', () => {
    const [first] = mergeOutgoing([], [event('e2', 'failed')], 9);
    expect(first!.state).toBe('failed');
    expect(first!.error).toBe('No puedes escribir a esta persona.');
  });

  it('idempotencia en la caché: el confirmado entra una sola vez', () => {
    const once = addConfirmed([], server(5, 'e1', 'x'));
    expect(addConfirmed(once, server(5, 'e1', 'x'))).toHaveLength(1);
  });

  it('no se envía un mensaje vacío; los de otros hilos no aparecen', () => {
    expect(cleanBody('   ')).toBeNull();
    expect(cleanBody('  hola  ')).toBe('hola');
    const other: OutgoingEvent = { ...event('e3'), payload: { threadId: 4, body: 'otro', createdAt: 'x' } };
    expect(mergeOutgoing([], [other], 9)).toEqual([]);
  });
});
