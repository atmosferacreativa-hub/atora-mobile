// Permite HTTP en claro solo para 127.0.0.1 / localhost.
// Necesario para servir paquetes SCORM desde un servidor local offline
// sin habilitar HTTP externo en la app.
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const XML = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="false">localhost</domain>
    <domain includeSubdomains="false">127.0.0.1</domain>
  </domain-config>
</network-security-config>
`;

module.exports = function withAndroidLocalhostCleartext(config) {
  config = withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application?.[0];
    if (app) app.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    return mod;
  });

  return withDangerousMod(config, [
    'android',
    async (mod) => {
      const xmlDir = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/res/xml');
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(path.join(xmlDir, 'network_security_config.xml'), XML);
      return mod;
    },
  ]);
};

