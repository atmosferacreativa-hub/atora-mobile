# Ficha de tienda — ATORA

Corte de documentación: app 1.0.2 en `main`. La versión del envío debe ser la que informe `npm run store:check` después de integrar el cierre móvil. No anunciar 1.1.0 mientras esté pendiente.

Editor: **Atora Studio, un desarrollo de Atmósfera Creativa**. Datos públicos y estado de cierre: [`../store/publication.json`](../store/publication.json). Procedimiento único: [PUBLICACION-TIENDAS.md](PUBLICACION-TIENDAS.md).

## Datos básicos

| Campo | Valor |
|---|---|
| Nombre de la app | ATORA |
| Subtítulo (App Store, 30 caracteres) | ES: "Tu academia en el teléfono" · EN: "Your academy on your phone" |
| Categoría | Google Play: Educación · App Store: Educación (secundaria: Productividad) |
| Clasificación | Completar los cuestionarios de cada consola según el contenido y funciones reales; no asumir una clasificación automática. |
| Precio | Gratis, sin compras dentro de la app |
| Idiomas | Español (principal), inglés |
| Editor | Atora Studio, un desarrollo de Atmósfera Creativa |
| Titular legal | Inversiones ATM-CAP 1783 C.A. |
| Nombre comercial | Atmósfera Creativa |
| País | Venezuela |
| Soporte y privacidad | admin@atora.studio |
| Sitio web | https://atora.studio |
| Política de privacidad | https://atora.studio/privacidad/ — ruta acordada, publicación y acceso público pendientes de verificar |

## Descripción corta (Google Play, 80 caracteres)

- **ES:** Cursos, tareas, notas y mensajes de tu academia, también sin conexión.
- **EN:** Your academy's courses, assignments, grades and messages, even offline.

## Descripción larga

### Español

ATORA lleva tu academia al teléfono. Si tu institución usa ATORA LMS, entra con tu usuario de siempre y aprende donde estés.

**Para estudiantes**
- Tus cursos y lecciones, con videos que puedes descargar para verlos sin conexión.
- Entrega tareas y responde evaluaciones aunque no tengas señal: se envían solas al volver la conexión.
- Tus notas, tu evolución y tus certificados en PDF con código de verificación.
- Mensajes con tus docentes, avisos y agenda con tus fechas límite.
- Asistente con IA en cada lección para resolver dudas (si tu academia lo activa): explica y da pistas, sin resolverte las evaluaciones.

**Para docentes**
- Tu día de un vistazo: entregas por calificar, estudiantes en riesgo y clases.
- Califica con la rúbrica desde el teléfono, con decimales, borrador y publicación.
- Sugerencia de calificación con IA (si tu academia la activa): la IA sugiere, tú decides.
- Avisos a tu curso o sección.

**Privacidad**
Sin publicidad ni seguimiento. Tu contraseña no se guarda en el teléfono, las conexiones van cifradas y puedes pedir la eliminación de tu cuenta desde la app.

ATORA necesita una cuenta de una academia que use ATORA LMS. No hay registro desde la app.

### English

ATORA brings your academy to your phone. If your institution uses ATORA LMS, sign in with your usual account and learn wherever you are.

**For students**
- Your courses and lessons, with videos you can download to watch offline.
- Submit assignments and answer quizzes without signal: they are sent automatically when you are back online.
- Your grades, your progress and PDF certificates with a verification code.
- Messages with your teachers, announcements and a calendar with your due dates.
- An AI assistant in every lesson to answer your questions (if your academy enables it): it explains and gives hints, without solving your quizzes.

**For teachers**
- Your day at a glance: submissions to grade, students at risk and classes.
- Grade with the rubric from your phone, with decimals, drafts and publishing.
- AI grading suggestions (if your academy enables them): the AI suggests, you decide.
- Announcements to your course or section.

**Privacy**
No ads or tracking. Your password is not stored on the phone, connections are encrypted and you can request the deletion of your account from the app.

ATORA requires an account from an academy running ATORA LMS. There is no sign-up in the app.

## Novedades del envío

Revisar contra la compilación final. Este texto corresponde al alcance integrado en `main` (1.0.2); no incluye SCORM móvil pendiente de cierre.

- **ES:** Cursos, tareas, evaluaciones, notas, certificados, mensajes, agenda y modo docente. Lectura de PDF e imágenes con zoom y ajuste del texto de las lecciones. IA si la academia la activa. En español e inglés.
- **EN:** Courses, assignments, quizzes, grades, certificates, messages, calendar and teacher mode. Zoom PDF files and images, and adjust lesson text size. AI when enabled by the academy. In Spanish and English.

## Palabras clave (App Store, 100 caracteres)

- **ES:** academia,cursos,lms,estudiantes,docentes,tareas,notas,certificados,educación,aprendizaje
- **EN:** academy,courses,lms,students,teachers,assignments,grades,certificates,education,learning

## Materiales gráficos

Usar capturas de la compilación final, con datos de demostración y sin contraseñas, tokens, conversaciones reales ni información personal. La mayoría debe mostrar funciones en uso, no solo el ingreso o la pantalla inicial.

| Destino | Fuente | Preparación |
|---|---|---|
| Google Play | APK final ejecutada en Android; el modo `tienda` del CI puede aportar capturas de esa plataforma | `bash scripts/store-screenshots.sh android CARPETA_ORIGEN` |
| App Store | App final ejecutada en iPhone o simulador iOS | `bash scripts/store-screenshots.sh ios CARPETA_ORIGEN` |
| Gráfico destacado de Google Play | Pieza de marca de 1024 × 500, revisada contra la app real | Guardar en `store/feature-graphic.png` al aprobarlo |

El script conserva los píxeles originales y separa `store/play/` y `store/ios/`. **No transforma capturas de Android en supuestas capturas de iPhone.** Confirmar tamaños admitidos en cada consola antes de subir.

Orden: Hoy · Lección con varios vídeos · PDF con zoom · Tarea · Notas · Certificado · Mensajes · Calificar (docente). Incluir IA solo si está disponible para las cuentas de revisión.

Referencias oficiales:
- Apple, capturas fieles a la app: https://developer.apple.com/help/app-review/guideline-reference/2-3-3-screenshots/
- Apple, tamaños: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/
- Google Play, recursos gráficos: https://support.google.com/googleplay/android-developer/answer/9866151
