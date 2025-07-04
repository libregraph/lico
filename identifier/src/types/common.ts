// Common type definitions for the identifier app

export interface HelloDetails {
  state: boolean;
  username?: string;
  displayName?: string;
  details: Record<string, unknown>;
}

export interface BrandingInfo {
  bannerLogo?: string;
  signinPageLogoURI?: string;
  locales?: string[];
  [key: string]: unknown;
}

export interface LoginError {
  [key: string]: Error;
}

export interface TranslationFunction {
  (key: string, defaultValue?: string, options?: Record<string, unknown>): string;
}

export interface QueryParams {
  [key: string]: string | string[] | undefined;
}

export interface HistoryObject {
  push: (path: string) => void;
  replace: (path: string) => void;
  location: {
    search: string;
    hash: string;
  };
  action: string;
}