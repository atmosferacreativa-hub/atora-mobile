import { useEffect, useState, type RefObject } from 'react';
import { Keyboard, type View } from 'react-native';
import { keyboardInsetFor } from '../components/keyboardScrollMath';

/**
 * 1.0.1: margen inferior que necesita una vista para que el teclado no la tape.
 * Usa la altura real del teclado (eventos de React Native) y la posición de la
 * vista en la ventana. KeyboardAvoidingView de la librería no acomodaba las
 * pantallas que están dentro de la navegación (sí el login, que está arriba).
 */
export function useKeyboardInset(ref: RefObject<View | null>): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (event) => {
      const top = event.endCoordinates.screenY;
      ref.current?.measureInWindow((_x, y, _w, height) => setInset(keyboardInsetFor(y + height, top)));
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setInset(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [ref]);
  return inset;
}
