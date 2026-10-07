// La configuración vive en app.json. Con ATORA_E2E=1 (perfil `e2e`, pruebas de
// pantalla en CI) se permite HTTP en claro y se apagan las actualizaciones remotas.
module.exports = ({ config }) => {
  if (process.env.ATORA_E2E !== '1') return config;
  return {
    ...config,
    updates: { ...config.updates, enabled: false },
    // 1.0.0: el emulador del CI está en inglés; con "idioma del teléfono" la app de pruebas usa español.
    extra: { ...config.extra, e2e: true },
    plugins: [...(config.plugins ?? []), './plugins/withE2ECleartext'],
  };
};
