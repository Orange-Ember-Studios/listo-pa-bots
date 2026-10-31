/**
 * Rate limiting y contadores de escaneo.
 *
 * Usa el binding REPORTS (KV) para guardar:
 * - rate/scan/<ip>/<YYYY-MM-DD-HH>  -> contador de escaneos en la ventana horaria
 * - stats/scan/daily/<YYYY-MM-DD>   -> contador diario de escaneos exitosos
 * - stats/scan/total                -> contador total acumulado de escaneos exitosos
 */

export const SCAN_RATE_LIMIT = {
  maxPerHour: 20,
  windowSeconds: 3600,
} as const;

export interface RateLimitKv {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string, opts?: { expirationTtl?: number }) => Promise<void>;
}

export interface ScanRateLimitResult {
  allowed: boolean;
  retryAfter: number;
  currentCount: number;
}

export function getClientIP(request: Request): string {
  const cf = request.headers.get('cf-connecting-ip');
  if (cf) return cf;
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return 'unknown';
}

export function sanitizeIP(ip: string): string {
  // IPv6 puede llevar ':'; reemplazamos cualquier caracter no seguro para clave KV.
  return ip.replace(/[^a-zA-Z0-9.:-]/g, '_').slice(0, 64);
}

function hourBucket(date: Date = new Date()): string {
  const iso = date.toISOString();
  return iso.slice(0, 13).replace('T', '-');
}

function dayBucket(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function scanRateKey(ip: string, date: Date = new Date()): string {
  return `rate/scan/${sanitizeIP(ip)}/${hourBucket(date)}`;
}

export function scanDailyStatsKey(date: Date = new Date()): string {
  return `stats/scan/daily/${dayBucket(date)}`;
}

export const SCAN_TOTAL_STATS_KEY = 'stats/scan/total';

function secondsUntilNextHour(date: Date = new Date()): number {
  const nextHour = new Date(date);
  nextHour.setUTCMinutes(0, 0, 0);
  nextHour.setUTCHours(nextHour.getUTCHours() + 1);
  return Math.max(1, Math.ceil((nextHour.getTime() - date.getTime()) / 1000));
}

export async function checkScanRateLimit(
  request: Request,
  kv: RateLimitKv
): Promise<ScanRateLimitResult> {
  const ip = getClientIP(request);
  const key = scanRateKey(ip);
  const raw = await kv.get(key);
  const count = raw ? parseInt(raw, 10) : 0;

  if (count >= SCAN_RATE_LIMIT.maxPerHour) {
    return {
      allowed: false,
      retryAfter: secondsUntilNextHour(),
      currentCount: count,
    };
  }

  return {
    allowed: true,
    retryAfter: 0,
    currentCount: count,
  };
}

export async function recordScanAttempt(kv: RateLimitKv, request: Request): Promise<void> {
  const ip = getClientIP(request);
  const key = scanRateKey(ip);
  const raw = await kv.get(key);
  const count = raw ? parseInt(raw, 10) : 0;
  await kv.put(key, String(count + 1), { expirationTtl: SCAN_RATE_LIMIT.windowSeconds });
}

export async function incrementScanStats(kv: RateLimitKv): Promise<void> {
  const dailyKey = scanDailyStatsKey();
  const dailyRaw = await kv.get(dailyKey);
  const dailyCount = dailyRaw ? parseInt(dailyRaw, 10) : 0;
  await kv.put(dailyKey, String(dailyCount + 1), { expirationTtl: 86400 * 2 });

  const totalRaw = await kv.get(SCAN_TOTAL_STATS_KEY);
  const totalCount = totalRaw ? parseInt(totalRaw, 10) : 0;
  await kv.put(SCAN_TOTAL_STATS_KEY, String(totalCount + 1));
}

export async function getScanTotalCount(kv: RateLimitKv): Promise<number> {
  const raw = await kv.get(SCAN_TOTAL_STATS_KEY);
  if (!raw) return 0;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export async function getScanCountFromEnv(): Promise<number> {
  try {
    const mod = (await import('cloudflare:workers')) as { env?: Record<string, unknown> };
    const kv = mod.env?.REPORTS as RateLimitKv | undefined;
    if (!kv?.get) return 0;
    return getScanTotalCount(kv);
  } catch {
    return 0;
  }
}
