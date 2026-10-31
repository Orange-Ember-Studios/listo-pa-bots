export type CheckState = 'ok' | 'parcial' | 'fallo';

export interface CheckResult {
  id: string;
  estado: CheckState;
  detalle: string;
  evidencia: Record<string, unknown>;
}

export interface ScanInput {
  url: string;
  timeoutMs?: number;
}

export interface ScanOutput {
  url: string;
  fecha: string;
  checks: CheckResult[];
}

export type CheckFn = (ctx: ScanContext) => Promise<CheckResult>;

export interface ScanContext {
  target: URL;
  origin: string;
  home: {
    response: Response;
    html: string;
  };
}

export function normalizeUrl(input: string): URL {
  let trimmed = input.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  return new URL(trimmed);
}
