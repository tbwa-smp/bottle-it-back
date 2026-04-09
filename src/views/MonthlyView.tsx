import { useEffect, useId, useMemo, useState } from "react";
import type { TrackerStats, WaterModelSettings } from "../utils/types";

type MonthlyViewProps = {
  stats: TrackerStats;
  settings: WaterModelSettings;
  onOpenHistory: () => void;
};

const DONATION_URL = "https://donate.planet-water.org/donate-to-planet-water";
const MONTHLY_RING_GOAL_BOTTLES = 100;
const MINIMUM_DONATION_USD = 1;
const MINIMUM_DONATION_BOTTLES = 20;

function getTrackedMonthlyMl(stats: TrackerStats): number {
  const statsWithMonthly = stats as TrackerStats & { monthlyMl?: number };

  if (typeof statsWithMonthly.monthlyMl === "number") {
    return Math.max(0, statsWithMonthly.monthlyMl);
  }

  return Math.max(0, stats.totalWaterMl);
}

function getBottleCount(totalMl: number, bottleCapacityMl: number): number {
  if (bottleCapacityMl <= 0 || totalMl <= 0) return 0;
  return totalMl / bottleCapacityMl;
}

function getUsdTotal(bottles: number, usdPerBottle: number): number {
  if (bottles <= 0 || usdPerBottle <= 0) return 0;
  return bottles * usdPerBottle;
}

function formatCenterBottleCount(bottles: number): string {
  if (bottles >= 10) {
    return String(Math.ceil(bottles));
  }

  if (bottles <= 0) {
    return "0";
  }

  return bottles.toFixed(1);
}

function getMinimumDonationBottles(
  actualMonthlyBottles: number,
  donationThresholdBottles: number,
): number {
  const actualUsageFloor =
    actualMonthlyBottles > 0 ? Math.floor(actualMonthlyBottles) : 0;

  return Math.max(donationThresholdBottles, actualUsageFloor, 0);
}

function getDonationPayload(
  actualMonthlyBottles: number,
  selectedDonationBottles: number,
  usdPerBottle: number,
) {
  const roundedActualMonthlyBottles = Number(actualMonthlyBottles.toFixed(2));
  const roundedSelectedDonationBottles = Number(
    selectedDonationBottles.toFixed(2),
  );

  const actualOwedUsd = Number(
    getUsdTotal(roundedActualMonthlyBottles, usdPerBottle).toFixed(2),
  );

  const selectedDonationUsd = Number(
    getUsdTotal(roundedSelectedDonationBottles, usdPerBottle).toFixed(2),
  );

  if (roundedActualMonthlyBottles < MINIMUM_DONATION_BOTTLES) {
    if (roundedSelectedDonationBottles >= MINIMUM_DONATION_BOTTLES) {
      return {
        bottles: roundedSelectedDonationBottles,
        usd: selectedDonationUsd,
      };
    }

    return {
      bottles: MINIMUM_DONATION_BOTTLES,
      usd: MINIMUM_DONATION_USD,
    };
  }

  return {
    bottles: Math.max(
      roundedActualMonthlyBottles,
      roundedSelectedDonationBottles,
    ),
    usd: Math.max(actualOwedUsd, selectedDonationUsd),
  };
}

async function openDonationPage(bottles: number, usd: number) {
  try {
    await chrome.runtime.sendMessage({
      type: "DONATION_STARTED",
      bottles,
      usd,
      source: "monthly",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "[🍾💧 Bottle It Back] failed to store pending donation",
      error,
    );
  }

  if (typeof chrome !== "undefined" && chrome.tabs?.create) {
    await chrome.tabs.create({ url: DONATION_URL });
    return;
  }

  window.open(DONATION_URL, "_blank", "noopener,noreferrer");
}

function HistoryIcon({ color = "#2f6b98" }: { color?: string }) {
  return (
    <svg
      width="25"
      height="25"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 8V12L14.5 14.5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 12a9 9 0 1 0 3-6.708"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 4v4h4"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function MonthlyView({
  stats,
  settings,
  onOpenHistory,
}: MonthlyViewProps) {
  const gradientId = useId().replace(/[:]/g, "");

  const monthlyMl = getTrackedMonthlyMl(stats);
  const monthlyBottles = getBottleCount(monthlyMl, settings.bottleCapacityMl);

  const minimumDonationBottles = useMemo(
    () =>
      getMinimumDonationBottles(
        monthlyBottles,
        settings.donationThresholdBottles,
      ),
    [monthlyBottles, settings.donationThresholdBottles],
  );

  const [selectedDonationBottles, setSelectedDonationBottles] = useState(
    minimumDonationBottles,
  );

  useEffect(() => {
    setSelectedDonationBottles((current) =>
      Math.max(current, minimumDonationBottles),
    );
  }, [minimumDonationBottles]);

  const equivalentUsdTotal = getUsdTotal(
    monthlyBottles,
    settings.usdPerBottle,
  );

  const donationPayload = useMemo(
    () =>
      getDonationPayload(
        monthlyBottles,
        selectedDonationBottles,
        settings.usdPerBottle,
      ),
    [monthlyBottles, selectedDonationBottles, settings.usdPerBottle],
  );

  const progressRatio = Math.max(
    0,
    Math.min(monthlyBottles / MONTHLY_RING_GOAL_BOTTLES, 1),
  );

  const ringSize = 225;
  const strokeWidth = 26;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference * (1 - progressRatio);

  const canDecrease = selectedDonationBottles > minimumDonationBottles;

  function decrementDonationBottles() {
    setSelectedDonationBottles((current) =>
      Math.max(minimumDonationBottles, current - 1),
    );
  }

  function incrementDonationBottles() {
    setSelectedDonationBottles((current) => current + 1);
  }

  return (
    <section className="monthly-view">
      <div className="monthly-ring-card">
        <div className="monthly-ring">
          <svg
            className="monthly-ring__svg"
            width={ringSize}
            height={ringSize}
            viewBox={`0 0 ${ringSize} ${ringSize}`}
            aria-hidden="true"
          >
            <defs>
              <linearGradient
                id={`monthlyRingGradient-${gradientId}`}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#8ddcff" />
                <stop offset="100%" stopColor="#5eb8ea" />
              </linearGradient>
            </defs>

            <circle
              className="monthly-ring__track"
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              fill="none"
              strokeWidth={strokeWidth}
            />

            <circle
              className="monthly-ring__progress"
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              fill="none"
              strokeWidth={strokeWidth}
              stroke={`url(#monthlyRingGradient-${gradientId})`}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={progressOffset}
              transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
            />
          </svg>

          <div className="monthly-ring__content">
            <p className="monthly-ring__label">MONTHLY USAGE</p>
            <p className="monthly-ring__value">
              {formatCenterBottleCount(monthlyBottles)}
            </p>
            <p className="monthly-ring__unit">bottles</p>
          </div>

          <div className="monthly-history-trigger-wrap">
            <button
              type="button"
              className="monthly-history-trigger"
              onClick={onOpenHistory}
              aria-label="Open history"
              title="Open history"
            >
              <HistoryIcon />
            </button>
          </div>
        </div>
      </div>

      <div className="monthly-equivalent">
        <p className="monthly-equivalent__label">EQUIVALENT TO</p>

        <div className="monthly-equivalent__row">
          <div style={{ textAlign: "center" }}>
            <div className="monthly-equivalent__amount-box">
              <span className="monthly-equivalent__amount">
                {equivalentUsdTotal.toFixed(2)}
              </span>
              <span className="monthly-equivalent__currency">USD</span>
            </div>
          </div>

          <button
            type="button"
            className="monthly-donate-button"
            onClick={() =>
              openDonationPage(donationPayload.bottles, donationPayload.usd)
            }
          >
            GIVE WATER BACK
          </button>
        </div>
      </div>

      <div className="monthly-stepper-block">
        <p className="monthly-stepper-block__label">WANT TO GIVE MORE?</p>

        <div className="monthly-stepper">
          <button
            type="button"
            className="monthly-stepper__arrow"
            onClick={decrementDonationBottles}
            aria-label="Decrease donation bottles"
            disabled={!canDecrease}
          >
            ◀
          </button>

          <div className="monthly-stepper__value">
            <span className="monthly-stepper__number">
              {selectedDonationBottles}
            </span>
            <span className="monthly-stepper__unit">bottles</span>
          </div>

          <button
            type="button"
            className="monthly-stepper__arrow"
            onClick={incrementDonationBottles}
            aria-label="Increase donation bottles"
          >
            ▶
          </button>
        </div>
      </div>
    </section>
  );
}