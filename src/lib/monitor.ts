import type { ScanInput, ScanOutput } from '../scanner/types.js';
import { scoreScan } from '../scoring/index.js';
import {
  saveSnapshot as sharedSaveSnapshot,
  getDomainSnapshots as sharedGetDomainSnapshots,
  buildHistory as sharedBuildHistory,
  type ReportKv,
  type SnapshotPoint,
  type HistoryPoint,
} from './reports.js';
import { incrementScanStats } from './rate-limit.js';

export type MonitorFrequency = 'weekly' | 'monthly';
export type MonitorPlan = 'basic' | 'full';

export interface MonitoredDomain {
  frequency: MonitorFrequency;
  plan: MonitorPlan;
  added: string; // ISO 8601
  last_scan?: string; // ISO 8601
}

export interface AlertRecord {
  previous: number;
  score: number;
  delta: number;
  date: string; // ISO 8601
}

export type MonitorKv = ReportKv;
export type { SnapshotPoint, HistoryPoint };

export interface MonitorRunResult {
  domain: string;
  score: number;
  delta?: number;
  snapshot_id: string;
  alert?: boolean;
}

export interface MonitorRunSummary {
  ran: number;
  results: MonitorRunResult[];
}

export function normalizeDomain(input: string): string {
  const trimmed = input.trim().toLowerCase();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    return url.hostname.replace(/^www\./, '');
  } catch {
    throw new Error(`invalid_url: ${input}`);
  }
}

export function monitorKey(domain: string): string {
  return `monitored/${normalizeDomain(domain)}`;
}

export function alertKey(domain: string, date: Date): string {
  const iso = date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `alert/${normalizeDomain(domain)}-${iso}`;
}

export function isMonitorDue(record: MonitoredDomain, now: Date = new Date()): boolean {
  if (!record.last_scan) return true;
  const last = new Date(record.last_scan);
  if (Number.isNaN(last.getTime())) return true;
  const elapsedMs = now.getTime() - last.getTime();
  const thresholdMs = record.frequency === 'monthly'
    ? 30 * 24 * 60 * 60 * 1000
    : 7 * 24 * 60 * 60 * 1000;
  return elapsedMs > thresholdMs;
}

export async function saveSnapshot(
  kv: MonitorKv,
  snapshot: ScanOutput
): Promise<{ id: string; key: string }> {
  return sharedSaveSnapshot(kv, snapshot);
}

export async function listMonitored(
  kv: MonitorKv
): Promise<Array<{ domain: string; record: MonitoredDomain }>> {
  const results: Array<{ domain: string; record: MonitoredDomain }> = [];
  let cursor: string | undefined;
  do {
    const page = await kv.list({ prefix: 'monitored/', limit: 100, cursor });
    for (const key of page.keys) {
      const domain = key.name.slice('monitored/'.length);
      if (!domain) continue;
      const raw = await kv.get(key.name);
      if (!raw) continue;
      try {
        const record = JSON.parse(raw) as MonitoredDomain;
        results.push({ domain, record });
      } catch {
        // skip malformed entries
      }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return results;
}

export async function getDomainSnapshots(
  kv: MonitorKv,
  domain: string,
  limit: number = 12
): Promise<SnapshotPoint[]> {
  return sharedGetDomainSnapshots(kv, domain, limit);
}

export function getPreviousSnapshot(
  currentDate: Date,
  snapshots: SnapshotPoint[]
): SnapshotPoint | undefined {
  const currentTime = currentDate.getTime();
  let previous: SnapshotPoint | undefined;
  for (const point of snapshots) {
    if (point.date.getTime() < currentTime) {
      previous = point;
    }
  }
  return previous;
}

export function buildHistory(snapshots: SnapshotPoint[]): HistoryPoint[] {
  return sharedBuildHistory(snapshots);
}

export interface Emailer {
  sendAlert: (opts: {
    domain: string;
    previous: number;
    score: number;
    delta: number;
    date: Date;
  }) => Promise<void>;
}

export async function runMonitors(
  kv: MonitorKv,
  scanner: (input: ScanInput) => Promise<ScanOutput>,
  emailer?: Emailer,
  now: Date = new Date()
): Promise<MonitorRunSummary> {
  const monitored = await listMonitored(kv);
  const results: MonitorRunResult[] = [];

  for (const { domain, record } of monitored) {
    if (!isMonitorDue(record, now)) continue;

    const url = `https://${domain}`;
    const snapshot = await scanner({ url });
    const scored = scoreScan(snapshot);
    const { id } = await saveSnapshot(kv, snapshot);
    await incrementScanStats(kv);

    const allSnapshots = await getDomainSnapshots(kv, domain);
    const previous = getPreviousSnapshot(new Date(snapshot.date), allSnapshots);
    let delta: number | undefined;
    if (previous) {
      delta = scored.score - previous.score;
      if (delta < 0) {
        const alert: AlertRecord = {
          previous: previous.score,
          score: scored.score,
          delta,
          date: snapshot.date,
        };
        await kv.put(alertKey(domain, new Date(snapshot.date)), JSON.stringify(alert));
        if (emailer) {
          try {
            await emailer.sendAlert({
              domain,
              previous: previous.score,
              score: scored.score,
              delta,
              date: new Date(snapshot.date),
            });
          } catch {
            // degrade gracefully: alert is already in KV
          }
        }
      }
    }

    const updated: MonitoredDomain = {
      ...record,
      last_scan: snapshot.date,
    };
    await kv.put(monitorKey(domain), JSON.stringify(updated));

    results.push({
      domain,
      score: scored.score,
      delta,
      snapshot_id: id,
      alert: delta !== undefined && delta < 0,
    });
  }

  return { ran: results.length, results };
}

export async function addMonitor(
  kv: MonitorKv,
  url: string,
  frequency: MonitorFrequency,
  plan: MonitorPlan = 'basic'
): Promise<{ domain: string }> {
  const domain = normalizeDomain(url);
  const record: MonitoredDomain = {
    frequency,
    plan,
    added: new Date().toISOString(),
  };
  await kv.put(monitorKey(domain), JSON.stringify(record));
  return { domain };
}

export async function removeMonitor(
  kv: MonitorKv,
  url: string
): Promise<{ domain: string; removed: boolean }> {
  const domain = normalizeDomain(url);
  const key = monitorKey(domain);
  const existing = await kv.get(key);
  if (!existing) return { domain, removed: false };
  if (kv.delete) {
    await kv.delete(key);
  } else {
    await kv.put(key, '');
  }
  return { domain, removed: true };
}
