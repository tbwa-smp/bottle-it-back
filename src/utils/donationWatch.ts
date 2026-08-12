/// <reference types="vite/client" />
/// <reference types="chrome" />

import {
  DEFAULT_SETTINGS,
  STORAGE_KEYS,
} from "./storage";

import type {
  PendingDonationState,
  TrackerStats,
  WaterModelSettings,
} from "./types";

const MINIMUM_DONATION_USD = 1;

const DONORBOX_HOSTNAME = "donorbox.org";
const DONORBOX_PATHNAME = "/bottle-it-back";

const DONATION_WIDGET_SELECTOR =
  "#donation_section > article.donation-widget";

const STEP_ONE_SELECTOR =
  "#donor-form-step-1";

const STANDARD_DONATION_SECTION_SELECTOR =
  "#standard-donation-section";

const CUSTOM_AMOUNT_SELECTOR =
  "#donation_custom_amount";

const FOOTER_BUTTON_SELECTOR =
  "#footer_button";

const SUMMARY_ID =
  "bib-donation-summary";

const STYLE_ID =
  "bib-donation-watch-styles";

const STEP_ONE_CLASS =
  "bib-offset-step";

type DonationDisplayState = {
  usd: number;
  bottles: number;
  source: "pending" | "stats" | "empty";
};

let currentDisplayState: DonationDisplayState = {
  usd: 0,
  bottles: 0,
  source: "empty",
};

let hasReportedSuccess = false;
let syncScheduled = false;
let syncing = false;
let lastLoggedSignature = "";

let isForwardingDonorboxClick = false;

function getDonationUsd(
  calculatedUsd: number,
): number {
  if (!Number.isFinite(calculatedUsd)) {
    return MINIMUM_DONATION_USD;
  }

  return Math.max(
    MINIMUM_DONATION_USD,
    Number(calculatedUsd.toFixed(2)),
  );
}

function isDonorboxPage(): boolean {
  const hostname =
    window.location.hostname.toLowerCase();

  const pathname =
    window.location.pathname.toLowerCase();

  return (
    (
      hostname === DONORBOX_HOSTNAME ||
      hostname.endsWith(
        `.${DONORBOX_HOSTNAME}`,
      )
    ) &&
    pathname.startsWith(
      DONORBOX_PATHNAME,
    )
  );
}

function getDonationWidget(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    DONATION_WIDGET_SELECTOR,
  );
}

function getStepOne(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    STEP_ONE_SELECTOR,
  );
}

// function getStandardDonationSection():
//   | HTMLElement
//   | null {
//   return document.querySelector<HTMLElement>(
//     STANDARD_DONATION_SECTION_SELECTOR,
//   );
// }

function getCustomAmountInput():
  | HTMLInputElement
  | null {
  return document.querySelector<HTMLInputElement>(
    CUSTOM_AMOUNT_SELECTOR,
  );
}

function getFooterButton():
  | HTMLButtonElement
  | null {
  return document.querySelector<HTMLButtonElement>(
    FOOTER_BUTTON_SELECTOR,
  );
}

function getFooterNextElement():
  | HTMLElement
  | null {
  return document.querySelector<HTMLElement>(
    `${FOOTER_BUTTON_SELECTOR} .next`,
  );
}

function getStepOneHeaderLabel():
  | HTMLElement
  | null {
  return document.querySelector<HTMLElement>(
    `${DONATION_WIDGET_SELECTOR} .tabs-header .display-amount .step-1`,
  );
}

function isStepOneActive(): boolean {
  const stepOne = getStepOne();

  return Boolean(
    stepOne?.classList.contains("active"),
  );
}

function formatBottles(
  value: number,
): string {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return Number(
    Math.max(0, value).toFixed(2),
  ).toString();
}

function normalizePositiveNumber(
  value: unknown,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return 0;
  }

  return Math.max(0, value);
}

async function getDonationDisplayState():
  Promise<DonationDisplayState> {
  const result =
    await chrome.storage.local.get([
      STORAGE_KEYS.pendingDonation,
      STORAGE_KEYS.stats,
      STORAGE_KEYS.settings,
    ]);

  const pending =
    result[
      STORAGE_KEYS.pendingDonation
    ] as PendingDonationState | undefined;

  if (
    pending &&
    typeof pending.usd === "number" &&
    Number.isFinite(pending.usd) &&
    pending.usd > 0
  ) {
    return {
      usd: getDonationUsd(
        normalizePositiveNumber(
          pending.usd,
        ),
      ),

      bottles:
        normalizePositiveNumber(
          pending.bottles,
        ),

      source: "pending",
    };
  }

  const stats =
    result[
      STORAGE_KEYS.stats
    ] as Partial<TrackerStats> | undefined;

  const settings: WaterModelSettings = {
    ...DEFAULT_SETTINGS,

    ...(
      result[
        STORAGE_KEYS.settings
      ] as
        | Partial<WaterModelSettings>
        | undefined
    ),
  };

  const todayMl =
    normalizePositiveNumber(
      stats?.todayMl,
    );

  const bottleCapacityMl =
    normalizePositiveNumber(
      settings.bottleCapacityMl,
    );

  const usdPerBottle =
    normalizePositiveNumber(
      settings.usdPerBottle,
    );

  if (
    todayMl > 0 &&
    bottleCapacityMl > 0
  ) {
    const bottles =
      todayMl / bottleCapacityMl;

    const calculatedUsd =
      bottles * usdPerBottle;

    return {
      bottles:
        Number(
          bottles.toFixed(2),
        ),

      usd:
        getDonationUsd(
          calculatedUsd,
        ),

      source: "stats",
    };
  }

  return {
    usd: 0,
    bottles: 0,
    source: "empty",
  };
}

function setNativeInputValue(
  input: HTMLInputElement,
  value: string,
): void {
  const descriptor =
    Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    );

  const setter =
    descriptor?.set;

  input.focus();

  if (setter) {
    setter.call(
      input,
      value,
    );
  } else {
    input.value = value;
  }

  input.setAttribute(
    "value",
    value,
  );

  input.dispatchEvent(
    new Event(
      "input",
      {
        bubbles: true,
      },
    ),
  );

  input.dispatchEvent(
    new Event(
      "change",
      {
        bubbles: true,
      },
    ),
  );

  input.blur();
}

function applyAmountToDonorbox(
  usd: number,
): boolean {
  const input =
    getCustomAmountInput();

  if (!input) {
    console.warn(
      "[🍾💧 Bottle It Back] #donation_custom_amount not found",
    );

    return false;
  }

  if (
    !Number.isFinite(usd) ||
    usd <= 0
  ) {
    console.warn(
      "[🍾💧 Bottle It Back] donation amount is zero",
    );

    return false;
  }

  const formatted =
    usd.toFixed(2);

  setNativeInputValue(
    input,
    formatted,
  );

  console.log(
    "[🍾💧 Bottle It Back] applied real Donorbox amount",
    formatted,
  );

  return true;
}

function injectStyles(): void {
  if (
    document.getElementById(
      STYLE_ID,
    )
  ) {
    return;
  }

  const style =
    document.createElement("style");

  style.id = STYLE_ID;

  style.textContent = `
    /*
     * Only replace the contents of Step 1.
     *
     * The Donorbox widget, header, footer, button,
     * progress indicators, arrows, borders and
     * border-radius all retain their original styles.
     */

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

      padding:
        42px
        24px
        34px;

      font-family:
        "Montserrat",
        Arial,
        sans-serif;

      text-align: center;
    }

    #${SUMMARY_ID}
      .bib-total-label {
      width: 100%;

      margin:
        0
        0
        10px !important;

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

    #${SUMMARY_ID}
      .bib-total-box {
      display: inline-flex;

      align-items: flex-end;
      justify-content: center;

      gap: 8px;

      width: 100%;

      min-height: 112px;

      padding:
        14px
        16px
        18px;

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

    #${SUMMARY_ID}
      .bib-total-value {
      color: #4777a5;

      font-size: 72px;
      font-weight: 800;
      line-height: 0.9;

      letter-spacing: -3px;
    }

    #${SUMMARY_ID}
      .bib-total-currency {
      padding-bottom: 7px;

      color: #4777a5;

      font-size: 27px;
      font-weight: 800;
      line-height: 1;
    }

    #${SUMMARY_ID}
      .bib-total-bottles {
      margin:
        18px
        0
        0 !important;

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

    @media (
      max-width: 480px
    ) {
      #${SUMMARY_ID} {
        padding:
          34px
          20px
          28px;
      }

      #${SUMMARY_ID}
        .bib-total-label {
        font-size:
          28px !important;
      }

      #${SUMMARY_ID}
        .bib-total-value {
        font-size: 62px;
      }

      #${SUMMARY_ID}
        .bib-total-currency {
        font-size: 23px;
      }

      #${SUMMARY_ID}
        .bib-total-bottles {
        font-size:
          27px !important;
      }
    }
  `;

  document.head.appendChild(
    style,
  );

  console.log(
    "[🍾💧 Bottle It Back] custom Donorbox Step 1 styles injected",
  );
}

function createSummary(): HTMLElement {
  const summary =
    document.createElement(
      "div",
    );

  summary.id = SUMMARY_ID;

  summary.innerHTML = `
    <p class="bib-total-label">
      TOTAL
    </p>

    <div class="bib-total-box">
      <span
        class="bib-total-value"
      >
        0.00
      </span>

      <span
        class="bib-total-currency"
      >
        USD
      </span>
    </div>

    <p class="bib-total-bottles">
      0 BOTTLE/S
    </p>
  `;

  return summary;
}

function ensureSummary():
  | HTMLElement
  | null {
  const stepOne =
    getStepOne();

  if (!stepOne) {
    return null;
  }

  stepOne.classList.add(
    STEP_ONE_CLASS,
  );

  let summary =
    document.getElementById(
      SUMMARY_ID,
    );

  if (!summary) {
    summary =
      createSummary();

    stepOne.appendChild(
      summary,
    );

    console.log(
      "[🍾💧 Bottle It Back] donation summary injected",
    );
  }

  return summary;
}

function setTextIfDifferent(
  element: HTMLElement | null,
  value: string,
): void {
  if (
    element &&
    element.textContent !== value
  ) {
    element.textContent = value;
  }
}

function updateSummaryValues(
  summary: HTMLElement,
  state: DonationDisplayState,
): void {
  const amount =
    summary.querySelector<HTMLElement>(
      ".bib-total-value",
    );

  const bottles =
    summary.querySelector<HTMLElement>(
      ".bib-total-bottles",
    );

  setTextIfDifferent(
    amount,
    state.usd.toFixed(2),
  );

  setTextIfDifferent(
    bottles,
    `${formatBottles(
      state.bottles,
    )} BOTTLE/S`,
  );
}

function setHeaderLabel(
  active: boolean,
): void {
  const label =
    getStepOneHeaderLabel();

  if (!label) {
    return;
  }

  if (
    !label.dataset.bibOriginalText
  ) {
    label.dataset.bibOriginalText =
      label.textContent?.trim() ||
      "Choose amount";
  }

  if (active) {
    /*
     * Only change the text.
     *
     * No font weight, padding, font size,
     * arrow or progress styling is modified.
     */
    label.textContent =
      "Offset your AI water footprint";

    return;
  }

  label.textContent =
    label.dataset.bibOriginalText;
}

function findButtonTextNode(
  element: HTMLElement,
): Text | null {
  for (
    const node of
    Array.from(element.childNodes)
  ) {
    if (
      node.nodeType ===
        Node.TEXT_NODE &&
      node.textContent?.trim()
    ) {
      return node as Text;
    }
  }

  return null;
}

function setFooterButtonLabel(
  active: boolean,
): void {
  const next =
    getFooterNextElement();

  if (!next) {
    return;
  }

  const textNode =
    findButtonTextNode(
      next,
    );

  if (!textNode) {
    return;
  }

  if (
    !next.dataset.bibOriginalText
  ) {
    next.dataset.bibOriginalText =
      textNode.textContent?.trim() ||
      "Next";
  }

  if (active) {
    /*
     * Change ONLY the text node.
     *
     * The original Donorbox <i class="material-icons">
     * arrow remains completely untouched.
     */
    textNode.textContent =
      "Donate Bottles ";

    next.setAttribute(
      "aria-label",
      "Donate Bottles",
    );

    return;
  }

  textNode.textContent =
    `${
      next.dataset.bibOriginalText
    } `;

  next.setAttribute(
    "aria-label",
    "Next Button",
  );
}

function clickDonorboxNextSafely(
  button: HTMLButtonElement,
): void {
  const originalDataAction =
    button.getAttribute(
      "data-action",
    );

  /*
   * Donorbox's ecommerce tracking handler throws
   * when our custom amount is populated
   * programmatically.
   *
   * Temporarily remove only that analytics action.
   */

  if (originalDataAction) {
    button.removeAttribute(
      "data-action",
    );
  }

  isForwardingDonorboxClick =
    true;

  try {
    /*
     * This remains the real Donorbox button.
     */
    button.click();
  } finally {
    isForwardingDonorboxClick =
      false;

    window.setTimeout(
      () => {
        if (
          originalDataAction
        ) {
          button.setAttribute(
            "data-action",
            originalDataAction,
          );
        }
      },
      250,
    );
  }
}

async function handleDonateClick():
  Promise<void> {
  const state =
    currentDisplayState;

  if (
    state.usd <= 0
  ) {
    console.warn(
      "[🍾💧 Bottle It Back] nothing to donate",
    );

    return;
  }

  const applied =
    applyAmountToDonorbox(
      state.usd,
    );

  if (!applied) {
    return;
  }

  /*
   * Give Donorbox a moment to process
   * its real amount input.
   */

  await new Promise<void>(
    (resolve) => {
      window.setTimeout(
        resolve,
        150,
      );
    },
  );

  const footerButton =
    getFooterButton();

  if (!footerButton) {
    console.error(
      "[🍾💧 Bottle It Back] #footer_button not found",
    );

    return;
  }

  console.log(
    "[🍾💧 Bottle It Back] triggering real Donorbox Next button",
    {
      usd:
        state.usd,

      bottles:
        state.bottles,
    },
  );

  clickDonorboxNextSafely(
    footerButton,
  );

  window.setTimeout(
    scheduleSync,
    100,
  );

  window.setTimeout(
    scheduleSync,
    300,
  );

  window.setTimeout(
    () => {
      if (
        isStepOneActive()
      ) {
        console.warn(
          "[🍾💧 Bottle It Back] Donorbox remained on Step 1",
        );

        return;
      }

      console.log(
        "[🍾💧 Bottle It Back] Donorbox advanced from Step 1",
      );
    },
    600,
  );
}

function bindFooterButton(): void {
  const button =
    getFooterButton();

  if (!button) {
    return;
  }

  if (
    button.dataset.bibClickBound ===
    "true"
  ) {
    return;
  }

  /*
   * Intercept the user's click BEFORE Donorbox.
   *
   * Once Bottle It Back has populated the real
   * amount input, handleDonateClick() forwards
   * another click back to the original button.
   */

  button.addEventListener(
    "click",
    (event) => {
      if (
        isForwardingDonorboxClick
      ) {
        return;
      }

      if (
        !isStepOneActive()
      ) {
        return;
      }

      event.preventDefault();

      event.stopImmediatePropagation();

      void handleDonateClick();
    },
    true,
  );

  button.dataset.bibClickBound =
    "true";
}

function setStepOneExperience(
  active: boolean,
): void {
  const stepOne =
    getStepOne();

  const summary =
    document.getElementById(
      SUMMARY_ID,
    );

  if (active) {
    stepOne?.classList.add(
      STEP_ONE_CLASS,
    );

    if (summary) {
      summary.hidden = false;
    }

    setHeaderLabel(true);

    setFooterButtonLabel(true);

    return;
  }

  stepOne?.classList.remove(
    STEP_ONE_CLASS,
  );

  if (summary) {
    summary.hidden = true;
  }

  setHeaderLabel(false);

  setFooterButtonLabel(false);
}

async function syncDonationUi():
  Promise<void> {
  if (
    syncing ||
    !isDonorboxPage()
  ) {
    return;
  }

  syncing = true;

  try {
    const widget =
      getDonationWidget();

    const stepOne =
      getStepOne();

    if (
      !widget ||
      !stepOne
    ) {
      return;
    }

    injectStyles();

    const summary =
      ensureSummary();

    if (!summary) {
      return;
    }

    bindFooterButton();

    currentDisplayState =
      await getDonationDisplayState();

    updateSummaryValues(
      summary,
      currentDisplayState,
    );

    const signature = [
      currentDisplayState.source,
      currentDisplayState.usd,
      currentDisplayState.bottles,
    ].join(":");

    if (
      signature !==
      lastLoggedSignature
    ) {
      lastLoggedSignature =
        signature;

      console.log(
        "[🍾💧 Bottle It Back] donation values",
        currentDisplayState,
      );
    }

    setStepOneExperience(
      isStepOneActive(),
    );
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
  if (syncScheduled) {
    return;
  }

  syncScheduled = true;

  window.setTimeout(
    () => {
      syncScheduled = false;

      void syncDonationUi();
    },
    50,
  );
}

/*
 * ==================================================
 * DONATION SUCCESS
 * ==================================================
 */

function getLegacyThankYouHeading():
  string {
  const widget =
    document.querySelector(
      "#donation_section > dbox-widget",
    ) as HTMLElement | null;

  return (
    widget?.shadowRoot
      ?.querySelector(
        "#page_thank_you > div > span > p",
      )
      ?.textContent
      ?.trim()
      ?.toLowerCase() ??
    ""
  );
}

function looksLikeDonationSuccess():
  boolean {
  const thankYou =
    document.querySelector<HTMLElement>(
      "#thank_you",
    );

  if (
    thankYou &&
    /thank you/i.test(
      thankYou.innerText ?? "",
    )
  ) {
    return true;
  }

  if (
    getLegacyThankYouHeading().includes(
      "thank you",
    )
  ) {
    return true;
  }

  const pageText =
    document.body?.innerText
      ?.toLowerCase() ??
    "";

  const specificMarkers = [
    "your payment is being processed",
    "receipt will be sent",
    "donation successful",
    "thank you for your donation",
  ];

  return specificMarkers.some(
    (marker) =>
      pageText.includes(
        marker,
      ),
  );
}

async function reportDonationCompleted():
  Promise<void> {
  if (hasReportedSuccess) {
    return;
  }

  hasReportedSuccess = true;

  try {
    await chrome.runtime.sendMessage({
      type:
        "DONATION_COMPLETED",

      url:
        window.location.href,

      timestamp:
        new Date().toISOString(),
    });

    console.log(
      "[🍾💧 Bottle It Back] donation completion detected",
    );
  } catch (error) {
    hasReportedSuccess =
      false;

    console.error(
      "[🍾💧 Bottle It Back] failed to report donation completion",
      error,
    );
  }
}

function checkForSuccess(): void {
  if (
    looksLikeDonationSuccess()
  ) {
    void reportDonationCompleted();
  }
}

function run(): void {
  checkForSuccess();

  if (
    isDonorboxPage()
  ) {
    scheduleSync();
  }
}

/*
 * ==================================================
 * BOOT
 * ==================================================
 */

console.log(
  "[🍾💧 Bottle It Back] Donorbox watcher loaded",
  {
    url:
      window.location.href,
  },
);

run();

const observer =
  new MutationObserver(
    () => {
      checkForSuccess();

      if (
        isDonorboxPage()
      ) {
        scheduleSync();
      }
    },
  );

observer.observe(
  document.documentElement,
  {
    childList: true,
    subtree: true,

    attributes: true,

    attributeFilter: [
      "class",
    ],
  },
);

window.addEventListener(
  "load",
  run,
);

document.addEventListener(
  "readystatechange",
  run,
);

chrome.storage.onChanged.addListener(
  (
    changes,
    areaName,
  ) => {
    if (
      areaName !== "local"
    ) {
      return;
    }

    const relevant =
      changes[
        STORAGE_KEYS.pendingDonation
      ] ||
      changes[
        STORAGE_KEYS.stats
      ] ||
      changes[
        STORAGE_KEYS.settings
      ];

    if (!relevant) {
      return;
    }

    scheduleSync();
  },
);