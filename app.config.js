// La configuración vive en app.json. Con ATORA_E2E=1 (perfil `e2e`, pruebas de
// pantalla en CI) se permite HTTP en claro y se apagan las actualizaciones remotas.
module.exports = ({ config }) => {
  if (process.env.ATORA_E2E !== '1') return config;
  return {
    ...config,
    updates: { ...config.updates, enabled: false },
    plugins: [...(config.plugins ?? []), './plugins/withE2ECleartext'],
  };
};
