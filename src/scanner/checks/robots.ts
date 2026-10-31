import type { CheckFn, CheckResult, CheckState } from '../types.js';
import { fetchText } from '../utils.js';

const AGENTS = [
  'GPTBot',
  'ChatGPT-User',
  'ClaudeBot',
  'PerplexityBot',
  'Google-Extended',
];

interface Rule {
  type: 'allow' | 'disallow';
  path: string;
}

interface AgentGroup {
  agent: string;
  rules: Rule[];
}

export function parseRobots(txt: string): AgentGroup[] {
  const lines = txt.split(/\r?\n/);
  const groups: AgentGroup[] = [];
  let current: AgentGroup | null = null;

  for (const raw of lines) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) {
      current = null;
      continue;
    }
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (key === 'user-agent') {
      const existing = groups.find((g) => g.agent.toLowerCase() === value.toLowerCase());
      if (existing) {
        current = existing;
      } else {
        current = { agent: value, rules: [] };
        groups.push(current);
      }
    } else if (current && (key === 'allow' || key === 'disallow')) {
      current.rules.push({ type: key === 'allow' ? 'allow' : 'disallow', path: value });
    }
  }

  return groups;
}

function ruleSpecificity(path: string): number {
  // More characters in the path pattern = more specific.
  return path.length;
}

function matches(path: string, rulePath: string): boolean {
  if (rulePath === '/' || rulePath === '') return true;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (rulePath.endsWith('/')) {
    return normalized === rulePath || normalized.startsWith(rulePath);
  }
  return normalized === rulePath || normalized.startsWith(`${rulePath}/`);
}

function evaluateAgent(groups: AgentGroup[], agent: string, targetPath: string): { allowed: boolean; matchedRule?: Rule; inherited: boolean } {
  const exact = groups.find((g) => g.agent.toLowerCase() === agent.toLowerCase());
  const wildcard = groups.find((g) => g.agent === '*');
  const rules = exact ? exact.rules : wildcard ? wildcard.rules : [];

  if (rules.length === 0) {
    return { allowed: true, inherited: !exact };
  }

  let matched: Rule | undefined;
  let bestSpecificity = -1;
  let allowed = true;

  for (const rule of rules) {
    if (matches(targetPath, rule.path)) {
      const spec = ruleSpecificity(rule.path);
      if (spec > bestSpecificity) {
        bestSpecificity = spec;
        matched = rule;
        allowed = rule.type === 'allow';
      } else if (spec === bestSpecificity && rule.type === 'allow') {
        // Allow wins ties.
        allowed = true;
        matched = rule;
      }
    }
  }

  if (!matched) {
    return { allowed: true, inherited: !exact };
  }

  return { allowed, matchedRule: matched, inherited: !exact };
}

export const checkRobots: CheckFn = async (ctx) => {
  const robotsUrl = new URL('/robots.txt', ctx.origin).toString();
  let txt: string;
  let status: number;
  try {
    const { response, text } = await fetchText(robotsUrl);
    status = response.status;
    txt = text;
  } catch (err) {
    return {
      id: 'robots-txt',
      estado: 'fallo',
      detalle: 'No se pudo obtener robots.txt',
      evidencia: { url: robotsUrl, error: (err as Error).message },
    };
  }

  if (status !== 200 || !txt.trim()) {
    return {
      id: 'robots-txt',
      estado: 'fallo',
      detalle: status === 200 ? 'robots.txt está vacío' : `robots.txt respondió HTTP ${status}`,
      evidencia: { url: robotsUrl, status },
    };
  }

  const groups = parseRobots(txt);
  const perAgent: Record<string, { estado: CheckState; detalle: string; regla?: string; heredado: boolean }> = {};

  for (const agent of AGENTS) {
    const result = evaluateAgent(groups, agent, ctx.target.pathname || '/');
    if (result.allowed) {
      perAgent[agent] = {
        estado: 'ok',
        detalle: result.matchedRule
          ? `${agent} puede acceder a ${ctx.target.pathname || '/'} (${result.matchedRule.type}:${result.matchedRule.path})`
          : `${agent} no tiene reglas restrictivas`,
        regla: result.matchedRule ? `${result.matchedRule.type}:${result.matchedRule.path}` : undefined,
        heredado: result.inherited,
      };
    } else {
      const isTotal = result.matchedRule?.path === '/' || result.matchedRule?.path === '';
      perAgent[agent] = {
        estado: isTotal ? 'fallo' : 'parcial',
        detalle: `${agent} ${isTotal ? 'está bloqueado totalmente' : 'tiene acceso parcial'} (${result.matchedRule?.type}:${result.matchedRule?.path})`,
        regla: `${result.matchedRule?.type}:${result.matchedRule?.path}`,
        heredado: result.inherited,
      };
    }
  }

  const fallos = Object.values(perAgent).filter((a) => a.estado === 'fallo').length;
  const parciales = Object.values(perAgent).filter((a) => a.estado === 'parcial').length;
  let estado: CheckState;
  let detalle: string;
  if (fallos > 0) {
    estado = 'fallo';
    detalle = `${fallos} agente(s) de IA están bloqueados totalmente`;
  } else if (parciales > 0) {
    estado = 'parcial';
    detalle = `${parciales} agente(s) de IA tienen acceso parcial`;
  } else {
    estado = 'ok';
    detalle = 'Todos los agentes de IA relevantes pueden acceder al sitio';
  }

  return {
    id: 'robots-txt',
    estado,
    detalle,
    evidencia: {
      url: robotsUrl,
      status,
      agentes: perAgent,
      gruposEncontrados: groups.map((g) => g.agent),
      lineas: txt.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#')).length,
    },
  };
};
