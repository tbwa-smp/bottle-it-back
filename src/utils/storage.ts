import type { WaterModelSettings } from "./types";

export const STORAGE_KEYS = {
  stats: "aiWaterTracker.stats",
  settings: "aiWaterTracker.settings",
  hasCompletedOnboarding: "aiWaterTracker.hasCompletedOnboarding",
  hasSeenBottleAnimation: "aiWaterTracker.hasSeenBottleAnimation",
  pendingDonation: "aiWaterTracker.pendingDonation",
} as const;

export const DEFAULT_SETTINGS: WaterModelSettings = {
  trackingEnabled: true,
  waterPerVisitMl: 0,
  waterPerPromptMl: 38,
  waterPerActiveMinuteMl: 0,
  activePingIntervalSeconds: 15,
  bottleCapacityMl: 500,
  modelVersion: "v1-static-prompt-500ml",

  usdPerBottle: 0.05,
  donationThresholdBottles: 0,
};