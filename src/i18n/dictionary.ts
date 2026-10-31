import type { CheckState } from '../scanner/types.js';

export type Locale = 'es' | 'en';

export const LOCALES: Locale[] = ['es', 'en'];
export const DEFAULT_LOCALE: Locale = 'es';

export interface FeatureItem {
  id: string;
  name: string;
  body: string;
  icon: string[];
}

export interface CheckExplanations {
  'robots-txt': Record<CheckState, string>;
  rendering: Record<CheckState, string>;
  'llms-txt': Record<CheckState, string>;
  sitemap: Record<CheckState, string>;
  headers: Record<CheckState, string>;
  'ai-manifest': Record<CheckState, string>;
  'schema-action': Record<CheckState, string>;
  accessibility: Record<CheckState, string>;
  'mcp-operability': Record<CheckState, string>;
}

export interface PlanOption {
  value: string;
  label: string;
}

export interface Dictionary {
  landing: {
    metaTitle: string;
    metaDescription: string;
    ogLocale: string;
    eyebrow: string;
    h1: string;
    lead: string;
    formLabel: string;
    formPlaceholder: string;
    formSubmit: string;
    scanningTitle: string;
    scanningItems: string[];
    invalidUrlError: string;
    genericError: string;
    resultScoreMax: string;
    resultLabelSubtitleOk: string;
    resultLabelSubtitleParcial: string;
    resultLabelSubtitleFallo: string;
    rateLimitedError: string;
    viewReport: string;
    copyLink: string;
    copiedLink: string;
    breakdownLabel: string;
    featuresTitle: string;
    featureItems: FeatureItem[];
    pricingTitle: string;
    pricingSubtitle: string;
    pricingNote: string;
    pricingCta: string;
    pricingMonitoringTitle: string;
  };
  informe: {
    metaTitle: string;
    metaDescription: string;
    ogLocale: string;
    gaugeAria: string;
    reportDate: string;
    breakdownTitle: string;
    stateOk: string;
    stateParcial: string;
    stateFallo: string;
    checkExplanations: CheckExplanations;
    detailShow: string;
    detailHide: string;
    labelSubtitleOk: string;
    labelSubtitleParcial: string;
    labelSubtitleFallo: string;
    footerGeneratedBy: string;
    footerStudio: string;
    badgeTitle: string;
    badgeCopy: string;
    badgeCopied: string;
  };
  implementation: {
    metaTitle: string;
    metaDescription: string;
    ogLocale: string;
    title: string;
    lead: string;
    howTitle: string;
    steps: string[];
    pricingNote: string;
    pricingCta: string;
    formTitle: string;
    formUrlLabel: string;
    formUrlPlaceholder: string;
    formNameLabel: string;
    formNamePlaceholder: string;
    formEmailLabel: string;
    formEmailPlaceholder: string;
    formPlanLabel: string;
    formPlanOptions: PlanOption[];
    formSubmit: string;
    successTitle: string;
    successPlanLabel: string;
    successResponse: string;
    successCta: string;
  };
  legal: {
    privacyMetaTitle: string;
    privacyMetaDescription: string;
    termsMetaTitle: string;
    termsMetaDescription: string;
    lastUpdated: string;
  };
  common: {
    footerStudio: string;
    footerPrivacy: string;
    footerTerms: string;
    footerImplementation: string;
    footerOpenSource: string;
    footerScanCount: string;
  };
  ui: {
    themeToggleLabel: string;
    themeToggleTitle: string;
    languageLabel: string;
    languageEs: string;
    languageEn: string;
  };
  errors: {
    invalidJson: string;
    missingUrl: string;
    invalidUrl: string;
    scanTimeout: string;
    scanFailed: string;
    reportNotFound: string;
    leadInvalidEmail: string;
    leadRateLimited: string;
    leadHoneypot: string;
    leadGeneric: string;
  };
}
