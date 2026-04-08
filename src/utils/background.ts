// / <reference types="vite/client" />
// / <reference types="chrome" />

import { getSiteDefinition } from './sites';
import type { SiteKey } from './types';
import type {
  ActivePingMessage,
  PageVisitMessage,
  PromptSubmitMessage,
  SiteStats,
  TrackerMessage,
  TrackerStats,
  WaterModelSettings,
} from './types';

import { DEFAULT_SETTINGS, STORAGE_KEYS } from './storage';


console.log('[🍾💧 Bottle It Back] background script loaded');

type BackgroundResponse =
  | { ok: true; stats?: TrackerStats; settings?: WaterModelSettings }
  | { ok: false; error: string };

function createEmptyStats(): TrackerStats {
  return {
    totalVisits: 0,
    totalPrompts: 0,
    totalActiveSeconds: 0,
    totalWaterMl: 0,
    updatedAt: null,
    sites: {},
  };
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

async function getSettings(): Promise<WaterModelSettings> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.settings);
  return {
    ...DEFAULT_SETTINGS,
    ...(result[STORAGE_KEYS.settings] as Partial<WaterModelSettings> | undefined),
  };
}

async function setSettings(settings: WaterModelSettings): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.settings]: settings,
  });
}

async function getStats(): Promise<TrackerStats> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.stats);
  return (result[STORAGE_KEYS.stats] as TrackerStats | undefined) ?? createEmptyStats();
}

async function setStats(stats: TrackerStats): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.stats]: stats,
  });
}

function ensureSiteStats(stats: TrackerStats, siteKey: SiteKey, label: string): SiteStats {
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

function touch(stats: TrackerStats, siteStats: SiteStats, timestamp: string): void {
  stats.updatedAt = timestamp;
  siteStats.lastSeenAt = timestamp;
}

function applyVisit(
  stats: TrackerStats,
  message: PageVisitMessage,
  settings: WaterModelSettings,
): TrackerStats {
  const next = structuredClone(stats);
  const siteStats = ensureSiteStats(next, message.siteKey, message.label);

  siteStats.visits += 1;
  siteStats.waterMl = roundToTwo(siteStats.waterMl + settings.waterPerVisitMl);

  next.totalVisits += 1;
  next.totalWaterMl = roundToTwo(next.totalWaterMl + settings.waterPerVisitMl);
  touch(next, siteStats, message.timestamp);

  return next;
}

function applyPrompt(
  stats: TrackerStats,
  message: PromptSubmitMessage,
  settings: WaterModelSettings,
): TrackerStats {
  const next = structuredClone(stats);
  const siteStats = ensureSiteStats(next, message.siteKey, message.label);

  siteStats.prompts += 1;
  siteStats.waterMl = roundToTwo(siteStats.waterMl + settings.waterPerPromptMl);

  next.totalPrompts += 1;
  next.totalWaterMl = roundToTwo(next.totalWaterMl + settings.waterPerPromptMl);
  touch(next, siteStats, message.timestamp);

  return next;
}

function applyActivePing(
  stats: TrackerStats,
  message: ActivePingMessage,
  settings: WaterModelSettings,
): TrackerStats {
  const next = structuredClone(stats);
  const siteStats = ensureSiteStats(next, message.siteKey, message.label);
  const waterMl = (message.activeSeconds / 60) * settings.waterPerActiveMinuteMl;

  siteStats.activeSeconds += message.activeSeconds;
  siteStats.waterMl = roundToTwo(siteStats.waterMl + waterMl);

  next.totalActiveSeconds += message.activeSeconds;
  next.totalWaterMl = roundToTwo(next.totalWaterMl + waterMl);
  touch(next, siteStats, message.timestamp);

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
        console.log('[🍾💧 Bottle It Back] Received message', message);
        switch (message.type) {
          case 'PAGE_VISIT': {
            const [stats, settings] = await Promise.all([getStats(), getSettings()]);
            const nextStats = applyVisit(stats, message, settings);
            await setStats(nextStats);
            sendResponse({ ok: true, stats: nextStats });
            return;
          }

          case 'PROMPT_SUBMIT': {
            const [stats, settings] = await Promise.all([getStats(), getSettings()]);
            const nextStats = applyPrompt(stats, message, settings);
            await setStats(nextStats);
            sendResponse({ ok: true, stats: nextStats });
            return;
          }

          case 'ACTIVE_PING': {
            const [stats, settings] = await Promise.all([getStats(), getSettings()]);
            const nextStats = applyActivePing(stats, message, settings);
            await setStats(nextStats);
            sendResponse({ ok: true, stats: nextStats });
            return;
          }

          case 'GET_STATS': {
            sendResponse({ ok: true, stats: await getStats() });
            return;
          }

          case 'GET_SETTINGS': {
            sendResponse({ ok: true, settings: await getSettings() });
            return;
          }

          case 'RESET_STATS': {
            const emptyStats = createEmptyStats();
            await setStats(emptyStats);
            sendResponse({ ok: true, stats: emptyStats });
            return;
          }

          case 'UPDATE_SETTINGS': {
            const current = await getSettings();
            const nextSettings: WaterModelSettings = {
              ...current,
              ...message.settings,
            };
            await setSettings(nextSettings);
            sendResponse({ ok: true, settings: nextSettings });
            return;
          }

          default: {
            sendResponse({ ok: false, error: 'Unknown message type.' });
            return;
          }
        }
      } catch (error) {
        const siteLabel =
          'siteKey' in message ? getSiteDefinition(message.siteKey)?.label : undefined;

        console.error('AI Water Tracker background error', {
          error,
          message,
          siteLabel,
        });

        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : 'Unknown background error.',
        });
      }
    })();

    return true;
  },
);