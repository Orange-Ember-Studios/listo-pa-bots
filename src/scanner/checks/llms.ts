import type { CheckFn } from '../types.js';
import { fetchText } from '../utils.js';

const VARIANTS = [
  '/llms.txt',
  '/LLMs.txt',
  '/.well-known/llms.txt',
  '/llm.txt',
];

export const checkLlms: CheckFn = async (ctx) => {
  const findings: { url: string; status: number; found: boolean; size: number }[] = [];

  for (const path of VARIANTS) {
    const url = new URL(path, ctx.origin).toString();
    try {
      const { response, text } = await fetchText(url);
      const status = response.status;
      const found = status === 200 && text.trim().length > 0;
      findings.push({ url, status, found, size: found ? text.length : 0 });
    } catch (err) {
      findings.push({ url, status: 0, found: false, size: 0, error: (err as Error).message } as unknown as typeof findings[0]);
    }
  }

  const foundList = findings.filter((f) => f.found);

  if (foundList.length > 0) {
    return {
      id: 'llms-txt',
      state: 'ok',
      detail: `Se encontró llms.txt en ${foundList.length} ubicación(es)`,
      evidence: {
        locations: foundList.map((f) => f.url),
        variantsTested: findings,
      },
    };
  }

  return {
    id: 'llms-txt',
    state: 'fallo',
    detail: 'No se encontró llms.txt en ninguna ubicación común',
    evidence: {
      variantsTested: findings,
    },
  };
};
