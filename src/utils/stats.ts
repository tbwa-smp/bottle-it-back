import type { TrackerStats, WaterModelSettings } from "./types";

export function getDonationStats(
  stats: TrackerStats,
  settings: WaterModelSettings,
) {
  const bottles =
    settings.bottleCapacityMl > 0
      ? stats.monthlyMl / settings.bottleCapacityMl
      : 0;

  const totalUsd = bottles * settings.usdPerBottle;
  const reachedThreshold = bottles >= settings.donationThresholdBottles;

  return {
    bottles,
    totalUsd,
    reachedThreshold,
  };
}