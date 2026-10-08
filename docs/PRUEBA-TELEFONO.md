# Prueba en teléfono — lista única

La recorre el titular **una sola vez, al cerrar cada fase**, con la única APK `preview` de la fase, contra el demo (`demo.atora.studio`). Durante la fase lo comprueban las pruebas de pantalla del CI (`.github/workflows/e2e.yml`).

Marcar cada punto: ✅ funciona · ❌ falla (anotar qué pasó y en qué pantalla) · — no aplica.

Cuentas: un **estudiante** y un **docente** del demo (el docente asignado a la sección de un curso con estudiantes). Para los puntos con dos docentes, un segundo docente del mismo curso.

## Fases 0 a 3 (acumulado)

### Entrar y salir
1. [ ] Instalar la APK sobre la anterior: abre sin cerrarse.
2. [ ] Iniciar sesión como estudiante. Cerrar sesión y entrar con otra cuenta: no aparece nada de la cuenta anterior.
3. [ ] Cerrar sesión sin conexión: vuelve a la pantalla de ingreso.

### Aprender
4. [ ] Cursos → abrir un curso → una lección con **varios videos**: se ven todos con miniatura; reproducir el segundo; al volver, sigue donde quedó.
5. [ ] Descargar un video y un PDF; activar modo avión: se abren sin conexión (el PDF en el visor de la app).
6. [ ] "Marcar como completada": el avance del curso sube.

### Entregar y rendir
7. [ ] Tarea: escribir una respuesta y adjuntar un archivo **sin conexión** → "Guardada. Se enviará cuando tengas conexión." → al volver la conexión queda "En revisión".
8. [ ] Quiz: responder la mitad, cerrar la app, volver: retoma el intento. Entregar con conexión: muestra el resultado.
9. [ ] Con un quiz empezado y sin entregar, Hoy y el curso muestran el aviso "Tienes una evaluación sin entregar".

### Notas y certificados
10. [ ] Yo → Mi evolución: avance, nota acumulada y estado de cada curso. Un curso con nota 0 muestra "0", uno sin notas "Sin calificaciones".
11. [ ] Una tarea calificada muestra la nota, el **nivel por criterio** de la rúbrica (con decimales si los tiene) y los comentarios.
12. [ ] Certificados: descargar uno y abrirlo sin conexión.

### Organizarse
13. [ ] Mensajes: "Avisos" fijo arriba; abrir un hilo con el docente y responder. Sin conexión el mensaje queda "Pendiente" y sale al volver.
14. [ ] Agenda: vista de día y de semana con fechas límite; tocar una abre la tarea.
15. [ ] Hoy del estudiante: continuar la última lección, entregas de la semana, mensajes sin leer.
16. [ ] Notificaciones: activar desde Yo (explicación antes del permiso); recibir un aviso de mensaje con la app cerrada y que al tocarlo abra la conversación.

## Fase 4 — Docente (se completa al cerrar la Fase 4)

17. [ ] El docente entra con la misma APK y ve su **Hoy** con entregas por calificar.
18. [ ] Ve la lista de estudiantes de un curso con el **riesgo y su motivo** (color y texto) y abre la ficha de uno; "Escribir" abre un hilo con ese estudiante.
19. [ ] Envía un **aviso al curso**; el estudiante lo recibe en Avisos.
20. [ ] Abre una entrega con PDF, la puntúa con la rúbrica usando **un decimal** y la guarda como **borrador**: el estudiante no ve la nota ni recibe aviso.
21. [ ] La **publica**: el estudiante ve la nota, el nivel por criterio y los comentarios, y recibe el aviso.
22. [ ] La misma entrega en **SpeedGrader web** muestra exactamente lo mismo, decimales incluidos.
23. [ ] **Dos docentes** sobre la misma entrega: el segundo en guardar recibe el aviso de conflicto y no pisa la nota del primero.
24. [ ] Una **tarea grupal** entregada por un integrante y calificada desde el teléfono da la nota a todos (respetando un ajuste individual).
25. [ ] Un docente que también está matriculado alterna entre docente y estudiante desde Yo; cada modo muestra solo sus datos.

## Fase 5 — Bloque A: guardado de calificaciones (con dos docentes del mismo curso)

26. [ ] Guardar una calificación como **borrador**: el estudiante no la ve. **Publicarla**: el estudiante la ve, y SpeedGrader web muestra lo mismo (nota, nivel por criterio, decimales y comentarios).
27. [ ] **Borrador recuperado**: el docente A escribe puntajes y cierra la app (o pierde la señal); el docente B califica la misma entrega; A vuelve a abrirla, elige "Recuperar" y ve la versión de B junto a su borrador. Guardar muestra el conflicto; solo con "Reemplazar con mi borrador" y su confirmación se guarda la de A.
28. [ ] **Conflicto entre dos docentes**: los dos abren la misma entrega y guardan; el segundo recibe "Otro docente calificó primero" y no pisa la nota del primero.
29. [ ] **Calificación grupal con un ajuste individual**: la nota publicada llega a todos los integrantes, y el que tiene ajuste ve el suyo.
30. [ ] **PDF y borrador local**: abrir una entrega con PDF, escribir la rúbrica, activar modo avión o cerrar la app; al volver, el borrador se recupera y el PDF se vuelve a abrir.

## Fase 5 — IA (con la IA activada en ATORA LMS → Uso de IA y un proveedor configurado)

31. [ ] El estudiante abre una lección, toca **Preguntar**, ve el aviso de IA la primera vez y recibe una respuesta sobre la lección. Si pide la respuesta de un quiz o tarea, el asistente da pistas, no la respuesta.
32. [ ] Sin conexión, "Preguntar" queda deshabilitado con "Necesitas conexión para usar el asistente"; al volver la señal funciona. Al cerrar sesión y volver a entrar, la conversación ya no está.
33. [ ] Con un límite bajo (p. ej. 2 preguntas por día), la tercera pregunta muestra el límite y la hora de reinicio.
34. [ ] El docente abre una entrega de tarea, toca **Sugerencia de IA** y, en menos de 2 minutos, ve puntaje, nivel y justificación por criterio, devolución general y el indicio con su aviso.
35. [ ] **Usar todo** rellena el borrador marcado "Sugerido por IA"; el estudiante no ve nada hasta que el docente guarda o publica. Al editar un puntaje, desaparece su marca.
36. [ ] La misma entrega en **SpeedGrader web** muestra la sugerencia; "Usar sugerencia" rellena el formulario sin guardar.
37. [ ] El estudiante, con la entrega calificada, no ve en ninguna pantalla el indicio ni que hubo sugerencia de IA. En ATORA LMS → Uso de IA aparecen las preguntas y la sugerencia del mes.

## Fase 6 — Publicación (compilación de producción instalada)

38. [ ] Con el teléfono en inglés, la app aparece en inglés; en Yo → Idioma se cambia a español (y vuelve a inglés) sin salir de la pantalla.
39. [ ] Con la letra grande del sistema, Hoy, una lección, una tarea y calificar se leen sin textos cortados; los botones se pueden tocar sin errar.
40. [ ] Un certificado se descarga como PDF con logo y firmas; se abre en el visor, también en modo avión; su QR abre la verificación y dice "Válido".
41. [ ] Yo → Eliminar mi cuenta registra la solicitud (muestra el plazo y cierra sesión) y el administrador la ve en ATORA LMS → Solicitudes de eliminación; "Anonimizar" es la acción por defecto.
42. [ ] La compilación de producción, en un Android de gama baja, arranca y abre una lección sin trabarse.
43. [ ] Las filas 1–37 (fases 0 a 5) siguen pasando.

## Fase 6 — Bloque E (auditoría externa; plugin 6.33.1)

44. [ ] Eliminación: el administrador anonimiza una cuenta de prueba que tenía mensajes y un certificado. La solicitud queda "Procesada"; el nombre y el correo no aparecen en mensajes, entregas ni en la verificación del certificado ("Titular anonimizado"); a ese correo no llega nada después.
45. [ ] Con una entrega de dos intentos, el docente pide la sugerencia sobre el intento 1 y cambia al intento 2: la sugerencia dice "Sugerencia del intento 1", avisa que es de otro intento y no deja usarla hasta pedir otra (también en SpeedGrader web).
46. [ ] Pedir una sugerencia y apagar los datos unos segundos: la app sigue esperando la misma; al volver la señal aparece. Salir de la pantalla y volver: retoma la misma sin pedir otra.
47. [ ] Con notificaciones activadas, cerrar sesión en modo avión, esperar más de 15 minutos y quitar el modo avión (sin volver a iniciar sesión): un mensaje nuevo para esa cuenta ya no llega como aviso al teléfono.

