import { destinationFor } from '../route';

describe('notificación → pantalla', () => {
  it('un mensaje abre su hilo', () => {
    expect(destinationFor({ type: 'message', thread_id: 12, message_id: 40 })).toEqual({ tab: 'Messages', screen: 'Thread', params: { threadId: 12 } });
  });

  it('una nota publicada abre la tarea', () => {
    expect(destinationFor({ type: 'notice', kind: 'submission_graded', thread_id: 3, link: { type: 'assignment', id: 7, course_id: 1 } }))
      .toEqual({ tab: 'Courses', screen: 'Assignment', params: { lessonId: 7 } });
  });

  it('lección publicada, quiz y curso', () => {
    expect(destinationFor({ type: 'notice', link: { type: 'lesson', id: 4, course_id: 1 } }).screen).toBe('Lesson');
    expect(destinationFor({ type: 'notice', link: { type: 'quiz', id: 5, course_id: 1 } }).screen).toBe('Quiz');
    expect(destinationFor({ type: 'notice', link: { type: 'course', id: 1, course_id: 1 } })).toEqual({ tab: 'Courses', screen: 'Course', params: { courseId: 1 } });
  });

  it('aviso sin enlace abre Avisos; datos rotos, la lista de mensajes', () => {
    expect(destinationFor({ type: 'notice', thread_id: '3' })).toEqual({ tab: 'Messages', screen: 'Thread', params: { threadId: 3 } });
    expect(destinationFor(null)).toEqual({ tab: 'Messages', screen: 'Root', params: undefined });
    expect(destinationFor({ type: 'message', thread_id: 'abc' })).toEqual({ tab: 'Messages', screen: 'Root', params: undefined });
  });
});
