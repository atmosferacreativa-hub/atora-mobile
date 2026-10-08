import { keyboardInsetFor, scrollTargetFor } from '../keyboardScrollMath';

/** 1.0.1 (punto 3): cuánto desplazar para que el campo con el foco quede encima del teclado. */
describe('campo con el foco encima del teclado', () => {
  it('debajo del teclado: sube lo justo, con el margen', () => {
    // Área visible de 300 (el teclado ya la achicó); campo en 400–456.
    expect(scrollTargetFor({ top: 400, height: 56, offset: 0, viewport: 300, gap: 24 })).toBe(180);
  });

  it('ya visible con margen: no se mueve', () => {
    expect(scrollTargetFor({ top: 100, height: 56, offset: 0, viewport: 300, gap: 24 })).toBeNull();
  });

  it('por encima de lo visible (se desplazó de más): baja hasta mostrarlo', () => {
    expect(scrollTargetFor({ top: 50, height: 56, offset: 200, viewport: 300, gap: 24 })).toBe(26);
  });

  it('tiene en cuenta lo ya desplazado', () => {
    expect(scrollTargetFor({ top: 600, height: 56, offset: 200, viewport: 300, gap: 24 })).toBe(380);
  });
});

describe('margen inferior por el teclado', () => {
  it('lo que el teclado tapa de la vista', () => {
    // Vista hasta 590 (encima de la barra de pestañas); teclado desde 382.
    expect(keyboardInsetFor(590, 382)).toBe(208);
  });
  it('vista que termina encima del teclado: nada', () => {
    expect(keyboardInsetFor(300, 382)).toBe(0);
  });
});
