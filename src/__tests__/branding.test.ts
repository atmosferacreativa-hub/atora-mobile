declare const require: (path: string) => { expo: { plugins: unknown[]; android: { adaptiveIcon: { backgroundColor: string } } } };

/** 1.0.1 (punto 9): la pantalla de inicio en blanco, igual que el ícono. */
describe('marca', () => {
  const expo = require('../../app.json').expo;
  const splash = (expo.plugins as unknown[]).find((p) => Array.isArray(p) && p[0] === 'expo-splash-screen') as [string, { backgroundColor: string }];

  it('pantalla de inicio blanca', () => {
    expect(splash[1].backgroundColor.toUpperCase()).toBe('#FFFFFF');
  });

  it('mismo fondo que el ícono adaptable', () => {
    expect(splash[1].backgroundColor.toUpperCase()).toBe(String(expo.android.adaptiveIcon.backgroundColor).toUpperCase());
  });
});
