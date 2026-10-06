// docente-calificar-409: el segundo docente guarda la entrega de "Tarea" por la API
// mientras el primero la tiene abierta en el teléfono. API_HOST la pasa el CI.
const base = API_HOST;
const headers = { 'Content-Type': 'application/json' };
const login = json(http.post(`${base}/auth/login`, { headers, body: JSON.stringify({ login: 'docente2_e2e', password: 'atora-e2e-2026', device_name: 'maestro' }) }).body);
const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.session.access_token}` };
const queue = json(http.get(`${base}/teacher/submissions?status=all`, { headers: auth }).body);
const item = queue.items.find((entry) => entry.lesson.title === 'Tarea');
const detail = json(http.get(`${base}/teacher/submissions/${item.id}`, { headers: auth }).body).submission;
const saved = http.post(`${base}/teacher/submissions/${item.id}/grade`, {
  headers: auth,
  body: JSON.stringify({
    scores: [{ index: 0, score: 4, feedback: 'Revisado por el docente dos' }],
    feedback: 'Versión del docente dos',
    grade: 40,
    publish: false,
    expected_revision: detail.revision,
    client_event_id: `maestro-409-${Date.now()}`,
  }),
});
output.otroDocente = saved.status;
