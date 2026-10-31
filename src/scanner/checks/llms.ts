import type { CheckFn } from '../types.js';
import { fetchText } from '../utils.js';

const VARIANTS = [
  '/llms.txt',
  '/LLMs.txt',
  '/.well-known/llms.txt',
  '/llm.txt',
];

export const checkLlms: CheckFn = async (ctx) => {
  const findings: { url: string; status: number; encontrado: boolean; tamano: number }[] = [];

  for (const path of VARIANTS) {
    const url = new URL(path, ctx.origin).toString();
    try {
      const { response, text } = await fetchText(url);
      const status = response.status;
      const encontrado = status === 200 && text.trim().length > 0;
      findings.push({ url, status, encontrado, tamano: encontrado ? text.length : 0 });
    } catch (err) {
      findings.push({ url, status: 0, encontrado: false, tamano: 0, error: (err as Error).message } as unknown as typeof findings[0]);
    }
  }

  const encontrados = findings.filter((f) => f.encontrado);

  if (encontrados.length > 0) {
    return {
      id: 'llms-txt',
      estado: 'ok',
      detalle: `Se encontró llms.txt en ${encontrados.length} ubicación(es)`,
      evidencia: {
        ubicaciones: encontrados.map((f) => f.url),
        variantesProbados: findings,
      },
    };
  }

  return {
    id: 'llms-txt',
    estado: 'fallo',
    detalle: 'No se encontró llms.txt en ninguna ubicación común',
    evidencia: {
      variantesProbados: findings,
    },
  };
};
