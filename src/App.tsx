import { useEffect, useState } from "react";

// Views
import UsageTodayView from "./views/UsageTodayView";
import MonthlyView from "./views/MonthlyView";
import TipsView from "./views/TipsView";
import WelcomeView from "./views/WelcomeView";

// Assets
import logo from "./assets/logo.svg";
import "./App.css";

// Local
import { STORAGE_KEYS } from "./utils/storage";
import { useTrackerSnapshot } from "./hooks/useTrackerSnapshot";
import TrackingSwitch from "./components/TrackingSwitch";
import Tabs, { type TabKey } from "./components/Tabs";
import { getDonationStats } from "./utils/stats";

const PLANET_WATER_URL =
  "https://donate.planet-water.org/donate-to-planet-water";

function hasChromeStorage() {
  return typeof chrome !== "undefined" && !!chrome.storage?.local;
}

export default function App() {
  const { stats, settings, ready: trackerReady } = useTrackerSnapshot();

  const [uiReady, setUiReady] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("usage");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!hasChromeStorage()) {
        if (!cancelled) setUiReady(true);
        return;
      }

      try {
        const result = await chrome.storage.local.get(
          STORAGE_KEYS.hasCompletedOnboarding,
        );

        if (cancelled) return;

        setHasCompletedOnboarding(
          Boolean(result[STORAGE_KEYS.hasCompletedOnboarding]),
        );
        setUiReady(true);
      } catch (error) {
        console.error("Failed to load onboarding state", error);
        if (!cancelled) setUiReady(true);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleGetStarted() {
    try {
      if (hasChromeStorage()) {
        await chrome.storage.local.set({
          [STORAGE_KEYS.hasCompletedOnboarding]: true,
        });
      }

      setHasCompletedOnboarding(true);
      setActiveTab("usage");
    } catch (error) {
      console.error("Failed to save onboarding state", error);
    }
  }

  async function handleToggleTracking(nextEnabled: boolean) {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      return;
    }

    const nextSettings = {
      ...settings,
      trackingEnabled: nextEnabled,
    };

    await chrome.storage.local.set({
      [STORAGE_KEYS.settings]: nextSettings,
    });
  }

  async function handleResetAiWaterFootprint() {
    const donationStats = getDonationStats(stats, settings);

    if (donationStats.reachedThreshold) {
      if (typeof chrome !== "undefined" && chrome.tabs?.create) {
        await chrome.tabs.create({ url: PLANET_WATER_URL });
        return;
      }

      window.open(PLANET_WATER_URL, "_blank", "noopener,noreferrer");
      return;
    }

    setActiveTab("monthly");
  }

  if (!uiReady || !trackerReady) return null;

  if (!hasCompletedOnboarding) {
    return <WelcomeView onGetStarted={handleGetStarted} />;
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <img src={logo} alt="AI Water Tracker" className="app-logo" />
        <TrackingSwitch
          checked={settings.trackingEnabled}
          onChange={handleToggleTracking}
        />
      </header>

      <section className="app-content">
        {activeTab === "usage" && (
          <UsageTodayView
            stats={stats}
            settings={settings}
            onResetAiWaterFootprint={handleResetAiWaterFootprint}
          />
        )}
        {activeTab === "monthly" && (
          <MonthlyView stats={stats} settings={settings} />
        )}
        {activeTab === "tips" && <TipsView />}
      </section>

      <Tabs activeTab={activeTab} onChange={setActiveTab} />
    </main>
  );
}