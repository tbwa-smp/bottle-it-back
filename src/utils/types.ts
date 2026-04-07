export const SITE_KEYS = [
  'chatgpt',
  'gemini',
  'claude',
  'perplexity',
  'metaai',
  'grok',
  'copilot',
  'sora',
  'deepseek',
] as const;

export type SiteKey = (typeof SITE_KEYS)[number];

export interface SiteDefinition {
  key: SiteKey;
  label: string;
  hostnames: readonly string[];
  matchPatterns: readonly string[];
}

export type PromptSource = 'enter' | 'click' | 'submit';

export interface WaterModelSettings {
  waterPerVisitMl: number;
  waterPerPromptMl: number;
  waterPerActiveMinuteMl: number;
  activePingIntervalSeconds: number;
  bottleCapacityMl: number;
  modelVersion: string;
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
  totalVisits: number;
  totalPrompts: number;
  totalActiveSeconds: number;
  totalWaterMl: number;
  updatedAt: string | null;
  sites: Partial<Record<SiteKey, SiteStats>>;
}

export interface MessageBase {
  siteKey: SiteKey;
  label: string;
  url: string;
  timestamp: string;
}

export interface PageVisitMessage extends MessageBase {
  type: 'PAGE_VISIT';
}

export interface PromptSubmitMessage extends MessageBase {
  type: 'PROMPT_SUBMIT';
  source: PromptSource;
}

export interface ActivePingMessage extends MessageBase {
  type: 'ACTIVE_PING';
  activeSeconds: number;
}

export interface GetStatsMessage {
  type: 'GET_STATS';
}

export interface GetSettingsMessage {
  type: 'GET_SETTINGS';
}

export interface ResetStatsMessage {
  type: 'RESET_STATS';
}

export interface UpdateSettingsMessage {
  type: 'UPDATE_SETTINGS';
  settings: Partial<WaterModelSettings>;
}

export type TrackingEventMessage =
  | PageVisitMessage
  | PromptSubmitMessage
  | ActivePingMessage;

export type CommandMessage =
  | GetStatsMessage
  | GetSettingsMessage
  | ResetStatsMessage
  | UpdateSettingsMessage;

export type TrackerMessage = TrackingEventMessage | CommandMessage;

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