# ATORA Mobile

Aplicación móvil oficial de ATORA LMS para Android e iOS.

## Estado

MVP nativo de estudiantes en desarrollo. El desarrollo se mantiene separado del plugin WordPress:

- `Atora-LMS-6`: backend académico y API REST.
- `atora-mobile`: cliente móvil, navegación y experiencia de usuario.

## Tecnología

- Expo SDK 54
- React Native y TypeScript estricto
- Sesión en `expo-secure-store`
- Caché local y cola de sincronización
- Descargas administradas con `expo-file-system`
- Detección de Wi-Fi con `expo-network`

## Primer arranque

```bash
npm install
cp .env.example .env
npm run start
```

Configura en `.env`:

```dotenv
EXPO_PUBLIC_ATORA_API_URL=https://tu-academia.com/wp-json/atora/v1
```

## Funcionalidad disponible

- Inicio de sesión con tokens móviles revocables.
- Panel, cursos, currículo y lecciones nativas.
- Reproductor de video nativo.
- Progreso con cola automática cuando no hay conexión.
- Descarga explícita de videos para uso sin conexión.
- Preferencia de descargas solo por Wi-Fi.
- Cuota local predeterminada de 1 GB.
- Caducidad automática después de 30 días sin uso.
- Panel para revisar y eliminar contenido descargado.

## Seguridad

Nunca almacenes contraseñas, tokens o URLs privadas en el repositorio. La app exige HTTPS para descargar medios y usa tokens revocables emitidos específicamente para clientes móviles.
