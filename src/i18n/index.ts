import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getLocales } from 'expo-localization';
import { useEffect, useState } from 'react';
import { getLanguage, resolveLanguage, setLanguage, subscribeLanguage, type Language, type LanguagePreference } from './core';

export { t, tk, locale, getLanguage } from './core';
export type { Language, LanguagePreference } from './core';

// Preferencia del teléfono, no del usuario: sobrevive al cierre de sesión.
const KEY = 'atora.language.v1';

export async function loadLanguagePreference(): Promise<LanguagePreference> {
  const raw = await AsyncStorage.getItem(KEY).catch(() => null);
  return raw === 'es' || raw === 'en' ? raw : 'system';
}

function deviceLanguages(): string[] {
  // Compilación de pruebas de pantalla: el emulador está en inglés, los recorridos en español.
  if ((Constants.expoConfig?.extra as { e2e?: boolean } | undefined)?.e2e) return ['es'];
  try {
    return getLocales().map((item) => item.languageCode ?? '');
  } catch {
    return [];
  }
}

/** Al arrancar: el idioma elegido en Yo o el del teléfono. */
export async function initLanguage(): Promise<Language> {
  const language = resolveLanguage(await loadLanguagePreference(), deviceLanguages());
  setLanguage(language);
  return language;
}

export async function saveLanguagePreference(preference: LanguagePreference): Promise<void> {
  await AsyncStorage.setItem(KEY, preference).catch(() => undefined);
  setLanguage(resolveLanguage(preference, deviceLanguages()));
}

/** Para volver a dibujar la app al cambiar de idioma. */
export function useLanguage(): Language {
  const [language, setState] = useState<Language>(getLanguage());
  useEffect(() => subscribeLanguage(setState), []);
  return language;
}
