import fs from 'node:fs';
import path from 'node:path';

describe('offline/mediaDownloads SCORM implementation', () => {
  it('does not use deprecated dynamic import("expo-file-system")', () => {
    const filePath = path.join(__dirname, '..', 'mediaDownloads.ts');
    const source = fs.readFileSync(filePath, 'utf8');
    expect(source).not.toContain("import('expo-file-system')");
    expect(source).not.toContain('import("expo-file-system")');
  });
});

