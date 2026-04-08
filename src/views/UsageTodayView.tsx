import Bottle from "../components/Bottle";
import type { TrackerStats, WaterModelSettings } from "../utils/types";

type UsageTodayViewProps = {
	stats: TrackerStats;
	settings: WaterModelSettings;
	onResetAiWaterFootprint: () => void | Promise<void>;
};

function getTrackedTodayMl(stats: TrackerStats): number {
	const statsWithToday = stats as TrackerStats & { todayMl?: number };

	if (typeof statsWithToday.todayMl === "number") {
		return Math.max(0, statsWithToday.todayMl);
	}

	return Math.max(0, stats.totalWaterMl);
}

function getTodayBottleCount(
	todayMl: number,
	bottleCapacityMl: number,
): number {
	if (bottleCapacityMl <= 0 || todayMl <= 0) return 0;
	return todayMl / bottleCapacityMl;
}

function getTodayUsdTotal(
	todayMl: number,
	bottleCapacityMl: number,
	usdPerBottle: number,
): number {
	if (bottleCapacityMl <= 0 || usdPerBottle <= 0 || todayMl <= 0) return 0;

	const bottlesFilled = getTodayBottleCount(todayMl, bottleCapacityMl);
	return bottlesFilled * usdPerBottle;
}

function formatBottleCount(bottles: number): string {
	if (bottles >= 10) {
		return String(Math.ceil(bottles));
	}

	return bottles.toFixed(1);
}

function getLoopingBottleMl(
	todayMl: number,
	bottleCapacityMl: number,
): number {
	if (bottleCapacityMl <= 0 || todayMl <= 0) return 0;
	return todayMl % bottleCapacityMl;
}

function getCompletedBottleCount(
	todayMl: number,
	bottleCapacityMl: number,
): number {
	if (bottleCapacityMl <= 0 || todayMl <= 0) return 0;
	return Math.floor(todayMl / bottleCapacityMl);
}

export default function UsageTodayView({
	stats,
	settings,
	onResetAiWaterFootprint,
}: UsageTodayViewProps) {
	const bottleCapacityMl = settings.bottleCapacityMl;
	const usdPerBottle = settings.usdPerBottle;
	const todayMl = getTrackedTodayMl(stats);

	const currentMl = getLoopingBottleMl(todayMl, bottleCapacityMl);
	const completedBottleCount = getCompletedBottleCount(
		todayMl,
		bottleCapacityMl,
	);

	const todayBottleCount = getTodayBottleCount(todayMl, bottleCapacityMl);
	const todayUsdTotal = getTodayUsdTotal(
		todayMl,
		bottleCapacityMl,
		usdPerBottle,
	);

	return (
		<section className="usage-view">
			<div className="usage-today-card">
				<div style={{ flex: 1 }} />

				<Bottle
					key={completedBottleCount}
					currentMl={currentMl}
					maxMl={bottleCapacityMl}
					animateOnMount
					className="bottle"
				/>

				<div className="usage-today-stats">
					<p className="usage-today-stats__label">TOTAL</p>

					<div className="usage-today-stats__amount-box">
						<span className="usage-today-stats__amount">
							{todayUsdTotal.toFixed(2)}
						</span>
						<span className="usage-today-stats__currency"> USD</span>
					</div>

					<p className="usage-today-stats__bottles">
						{formatBottleCount(todayBottleCount)} BOTTLES
					</p>
				</div>
			</div>

			<div>
				<button
					className="reset-button"
					onClick={onResetAiWaterFootprint}
				>
					RESET AI WATER FOOTPRINT
				</button>
			</div>
		</section>
	);
}