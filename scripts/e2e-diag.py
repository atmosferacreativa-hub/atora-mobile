#!/usr/bin/env python3
"""Diagnóstico tras los recorridos: qué ve el servidor (avisos en el resumen del job).

Sin acceso a los registros del job, esto deja como anotación el estado de la lección «Videos» del estudiante y la
cola de calificación del docente.
"""
import json
import os
import urllib.request

API = os.environ.get('API', 'http://localhost:8080/wp-json/atora-mobile/v1')
PASSWORD = 'atora-e2e-2026'


def call(path, token=None, body=None):
    req = urllib.request.Request(f'{API}/{path}', data=json.dumps(body).encode() if body else None, method='POST' if body else 'GET')
    req.add_header('content-type', 'application/json')
    if token:
        req.add_header('Authorization', f'Bearer {token}')
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            return json.loads(res.read())
    except urllib.error.HTTPError as err:
        return {'_http': err.code, '_body': err.read()[:300].decode('utf-8', 'replace')}


def warn(title, data):
    text = json.dumps(data, ensure_ascii=False)[:900].replace('\n', ' ')
    print(f'::warning title=Diag {title}::{text}')


def token(login):
    data = call('auth/login', body={'login': login, 'password': PASSWORD, 'device_name': 'diag'})
    return data.get('session', {}).get('access_token')


student = token('estudiante_e2e')
courses = call('courses', student)
items = courses.get('items') or courses.get('courses') or []
warn('cursos estudiante', [(c.get('id'), c.get('title')) for c in items])
course = next((c for c in items if c.get('title') == 'Curso E2E'), None)
if course:
    detail = call(f"courses/{course['id']}", student)
    lessons = (detail.get('course') or detail).get('lessons') or detail.get('lessons') or []
    warn('lecciones', [(l.get('id'), l.get('title'), l.get('completed')) for l in lessons][:30])
    videos = next((l for l in lessons if l.get('title') == 'Videos'), None)
    if videos:
        lesson = call(f"lessons/{videos['id']}", student)
        body = lesson.get('lesson', lesson)
        warn('lección Videos', {k: body.get(k) for k in ('id', 'status', 'completed', 'teacher_preview', 'type', '_http', '_body')})

teacher = token('docente_e2e')
for status in ('', 'all'):
    queue = call('teacher/submissions' + (f'?status={status}' if status else ''), teacher)
    rows = queue.get('items') or []
    warn(f'cola docente {status or "por defecto"}', [((r.get('student') or {}).get('name'), (r.get('lesson') or {}).get('title'), r.get('status')) for r in rows][:25] or queue)
