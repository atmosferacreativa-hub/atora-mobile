# Changelog — ATORA Mobile

Toda versión publicada lleva su etiqueta `vX.Y.Z` y su entrada aquí en el mismo PR que sube el número.

## 0.5.0 (2026-10-04)

Fase 2 — Rendir. Requiere **ATORA LMS 6.29.1** (`capabilities.grades`, `capabilities.certificates`); con servidores anteriores la app oculta notas, evolución y certificados. Regla: el estudiante nunca ve en la app una nota que no vería en la web; la decide el servidor.

- **Quiz sin perder respuestas**: el intento se guarda en el teléfono a cada respuesta (`src/offline/quizDrafts.ts`, puro). Al volver, se retoma el mismo intento aunque no haya conexión; el reloj cuenta desde el inicio real. Entregar necesita conexión ("Tus respuestas están guardadas"). Si la entrega falla por red o servidor (0, 5xx, 401, 408, 429) el intento se conserva; si el servidor lo rechaza (otro 4xx) se descarta y se muestra su mensaje. No hay entrega automática. Un intento con más de una hora (vence el token) se descarta al abrir.
- **Tareas**: estado "En revisión" mientras el docente califica; con la nota liberada se ve la rúbrica por criterio (puntaje, competencia, comentario, fortalezas, a reforzar, recomendación).
- **Mi evolución** (en Yo): programas y cursos con avance, nota acumulada y estado (en curso, en riesgo, aprobado…), y próximas evaluaciones. Sin conexión muestra lo último sincronizado con su fecha.
- **Notas del curso**: botón "Notas" en el curso (y desde Mi evolución) con cada actividad, su nota liberada y su estado; la tarea abre su entrega.
- **Aviso de nota nueva**: distintivo en la pestaña Yo y "Nota nueva" en el curso cuando llega una nota liberada (`graded_count` / `last_graded_at`); se apaga al ver las notas. La primera vez no avisa de lo ya calificado.
- **Certificados** (formato provisional HTML): lista con estado; "Descargar" lo guarda en el teléfono y se abre después sin conexión en el visor, sin JavaScript. Los enlaces del documento se abren en el navegador. Se borran al cerrar sesión, como las demás descargas.
- **Caché local**: tipos `quiz_draft`, `grades`, `course_grades`, `certificates`.
- **TESTS** (Jest): borrador de quiz (guardar, retomar, vencido, decisión tras fallo de entrega) y aviso de nota nueva (línea base, nota nueva, marcar visto por curso).

## 0.4.1 (2026-10-04)

Correcciones de la auditoría y varios videos por lección. Requiere **ATORA LMS 6.28.2** para varios videos (`capabilities.multi_video`); con servidores anteriores, un solo video como en 0.4.0.

- **Fix — la sincronización guardaba el cursor aunque fallara una consigna o la lista de recursos** (alta): la aplicación del plan pasa a `src/offline/sync/apply.ts` (puro, con Jest). Una lección o un curso que falla en cualquier paso conserva su revisión anterior (o 0 si era nuevo) y se vuelve a pedir la próxima vez aunque el cursor avance. Si fallan todos los pedidos, no se guarda nada. La consigna se pide sin caer a la caché.
- **Fix — el límite de 50 páginas podía borrar contenido** (alta): la poda por estado completo y por `enrolled_course_ids` solo se aplica con la última página (`has_more: false`). Si el límite corta un estado completo, se guarda el cursor de continuación del servidor junto con lo ya visto (`sync_state.full_seen`, esquema local 3) y la ejecución siguiente continúa el listado; al terminarlo se poda solo lo que de verdad no está.
- **Fix — cerrar sesión sin red dejaba el panel a la vista** (media): `logout()` ya no lanza; la revocación es "mejor esfuerzo" y el token se revoca en el próximo inicio de sesión con conexión. `App.tsx` limpia la pantalla en `finally`.
- **NEW — varios videos por lección**: lista con miniatura, título, estado (descargado, se puede descargar, solo con conexión), cuál está en el reproductor y hasta dónde se vio. Un solo reproductor carga el video elegido; "Continuar desde…" es por video. YouTube y Vimeo se abren aparte ("Solo con conexión").
- **Posición y descargas por video**: el evento reemplazable de la cola se identifica por lección + video (`video_key`); descargar un video ya no borra los otros de la misma lección. Lo guardado por 0.4.0 (descargas y posiciones pendientes sin clave) queda en el primer video. La pantalla de descargas muestra cada video; "Borrar" en una lección borra todos.
- **Currículo**: la miniatura indica "3 videos" cuando la lección tiene más de uno.
- **Cola**: un envío pedido durante otro (p. ej. la posición final al cambiar de video) dispara una pasada más al terminar, en lugar de esperar al ciclo siguiente.
- **TESTS** (Jest): fallo de la consigna deja la lección pendiente y se vuelve a pedir; todo falla → no se guarda; estado completo cortado no borra nada y al completarse borra solo lo que falta; cierre de sesión sin red; descargar el video 2 no borra el 1; la posición del video 2 no reemplaza la del 1; migración al primer video. Fallan con el código de 0.4.0.

## 0.4.0 (2026-10-04)

Fase 1 — Aprender. Requiere **ATORA LMS 6.28.0** o superior; con servidores anteriores la app oculta lo que el servidor no declara (`sync_changes`, `playback_position`, `resource_downloads`).

- **Sincronización incremental**: al abrir la app y al recuperar conexión pide `/sync/changes` desde el último cursor (guardado por usuario) y trae solo lo que cambió. Baja automáticamente solo lo liviano (texto de la lección, consignas, lista de recursos) de todos los cursos matriculados; nunca archivos ni video. Lección eliminada o matrícula terminada: se borran su contenido y sus descargas. El cursor avanza solo si todo se aplicó.
- **Material de apoyo**: cada recurso muestra tipo, tamaño y estado (disponible sin conexión, se puede descargar, solo con conexión, actualización disponible). "Descargar material del curso" muestra el total antes de confirmar y no incluye videos. Un recurso descargado que cambia se actualiza solo si pesa menos de 5 MB y hay Wi-Fi (o la preferencia lo permite).
- **Visor dentro de la app**: PDF con pdf.js empaquetado en un WebView desde el archivo local (sin conexión y en Expo Go); imágenes con zoom; otros formatos con la app del sistema (`expo-intent-launcher`, `expo-sharing`).
- **Video**: la posición se guarda cada 10 s, al pausar y al salir, como evento de la cola que se **reemplaza** (por lección solo viaja la última). Al volver: "Continuar desde 12:34" o "Empezar de nuevo" (no se ofrece si quedó al final). Video no descargable: "Solo con conexión", sin botón de descarga.
- **Descargas**: videos y material comparten cuota, caducidad y "solo Wi-Fi". Pantalla nueva desde Yo, agrupada por curso, con tamaño por lección, total contra la cuota y borrado por recurso, lección o curso.
- **Fix**: las capacidades del servidor quedaban vacías hasta reiniciar si la primera consulta fallaba (p. ej. academia aún sin configurar), lo que ocultaba funciones; ahora van atadas a la URL de la academia y se recargan al iniciar sesión.
- **Base local**: esquema 2 (`sync_state`, `sync_index`). Jest: planificador de sincronización (alta, cambio, baja, matrículas, reset), eventos reemplazables y cuota con video y material juntos.

## 0.3.1 (2026-10-03)

- **Fix — la APK 0.3.0 se cerraba al abrir**: `@expo/vector-icons` necesita `expo-font` instalada en el proyecto; faltaba y quedó una `expo-font@57` duplicada junto a la 14.0.12 del SDK 54 (dos versiones de un módulo nativo en el build). Se instala `expo-font ~14.0.12`; `expo-doctor` pasa los 18 controles.
- **Fix**: la pantalla de inicio de sesión respeta el área segura superior (el logo quedaba bajo la hora).

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
