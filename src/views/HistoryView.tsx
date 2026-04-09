import { useMemo, useState } from "react";
import type { TrackerStats, WaterModelSettings } from "../utils/types";

type HistoryViewProps = {
	stats: TrackerStats;
	settings: WaterModelSettings;
	onBack: () => void;
};

function getTotalTrackedMl(stats: TrackerStats): number {
	return Math.max(0, stats.totalWaterMl ?? 0);
}

function getBottleCount(totalMl: number, bottleCapacityMl: number): number {
	if (bottleCapacityMl <= 0 || totalMl <= 0) return 0;
	return totalMl / bottleCapacityMl;
}

function getUsdEquivalent(bottles: number, usdPerBottle: number): number {
	if (bottles <= 0 || usdPerBottle <= 0) return 0;
	return bottles * usdPerBottle;
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

function buildShareText(totalMl: number, bottles: number, usdEquivalent: number) {
	const mlText = Math.round(totalMl).toLocaleString();
	const bottleText = formatBottleCount(bottles);

	return `I'm using Bottle It Back to track my AI water footprint. So far I've tracked ${mlText} mL of water use, or about ${bottleText} bottles, equivalent to $${usdEquivalent.toFixed(
		2,
	)}.`;
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
	const totalUsdEquivalent = getUsdEquivalent(
		totalBottles,
		settings.usdPerBottle,
	);

	const shareText = useMemo(
		() => buildShareText(totalMl, totalBottles, totalUsdEquivalent),
		[totalMl, totalBottles, totalUsdEquivalent],
	);

	return (
		<section className="history-view">
			{shareBoxOpen && (
				<ShareBox
					shareText={shareText}
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

				<p className="history-card__eyebrow">TOTAL HISTORY</p>
				<p className="history-card__title">You have consumed</p>

				<div className="history-card__hero-stat">
					<div className="history-card__bottle-glyph" aria-hidden="true">
						💧
					</div>

					<div className="history-card__hero-text">
						<p className="history-card__hero-value">
							{formatBottleCount(totalBottles)}
						</p>
						<p className="history-card__hero-unit">bottles</p>
					</div>
				</div>

				<p className="history-card__supporting-text">
					That’s about {Math.round(totalMl).toLocaleString()} mL tracked across
					your supported AI usage.
				</p>

				<div className="history-card__impact-box">
					<p className="history-card__impact-label">EQUIVALENT TO</p>

					<div className="history-card__impact-amount-box">
						<span className="history-card__impact-amount">
							{totalUsdEquivalent.toFixed(2)}
						</span>
						<span className="history-card__impact-currency"> USD</span>
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

type ShareBoxProps = {
	shareText: string;
	onClose: () => void;
};

function ShareBox({ shareText, onClose }: ShareBoxProps) {
	const [copied, setCopied] = useState(false);

	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(shareText);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1800);
		} catch (error) {
			console.error("Failed to copy share text", error);
		}
	}

	async function handleNativeShare() {
		if (!navigator.share) {
			await handleCopy();
			return;
		}

		try {
			await navigator.share({
				title: "Bottle It Back",
				text: shareText,
			});
		} catch (error) {
			console.error("Native share cancelled or failed", error);
		}
	}

	function shareToX() {
		openPopup(
			`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`,
		);
	}

	function shareToTelegram() {
		openPopup(
			`https://t.me/share/url?url=&text=${encodeURIComponent(shareText)}`,
		);
	}

	function shareByEmail() {
		window.location.href = `mailto:?subject=${encodeURIComponent(
			"Bottle It Back",
		)}&body=${encodeURIComponent(shareText)}`;
	}

	return (
		<div className="history-share-overlay" role="dialog" aria-modal="true">
			<div className="history-share-box">
				<div className="history-share-box__top">
					<p className="history-share-box__title">SHARE THE CAUSE</p>

					<button
						type="button"
						className="history-share-box__close"
						onClick={onClose}
						aria-label="Close share box"
					>
						✕
					</button>
				</div>

				<div className="history-share-box__message">
					<p>{shareText}</p>
				</div>

				<div className="history-share-box__actions">
					<button
						type="button"
						className="history-share-box__action"
						onClick={handleNativeShare}
					>
						Share
					</button>

					<button
						type="button"
						className="history-share-box__action"
						onClick={handleCopy}
					>
						{copied ? "Copied!" : "Copy"}
					</button>

					<button
						type="button"
						className="history-share-box__action"
						onClick={shareToX}
					>
						X
					</button>

					<button
						type="button"
						className="history-share-box__action"
						onClick={shareToTelegram}
					>
						Telegram
					</button>

					<button
						type="button"
						className="history-share-box__action"
						onClick={shareByEmail}
					>
						Email
					</button>
				</div>
			</div>
		</div>
	);
}