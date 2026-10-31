import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { scoreScan } from '../src/scoring/index.js';
import { generateOgSvg } from '../src/lib/og-image.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function loadFont(): Promise<ArrayBuffer> {
  const fontPath = join(
    __dirname,
    '../node_modules/@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2'
  );
  const buffer = await readFile(fontPath);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

async function main() {
  const files = await readdir('public/reports');
  const jsonFiles = files.filter((f) => f.endsWith('.json'));
  const fontData = await loadFont();

  for (const jsonFile of jsonFiles) {
    const pngFile = jsonFile.replace(/\.json$/, '.png');
    if (files.includes(pngFile)) continue;

    const raw = await readFile(join('public/reports', jsonFile), 'utf-8');
    const snapshot = JSON.parse(raw) as { url: string; date: string; checks: unknown[] };
    const scored = scoreScan(snapshot as Parameters<typeof scoreScan>[0]);
    const domain = new URL(snapshot.url).hostname.replace(/^www\./, '');

    const svg = await generateOgSvg(
      {
        domain,
        score: scored.score,
        label: scored.label,
        date: new Date(snapshot.date).toLocaleDateString('es-CO', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      },
      fontData
    );

    const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
    const png = resvg.render().asPng();
    await writeFile(join('public/reports', pngFile), png);
    console.log(`Generado ${pngFile} (${(png.length / 1024).toFixed(1)} KB)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
