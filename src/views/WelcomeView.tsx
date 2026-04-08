type WelcomeViewProps = {
  onGetStarted: () => void | Promise<void>;
};

export default function WelcomeView({ onGetStarted }: WelcomeViewProps) {
  return (
    <section>
      <h1>Welcome</h1>
      <p>Track your AI usage and estimate its water footprint.</p>
      <button type="button" onClick={onGetStarted}>
        Get Started
      </button>
    </section>
  );
}