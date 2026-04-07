import type { WaterModelSettings } from './types';

export const STORAGE_KEYS = {
  stats: 'aiWaterTracker.stats',
  settings: 'aiWaterTracker.settings',
} as const;

export const DEFAULT_SETTINGS: WaterModelSettings = {
  waterPerVisitMl: 0,
  waterPerPromptMl: 0.38,
  waterPerActiveMinuteMl: 0,
  activePingIntervalSeconds: 15,
  bottleCapacityMl: 500,
  modelVersion: 'v1-static-prompt-500ml',
};