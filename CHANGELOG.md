# Changelog — ATORA Mobile

Toda versión publicada lleva su etiqueta `vX.Y.Z` y su entrada aquí en el mismo PR que sube el número.

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
