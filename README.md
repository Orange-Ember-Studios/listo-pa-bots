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

## Cómo generar un informe público

```bash
npm run report -- https://tusitio.com
```

Esto ejecuta el escaneo, guarda el snapshot en `public/reports/<id>.json` e imprime la URL local del informe, por ejemplo:

```text
Informe: http://localhost:4321/informe/orangeember.com-2026-10-31T16-09-39
```

La página `/informe/[id]` lee el snapshot desde disco (local) y renderiza el puntaje, la etiqueta y el desglose. En Cloudflare Workers la misma interfaz se conectará a KV sin cambiar la UI.

## Ponderación del puntaje

El puntaje 0-100 es determinista y otorga crédito proporcional por estados `parcial`:

| Check | Peso |
|-------|------|
| robots.txt segmentado | 35 |
| SSR / contenido estático | 25 |
| llms.txt | 15 |
| headers HTTP | 15 |
| sitemap.xml | 10 |

Etiquetas por rango:

- **80-100**: Listo Pa Bots
- **50-79**: A medias
- **0-49**: Invisible Pa Bots

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
