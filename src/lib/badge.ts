export interface BadgeKv {
  list: (opts: { prefix: string }) => Promise<{ keys: { name: string }[] }>;
  get: (key: string) => Promise<string | null>;
}

export interface LatestSnapshotResult {
  key: string | null;
  id: string | null;
}

export async function getLatestSnapshotIdForDomain(kv: BadgeKv, domain: string): Promise<LatestSnapshotResult> {
  const listed = await kv.list({ prefix: `informe/${domain}-` });
  if (!listed.keys || listed.keys.length === 0) {
    return { key: null, id: null };
  }

  const sorted = [...listed.keys].sort((a, b) => b.name.localeCompare(a.name));
  const latestKey = sorted[0].name;
  return { key: latestKey, id: latestKey.replace(/^informe\//, '') };
}
