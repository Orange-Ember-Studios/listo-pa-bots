// COP calculada con USD ≈ COP 4.000; ajusta a mano si la tasa cambia

import type { Locale } from '../i18n/index.js';

export interface LocalizedText {
  es: string;
  en: string;
}

export type CurrencyCode = 'cop' | 'usd';

export interface CurrencyConfig {
  /** ISO 4217 code passed to Intl.NumberFormat. */
  code: string;
  /** BCP 47 locale used for formatting. */
  locale: string;
  /** Optional suffix shown after the formatted amount (e.g. "USD"). */
  suffix?: LocalizedText;
}

/** Currency configuration keyed by currency code so adding a new currency is only a new entry here. */
export const currencies: Record<CurrencyCode, CurrencyConfig> = {
  cop: {
    code: 'COP',
    locale: 'es-CO',
  },
  usd: {
    code: 'USD',
    locale: 'en-US',
    suffix: { es: 'USD', en: 'USD' },
  },
};

/** Maps a page locale to the currency the visitor should see. */
export function currencyByLocale(locale: Locale): CurrencyCode {
  return locale === 'es' ? 'cop' : 'usd';
}

export interface Price {
  /** Amount for each supported currency. */
  amounts: Record<CurrencyCode, number>;
  prefix: LocalizedText;
  /** Text shown after the price (e.g. "pago único" or "/site/month"). */
  period: LocalizedText;
}

/** Formats a price for the given page locale using Intl.NumberFormat. */
export function formatPrice(price: Price, locale: Locale): string {
  const currency = currencyByLocale(locale);
  const config = currencies[currency];
  const amount = price.amounts[currency];
  const formatted = new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
  const suffix = config.suffix?.[locale] ?? '';
  const prefix = price.prefix[locale] ?? '';
  const period = price.period[locale] ?? '';
  return `${prefix} ${formatted}${suffix ? ' ' + suffix : ''} ${period}`.trim();
}

export interface ImplementationTier {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  includes: LocalizedText;
  features: LocalizedText[];
  price: Price;
  cta: LocalizedText;
}

export interface MonitoringPlan {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  features: LocalizedText[];
  price: Price;
}

export const implementationTiers: ImplementationTier[] = [
  {
    id: 'basica',
    name: { es: 'Básica', en: 'Basic' },
    description: {
      es: 'Señales claras para agentes de IA sin cambiar tu sitio de fondo.',
      en: 'Clear signals for AI agents without rebuilding your site.',
    },
    includes: {
      es: 'Incluye:',
      en: 'Includes:',
    },
    features: [
      { es: 'robots.txt segmentado para agentes de IA', en: 'Segmented robots.txt for AI agents' },
      { es: 'Archivo llms.txt', en: 'llms.txt file' },
      { es: 'Sitemap.xml actualizado', en: 'Updated sitemap.xml' },
      { es: 'Cabeceras HTTP orientadas a rastreadores', en: 'Crawler-friendly HTTP headers' },
    ],
    price: {
      amounts: { cop: 400000, usd: 99 },
      prefix: { es: 'desde', en: 'from' },
      period: { es: 'pago único', en: 'one-time' },
    },
    cta: { es: 'Elegir básica', en: 'Choose Basic' },
  },
  {
    id: 'completa',
    name: { es: 'Completa', en: 'Complete' },
    description: {
      es: 'Todo lo anterior más manifiesto de acción y accesibilidad.',
      en: 'Everything above plus action manifest and accessibility.',
    },
    includes: {
      es: 'Incluye todo lo de la Básica, más:',
      en: 'Includes everything in Basic, plus:',
    },
    features: [
      { es: 'Manifiesto ai-agent.json', en: 'ai-agent.json manifest' },
      { es: 'Schema.org Action (reservar, comprar, contactar)', en: 'Schema.org Action (reserve, buy, contact)' },
      { es: 'Revisión de accesibilidad básica', en: 'Basic accessibility review' },
    ],
    price: {
      amounts: { cop: 600000, usd: 149 },
      prefix: { es: 'desde', en: 'from' },
      period: { es: 'pago único', en: 'one-time' },
    },
    cta: { es: 'Elegir completa', en: 'Choose Complete' },
  },
  {
    id: 'mcp',
    name: { es: 'MCP ayudado', en: 'MCP assisted' },
    description: {
      es: 'Implementamos un servidor MCP remoto para que los agentes operen tu negocio.',
      en: 'We implement a remote MCP server so agents can operate your business.',
    },
    includes: {
      es: 'Incluye todo lo de la Completa, más:',
      en: 'Includes everything in Complete, plus:',
    },
    features: [
      { es: 'Hasta 5 tools iniciales (menú, reservas, horarios, contacto, etc.)', en: 'Up to 5 initial tools (menu, bookings, hours, contact, etc.)' },
      { es: 'Deploy en Cloudflare Workers', en: 'Deploy on Cloudflare Workers' },
      { es: 'Documentación para tu equipo', en: 'Documentation for your team' },
    ],
    price: {
      amounts: { cop: 990000, usd: 249 },
      prefix: { es: 'desde', en: 'from' },
      period: { es: 'pago único', en: 'one-time' },
    },
    cta: { es: 'Elegir MCP', en: 'Choose MCP' },
  },
];

export const monitoringPlans: MonitoringPlan[] = [
  {
    id: 'basic',
    name: { es: 'Monitoreo Basic', en: 'Basic Monitoring' },
    description: {
      es: 'Mantén tu puntaje estable sin sorpresas.',
      en: 'Keep your score stable with no surprises.',
    },
    features: [
      { es: 'Re-escaneo mensual', en: 'Monthly re-scan' },
      { es: 'Alertas por email si baja el puntaje', en: 'Email alerts if score drops' },
    ],
    price: {
      amounts: { cop: 119000, usd: 29 },
      prefix: { es: '', en: '' },
      period: { es: '/sitio/mes', en: '/site/month' },
    },
  },
  {
    id: 'full',
    name: { es: 'Monitoreo Full', en: 'Full Monitoring' },
    description: {
      es: 'Visibilidad completa de cómo evoluciona tu readiness.',
      en: 'Full visibility into how your readiness evolves.',
    },
    features: [
      { es: 'Re-escaneo semanal', en: 'Weekly re-scan' },
      { es: 'Histórico de puntaje', en: 'Score history' },
      { es: 'Badge premium', en: 'Premium badge' },
    ],
    price: {
      amounts: { cop: 315000, usd: 79 },
      prefix: { es: '', en: '' },
      period: { es: '/sitio/mes', en: '/site/month' },
    },
  },
];

export const pricingNote: LocalizedText = {
  es: 'Precios de referencia — cotización final según el sitio.',
  en: 'Reference prices — final quote depends on the site.',
};
