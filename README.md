# ATORA Mobile

Aplicación móvil oficial de ATORA LMS para Android e iOS.

## Estado

Fundación técnica del MVP de estudiantes. El desarrollo se mantiene separado del plugin WordPress:

- `Atora-LMS-6`: backend académico y API REST.
- `atora-mobile`: cliente móvil, navegación y experiencia de usuario.

## Tecnología

- Expo SDK 54
- React Native
- TypeScript estricto
- `expo-secure-store` preparado para persistencia segura de sesión

## Primer arranque

```bash
npm install
cp .env.example .env
npm run start
```

Configura en `.env` el endpoint versionado que se implementará en el plugin:

```dotenv
EXPO_PUBLIC_ATORA_API_URL=https://tu-academia.com/wp-json/atora/v1
```

## Alcance del MVP

1. Conexión con una academia ATORA.
2. Autenticación y sesión segura.
3. Panel del estudiante.
4. Cursos, programas y lecciones.
5. Progreso y actividades pendientes.
6. Evaluaciones y entregas.
7. Calificaciones y retroalimentación.
8. Certificados verificables.
9. Notificaciones.
10. Perfil y cierre de sesión.

## Seguridad

Nunca almacenes contraseñas, tokens o URLs privadas en el repositorio. La app debe usar HTTPS y tokens revocables emitidos específicamente para clientes móviles.
