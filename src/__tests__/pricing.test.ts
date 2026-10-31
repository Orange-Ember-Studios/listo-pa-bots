import { describe, expect, it } from 'vitest';
import { currencyByLocale, formatPrice, currencies, implementationTiers, monitoringPlans } from '../data/pricing.js';

describe('pricing', () => {
  it('selects COP for spanish and USD for english', () => {
    expect(currencyByLocale('es')).toBe('cop');
    expect(currencyByLocale('en')).toBe('usd');
  });

  it('formats COP without decimals and USD with suffix', () => {
    const price = implementationTiers[0].price;
    const es = formatPrice(price, 'es');
    const en = formatPrice(price, 'en');
    expect(es).toContain('400.000');
    expect(es).toContain('pago \u00fanico');
    expect(en).toContain('$99');
    expect(en).toContain('USD');
    expect(en).toContain('one-time');
  });

  it('formats monitoring prices with period suffix', () => {
    const basic = monitoringPlans.find((p) => p.id === 'basic')!;
    expect(formatPrice(basic.price, 'es')).toContain('/sitio/mes');
    expect(formatPrice(basic.price, 'en')).toContain('/site/month');
  });

  it('exposes currencies for future expansion', () => {
    expect(currencies.cop.code).toBe('COP');
    expect(currencies.usd.code).toBe('USD');
  });
});
