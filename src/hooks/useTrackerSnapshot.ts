import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS, STORAGE_KEYS } from "../utils/storage";
import type { TrackerStats, WaterModelSettings } from "../utils/types";

const EMPTY_STATS: TrackerStats = {
  totalVisits: 0,
  totalPrompts: 0,
  totalActiveSeconds: 0,
  totalWaterMl: 0,
  updatedAt: null,
  sites: {},
  todayMl: 0,
  monthlyMl: 0,
  lastDailyResetDate: null,
  lastMonthlyResetKey: null,
  totalDonatedUsd: 0,
  totalDonatedBottles: 0,
  totalDonationsCount: 0,
  lastDonationAt: null,
  installedAt: null,
  onboardedAt: null,
};

function hasChromeStorage() {
  return typeof chrome !== "undefined" && !!chrome.storage?.local;
}

function normalizeStats(
  partial?: Partial<TrackerStats> | null,
): TrackerStats {
  return {
    ...EMPTY_STATS,
    ...partial,
    sites: partial?.sites ?? {},
    todayMl:
      typeof partial?.todayMl === "number" ? partial.todayMl : EMPTY_STATS.todayMl,
    monthlyMl:
      typeof partial?.monthlyMl === "number"
        ? partial.monthlyMl
        : EMPTY_STATS.monthlyMl,
    totalVisits:
      typeof partial?.totalVisits === "number"
        ? partial.totalVisits
        : EMPTY_STATS.totalVisits,
    totalPrompts:
      typeof partial?.totalPrompts === "number"
        ? partial.totalPrompts
        : EMPTY_STATS.totalPrompts,
    totalActiveSeconds:
      typeof partial?.totalActiveSeconds === "number"
        ? partial.totalActiveSeconds
        : EMPTY_STATS.totalActiveSeconds,
    totalWaterMl:
      typeof partial?.totalWaterMl === "number"
        ? partial.totalWaterMl
        : EMPTY_STATS.totalWaterMl,
    totalDonatedUsd:
      typeof partial?.totalDonatedUsd === "number"
        ? partial.totalDonatedUsd
        : EMPTY_STATS.totalDonatedUsd,
    totalDonatedBottles:
      typeof partial?.totalDonatedBottles === "number"
        ? partial.totalDonatedBottles
        : EMPTY_STATS.totalDonatedBottles,
    totalDonationsCount:
      typeof partial?.totalDonationsCount === "number"
        ? partial.totalDonationsCount
        : EMPTY_STATS.totalDonationsCount,
  };
}

export function useTrackerSnapshot() {
  const [stats, setStats] = useState<TrackerStats>(EMPTY_STATS);
  const [settings, setSettings] = useState<WaterModelSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!hasChromeStorage()) {
        if (!cancelled) setReady(true);
        return;
      }

      try {
        const result = await chrome.storage.local.get([
          STORAGE_KEYS.stats,
          STORAGE_KEYS.settings,
        ]);

        if (cancelled) return;

        setStats(
          normalizeStats(
            result[STORAGE_KEYS.stats] as Partial<TrackerStats> | undefined,
          ),
        );

        setSettings({
          ...DEFAULT_SETTINGS,
          ...(result[STORAGE_KEYS.settings] as
            | Partial<WaterModelSettings>
            | undefined),
        });

        setReady(true);
      } catch (error) {
        console.error("Failed to load tracker snapshot", error);
        if (!cancelled) setReady(true);
      }
    }

    function handleStorageChange(
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) {
      if (areaName !== "local") return;

      if (changes[STORAGE_KEYS.stats]) {
        setStats(
          normalizeStats(
            changes[STORAGE_KEYS.stats].newValue as
              | Partial<TrackerStats>
              | undefined,
          ),
        );
      }

      if (changes[STORAGE_KEYS.settings]) {
        setSettings({
          ...DEFAULT_SETTINGS,
          ...(changes[STORAGE_KEYS.settings].newValue as
            | Partial<WaterModelSettings>
            | undefined),
        });
      }
    }

    void load();
    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  return { stats, settings, ready };
}