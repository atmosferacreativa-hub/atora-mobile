import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { downloadCertificate, listCertificates, type StoredCertificate } from '../api/certificates';
import { getServerCapabilities } from '../api/discovery';
import { colors, spacing } from '../theme';
import { t, tk } from '../i18n';

type Props = {
  token: string;
  onBack: () => void;
  onOpen: (title: string, localUri: string, format: 'pdf' | 'html') => void;
};

const STATUS: Record<StoredCertificate['status'], string> = { issued: tk('Emitido'), available: tk('Disponible'), revoked: tk('Revocado') };

/** Certificados (0.5.0): se descargan al teléfono y se abren después sin conexión. */
export function CertificatesScreen({ token, onBack, onOpen }: Props) {
  const [items, setItems] = useState<StoredCertificate[] | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listCertificates(token);
      setItems(result.items);
      setFromCache(result.fromCache);
    } catch {
      setNotice(t('No pudimos cargar tus certificados.'));
      setItems((current) => current ?? []);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const download = async (item: StoredCertificate) => {
    const id = `${item.type}-${item.id}`;
    setBusy(id);
    setNotice('');
    try {
      const caps = await getServerCapabilities().catch(() => ({} as { certificate_pdf?: boolean }));
      const saved = await downloadCertificate(item, token, Boolean(caps.certificate_pdf));
      setItems((current) => (current ?? []).map((c) => (c.type === saved.type && c.id === saved.id ? saved : c)));
      if (saved.localUri) onOpen(saved.title, saved.localUri, saved.format ?? 'html');
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : t('No se pudo descargar el certificado.'));
    } finally {
      setBusy('');
    }
  };

  if (!items) return <View style={styles.center}><ActivityIndicator color={colors.blue} /></View>;

  return (
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
      <Pressable hitSlop={12} accessibilityRole="button" onPress={onBack}><Text style={styles.back}>{t('← Volver')}</Text></Pressable>
      <Text style={styles.title}>{t('Certificados')}</Text>
      <Text style={styles.meta}>{fromCache ? t('Sin conexión: se muestran los guardados.') : t('Los descargados se abren sin conexión.')}</Text>
      {!items.length ? <Text style={styles.meta}>{t('Todavía no tienes certificados.')}</Text> : null}
      {items.map((item) => {
        const id = `${item.type}-${item.id}`;
        const revoked = item.status === 'revoked';
        return (
          <View key={id} style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={[styles.meta, revoked && styles.revoked]}>
              {STATUS[item.status] ? t(STATUS[item.status]) : item.status}{item.type === 'program' ? ` · ${t('Programa')}` : ''}{item.certificate_code ? ` · ${item.certificate_code}` : ''}
            </Text>
            <View style={styles.actions}>
              {busy === id ? <ActivityIndicator color={colors.blue} /> : (
                <>
                  {item.localUri ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={t('Ver certificado de {title}', { title: item.title })} onPress={() => onOpen(item.title, item.localUri as string, item.format ?? 'html')} style={styles.primary} testID={`certificate-open-${id}`}>
                      <Text style={styles.primaryText}>{t('Ver')}</Text>
                    </Pressable>
                  ) : null}
                  {!revoked && !fromCache ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={t('Descargar certificado de {title}', { title: item.title })} onPress={() => void download(item)} style={styles.secondary} testID={`certificate-download-${id}`}>
                      <Text style={styles.secondaryText}>{item.localUri ? t('Actualizar') : t('Descargar')}</Text>
                    </Pressable>
                  ) : null}
                </>
              )}
            </View>
          </View>
        );
      })}
      {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  content: { gap: spacing.md, padding: spacing.lg },
  back: { color: colors.blue, fontWeight: '800' },
  title: { color: colors.navy, fontSize: 28, fontWeight: '900' },
  meta: { color: colors.muted, fontSize: 12 },
  revoked: { color: colors.red },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 16, borderWidth: 1, gap: spacing.xs, padding: spacing.md },
  cardTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  primary: { minHeight: 44, justifyContent: 'center', backgroundColor: colors.blue, borderRadius: 10, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  primaryText: { color: colors.white, fontWeight: '900' },
  secondary: { minHeight: 44, justifyContent: 'center', borderColor: colors.blue, borderRadius: 10, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  secondaryText: { color: colors.blue, fontWeight: '800' },
  notice: { color: colors.muted, textAlign: 'center' },
});
