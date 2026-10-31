import type { Dictionary, Locale } from './dictionary.js';
import { en } from './en.js';
import { es } from './es.js';

export * from './dictionary.js';
export { es, en };
export type { Locale };

const dictionaries: Record<Locale, Dictionary> = { es, en };

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
  const hasEnPrefix = path === '/en' || path.startsWith('/en/');
  if (targetLocale === 'en') {
    if (hasEnPrefix) return path;
    return `/en${path}`;
  }
  if (hasEnPrefix) {
    return path.replace(/^\/en/, '') || '/';
  }
  return path;
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
