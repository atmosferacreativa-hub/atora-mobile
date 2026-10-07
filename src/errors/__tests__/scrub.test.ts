import { crashReportsAllowed, scrubEvent, scrubUrl } from '../scrub';

describe('reporte de errores sin datos personales', () => {
  it('quita usuario, cabeceras, cuerpo, extras y consultas de las URL', () => {
    const clean = scrubEvent({
      user: { id: '7', email: 'ana@escuela.test', ip_address: '1.2.3.4' },
      request: { url: 'https://a.test/wp-json/atora-mobile/v1/certificates/course/7/document?expires=1&sig=abc', headers: { Authorization: 'Bearer x' }, data: { password: 'p' } },
      extra: { body: 'texto' },
      server_name: 'telefono-de-ana',
      message: 'Fallo con ana@escuela.test',
      exception: { values: [{ value: 'Token atm_ABCDEFGHIJKLMNOPQRSTUV inválido para ana@escuela.test' }] },
      breadcrumbs: [
        { category: 'ui.input', message: 'Mi contraseña' },
        { category: 'http', data: { url: 'https://a.test/wp-json/atora-mobile/v1/me?token=secreto', method: 'GET' } },
      ],
    });
    expect(clean.user).toBeUndefined();
    expect(clean.extra).toBeUndefined();
    expect(clean.server_name).toBeUndefined();
    expect(clean.request).toEqual({ url: 'https://a.test/wp-json/atora-mobile/v1/certificates/course/7/document' });
    expect(clean.message).toBe('Fallo con [correo]');
    expect(clean.exception?.values?.[0]?.value).toBe('Token [token] inválido para [correo]');
    expect(clean.breadcrumbs).toEqual([{ category: 'http', message: undefined, data: { url: 'https://a.test/wp-json/atora-mobile/v1/me', method: 'GET' } }]);
    expect(JSON.stringify(clean)).not.toMatch(/ana@|secreto|sig=|contraseña|1\.2\.3\.4/);
  });

  it('las URL sin consulta quedan igual', () => {
    expect(scrubUrl('https://a.test/x')).toBe('https://a.test/x');
  });

  it('solo se envía si la academia lo permite; sin saberlo, no', () => {
    expect(crashReportsAllowed(true)).toBe(true);
    expect(crashReportsAllowed(false)).toBe(false);
    expect(crashReportsAllowed(undefined)).toBe(false);
  });
});
