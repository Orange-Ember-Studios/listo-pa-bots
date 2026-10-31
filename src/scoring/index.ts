import type { ScanOutput, CheckResult, CheckState } from '../scanner/types.js';

/**
 * Ponderación de los 9 checks de Listo Pa Bots (total 100).
 *
 * | Check                | Peso | ¿Por qué?                                                            |
 * |----------------------|------|----------------------------------------------------------------------|
 * | robots-txt           | 22   | Es la señal más directa de permisos para agentes de IA.             |
 * | rendering            | 18   | Determina si el contenido útil llega sin JavaScript.                 |
 * | ai-manifest          | 10   | Manifiesto explícito de presencia para agentes (/.well-known/...).    |
 * | llms-txt             | 10   | Resumen orientador para modelos de lenguaje.                         |
 * | headers              |  9   | Cabeceras que bloquean o permiten rastreo.                           |
 * | schema-action        |  9   | JSON-LD con acciones operativas (reservar, comprar, contactar).      |
 * | accessibility        |  9   | Heurísticas de accesibilidad que también mejoran comprensión de bots. |
 * | sitemap              |  8   | Mapa de URLs para descubrimiento.                                    |
 * | mcp-operability      |  5   | Capacidad de operar el sitio como MCP (menos común hoy, bonus).     |
 * |----------------------|------|----------------------------------------------------------------------|
 * | Total                | 100  |                                                                      |
 */
export const CHECK_WEIGHTS: Record<string, number> = {
  'robots-txt': 22,
  'rendering': 18,
  'llms-txt': 10,
  'sitemap': 8,
  'headers': 9,
  'ai-manifest': 10,
  'schema-action': 9,
  'accessibility': 9,
  'mcp-operability': 5,
};

export const CHECK_LABELS: Record<string, string> = {
  'robots-txt': 'robots.txt segmentado',
  'rendering': 'SSR / contenido estático',
  'llms-txt': 'llms.txt',
  'sitemap': 'sitemap.xml',
  'headers': 'headers HTTP',
  'ai-manifest': 'ai-agent.json',
  'schema-action': 'schema.org Action',
  'accessibility': 'accesibilidad básica',
  'mcp-operability': 'MCP operable',
};

export interface ScoreBreakdownItem {
  id: string;
  name: string;
  state: CheckState;
  weight: number;
  earned: number;
  max: number;
  detail: string;
}

export interface ScoreResult {
  score: number;
  label: string;
  breakdown: ScoreBreakdownItem[];
  max: number;
}

function factorForState(state: CheckState): number {
  if (state === 'ok') return 1;
  if (state === 'parcial') return 0.5;
  return 0;
}

function labelForScore(score: number): string {
  if (score >= 80) return 'Listo Pa Bots';
  if (score >= 50) return 'A medias';
  return 'Invisible Pa Bots';
}

export function scoreScan(scan: ScanOutput): ScoreResult {
  const breakdown: ScoreBreakdownItem[] = [];
  let raw = 0;

  for (const check of scan.checks) {
    const weight = CHECK_WEIGHTS[check.id] ?? 0;
    const factor = factorForState(check.state);
    const earned = weight * factor;
    raw += earned;
    breakdown.push({
      id: check.id,
      name: CHECK_LABELS[check.id] ?? check.id,
      state: check.state,
      weight,
      earned: Math.round(earned),
      max: weight,
      detail: check.detail,
    });
  }

  const score = Math.max(0, Math.min(100, Math.round(raw)));

  return {
    score,
    label: labelForScore(score),
    breakdown,
    max: 100,
  };
}
