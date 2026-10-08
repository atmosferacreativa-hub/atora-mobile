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
 * después, cuando la pantalla terminó de acomodarse.
 */
export function useKeyboardInset(ref: RefObject<View | null>): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    let top = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const measure = (source: string) => {
      ref.current?.measureInWindow((_x, y, _w, height) => {
        const next = keyboardInsetFor(y + height, top);
        console.warn(`[teclado] ${source}: borde del teclado ${Math.round(top)}, vista hasta ${Math.round(y + height)}, margen ${next}`);
        setInset(next);
      });
    };
    const opened = (keyboardTop: number, source: string) => {
      if (keyboardTop <= 0) return;
      top = keyboardTop;
      measure(source);
      timers.push(setTimeout(() => measure(`${source}+300ms`), 300));
    };
    const closed = () => {
      top = 0;
      setInset(0);
    };
    const subscriptions = [
      Keyboard.addListener('keyboardDidShow', (event) => opened(event.endCoordinates.screenY, 'react-native')),
      Keyboard.addListener('keyboardDidHide', closed),
      KeyboardEvents.addListener('keyboardDidShow', (event) => {
        if (event.height > 0) opened(Dimensions.get('screen').height - event.height, 'keyboard-controller');
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
