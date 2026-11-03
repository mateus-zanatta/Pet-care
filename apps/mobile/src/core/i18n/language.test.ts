import { parseLanguagePreference, resolveLocale } from './language';

describe('resolveLocale', () => {
  it('respeita a escolha explícita do usuário', () => {
    expect(resolveLocale('en', ['pt'])).toBe('en');
    expect(resolveLocale('pt-BR', ['en'])).toBe('pt-BR');
  });

  it('segue o aparelho quando a preferência é "system"', () => {
    expect(resolveLocale('system', ['en'])).toBe('en');
    expect(resolveLocale('system', ['pt'])).toBe('pt-BR');
    expect(resolveLocale('system', ['pt-PT'])).toBe('pt-BR');
  });

  it('usa o primeiro idioma suportado da lista do aparelho', () => {
    expect(resolveLocale('system', ['es', 'en', 'pt'])).toBe('en');
  });

  it('cai no português (padrão) se nenhum idioma for suportado', () => {
    expect(resolveLocale('system', ['es', 'ja'])).toBe('pt-BR');
    expect(resolveLocale('system', [])).toBe('pt-BR');
    expect(resolveLocale('system', [null, undefined])).toBe('pt-BR');
  });
});

describe('parseLanguagePreference', () => {
  it('aceita só valores conhecidos', () => {
    expect(parseLanguagePreference('en')).toBe('en');
    expect(parseLanguagePreference('pt-BR')).toBe('pt-BR');
    expect(parseLanguagePreference('fr')).toBe('system');
    expect(parseLanguagePreference(null)).toBe('system');
  });
});
