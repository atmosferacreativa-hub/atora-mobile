import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ApiError } from '../api/client';
import { removeAvatar, uploadAvatar } from '../api/avatar';
import { Avatar } from './Avatar';
import { useNetworkState } from '../hooks/useNetworkState';
import { isUsablePhoto, type AvatarSource } from '../profile/avatar';
import { colors, radius, spacing } from '../theme';
import { t } from '../i18n';

type Props = { token: string; person: AvatarSource; onChanged: () => void };

/**
 * 1.4.0: foto de perfil en Yo. Cámara o galería con recorte cuadrado; la academia la reduce a 512 px y le quita los
 * datos de ubicación. Si la institución administra las fotos, se dice y no se ofrece cambiarla.
 */
export function ProfilePhoto({ token, person, onChanged }: Props) {
  const network = useNetworkState();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const hasPhoto = isUsablePhoto(person.avatar_url);

  const send = async (asset: ImagePicker.ImagePickerAsset) => {
    setBusy(true);
    setMessage('');
    try {
      await uploadAvatar(token, { uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg', name: asset.fileName ?? 'foto.jpg' });
      setMessage(t('Foto actualizada.'));
      onChanged();
    } catch (reason) {
      setMessage(reason instanceof ApiError && reason.status === 403 ? t('La institución administra las fotos de perfil.') : reason instanceof Error && reason.message ? reason.message : t('No se pudo subir la foto. Inténtalo de nuevo.'));
    } finally {
      setBusy(false);
    }
  };

  const pick = async (source: 'camera' | 'library') => {
    if (network.isConnected === false) {
      setMessage(t('Cambiar la foto necesita conexión.'));
      return;
    }
    const permission = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setMessage(source === 'camera' ? t('Sin permiso para la cámara. Puedes darlo en los ajustes del teléfono.') : t('Sin permiso para las fotos. Puedes darlo en los ajustes del teléfono.'));
      return;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8, exif: false };
    const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled && result.assets[0]) await send(result.assets[0]);
  };

  const remove = async () => {
    setBusy(true);
    setMessage('');
    try {
      await removeAvatar(token);
      setMessage(t('Foto quitada.'));
      onChanged();
    } catch (reason) {
      setMessage(reason instanceof ApiError && reason.status === 403 ? t('La institución administra las fotos de perfil.') : t('No se pudo quitar la foto. Inténtalo de nuevo.'));
    } finally {
      setBusy(false);
    }
  };

  const choose = () =>
    Alert.alert(t('Foto de perfil'), undefined, [
      { text: t('Tomar foto'), onPress: () => void pick('camera') },
      { text: t('Elegir de la galería'), onPress: () => void pick('library') },
      ...(hasPhoto ? [{ text: t('Quitar foto'), style: 'destructive' as const, onPress: () => void remove() }] : []),
      { text: t('Cancelar'), style: 'cancel' as const },
    ]);

  return (
    <View style={styles.root}>
      <Avatar person={person} size={88} testID="profile-avatar" />
      <Pressable accessibilityRole="button" disabled={busy} onPress={choose} style={styles.button} testID="profile-photo-change">
        {busy ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.buttonText}>{hasPhoto ? t('Cambiar foto') : t('Agregar foto')}</Text>}
      </Pressable>
      {message ? <Text accessibilityRole="alert" style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: spacing.sm },
  button: { alignItems: 'center', borderColor: colors.primary, borderRadius: radius.md, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.md },
  buttonText: { color: colors.primaryStrong, fontWeight: '800' },
  message: { color: colors.textMuted, textAlign: 'center' },
});
