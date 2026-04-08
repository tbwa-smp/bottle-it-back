import { useEffect, useState } from "react";

import UsageTodayView from "./views/UsageTodayView";
import MonthlyView from "./views/MonthlyView";
import TipsView from "./views/TipsView";
import WelcomeView from "./views/WelcomeView";

import logo from "./assets/logo.svg";
import "./App.css";

import { STORAGE_KEYS } from "./utils/storage";
import { useTrackerSnapshot } from "./hooks/useTrackerSnapshot";

type TabKey = "usage" | "monthly" | "tips";

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

  if (!uiReady || !trackerReady) return null;

  if (!hasCompletedOnboarding) {
    return <WelcomeView onGetStarted={handleGetStarted} />;
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <img src={logo} alt="AI Water Tracker" className="app-logo" />
      </header>

      <section className="app-content">
        {activeTab === "usage" && (
          <UsageTodayView stats={stats} settings={settings} />
        )}

        {activeTab === "monthly" && (
          <MonthlyView stats={stats} settings={settings} />
        )}

        {activeTab === "tips" && <TipsView />}
      </section>

      <nav className="tab-bar">
        <button
          type="button"
          className={activeTab === "usage" ? "tab active" : "tab"}
          onClick={() => setActiveTab("usage")}
        >
          💧
        </button>

        <button
          type="button"
          className={activeTab === "monthly" ? "tab active" : "tab"}
          onClick={() => setActiveTab("monthly")}
        >
          📅
        </button>

        <button
          type="button"
          className={activeTab === "tips" ? "tab active" : "tab"}
          onClick={() => setActiveTab("tips")}
        >
          💡
        </button>
      </nav>
    </main>
  );
}