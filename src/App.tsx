import { useEffect, useState } from "react";

// Views
import UsageTodayView from "./views/UsageTodayView";
import MonthlyView from "./views/MonthlyView";
import HistoryView from "./views/HistoryView";
import TipsView from "./views/TipsView";
import WelcomeView from "./views/WelcomeView";
import InfoView, { InfoIcon } from "./views/InfoView";

// Assets
import logo from "./assets/logo.svg";
import "./App.css";

// Local
import { STORAGE_KEYS } from "./utils/storage";
import { useTrackerSnapshot } from "./hooks/useTrackerSnapshot";
import TrackingSwitch from "./components/TrackingSwitch";
import Tabs, { type TabKey } from "./components/Tabs";
// import { getDonationStats } from "./utils/stats";

const PLANET_WATER_URL =
	"https://donorbox.org/bottle-it-back";

const RESET_DONATION_THRESHOLD_BOTTLES = 20;

function hasChromeStorage() {
	return typeof chrome !== "undefined" && !!chrome.storage?.local;
}

export default function App() {
	const { stats, settings, ready: trackerReady } = useTrackerSnapshot();

	const [uiReady, setUiReady] = useState(false);
	const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
	const [activeTab, setActiveTab] = useState<TabKey>("usage");
	const [isInfoOpen, setIsInfoOpen] = useState(false);
	const [isHistoryOpen, setIsHistoryOpen] = useState(false);

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

				if (chrome.runtime?.sendMessage) {
					await chrome.runtime.sendMessage({
						type: "MARK_ONBOARDED",
						timestamp: new Date().toISOString(),
					});
				}
			}

			setHasCompletedOnboarding(true);
			setActiveTab("usage");
			setIsInfoOpen(false);
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
		const todayMl =
			typeof stats.todayMl === "number" ? Math.max(0, stats.todayMl) : 0;

		const todayBottles =
			settings.bottleCapacityMl > 0
				? todayMl / settings.bottleCapacityMl
				: 0;

		setIsInfoOpen(false);
		setIsHistoryOpen(false);

		if (todayBottles >= RESET_DONATION_THRESHOLD_BOTTLES) {
			const usd = Number(
				(todayBottles * settings.usdPerBottle).toFixed(2),
			);

			try {
				if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
					await chrome.runtime.sendMessage({
						type: "DONATION_STARTED",
						bottles: Number(todayBottles.toFixed(2)),
						usd,
						source: "usage",
						timestamp: new Date().toISOString(),
					});
				}
			} catch (error) {
				console.error("Failed to save pending donation state", error);
			}

			if (typeof chrome !== "undefined" && chrome.tabs?.create) {
				await chrome.tabs.create({ url: PLANET_WATER_URL });
				return;
			}

			window.open(PLANET_WATER_URL, "_blank", "noopener,noreferrer");
			return;
		}

		setActiveTab("monthly");
	}

	function handleToggleInfo() {
		setIsInfoOpen((prev) => !prev);
	}

	function handleChangeTab(tab: TabKey) {
		setIsInfoOpen(false);
		setIsHistoryOpen(false);
		setActiveTab(tab);
	}

	function handleOpenHistory() {
		setIsInfoOpen(false);
		setActiveTab("monthly");
		setIsHistoryOpen(true);
	}

	function handleCloseHistory() {
		setIsHistoryOpen(false);
		setActiveTab("monthly");
	}

	if (!uiReady || !trackerReady) return null;

	if (!hasCompletedOnboarding) {
		return <WelcomeView onGetStarted={handleGetStarted} />;
	}

	return (
		<main className="app-shell">
			<header className={`app-header ${settings.trackingEnabled
					? "app-shell"
					: "app-shell app-shell--paused"}`}>
				<div className="app-info-trigger-wrap">
					{!isInfoOpen && hasCompletedOnboarding && (
						<img src={logo} alt="Bottle It Back" className="app-logo" />
					)}
					<h1>HELLO</h1>
					<button
						type="button"
						className={
							isInfoOpen ? "app-info-trigger is-active" : "app-info-trigger"
						}
						onClick={handleToggleInfo}
						aria-label={isInfoOpen ? "Hide info" : "Show info"}
						aria-pressed={isInfoOpen}
						title={isInfoOpen ? "Hide info" : "Show info"}
					>
						<InfoIcon color="#fff" />
					</button>
				</div>

				<TrackingSwitch
					checked={settings.trackingEnabled}
					onChange={handleToggleTracking}
				/>
			</header>

			<section className="app-content">
				{isInfoOpen ? (
					<InfoView />
				) : isHistoryOpen ? (
					<HistoryView
						stats={stats}
						settings={settings}
						onBack={handleCloseHistory}
					/>
				) : activeTab === "usage" ? (
					<UsageTodayView
						stats={stats}
						settings={settings}
						onResetAiWaterFootprint={handleResetAiWaterFootprint}
					/>
				) : activeTab === "monthly" ? (
					<MonthlyView
						stats={stats}
						settings={settings}
						onOpenHistory={handleOpenHistory}
					/>
				) : (
					<TipsView />
				)}
			</section>

			<Tabs
				activeTab={activeTab}
				onChange={handleChangeTab}
				hideIndicator={isInfoOpen}
			/>
		</main>
	);
}