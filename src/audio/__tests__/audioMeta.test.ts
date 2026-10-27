import { audioMetaLine, clampSeek, compatibilityNote, formatDuration, formatRate, nextRate, startPosition } from '../audioMeta';

describe('audio/audioMeta', () => {
  it('formats duration', () => {
    expect(formatDuration(3)).toBe('0:03');
    expect(formatDuration(725)).toBe('12:05');
    expect(formatDuration(3600)).toBe('1:00:00');
    expect(formatDuration(null)).toBe('');
  });

  it('shows duration, size and format before downloading', () => {
    expect(audioMetaLine({ duration_seconds: 185, bytes: 2.4 * 1024 * 1024, audio_format: 'mp3' })).toBe('3:05 · 2.4 MB · MP3');
    expect(audioMetaLine({ duration_seconds: null, bytes: null, audio_format: '' })).toBe('');
  });

  it('shows the OGG warning on iOS only', () => {
    const ogg = { audio_format: 'ogg', compatibility: { status: 'limited', note: 'Puede no reproducirse en iPhone.' } };
    expect(compatibilityNote(ogg, 'ios')).toBe('Puede no reproducirse en iPhone.');
    expect(compatibilityNote(ogg, 'android')).toBe('');
    expect(compatibilityNote({ audio_format: 'mp3', compatibility: { status: 'broad', note: '' } }, 'ios')).toBe('');
  });

  it('cycles playback rates', () => {
    expect(nextRate(1)).toBe(1.25);
    expect(nextRate(2)).toBe(0.75);
    expect(formatRate(1.5)).toBe('1,5×');
  });

  it('resumes unless the audio was finished', () => {
    expect(startPosition(42.7, 300)).toBe(42);
    expect(startPosition(299, 300)).toBe(0);
    expect(startPosition(0, 300)).toBe(0);
  });

  it('clamps seeking', () => {
    expect(clampSeek(10, -15, 300)).toBe(0);
    expect(clampSeek(290, 15, 300)).toBe(300);
    expect(clampSeek(10, 15, null)).toBe(25);
  });
});
