# ATORA Mobile

Aplicación móvil oficial de ATORA LMS para Android e iOS.

## Estado

MVP nativo de estudiantes conectado a **ATORA LMS 6.26.0** mediante Mobile API v1. El desarrollo se mantiene separado:

- `Atora-LMS-6`: backend académico y API REST.
- `atora-mobile`: cliente móvil, navegación y experiencia de usuario.

## Tecnología

- Expo SDK 54
- React Native 0.81.5 y TypeScript estricto
- Sesión en `expo-secure-store`
- Caché local y cola de sincronización
- Descargas administradas con `expo-file-system`
- Detección de Wi-Fi con `expo-network`

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

Para el entorno beta de ATORA:

```dotenv
EXPO_PUBLIC_ATORA_API_URL=https://beta.academia.atmosferacreativa.com/wp-json/atora-mobile/v1
```

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
- Panel para revisar y eliminar contenido descargado.

## Seguridad

Nunca almacenes contraseñas ni tokens en el repositorio. La app exige HTTPS para descargar medios y usa sesiones móviles opacas y revocables emitidas por ATORA LMS.
