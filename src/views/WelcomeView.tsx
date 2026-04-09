import logo from "../assets/logo.svg";
import planetwater from "../assets/planetwater.png";

type WelcomeViewProps = {
  onGetStarted: () => void | Promise<void>;
};

export default function WelcomeView({ onGetStarted }: WelcomeViewProps) {
	return (
		<main>
			<section className="welcome-view">
				<div></div>
				<div className="welcome-view__cta-wrapper">
					<div className="welcome-view__brand-block">
						<h1>Thank you for installing </h1>
						<img src={logo} alt="Bottle it back logo" style={{ width: "100%", maxWidth: "150px", height: "auto", paddingTop: "12px" }} />
					</div>
					<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', textAlign: 'center', paddingTop: "12px" }} >
						<p><strong>Your AI prompts cost water.</strong></p>
						<p style={{ width: '100%', maxWidth: '215px', paddingTop: "4px" }}>Track your AI footprint and give water back to communities in need.</p>
					</div>
					<div>
						<button className="welcome-view__cta" onClick={onGetStarted}>GET STARTED</button>
					</div>
				</div>
				<div style={{ textAlign: 'center'}}>
					<p>IN PARTNERSHIP WITH</p>
					<img src={planetwater} alt="Planet Water Foundation logo" style={{ width: "100%", maxWidth: "100px", height: "auto" }} />
				</div>
			</section>
		</main>
	)
}