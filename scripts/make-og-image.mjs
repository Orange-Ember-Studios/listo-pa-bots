import sharp from 'sharp';

const WIDTH = 1200;
const HEIGHT = 630;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <radialGradient id="vignette" cx="50%" cy="35%" r="60%">
      <stop offset="0%" stop-color="#7c3aed" stop-opacity="0.22" />
      <stop offset="55%" stop-color="#7c3aed" stop-opacity="0.05" />
      <stop offset="100%" stop-color="#0a0a0f" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="fire" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ff5a1f" />
      <stop offset="100%" stop-color="#e8380d" />
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="10" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#0a0a0f" />
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#vignette)" />

  <!-- Decorative soft orbs -->
  <circle cx="900" cy="180" r="220" fill="#ff5a1f" opacity="0.06" />
  <circle cx="300" cy="480" r="180" fill="#e8380d" opacity="0.05" />

  <!-- Wordmark -->
  <text x="50%" y="165" text-anchor="middle" font-family="Nunito, Poppins, system-ui, sans-serif" font-weight="800" font-size="84" letter-spacing="-0.03em">
    <tspan fill="#f2f2f5">Listo</tspan>
    <tspan fill="url(#fire)" filter="url(#glow)"> Pa Bots</tspan>
  </text>

  <!-- Gauge -->
  <g transform="translate(600, 345)">
    <path d="M -180 120 A 180 180 0 0 1 180 120" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="24" stroke-linecap="round" />
    <path d="M -180 120 A 180 180 0 0 1 180 120" fill="none" stroke="url(#fire)" stroke-width="24" stroke-linecap="round" stroke-dasharray="566" stroke-dashoffset="141.5" filter="url(#glow)" />
    <text x="0" y="105" text-anchor="middle" font-family="Nunito, Poppins, system-ui, sans-serif" font-weight="800" font-size="96" fill="#f2f2f5">78</text>
    <text x="62" y="105" text-anchor="start" font-family="Nunito, Poppins, system-ui, sans-serif" font-weight="600" font-size="36" fill="#a1a1aa">/100</text>
  </g>

  <!-- Label -->
  <rect x="50%" y="405" width="236" height="48" rx="24" fill="rgba(52, 211, 153, 0.14)" transform="translate(-118,0)" />
  <text x="50%" y="437" text-anchor="middle" font-family="Nunito, Poppins, system-ui, sans-serif" font-weight="700" font-size="24" fill="#34d399">Listo Pa Bots</text>

  <!-- Subtitle -->
  <text x="50%" y="520" text-anchor="middle" font-family="Nunito, Poppins, system-ui, sans-serif" font-weight="400" font-size="26" fill="#a1a1aa">Escanea si tu sitio está listo para agentes de IA</text>

  <!-- URL -->
  <text x="50%" y="585" text-anchor="middle" font-family="Nunito, Poppins, system-ui, sans-serif" font-weight="600" font-size="20" fill="#ff5a1f">listopabots.orangeember.com</text>
</svg>`;

await sharp(Buffer.from(svg))
  .resize(WIDTH, HEIGHT)
  .png()
  .toFile('public/og-image.png');

console.log('public/og-image.png generado (1200x630)');
