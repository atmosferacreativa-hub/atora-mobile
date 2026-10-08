import { academyApiBase, normalizeAcademyUrl } from '../url';

describe('URL de la academia mal escrita (1.0.1, punto 5)', () => {
  it.each([
    ['https;//academia.atmosferacreativa.com', 'https://academia.atmosferacreativa.com'],
    ['https//academia.atmosferacreativa.com', 'https://academia.atmosferacreativa.com'],
    ['http:/academia.test', 'http://academia.test'],
    ['https:/academia.test', 'https://academia.test'],
    ['http;/academia.test', 'http://academia.test'],
    ['  HTTPS://Academia.AtmosferaCreativa.com/  ', 'https://academia.atmosferacreativa.com'],
    ['academia.atmosferacreativa.com', 'https://academia.atmosferacreativa.com'],
    ['academia .atmosferacreativa. com', 'https://academia.atmosferacreativa.com'],
    ['https://academia.test///', 'https://academia.test'],
    ['https://academia.test/sitio/', 'https://academia.test/sitio'],
    ['https://academia.test/wp-json/atora-mobile/v1', 'https://academia.test'],
    ['www.academia.test', 'https://www.academia.test'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeAcademyUrl(input)).toBe(expected);
  });

  it.each(['', '   ', 'hola', 'https://', 'ftp://academia.test', 'https://academia', 'https://academia..test', 'javascript:alert(1)'])('no es una URL válida: %s', (input) => {
    expect(normalizeAcademyUrl(input)).toBeNull();
  });

  it('la API de la academia', () => {
    expect(academyApiBase('https://academia.test')).toBe('https://academia.test/wp-json/atora-mobile/v1');
  });
});
