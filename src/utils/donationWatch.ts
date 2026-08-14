/// <reference types="vite/client" />
/// <reference types="chrome" />

import { DEFAULT_SETTINGS, STORAGE_KEYS } from "./storage";

import type {
  PendingDonationState,
  TrackerStats,
  WaterModelSettings,
} from "./types";

const MINIMUM_DONATION_USD = 1;

const DONORBOX_HOSTNAME = "donorbox.org";
const DONORBOX_PATHNAME = "/bottle-it-back";

const DONATION_WIDGET_SELECTOR = "#donation_section > article.donation-widget";
const STEP_ONE_SELECTOR = "#donor-form-step-1";
const STANDARD_DONATION_SECTION_SELECTOR = "#standard-donation-section";
const CUSTOM_AMOUNT_SELECTOR = "#donation_custom_amount";
const FOOTER_BUTTON_SELECTOR = "#footer_button";

const SUMMARY_ID = "bib-donation-summary";
const STYLE_ID = "bib-donation-watch-styles";
const STEP_ONE_CLASS = "bib-offset-step";

const DONATION_SUCCESS_MARKER_SELECTOR =
  "#bottle-it-back-donation-completed[data-bib-donation-completed='true']";

type DonationDisplayState = {
  usd: number;
  bottles: number;
  minimumUsd: number;
  minimumBottles: number;
  usdPerBottle: number;
  source: "pending" | "stats" | "empty";
};

let currentDisplayState: DonationDisplayState = {
  usd: 0,
  bottles: 0,
  minimumUsd: MINIMUM_DONATION_USD,
  minimumBottles: 0,
  usdPerBottle: 0,
  source: "empty",
};

let hasReportedSuccess = false;
let syncScheduled = false;
let syncing = false;
let lastLoggedSignature = "";
let isForwardingDonorboxClick = false;

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function ceilMoney(value: number): number {
  return Math.ceil((value - Number.EPSILON) * 100) / 100;
}

function getDonationUsd(calculatedUsd: number): number {
  if (!Number.isFinite(calculatedUsd)) {
    return MINIMUM_DONATION_USD;
  }

  return Math.max(MINIMUM_DONATION_USD, roundMoney(calculatedUsd));
}

function getMinimumDonationUsd(owedUsd: number): number {
  if (!Number.isFinite(owedUsd) || owedUsd <= 0) {
    return MINIMUM_DONATION_USD;
  }

  /*
   * Always round UP to the nearest cent.
   *
   * This prevents an actual amount owed such as
   * $2.354 from being reduced to $2.35.
   */
  return Math.max(MINIMUM_DONATION_USD, ceilMoney(owedUsd));
}

function getBottlesFromUsd(
  usd: number,
  usdPerBottle: number,
  fallback = 0,
): number {
  if (!Number.isFinite(usdPerBottle) || usdPerBottle <= 0) {
    return Math.max(0, fallback);
  }

  return Number((usd / usdPerBottle).toFixed(2));
}

function isDonorboxPage(): boolean {
  const hostname = window.location.hostname.toLowerCase();
  const pathname = window.location.pathname.toLowerCase();

  return (
    (hostname === DONORBOX_HOSTNAME ||
      hostname.endsWith(`.${DONORBOX_HOSTNAME}`)) &&
    pathname.startsWith(DONORBOX_PATHNAME)
  );
}

function getDonationWidget(): HTMLElement | null {
  return document.querySelector<HTMLElement>(DONATION_WIDGET_SELECTOR);
}

function getStepOne(): HTMLElement | null {
  return document.querySelector<HTMLElement>(STEP_ONE_SELECTOR);
}

function getCustomAmountInput(): HTMLInputElement | null {
  return document.querySelector<HTMLInputElement>(CUSTOM_AMOUNT_SELECTOR);
}

function getFooterButton(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>(FOOTER_BUTTON_SELECTOR);
}

function getFooterNextElement(): HTMLElement | null {
  return document.querySelector<HTMLElement>(`${FOOTER_BUTTON_SELECTOR} .next`);
}

function getStepOneHeaderLabel(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `${DONATION_WIDGET_SELECTOR} .tabs-header .display-amount .step-1`,
  );
}

function isStepOneActive(): boolean {
  return Boolean(getStepOne()?.classList.contains("active"));
}

function formatBottles(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Number(Math.max(0, value).toFixed(2)).toString();
}

function normalizePositiveNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

async function getDonationDisplayState(): Promise<DonationDisplayState> {
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.pendingDonation,
    STORAGE_KEYS.stats,
    STORAGE_KEYS.settings,
  ]);

  const pending = result[STORAGE_KEYS.pendingDonation] as
    | PendingDonationState
    | undefined;

  const stats = result[STORAGE_KEYS.stats] as Partial<TrackerStats> | undefined;

  const settings: WaterModelSettings = {
    ...DEFAULT_SETTINGS,
    ...(result[STORAGE_KEYS.settings] as
      | Partial<WaterModelSettings>
      | undefined),
  };

  const todayMl = normalizePositiveNumber(stats?.todayMl);
  const monthlyMl = normalizePositiveNumber(stats?.monthlyMl);
  const bottleCapacityMl = normalizePositiveNumber(settings.bottleCapacityMl);
  const usdPerBottle = normalizePositiveNumber(settings.usdPerBottle);

  /*
   * Determine the amount the user ACTUALLY owes.
   *
   * Monthly donation:
   * monthlyMl -> bottles -> USD
   *
   * Usage donation:
   * todayMl -> bottles -> USD
   */
  let trackedMl = todayMl;

  if (pending?.source === "monthly") {
    trackedMl = monthlyMl;
  }

  const owedBottles =
    bottleCapacityMl > 0 ? trackedMl / bottleCapacityMl : 0;

  let owedUsd = owedBottles * usdPerBottle;

  /*
   * If the usage stats changed or rolled over while
   * a donation is still pending, preserve the pending
   * donation as the fallback minimum.
   */
  if (
    owedUsd <= 0 &&
    pending &&
    typeof pending.usd === "number" &&
    Number.isFinite(pending.usd)
  ) {
    owedUsd = pending.usd;
  }

  const minimumUsd = getMinimumDonationUsd(owedUsd);

  const minimumBottles = getBottlesFromUsd(
    minimumUsd,
    usdPerBottle,
    owedBottles,
  );

  if (
    pending &&
    typeof pending.usd === "number" &&
    Number.isFinite(pending.usd) &&
    pending.usd > 0
  ) {
    const selectedUsd = Math.max(
      minimumUsd,
      getDonationUsd(pending.usd),
    );

    return {
      usd: selectedUsd,
      bottles: getBottlesFromUsd(
        selectedUsd,
        usdPerBottle,
        pending.bottles,
      ),
      minimumUsd,
      minimumBottles,
      usdPerBottle,
      source: "pending",
    };
  }

  if (trackedMl > 0 && bottleCapacityMl > 0) {
    return {
      usd: minimumUsd,
      bottles: minimumBottles,
      minimumUsd,
      minimumBottles,
      usdPerBottle,
      source: "stats",
    };
  }

  return {
    usd: 0,
    bottles: 0,
    minimumUsd: MINIMUM_DONATION_USD,
    minimumBottles: getBottlesFromUsd(
      MINIMUM_DONATION_USD,
      usdPerBottle,
      0,
    ),
    usdPerBottle,
    source: "empty",
  };
}

function setNativeInputValue(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  );

  const setter = descriptor?.set;

  input.focus();

  if (setter) {
    setter.call(input, value);
  } else {
    input.value = value;
  }

  input.setAttribute("value", value);

  input.dispatchEvent(
    new Event("input", {
      bubbles: true,
    }),
  );

  input.dispatchEvent(
    new Event("change", {
      bubbles: true,
    }),
  );

  input.blur();
}

function applyAmountToDonorbox(usd: number): boolean {
  const input = getCustomAmountInput();

  if (!input) {
    console.warn("[🍾💧 Bottle It Back] #donation_custom_amount not found");
    return false;
  }

  if (!Number.isFinite(usd) || usd < MINIMUM_DONATION_USD) {
    console.warn(
      "[🍾💧 Bottle It Back] donation amount is below Donorbox minimum",
      usd,
    );

    return false;
  }

  const formatted = usd.toFixed(2);

  setNativeInputValue(input, formatted);

  console.log(
    "[🍾💧 Bottle It Back] applied real Donorbox amount",
    formatted,
  );

  return true;
}

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");

  style.id = STYLE_ID;

  style.textContent = `
    ${STEP_ONE_SELECTOR}.${STEP_ONE_CLASS}
      ${STANDARD_DONATION_SECTION_SELECTOR} {
      display: none !important;
    }

    #${SUMMARY_ID} {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
      box-sizing: border-box;
      padding: 42px 24px 34px;

      font-family:
        "Montserrat",
        Arial,
        sans-serif;

      text-align: center;
    }

    #${SUMMARY_ID} .bib-total-label {
      width: 100%;
      margin: 0 0 10px !important;

      color: #4777a5 !important;

      font-family:
        "Montserrat",
        Arial,
        sans-serif !important;

      font-size: 31px !important;
      font-weight: 800 !important;
      line-height: 1 !important;

      text-align: left;
      text-transform: uppercase;
    }

    #${SUMMARY_ID} .bib-total-box {
      display: inline-flex;
      align-items: flex-end;
      justify-content: center;

      gap: 8px;

      width: 100%;
      min-height: 112px;

      padding: 14px 16px 18px;

      box-sizing: border-box;

      border:
        5px solid
        rgba(
          255,
          255,
          255,
          0.30
        );

      border-radius: 22px;

      background:
        rgba(
          255,
          255,
          255,
          0.10
        );

      box-shadow:
        inset
        0
        2px
        8px
        rgba(
          255,
          255,
          255,
          0.18
        ),
        0
        5px
        12px
        rgba(
          62,
          104,
          150,
          0.08
        );
    }

    #${SUMMARY_ID} .bib-total-value {
      width: min(100%, 260px);

      padding: 0;

      border: 0;
      outline: 0;

      background: transparent;

      color: #4777a5;

      font-family:
        "Montserrat",
        Arial,
        sans-serif;

      font-size: 72px;
      font-weight: 800;
      line-height: 0.9;
      letter-spacing: -3px;

      text-align: right;

      appearance: textfield;
      -moz-appearance: textfield;
    }

    #${SUMMARY_ID} .bib-total-value::-webkit-outer-spin-button,
    #${SUMMARY_ID} .bib-total-value::-webkit-inner-spin-button {
      margin: 0;
      -webkit-appearance: none;
    }

    #${SUMMARY_ID} .bib-total-value:focus {
      outline: none;
    }

    #${SUMMARY_ID} .bib-total-value:invalid {
      text-decoration: underline;
      text-decoration-style: dotted;
      text-underline-offset: 8px;
    }

    #${SUMMARY_ID} .bib-total-currency {
      padding-bottom: 7px;

      color: #4777a5;

      font-size: 27px;
      font-weight: 800;
      line-height: 1;
    }

    #${SUMMARY_ID} .bib-total-bottles {
      margin: 18px 0 0 !important;

      color: #4777a5 !important;

      font-family:
        "Montserrat",
        Arial,
        sans-serif !important;

      font-size: 32px !important;
      font-weight: 800 !important;
      line-height: 1 !important;

      text-transform: uppercase;
    }

    @media (max-width: 480px) {
      #${SUMMARY_ID} {
        padding: 34px 20px 28px;
      }

      #${SUMMARY_ID} .bib-total-label {
        font-size: 28px !important;
      }

      #${SUMMARY_ID} .bib-total-value {
        width: min(100%, 220px);
        font-size: 62px;
      }

      #${SUMMARY_ID} .bib-total-currency {
        font-size: 23px;
      }

      #${SUMMARY_ID} .bib-total-bottles {
        font-size: 27px !important;
      }
    }
  `;

  document.head.appendChild(style);

  console.log(
    "[🍾💧 Bottle It Back] custom Donorbox Step 1 styles injected",
  );
}

function createSummary(): HTMLElement {
  const summary = document.createElement("div");

  summary.id = SUMMARY_ID;

  summary.innerHTML = `
    <p class="bib-total-label">
      TOTAL
    </p>

    <div class="bib-total-box">
      <input
        class="bib-total-value"
        type="number"
        inputmode="decimal"
        step="0.01"
        min="1.00"
        value="1.00"
        aria-label="Donation total in USD"
      />

      <span class="bib-total-currency">
        USD
      </span>
    </div>

    <p class="bib-total-bottles">
      0 BOTTLE/S
    </p>
  `;

  return summary;
}

function ensureSummary(): HTMLElement | null {
  const stepOne = getStepOne();

  if (!stepOne) return null;

  stepOne.classList.add(STEP_ONE_CLASS);

  let summary = document.getElementById(SUMMARY_ID);

  if (!summary) {
    summary = createSummary();
    stepOne.appendChild(summary);

    console.log("[🍾💧 Bottle It Back] donation summary injected");
  }

  return summary;
}

function setTextIfDifferent(
  element: HTMLElement | null,
  value: string,
): void {
  if (element && element.textContent !== value) {
    element.textContent = value;
  }
}

function getEditableAmountInput(
  summary: HTMLElement,
): HTMLInputElement | null {
  return summary.querySelector<HTMLInputElement>(".bib-total-value");
}

function updateBottleDisplay(summary: HTMLElement, bottles: number): void {
  const bottlesElement =
    summary.querySelector<HTMLElement>(".bib-total-bottles");

  setTextIfDifferent(
    bottlesElement,
    `${formatBottles(bottles)} BOTTLE/S`,
  );
}

function updateSummaryValues(
  summary: HTMLElement,
  state: DonationDisplayState,
): void {
  const amountInput = getEditableAmountInput(summary);

  if (amountInput) {
    amountInput.min = state.minimumUsd.toFixed(2);
    amountInput.dataset.minimumUsd = state.minimumUsd.toFixed(2);

    /*
     * Don't overwrite the field while
     * the user is currently typing.
     */
    if (document.activeElement !== amountInput) {
      const desiredValue = state.usd.toFixed(2);

      if (amountInput.value !== desiredValue) {
        amountInput.value = desiredValue;
      }
    }
  }

  updateBottleDisplay(summary, state.bottles);
}

function normalizeEditableDonationUsd(value: number): number {
  if (!Number.isFinite(value)) {
    return currentDisplayState.minimumUsd;
  }

  return Math.max(
    currentDisplayState.minimumUsd,
    getDonationUsd(value),
  );
}

async function persistPendingDonationAmount(
  usd: number,
  bottles: number,
): Promise<void> {
  try {
    const result = await chrome.storage.local.get(
      STORAGE_KEYS.pendingDonation,
    );

    const pending = result[STORAGE_KEYS.pendingDonation] as
      | PendingDonationState
      | undefined;

    if (!pending) return;

    const nextPending: PendingDonationState = {
      ...pending,
      usd: roundMoney(usd),
      bottles: Number(bottles.toFixed(2)),
    };

    await chrome.storage.local.set({
      [STORAGE_KEYS.pendingDonation]: nextPending,
    });

    console.log(
      "[🍾💧 Bottle It Back] pending donation amount updated",
      nextPending,
    );
  } catch (error) {
    console.error(
      "[🍾💧 Bottle It Back] failed to update pending donation amount",
      error,
    );
  }
}

async function commitEditableAmount(
  input: HTMLInputElement,
  summary: HTMLElement,
): Promise<void> {
  const parsed = Number(input.value);

  const normalizedUsd = normalizeEditableDonationUsd(parsed);

  const bottles = getBottlesFromUsd(
    normalizedUsd,
    currentDisplayState.usdPerBottle,
    currentDisplayState.bottles,
  );

  currentDisplayState = {
    ...currentDisplayState,
    usd: normalizedUsd,
    bottles,
  };

  input.value = normalizedUsd.toFixed(2);
  input.setCustomValidity("");

  updateBottleDisplay(summary, bottles);

  await persistPendingDonationAmount(normalizedUsd, bottles);
}

function bindEditableAmountInput(summary: HTMLElement): void {
  const input = getEditableAmountInput(summary);

  if (!input) return;

  if (input.dataset.bibAmountBound === "true") {
    return;
  }

  input.addEventListener("focus", () => {
    window.requestAnimationFrame(() => {
      input.select();
    });
  });

  input.addEventListener("input", () => {
    const parsed = Number(input.value);

    if (!Number.isFinite(parsed)) {
      return;
    }

    if (parsed < currentDisplayState.minimumUsd) {
      input.setCustomValidity(
        `Minimum donation is $${currentDisplayState.minimumUsd.toFixed(2)}.`,
      );

      return;
    }

    input.setCustomValidity("");

    const bottles = getBottlesFromUsd(
      parsed,
      currentDisplayState.usdPerBottle,
      currentDisplayState.bottles,
    );

    updateBottleDisplay(summary, bottles);
  });

  input.addEventListener("blur", () => {
    void commitEditableAmount(input, summary);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;

    event.preventDefault();
    input.blur();
  });

  input.dataset.bibAmountBound = "true";
}

function setHeaderLabel(active: boolean): void {
  const label = getStepOneHeaderLabel();

  if (!label) return;

  if (!label.dataset.bibOriginalText) {
    label.dataset.bibOriginalText =
      label.textContent?.trim() || "Choose amount";
  }

  if (active) {
    label.textContent = "Offset your AI water footprint";
    return;
  }

  label.textContent = label.dataset.bibOriginalText;
}

function findButtonTextNode(element: HTMLElement): Text | null {
  for (const node of Array.from(element.childNodes)) {
    if (
      node.nodeType === Node.TEXT_NODE &&
      node.textContent?.trim()
    ) {
      return node as Text;
    }
  }

  return null;
}

function setFooterButtonLabel(active: boolean): void {
  const next = getFooterNextElement();

  if (!next) return;

  const textNode = findButtonTextNode(next);

  if (!textNode) return;

  if (!next.dataset.bibOriginalText) {
    next.dataset.bibOriginalText =
      textNode.textContent?.trim() || "Next";
  }

  if (active) {
    textNode.textContent = "Donate Bottles ";
    next.setAttribute("aria-label", "Donate Bottles");
    return;
  }

  textNode.textContent = `${next.dataset.bibOriginalText} `;
  next.setAttribute("aria-label", "Next Button");
}

function clickDonorboxNextSafely(button: HTMLButtonElement): void {
  const originalDataAction = button.getAttribute("data-action");

  /*
   * Donorbox's ecommerce tracking handler can throw
   * when our custom amount is populated programmatically.
   */
  if (originalDataAction) {
    button.removeAttribute("data-action");
  }

  isForwardingDonorboxClick = true;

  try {
    button.click();
  } finally {
    isForwardingDonorboxClick = false;

    window.setTimeout(() => {
      if (originalDataAction) {
        button.setAttribute("data-action", originalDataAction);
      }
    }, 250);
  }
}

async function handleDonateClick(): Promise<void> {
  const summary = document.getElementById(SUMMARY_ID);

  /*
   * Commit whatever is currently typed before
   * sending the final value to Donorbox.
   */
  if (summary) {
    const amountInput = getEditableAmountInput(summary);

    if (amountInput) {
      await commitEditableAmount(amountInput, summary);
    }
  }

  const state = currentDisplayState;

  if (state.usd <= 0) {
    console.warn("[🍾💧 Bottle It Back] nothing to donate");
    return;
  }

  if (state.usd < MINIMUM_DONATION_USD) {
    console.warn(
      "[🍾💧 Bottle It Back] donation amount is below Donorbox minimum",
      {
        usd: state.usd,
        minimumUsd: MINIMUM_DONATION_USD,
      },
    );

    return;
  }

  if (state.usd < state.minimumUsd) {
    console.warn(
      "[🍾💧 Bottle It Back] donation amount is below amount owed",
      {
        usd: state.usd,
        minimumUsd: state.minimumUsd,
      },
    );

    return;
  }

  const applied = applyAmountToDonorbox(state.usd);

  if (!applied) return;

  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, 150);
  });

  const footerButton = getFooterButton();

  if (!footerButton) {
    console.error("[🍾💧 Bottle It Back] #footer_button not found");
    return;
  }

  console.log(
    "[🍾💧 Bottle It Back] triggering real Donorbox Next button",
    {
      usd: state.usd,
      minimumUsd: state.minimumUsd,
      bottles: state.bottles,
    },
  );

  clickDonorboxNextSafely(footerButton);

  window.setTimeout(scheduleSync, 100);
  window.setTimeout(scheduleSync, 300);

  window.setTimeout(() => {
    if (isStepOneActive()) {
      console.warn(
        "[🍾💧 Bottle It Back] Donorbox remained on Step 1",
      );

      return;
    }

    console.log(
      "[🍾💧 Bottle It Back] Donorbox advanced from Step 1",
    );
  }, 600);
}

function bindFooterButton(): void {
  const button = getFooterButton();

  if (!button) return;

  if (button.dataset.bibClickBound === "true") {
    return;
  }

  button.addEventListener(
    "click",
    (event) => {
      if (isForwardingDonorboxClick) return;
      if (!isStepOneActive()) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      void handleDonateClick();
    },
    true,
  );

  button.dataset.bibClickBound = "true";
}

function setStepOneExperience(active: boolean): void {
  const stepOne = getStepOne();
  const summary = document.getElementById(SUMMARY_ID);

  if (active) {
    stepOne?.classList.add(STEP_ONE_CLASS);

    if (summary) {
      summary.hidden = false;
    }

    setHeaderLabel(true);
    setFooterButtonLabel(true);

    return;
  }

  stepOne?.classList.remove(STEP_ONE_CLASS);

  if (summary) {
    summary.hidden = true;
  }

  setHeaderLabel(false);
  setFooterButtonLabel(false);
}

async function syncDonationUi(): Promise<void> {
  if (syncing || !isDonorboxPage()) {
    return;
  }

  syncing = true;

  try {
    const widget = getDonationWidget();
    const stepOne = getStepOne();

    if (!widget || !stepOne) {
      return;
    }

    injectStyles();

    const summary = ensureSummary();

    if (!summary) {
      return;
    }

    bindFooterButton();
    bindEditableAmountInput(summary);

    currentDisplayState = await getDonationDisplayState();

    updateSummaryValues(summary, currentDisplayState);

    const signature = [
      currentDisplayState.source,
      currentDisplayState.usd,
      currentDisplayState.minimumUsd,
      currentDisplayState.bottles,
    ].join(":");

    if (signature !== lastLoggedSignature) {
      lastLoggedSignature = signature;

      console.log(
        "[🍾💧 Bottle It Back] donation values",
        currentDisplayState,
      );
    }

    setStepOneExperience(isStepOneActive());
  } catch (error) {
    console.error(
      "[🍾💧 Bottle It Back] donation UI sync failed",
      error,
    );
  } finally {
    syncing = false;
  }
}

function scheduleSync(): void {
  if (syncScheduled) return;

  syncScheduled = true;

  window.setTimeout(() => {
    syncScheduled = false;
    void syncDonationUi();
  }, 50);
}

/*
 * ==================================================
 * CONFIRMED DONATION SUCCESS
 * ==================================================
 */

function hasConfirmedDonationMarker(): boolean {
  return Boolean(
    document.querySelector(DONATION_SUCCESS_MARKER_SELECTOR),
  );
}

async function hasPendingDonation(): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get(
      STORAGE_KEYS.pendingDonation,
    );

    const pending = result[STORAGE_KEYS.pendingDonation] as
      | PendingDonationState
      | undefined;

    return Boolean(pending);
  } catch (error) {
    console.error(
      "[🍾💧 Bottle It Back] failed to read pending donation",
      error,
    );

    return false;
  }
}

async function reportDonationCompleted(): Promise<void> {
  if (hasReportedSuccess) return;
  if (!hasConfirmedDonationMarker()) return;

  const pending = await hasPendingDonation();

  if (!pending) {
    console.log(
      "[🍾💧 Bottle It Back] donation success marker found, but there is no pending Bottle It Back donation",
    );

    return;
  }

  hasReportedSuccess = true;

  try {
    const response = await chrome.runtime.sendMessage({
      type: "DONATION_COMPLETED",
      url: window.location.href,
      timestamp: new Date().toISOString(),
    });

    console.log(
      "[🍾💧 Bottle It Back] confirmed Donorbox donation completed",
      response,
    );
  } catch (error) {
    hasReportedSuccess = false;

    console.error(
      "[🍾💧 Bottle It Back] failed to report completed donation",
      error,
    );
  }
}

function checkForConfirmedDonation(): void {
  if (!hasConfirmedDonationMarker()) return;
  void reportDonationCompleted();
}

/*
 * ==================================================
 * RUN
 * ==================================================
 */

function run(): void {
  checkForConfirmedDonation();

  if (isDonorboxPage()) {
    scheduleSync();
  }
}

/*
 * ==================================================
 * BOOT
 * ==================================================
 */

console.log("[🍾💧 Bottle It Back] Donorbox watcher loaded", {
  url: window.location.href,
});

run();

const observer = new MutationObserver(() => {
  checkForConfirmedDonation();

  if (isDonorboxPage()) {
    scheduleSync();
  }
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: [
    "class",
    "id",
    "data-bib-donation-completed",
  ],
});

window.addEventListener("load", run);
document.addEventListener("readystatechange", run);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") {
    return;
  }

  const relevant =
    changes[STORAGE_KEYS.pendingDonation] ||
    changes[STORAGE_KEYS.stats] ||
    changes[STORAGE_KEYS.settings];

  if (!relevant) return;

  scheduleSync();
});