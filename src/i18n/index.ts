import type { Dictionary, Locale } from './dictionary.js';
import { en } from './en.js';
import { es } from './es.js';

export * from './dictionary.js';
export { es, en };
export type { Locale };

const dictionaries: Record<Locale, Dictionary> = { es, en };

const PATH_ALIASES: Record<string, Record<Locale, string>> = {
  '/': { es: '/', en: '/en/' },
  '/implementacion': { es: '/implementacion', en: '/en/implementation' },
  '/implementation': { es: '/implementacion', en: '/en/implementation' },
  '/privacidad': { es: '/privacidad', en: '/en/privacy' },
  '/privacy': { es: '/privacidad', en: '/en/privacy' },
  '/terminos': { es: '/terminos', en: '/en/terms' },
  '/terms': { es: '/terminos', en: '/en/terms' },
};

export function t<N extends keyof Dictionary, K extends keyof Dictionary[N]>(
  locale: Locale,
  namespace: N,
  key: K
): Dictionary[N][K] {
  return dictionaries[locale][namespace][key];
}

export function format(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_match, name) => String(vars[name] ?? ''));
}

export function getLocalizedPath(path: string, targetLocale: Locale): string {
  const normalized = path || '/';
  const alias = PATH_ALIASES[normalized]?.[targetLocale];
  if (alias) return alias;

  const hasEnPrefix = normalized === '/en' || normalized.startsWith('/en/');
  if (targetLocale === 'en') {
    if (hasEnPrefix) return normalized;
    return `/en${normalized}`;
  }
  if (hasEnPrefix) {
    return normalized.replace(/^\/en/, '') || '/';
  }
  return normalized;
}

export function getStateLabel(locale: Locale, state: 'ok' | 'parcial' | 'fallo'): string {
  if (state === 'ok') return t(locale, 'informe', 'stateOk');
  if (state === 'parcial') return t(locale, 'informe', 'stateParcial');
  return t(locale, 'informe', 'stateFallo');
}

export function getCheckExplanation(
  locale: Locale,
  checkId: keyof Dictionary['informe']['checkExplanations'],
  state: 'ok' | 'parcial' | 'fallo'
): string {
  const explanations = t(locale, 'informe', 'checkExplanations');
  return explanations[checkId]?.[state] ?? '';
}
