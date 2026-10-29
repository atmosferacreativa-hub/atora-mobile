import { Image, StyleSheet, Text, View } from 'react-native';
import { avatarView, type AvatarSource } from '../profile/avatar';
import { colors } from '../theme';

type Props = { person: AvatarSource; size?: number; testID?: string };

/** 1.4.0: foto de perfil o, sin foto, iniciales con el color de la persona. No lee el nombre en voz alta (lo hace el texto al lado). */
export function Avatar({ person, size = 40, testID }: Props) {
  const view = avatarView(person);
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (view.kind === 'photo') {
    return <Image accessible={false} source={{ uri: view.uri }} style={[styles.base, box]} testID={testID} />;
  }
  return (
    <View accessible={false} style={[styles.base, box, { backgroundColor: view.color }]} testID={testID}>
      <Text style={[styles.initials, { fontSize: Math.max(12, Math.round(size * 0.4)) }]}>{view.initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  initials: { color: colors.white, fontWeight: '800' },
});
