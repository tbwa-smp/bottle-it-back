import type { SiteDefinition, SiteKey } from './types';

export const AI_SITES = [
  {
    key: 'chatgpt',
    label: 'ChatGPT',
    hostnames: ['chatgpt.com', 'chat.openai.com'],
    matchPatterns: ['https://chatgpt.com/*', 'https://chat.openai.com/*'],
  },
  {
    key: 'gemini',
    label: 'Gemini',
    hostnames: ['gemini.google.com'],
    matchPatterns: ['https://gemini.google.com/*'],
  },
  {
    key: 'claude',
    label: 'Claude',
    hostnames: ['claude.ai'],
    matchPatterns: ['https://claude.ai/*'],
  },
  {
    key: 'mistral',
    label: 'Mistral',
    hostnames: ['mistral.ai'],
    matchPatterns: ['https://chat.mistral.ai/*'],
  },
] as const satisfies readonly SiteDefinition[];

export type SupportedSite = (typeof AI_SITES)[number];

export const CONTENT_SCRIPT_MATCHES = AI_SITES.flatMap((site) => [
  ...site.matchPatterns,
]);

export function getSiteByHostname(hostname: string): SupportedSite | undefined {
  const normalized = hostname.toLowerCase();

  return AI_SITES.find((site) =>
    site.hostnames.some(
      (host) => normalized === host || normalized.endsWith(`.${host}`),
    ),
  );
}

export function getSiteDefinition(siteKey: SiteKey): SupportedSite | undefined {
  return AI_SITES.find((site) => site.key === siteKey);
}