/// <reference types="vite/client" />
/// <reference types="chrome" />

import { STORAGE_KEYS } from "./storage";
import type { PendingDonationState } from "./types";

const SUCCESS_MARKERS = [
  "thank you for donating to planet water foundation",
  "your payment is being processed",
  "receipt will be sent",
  "thank you for your donation",
  "donation successful",
  "thank you for your support",
  "thank you",
];

let hasReportedSuccess = false;
let hasAutofilledAmount = false;

function getPageText(): string {
  return document.body?.innerText?.toLowerCase() ?? "";
}

function getThankYouHeadingFromShadowDom(): string {
  const widget = document.querySelector(
    "#donation_section > dbox-widget",
  ) as HTMLElement | null;

  const heading = widget?.shadowRoot
    ?.querySelector("#page_thank_you > div > span > p")
    ?.textContent
    ?.trim()
    ?.toLowerCase();

  return heading ?? "";
}

function looksLikeDonationSuccess(): boolean {
  const thankYouHeading = getThankYouHeadingFromShadowDom();

  if (thankYouHeading.includes("thank you")) {
    return true;
  }

  const text = getPageText();
  return SUCCESS_MARKERS.some((marker) => text.includes(marker));
}

async function getPendingDonation(): Promise<PendingDonationState | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.pendingDonation);
  return (
    (result[STORAGE_KEYS.pendingDonation] as PendingDonationState | undefined) ??
    null
  );
}

function findCustomAmountInput(): HTMLInputElement | null {
  const widget = document.querySelector(
    "#donation_section > dbox-widget",
  ) as HTMLElement | null;

  return (
    (widget?.shadowRoot?.querySelector(
      "input#custom_amount_input",
    ) as HTMLInputElement | null) ?? null
  );
}

function setReactLikeInputValue(input: HTMLInputElement, value: string) {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;

  nativeSetter?.call(input, value);
  input.setAttribute("value", value);

  input.dispatchEvent(
    new Event("input", { bubbles: true, composed: true }),
  );
  input.dispatchEvent(
    new Event("change", { bubbles: true, composed: true }),
  );
  input.dispatchEvent(
    new Event("blur", { bubbles: true, composed: true }),
  );
}

async function waitForCustomAmountInput(timeoutMs = 15000): Promise<HTMLInputElement | null> {
  const startedAt = Date.now();

  return new Promise((resolve) => {
    const check = () => {
      const input = findCustomAmountInput();
      if (input) {
        resolve(input);
        return true;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        resolve(null);
        return true;
      }

      return false;
    };

    if (check()) return;

    const intervalId = window.setInterval(() => {
      if (check()) {
        window.clearInterval(intervalId);
      }
    }, 250);
  });
}

async function autofillPendingDonationAmount() {
  if (hasAutofilledAmount) return;

  const pendingDonation = await getPendingDonation();

  if (!pendingDonation || pendingDonation.usd <= 0) {
    return;
  }

  const input = await waitForCustomAmountInput();

  if (!input) {
    console.warn("[🍾💧 Bottle It Back] custom amount input not found");
    return;
  }

  const formattedUsd = pendingDonation.usd.toFixed(2);

  if (input.value !== formattedUsd) {
    setReactLikeInputValue(input, formattedUsd);
    console.log(
      "[🍾💧 Bottle It Back] donation amount autofilled",
      formattedUsd,
    );
  }

  hasAutofilledAmount = true;
}

async function reportDonationCompleted() {
  if (hasReportedSuccess) return;
  hasReportedSuccess = true;

  try {
    await chrome.runtime.sendMessage({
      type: "DONATION_COMPLETED",
      url: window.location.href,
      timestamp: new Date().toISOString(),
    });
    console.log("[🍾💧 Bottle It Back] donation completion detected");
  } catch (error) {
    console.error(
      "[🍾💧 Bottle It Back] failed to report donation completion",
      error,
    );
  }
}

function checkForSuccess() {
  if (looksLikeDonationSuccess()) {
    void reportDonationCompleted();
  }
}

function runDonationPageTasks() {
  void autofillPendingDonationAmount();
  checkForSuccess();
}

runDonationPageTasks();

const observer = new MutationObserver(() => {
  runDonationPageTasks();
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  characterData: true,
});

window.addEventListener("load", runDonationPageTasks);
document.addEventListener("readystatechange", runDonationPageTasks);