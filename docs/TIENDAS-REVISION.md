# Cuentas e instrucciones para la revisión de las tiendas — ATORA 1.0.0

## Preparar las cuentas (titular, una vez, en el demo)

En el servidor del demo (`demo.atora.studio`), con WP-CLI:

```bash
wp atora review-accounts --yes --password='<contraseña de al menos 12 caracteres>' --courses=<id1>,<id2>
```

- Crea (o actualiza) `revisor-estudiante` y `revisor-docente` con esa contraseña.
- Matricula al estudiante en los cursos indicados (sin `--courses`, los tres primeros publicados) y asigna al docente a una sección "Revisión de tiendas" de cada curso, con el estudiante en ella.
- Repetirlo no duplica nada (sirve para cambiar la contraseña).
- Elegir cursos con contenido real: videos, una tarea, una evaluación y, si es posible, un certificado disponible.
- Para que el revisor vea el asistente y la sugerencia de IA, activarlas en ATORA LMS → Uso de IA (con un proveedor configurado).
- Configurar la plantilla del certificado (logo y firmas) en ATORA LMS → Plantilla de certificado.

## Texto para los revisores (Google Play: "Acceso a la app"; Apple: "Notas para la revisión")

**Español**

ATORA es la app de las academias que usan ATORA LMS. No hay registro desde la app: cada academia crea las cuentas de sus estudiantes y docentes.

1. Al abrir la app, toque **Configurar academia** e ingrese: `https://demo.atora.studio` (si ya aparece, continúe).
2. Inicie sesión como estudiante: usuario `revisor-estudiante`, contraseña `<contraseña>`.
   - **Hoy** y **Cursos**: abra un curso y una lección con videos; marque la lección como completada.
   - Una **tarea**: escriba una respuesta y entréguela. Una **evaluación**: respóndala y entréguela.
   - **Mensajes**: escriba a un docente.
   - **Yo**: notas, certificados (descarga en PDF), idioma (español o inglés) y **Eliminar mi cuenta** (solo registra la solicitud; no la confirme si quiere seguir probando).
   - En una lección, **Preguntar** abre el asistente con IA (si la academia lo activó).
3. Cierre sesión (Yo → Cerrar sesión) y entre como docente: usuario `revisor-docente`, contraseña `<contraseña>`.
   - **Hoy** del docente, **Cursos** con estudiantes y su riesgo, **Calificar**: abra una entrega, puntúe con la rúbrica y guarde como borrador.
4. La app funciona sin conexión para lo ya visto: active el modo avión y abra un curso.

**English**

ATORA is the app for academies running ATORA LMS. There is no sign-up in the app: each academy creates its students' and teachers' accounts.

1. When the app opens, tap **Set up academy** and enter `https://demo.atora.studio` (if it is already filled in, continue).
2. Sign in as a student: username `revisor-estudiante`, password `<password>`.
   - **Today** and **Courses**: open a course and a lesson with videos; mark the lesson as completed.
   - An **assignment**: write an answer and submit it. A **quiz**: answer and submit it.
   - **Messages**: write to a teacher.
   - **Me**: grades, certificates (PDF download), language (Spanish or English) and **Delete my account** (it only records the request; do not confirm it if you want to keep testing).
   - In a lesson, **Ask** opens the AI assistant (if the academy enabled it).
3. Sign out (Me → Sign out) and sign in as a teacher: username `revisor-docente`, password `<password>`.
   - Teacher **Today**, **Courses** with students and their risk, **Grade**: open a submission, score it with the rubric and save it as a draft.
4. The app works offline for content already viewed: turn on airplane mode and open a course.

## Datos para los formularios

- Eliminación de cuenta (Google Play): `https://demo.atora.studio/eliminar-cuenta/` (cada academia tiene la suya en `/eliminar-cuenta/`).
- Política de privacidad: la URL que publique el titular en atora.studio (`docs/POLITICA-PRIVACIDAD-APP.md`).
- Seguridad de los datos / etiquetas de privacidad: `docs/TIENDAS-DATOS.md`.
- Contacto del revisor: […correo y teléfono del titular…].

## Antes de enviar (titular)

- Cambiar `<contraseña>` en los textos por la real.
- Comprobar que las dos cuentas entran en el demo y que el curso tiene un certificado disponible.
- No eliminar ni anonimizar las cuentas de revisión mientras la app esté en revisión (si un revisor pide la eliminación, aparece en ATORA LMS → Solicitudes de eliminación: dejarla pendiente o anonimizar después de la aprobación).
