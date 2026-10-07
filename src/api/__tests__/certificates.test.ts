jest.mock('expo-file-system/legacy', () => ({ documentDirectory: 'file:///docs/' }));
jest.mock('../authenticated', () => ({}));
jest.mock('../session', () => ({}));
jest.mock('../../offline/localCache', () => ({}));
import { certificateRequest } from '../certificates';

describe('certificado en PDF (1.0.0)', () => {
  it('con un servidor 6.33.0 pide el PDF y lo guarda como .pdf', () => {
    expect(certificateRequest('https://a.test/wp-json/atora-mobile/v1/certificates/course/7/document?expires=1&sig=x', true, 'course-7', 'file:///docs/c/')).toEqual({
      url: 'https://a.test/wp-json/atora-mobile/v1/certificates/course/7/document?expires=1&sig=x&format=pdf',
      destination: 'file:///docs/c/course-7.pdf',
      format: 'pdf',
    });
  });

  it('con servidores anteriores sigue con el HTML', () => {
    expect(certificateRequest('https://a.test/doc?sig=x', false, 'program-3', 'file:///docs/c/')).toEqual({ url: 'https://a.test/doc?sig=x', destination: 'file:///docs/c/program-3.html', format: 'html' });
  });
});
