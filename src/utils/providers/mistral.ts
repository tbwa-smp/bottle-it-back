import type { ProviderAdapter, ProviderContext } from "./types";

const SITE_KEY = "mistral";
const PROVIDER = "mistralai";
const ECOLOGITS_MODEL = "mistral-medium-2604";

const RESPONSE_SELECTOR = '[data-testid="text-message-part"]';
const STOP_BUTTON_SELECTOR = 'button[aria-label="Stop generation"]';

const COMPLETION_SETTLE_MS = 500;
const FALLBACK_SETTLE_MS = 1200;
const GENERATION_TIMEOUT_MS = 5 * 60 * 1000;

function getResponseElements(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(RESPONSE_SELECTOR));
}

function getLatestResponseElement(): HTMLElement | null {
  const responses = getResponseElements();
  return responses.at(-1) ?? null;
}

function getResponseText(element: HTMLElement | null): string {
  return element?.innerText?.trim() ?? "";
}

function hasStopButton(): boolean {
  return Boolean(document.querySelector(STOP_BUTTON_SELECTOR));
}

function estimateOutputTokens(text: string): number {
  return Math.max(1, Math.ceil(Array.from(text).length / 4));
}

function getVibeMode(): string {
  const modes = ["Fast", "Think", "Research"];

  for (const mode of modes) {
    const button = document.querySelector<HTMLButtonElement>(`button[aria-label="${mode}"]`);
    if (button) return mode.toLowerCase();
  }

  return "unknown";
}

export function createMistralProvider(context: ProviderContext): ProviderAdapter {
  let active = false;
  let cancelled = false;
  let sawStopButton = false;
  let sawResponseChange = false;

  let startedAt = 0;
  let baselineResponseCount = 0;
  let responseTextAtStart = "";
  let lastObservedText = "";

  let completionTimer: number | null = null;
  let fallbackTimer: number | null = null;
  let timeoutTimer: number | null = null;

  function clearTimer(timer: number | null): void {
    if (timer !== null) window.clearTimeout(timer);
  }

  function clearTimers(): void {
    clearTimer(completionTimer);
    clearTimer(fallbackTimer);
    clearTimer(timeoutTimer);

    completionTimer = null;
    fallbackTimer = null;
    timeoutTimer = null;
  }

  function resetGeneration(): void {
    clearTimers();

    active = false;
    cancelled = false;
    sawStopButton = false;
    sawResponseChange = false;

    startedAt = 0;
    baselineResponseCount = 0;
    responseTextAtStart = "";
    lastObservedText = "";
  }

  function responseHasChanged(): boolean {
    const responses = getResponseElements();
    const latest = responses.at(-1) ?? null;
    const text = getResponseText(latest);

    if (!text) return false;
    if (responses.length > baselineResponseCount) return true;
    if (text !== responseTextAtStart) return true;

    return false;
  }

  function finishGeneration(): void {
    if (!active || cancelled) return;

    const responseElement = getLatestResponseElement();
    const responseText = getResponseText(responseElement);

    if (!responseText || !responseHasChanged()) {
      console.warn("[🍾💧 Bottle It Back] Mistral completion discarded because no new response was found");
      resetGeneration();
      return;
    }

    const completedAt = performance.now();
    const requestLatency = Math.max(0.001, (completedAt - startedAt) / 1000);
    const outputTokenCount = estimateOutputTokens(responseText);
    const mode = getVibeMode();

    console.log("[🍾💧 Bottle It Back] Mistral generation completed", {
      siteKey: SITE_KEY,
      provider: PROVIDER,
      modelName: ECOLOGITS_MODEL,
      mode,
      requestLatency,
      outputTokenCount,
      tokenSource: "estimated",
      responseCharacters: Array.from(responseText).length,
      responseText,
    });

    resetGeneration();

    context.onComplete({
      provider: PROVIDER,
      modelName: ECOLOGITS_MODEL,
      outputTokenCount,
      requestLatency,
      tokenSource: "estimated",
    });
  }

  function scheduleCompletion(): void {
    if (!active || cancelled || completionTimer !== null) return;

    completionTimer = window.setTimeout(() => {
      completionTimer = null;

      if (!active || cancelled) return;

      if (hasStopButton()) {
        sawStopButton = true;
        return;
      }

      finishGeneration();
    }, COMPLETION_SETTLE_MS);
  }

  function scheduleFallbackCompletion(): void {
    if (!active || cancelled) return;

    clearTimer(fallbackTimer);

    fallbackTimer = window.setTimeout(() => {
      fallbackTimer = null;

      if (!active || cancelled || sawStopButton || hasStopButton()) return;
      if (!responseHasChanged()) return;

      const latestText = getResponseText(getLatestResponseElement());
      if (!latestText || latestText !== lastObservedText) return;

      console.log("[🍾💧 Bottle It Back] Mistral completion detected through fallback");
      finishGeneration();
    }, FALLBACK_SETTLE_MS);
  }

  function observeGeneration(): void {
    if (!active) return;

    const stopVisible = hasStopButton();

    if (stopVisible) {
      sawStopButton = true;
      clearTimer(completionTimer);
      completionTimer = null;
    }

    const latestText = getResponseText(getLatestResponseElement());

    if (latestText && responseHasChanged()) {
      if (!sawResponseChange) {
        sawResponseChange = true;

        console.log("[🍾💧 Bottle It Back] Mistral response detected", {
          responseCharacters: Array.from(latestText).length,
        });
      }

      if (latestText !== lastObservedText) {
        lastObservedText = latestText;
        scheduleFallbackCompletion();
      }
    }

    if (sawStopButton && !stopVisible && sawResponseChange) scheduleCompletion();
  }

  function cancelGeneration(): void {
    if (!active) return;

    cancelled = true;

    console.log("[🍾💧 Bottle It Back] Mistral generation cancelled");

    window.setTimeout(() => {
      if (active && cancelled) resetGeneration();
    }, 250);
  }

  function startGeneration(): void {
    if (active) resetGeneration();

    const responses = getResponseElements();
    const latestResponse = responses.at(-1) ?? null;

    active = true;
    cancelled = false;
    sawStopButton = hasStopButton();
    sawResponseChange = false;

    startedAt = performance.now();
    baselineResponseCount = responses.length;
    responseTextAtStart = getResponseText(latestResponse);
    lastObservedText = responseTextAtStart;

    console.log("[🍾💧 Bottle It Back] Mistral generation started", {
      siteKey: SITE_KEY,
      mode: getVibeMode(),
      modelName: ECOLOGITS_MODEL,
      responseTextAtStartLength: Array.from(responseTextAtStart).length,
    });

    timeoutTimer = window.setTimeout(() => {
      if (!active) return;

      console.warn("[🍾💧 Bottle It Back] Mistral generation timed out; discarding");
      resetGeneration();
    }, GENERATION_TIMEOUT_MS);

    window.setTimeout(observeGeneration, 50);
    window.setTimeout(observeGeneration, 150);
    window.setTimeout(observeGeneration, 400);
  }

  function handleDocumentClick(event: MouseEvent): void {
    if (!active || !(event.target instanceof Element)) return;

    const stopButton = event.target.closest(STOP_BUTTON_SELECTOR);
    if (!stopButton) return;

    cancelGeneration();
  }

  document.addEventListener("click", handleDocumentClick, true);

  const observer = new MutationObserver(() => {
    observeGeneration();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["aria-label", "data-testid", "class"],
  });

  function destroy(): void {
    resetGeneration();
    observer.disconnect();
    document.removeEventListener("click", handleDocumentClick, true);

    console.log("[🍾💧 Bottle It Back] Mistral provider destroyed");
  }

  return {
    startGeneration,
    destroy,
  };
}