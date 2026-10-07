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
