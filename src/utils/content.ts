/// <reference types="vite/client" />
/// <reference types="chrome" />
import { getSiteByHostname } from "./sites";
import { DEFAULT_SETTINGS, STORAGE_KEYS } from "./storage";
import type { PromptSource, TrackerMessage, WaterModelSettings } from "./types";
import { createProviderAdapter } from "./providers";

const matchedSite = getSiteByHostname(window.location.hostname);

if (!matchedSite) {
  console.debug(
    "[🍾💧 Bottle It Back] loaded on unsupported host:",
    window.location.hostname,
  );
} else {
  const site = matchedSite;

  const PROMPT_DEBOUNCE_MS = 1200;
  const GEMINI_ELICITATION_SELECTOR = "elicitations button.elicitation-item";
  const CLAUDE_SEND_BUTTON_SELECTOR = 'button[aria-label="Send message"]';

  let lastPromptAt = 0;
  let lastTrackedUrl = "";
  let isWindowFocused = document.hasFocus();
  let activePingIntervalSeconds = DEFAULT_SETTINGS.activePingIntervalSeconds;
  let activePingTimerId: number | null = null;
  let trackingEnabled = DEFAULT_SETTINGS.trackingEnabled;

  function nowIso(): string {
    return new Date().toISOString();
  }

  function currentUrl(): string {
    return window.location.href;
  }

  function stopActivePingTimer(): void {
    if (activePingTimerId !== null) {
      window.clearInterval(activePingTimerId);

      activePingTimerId = null;
    }
  }

  async function send(message: TrackerMessage): Promise<void> {
    if (!trackingEnabled) {
      return;
    }

    try {
      console.log("[🍾💧 Bottle It Back] sending", message);
      const response = await chrome.runtime.sendMessage(message);
      console.log("[🍾💧 Bottle It Back] response", response);
    } catch (error) {
      console.error("[🍾💧 Bottle It Back] message failed", error);
    }
  }

  const providerAdapter = createProviderAdapter(site.key, {
    siteKey: site.key,

    onComplete: (generation) => {
      void send({
        type: "AI_RESPONSE_COMPLETE",
        siteKey: site.key,
        label: site.label,
        url: currentUrl(),
        timestamp: nowIso(),
        provider: generation.provider,
        modelName: generation.modelName,
        outputTokenCount: generation.outputTokenCount,
        requestLatency: generation.requestLatency,
        tokenSource: generation.tokenSource,
      });
    },
  });

  async function loadSettings(): Promise<void> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.settings);

    const settings: WaterModelSettings = {
      ...DEFAULT_SETTINGS,

      ...(result[STORAGE_KEYS.settings] as
        | Partial<WaterModelSettings>
        | undefined),
    };

    trackingEnabled = settings.trackingEnabled;

    activePingIntervalSeconds = Math.max(5, Math.floor(settings.activePingIntervalSeconds || 15));

    if (trackingEnabled) {
      restartActivePingTimer();
    } else {
      stopActivePingTimer();
    }
  }

  function restartActivePingTimer(): void {
    stopActivePingTimer();

    activePingTimerId = window.setInterval(
      trackActivePing,
      activePingIntervalSeconds * 1000,
    );
  }

  /*
   * We only want actual AI
   * prompt inputs.
   *
   * This prevents login /
   * authentication fields from
   * being confused with prompts.
   */
  function isInteractivePromptTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const element = target.closest<HTMLElement>(
      [
        "textarea",
        'input[type="text"]',
        '[contenteditable="true"]',
        '[role="textbox"]',
      ].join(","),
    );

    if (!element) {
      return false;
    }

    const form = element.closest("form");

    if (form?.querySelector('input[type="password"]')) {
      return false;
    }

    const autocomplete =
      element.getAttribute("autocomplete")?.toLowerCase() ?? "";

    if (
      [
        "username",
        "email",
        "current-password",
        "new-password",
        "one-time-code",
      ].includes(autocomplete)
    ) {
      return false;
    }

    const inputName = element.getAttribute("name")?.toLowerCase() ?? "";

    if (/(?:email|username|password|login|signin)/i.test(inputName)) {
      return false;
    }

    return true;
  }

  function trackVisit(): void {
    if (!trackingEnabled) {
      return;
    }

    const url = currentUrl();

    if (url === lastTrackedUrl) {
      return;
    }

    lastTrackedUrl = url;

    void send({
      type: "PAGE_VISIT",
      siteKey: site.key,
      label: site.label,
      url,
      timestamp: nowIso(),
    });
  }

  function trackPrompt(source: PromptSource): void {
    if (!trackingEnabled) {
      return;
    }

    const now = Date.now();

    if (now - lastPromptAt < PROMPT_DEBOUNCE_MS) {
      console.log("[🍾💧 Bottle It Back] prompt blocked by debounce", source);

      return;
    }

    lastPromptAt = now;

    /*
     * Starting the provider
     * detector does NOT call
     * EcoLogits.
     *
     * It only begins watching
     * this generation.
     */
    providerAdapter?.startGeneration();

    const message: TrackerMessage = {
      type: "PROMPT_SUBMIT",
      siteKey: site.key,
      label: site.label,
      url: currentUrl(),
      timestamp: nowIso(),
      source,
    };

    console.log("[🍾💧 Bottle It Back] sending prompt", message);

    void send(message);
  }

  function trackActivePing(): void {
    if (!trackingEnabled) {
      return;
    }

    const isVisible = document.visibilityState === "visible";

    if (!isVisible || !isWindowFocused) {
      return;
    }

    void send({
      type: "ACTIVE_PING",
      siteKey: site.key,
      label: site.label,
      url: currentUrl(),
      timestamp: nowIso(),
      activeSeconds: activePingIntervalSeconds,
    });
  }

  function getClickableButton(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof HTMLElement)) {
      return null;
    }

    const button = target.closest(
      [
        "button",
        '[role="button"]',
        'input[type="submit"]',
        'input[type="button"]',
      ].join(","),
    );

    if (!(button instanceof HTMLElement)) {
      return null;
    }

    return button;
  }

  function isClaudeSendButton(target: EventTarget | null): boolean {
    if (site.key !== "claude") {
      return false;
    }

    const button = getClickableButton(target);

    if (!button) {
      return false;
    }

    return button.matches(CLAUDE_SEND_BUTTON_SELECTOR);
  }

  function looksLikeSendButton(target: EventTarget | null): boolean {
    const button = getClickableButton(target);

    if (!button) {
      return false;
    }

    /*
     * Claude has a lot of UI
     * buttons whose labels/text
     * contain generic words such
     * as "create".
     *
     * We now know the actual
     * Claude Send button:
     *
     * button[
     *   aria-label="Send message"
     * ]
     *
     * So don't use generic
     * matching for Claude.
     */
    if (site.key === "claude") {
      return button.matches(CLAUDE_SEND_BUTTON_SELECTOR);
    }

    const label = [
      button.innerText,
      button.getAttribute("aria-label") ?? "",
      button.getAttribute("title") ?? "",
      button.getAttribute("data-testid") ?? "",
    ]
      .join(" ")
      .toLowerCase();

    /*
     * Stop / Cancel buttons
     * must never be interpreted
     * as a new prompt.
     */
    if (/\b(stop|cancel)\b/i.test(label)) {
      return false;
    }

    return /(?:send|submit|generate|ask|go|run|reply|create)/i.test(label);
  }

  function isGeminiElicitationPrompt(target: EventTarget | null): boolean {
    if (site.key !== "gemini" || !(target instanceof Element)) {
      return false;
    }

    return Boolean(target.closest(GEMINI_ELICITATION_SELECTOR));
  }

  function patchHistoryMethod(methodName: "pushState" | "replaceState"): void {
    const original = window.history[methodName];

    window.history[methodName] = function patchedHistoryMethod(
      this: History,
      ...args: Parameters<History["pushState"]>
    ) {
      const result = original.apply(this, args);

      window.setTimeout(trackVisit, 50);

      return result;
    };
  }

  document.addEventListener(
    "submit",
    (event) => {
      const submitEvent = event as SubmitEvent;

      if (
        isInteractivePromptTarget(document.activeElement) ||
        looksLikeSendButton(submitEvent.submitter)
      ) {
        console.log(
          "[🍾💧 Bottle It Back] submit prompt candidate",
          submitEvent.submitter,
        );

        trackPrompt("submit");
      }
    },
    true,
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Enter" || event.shiftKey || event.isComposing) {
        return;
      }

      if (isInteractivePromptTarget(event.target)) {
        console.log(
          "[🍾💧 Bottle It Back] keydown prompt candidate",
          event.target,
        );

        trackPrompt("enter");
      }
    },
    true,
  );

  document.addEventListener(
    "click",
    (event) => {
      /*
       * Claude-specific hard
       * guard.
       *
       * Claude clicks are only
       * prompts when the click
       * originated from the
       * confirmed Send button.
       */
      if (site.key === "claude" && !isClaudeSendButton(event.target)) {
        return;
      }

      if (isGeminiElicitationPrompt(event.target)) {
        const button = (event.target as Element).closest<HTMLElement>(
          GEMINI_ELICITATION_SELECTOR,
        );

        const promptText =
          button
            ?.querySelector<HTMLElement>(".elicitation-label")
            ?.innerText.trim() ?? "";

        console.log("[🍾💧 Bottle It Back] Gemini elicitation prompt clicked", {
          promptText,
          button,
        });

        trackPrompt("click");
        return;
      }

      if (looksLikeSendButton(event.target)) {
        console.log(
          "[🍾💧 Bottle It Back] click prompt candidate",
          event.target,
        );

        trackPrompt("click");
      }
    },
    true,
  );

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[STORAGE_KEYS.settings]) {
      return;
    }

    const nextSettings: WaterModelSettings = {
      ...DEFAULT_SETTINGS,

      ...(changes[STORAGE_KEYS.settings].newValue as
        | Partial<WaterModelSettings>
        | undefined),
    };

    trackingEnabled = nextSettings.trackingEnabled;

    activePingIntervalSeconds = Math.max(
      5,
      Math.floor(nextSettings.activePingIntervalSeconds || 15),
    );

    if (trackingEnabled) {
      restartActivePingTimer();

      trackVisit();
    } else {
      stopActivePingTimer();
    }
  });

  window.addEventListener("focus", () => {
    isWindowFocused = true;
  });

  window.addEventListener("blur", () => {
    isWindowFocused = false;
  });

  window.addEventListener("popstate", trackVisit);

  window.addEventListener("beforeunload", () => {
    providerAdapter?.destroy();
  });

  patchHistoryMethod("pushState");

  patchHistoryMethod("replaceState");

  void loadSettings().then(() => {
    if (trackingEnabled) {
      trackVisit();
    }
  });
}
