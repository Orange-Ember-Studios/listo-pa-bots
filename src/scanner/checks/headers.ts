import type { CheckFn } from '../types.js';

export const checkHeaders: CheckFn = async (ctx) => {
  const headers = Object.fromEntries(ctx.home.response.headers.entries());
  const xRobotsTag = ctx.home.response.headers.get('x-robots-tag') ?? undefined;
  const contentType = ctx.home.response.headers.get('content-type') ?? 'no especificado';

  const relevant: Record<string, string | undefined> = {
    'content-type': contentType,
    'x-robots-tag': xRobotsTag,
  };

  const blocking = ['noindex', 'nofollow', 'none', 'noarchive'];
  const isBlocked = xRobotsTag
    ? blocking.some((directive) => xRobotsTag.toLowerCase().includes(directive))
    : false;

  if (isBlocked) {
    return {
      id: 'headers',
      state: 'fallo',
      detail: 'El header x-robots-tag bloquea indexación o rastreo',
      evidence: { headers: relevant, warning: 'x-robots-tag restringe agentes' },
    };
  }

  return {
    id: 'headers',
    state: 'ok',
    detail: 'Headers HTTP relevantes revisados; no hay bloqueos por x-robots-tag',
    evidence: { headers: relevant },
  };
};
