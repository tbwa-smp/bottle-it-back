export const SITE_KEYS = [
  "chatgpt",
  "gemini",
  "claude",
  "perplexity",
  "metaai",
  "grok",
  "copilot",
  "sora",
  "deepseek",
] as const;

export type SiteKey =
  (typeof SITE_KEYS)[number];

export interface SiteDefinition {
  key: SiteKey;
  label: string;
  hostnames: readonly string[];
  matchPatterns: readonly string[];
}

export type PromptSource =
  | "enter"
  | "click"
  | "submit";

/*
 * These are the EcoLogits providers we're
 * implementing directly first.
 *
 * Perplexity and Meta AI remain SiteKeys, but
 * we will not send AI_RESPONSE_COMPLETE for
 * them until we decide how their water usage
 * should be calculated.
 */
export type EcoLogitsProvider =
  | "openai"
  | "google_genai"
  | "anthropic";

export type OutputTokenSource =
  | "provider"
  | "estimated";

export interface WaterModelSettings {
  trackingEnabled: boolean;

  waterPerVisitMl: number;
  waterPerPromptMl: number;
  waterPerActiveMinuteMl: number;

  activePingIntervalSeconds: number;

  bottleCapacityMl: number;
  modelVersion: string;

  usdPerBottle: number;
  donationThresholdBottles: number;
}

export interface SiteStats {
  siteKey: SiteKey;
  label: string;

  visits: number;
  prompts: number;
  activeSeconds: number;

  waterMl: number;

  lastSeenAt: string | null;
}

export interface TrackerStats {
  todayMl: number;
  monthlyMl: number;

  totalVisits: number;
  totalPrompts: number;
  totalActiveSeconds: number;
  totalWaterMl: number;

  totalDonatedUsd: number;
  totalDonatedBottles: number;
  totalDonationsCount: number;

  lastDonationAt: string | null;

  installedAt: string | null;
  onboardedAt: string | null;

  updatedAt: string | null;

  lastDailyResetDate: string | null;
  lastMonthlyResetKey: string | null;

  sites: Partial<
    Record<SiteKey, SiteStats>
  >;
}

export interface MarkOnboardedMessage {
  type: "MARK_ONBOARDED";
  timestamp: string;
}

export interface MessageBase {
  siteKey: SiteKey;
  label: string;
  url: string;
  timestamp: string;
}

export interface PageVisitMessage
  extends MessageBase {
  type: "PAGE_VISIT";
}

export interface PromptSubmitMessage
  extends MessageBase {
  type: "PROMPT_SUBMIT";
  source: PromptSource;
}

export interface ActivePingMessage
  extends MessageBase {
  type: "ACTIVE_PING";
  activeSeconds: number;
}

/*
 * A completed AI generation normalized into
 * the exact information the background worker
 * needs before calling EcoLogits.
 *
 * electricity_mix_zone intentionally does NOT
 * exist here. background.ts / ecologits.ts owns
 * the hard-coded "WOR" value.
 */
export interface AIResponseCompleteMessage
  extends MessageBase {
  type: "AI_RESPONSE_COMPLETE";

  provider: EcoLogitsProvider;

  modelName: string;

  outputTokenCount: number;

  requestLatency: number;

  tokenSource: OutputTokenSource;
}

export interface GetStatsMessage {
  type: "GET_STATS";
}

export interface GetSettingsMessage {
  type: "GET_SETTINGS";
}

export interface ResetStatsMessage {
  type: "RESET_STATS";
}

export interface UpdateSettingsMessage {
  type: "UPDATE_SETTINGS";
  settings: Partial<WaterModelSettings>;
}

export type TrackingEventMessage =
  | PageVisitMessage
  | PromptSubmitMessage
  | ActivePingMessage
  | AIResponseCompleteMessage;

export type CommandMessage =
  | GetStatsMessage
  | GetSettingsMessage
  | ResetStatsMessage
  | UpdateSettingsMessage
  | DonationStartedMessage
  | DonationCompletedMessage
  | MarkOnboardedMessage;

export type TrackerMessage =
  | TrackingEventMessage
  | CommandMessage;

export interface OkStatsResponse {
  ok: true;
  stats: TrackerStats;
}

export interface OkSettingsResponse {
  ok: true;
  settings: WaterModelSettings;
}

export interface OkGenericResponse {
  ok: true;
}

export interface ErrorResponse {
  ok: false;
  error: string;
}

export type TrackerResponse =
  | OkStatsResponse
  | OkSettingsResponse
  | OkGenericResponse
  | ErrorResponse;

export interface PendingDonationState {
  bottles: number;
  usd: number;

  source:
    | "monthly"
    | "usage";

  startedAt: string;
}

export interface DonationStartedMessage {
  type: "DONATION_STARTED";

  bottles: number;
  usd: number;

  source:
    | "monthly"
    | "usage";

  timestamp: string;
}

export interface DonationCompletedMessage {
  type: "DONATION_COMPLETED";

  donationId: string;
  amount: number;
  currency: string;

  url: string;
  timestamp: string;
}