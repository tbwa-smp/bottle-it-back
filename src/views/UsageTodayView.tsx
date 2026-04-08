import { useEffect, useState } from "react";
import Bottle from "../components/Bottle";
import { STORAGE_KEYS } from "../utils/storage";
import type { TrackerStats, WaterModelSettings } from "../utils/types";

type UsageTodayViewProps = {
  stats: TrackerStats;
  settings: WaterModelSettings;
};

function hasChromeStorage() {
  return typeof chrome !== "undefined" && !!chrome.storage?.local;
}

export default function UsageTodayView({
  stats,
  settings,
}: UsageTodayViewProps) {
  const [animateBottle, setAnimateBottle] = useState(false);
  const [animationReady, setAnimationReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadAnimationFlag() {
      if (!hasChromeStorage()) {
        if (!cancelled) setAnimationReady(true);
        return;
      }

      try {
        const result = await chrome.storage.local.get(
          STORAGE_KEYS.hasSeenBottleAnimation,
        );

        if (cancelled) return;

        const hasSeenBottleAnimation = Boolean(
          result[STORAGE_KEYS.hasSeenBottleAnimation],
        );

        setAnimateBottle(!hasSeenBottleAnimation);
        setAnimationReady(true);

        if (!hasSeenBottleAnimation) {
          await chrome.storage.local.set({
            [STORAGE_KEYS.hasSeenBottleAnimation]: true,
          });
        }
      } catch (error) {
        console.error("Failed to load bottle animation flag", error);
        if (!cancelled) setAnimationReady(true);
      }
    }

    void loadAnimationFlag();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!animationReady) return null;

  const bottleCapacityMl = settings.bottleCapacityMl;
  const currentMl = Math.min(stats.totalWaterMl, bottleCapacityMl);

  return (
    <section className="usage-view">
      <h1>Usage Today</h1>

      <Bottle
        currentMl={currentMl}
        maxMl={bottleCapacityMl}
        animateOnMount={animateBottle}
        className="bottle"
      />

      <div className="usage-stats">
        <p>
          <strong>{stats.totalPrompts}</strong> prompts tracked
        </p>
        <p>
          <strong>{currentMl.toFixed(2)} mL</strong> / {bottleCapacityMl} mL
        </p>
        <p>{stats.totalVisits} AI site visits</p>
      </div>
    </section>
  );
}