export interface LocalizedText {
  es: string;
  en: string;
}

export interface ImplementationTier {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  includes: LocalizedText;
  features: LocalizedText[];
  price: LocalizedText;
  cta: LocalizedText;
}

export interface MonitoringPlan {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  features: LocalizedText[];
  price: LocalizedText;
}

export const implementationTiers: ImplementationTier[] = [
  {
    id: 'basica',
    name: { es: 'B\u00e1sica', en: 'Basic' },
    description: {
      es: 'Se\u00f1ales claras para agentes de IA sin cambiar tu sitio de fondo.',
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
    price: { es: 'desde US$99 pago \u00fanico', en: 'from US$99 one-time' },
    cta: { es: 'Elegir b\u00e1sica', en: 'Choose Basic' },
  },
  {
    id: 'completa',
    name: { es: 'Completa', en: 'Complete' },
    description: {
      es: 'Todo lo anterior m\u00e1s manifiesto de acci\u00f3n y accesibilidad.',
      en: 'Everything above plus action manifest and accessibility.',
    },
    includes: {
      es: 'Incluye todo lo de la B\u00e1sica, m\u00e1s:',
      en: 'Includes everything in Basic, plus:',
    },
    features: [
      { es: 'Manifiesto ai-agent.json', en: 'ai-agent.json manifest' },
      { es: 'Schema.org Action (reservar, comprar, contactar)', en: 'Schema.org Action (reserve, buy, contact)' },
      { es: 'Revisi\u00f3n de accesibilidad b\u00e1sica', en: 'Basic accessibility review' },
    ],
    price: { es: 'desde US$149 pago \u00fanico', en: 'from US$149 one-time' },
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
      es: 'Incluye todo lo de la Completa, m\u00e1s:',
      en: 'Includes everything in Complete, plus:',
    },
    features: [
      { es: 'Hasta 5 tools iniciales (men\u00fa, reservas, horarios, contacto, etc.)', en: 'Up to 5 initial tools (menu, bookings, hours, contact, etc.)' },
      { es: 'Deploy en Cloudflare Workers', en: 'Deploy on Cloudflare Workers' },
      { es: 'Documentaci\u00f3n para tu equipo', en: 'Documentation for your team' },
    ],
    price: { es: 'desde US$249 pago \u00fanico', en: 'from US$249 one-time' },
    cta: { es: 'Elegir MCP', en: 'Choose MCP' },
  },
];

export const monitoringPlans: MonitoringPlan[] = [
  {
    id: 'basic',
    name: { es: 'Monitoreo Basic', en: 'Basic Monitoring' },
    description: {
      es: 'Mant\u00e9n tu puntaje estable sin sorpresas.',
      en: 'Keep your score stable with no surprises.',
    },
    features: [
      { es: 'Re-escaneo mensual', en: 'Monthly re-scan' },
      { es: 'Alertas por email si baja el puntaje', en: 'Email alerts if score drops' },
    ],
    price: { es: 'US$29/sitio/mes', en: 'US$29/site/month' },
  },
  {
    id: 'full',
    name: { es: 'Monitoreo Full', en: 'Full Monitoring' },
    description: {
      es: 'Visibilidad completa de c\u00f3mo evoluciona tu readiness.',
      en: 'Full visibility into how your readiness evolves.',
    },
    features: [
      { es: 'Re-escaneo semanal', en: 'Weekly re-scan' },
      { es: 'Hist\u00f3rico de puntaje', en: 'Score history' },
      { es: 'Badge premium', en: 'Premium badge' },
    ],
    price: { es: 'US$79/sitio/mes', en: 'US$79/site/month' },
  },
];

export const pricingNote: LocalizedText = {
  es: 'Precios de referencia \u2014 cotizaci\u00f3n final seg\u00fan el sitio.',
  en: 'Reference prices \u2014 final quote depends on the site.',
};
