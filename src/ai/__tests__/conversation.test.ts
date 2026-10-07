import { appendTurn, clearConversations, getConversation, historyFor, HISTORY_LIMIT, limitMessage } from '../conversation';

describe('conversación del asistente (solo en la sesión)', () => {
  afterEach(() => clearConversations());

  it('guarda por lección y se borra al cerrar sesión', () => {
    appendTurn(5, { role: 'user', content: 'Hola' });
    appendTurn(5, { role: 'assistant', content: '¿En qué te ayudo?' });
    appendTurn(6, { role: 'user', content: 'Otra lección' });
    expect(getConversation(5)).toHaveLength(2);
    expect(getConversation(6)).toHaveLength(1);
    clearConversations();
    expect(getConversation(5)).toEqual([]);
    expect(getConversation(6)).toEqual([]);
  });

  it('manda como contexto solo los últimos 6 turnos', () => {
    for (let i = 0; i < 10; i += 1) appendTurn(1, { role: i % 2 ? 'assistant' : 'user', content: `t${i}` });
    const history = historyFor(getConversation(1));
    expect(history).toHaveLength(HISTORY_LIMIT);
    expect(history[0]!.content).toBe('t4');
    expect(history[5]!.content).toBe('t9');
  });

  it('el mensaje de límite dice cuándo se reinicia', () => {
    const now = new Date('2026-10-06T15:00:00');
    expect(limitMessage('Llegaste al límite de hoy. Se reinicia a las 00:00.', '2026-10-07T00:00:00', now)).toBe('Llegaste al límite de hoy. Se reinicia a las 00:00.');
    expect(limitMessage('Llegaste al límite de hoy.', new Date('2026-10-06T23:30:00').toISOString(), now)).toMatch(/^Llegaste al límite de hoy\. Se reinicia hoy a las /);
    expect(limitMessage('Llegaste al límite.', new Date('2026-10-07T00:00:00').toISOString(), now)).toMatch(/Se reinicia el 7 de octubre a las /);
    expect(limitMessage('Llegaste al límite.', undefined, now)).toBe('Llegaste al límite.');
  });
});
