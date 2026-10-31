import type { CheckFn, CheckResult, CheckState } from '../types.js';

function countImgsWithAlt(html: string): { total: number; withAlt: number } {
  const regex = /<img(?:\s[^>]*?)?>/gi;
  let total = 0;
  let withAlt = 0;
  for (const match of html.matchAll(regex)) {
    total++;
    if (/\salt\s*=/i.test(match[0])) {
      withAlt++;
    }
  }
  return { total, withAlt };
}

function detectLandmarks(html: string): string[] {
  const landmarks: string[] = [];
  const tags = ['header', 'nav', 'main', 'aside', 'footer', 'section', 'article'];
  for (const tag of tags) {
    const regex = new RegExp(`<${tag}\\b`, 'i');
    if (regex.test(html)) {
      landmarks.push(`<${tag}>`);
    }
  }
  if (/\srole\s*=\s*["']?(main|navigation|banner|contentinfo|complementary|search)["']?/i.test(html)) {
    landmarks.push('role=main/navigation/banner/contentinfo/complementary/search');
  }
  if (/\saria-label\s*=/i.test(html)) {
    landmarks.push('aria-label');
  }
  if (/\saria-labelledby\s*=/i.test(html)) {
    landmarks.push('aria-labelledby');
  }
  return [...new Set(landmarks)];
}

function countHeadings(html: string): Record<string, number> {
  const counts: Record<string, number> = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 };
  for (const tag of Object.keys(counts)) {
    const regex = new RegExp(`<${tag}\\b`, 'gi');
    counts[tag] = (html.match(regex) || []).length;
  }
  return counts;
}

function hasLangAttribute(html: string): boolean {
  return /<html\s[^>]*?lang\s*=/i.test(html);
}

export const checkAccessibility: CheckFn = async (ctx) => {
  const html = ctx.home.html;
  const lang = hasLangAttribute(html);
  const { total: imgTotal, withAlt: imgWithAlt } = countImgsWithAlt(html);
  const altCoverage = imgTotal === 0 ? 100 : Math.round((imgWithAlt / imgTotal) * 100);
  const landmarks = detectLandmarks(html);
  const headingCounts = countHeadings(html);

  // Puntaje 0-100 propio del check
  let score = 0;
  if (lang) score += 20;
  score += Math.round((altCoverage / 100) * 30);
  const landmarkScore = Math.min(landmarks.length, 5) * 6;
  score += landmarkScore;
  const h1Count = headingCounts.h1 || 0;
  const h2Count = headingCounts.h2 || 0;
  const h3Count = headingCounts.h3 || 0;
  const headingScore = Math.min(h1Count > 0 ? 10 : 0 + Math.min(h2Count, 3) * 3 + Math.min(h3Count, 3) * 2, 20);
  score += headingScore;

  // Asegurar rango 0-100
  score = Math.max(0, Math.min(100, score));

  let state: CheckState;
  let detail: string;
  if (score >= 80) {
    state = 'ok';
    detail = `Accesibilidad básica favorable (${score}/100): lang, alt en imágenes, landmarks y jerarquía de encabezados presentes`;
  } else if (score >= 40) {
    state = 'parcial';
    detail = `Accesibilidad básica parcial (${score}/100); faltan algunos elementos que también ayudan a los agentes de IA`;
  } else {
    state = 'fallo';
    detail = `Accesibilidad básica débil (${score}/100); el home carece de lang, alt o estructura semántica`;
  }

  return {
    id: 'accessibility',
    state,
    detail,
    evidence: {
      lang,
      imgTotal,
      imgWithAlt,
      altCoverage,
      landmarks,
      headingCounts,
      accessibilityScore: score,
    },
  };
};
