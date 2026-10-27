# Preparación y cierre del envío a tiendas

## Identidad y versión

- Editor confirmado por el titular: **Atora Studio, un desarrollo de Atmósfera Creativa**.
- Política prevista y acordada: **https://atora.studio/privacidad/**.
- Fuente de versión: `app.json` y `package.json`; `npm run store:check` exige que coincidan. El código de `main` al preparar estos documentos es 1.0.3. No presentar como final una versión futura o una rama sin cerrar.
- Titular legal confirmado: **Inversiones ATM-CAP 1783 C.A.** · Nombre comercial: **Atmósfera Creativa** · País: **Venezuela**.
- Correo público de soporte y privacidad confirmado: **admin@atora.studio**. Los datos están registrados en `store/publication.json`; comprobar que coincidan con las cuentas de desarrollador al enviar.

## Qué significa cada comprobación

```bash
npm run store:check
npm run store:release-check
```

La primera valida estructura, identificadores, URLs y coincidencia de versión; muestra todos los pendientes. Es apta para CI de desarrollo. La segunda devuelve error mientras haya datos o verificaciones pendientes. Las marcas del JSON son declaraciones del titular, no evidencias automáticas de que una URL está publicada, una cuenta funciona o un binario está firmado.

No incluir contraseñas, certificados privados, claves de firma ni tokens en el JSON. Las credenciales de revisión se introducen directamente en las dos consolas y se guardan fuera del repositorio.

## Política publicada y dentro de la app

1. Validar `POLITICA-PRIVACIDAD-APP.md`, que ya incluye el titular legal y los correos confirmados. Confirmar las afirmaciones de tratamiento, retención, proveedores e IA contra la compilación y el servidor usados.
2. Publicar HTML en la URL acordada, con fecha real y sin campos pendientes. Comprobar desde una ventana privada y desde otra red: sin sesión, PDF, restricciones regionales o desafío de acceso.
3. Añadir y probar un enlace visible a la política en **Ingreso** y **Yo**. La versión 1.0.3 incorpora esos enlaces en ambos lugares; comprobarlos en la compilación firmada y marcar la verificación únicamente después del recorrido real.
4. Confirmar las páginas de eliminación de cuenta en las academias y la URL del demo informada a las tiendas.
5. Solo entonces marcar `privacy.publishedVerified` e `inAppLinkVerified`.

Google requiere la política en Play Console y un enlace o texto dentro de la app: https://support.google.com/googleplay/android-developer/answer/10144311

## Cuentas privadas para revisión

Seguir `TIENDAS-REVISION.md`: dos cuentas dedicadas, con datos ficticios y cursos completos en el demo. Probar ambos roles en las compilaciones finales. No usar usuarios de CI. Entregar las contraseñas solo mediante los campos privados de cada consola. Registrar fecha, versión y resultado sin publicar las claves.

## Capturas y pieza de marca

- `store/play/` contiene capturas Android históricas; no están aprobadas para la versión final por el mero hecho de existir.
- Las anteriores carpetas `ios-6.9` e `ios-6.5` eran redimensionados del material Android. Se conservan en `store/reference/android-resized-not-for-submission/`, fuera de los destinos de envío.
- Generar capturas nuevas en Android y en iPhone/simulador iOS, con la compilación que se enviará y datos ficticios. El script separa las plataformas y conserva el original. No certifica por sí solo el origen de una imagen.
- Preparar y aprobar el gráfico destacado de Google Play de 1024 × 500. El logo existente sirve como fuente de marca; no sustituye esta pieza.
- Comprobar formatos vigentes en las consolas. Apple: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/ ; Google: https://support.google.com/googleplay/android-developer/answer/9866151

## Compilaciones y firma de producción

El flujo `.github/workflows/build-android.yml` genera APK/AAB de **verificación interna**. El nombre `release` y un build verde no acreditan que el certificado sea el de producción. No presentar esos artefactos como aprobados para Play.

Preparar el envío desde la cuenta EAS del titular, sin incorporar secretos al repo:

```bash
npx eas-cli build --platform android --profile production
npx eas-cli build --platform ios --profile production
```

El proyecto EAS ya está identificado en `app.json`; eso tampoco confirma sus credenciales o permisos de publicación. Registrar de forma privada para cada binario: commit, versión, versionCode/buildNumber efectivo (EAS usa versiones remotas), EAS build ID, SHA-256 del artefacto, identidad del certificado y resultado de instalación/aceptación en la consola.

### Android

- Verificar paquete `com.atmosferacreativa.atora`, variante de producción, HTTPS y ausencia de `ATORA_E2E=1`.
- Para APK usar `apksigner verify --print-certs ARCHIVO.apk`; comparar la huella con el certificado esperado. Para AAB comprobar la firma JAR (`jarsigner -verify ARCHIVO.aab` y `keytool -printcert -jarfile ARCHIVO.aab`) y la identidad con la clave de subida configurada en Play Console.
- Rechazar identidad Android Debug. Distinguir el certificado de subida del certificado con el que Play App Signing firma las APK distribuidas.
- Subir al circuito interno de Google Play y verificar el resultado. No ejecutar `submit` antes de completar estas comprobaciones.
- Referencia oficial: https://developer.android.com/studio/publish/app-signing

### iOS

- Verificar bundle ID `com.atmosferacreativa.atora`, equipo Apple Developer, firma y perfil de distribución. No basta un APK, una captura Android o una compilación de simulador.
- Confirmar el build en App Store Connect, probarlo mediante TestFlight y registrar el resultado y el número efectivo de compilación.
- Referencias oficiales: https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/ ; https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/

Marcar `builds.androidProductionVerified` / `iosProductionVerified` únicamente después de verificar estos puntos. No están comprobados desde esta preparación documental.

## Orden final

1. Resolver el cierre móvil y fijar versión/commit.
2. Comprobar que los datos confirmados del titular coincidan con las cuentas de desarrollador y publicar la política; integrar su enlace en la app.
3. Compilar con credenciales de producción y probar en dispositivos.
4. Crear las capturas reales por plataforma, aprobar la pieza gráfica y probar las cuentas de revisión.
5. Revisar ficha, privacidad, cuestionarios y notas con esa compilación; completar el JSON y ejecutar `npm run store:release-check`.
6. Enviar desde las consolas. La preparación de este PR no publica la app ni afirma aprobación de las tiendas.
