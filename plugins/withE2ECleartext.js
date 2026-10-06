// Solo para la compilación de pruebas de pantalla (perfil `e2e`): el WordPress
// temporal del CI responde por HTTP en 10.0.2.2. Las APK de vista previa y de
// producción no llevan este permiso.
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withE2ECleartext(config) {
  return withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application?.[0];
    if (app) app.$['android:usesCleartextTraffic'] = 'true';
    return mod;
  });
};
