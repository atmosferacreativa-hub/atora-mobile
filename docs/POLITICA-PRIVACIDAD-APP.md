# Política de privacidad — ATORA (app móvil)

> **Borrador para revisión del titular.** Se publicará en atora.studio. Antes de publicarla, el titular completa los datos marcados con `[…]` y confirma que los plazos y el país de la jurisdicción son correctos. Versión inglesa al final.

Última actualización: […fecha de publicación…]

## Quiénes somos

ATORA es una app que permite a estudiantes y docentes usar desde el teléfono la plataforma de su academia (institución educativa que usa ATORA LMS). La app la publica […razón social del titular, país, correo de contacto…].

Cada academia es **responsable** de los datos de sus estudiantes y docentes: decide qué cursos ofrece, quién se matricula y cuánto tiempo conserva las notas y actas. ATORA actúa como **proveedor de la herramienta** y trata los datos por cuenta de la academia. Para ejercer tus derechos sobre tus datos académicos, escribe a tu academia; para dudas sobre la app, a […correo de contacto…].

## Qué guarda la app en tu teléfono

Todo se guarda en el almacenamiento privado de la app (otras apps no pueden leerlo) y se borra al cerrar sesión, salvo lo indicado:

- **Sesión**: un token de acceso protegido en el almacenamiento seguro del sistema (Keychain en iOS, Keystore en Android). **Tu contraseña no se guarda.**
- **Contenido para usar sin conexión**: cursos, lecciones, notas, mensajes y agenda ya vistos; videos, materiales y certificados que descargues.
- **Envíos pendientes**: progreso, entregas de tareas (con sus adjuntos), respuestas de evaluaciones y mensajes escritos sin conexión, hasta que llegan a la academia.
- **Borradores**: respuestas de evaluaciones en curso y, para docentes, calificaciones que aún no guardaste.
- **Conversación con el asistente de IA**: solo en la memoria de la app mientras está abierta; no se guarda en el teléfono ni en el servidor.
- **Preferencias** (se conservan al cerrar sesión): la dirección de la academia, el idioma y las preferencias de descarga.

## Qué envía la app al servidor de tu academia

Solo a la dirección de la academia que configuraste, siempre cifrado (HTTPS):

- Tu usuario y contraseña al iniciar sesión (para obtener el token; no se guardan en el teléfono).
- Tu progreso (lecciones completadas, posición de los videos), tus entregas y adjuntos, tus respuestas de evaluaciones y tus mensajes.
- Si eres docente: las calificaciones, comentarios y avisos que publiques.
- Si activas los avisos: un identificador del teléfono para notificaciones (token de Expo) y el sistema operativo.
- Tus solicitudes de eliminación de cuenta.

La academia ya tiene tu nombre y correo (los usa para tu cuenta). La app no recoge tu ubicación, contactos, fotos, micrófono ni cámara.

## Asistente y sugerencias con IA

Solo si tu academia los activó:

- **Asistente de la lección** (estudiantes): tu pregunta y el contenido de la lección se envían desde el servidor de la academia a un proveedor de IA. **No se envían tu nombre, tu correo ni identificadores**; si escribes tu nombre o correo en la pregunta, se reemplazan antes de enviarla. La conversación no se guarda.
- **Sugerencia de calificación** (docentes): se envían la consigna, la rúbrica y el texto de la entrega, **sin datos del estudiante**. La IA solo sugiere; el docente decide y publica.
- Cada uso queda registrado en la academia (fecha, función, cantidad de texto y costo estimado) para controlar límites y costos.
- Las respuestas las genera una IA y pueden contener errores. No compartas datos personales.

## Notificaciones

Si las activas, la academia envía avisos a través del servicio de notificaciones de Expo, Apple y Google. **El aviso solo dice de qué se trata** ("Nuevo mensaje", "Nota publicada"), sin el contenido: lo ves al abrir la app. Puedes desactivarlas en la app (Yo → Avisos en el teléfono) o en los ajustes del sistema.

## Reporte de errores

Si la app se cierra de forma inesperada, puede enviar un reporte técnico al servicio de errores (Sentry) para que podamos corregirlo: el error, el modelo de teléfono, el sistema operativo y la versión de la app. **No incluye tu nombre, correo, contenido, mensajes ni datos de tu cuenta.** Cada academia puede desactivarlo.

## Con quién se comparten los datos

No vendemos datos ni los usamos para publicidad. No hay seguimiento entre apps. Los únicos terceros son proveedores que prestan el servicio: el servidor de tu academia, el proveedor de IA (sin datos que te identifiquen), los servicios de notificaciones (Expo, Apple, Google) y el servicio de reporte de errores (Sentry, sin datos personales).

## Eliminar tu cuenta

- En la app: **Yo → Eliminar mi cuenta**.
- Sin la app: en la página **/eliminar-cuenta/** del sitio de tu academia (te enviamos un enlace de confirmación a tu correo).

La academia procesa la solicitud en un plazo de **30 días**: borra tu nombre, correo, usuario, datos de contacto, sesiones, dispositivos y mensajes, y cancela los correos y avisos pendientes. Las notas, actas y certificados que la institución deba conservar por ley se guardan **sin tus datos personales** (el certificado queda a nombre de un titular anonimizado).

## Menores de edad

Si la academia matricula a menores, es responsable de contar con la autorización de sus padres o tutores según la ley aplicable.

## Cambios

Si cambia esta política, lo indicaremos en la app y en esta página con la fecha de actualización.

---

# Privacy Policy — ATORA (mobile app)

> **Draft for the owner's review.** To be published at atora.studio.

Last updated: […publication date…]

**Who we are.** ATORA lets students and teachers use their academy's platform (an educational institution running ATORA LMS) from their phone. The app is published by […owner legal name, country, contact email…]. Each academy is the **controller** of its students' and teachers' data; ATORA acts as the **tool provider** on the academy's behalf. For your academic data, contact your academy; for questions about the app, write to […contact email…].

**Stored on your phone** (private app storage, deleted when you sign out unless noted): your session token in the system secure storage (**your password is not stored**); content you viewed or downloaded for offline use (courses, lessons, grades, messages, calendar, videos, materials, certificates); items waiting to be sent (progress, submissions and attachments, quiz answers, messages); drafts (quiz answers in progress and, for teachers, unsaved grades); the AI assistant conversation only in memory while the app is open; and, kept after sign-out, your academy address, language and download preferences.

**Sent to your academy's server** (only the address you set, always over HTTPS): your username and password at sign-in; your progress, submissions and attachments, quiz answers and messages; for teachers, grades, comments and announcements; if you enable notifications, a device notification identifier (Expo token) and operating system; and account deletion requests. The app does not collect location, contacts, photos, microphone or camera.

**AI features** (only if your academy enabled them): the lesson assistant sends your question and the lesson content from the academy's server to an AI provider **without your name, email or identifiers** (if you type them, they are replaced before sending); the conversation is not stored. Grading suggestions send the task, rubric and submission text **without student data**; the AI only suggests and the teacher decides. Each use is logged by the academy (date, feature, amount of text and estimated cost). AI answers may contain mistakes; do not share personal information.

**Notifications** go through Expo, Apple and Google and **only say what they are about** ("New message", "Grade published"), never the content. You can turn them off in the app or in system settings.

**Crash reports**: if the app closes unexpectedly it may send a technical report to Sentry (error, phone model, OS and app version) **without your name, email, content, messages or account data**. Each academy can turn it off.

**Sharing**: we do not sell data or use it for advertising, and there is no cross-app tracking. The only third parties are service providers: your academy's server, the AI provider (no identifying data), notification services and the crash reporting service (no personal data).

**Delete your account**: in the app (**Me → Delete my account**) or without the app at **/eliminar-cuenta/** on your academy's site (a confirmation link is emailed to you). The academy processes it within **30 days**, deleting your name, email, username, contact data, sessions, devices and messages, and cancelling pending emails and notifications. Grades, records and certificates the institution must keep by law are kept **without your personal data** (the certificate holder becomes anonymous).

**Minors**: if an academy enrolls minors, it is responsible for obtaining parental or guardian consent as required by law.

**Changes** will be announced in the app and on this page with the update date.
