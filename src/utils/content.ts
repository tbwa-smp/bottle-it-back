/// <reference types="vite/client" />
/// <reference types="chrome" />

import { getSiteByHostname } from './sites';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from './storage';
import type { PromptSource, TrackerMessage, WaterModelSettings } from './types';

const matchedSite = getSiteByHostname(window.location.hostname);

if (!matchedSite) {
  console.debug(
    '[🍾💧 Bottle It Back] loaded on unsupported host:',
    window.location.hostname,
  );
} else {
  const site = matchedSite;

  const PROMPT_DEBOUNCE_MS = 1200;

  let lastPromptAt = 0;
  let lastTrackedUrl = '';
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
      console.log('[🍾💧 Bottle It Back] sending', message);
      const response = await chrome.runtime.sendMessage(message);
      console.log('[🍾💧 Bottle It Back] response', response);
    } catch (error) {
      console.error('[🍾💧 Bottle It Back] message failed', error);
    }
  }

  async function loadSettings(): Promise<void> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.settings);

    const settings: WaterModelSettings = {
      ...DEFAULT_SETTINGS,
      ...(result[STORAGE_KEYS.settings] as Partial<WaterModelSettings> | undefined),
    };

    trackingEnabled = settings.trackingEnabled;
    activePingIntervalSeconds = Math.max(
      5,
      Math.floor(settings.activePingIntervalSeconds || 15),
    );

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

  function isInteractivePromptTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const element = target.closest(
      'textarea, input[type="text"], [contenteditable="true"], [role="textbox"]',
    );

    return element instanceof HTMLElement;
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
      type: 'PAGE_VISIT',
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
      console.log('[🍾💧 Bottle It Back] prompt blocked by debounce', source);
      return;
    }

    lastPromptAt = now;

    const message: TrackerMessage = {
      type: 'PROMPT_SUBMIT',
      siteKey: site.key,
      label: site.label,
      url: currentUrl(),
      timestamp: nowIso(),
      source,
    };

    console.log('[🍾💧 Bottle It Back] sending prompt', message);
    void send(message);
  }

  function trackActivePing(): void {
    if (!trackingEnabled) {
      return;
    }

    const isVisible = document.visibilityState === 'visible';

    if (!isVisible || !isWindowFocused) {
      return;
    }

    void send({
      type: 'ACTIVE_PING',
      siteKey: site.key,
      label: site.label,
      url: currentUrl(),
      timestamp: nowIso(),
      activeSeconds: activePingIntervalSeconds,
    });
  }

  function looksLikeSendButton(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const button = target.closest(
      'button, [role="button"], input[type="submit"], input[type="button"]',
    );

    if (!(button instanceof HTMLElement)) {
      return false;
    }

    const label = [
      button.innerText,
      button.getAttribute('aria-label') ?? '',
      button.getAttribute('title') ?? '',
      button.getAttribute('data-testid') ?? '',
    ]
      .join(' ')
      .toLowerCase();

    return /(send|submit|generate|ask|go|run|reply|create)/i.test(label);
  }

  function patchHistoryMethod(methodName: 'pushState' | 'replaceState'): void {
    const original = window.history[methodName];

    window.history[methodName] = function patchedHistoryMethod(
      this: History,
      ...args: Parameters<History['pushState']>
    ) {
      const result = original.apply(this, args);
      window.setTimeout(trackVisit, 50);
      return result;
    };
  }

  document.addEventListener(
    'submit',
    (event) => {
      const submitEvent = event as SubmitEvent;

      if (
        isInteractivePromptTarget(document.activeElement) ||
        looksLikeSendButton(submitEvent.submitter)
      ) {
        console.log('[🍾💧 Bottle It Back] submit prompt candidate', submitEvent.submitter);
        trackPrompt('submit');
      }
    },
    true,
  );

  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Enter' || event.shiftKey || event.isComposing) {
        return;
      }

      if (isInteractivePromptTarget(event.target)) {
        console.log('[🍾💧 Bottle It Back] keydown prompt candidate', event.target);
        trackPrompt('enter');
      }
    },
    true,
  );

  document.addEventListener(
    'click',
    (event) => {
      if (looksLikeSendButton(event.target)) {
        console.log('[🍾💧 Bottle It Back] click prompt candidate', event.target);
        trackPrompt('click');
      }
    },
    true,
  );

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes[STORAGE_KEYS.settings]) {
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

  window.addEventListener('focus', () => {
    isWindowFocused = true;
  });

  window.addEventListener('blur', () => {
    isWindowFocused = false;
  });

  window.addEventListener('popstate', trackVisit);
  patchHistoryMethod('pushState');
  patchHistoryMethod('replaceState');

  void loadSettings().then(() => {
    if (trackingEnabled) {
      trackVisit();
    }
  });
}