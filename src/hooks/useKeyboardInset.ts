import { useEffect, useState, type RefObject } from 'react';
import { Dimensions, Keyboard, type View } from 'react-native';
import { KeyboardEvents } from 'react-native-keyboard-controller';
import { keyboardInsetFor } from '../components/keyboardScrollMath';

/**
 * 1.0.1: margen inferior que necesita una vista para que el teclado no la tape.
 * Usa la altura real del teclado y la posición de la vista en la ventana.
 * KeyboardAvoidingView de la librería no acomodaba las pantallas que están
 * dentro de la navegación (sí el login, que está arriba).
 *
 * Escucha las dos fuentes (React Native y keyboard-controller): con borde a
 * borde, la de React Native no siempre llega. Se vuelve a medir un instante
 * después, cuando la pantalla terminó de acomodarse (nunca con el teclado
 * cerrado: al pasar de un campo a otro llega un "cerrado" y enseguida un "abierto").
 */
export function useKeyboardInset(ref: RefObject<View | null>): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    let top = 0;
    let timers: ReturnType<typeof setTimeout>[] = [];
    const measure = () => {
      ref.current?.measureInWindow((_x, y, _w, height) => {
        // Nunca con el teclado cerrado: al pasar de un campo a otro llega un "cerrado" y enseguida un "abierto".
        if (top <= 0) return;
        const next = keyboardInsetFor(y + height, top);
        setInset(next);
      });
    };
    const opened = (keyboardTop: number) => {
      if (keyboardTop <= 0) return;
      top = keyboardTop;
      measure();
      timers.push(setTimeout(measure, 300));
    };
    const closed = () => {
      top = 0;
      timers.forEach(clearTimeout);
      timers = [];
      setInset(0);
    };
    const subscriptions = [
      Keyboard.addListener('keyboardDidShow', (event) => opened(event.endCoordinates.screenY)),
      Keyboard.addListener('keyboardDidHide', closed),
      KeyboardEvents.addListener('keyboardDidShow', (event) => {
        if (event.height > 0) opened(Dimensions.get('screen').height - event.height);
      }),
      KeyboardEvents.addListener('keyboardDidHide', closed),
    ];
    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
      timers.forEach(clearTimeout);
    };
  }, [ref]);
  return inset;
}
