/**
 * Generador de imagen OG para informes de Listo Pa Bots.
 *
 * Produce un PNG 1200x630 con fondo de marca, wordmark, puntaje grande
 * con degradado fuego, dominio y fecha del escaneo.
 */

import satori from 'satori';

export interface OgImageInput {
  domain: string;
  score: number;
  label: string;
  date: string;
}

function brandGradientText(text: string): any {
  return {
    type: 'span',
    props: {
      style: {
        backgroundImage: 'linear-gradient(90deg, #ff5a1f, #e8380d)',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        color: 'transparent',
      },
      children: text,
    },
  };
}

function scoreColor(score: number): string {
  if (score >= 80) return '#34d399';
  if (score >= 50) return '#f5a623';
  return '#f87171';
}

export function generateOgSvg(input: OgImageInput, fontData: ArrayBuffer): Promise<string> {
  const { domain, score, label, date } = input;
  const scoreFill = scoreColor(score);

  return satori(
    {
      type: 'div',
      props: {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0f',
          fontFamily: 'Nunito, sans-serif',
          color: '#ffffff',
          position: 'relative',
          overflow: 'hidden',
        },
        children: [
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                inset: '-50%',
                background: 'radial-gradient(circle at 50% 50%, rgba(120, 58, 180, 0.25), transparent 60%)',
              },
            },
          },
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                top: '40px',
                left: '48px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '28px',
                fontWeight: 800,
                letterSpacing: '-0.02em',
              },
              children: ['Listo Pa ', brandGradientText('Bots')],
            },
          },
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                marginTop: '24px',
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: '156px',
                      fontWeight: 800,
                      lineHeight: 1,
                      letterSpacing: '-0.04em',
                      color: scoreFill,
                      textShadow: `0 0 48px ${scoreFill}55`,
                    },
                    children: String(score),
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: '40px',
                      fontWeight: 700,
                      marginTop: '12px',
                      backgroundImage: 'linear-gradient(90deg, #ff5a1f, #e8380d)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      color: 'transparent',
                    },
                    children: label,
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: '28px',
                      fontWeight: 400,
                      color: '#c9c9d1',
                      marginTop: '28px',
                    },
                    children: domain,
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: '20px',
                      fontWeight: 400,
                      color: '#7a7a85',
                      marginTop: '12px',
                    },
                    children: date,
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: 'Nunito',
          data: fontData,
          weight: 400,
          style: 'normal',
        },
        {
          name: 'Nunito',
          data: fontData,
          weight: 700,
          style: 'normal',
        },
        {
          name: 'Nunito',
          data: fontData,
          weight: 800,
          style: 'normal',
        },
      ],
    }
  );
}
