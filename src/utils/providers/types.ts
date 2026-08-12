import type {
  EcoLogitsProvider,
  OutputTokenSource,
  SiteKey,
} from '../types';

export interface CompletedGeneration {
  provider: EcoLogitsProvider;
  modelName: string;
  outputTokenCount: number;
  requestLatency: number;
  tokenSource: OutputTokenSource;
}

export interface ProviderContext {
  siteKey: SiteKey;

  onComplete: (
    generation: CompletedGeneration,
  ) => void;
}

export interface ProviderAdapter {
  startGeneration(): void;
  destroy(): void;
}