import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ApiError } from '../api/client';
import { colors, spacing } from '../theme';

type Props = {
  onLogin: (login: string, password: string) => Promise<void>;
};

export function LoginScreen({ onLogin }: Props) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!login.trim() || !password) {
      setError('Escribe tu usuario y contraseña.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onLogin(login.trim(), password);
      setPassword('');
    } catch (reason) {
      if (reason instanceof ApiError) {
        setError(reason.code ? `${reason.message} [${reason.code}]` : reason.message);
      } else if (reason instanceof Error) {
        setError(`Error interno: ${reason.name}: ${reason.message}`);
      } else {
        setError('Error interno desconocido al iniciar sesión.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.page}
    >
      <View style={styles.brandBlock}>
        <Text style={styles.brand}>ATORA</Text>
        <Text style={styles.tagline}>Tu aprendizaje, siempre contigo.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.title}>Ingresar a tu academia</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="username"
          editable={!busy}
          onChangeText={setLogin}
          placeholder="Correo o usuario"
          style={styles.input}
          value={login}
        />
        <TextInput
          autoCapitalize="none"
          autoComplete="current-password"
          editable={!busy}
          onChangeText={setPassword}
          onSubmitEditing={submit}
          placeholder="Contraseña"
          secureTextEntry
          style={styles.input}
          value={password}
        />
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={submit}
          style={({ pressed }) => [styles.button, (pressed || busy) && styles.buttonPressed]}
        >
          {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Entrar</Text>}
        </Pressable>
        <Text style={styles.security}>Sesión protegida y revocable. Tu contraseña no se guarda.</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: colors.navy, flex: 1, justifyContent: 'center', padding: spacing.lg },
  brandBlock: { marginBottom: spacing.xl },
  brand: { color: colors.white, fontSize: 38, fontWeight: '900', letterSpacing: 3 },
  tagline: { color: colors.mustard, fontSize: 16, fontWeight: '700', marginTop: spacing.xs },
  card: { backgroundColor: colors.paper, borderRadius: 24, gap: spacing.md, padding: spacing.lg },
  title: { color: colors.navy, fontSize: 22, fontWeight: '800' },
  input: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: 12, borderWidth: 1, color: colors.ink, fontSize: 16, padding: spacing.md },
  error: { color: colors.red, fontSize: 14 },
  button: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 12, minHeight: 52, justifyContent: 'center' },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  security: { color: colors.muted, fontSize: 12, textAlign: 'center' },
});
