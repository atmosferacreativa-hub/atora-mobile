import type { ReactNode } from 'react';
import { Keyboard, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

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
  return (
    <KeyboardAwareScrollView
      bottomOffset={KEYBOARD_GAP}
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
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
