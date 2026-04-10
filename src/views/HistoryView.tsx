import { useMemo, useState } from "react";
import type { TrackerStats, WaterModelSettings } from "../utils/types";

// Assets
import bottleIcon from "../assets/history-bottle.png";
import facebook from "../assets/socmed/facebook.png";
import twitter from "../assets/socmed/twitter.png";
import linkedin from "../assets/socmed/linkedin.png";
import copy from "../assets/socmed/copy.png";

type HistoryViewProps = {
  stats: TrackerStats & {
    onboardedAt?: string | null;
    installedAt?: string | null;
  };
  settings: WaterModelSettings;
  onBack: () => void;
};

type ShareBoxProps = {
  shareText: string;
  shareUrl: string;
  displayShareUrl: string;
  onClose: () => void;
};

const FALLBACK_STORE_URL = "https://chromewebstore.google.com/";

function getTotalTrackedMl(stats: TrackerStats): number {
  return Math.max(0, stats.totalWaterMl ?? 0);
}

function getBottleCount(totalMl: number, bottleCapacityMl: number): number {
  if (bottleCapacityMl <= 0 || totalMl <= 0) return 0;
  return totalMl / bottleCapacityMl;
}

function formatBottleCount(bottles: number): string {
  if (bottles >= 10) {
    return String(Math.ceil(bottles));
  }

  if (bottles <= 0) {
    return "0";
  }

  return bottles.toFixed(1);
}

function formatUsd(usd: number): string {
  return Math.max(0, usd).toFixed(2);
}

function formatSinceDate(dateString?: string | null): string {
  if (!dateString) return "SINCE YOU GOT STARTED";

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "SINCE YOU GOT STARTED";
  }

  return `SINCE ${date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).toUpperCase()}`;
}

function getShareUrl(): string {
  try {
    if (typeof chrome !== "undefined" && chrome.runtime?.id) {
      return `https://chromewebstore.google.com/detail/${chrome.runtime.id}`;
    }
  } catch (error) {
    console.error("Failed to get runtime extension ID", error);
  }

  return FALLBACK_STORE_URL;
}

function getDisplayShareUrl(shareUrl: string): string {
  try {
    const url = new URL(shareUrl);
    return url.hostname;
  } catch {
    return "chromewebstore.google.com";
  }
}

function buildShareText(shareUrl: string): string {
  return [
    "Hey, did you know that one AI prompt consumes 38ML of water to cool data centers? That's an entire bottle of water for just a short chat with your AI.",
    `I've been tracking my consumption with every prompt. The best part is, I can offset my water footprint and give the water back to the communities in need. Download the Chrome extension now ${shareUrl}`,
  ].join("\n\n");
}

function openPopup(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

export default function HistoryView({
  stats,
  settings,
  onBack,
}: HistoryViewProps) {
  const [shareBoxOpen, setShareBoxOpen] = useState(false);

  const totalMl = getTotalTrackedMl(stats);
  const totalBottles = getBottleCount(totalMl, settings.bottleCapacityMl);
  const totalDonatedUsd = Math.max(0, stats.totalDonatedUsd ?? 0);

  const startedAtLabel = formatSinceDate(
    stats.onboardedAt ?? stats.installedAt ?? null,
  );

  const shareUrl = useMemo(() => getShareUrl(), []);
  const displayShareUrl = useMemo(
    () => getDisplayShareUrl(shareUrl),
    [shareUrl],
  );
  const shareText = useMemo(() => buildShareText(shareUrl), [shareUrl]);

  return (
    <section className="history-view">
      {shareBoxOpen && (
        <ShareBox
          shareText={shareText}
          shareUrl={shareUrl}
          displayShareUrl={displayShareUrl}
          onClose={() => setShareBoxOpen(false)}
        />
      )}

      <div className="history-card">
        <div className="history-card__top">
          <button
            type="button"
            className="history-back-button"
            onClick={onBack}
          >
            ← Back
          </button>
        </div>

        <p className="history-card__since">{startedAtLabel}</p>
        <p className="history-card__title">YOU HAVE CONSUMED</p>

        <div className="history-total-card">
          <div className="history-total-card__icon">
            <img
              src={bottleIcon}
              alt=""
              aria-hidden="true"
              className="history-total-card__bottle"
            />
          </div>

          <div className="history-total-card__text">
            <p className="history-total-card__value">
              {formatBottleCount(totalBottles)}
            </p>
            <p className="history-total-card__unit">bottles</p>
          </div>
        </div>

        <div className="history-donated-card">
          <p className="history-donated-card__label">YOU HAVE DONATED</p>

          <div className="history-donated-card__amount-row">
            <span className="history-donated-card__amount">
              {formatUsd(totalDonatedUsd)}
            </span>
            <span className="history-donated-card__currency">USD</span>
          </div>
        </div>

        <button
          type="button"
          className="history-share-button"
          onClick={() => setShareBoxOpen(true)}
        >
          SHARE THE CAUSE
        </button>
      </div>
    </section>
  );
}

function ShareBox({
  shareText,
  shareUrl,
  displayShareUrl,
  onClose,
}: ShareBoxProps) {
  const [copied, setCopied] = useState(false);

  async function copyShareText() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      return true;
    } catch (error) {
      console.error("Failed to copy share text", error);
      return false;
    }
  }

  async function handleCopy() {
    await copyShareText();
  }

  async function shareToFacebook() {
    await copyShareText();

    openPopup(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
        shareUrl,
      )}`,
    );
  }

  function shareToTwitter() {
    openPopup(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`,
    );
  }

  async function shareToLinkedIn() {
    await copyShareText();

    openPopup(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
        shareUrl,
      )}`,
    );
  }

  return (
    <div
      className="history-share-overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="history-share-box"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="history-share-box__top">
          <p className="history-share-box__title">SHARE THE CAUSE</p>
        </div>

        <div className="history-share-box__message">
          <p>
            Hey, did you know that one AI prompt consumes 38ML of water to cool
            data centers? That's an entire bottle of water for just a short chat
            with your AI.
          </p>

          <p>
            I've been tracking my consumption with every prompt. The best part
            is, I can offset my water footprint and give the water back to the
            communities in need. Download the Chrome extension now{" "}
            <span className="history-share-box__link-preview">
              {displayShareUrl}
            </span>
          </p>
        </div>

        <div className="history-share-box__actions">
          <button
            type="button"
            className="history-share-box__icon-action"
            onClick={shareToFacebook}
            aria-label="Share to Facebook"
            title="Facebook"
          >
            <img src={facebook} alt="" aria-hidden="true" />
          </button>

          <button
            type="button"
            className="history-share-box__icon-action"
            onClick={shareToTwitter}
            aria-label="Share to Twitter"
            title="Twitter"
          >
            <img src={twitter} alt="" aria-hidden="true" />
          </button>

          <button
            type="button"
            className="history-share-box__icon-action"
            onClick={shareToLinkedIn}
            aria-label="Share to LinkedIn"
            title="LinkedIn"
          >
            <img src={linkedin} alt="" aria-hidden="true" />
          </button>

          <button
            type="button"
            className="history-share-box__icon-action"
            onClick={handleCopy}
            aria-label="Copy share text"
            title={copied ? "Copied!" : "Copy"}
          >
            <img src={copy} alt="" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}