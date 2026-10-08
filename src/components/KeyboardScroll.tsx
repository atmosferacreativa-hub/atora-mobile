import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  TextInput,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { scrollTargetFor } from './keyboardScrollMath';

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
 *
 * El área visible se achica con el teclado (KeyboardAvoidingView, la misma
 * pieza que usan los chats) y el campo enfocado se mide y se lleva a la vista:
 * al abrirse el teclado y también al pasar a otro campo con el teclado abierto
 * ("Siguiente" del login). No depende de los eventos de campo enfocado de la
 * librería, que en el emulador del CI no movían la pantalla.
 */
export function KeyboardScroll({ children, contentStyle, style, testID }: Props) {
  const scroll = useRef<ScrollView>(null);
  const content = useRef<View>(null);
  const offset = useRef(0);
  const viewport = useRef(0);
  const keyboardOpen = useRef(false);
  const lastFocused = useRef<unknown>(null);

  const ensureVisible = useCallback(() => {
    const focused = TextInput.State.currentlyFocusedInput() as unknown as View | null;
    lastFocused.current = focused;
    if (!focused || !content.current || !scroll.current || viewport.current <= 0) return;
    focused.measureLayout(
      content.current,
      (_left, top, _width, height) => {
        const target = scrollTargetFor({ top, height, offset: offset.current, viewport: viewport.current, gap: KEYBOARD_GAP });
        if (target !== null) scroll.current?.scrollTo({ y: target, animated: true });
      },
      () => undefined,
    );
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const show = Keyboard.addListener('keyboardDidShow', () => {
      keyboardOpen.current = true;
      // El área visible se achica justo después: se mide cuando ya cambió.
      setTimeout(ensureVisible, 120);
      // Con el teclado abierto, otro campo puede tomar el foco sin que el teclado se mueva.
      if (!timer) {
        timer = setInterval(() => {
          if (TextInput.State.currentlyFocusedInput() !== lastFocused.current) ensureVisible();
        }, 200);
      }
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardOpen.current = false;
      if (timer) clearInterval(timer);
      timer = null;
    });
    return () => {
      show.remove();
      hide.remove();
      if (timer) clearInterval(timer);
    };
  }, [ensureVisible]);

  const onLayout = (event: LayoutChangeEvent) => {
    viewport.current = event.nativeEvent.layout.height;
    if (keyboardOpen.current) ensureVisible();
  };
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = event.nativeEvent.contentOffset.y;
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={[{ flex: 1 }, style]}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        onLayout={onLayout}
        onScroll={onScroll}
        ref={scroll}
        scrollEventThrottle={16}
        testID={testID}
      >
        <View collapsable={false} ref={content} style={{ flexGrow: 1 }}>
          {/* a11y-ignore: fondo que cierra el teclado, no es un botón */}
          <Pressable accessible={false} onPress={Keyboard.dismiss} style={[{ flexGrow: 1 }, contentStyle]}>
            {children}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
