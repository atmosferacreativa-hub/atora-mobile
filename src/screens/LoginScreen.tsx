import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardScroll } from '../components/KeyboardScroll';
import { ApiError } from '../api/client';
import { AcademyEndpointModal } from '../components/AcademyEndpointModal';
import { getApiBaseUrlSync } from '../runtimeConfig';
import { colors, spacing } from '../theme';
import { t } from '../i18n';

type Props = {
  onLogin: (login: string, password: string) => Promise<void>;
};

export function LoginScreen({ onLogin }: Props) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [setupOpen, setSetupOpen] = useState(false);
  const apiBaseUrl = getApiBaseUrlSync();
  const passwordRef = useRef<TextInput>(null);

  const submit = async () => {
    if (!login.trim() || !password) {
      setError(t('Escribe tu usuario y contraseña.'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onLogin(login.trim(), password);
      setPassword('');
    } catch (reason) {
      if (reason instanceof ApiError) {
        if (reason.code === 'missing_api_url') {
          setSetupOpen(true);
        }
        setError(reason.code ? `${reason.message} [${reason.code}]` : reason.message);
      } else if (reason instanceof Error) {
        setError(t('Error interno: {detail}', { detail: `${reason.name}: ${reason.message}` }));
      } else {
        setError(t('Error interno desconocido al iniciar sesión.'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
    <KeyboardScroll contentStyle={styles.page} style={styles.root}>
      <View style={styles.brandBlock}>
        <Text style={styles.brand}>ATORA</Text>
        <Text style={styles.tagline}>{t('Tu aprendizaje, siempre contigo.')}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.title}>{t('Ingresar a tu academia')}</Text>
        <Pressable accessibilityRole="button" onPress={() => setSetupOpen(true)} style={styles.setup}>
          <Text style={styles.setupTitle}>{t('Academia')}</Text>
          <Text style={styles.setupValue} numberOfLines={1}>
            {apiBaseUrl ? apiBaseUrl : t('Configura la URL de tu academia')}
          </Text>
        </Pressable>
        <TextInput
          autoCapitalize="none"
          autoComplete="username"
          editable={!busy}
          onChangeText={setLogin}
          // 1.0.1: "Siguiente" pasa a la contraseña.
          onSubmitEditing={() => passwordRef.current?.focus()}
          placeholder={t('Correo o usuario')}
          returnKeyType="next"
          submitBehavior="submit"
          style={styles.input}
          testID="login-user"
          value={login}
        />
        <TextInput
          autoCapitalize="none"
          autoComplete="current-password"
          editable={!busy}
          onChangeText={setPassword}
          // "Listo" inicia sesión.
          onSubmitEditing={() => void submit()}
          placeholder={t('Contraseña')}
          ref={passwordRef}
          returnKeyType="done"
          secureTextEntry
          style={styles.input}
          testID="login-password"
          value={password}
        />
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={submit}
          style={({ pressed }) => [styles.button, (pressed || busy) && styles.buttonPressed]}
          testID="login-submit"
        >
          {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>{t('Entrar')}</Text>}
        </Pressable>
        <Text style={styles.security}>{t('Sesión protegida y revocable. Tu contraseña no se guarda.')}</Text>
      </View>
    </KeyboardScroll>
      <AcademyEndpointModal visible={setupOpen} onClose={() => setSetupOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.background, flex: 1 },
  page: { justifyContent: 'center', padding: spacing.lg },
  brandBlock: { marginBottom: spacing.xl },
  brand: { color: colors.primary, fontSize: 38, fontWeight: '900', letterSpacing: 3 },
  tagline: { color: colors.accentText, fontSize: 16, fontWeight: '700', marginTop: spacing.xs },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 24, borderWidth: 1, gap: spacing.md, padding: spacing.lg },
  title: { color: colors.navy, fontSize: 22, fontWeight: '800' },
  setup: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: 14, borderWidth: 1, padding: spacing.md },
  setupTitle: { color: colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  setupValue: { color: colors.navy, fontSize: 13, fontWeight: '800', marginTop: 4 },
  input: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: 12, borderWidth: 1, color: colors.ink, fontSize: 16, padding: spacing.md },
  error: { color: colors.red, fontSize: 14 },
  button: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 12, minHeight: 52, justifyContent: 'center' },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  security: { color: colors.muted, fontSize: 12, textAlign: 'center' },
});
