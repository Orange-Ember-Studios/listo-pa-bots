import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { scan } from '../src/scanner/index.js';
import { normalizeUrl } from '../src/scanner/types.js';
import { scoreScan } from '../src/scoring/index.js';
import { generateOgSvg } from '../src/lib/og-image.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function makeId(url: URL, date: Date): string {
  const host = url.hostname.replace(/^www\./, '');
  const iso = date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${host}-${iso}`;
}

async function loadFont(): Promise<ArrayBuffer> {
  const fontPath = join(
    __dirname,
    '../node_modules/@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2'
  );
  const buffer = await readFile(fontPath);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
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
  const scored = scoreScan(scanResult);
  const id = makeId(target, new Date(scanResult.date));

  await mkdir('public/reports', { recursive: true });
  const snapshotPath = `public/reports/${id}.json`;
  await writeFile(snapshotPath, JSON.stringify(scanResult, null, 2));

  const fontData = await loadFont();
  const svg = await generateOgSvg(
    {
      domain: target.hostname.replace(/^www\./, ''),
      score: scored.score,
      label: scored.label,
      date: new Date(scanResult.date).toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    },
    fontData
  );

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
  const png = resvg.render().asPng();
  const pngPath = `public/reports/${id}.png`;
  await writeFile(pngPath, png);

  const reportUrl = `http://localhost:4321/informe/${id}`;

  console.log(`Snapshot guardado: ${snapshotPath}`);
  console.log(`PNG OG guardado:   ${pngPath} (${(png.length / 1024).toFixed(1)} KB)`);
  console.log(`Informe: ${reportUrl}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
