# Listo Pa Bots

Escaneador gratuito de **agentic-readiness** para sitios web en español.

Te dice con un puntaje 0-100 si los agentes de IA (GPTBot, ClaudeBot, PerplexityBot, etc.) pueden **ver**, **encontrar** y **operar** tu página web.

## Qué hace esta semana

- Motor de escaneo en TypeScript independiente del framework.
- Revisa `robots.txt` segmentado por agente de IA.
- Busca `llms.txt` en ubicaciones comunes.
- Valida `sitemap.xml` y que sus entradas respondan.
- Lee headers HTTP relevantes (`x-robots-tag`, `content-type`).
- Detecta si el home usa SSR/estático o es una app vacía renderizada en cliente.
- Devuelve JSON crudo por check para construir el informe visual después.

## Cómo probar

```bash
npm install
npm run scan -- https://tusitio.com
```

Ejemplo real guardado en [`docs/ejemplo-scan.json`](./docs/ejemplo-scan.json).

## Estructura

```text
src/
  scanner/          # Motor de escaneo
    checks/         # Un archivo por check
    index.ts        # Función scan(url)
  pages/
    api/scan.ts     # Endpoint para Cloudflare Workers
    index.astro     # Landing básica
scripts/scan.ts     # CLI de prueba
```

## Despliegue

El proyecto usa Astro con el adapter de Cloudflare Workers. No se despliega en esta semana; solo se configura el build local:

```bash
npm run build
```

Para publicar después se usará `wrangler deploy` (requiere autenticación).

## Convención de JSON

Todos los JSON del proyecto usan **claves en inglés** y **valores en español**. Esto aplica a la salida del escáner, los tipos TypeScript, la API y cualquier archivo JSON presente o futuro.

- Las claves (nombres de propiedades) siempre están en inglés: `state`, `detail`, `evidence`, `agents`, `rule`, `inherited`, `date`, etc.
- Los valores legibles por humanos se mantienen en español: textos de producto, mensajes, detalles y advertencias.
- Los estados de enumeración (`ok`, `parcial`, `fallo`) son valores y se quedan en español.

## Licencia

MIT
