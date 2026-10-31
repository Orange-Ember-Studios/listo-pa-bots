import type { CheckFn, CheckResult, CheckState } from '../types.js';

const APP_SHELL_SELECTORS = [
  /<div[^>]*id=["']root["'][^>]*>\s*<\/div>/i,
  /<div[^>]*id=["']__next["'][^>]*>/i,
  /<div[^>]*id=["']app["'][^>]*>\s*<\/div>/i,
  /<app-root[^>]*>\s*<\/app-root>/i,
  /<div[^>]*id=["']__nuxt["'][^>]*>/i,
];

function countVisibleText(html: string): number {
  // Strip script/style tags and comments, then count non-tag text length.
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length;
}

function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

export const checkRendering: CheckFn = async (ctx) => {
  const html = ctx.home.html;
  const htmlSize = html.length;
  const visibleText = countVisibleText(html);
  const visibleWords = countWords(html.replace(/<[^>]+>/g, ' '));
  const scriptTags = (html.match(/<script/gi) || []).length;
  const appShellDetected = APP_SHELL_SELECTORS.some((re) => re.test(html));

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : html;
  const bodyText = countVisibleText(body);

  let estado: CheckState;
  let detalle: string;

  if (appShellDetected && bodyText < 300) {
    estado = 'fallo';
    detalle = 'El home parece ser una aplicación de cliente: contenedor vacío y poco texto visible';
  } else if (visibleWords < 50 && scriptTags > 5) {
    estado = 'fallo';
    detalle = 'El HTML inicial tiene muy poco contenido y muchos scripts; los agentes probablemente no vean información útil';
  } else if (visibleWords < 150 || bodyText < 500) {
    estado = 'parcial';
    detalle = 'El home tiene algo de contenido estático, pero podría depender del navegador para mostrar información clave';
  } else {
    estado = 'ok';
    detalle = 'El home entrega contenido estático legible sin depender exclusivamente del cliente';
  }

  return {
    id: 'rendering',
    estado,
    detalle,
    evidencia: {
      htmlSizeBytes: htmlSize,
      visibleTextChars: visibleText,
      visibleWords,
      scriptTags,
      appShellDetected,
      bodyTextChars: bodyText,
    },
  };
};
