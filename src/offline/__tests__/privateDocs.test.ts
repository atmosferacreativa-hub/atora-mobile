const deleted: string[] = [];
jest.mock('expo-file-system', () => ({
  Paths: { document: 'doc' },
  Directory: class {
    name: string;
    exists = true;
    constructor(_base: string, name: string) { this.name = name; }
    delete() { deleted.push(this.name); }
  },
}));

import { purgePrivateDocuments } from '../privateDocs';

test('al cerrar sesión se borran el historial y los certificados guardados (no quedan para la cuenta siguiente)', () => {
  purgePrivateDocuments();
  expect(deleted.sort()).toEqual(['atora-certificates', 'atora-history']);
});
