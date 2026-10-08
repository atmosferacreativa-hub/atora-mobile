# Changelog — ATORA Mobile

Toda versión publicada lleva su etiqueta `vX.Y.Z` y su entrada aquí en el mismo PR que sube el número.

## 1.0.0 (2026-10-07)

Fase 6 — Publicación. Requiere **ATORA LMS 6.33.0** para el certificado en PDF y la eliminación de cuenta (con versiones anteriores se ocultan o siguen como antes). **Compilación de prueba (APK `preview`) y de producción (AAB) de la Fase 6.**

- **Idiomas**: español e inglés completos (535 textos en un catálogo). Idioma del teléfono (español si el teléfono está en español; si no, inglés) o el elegido en **Yo → Idioma**; cambiarlo redibuja la app sin perder la pantalla. Fechas en el idioma activo. Los textos que envía la academia (títulos, motivos) llegan en su idioma.
- **Certificado en PDF**: se descarga el PDF institucional (logo, firmas, QR de verificación) y se abre con el visor de PDF, también sin conexión.
- **Eliminar mi cuenta** (Yo), con confirmación: registra la solicitud en la academia, muestra el plazo y cierra la sesión.
- **Accesibilidad**: etiquetas para lector de pantalla en los botones sin texto (también en idioma), áreas táctiles de al menos 44 puntos (58 ajustadas), contraste AA en el tema (el verde de "Calificación publicada" se oscureció), títulos sin cortes con letra grande en Hoy, lección, tarea, calificar y mensajes.
- **Rendimiento en gama baja**: medido en un emulador con 2 GB de RAM y red 3G simulada (arranque en frío, lección con 3 videos, lista de 100 lecciones). Ver `docs/ESTADO.md`.
- **Reporte de cierres inesperados** (Sentry), sin datos personales (sin usuario, correos, tokens ni consultas de URL), solo si la academia lo permite (`crash_reports`); queda apagado hasta configurar la cuenta (`EXPO_PUBLIC_SENTRY_DSN`).
- **Permisos**: se quitaron `READ/WRITE_EXTERNAL_STORAGE` y `SYSTEM_ALERT_WINDOW` (no se usan). iOS: cifrado exento declarado, solo teléfono (sin iPad).
- **Compilación de producción**: perfil `production` con AAB e IPA, números de compilación automáticos en EAS (`appVersionSource: remote`), canal OTA `production` separado de `preview`.
- Se quitaron restos de desarrollo: tarjeta de programa con un título fijo y direcciones internas en "Configurar academia".
- **Documentos de tiendas**: `docs/POLITICA-PRIVACIDAD-APP.md`, `docs/TIENDAS-DATOS.md`, `docs/TIENDAS-REVISION.md`, `docs/TIENDAS-FICHA.md`.
- **Recorridos de pantalla**: `cambio-idioma`, `certificado-pdf` (también sin conexión) y `eliminar-cuenta`; modos del CI `gama-baja` (mediciones) y `tienda` (capturas en 1080 × 2400).
- **TESTS** (Jest): catálogo de idiomas (falla si una pantalla muestra un texto sin traducir o falta una traducción), accesibilidad (etiquetas y 44 puntos), contraste del tema, reporte de errores sin datos personales, pedido del certificado en PDF.

### Bloque E (auditoría externa) — misma versión 1.0.0, nueva compilación

La 1.0.0 nunca llegó a una tienda: sigue siendo 1.0.0 con un número de compilación nuevo y la etiqueta `v1.0.0` movida. Requiere **ATORA LMS 6.33.1** para lo que sigue (con 6.33.0 funciona como antes).

- **Sugerencia de IA atada al intento** (E.3): se pide para el intento que se está calificando y muestra "Sugerencia del intento N". Si es de otro intento o el contenido cambió, lo avisa y oculta "Usar" hasta pedir otra.
- **La sugerencia no se pierde** (E.4): la app consulta el mismo trabajo hasta 3 minutos en total; un corte o un tiempo de espera de la red no la cancela. Pasado ese tiempo muestra "Sigue generándose" con **Consultar otra vez** (sin pedir otra), y al salir y volver a la pantalla retoma el mismo trabajo.
- **Cerrar sesión sin red** (E.6): la baja del teléfono en los avisos y la revocación de la sesión quedan pendientes y se envían al volver la conexión, aunque nadie haya vuelto a iniciar sesión. La revocación usa el token de renovación, que sigue valiendo si el de acceso venció mientras no había red.
- **CI**: prueba real de límites de IA con 10 llamadas simultáneas y límite 3 (`scripts/e2e-concurrent-ai.sh` del plugin).
- **Política de privacidad**: los certificados emitidos se conservan sin datos personales (titular anonimizado).
- **Ícono de la app con fondo blanco**, como el logo original (antes azul marino, que en el teléfono se veía casi negro). La pantalla de inicio no cambia.
- **TESTS** (Jest): la sugerencia sirve solo para su intento; consulta que sobrevive a cortes de red y se rinde a los 3 min; trabajo pendiente por entrega; cierre de sesión en modo avión y reconexión → el servidor ya no tiene el token ni envía avisos.

## 0.9.0 (2026-10-06)

Fase 5 — IA (Bloque 2). Requiere **ATORA LMS 6.32.0** (`capabilities.ai_assistant`, `ai_grading_suggestion`); con versiones anteriores, o si la academia no activó la IA, no aparece nada nuevo. **Única APK `preview` de la Fase 5.**

- **Estudiante — "Preguntar"** en la lección: asistente que responde sobre esa lección (explica y da pistas; no resuelve evaluaciones ni tareas). La conversación vive solo en el teléfono durante la sesión y se borra al cerrar sesión. Aviso la primera vez y siempre visible: "Las respuestas las genera una IA y pueden contener errores. No compartas datos personales." Sin conexión, el botón y el envío se deshabilitan con "Necesitas conexión para usar el asistente" (no se encolan preguntas). Al llegar al límite, el mensaje dice cuándo se reinicia. Reintentar la misma pregunta no se cobra dos veces.
- **Docente — "Sugerencia de IA"** al calificar una tarea abierta: la app pide la sugerencia y consulta cada 3 s (hasta 2 minutos). Muestra por criterio el puntaje sugerido, el nivel y la justificación, la devolución general y el **indicio** de texto generado por IA con su nota y "Indicio no concluyente. Verifica con el estudiante antes de decidir.". **"Usar todo"** o **"Usar"** por criterio solo rellenan el borrador local, marcado "Sugerido por IA" hasta que el docente lo edita: nada se guarda ni se publica sin que el docente lo haga.
- **Recorridos de pantalla**: `estudiante-asistente` (pregunta, respuesta y sin conexión) y `docente-sugerencia-ia` (pedir, ver, usar todo, editar), contra el proveedor simulado del WordPress temporal del CI.
- `docs/PRUEBA-TELEFONO.md`: filas 31–37 (Fase 5).
- **TESTS** (Jest): conversación solo en la sesión (se borra al cerrar sesión, contexto de 6 turnos), mensaje de límite con la hora de reinicio; usar la sugerencia rellena sin enviar (todo o un criterio, marcas que se quitan al editar), consulta cada 3 s y se rinde a los 2 minutos; el indicio no aparece en ninguna pantalla ni tipo del estudiante.

## 0.8.1 (2026-10-06)

Bloque A de la Fase 5 (auditoría externa de la Fase 4). Requiere **ATORA LMS 6.31.1** (revisión obligatoria al calificar). **Sin APK.**

- **Fix — un borrador recuperado podía pisar la nota de otro docente**: el borrador local guarda la revisión con la que se empezó; al recuperarlo, si otro docente guardó después, se muestra su versión junto al borrador y el guardado sigue enviando **la revisión original** (el servidor responde con el conflicto), hasta elegir expresamente **"Reemplazar con mi borrador"** y confirmarlo. Solo entonces se envía la revisión actual.
- **Pruebas de pantalla**: recorrido `docente-borrador-recuperado` (borrador local, la app se cierra, otro docente califica, se recupera y aparece el conflicto); el CI corre además la **prueba de concurrencia real** del plugin (dos guardados a la vez por HTTP: un 200 y un 409).
- `docs/PRUEBA-TELEFONO.md`: filas 26–30 (Bloque A).
- **TESTS** (Jest): revisión enviada con un borrador recuperado (original sin confirmar, actual tras "Reemplazar").

## 0.8.0 (2026-10-06)

Fase 4 — Docente: calificar (Bloque 5). Requiere **ATORA LMS 6.31.0** (`capabilities.teacher_grading`). **Única APK `preview` de la Fase 4.**

- **Calificar** (pestaña): cola filtrable (por calificar, en borrador, tardías, calificadas), de la más antigua a la más nueva, con **contador en la pestaña**.
- **Pantalla de calificación**: visor de la entrega (texto; PDF en el visor de la Fase 1; imágenes con zoom; otros formatos con la app del sistema; enlaces firmados y temporales); lista de intentos con fecha, origen (web o app), tardía y "Realizada sin conexión el…"; **rúbrica táctil**: tocar un nivel pone su puntaje, ajustable con decimales (coma o punto, hasta 2), con el nivel o la banda ("entre X y Y", "por debajo de X") calculados con la misma regla que la web; comentario por criterio; total parcial y nota final con **"Copiar % de la rúbrica"**; comentario general; **Guardar borrador** o **Publicar** (con confirmación); después, **Siguiente entrega**. Sale del mismo guardado que SpeedGrader.
- **Sin conexión**: calificar exige conexión; lo escrito se guarda en el teléfono a cada cambio y se ofrece recuperarlo al volver a abrir la entrega (avisando si otro docente guardó después). Nunca se envía solo; se descarta al guardar en el servidor.
- **Conflicto (409)**: si otro docente guardó primero, se muestra su versión (estado, nota, puntajes y comentario) y se pregunta: revisar su versión o reemplazarla (con confirmación). Nunca se sobrescribe sin confirmar.
- **Entregas grupales**: se indica el grupo y que la nota se aplica a todos los integrantes (también al confirmar la publicación).
- Cerrar sesión borra los archivos descargados para calificar.
- **Recorridos de pantalla**: `docente-calificar` (PDF, rúbrica con un decimal, borrador, publicar y el estudiante ve la nota, el nivel y el comentario) y `docente-calificar-409` (un segundo docente guarda por la API mientras el primero edita).
- **TESTS** (Jest): borrador local (guardar, recuperar, por usuario y entrega, revisión vieja, descartar al guardar, vacío no se guarda); bandas, total y % iguales al servidor con los mismos casos que `RubricLevelBandsTest`; validación de puntaje y nota final como SpeedGrader.

## 0.7.0 (2026-10-06)

Fase 4 — Docente: ver y comunicar (Bloque 4). Requiere **ATORA LMS 6.31.0** (`capabilities.teacher`); con servidores anteriores el docente ve lo de antes y Calificar dice "Próximamente". **Sin APK** (la única de la fase sale con la 0.8.0).

- **Hoy del docente**: por calificar (cantidad y las más antiguas), estudiantes en riesgo, clases y fechas límite del día en sus cursos y mensajes sin leer. Tocar "Por calificar" abre Calificar.
- **Cursos del docente**: sus cursos y secciones con estudiantes y entregas pendientes; la lista de estudiantes muestra avance, nota acumulada, último acceso y el **riesgo con color, ícono y texto con el motivo** ("Riesgo alto: 2 entregas vencidas"), nunca solo color. Búsqueda por nombre (sin acentos). La primera página se ve sin conexión.
- **Ficha del estudiante**: avance, notas, entregas y alertas; **Escribir** abre un hilo directo en Mensajes.
- **Aviso al grupo**: desde el curso (a todo el curso o a una sección); llega a "Avisos" de cada estudiante. Sin conexión queda en la cola de envíos con su `client_event_id` y sale una sola vez al volver.
- **Calificar**: la cola de entregas (por calificar, en borrador, tardías, calificadas), de la más antigua a la más nueva; en esta versión, solo de consulta.
- Cambio de modo docente/estudiante desde Yo, como antes; cada modo muestra solo sus datos (las pestañas y pantallas se rearman al cambiar).
- **Recorridos de pantalla**: `docente-hoy`, `docente-estudiantes`, `docente-aviso` (el estudiante lo recibe en Avisos).
- **TESTS** (Jest): señal de riesgo (texto y motivo siempre, niveles, datos incompletos); aviso (limpieza, vacío no se envía, pendientes por curso).

## 0.6.1 (2026-10-06)

Pruebas de pantalla en CI (orden de la Fase 4, Bloque 2). Sin cambios para el usuario; **sin APK** (la única de la fase sale con la 0.8.0).

- **Recorridos Maestro** (`.maestro/`): `login`, `leccion` (3 videos y completar), `tarea` (entregar), `quiz` (responder y entregar), `mensajes` (leer y responder) y `sin-conexion` (modo avión: aviso, curso desde la caché, mensaje en cola que sale al volver). Una captura por pantalla.
- **CI** (`.github/workflows/e2e.yml`): emulador Android API 34 x86_64 con KVM; WordPress + MySQL en Docker dentro del trabajo, con el plugin de `main` y los datos de `wp atora seed-e2e` (ATORA LMS 6.30.2 o superior); APK compilada en el CI con el perfil `e2e`. Cada PR corre `login` y `leccion`; al etiquetar, al fusionar en `main` o a mano, todos. Las capturas y el informe quedan como artefacto de la ejecución.
- **Perfil `e2e`** (`eas.json` y `ATORA_E2E=1`): solo esa compilación permite HTTP en claro (`plugins/withE2ECleartext.js`) y apaga las actualizaciones remotas; las APK de vista previa y de producción no cambian.
- `docs/PRUEBA-TELEFONO.md`: la lista única que el titular recorre en el teléfono al cerrar cada fase.
- Campos de inicio de sesión con `testID`.
- **Fix**: en una tarea, el aviso "Guardada. Se enviará cuando tengas conexión." quedaba a la vista aunque la entrega ya se hubiera enviado; ahora solo se muestra mientras sigue en la cola (lo detectó el recorrido `tarea`).

## 0.6.0 (2026-10-05)

Fase 3 — Organizarse. Requiere **ATORA LMS 6.30.0** (`capabilities.messages`, `agenda`, `today`, `push_notifications`); con servidores anteriores, Mensajes y Agenda muestran "Próximamente" y Hoy usa el panel anterior.

- **Mensajes** (estudiante y docente): lista de hilos con no leídos y **Avisos fijo arriba**; hilo con historial paginado hacia atrás; responder. El estudiante puede escribir a sus docentes de curso ("Escribir"). Contador único en la pestaña (el mismo de la web). Escribir sin conexión entra a la cola de envíos con su `client_event_id`: el mensaje se ve "Pendiente" y se envía solo al volver la conexión, una sola vez; si el servidor lo rechaza, "No se envió" con el motivo y "Descartar". Los hilos ya abiertos se leen sin conexión. Los avisos con enlace abren la lección, tarea, quiz o curso.
- **Agenda** (estudiante): vista por día y por semana (lunes a domingo), con fechas límite, clases en vivo y eventos; tocar abre la tarea, el quiz o la lección. Sin conexión muestra lo último sincronizado que cubre esas fechas, con su fecha.
- **Hoy** (estudiante): reemplaza el panel anterior con los bloques de `/today`: evaluación sin entregar (0.5.2), continuar la última lección, vencidas sin entregar, próximos 7 días, mensajes sin leer y notas nuevas.
- **Avisos en el teléfono** (`expo-notifications`): el permiso se pide solo al tocar "Activar", después de una explicación (en Mensajes y en Yo), nunca al abrir la app por primera vez. Preferencias por tipo en Yo (mensajes, notas, fechas límite, avisos), guardadas en la academia. Tocar un aviso abre la pantalla correcta, también con la app cerrada. El aviso no muestra el contenido. Sin permiso, la app se pone al día al abrirse y al volver a primer plano. Cerrar sesión borra el token del teléfono en la academia.
- **Docente**: Mensajes funciona igual; Calificar sigue en "Próximamente" (Fase 4).
- **TESTS** (Jest): cola de mensajes (pendiente arriba, pendiente → enviado sin duplicar por `client_event_id`, error definitivo con motivo, idempotencia en caché, vacío no se envía); notificación → pantalla (mensaje → hilo, nota → tarea, lección, quiz, curso, aviso sin enlace → Avisos, datos rotos); agenda (semana lunes–domingo, agrupación por día, sin conexión con fecha y fuera de rango).
- Dependencias nuevas: `expo-notifications`, `expo-device`, `expo-constants` (SDK 54).

## 0.5.3 (2026-10-05)

Correcciones de la auditoría. Requiere **ATORA LMS 6.29.5** para que "Sin calificaciones" y "0" lleguen distintos.

- **Fix — reintento de sincronización incompleto** (alta): cuando fallaba un curso o una lección, la app conservaba su revisión anterior pero el cursor avanzaba; si el servidor no volvía a listar ese cambio, nunca se volvía a pedir (la prueba de 0.4.1 pasaba porque volvía a entregar el cambio). Ahora lo que falla va a la tabla local `sync_pending` (esquema 4: tipo, id, curso, revisión objetivo, intentos, último error, próximo intento) **en la misma transacción que guarda el cursor**, y cada sincronización lo reintenta primero aunque la respuesta venga vacía. Al lograrlo sale de la tabla y guarda su revisión. Espera creciente por elemento (1, 2, 4… min, hasta 6 h); tras 10 intentos sigue pendiente pero ya no cuenta como fallo de la sincronización. Un 404/403 en el reintento es una baja (se borran su contenido y descargas). Si el servidor vuelve a anunciar el objeto con otra revisión, se actualiza la revisión objetivo sin pedirlo dos veces. Cerrar sesión borra `sync_pending`.
- **"Mi evolución" con cero**: "Sin calificaciones" cuando el servidor envía `null` y "0" cuando envía `0` (en 0.5.2 se veía "—" y "0"). También en el resumen de Notas del curso.
- **TESTS** (Jest): lección que falla y respuesta siguiente **vacía** → se reintenta y actualiza (falla con 0.5.2: no se vuelve a pedir); falla dos veces y luego funciona, respetando la espera; pendiente y nueva revisión en la misma respuesta → un solo pedido; 404 en el reintento → baja local; tras 10 intentos no cuenta como fallo; `null` y `0` se muestran distinto.

## 0.5.2 (2026-10-04)

- **Aviso de evaluación sin entregar**: si hay un intento de quiz guardado sin entregar, Hoy y el curso al que pertenece muestran "Tienes una evaluación sin entregar", con cuántas preguntas van respondidas y un botón "Retomar". La entrega sigue siendo manual.
- **Tiempo restante en el aviso**: si el quiz tiene límite, el aviso indica cuánto queda según el servidor: el `remaining_seconds` que el servidor calculó al abrir el intento, menos lo transcurrido desde entonces (el mismo cálculo del reloj del quiz, ahora compartido en `remainingSeconds()`). Al agotarse dice "El tiempo terminó"; al retomarlo, el servidor da el motivo al entregar. Un intento que el servidor ya no acepta no se anuncia.
- **TESTS** (Jest): aviso con respuestas contadas y tiempo descontado; sin límite no hay tiempo; intento vencido no se anuncia.

## 0.5.1 (2026-10-04)

- **Rúbrica: nivel alcanzado por criterio** (Fase 2, Parte C.3). Con ATORA LMS 6.29.2 cada criterio de una tarea calificada muestra "Nivel: Competente" (o el que corresponda) junto al puntaje, la competencia y el comentario. Con 6.29.1 se ve como en 0.5.0, sin nivel.

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
