import { isAllowedScormFileUrl } from '../urls';

describe('isAllowedScormFileUrl', () => {
  it('acepta archivos dentro del directorio base', () => {
    const base = 'file:///data/user/0/app/files/scorm/pkg/v1/';
    expect(isAllowedScormFileUrl('file:///data/user/0/app/files/scorm/pkg/v1/index.html', base)).toBe(true);
    expect(isAllowedScormFileUrl('file:///data/user/0/app/files/scorm/pkg/v1/assets/a.js', base)).toBe(true);
  });

  it('rechaza .. y %2e%2e', () => {
    const base = 'file:///data/user/0/app/files/scorm/pkg/v1/';
    expect(isAllowedScormFileUrl('file:///data/user/0/app/files/scorm/pkg/v1/../secret.txt', base)).toBe(false);
    expect(isAllowedScormFileUrl('file:///data/user/0/app/files/scorm/pkg/v1/%2e%2e/secret.txt', base)).toBe(false);
  });

  it('evita bypass por prefijo (v1 vs v10)', () => {
    const base = 'file:///data/user/0/app/files/scorm/pkg/v1/';
    expect(isAllowedScormFileUrl('file:///data/user/0/app/files/scorm/pkg/v10/index.html', base)).toBe(false);
  });
});

