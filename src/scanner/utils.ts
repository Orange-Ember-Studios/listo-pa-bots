export const DEFAULT_TIMEOUT_MS = 10_000;

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  const timer = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Timeout escaneando ${label} después de ${ms}ms`)), ms);
  });
  return Promise.race([promise, timer]);
}

export async function fetchText(url: string, init?: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<{ response: Response; text: string }> {
  const response = await withTimeout(
    fetch(url, {
      redirect: 'follow',
      ...init,
    }),
    timeoutMs,
    url
  );
  const text = await response.text();
  return { response, text };
}

export function absolutify(base: URL, path: string): string {
  try {
    return new URL(path, base).toString();
  } catch {
    return path;
  }
}

export function pickEvidence(obj: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = obj[key];
    }
  }
  return result;
}
