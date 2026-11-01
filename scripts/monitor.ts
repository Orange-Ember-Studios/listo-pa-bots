import { readFile } from 'node:fs/promises';

const API_BASE = process.env.LISTO_MONITOR_API ?? 'https://listopabots.orangeember.com';
const ENV_PATH = process.env.LISTO_ENV_PATH ?? '/opt/data/.env';

async function loadToken(): Promise<string> {
  const envToken = process.env.LISTO_ADMIN_TOKEN;
  if (envToken) return envToken;

  try {
    const raw = await readFile(ENV_PATH, 'utf8');
    const match = raw.match(/^LISTO_ADMIN_TOKEN=(.+)$/m);
    if (match) return match[1].trim();
  } catch {
    // fall through
  }

  throw new Error(`No se encontró LISTO_ADMIN_TOKEN en ${ENV_PATH} ni en entorno.`);
}

async function api(token: string, body: unknown): Promise<unknown> {
  const response = await fetch(`${API_BASE}/api/monitor`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(parsed)}`);
  }
  return parsed;
}

function usage(): string {
  return `Uso:
  npm run monitor -- add <url> weekly|monthly
  npm run monitor -- remove <url>
  npm run monitor -- list
  npm run monitor -- run
`;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.error(usage());
    process.exit(1);
  }

  const token = await loadToken();

  if (command === 'list') {
    const result = await api(token, { action: 'list' });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'run') {
    const result = await api(token, { action: 'run' });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'add') {
    const url = args[1];
    const frequency = args[2];
    if (!url || (frequency !== 'weekly' && frequency !== 'monthly')) {
      console.error(usage());
      process.exit(1);
    }
    const result = await api(token, { action: 'add', url, frequency });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'remove') {
    const url = args[1];
    if (!url) {
      console.error(usage());
      process.exit(1);
    }
    const result = await api(token, { action: 'remove', url });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.error('Comando desconocido:', command);
  console.error(usage());
  process.exit(1);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
