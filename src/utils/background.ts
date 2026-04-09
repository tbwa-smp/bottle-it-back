/// <reference types="vite/client" />
/// <reference types="chrome" />

import { getSiteDefinition } from "./sites";
import type { SiteKey } from "./types";
import type {
  ActivePingMessage,
  PageVisitMessage,
  PromptSubmitMessage,
  SiteStats,
  TrackerMessage,
  TrackerStats,
  WaterModelSettings,
  PendingDonationState,
} from "./types";

import { DEFAULT_SETTINGS, STORAGE_KEYS } from "./storage";

console.log("[🍾💧 Bottle It Back] background script loaded");

type BackgroundResponse =
  | { ok: true; stats?: TrackerStats; settings?: WaterModelSettings }
  | { ok: false; error: string };

function getCurrentTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

function getCurrentDateKeys() {
  const now = new Date();
  const timeZone = getCurrentTimeZone();

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  const dailyKey = `${year}-${month}-${day}`;
  const monthlyKey = `${year}-${month}`;

  return {
    dailyKey,
    monthlyKey,
  };
}

function createEmptyStats(): TrackerStats {
  const { dailyKey, monthlyKey } = getCurrentDateKeys();

  return {
    todayMl: 0,
    monthlyMl: 0,
    totalVisits: 0,
    totalPrompts: 0,
    totalActiveSeconds: 0,
    totalWaterMl: 0,

    totalDonatedUsd: 0,
    totalDonatedBottles: 0,
    totalDonationsCount: 0,
    lastDonationAt: null,

    updatedAt: null,
    lastDailyResetDate: dailyKey,
    lastMonthlyResetKey: monthlyKey,
    sites: {},
  };
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeSettings(
  partial?: Partial<WaterModelSettings>,
): WaterModelSettings {
  const next: WaterModelSettings = {
    ...DEFAULT_SETTINGS,
    ...partial,
  };

  if (
    !Number.isFinite(next.donationThresholdBottles) ||
    next.donationThresholdBottles <= 0
  ) {
    next.donationThresholdBottles = DEFAULT_SETTINGS.donationThresholdBottles;
  }

  if (!Number.isFinite(next.usdPerBottle) || next.usdPerBottle <= 0) {
    next.usdPerBottle = DEFAULT_SETTINGS.usdPerBottle;
  }

  if (!Number.isFinite(next.bottleCapacityMl) || next.bottleCapacityMl <= 0) {
    next.bottleCapacityMl = DEFAULT_SETTINGS.bottleCapacityMl;
  }

  return next;
}

function normalizeStatsForCurrentPeriod(stats: TrackerStats): TrackerStats {
  const next = structuredClone(stats);
  const { dailyKey, monthlyKey } = getCurrentDateKeys();

  if (next.lastDailyResetDate !== dailyKey) {
    next.todayMl = 0;
    next.lastDailyResetDate = dailyKey;
  }

  if (next.lastMonthlyResetKey !== monthlyKey) {
    next.monthlyMl = 0;
    next.lastMonthlyResetKey = monthlyKey;
  }

  return next;
}

async function getSettings(): Promise<WaterModelSettings> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.settings);
  const settings = normalizeSettings(
    result[STORAGE_KEYS.settings] as Partial<WaterModelSettings> | undefined,
  );

  await setSettings(settings);
  return settings;
}

async function setSettings(settings: WaterModelSettings): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.settings]: settings,
  });
}

async function getStats(): Promise<TrackerStats> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.stats);
  const stored = result[STORAGE_KEYS.stats] as
    | Partial<TrackerStats>
    | undefined;

  const merged: TrackerStats = {
    ...createEmptyStats(),
    ...stored,
    sites: stored?.sites ?? {},
  };

  const normalized = normalizeStatsForCurrentPeriod(merged);

  const didChangePeriodState =
    normalized.todayMl !== merged.todayMl ||
    normalized.monthlyMl !== merged.monthlyMl ||
    normalized.lastDailyResetDate !== merged.lastDailyResetDate ||
    normalized.lastMonthlyResetKey !== merged.lastMonthlyResetKey;

  if (didChangePeriodState) {
    await setStats(normalized);
  }

  return normalized;
}

async function setStats(stats: TrackerStats): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.stats]: stats,
  });
}

function ensureSiteStats(
  stats: TrackerStats,
  siteKey: SiteKey,
  label: string,
): SiteStats {
  const existing = stats.sites[siteKey];
  if (existing) {
    return existing;
  }

  const next: SiteStats = {
    siteKey,
    label,
    visits: 0,
    prompts: 0,
    activeSeconds: 0,
    waterMl: 0,
    lastSeenAt: null,
  };

  stats.sites[siteKey] = next;
  return next;
}

function touch(
  stats: TrackerStats,
  siteStats: SiteStats,
  timestamp: string,
): void {
  stats.updatedAt = timestamp;
  siteStats.lastSeenAt = timestamp;
}

function applyVisit(
  stats: TrackerStats,
  message: PageVisitMessage,
  settings: WaterModelSettings,
): TrackerStats {
  const next = structuredClone(normalizeStatsForCurrentPeriod(stats));
  const siteStats = ensureSiteStats(next, message.siteKey, message.label);
  const waterMl = settings.waterPerVisitMl;

  siteStats.visits += 1;
  siteStats.waterMl = roundToTwo(siteStats.waterMl + waterMl);

  next.totalVisits += 1;
  next.todayMl = roundToTwo(next.todayMl + waterMl);
  next.monthlyMl = roundToTwo(next.monthlyMl + waterMl);
  next.totalWaterMl = roundToTwo(next.totalWaterMl + waterMl);
  touch(next, siteStats, message.timestamp);

  return next;
}

function applyPrompt(
  stats: TrackerStats,
  message: PromptSubmitMessage,
  settings: WaterModelSettings,
): TrackerStats {
  const next = structuredClone(normalizeStatsForCurrentPeriod(stats));
  const siteStats = ensureSiteStats(next, message.siteKey, message.label);
  const waterMl = settings.waterPerPromptMl;

  siteStats.prompts += 1;
  siteStats.waterMl = roundToTwo(siteStats.waterMl + waterMl);

  next.totalPrompts += 1;
  next.todayMl = roundToTwo(next.todayMl + waterMl);
  next.monthlyMl = roundToTwo(next.monthlyMl + waterMl);
  next.totalWaterMl = roundToTwo(next.totalWaterMl + waterMl);
  touch(next, siteStats, message.timestamp);

  return next;
}

function applyActivePing(
  stats: TrackerStats,
  message: ActivePingMessage,
  settings: WaterModelSettings,
): TrackerStats {
  const next = structuredClone(normalizeStatsForCurrentPeriod(stats));
  const siteStats = ensureSiteStats(next, message.siteKey, message.label);
  const waterMl =
    (message.activeSeconds / 60) * settings.waterPerActiveMinuteMl;

  siteStats.activeSeconds += message.activeSeconds;
  siteStats.waterMl = roundToTwo(siteStats.waterMl + waterMl);

  next.totalActiveSeconds += message.activeSeconds;
  next.todayMl = roundToTwo(next.todayMl + waterMl);
  next.monthlyMl = roundToTwo(next.monthlyMl + waterMl);
  next.totalWaterMl = roundToTwo(next.totalWaterMl + waterMl);
  touch(next, siteStats, message.timestamp);

  return next;
}

async function getPendingDonation(): Promise<PendingDonationState | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.pendingDonation);
  return (
    (result[STORAGE_KEYS.pendingDonation] as
      | PendingDonationState
      | undefined) ?? null
  );
}

async function setPendingDonation(
  pendingDonation: PendingDonationState,
): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.pendingDonation]: pendingDonation,
  });
}

async function clearPendingDonation(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.pendingDonation);
}

function applyDonationCompletion(
  stats: TrackerStats,
  pendingDonation: PendingDonationState,
  timestamp: string,
): TrackerStats {
  const next = structuredClone(normalizeStatsForCurrentPeriod(stats));

  next.todayMl = 0;
  next.monthlyMl = 0;

  next.totalDonatedBottles = roundToTwo(
    next.totalDonatedBottles + pendingDonation.bottles,
  );
  next.totalDonatedUsd = roundToTwo(
    next.totalDonatedUsd + pendingDonation.usd,
  );
  next.totalDonationsCount += 1;
  next.lastDonationAt = timestamp;
  next.updatedAt = timestamp;

  return next;
}

async function initializeStorage(): Promise<void> {
  const settings = await getSettings();
  const stats = await getStats();

  await Promise.all([setSettings(settings), setStats(stats)]);
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("[🍾💧 Bottle It Back] onInstalled fired");
  void initializeStorage();
});

chrome.runtime.onStartup.addListener(() => {
  void initializeStorage();
});

chrome.runtime.onMessage.addListener(
  (
    message: TrackerMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: BackgroundResponse) => void,
  ): true => {
    void (async () => {
      try {
        console.log("[🍾💧 Bottle It Back] Received message", message);

        switch (message.type) {
          case "PAGE_VISIT": {
            const [stats, settings] = await Promise.all([
              getStats(),
              getSettings(),
            ]);

            if (!settings.trackingEnabled) {
              sendResponse({ ok: true, stats });
              return;
            }

            const nextStats = applyVisit(stats, message, settings);
            await setStats(nextStats);
            sendResponse({ ok: true, stats: nextStats });
            return;
          }

          case "PROMPT_SUBMIT": {
            const [stats, settings] = await Promise.all([
              getStats(),
              getSettings(),
            ]);

            if (!settings.trackingEnabled) {
              sendResponse({ ok: true, stats });
              return;
            }

            const nextStats = applyPrompt(stats, message, settings);
            await setStats(nextStats);
            sendResponse({ ok: true, stats: nextStats });
            return;
          }

          case "ACTIVE_PING": {
            const [stats, settings] = await Promise.all([
              getStats(),
              getSettings(),
            ]);

            if (!settings.trackingEnabled) {
              sendResponse({ ok: true, stats });
              return;
            }

            const nextStats = applyActivePing(stats, message, settings);
            await setStats(nextStats);
            sendResponse({ ok: true, stats: nextStats });
            return;
          }

          case "GET_STATS": {
            sendResponse({ ok: true, stats: await getStats() });
            return;
          }

          case "GET_SETTINGS": {
            sendResponse({ ok: true, settings: await getSettings() });
            return;
          }

          case "RESET_STATS": {
            const emptyStats = createEmptyStats();
            await setStats(emptyStats);
            sendResponse({ ok: true, stats: emptyStats });
            return;
          }

          case "UPDATE_SETTINGS": {
            const current = await getSettings();
            const nextSettings: WaterModelSettings = {
              ...current,
              ...message.settings,
            };

            await setSettings(nextSettings);
            sendResponse({ ok: true, settings: nextSettings });
            return;
          }

          case "DONATION_STARTED": {
            const pendingDonation: PendingDonationState = {
              bottles: message.bottles,
              usd: message.usd,
              source: message.source,
              startedAt: message.timestamp,
            };

            await setPendingDonation(pendingDonation);
            sendResponse({ ok: true });
            return;
          }

          case "DONATION_COMPLETED": {
            const [stats, pendingDonation] = await Promise.all([
              getStats(),
              getPendingDonation(),
            ]);

            if (!pendingDonation) {
              sendResponse({ ok: true, stats });
              return;
            }

            const nextStats = applyDonationCompletion(stats, pendingDonation, message.timestamp);

            await Promise.all([setStats(nextStats), clearPendingDonation()]);

            sendResponse({ ok: true, stats: nextStats });
            return;
          }

          default: {
            sendResponse({ ok: false, error: "Unknown message type." });
            return;
          }
        }
      } catch (error) {
        const siteLabel =
          "siteKey" in message
            ? getSiteDefinition(message.siteKey)?.label
            : undefined;

        console.error("AI Water Tracker background error", {
          error,
          message,
          siteLabel,
        });

        sendResponse({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Unknown background error.",
        });
      }
    })();

    return true;
  },
);
