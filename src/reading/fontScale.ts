export type KeyValueStore = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

const KEY = 'atora_reading_font_scale_v1';

export function clampFontScale(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0.85, Math.min(1.6, value));
}

export function stepFontScale(current: number, direction: 'down' | 'up'): number {
  const next = direction === 'up' ? current + 0.1 : current - 0.1;
  return Math.round(clampFontScale(next) * 100) / 100;
}

export async function loadFontScale(store: KeyValueStore): Promise<number> {
  const raw = await store.getItem(KEY).catch(() => null);
  const parsed = raw ? Number(raw) : 1;
  return clampFontScale(parsed);
}

export async function saveFontScale(store: KeyValueStore, scale: number): Promise<void> {
  await store.setItem(KEY, String(clampFontScale(scale))).catch(() => undefined);
}

