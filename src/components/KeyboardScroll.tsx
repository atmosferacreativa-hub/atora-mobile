import type { ReactNode } from 'react';
import { Keyboard, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import {
  KeyboardAwareScrollView,
  useReanimatedFocusedInput,
  useReanimatedKeyboardAnimation,
  useWindowDimensions,
} from 'react-native-keyboard-controller';
import Reanimated, { scrollTo, useAnimatedReaction, useAnimatedRef, useScrollViewOffset } from 'react-native-reanimated';

/** Espacio entre el campo con el foco y el teclado. */
export const KEYBOARD_GAP = 24;

type Props = {
  children: ReactNode;
  /** Estilo del contenido (relleno, separación entre elementos). */
  contentStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * 1.0.1: pantalla con campos de texto. El campo con el foco queda siempre
 * encima del teclado, con margen; tocar fuera de un campo cierra el teclado
 * (los botones siguen respondiendo al primer toque).
 */
export function KeyboardScroll({ children, contentStyle, style, testID }: Props) {
  const ref = useAnimatedRef<Reanimated.ScrollView>();
  const offset = useScrollViewOffset(ref);
  const { input } = useReanimatedFocusedInput();
  const { height: keyboard } = useReanimatedKeyboardAnimation();
  const { height: windowHeight } = useWindowDimensions();

  // KeyboardAwareScrollView no desplaza si el foco pasa a otro campo con el
  // teclado ya abierto ("Siguiente" del login): calcula con la selección del
  // campo anterior. Aquí se lleva el campo nuevo encima del teclado.
  useAnimatedReaction(
    () => input.value,
    (current, previous) => {
      if (!current || current.target === previous?.target) return;
      const keyboardHeight = Math.abs(keyboard.value);
      if (keyboardHeight <= 0) return;
      const bottom = current.layout.absoluteY + current.layout.height;
      const limit = windowHeight - keyboardHeight - KEYBOARD_GAP;
      if (bottom > limit) scrollTo(ref, 0, offset.value + (bottom - limit), true);
    },
    [windowHeight],
  );

  return (
    <KeyboardAwareScrollView
      bottomOffset={KEYBOARD_GAP}
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
      ref={ref}
      style={style}
      testID={testID}
    >
      {/* a11y-ignore: fondo que cierra el teclado, no es un botón */}
      <Pressable accessible={false} onPress={Keyboard.dismiss} style={[{ flexGrow: 1 }, contentStyle]}>
        {children}
      </Pressable>
    </KeyboardAwareScrollView>
  );
}
