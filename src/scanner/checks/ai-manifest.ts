import type { CheckFn, CheckResult, CheckState } from '../types.js';
import { fetchText } from '../utils.js';

const WELL_KNOWN_PATH = '/.well-known/ai-agent.json';
const ROOT_FALLBACK_PATH = '/ai-agent.json';

interface ManifestProbe {
  url: string;
  status: number;
  contentType?: string;
  size: number;
  parseable: boolean;
  keys?: string[];
  error?: string;
}

function looksLikeManifest(obj: unknown): obj is Record<string, unknown> {
  if (typeof obj !== 'object' || obj === null) return false;
  const record = obj as Record<string, unknown>;
  const agentRelatedKeys = ['name', 'description', 'version', 'agent', 'agents', 'capabilities', 'api', 'endpoints', 'tools', 'instructions'];
  return agentRelatedKeys.some((key) => Object.prototype.hasOwnProperty.call(record, key));
}

async function probeManifest(url: string): Promise<ManifestProbe> {
  try {
    const { response, text } = await fetchText(url);
    const contentType = response.headers.get('content-type') ?? undefined;
    const probe: ManifestProbe = {
      url,
      status: response.status,
      contentType,
      size: text.length,
      parseable: false,
    };

    if (response.status !== 200 || !text.trim()) {
      return probe;
    }

    try {
      const parsed = JSON.parse(text);
      probe.parseable = true;
      probe.keys = Object.keys(parsed);
      return probe;
    } catch (err) {
      probe.parseable = false;
      probe.error = (err as Error).message;
      return probe;
    }
  } catch (err) {
    return {
      url,
      status: 0,
      size: 0,
      parseable: false,
      error: (err as Error).message,
    };
  }
}

export const checkAiManifest: CheckFn = async (ctx) => {
  const probes: ManifestProbe[] = [];

  const wellKnown = await probeManifest(new URL(WELL_KNOWN_PATH, ctx.origin).toString());
  probes.push(wellKnown);

  if (wellKnown.status !== 200) {
    const rootFallback = await probeManifest(new URL(ROOT_FALLBACK_PATH, ctx.origin).toString());
    probes.push(rootFallback);
  }

  const valid200 = probes.find((p) => p.status === 200);

  if (!valid200) {
    return {
      id: 'ai-manifest',
      state: 'fallo',
      detail: 'No se encontró ai-agent.json en /.well-known/ ni en raíz',
      evidence: {
        probes,
        checkedLocations: [WELL_KNOWN_PATH, ROOT_FALLBACK_PATH],
      },
    };
  }

  if (!valid200.parseable) {
    return {
      id: 'ai-manifest',
      state: 'parcial',
      detail: `El endpoint respondió HTTP ${valid200.status} pero el contenido no es JSON válido`,
      evidence: {
        probes,
        url: valid200.url,
        status: valid200.status,
        contentType: valid200.contentType,
        size: valid200.size,
      },
    };
  }

  if (!looksLikeManifest(valid200.keys ? Object.fromEntries(valid200.keys.map((k) => [k, true])) : {})) {
    return {
      id: 'ai-manifest',
      state: 'parcial',
      detail: 'El JSON es válido pero no contiene campos mínimos esperados de un manifiesto de agente (name, description, version, agent-related key)',
      evidence: {
        probes,
        url: valid200.url,
        status: valid200.status,
        keys: valid200.keys,
        size: valid200.size,
      },
    };
  }

  return {
    id: 'ai-manifest',
    state: 'ok',
    detail: `Manifiesto de agente encontrado en ${valid200.url}`,
    evidence: {
      probes,
      url: valid200.url,
      status: valid200.status,
      keys: valid200.keys,
      size: valid200.size,
    },
  };
};
