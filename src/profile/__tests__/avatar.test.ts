import { avatarView, colorFor, firstName, initialsFrom, isUsablePhoto } from '../avatar';

describe('foto de perfil', () => {
  it('usa la foto si existe; si no, las iniciales y el color del servidor', () => {
    expect(avatarView({ name: 'Ana Ruiz', avatar_url: 'https://academia.test/wp-content/uploads/a.jpg' })).toEqual({ kind: 'photo', uri: 'https://academia.test/wp-content/uploads/a.jpg' });
    expect(avatarView({ name: 'Ana Ruiz', avatar_url: '', avatar_initials: 'AR', avatar_color: 'hsl(10, 55%, 45%)' })).toEqual({ kind: 'initials', initials: 'AR', color: 'hsl(10, 55%, 45%)' });
  });

  it('nunca Gravatar ni SVG (servidor viejo): calcula las iniciales', () => {
    expect(isUsablePhoto('https://secure.gravatar.com/avatar/abc?s=192')).toBe(false);
    expect(isUsablePhoto('data:image/svg+xml;charset=utf-8,%3Csvg')).toBe(false);
    const view = avatarView({ id: 7, display_name: 'Julia Rojas', avatar_url: 'https://secure.gravatar.com/avatar/abc' });
    expect(view).toEqual({ kind: 'initials', initials: 'JR', color: colorFor('7') });
  });

  it('iniciales con acentos y un solo nombre; primer nombre para el saludo', () => {
    expect(initialsFrom('  Ángel   Pérez  ')).toBe('ÁP');
    expect(initialsFrom('María')).toBe('M');
    expect(initialsFrom('')).toBe('?');
    expect(firstName('Julia Rojas')).toBe('Julia');
    expect(colorFor('7')).toBe(colorFor('7'));
  });
});
