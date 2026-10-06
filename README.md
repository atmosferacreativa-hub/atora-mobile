# ATORA Mobile

Aplicación móvil oficial de ATORA LMS para Android e iOS.

## Estado

Versión **0.7.0**. Requiere **ATORA LMS 6.31.0** o superior para el modo docente (Hoy, cursos y estudiantes con riesgo, ficha, aviso al grupo y cola de entregas); con versiones anteriores el docente ve lo de antes. Requiere **ATORA LMS 6.30.0** o superior para Mensajes, Agenda, Hoy del estudiante y avisos al teléfono (con versiones anteriores esas pestañas muestran "Próximamente" y Hoy usa el panel anterior). Notas: `null` = sin calificaciones, `0` = cero (6.29.5). Desde 6.29.1 (Mobile API v1) para notas, evolución, aviso de nota nueva y certificados (con 6.28.x se ocultan); el nivel alcanzado por criterio de la rúbrica llega desde 6.29.2 (con las bandas de SpeedGrader desde 6.29.3); sincronización incremental, material descargable, posición de video y varios videos por lección desde 6.28.2 (con 6.28.0 se muestra un solo video); con 6.27.x se ocultan esas funciones y siguen las entregas y miniaturas (6.27.1). pdf.js se empaqueta en `postinstall` (`scripts/vendor-pdfjs.js`). Pruebas de pantalla: recorridos Maestro en `.maestro/`, corridos en CI por `.github/workflows/e2e.yml` contra un WordPress temporal (plugin 6.30.2 o superior, `wp atora seed-e2e`); la lista para el teléfono está en `docs/PRUEBA-TELEFONO.md`. El desarrollo se mantiene separado:

- `Atora-LMS-6`: backend académico y API REST.
- `atora-mobile`: cliente móvil, navegación y experiencia de usuario.

## Tecnología

- Expo SDK 54
- React Native 0.81.5 y TypeScript estricto
- Sesión en `expo-secure-store`
- Caché local y cola de sincronización
- Descargas administradas con `expo-file-system`
- Detección de Wi-Fi con `expo-network`
- Navegación con React Navigation (pestañas por rol)
- Base local `expo-sqlite` con una sola cola de envíos sin conexión
- Imágenes con `expo-image` (caché en disco)
- Jest para la lógica de la cola (`npm test`)

## Primer arranque

```bash
cd ~/atora-mobile
npm install
cp .env.example .env
npm run doctor
npm run start
```

Configura en `.env` la URL de la academia, sin Markdown, corchetes ni slash final:

```dotenv
EXPO_PUBLIC_ATORA_API_URL=https://tu-academia.com/wp-json/atora-mobile/v1
```

Para la demo pública (referencia interna de QA):

```dotenv
EXPO_PUBLIC_ATORA_API_URL=https://demo.atora.studio/wp-json/atora-mobile/v1
```

También puedes cambiar la academia dentro de la app: en la pantalla de login abre **“Academia”** y pega la URL del sitio.

### Conectar con ATORA Lab (local en Docker)

- Asegúrate de que WordPress esté disponible en tu red (ej. `http://192.168.1.16:8080`; desde el emulador de Android, `http://10.0.2.2:8080`).
- La API acepta HTTP solo si WordPress está en entorno `local` o con `ATORA_DEV_MODE`.
- **HTTP solo funciona en desarrollo** (Expo Go o cliente de desarrollo): las descargas de medios aceptan `http://` únicamente con `__DEV__`, y Android bloquea el tráfico sin cifrar en las compilaciones `preview` y `production`. Para probar un APK contra el Lab local, publícalo por HTTPS (por ejemplo, con un túnel).
- En la app (pantalla de login) abre **“Academia”** y pega la URL del sitio.
  - La app completa automáticamente el endpoint REST: `/wp-json/atora-mobile/v1`.

Después de cambiar `.env`, reinicia Metro limpiando la caché:

```bash
npx expo start --tunnel --clear
```

## Funcionalidad disponible

- Inicio de sesión con tokens móviles revocables.
- Panel, cursos, currículo y lecciones nativas.
- Reproductor de video nativo.
- Evaluaciones nativas con navegación clara y accesible.
- Progreso con cola automática cuando no hay conexión.
- Descarga explícita de videos para uso sin conexión.
- Preferencia de descargas solo por Wi-Fi.
- Cuota local predeterminada de 1 GB.
- Caducidad automática después de 30 días sin uso.
- Panel para revisar y eliminar contenido descargado, con miniatura de cada video.
- Pestañas por rol: estudiante (Hoy · Cursos · Agenda · Mensajes · Yo) y docente (Hoy · Cursos · Calificar · Mensajes · Yo).
- Entregas de tareas con texto y adjuntos, también sin conexión: se envían solas al reconectar, una sola vez.
- Miniaturas de video en el currículo, como carátula del reproductor y en descargas.

## Seguridad

Nunca almacenes contraseñas ni tokens en el repositorio. La app exige HTTPS para descargar medios (salvo en desarrollo) y usa sesiones móviles opacas y revocables emitidas por ATORA LMS.

## Generar un APK (EAS Build)

El repo ya trae `eas.json` con tres perfiles:

- `development` — cliente de desarrollo, APK.
- `preview` — APK instalable directo en un teléfono, sin pasar por las tiendas; apunta por defecto a `demo.atora.studio`.
- `production` — Android App Bundle (`.aab`) para publicar en Play Store, con `versionCode` autoincremental. (No fija una URL: se configura por EAS env o en runtime desde **“Academia”**.)

Primer uso (una sola vez, requiere una cuenta de Expo/EAS — no algo que se pueda dejar preconfigurado en el repo):

```bash
npm install -g eas-cli
eas login
eas init            # vincula el proyecto a tu cuenta/organización de Expo
```

Después, para generar el APK de prueba:

```bash
npm run build:apk
```

Eso corre en la nube de EAS (no localmente) y al terminar da un link de descarga directa del `.apk`. Para el `.aab` de producción: `npm run build:android`.

## Versión

Ver [CHANGELOG.md](CHANGELOG.md). Cada versión publicada lleva su etiqueta `vX.Y.Z`.
