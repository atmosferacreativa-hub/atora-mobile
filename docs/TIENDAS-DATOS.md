# Datos y permisos para las tiendas — ATORA 1.0.0

Respuestas preparadas a partir del código de la app 1.0.0 y del plugin ATORA LMS 6.33.0, para copiar en Google Play Console (Seguridad de los datos) y App Store Connect (Privacidad de la app). El titular las revisa antes de enviar. Ver también `POLITICA-PRIVACIDAD-APP.md`.

## Resumen

| Pregunta | Respuesta |
|---|---|
| ¿Recoge o comparte datos? | Recoge datos (los necesarios para usar la academia). **No los comparte** en el sentido de las tiendas: los receptores son proveedores del servicio (servidor de la academia, IA sin identificadores, notificaciones, reporte de errores). |
| ¿Cifrados en tránsito? | **Sí**: HTTPS en todas las conexiones. Solo la compilación de pruebas del CI (`ATORA_E2E`) permite HTTP, y nunca se publica. |
| ¿El usuario puede pedir la eliminación? | **Sí**: en la app (Yo → Eliminar mi cuenta) y en la web de cada academia: `https://{academia}/eliminar-cuenta/`. Para la ficha de Google Play se informa la de la academia del demo: `https://demo.atora.studio/eliminar-cuenta/`. |
| ¿Publicidad o seguimiento? | **No**. Sin SDK de anuncios ni de analítica. |
| ¿Cuenta obligatoria? | Sí, la crea la academia (no hay registro desde la app). |
| Política de privacidad | `https://atora.studio/…` (la publica el titular). |

## Google Play — Seguridad de los datos

Marcar como **recogidos** (no compartidos), todos **cifrados en tránsito** y con **eliminación disponible**:

| Categoría (Play) | Tipo de dato | Para qué | ¿Opcional? |
|---|---|---|---|
| Información personal | Nombre | Funcionalidad de la app, gestión de la cuenta (lo envía la academia y se muestra en la app) | No |
| Información personal | Dirección de correo | Gestión de la cuenta (inicio de sesión con correo o usuario) | No |
| Información personal | ID de usuario | Funcionalidad de la app, gestión de la cuenta | No |
| Mensajes | Otros mensajes en la app | Funcionalidad (buzón con docentes y avisos) | Sí |
| Fotos y videos / Archivos y documentos | Archivos y documentos | Funcionalidad (adjuntos de tareas que elige el usuario) | Sí |
| Actividad en apps | Interacciones con la app; otro contenido generado por el usuario | Funcionalidad (progreso de lecciones, posición de videos, respuestas de evaluaciones, entregas, preguntas al asistente) | No |
| Información y rendimiento de la app | Registros de fallos; diagnósticos | Analítica (estabilidad). Sin datos personales. Desactivable por academia | Sí |
| ID de dispositivo u otros | ID de dispositivo u otros | Funcionalidad (token de notificaciones de Expo, solo si el usuario activa los avisos) | Sí |

No se recogen: ubicación, contactos, calendario del teléfono, fotos de la galería (solo el archivo que el usuario elige adjuntar), audio, salud, finanzas, historial de navegación.

## Apple — Etiquetas de privacidad

**Tracking: No.** Datos **vinculados al usuario** (todos para "Funcionalidad de la app"):

- Información de contacto: **Nombre**, **Correo electrónico**.
- Contenido del usuario: **Otro contenido del usuario** (entregas, respuestas, preguntas al asistente), **Mensajes** dentro de la app (no correos ni SMS).
- Identificadores: **ID de usuario**.
- Uso: **Interacción con el producto** (progreso, posición de videos).

Datos **no vinculados al usuario**:

- Diagnóstico: **Datos de fallos** (Sentry, sin datos personales; para "Funcionalidad de la app" / estabilidad).

El token de notificaciones no es un dato que Apple pida declarar como identificador de seguimiento.

## Permisos

| Plataforma | Permiso | Para qué | Explicación al usuario |
|---|---|---|---|
| Android 13+ / iOS | Notificaciones (`POST_NOTIFICATIONS`) | Avisos de mensajes, notas y fechas límite | En la app, antes del diálogo del sistema (Yo → Avisos en el teléfono): "Te avisamos de mensajes, notas y fechas límite. El aviso no muestra el contenido; lo ves al abrir la app." (y en inglés). Nunca se pide al abrir la app. |
| Android | Internet, estado de red y Wi-Fi | Conectar con la academia; "descargar solo con Wi-Fi" | Permisos normales, sin diálogo. |
| Android | Vibración, arranque (de `expo-notifications`) | Mostrar avisos | Permisos normales, sin diálogo. |
| Ambas | Archivos para adjuntar | El selector de documentos del sistema: el usuario elige el archivo; la app no lee el almacenamiento. | Sin permiso: no hace falta. |
| Ambas | Almacenamiento para descargas | Almacenamiento privado de la app. | Sin permiso: no hace falta. |

**Quitados en 1.0.0** (los traía la plantilla y la app no los usa): `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` y `SYSTEM_ALERT_WINDOW` (`android.blockedPermissions` en `app.json`). iOS no declara textos de permiso (`NS…UsageDescription`) porque la app no usa cámara, fotos, micrófono, ubicación ni contactos. `ITSAppUsesNonExemptEncryption = false`: solo usa el cifrado estándar del sistema (HTTPS).
