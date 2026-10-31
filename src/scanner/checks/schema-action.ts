import type { CheckFn, CheckResult, CheckState } from '../types.js';

const ACTION_TYPES = new Set([
  'Action',
  'SearchAction',
  'WatchAction',
  'ReadAction',
  'CheckAction',
  'ReserveAction',
  'OrderAction',
  'BuyAction',
  'AddAction',
  'CommunicateAction',
  'RegisterAction',
  'SubscribeAction',
  'ApplyAction',
  'DonateAction',
  'PayAction',
  'BookAction',
  'UpdateAction',
  'DeleteAction',
  'CreateAction',
  'MoveAction',
  'TransferAction',
  'BorrowAction',
  'ReturnAction',
  'TradeAction',
  'QuoteAction',
  'AcceptAction',
  'RejectAction',
  'AgreeAction',
  'DisagreeAction',
  'DownloadAction',
  'InstallAction',
  'UseAction',
  'ChooseAction',
  'VoteAction',
]);

function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const regex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(regex)) {
    const raw = match[1].trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      blocks.push(parsed);
    } catch {
      // Ignorar bloques mal formados
    }
  }
  return blocks;
}

function collectSchemaTypes(value: unknown, types = new Set<string>()): Set<string> {
  if (value === null || value === undefined) return types;

  if (Array.isArray(value)) {
    for (const item of value) collectSchemaTypes(item, types);
    return types;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record['@type'] === 'string') {
      types.add(record['@type']);
    } else if (Array.isArray(record['@type'])) {
      for (const t of record['@type']) {
        if (typeof t === 'string') types.add(t);
      }
    }
    for (const key of Object.keys(record)) {
      collectSchemaTypes(record[key], types);
    }
  }

  return types;
}

function hasActionType(types: Set<string>): boolean {
  for (const t of types) {
    if (ACTION_TYPES.has(t)) return true;
    if (ACTION_TYPES.has(t.replace(/^schema:/, ''))) return true;
    if (t.toLowerCase().endsWith('action')) return true;
  }
  return false;
}

function hasPotentialAction(blocks: unknown[]): boolean {
  for (const block of blocks) {
    if (typeof block !== 'object' || block === null) continue;
    const record = block as Record<string, unknown>;
    if (record['potentialAction']) return true;
    if (record['action']) return true;
  }
  return false;
}

export const checkSchemaAction: CheckFn = async (ctx) => {
  const blocks = extractJsonLdBlocks(ctx.home.html);
  const types = collectSchemaTypes(blocks);
  const typeList = Array.from(types);
  const hasAction = hasActionType(types) || hasPotentialAction(blocks);

  let state: CheckState;
  let detail: string;

  if (blocks.length === 0) {
    state = 'fallo';
    detail = 'No se encontraron bloques JSON-LD en el home';
  } else if (hasAction) {
    state = 'ok';
    detail = `Se encontró JSON-LD con acción operativa (${typeList.filter((t) => ACTION_TYPES.has(t) || ACTION_TYPES.has(t.replace(/^schema:/, '')) || t.toLowerCase().endsWith('action')).slice(0, 5).join(', ') || 'potentialAction'})`;
  } else {
    state = 'parcial';
    detail = `Se encontró JSON-LD (${typeList.join(', ') || 'sin @type'}) pero sin acción operativa`;
  }

  return {
    id: 'schema-action',
    state,
    detail,
    evidence: {
      jsonLdBlocks: blocks.length,
      schemaTypes: typeList,
      hasPotentialAction: hasPotentialAction(blocks),
      hasAction,
    },
  };
};
