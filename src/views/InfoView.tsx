import logo from "../assets/logo.svg";

type InfoViewProps = {
	onGetStarted?: () => void | Promise<void>;
};

export function CalendarIcon({ color = "#fff" }: { color?: string }) {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className="info-view__nav-icon icon">
			<rect
				x="3"
				y="5"
				width="18"
				height="16"
				rx="2.5"
				fill="none"
				stroke={color}
				strokeWidth="1.8"
			/>
			<line x1="3" y1="9" x2="21" y2="9" stroke={color} strokeWidth="1.8" />
			<line
				x1="8"
				y1="3.5"
				x2="8"
				y2="7"
				stroke={color}
				strokeWidth="1.8"
				strokeLinecap="round"
			/>
			<line
				x1="16"
				y1="3.5"
				x2="16"
				y2="7"
				stroke={color}
				strokeWidth="1.8"
				strokeLinecap="round"
			/>
			<line x1="8" y1="13" x2="8" y2="13" stroke={color} strokeWidth="2.8" strokeLinecap="round" />
			<line x1="12" y1="13" x2="12" y2="13" stroke={color} strokeWidth="2.8" strokeLinecap="round" />
			<line x1="16" y1="13" x2="16" y2="13" stroke={color} strokeWidth="2.8" strokeLinecap="round" />
			<line x1="8" y1="17" x2="8" y2="17" stroke={color} strokeWidth="2.8" strokeLinecap="round" />
			<line x1="12" y1="17" x2="12" y2="17" stroke={color} strokeWidth="2.8" strokeLinecap="round" />
			<line x1="16" y1="17" x2="16" y2="17" stroke={color} strokeWidth="2.8" strokeLinecap="round" />
		</svg>
	);
}

export function ClockIcon({ color = "#fff" }: { color?: string }) {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className="info-view__nav-icon icon">
			<circle
				cx="12"
				cy="12"
				r="9"
				fill="none"
				stroke={color}
				strokeWidth="1.8"
			/>
			<line
				x1="12"
				y1="12"
				x2="12"
				y2="7"
				stroke={color}
				strokeWidth="1.8"
				strokeLinecap="round"
			/>
			<line
				x1="12"
				y1="12"
				x2="15.5"
				y2="14.5"
				stroke={color}
				strokeWidth="1.8"
				strokeLinecap="round"
			/>
		</svg>
	);
}

export function BulbIcon({ color = "#fff" }: { color?: string }) {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className="info-view__nav-icon icon">
			<path
				d="M9 18h6M10 21h4M8.5 14.5c-1.4-1.1-2.5-2.8-2.5-5A6 6 0 0 1 18 9.5c0 2.2-1.1 3.9-2.5 5-.8.7-1.5 1.5-1.5 2.5h-4c0-1-.7-1.8-1.5-2.5Z"
				fill="none"
				stroke={color}
				strokeWidth="1.8"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<line x1="12" y1="2.5" x2="12" y2="1" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
			<line x1="4.4" y1="5.2" x2="3.2" y2="4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
			<line x1="19.6" y1="5.2" x2="20.8" y2="4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
			<line x1="2" y1="12" x2="0.8" y2="12" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
			<line x1="23.2" y1="12" x2="22" y2="12" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
		</svg>
	);
}

export function InfoIcon({ color = "#fff" } : { color?: string }) {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className="info-view__info-icon icon">
			<circle
				cx="12"
				cy="12"
				r="9"
				fill="none"
				stroke={color}
				strokeWidth="1.8"
			/>
			<line
				x1="12"
				y1="10.5"
				x2="12"
				y2="16"
				stroke={color}
				strokeWidth="1.8"
				strokeLinecap="round"
			/>
			<circle cx="12" cy="7.5" r="1.1" fill={color} />
		</svg>
	);
}

const PLATFORM_LABELS = ["ChatGPT", "Gemini", "Meta", "Claude", "perplexity"];

export default function InfoView({ onGetStarted }: InfoViewProps) {
	const isOnboarding = typeof onGetStarted === "function";

	return (
		<section className="info-view">

			<div className="info-view__body">
				<div className="info-view__brand-block">
					<img
						src={logo}
						alt="Bottle It Back"
						className="info-view__logo"
					/>

					<h1 className="info-view__headline">
						Give back every
						<br />
						bottle you take.
					</h1>
				</div>

				<p className="info-view__copy info-view__copy--lead">
					It is the only extension that is capable of tracking all AI chat platforms.
				</p>

				<div className="info-view__platforms" aria-label="Supported AI platforms">
					{PLATFORM_LABELS.map((label) => (
						<span key={label} className="info-view__platform">
							{label}
						</span>
					))}
				</div>

				<p className="info-view__copy info-view__copy--footer">
					Most importantly, it is the only program that allows users to offset what
					they use by giving back the amount of water they use to{" "}
					<strong>planet-water.org.</strong>
				</p>

				{isOnboarding && (
					<button
						type="button"
						className="info-view__cta"
						onClick={() => void onGetStarted?.()}
					>
						GET STARTED
					</button>
				)}
			</div>

			{isOnboarding && (
				<div className="info-view__mock-nav" aria-hidden="true">
					<div className="info-view__mock-nav-item">
						<CalendarIcon />
					</div>
					<div className="info-view__mock-nav-item info-view__mock-nav-item--active">
						<ClockIcon />
					</div>
					<div className="info-view__mock-nav-item">
						<BulbIcon />
					</div>
				</div>
			)}
		</section>
	);
}