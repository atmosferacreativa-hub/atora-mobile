/**
 * Empaqueta pdf.js dentro de la app (0.4.0): copia los builds UMD de
 * pdfjs-dist a un módulo TypeScript generado, que el visor escribe en el
 * almacenamiento de la app la primera vez. Funciona sin conexión y en Expo Go.
 * Se ejecuta en `postinstall`; el archivo generado no se versiona.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const build = path.join(root, 'node_modules', 'pdfjs-dist', 'legacy', 'build');
const pkg = require(path.join(root, 'node_modules', 'pdfjs-dist', 'package.json'));
const out = path.join(root, 'src', 'viewer', 'pdfjs.generated.ts');

const lib = fs.readFileSync(path.join(build, 'pdf.min.js'), 'utf8');
const worker = fs.readFileSync(path.join(build, 'pdf.worker.min.js'), 'utf8');

fs.writeFileSync(
  out,
  `/* Generado por scripts/vendor-pdfjs.js desde pdfjs-dist ${pkg.version}. No editar. */\n` +
    `export const PDFJS_VERSION = ${JSON.stringify(pkg.version)};\n` +
    `export const PDFJS_LIB = ${JSON.stringify(lib)};\n` +
    `export const PDFJS_WORKER = ${JSON.stringify(worker)};\n`,
);
console.log(`pdf.js ${pkg.version} → ${path.relative(root, out)}`);
