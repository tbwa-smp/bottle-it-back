import type { SiteDefinition, SiteKey } from './types';

export const AI_SITES = [
  {
    key: 'chatgpt',
    label: 'ChatGPT',
    hostnames: ['chatgpt.com', 'chat.openai.com'],
    matchPatterns: ['https://chatgpt.com/*', 'https://chat.openai.com/*'],
  },
  {
    key: 'sora',
    label: 'Sora',
    hostnames: ['sora.com'],
    matchPatterns: ['https://sora.com/*'],
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
    key: 'perplexity',
    label: 'Perplexity',
    hostnames: ['perplexity.ai', 'www.perplexity.ai'],
    matchPatterns: ['https://perplexity.ai/*', 'https://www.perplexity.ai/*'],
  },
  {
    key: 'metaai',
    label: 'Meta AI',
    hostnames: ['meta.ai', 'www.meta.ai'],
    matchPatterns: ['https://meta.ai/*', 'https://www.meta.ai/*'],
  },
  {
    key: 'grok',
    label: 'Grok',
    hostnames: ['grok.com'],
    matchPatterns: ['https://grok.com/*'],
  },
  {
    key: 'copilot',
    label: 'Copilot',
    hostnames: ['copilot.microsoft.com'],
    matchPatterns: ['https://copilot.microsoft.com/*'],
  },
  {
    key: 'deepseek',
    label: 'DeepSeek',
    hostnames: ['chat.deepseek.com', 'www.deepseek.com', 'deepseek.com'],
    matchPatterns: [
      'https://chat.deepseek.com/*',
      'https://www.deepseek.com/*',
      'https://deepseek.com/*',
    ],
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