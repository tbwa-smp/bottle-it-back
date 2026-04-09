/// <reference types="vite/client" />
/// <reference types="chrome" />

const SUCCESS_MARKERS = [
  "thank you for donating to planet water foundation",
  "your payment is being processed",
  "receipt will be sent",
  "thank you for your donation",
  "donation successful",
  "thank you",
];

let hasReportedSuccess = false;

function getPageText(): string {
  return document.body?.innerText?.toLowerCase() ?? "";
}

function getThankYouHeadingFromShadowDom(): string {
  const widget = document.querySelector(
    "#donation_section > dbox-widget",
  ) as HTMLElement | null;

  const heading = widget?.shadowRoot
    ?.querySelector("header.thankyou > h1#page_title")
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

checkForSuccess();

const observer = new MutationObserver(() => {
  checkForSuccess();
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  characterData: true,
});

window.addEventListener("load", checkForSuccess);
document.addEventListener("readystatechange", checkForSuccess);