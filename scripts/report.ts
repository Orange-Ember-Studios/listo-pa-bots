import { mkdir, writeFile } from 'node:fs/promises';
import { scan } from '../src/scanner/index.js';
import { normalizeUrl } from '../src/scanner/types.js';

function makeId(url: URL, date: Date): string {
  const host = url.hostname.replace(/^www\./, '');
  const iso = date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${host}-${iso}`;
}

async function main() {
  const urlArg = process.argv[2];
  if (!urlArg) {
    console.error('Uso: npm run report -- <url>');
    process.exit(1);
  }

  const target = normalizeUrl(urlArg);
  console.log(`Escaneando ${target.toString()}...`);

  const scanResult = await scan({ url: target.toString() });
  const id = makeId(target, new Date(scanResult.date));

  await mkdir('public/reports', { recursive: true });
  const snapshotPath = `public/reports/${id}.json`;
  await writeFile(snapshotPath, JSON.stringify(scanResult, null, 2));

  const reportUrl = `http://localhost:8788/informe/${id}`;

  console.log(`Snapshot guardado: ${snapshotPath}`);
  console.log(`Informe: ${reportUrl}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
