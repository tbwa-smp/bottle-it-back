import type { SiteKey } from "../types";
import { createChatGptProvider } from "./chatgpt";
import { createGeminiProvider } from "./gemini";
import { createClaudeProvider } from "./claude";
import { createMistralProvider } from "./mistral";
import type { ProviderAdapter, ProviderContext } from "./types";

export function createProviderAdapter(
  siteKey: SiteKey,
  context: ProviderContext,
): ProviderAdapter | null {
  switch (siteKey) {
    case "chatgpt":
      return createChatGptProvider(context);

    case "gemini":
      return createGeminiProvider(context);

    case "claude":
      return createClaudeProvider(context);

    case "mistral":
      return createMistralProvider(context);

    default:
      return null;
  }
}

export type {
  CompletedGeneration,
  ProviderAdapter,
  ProviderContext,
} from "./types";