import { gradeLabel, NO_GRADES } from '../gradeLabel';

describe('nota en Mi evolución', () => {
  it('null y 0 se muestran distinto', () => {
    expect(gradeLabel(null)).toEqual({ text: NO_GRADES, empty: true });
    expect(gradeLabel(0)).toEqual({ text: '0', empty: false });
    expect(gradeLabel(null).text).not.toBe(gradeLabel(0).text);
  });

  it('una nota positiva se muestra tal cual', () => {
    expect(gradeLabel(88).text).toBe('88');
    expect(gradeLabel(72.5).text).toBe('72.5');
  });
});
