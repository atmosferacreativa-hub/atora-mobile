import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { resolveMediaUrl } from '../utils/mediaUrl';
import { colors } from '../theme';

type Props = {
  /** URL remota (se normaliza con la URL de la academia) o archivo local (file://). */
  uri?: string | null;
  /** Ícono de reproducir encima (miniaturas de video). */
  play?: boolean;
  /** Etiqueta en la esquina, p. ej. la duración. */
  badge?: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  accessibilityLabel?: string;
};

/**
 * Imagen única para portadas y miniaturas: 16:9, mismas esquinas, marcador ATORA
 * mientras carga o si falla, y caché en disco para verse sin conexión.
 */
export function MediaImage({ uri, play, badge, style, children, accessibilityLabel }: Props) {
  const source = uri ? (uri.startsWith('file:') ? uri : resolveMediaUrl(uri)) : '';
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const showPlaceholder = !source || failed || !loaded;

  return (
    <View accessibilityLabel={accessibilityLabel} style={[styles.frame, style]}>
      {showPlaceholder ? (
        <View style={styles.placeholder}>
          <Text style={styles.brand}>ATORA</Text>
        </View>
      ) : null}
      {source && !failed ? (
        <Image
          cachePolicy="disk"
          contentFit="cover"
          onError={() => setFailed(true)}
          onLoad={() => setLoaded(true)}
          recyclingKey={source}
          source={{ uri: source }}
          style={StyleSheet.absoluteFill}
          transition={150}
        />
      ) : null}
      {play ? (
        <View pointerEvents="none" style={styles.playWrap}>
          <View style={styles.play}>
            <Ionicons color={colors.white} name="play" size={22} style={styles.playIcon} />
          </View>
        </View>
      ) : null}
      {badge ? (
        <View pointerEvents="none" style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { aspectRatio: 16 / 9, backgroundColor: colors.navy, borderRadius: 14, overflow: 'hidden', width: '100%' },
  placeholder: { ...StyleSheet.absoluteFillObject, alignItems: 'center', backgroundColor: colors.navy, justifyContent: 'center' },
  brand: { color: colors.mustard, fontSize: 18, fontWeight: '900', letterSpacing: 3, opacity: 0.85 },
  playWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  play: { alignItems: 'center', backgroundColor: 'rgba(19, 35, 58, 0.72)', borderRadius: 999, height: 48, justifyContent: 'center', width: 48 },
  playIcon: { marginLeft: 3 },
  badge: { backgroundColor: 'rgba(19, 35, 58, 0.8)', borderRadius: 6, bottom: 8, paddingHorizontal: 6, paddingVertical: 2, position: 'absolute', right: 8 },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: '800' },
});
