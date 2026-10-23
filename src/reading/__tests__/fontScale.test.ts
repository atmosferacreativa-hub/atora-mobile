import { clampFontScale, loadFontScale, saveFontScale, stepFontScale } from '../fontScale';

function memoryStore(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: async (key: string) => (Object.prototype.hasOwnProperty.call(data, key) ? data[key]! : null),
    setItem: async (key: string, value: string) => { data[key] = value; },
    data,
  };
}

test('clampFontScale clamps to bounds', () => {
  expect(clampFontScale(10)).toBe(1.6);
  expect(clampFontScale(0)).toBe(0.85);
  expect(clampFontScale(1.2)).toBe(1.2);
});

test('font scale is saved and loaded', async () => {
  const store = memoryStore();
  await saveFontScale(store, 1.23);
  const loaded = await loadFontScale(store);
  expect(loaded).toBe(1.23);
});

test('stepFontScale moves by 0.1 and clamps', () => {
  expect(stepFontScale(1, 'up')).toBe(1.1);
  expect(stepFontScale(0.9, 'down')).toBe(0.85);
});

