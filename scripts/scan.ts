import { scan } from '../src/scanner/index.js';

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error('Uso: npm run scan -- <url>');
    process.exit(1);
  }

  try {
    const result = await scan({ url });
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Error escaneando:', (err as Error).message);
    process.exit(1);
  }
}

main();
