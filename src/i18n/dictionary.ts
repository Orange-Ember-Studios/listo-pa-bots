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
    viewReport: string;
    copyLink: string;
    copiedLink: string;
    breakdownLabel: string;
    featuresTitle: string;
    featureItems: FeatureItem[];
    footerMadeBy: string;
    footerOpenSource: string;
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
  };
}
