/// <reference types="vite/client" />
/// <reference types="chrome" />

import { getSiteByHostname } from './sites';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from './storage';
import type { TrackerMessage, WaterModelSettings } from './types';

const matchedSite = getSiteByHostname(window.location.hostname);

if (!matchedSite) {
  console.debug('AI Water Tracker loaded on unsupported host:', window.location.hostname);
} else {
  
  const site = matchedSite;

  const PROMPT_DEBOUNCE_MS = 1200;

  let lastPromptAt = 0;
  let lastTrackedUrl = '';
  let isWindowFocused = document.hasFocus();
  let activePingIntervalSeconds = DEFAULT_SETTINGS.activePingIntervalSeconds;
  let activePingTimerId: number | null = null;

  function nowIso(): string {
    return new Date().toISOString();
  }

  function currentUrl(): string {
    return window.location.href;
  }

  function send(message: TrackerMessage): void {
    void chrome.runtime.sendMessage(message).catch((error) => {
      console.debug('AI Water Tracker message failed:', error);
    });
  }

  async function loadSettings(): Promise<void> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.settings);
    const settings = {
      ...DEFAULT_SETTINGS,
      ...(result[STORAGE_KEYS.settings] as Partial<WaterModelSettings> | undefined),
    };

    activePingIntervalSeconds = Math.max(5, Math.floor(settings.activePingIntervalSeconds || 15));
    restartActivePingTimer();
  }

  function restartActivePingTimer(): void {
    if (activePingTimerId !== null) {
      window.clearInterval(activePingTimerId);
    }

    activePingTimerId = window.setInterval(trackActivePing, activePingIntervalSeconds * 1000);
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
    const url = currentUrl();
    if (url === lastTrackedUrl) {
      return;
    }

    lastTrackedUrl = url;
    send({
      type: 'PAGE_VISIT',
      siteKey: site.key,
      label: site.label,
      url,
      timestamp: nowIso(),
    });
  }

  function trackPrompt(source: 'enter' | 'click' | 'submit'): void {
    const now = Date.now();
    if (now - lastPromptAt < PROMPT_DEBOUNCE_MS) {
      return;
    }

    lastPromptAt = now;
    send({
      type: 'PROMPT_SUBMIT',
      siteKey: site.key,
      label: site.label,
      url: currentUrl(),
      timestamp: nowIso(),
      source,
    });
  }

  function trackActivePing(): void {
    const isVisible = document.visibilityState === 'visible';
    if (!isVisible || !isWindowFocused) {
      return;
    }

    send({
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
        trackPrompt('enter');
      }
    },
    true,
  );

  document.addEventListener(
    'click',
    (event) => {
      if (looksLikeSendButton(event.target)) {
        trackPrompt('click');
      }
    },
    true,
  );

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes[STORAGE_KEYS.settings]) {
      return;
    }

    const nextSettings = {
      ...DEFAULT_SETTINGS,
      ...(changes[STORAGE_KEYS.settings].newValue as
        | Partial<WaterModelSettings>
        | undefined),
    };

    activePingIntervalSeconds = Math.max(
      5,
      Math.floor(nextSettings.activePingIntervalSeconds || 15),
    );
    restartActivePingTimer();
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

  void loadSettings();
  trackVisit();
}