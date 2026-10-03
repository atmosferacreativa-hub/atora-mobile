# Changelog — ATORA Mobile

Toda versión publicada lleva su etiqueta `vX.Y.Z` y su entrada aquí en el mismo PR que sube el número.

## 0.3.0 (2026-10-03)

Requiere **ATORA LMS 6.27.1** o superior para entregas y miniaturas; con servidores anteriores la app oculta las entregas (no declaran `capabilities.assignments`).

- **Navegación por rol** (React Navigation): estudiante — Hoy · Cursos · Agenda · Mensajes · Yo; docente — Hoy · Cursos · Calificar · Mensajes · Yo. Agenda, Mensajes y Calificar muestran "próximamente". Un docente con matrículas propias alterna de modo desde Yo.
- **Base local SQLite** (`expo-sqlite`) con caché por usuario y **una sola cola** de eventos salientes: `client_event_id` estable, espera creciente, descarte visible ante error definitivo (403, 409, 422…). La cola de lecciones completadas de 0.2.0 se migra sin perder pendientes. Al cerrar sesión no queda ningún dato del usuario anterior; antes se avisa si hay envíos pendientes.
- **Entregas de tareas** con cola sin conexión: consigna, fecha límite, intentos, texto y adjuntos validados contra el servidor, historial (en cola, subiendo, entregada, tardía, calificada con nota y comentario). Subida por fragmentos en orden, reanudable; sesión caducada → se vuelve a subir con el mismo evento; respeta "solo Wi-Fi".
- **Miniaturas de video** en el currículo, como carátula del reproductor y en la lista de descargas; MP4 propios sin miniatura generan una local. Componente único de imagen 16:9 con caché en disco.
- **Sistema visual** con la paleta de la marca (azul vivo, ámbar, fondos claros) y componentes base.
- Jest para la lógica de la cola y la migración, en el CI.

## 0.2.0 (2026-09-21)

- Caché, colas y descargas sin conexión aisladas por usuario y limpiadas al cerrar sesión (antes una cuenta podía heredar datos de la anterior en el mismo teléfono).
- Confirmación antes de borrar una descarga.
- Programas: API y pantalla nativa. Recursos descargables de la lección.
- Panel en caché y cola de lecciones completadas; renovación de sesión ante 401.
- Conexión con ATORA Lab y corrección del origen `localhost` en medios.
- Videos de Google Drive dentro de la app; errores de conexión más claros; sesión segura compatible con cada plataforma; dependencias alineadas a Expo SDK 54.

## 0.1.0 (2026-09-11)

MVP nativo de estudiantes sobre la Mobile API v1 de ATORA LMS:

- Inicio de sesión con tokens móviles revocables guardados en `expo-secure-store`.
- Panel con datos reales, biblioteca de cursos, currículo y lecciones nativas.
- Reproductor de video nativo y descargas para usar sin conexión (preferencia solo Wi-Fi, cuota y caducidad).
- Cola de progreso de lecciones sin conexión.
- Evaluaciones nativas accesibles.
- CI de TypeScript.
